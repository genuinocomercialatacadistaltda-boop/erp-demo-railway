
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).userType !== "ADMIN") {
      return NextResponse.json(
        { error: "Acesso negado" },
        { status: 401 }
      );
    }

    const sheet = await prisma.payrollSheet.findUnique({
      where: { id: params.id },
      include: {
        payments: {
          include: {
            employee: true,
          },
          orderBy: {
            employee: {
              name: "asc",
            },
          },
        },
      },
    });

    if (!sheet) {
      return NextResponse.json(
        { error: "Folha não encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json(sheet);
  } catch (error) {
    console.error("[PAYROLL_SHEET_GET] Error:", error);
    return NextResponse.json(
      { error: "Erro ao buscar folha" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('\n🗑️ [DELETE-PAYROLL-SHEET] Iniciando EXCLUSÃO COMPLETA da folha...');
    console.log('   Payroll Sheet ID:', params.id);

    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).userType !== "ADMIN") {
      console.log('❌ [DELETE-PAYROLL-SHEET] Acesso negado - não é ADMIN');
      return NextResponse.json(
        { error: "Acesso negado" },
        { status: 401 }
      );
    }

    const sheet = await prisma.payrollSheet.findUnique({
      where: { id: params.id },
      include: {
        payments: {
          include: {
            employee: {
              select: { name: true }
            }
          }
        },
      },
    });

    if (!sheet) {
      console.log('❌ [DELETE-PAYROLL-SHEET] Folha não encontrada');
      return NextResponse.json(
        { error: "Folha não encontrada" },
        { status: 404 }
      );
    }

    console.log(`📋 Folha encontrada: ${sheet.month}/${sheet.year}`);
    console.log(`   Tem ${sheet.payments.length} pagamento(s) registrado(s)`);
    console.log('   ⚠️ ATENÇÃO: Deletando TUDO (contracheques + pagamentos + despesas + folha)');

    // EXCLUSÃO COMPLETA EM TRANSAÇÃO ATÔMICA
    const deletedCounts = await prisma.$transaction(async (tx) => {
      let counts = {
        documents: 0,
        expenses: 0,
        payments: 0
      };

      // 1. Buscar e deletar contracheques (EmployeeDocument)
      const employeeIds = sheet.payments.map(p => p.employeeId);
      const referenceStart = new Date(sheet.year, sheet.month - 1, 1);
      const referenceEnd = new Date(sheet.year, sheet.month, 1);

      if (employeeIds.length > 0) {
        const documentsToDelete = await tx.employeeDocument.findMany({
          where: {
            employeeId: { in: employeeIds },
            documentType: 'CONTRACHEQUE',
            referenceDate: {
              gte: referenceStart,
              lt: referenceEnd
            }
          }
        });

        if (documentsToDelete.length > 0) {
          console.log(`\n🗑️ Deletando ${documentsToDelete.length} contracheque(s)...`);
          const deleteDocsResult = await tx.employeeDocument.deleteMany({
            where: {
              id: { in: documentsToDelete.map(d => d.id) }
            }
          });
          counts.documents = deleteDocsResult.count;
          console.log(`   ✅ ${deleteDocsResult.count} contracheque(s) deletado(s)`);
        }
      }

      // 2. Buscar e deletar despesas financeiras associadas aos pagamentos
      for (const payment of sheet.payments) {
        console.log(`\n🗑️ Buscando despesas do pagamento: ${payment.employee.name}...`);
        
        // Buscar despesas pela descrição que contém o nome do funcionário e o mês/ano
        const expenses = await tx.expense.findMany({
          where: {
            description: {
              contains: payment.employee.name
            },
            // Buscar despesas criadas no mesmo mês/ano
            createdAt: {
              gte: referenceStart,
              lt: referenceEnd
            }
          }
        });

        if (expenses.length > 0) {
          console.log(`   Encontradas ${expenses.length} despesa(s) para deletar`);
          
          for (const expense of expenses) {
            await tx.expense.delete({
              where: { id: expense.id }
            });
            counts.expenses++;
            console.log(`   ✅ Despesa deletada: ${expense.description} - R$ ${expense.amount.toFixed(2)}`);
          }
        }
      }

      // 3. Deletar todos os pagamentos
      if (sheet.payments.length > 0) {
        console.log(`\n🗑️ Deletando ${sheet.payments.length} pagamento(s)...`);
        const deletePaymentsResult = await tx.employeePayment.deleteMany({
          where: {
            payrollSheetId: sheet.id
          }
        });
        counts.payments = deletePaymentsResult.count;
        console.log(`   ✅ ${deletePaymentsResult.count} pagamento(s) deletado(s)`);
      }

      // 4. Deletar a folha de pagamento
      console.log(`\n🗑️ Deletando folha de pagamento...`);
      await tx.payrollSheet.delete({
        where: { id: params.id }
      });
      console.log(`   ✅ Folha deletada`);

      return counts;
    });

    console.log('\n✅ ✅ ✅ EXCLUSÃO COMPLETA FINALIZADA!');
    console.log(`   📄 Contracheques deletados: ${deletedCounts.documents}`);
    console.log(`   💰 Despesas deletadas: ${deletedCounts.expenses}`);
    console.log(`   💳 Pagamentos deletados: ${deletedCounts.payments}`);
    console.log(`   📋 Folha de pagamento deletada`);
    console.log('   🔄 Agora você pode fazer o upload novamente e reprocessar tudo!\n');

    return NextResponse.json({
      success: true,
      message: 'Folha de pagamento, pagamentos, despesas e contracheques excluídos com sucesso',
      deletedCounts
    });
  } catch (error: any) {
    console.error("[PAYROLL_SHEET_DELETE] Error:", error);
    return NextResponse.json(
      { error: "Erro ao excluir folha", details: error.message },
      { status: 500 }
    );
  }
}
