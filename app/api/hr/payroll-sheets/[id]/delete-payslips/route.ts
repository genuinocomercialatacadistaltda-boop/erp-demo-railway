
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

/**
 * DELETE /api/hr/payroll-sheets/[id]/delete-payslips
 * Deleta apenas os contracheques individuais gerados (EmployeeDocument)
 * Mantém a folha de pagamento e os registros de pagamento intactos
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('\n🗑️ [DELETE-PAYSLIPS] Iniciando exclusão de contracheques...');
    console.log('   Payroll Sheet ID:', params.id);

    // Validar sessão
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).userType !== 'ADMIN') {
      console.log('❌ [DELETE-PAYSLIPS] Acesso negado - não é ADMIN');
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Verificar se a folha existe
    const sheet = await prisma.payrollSheet.findUnique({
      where: { id: params.id },
      include: {
        payments: {
          include: {
            employee: {
              select: { name: true }
            }
          }
        }
      }
    });

    if (!sheet) {
      console.log('❌ [DELETE-PAYSLIPS] Folha não encontrada');
      return NextResponse.json({ error: 'Folha não encontrada' }, { status: 404 });
    }

    console.log(`📋 Folha encontrada: ${sheet.month}/${sheet.year}`);
    console.log(`   Tem ${sheet.payments.length} pagamento(s) registrado(s)`);

    // Buscar todos os contracheques (EmployeeDocument) dos funcionários desta folha
    const employeeIds = sheet.payments.map(p => p.employeeId);
    
    console.log(`\n🔍 Buscando contracheques de ${employeeIds.length} funcionário(s)...`);

    // Data de referência para o mês/ano da folha
    const referenceStart = new Date(sheet.year, sheet.month - 1, 1);
    const referenceEnd = new Date(sheet.year, sheet.month, 1);

    const payslipsToDelete = await prisma.employeeDocument.findMany({
      where: {
        employeeId: { in: employeeIds },
        documentType: 'CONTRACHEQUE',
        referenceDate: {
          gte: referenceStart,
          lt: referenceEnd
        }
      },
      include: {
        employee: {
          select: { name: true }
        }
      }
    });

    console.log(`\n📄 Encontrados ${payslipsToDelete.length} contracheque(s) para deletar:`);
    payslipsToDelete.forEach(doc => {
      console.log(`   - ${doc.employee.name} (ID: ${doc.id.substring(0, 8)}...)`);
    });

    // Deletar todos os contracheques
    const deleteResult = await prisma.employeeDocument.deleteMany({
      where: {
        id: { in: payslipsToDelete.map(d => d.id) }
      }
    });

    console.log(`\n✅ ${deleteResult.count} contracheque(s) deletado(s) com sucesso!`);

    // 🆕 DELETAR AS DESPESAS FINANCEIRAS TAMBÉM
    console.log('\n💸 Procurando despesas financeiras (contas a pagar) para deletar...');
    
    const category = await prisma.expenseCategory.findFirst({
      where: {
        name: {
          contains: 'Pagamento',
          mode: 'insensitive'
        }
      }
    });

    let expenseDeleteCount = 0;
    if (category) {
      // Buscar nomes dos funcionários para criar o padrão de busca
      const employeeNames = sheet.payments.map(p => p.employee.name);
      console.log(`   Procurando despesas de ${employeeNames.length} funcionário(s)...`);

      // Deletar despesas que correspondem a estes funcionários neste mês/ano
      const expenseDeleteResult = await prisma.expense.deleteMany({
        where: {
          categoryId: category.id,
          createdAt: {
            gte: referenceStart,
            lt: referenceEnd
          },
          OR: employeeNames.map(name => ({
            description: {
              contains: name,
              mode: 'insensitive' as any
            }
          }))
        }
      });

      expenseDeleteCount = expenseDeleteResult.count;
      console.log(`   ✅ ${expenseDeleteCount} despesa(s) financeira(s) deletada(s)`);
    } else {
      console.log('   ⚠️ Categoria "Pagamento de Funcionários" não encontrada');
    }

    console.log('\n📝 Resumo da operação:');
    console.log(`   - ${deleteResult.count} contracheque(s) deletado(s)`);
    console.log(`   - ${expenseDeleteCount} despesa(s) deletada(s)`);
    console.log('   - A folha de pagamento e os registros de pagamento permanecem intactos');
    console.log('   - Você pode clicar em "Processar" novamente para gerar novos contracheques\n');

    return NextResponse.json({
      success: true,
      message: `${deleteResult.count} contracheque(s) e ${expenseDeleteCount} despesa(s) deletado(s) com sucesso`,
      deletedCount: deleteResult.count,
      expensesDeleted: expenseDeleteCount,
      payrollSheet: {
        id: sheet.id,
        month: sheet.month,
        year: sheet.year
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error('❌ [DELETE-PAYSLIPS] Erro:', error);
    return NextResponse.json(
      {
        error: 'Erro ao deletar contracheques',
        details: error.message
      },
      { status: 500 }
    );
  }
}
