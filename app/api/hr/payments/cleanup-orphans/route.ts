
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

/**
 * API para limpar pagamentos órfãos (sem folha vinculada)
 */

export async function POST(req: NextRequest) {
  try {
    console.log("[CLEANUP_ORPHANS] Iniciando limpeza de pagamentos órfãos");
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).userType !== "ADMIN") {
      console.log("[CLEANUP_ORPHANS] Acesso negado - usuário não é admin");
      return NextResponse.json(
        { error: "Acesso negado" },
        { status: 401 }
      );
    }

    // Buscar todos os pagamentos órfãos (sem payrollSheetId)
    const orphanPayments = await prisma.employeePayment.findMany({
      where: {
        payrollSheetId: null
      },
      include: {
        employee: {
          select: {
            name: true
          }
        }
      }
    });

    console.log(`[CLEANUP_ORPHANS] Encontrados ${orphanPayments.length} pagamentos órfãos`);

    if (orphanPayments.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Nenhum pagamento órfão encontrado",
        deleted: 0
      });
    }

    // Excluir pagamentos órfãos em uma transação
    const result = await prisma.$transaction(async (tx) => {
      // 1. Buscar e deletar despesas associadas
      const paymentIds = orphanPayments.map(p => p.id);
      
      // Buscar categoria de Pagamento de Funcionários
      const category = await tx.expenseCategory.findFirst({
        where: { name: "Pagamento de Funcionários" }
      });

      let deletedExpenses = 0;
      if (category) {
        // Deletar despesas relacionadas aos pagamentos órfãos
        for (const payment of orphanPayments) {
          const employeeName = payment.employee.name;
          const month = payment.month;
          const year = payment.year;

          const expenses = await tx.expense.deleteMany({
            where: {
              categoryId: category.id,
              description: {
                contains: employeeName,
                mode: 'insensitive'
              },
              createdAt: {
                gte: new Date(year, month - 1, 1),
                lt: new Date(year, month, 1)
              }
            }
          });

          deletedExpenses += expenses.count;
        }
      }

      // 2. Deletar contracheques gerados
      let deletedDocuments = 0;
      for (const payment of orphanPayments) {
        const docs = await tx.employeeDocument.deleteMany({
          where: {
            employeeId: payment.employeeId,
            documentType: 'CONTRACHEQUE',
            referenceDate: {
              gte: new Date(payment.year, payment.month - 1, 1),
              lt: new Date(payment.year, payment.month, 1)
            }
          }
        });
        deletedDocuments += docs.count;
      }

      // 3. Deletar os pagamentos órfãos
      const deletedPayments = await tx.employeePayment.deleteMany({
        where: {
          payrollSheetId: null
        }
      });

      console.log(`[CLEANUP_ORPHANS] Limpeza concluída:`);
      console.log(`  - Pagamentos deletados: ${deletedPayments.count}`);
      console.log(`  - Despesas deletadas: ${deletedExpenses}`);
      console.log(`  - Contracheques deletados: ${deletedDocuments}`);

      return {
        deletedPayments: deletedPayments.count,
        deletedExpenses,
        deletedDocuments
      };
    });

    return NextResponse.json({
      success: true,
      message: `${result.deletedPayments} pagamento(s) órfão(s) deletado(s) com sucesso`,
      ...result
    });

  } catch (error: any) {
    console.error("[CLEANUP_ORPHANS] Erro completo:", {
      message: error?.message,
      stack: error?.stack,
    });
    return NextResponse.json(
      { error: `Erro ao limpar pagamentos órfãos: ${error?.message}` },
      { status: 500 }
    );
  }
}
