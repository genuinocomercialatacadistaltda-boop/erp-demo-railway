
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getEmployeesWithoutAcknowledgment } from '@/lib/payment-helpers';

/**
 * API para verificar aceites digitais de funcionários
 * POST: Verifica quais funcionários não deram aceite nos pagamentos
 */
export async function POST(req: NextRequest) {
  try {
    console.log('\n🔍 [CHECK_ACKNOWLEDGMENTS] Verificando aceites digitais');

    const session = await getServerSession(authOptions);

    if (!session?.user || (session.user as any).userType !== 'ADMIN') {
      console.log('[CHECK_ACKNOWLEDGMENTS] Acesso negado');
      return NextResponse.json(
        { error: 'Acesso não autorizado' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { expenseIds } = body;

    if (!expenseIds || !Array.isArray(expenseIds)) {
      return NextResponse.json(
        { error: 'expenseIds é obrigatório e deve ser um array' },
        { status: 400 }
      );
    }

    console.log(`[CHECK_ACKNOWLEDGMENTS] Verificando ${expenseIds.length} despesas`);

    // Buscar despesas para encontrar os paymentIds vinculados
    const { prisma } = await import('@/lib/prisma');
    
    const expenses = await prisma.expense.findMany({
      where: {
        id: {
          in: expenseIds
        },
        Category: {
          name: {
            contains: 'Pagamento de Funcionários',
            mode: 'insensitive'
          }
        }
      },
      select: {
        id: true,
        description: true
      }
    });

    console.log(`[CHECK_ACKNOWLEDGMENTS] ${expenses.length} despesas de pagamento encontradas`);

    // Extrair nomes de funcionários das descrições das despesas
    // Formato esperado: "Adiantamento - Nome do Funcionário (MM/YYYY)"
    const employeeNames = expenses.map(exp => {
      const match = exp.description.match(/-\s*(.+?)\s*\(/);
      return match ? match[1].trim() : null;
    }).filter(name => name !== null);

    console.log(`[CHECK_ACKNOWLEDGMENTS] Funcionários identificados:`, employeeNames);

    // Buscar pagamentos dos funcionários
    const payments = await prisma.employeePayment.findMany({
      where: {
        employee: {
          name: {
            in: employeeNames
          }
        }
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    const paymentIds = payments.map(p => p.id);

    console.log(`[CHECK_ACKNOWLEDGMENTS] ${paymentIds.length} pagamentos encontrados`);

    // Verificar aceites
    const withoutAck = await getEmployeesWithoutAcknowledgment(paymentIds);

    console.log(`[CHECK_ACKNOWLEDGMENTS] ${withoutAck.length} funcionários SEM aceite`);

    if (withoutAck.length > 0) {
      console.log('[CHECK_ACKNOWLEDGMENTS] Funcionários pendentes:');
      withoutAck.forEach(emp => {
        console.log(`   - ${emp.employeeName} (${emp.month}/${emp.year})`);
      });

      return NextResponse.json({
        canProceed: false,
        message: 'Alguns funcionários ainda não deram aceite digital nos contracheques',
        employeesWithoutAcknowledgment: withoutAck
      });
    }

    console.log('✅ [CHECK_ACKNOWLEDGMENTS] Todos os funcionários deram aceite!');

    return NextResponse.json({
      canProceed: true,
      message: 'Todos os funcionários deram aceite digital',
      employeesWithoutAcknowledgment: []
    });

  } catch (error: any) {
    console.error('[CHECK_ACKNOWLEDGMENTS] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao verificar aceites', details: error.message },
      { status: 500 }
    );
  }
}
