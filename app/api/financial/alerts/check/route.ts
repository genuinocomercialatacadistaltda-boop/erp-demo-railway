
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    
    if (!session || !user || user.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const alerts = [];
    const today = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(today.getDate() + 3);

    // Verificar despesas próximas ao vencimento
    const upcomingExpenses = await prisma.expense.findMany({
      where: {
        status: 'PENDING',
        dueDate: {
          gte: today,
          lte: threeDaysFromNow,
        },
      },
      include: { Category: true },
    });

    for (const expense of upcomingExpenses) {
      const daysUntilDue = Math.ceil((new Date(expense.dueDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      alerts.push({
        type: 'PAYMENT_DUE',
        severity: daysUntilDue <= 1 ? 'high' : 'medium',
        title: `Despesa vencendo em ${daysUntilDue} dia(s)`,
        description: `${expense.description} - R$ ${expense.amount.toFixed(2)}`,
        action: `/admin/financeiro?tab=contas-pagar&id=${expense.id}`,
      });
    }

    // Verificar despesas atrasadas
    const overdueExpenses = await prisma.expense.findMany({
      where: {
        status: 'PENDING',
        dueDate: { lt: today },
      },
      include: { Category: true },
    });

    for (const expense of overdueExpenses) {
      const daysOverdue = Math.ceil((today.getTime() - new Date(expense.dueDate).getTime()) / (1000 * 60 * 60 * 24));
      alerts.push({
        type: 'PAYMENT_OVERDUE',
        severity: 'critical',
        title: `Despesa atrasada há ${daysOverdue} dia(s)`,
        description: `${expense.description} - R$ ${expense.amount.toFixed(2)}`,
        action: `/admin/financeiro?tab=contas-pagar&id=${expense.id}`,
      });
    }

    // Verificar contas a receber atrasadas
    const overdueReceivables = await prisma.receivable.findMany({
      where: {
        status: 'PENDING',
        dueDate: { lt: today },
      },
      include: { Customer: true },
    });

    for (const receivable of overdueReceivables) {
      const daysOverdue = Math.ceil((today.getTime() - new Date(receivable.dueDate).getTime()) / (1000 * 60 * 60 * 24));
      alerts.push({
        type: 'RECEIVABLE_OVERDUE',
        severity: 'high',
        title: `Recebimento atrasado há ${daysOverdue} dia(s)`,
        description: `${receivable.Customer?.name || 'Cliente'} - R$ ${receivable.amount.toFixed(2)}`,
        action: `/admin/financeiro?tab=contas-receber&id=${receivable.id}`,
      });
    }

    // Verificar saldo baixo
    const accounts = await prisma.bankAccount.findMany();
    const totalBalance = accounts.reduce((sum: number, acc: any) => sum + acc.balance, 0);

    if (totalBalance < 5000) {
      alerts.push({
        type: 'LOW_BALANCE',
        severity: totalBalance < 1000 ? 'critical' : 'high',
        title: 'Saldo bancário baixo',
        description: `Saldo total: R$ ${totalBalance.toFixed(2)}`,
        action: '/admin/financeiro',
      });
    }

    // NOVAS VERIFICAÇÕES DE INCONSISTÊNCIAS

    // 1. Verificar estoque negativo no BiStock
    const negativeStock = await prisma.clientInventory.findMany({
      where: {
        currentStock: { lt: 0 }
      },
      include: { Product: true }
    });

    for (const item of negativeStock) {
      alerts.push({
        type: 'NEGATIVE_STOCK',
        severity: 'critical',
        title: 'Estoque negativo detectado!',
        description: `Produto: ${item.Product?.name || 'Desconhecido'} - Estoque: ${item.currentStock}`,
        action: '/customer/gestao/estoque',
      });
    }

    // 2. Verificar receivables órfãos (sem pedido vinculado)
    const orphanReceivables = await prisma.receivable.findMany({
      where: {
        orderId: null,
        boletoId: null,
      },
      take: 10,
    });

    if (orphanReceivables.length > 0) {
      alerts.push({
        type: 'ORPHAN_RECEIVABLES',
        severity: 'medium',
        title: `${orphanReceivables.length} receivables órfãos`,
        description: 'Receivables sem pedido ou boleto vinculado. Pode indicar problema de integração.',
        action: '/admin/financeiro?tab=contas-receber',
      });
    }

    // 3. Verificar boletos PENDING com vencimento há mais de 30 dias
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const stuckBoletos = await prisma.boleto.findMany({
      where: {
        status: 'PENDING',
        dueDate: { lt: thirtyDaysAgo },
      },
      include: { Customer: true },
    });

    for (const boleto of stuckBoletos) {
      const daysStuck = Math.ceil((today.getTime() - new Date(boleto.dueDate).getTime()) / (1000 * 60 * 60 * 24));
      alerts.push({
        type: 'STUCK_BOLETO',
        severity: 'high',
        title: `Boleto vencido há ${daysStuck} dias (não atualizado)`,
        description: `Cliente: ${boleto.Customer?.name || 'Desconhecido'} - R$ ${boleto.amount.toFixed(2)}`,
        action: '/admin/boletos',
      });
    }

    // 4. Verificar CardTransactions PENDING há mais de 60 dias
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(today.getDate() - 60);

    const stuckCards = await prisma.cardTransaction.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: sixtyDaysAgo },
      },
    });

    if (stuckCards.length > 0) {
      const totalAmount = stuckCards.reduce((sum, t) => sum + Number(t.grossAmount), 0);
      alerts.push({
        type: 'STUCK_CARD_TRANSACTIONS',
        severity: 'high',
        title: `${stuckCards.length} transações de cartão pendentes há 60+ dias`,
        description: `Total: R$ ${totalAmount.toFixed(2)}. Verifique "Gestão de Cartões".`,
        action: '/admin/financeiro/cartoes',
      });
    }

    // 5. Verificar despesas sem categoria
    const expensesWithoutCategory = await prisma.expense.findMany({
      where: {
        categoryId: null,
      },
      take: 5,
    });

    if (expensesWithoutCategory.length > 0) {
      alerts.push({
        type: 'EXPENSES_NO_CATEGORY',
        severity: 'low',
        title: `${expensesWithoutCategory.length}+ despesas sem categoria`,
        description: 'Algumas despesas não estão categorizadas corretamente.',
        action: '/admin/financeiro?tab=contas-pagar',
      });
    }

    // 6. Verificar pagamentos de funcionários sem aceite digital
    const pendingEmployeeExpenses = await prisma.expense.findMany({
      where: {
        status: 'PENDING',
        Category: {
          name: {
            contains: 'Pagamento de Funcionários',
            mode: 'insensitive',
          },
        },
      },
      include: { Category: true },
      take: 10,
    });

    let expensesWithoutAcknowledgment = 0;
    for (const expense of pendingEmployeeExpenses) {
      // Extrair nome do funcionário da descrição
      const match = expense.description.match(/- (.+?) \(/);
      if (match) {
        const employeeName = match[1];
        const employee = await prisma.employee.findFirst({
          where: { name: { contains: employeeName, mode: 'insensitive' } },
        });

        if (employee) {
          const payment = await prisma.employeePayment.findFirst({
            where: { employeeId: employee.id },
            include: { acknowledgments: true },
          });

          if (payment && !payment.acknowledgments.some(ack => ack.acceptedTerms)) {
            expensesWithoutAcknowledgment++;
          }
        }
      }
    }

    if (expensesWithoutAcknowledgment > 0) {
      alerts.push({
        type: 'PAYMENTS_NO_ACKNOWLEDGMENT',
        severity: 'medium',
        title: `${expensesWithoutAcknowledgment} pagamentos sem aceite digital`,
        description: 'Funcionários precisam assinar contracheques antes do pagamento.',
        action: '/admin/rh/pagamentos',
      });
    }

    // Ordenar alertas por severidade (critical > high > medium > low)
    const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    // Estatísticas resumidas
    const stats = {
      critical: alerts.filter(a => a.severity === 'critical').length,
      high: alerts.filter(a => a.severity === 'high').length,
      medium: alerts.filter(a => a.severity === 'medium').length,
      low: alerts.filter(a => a.severity === 'low').length,
    };

    return NextResponse.json({ 
      alerts, 
      total: alerts.length,
      stats,
      lastCheck: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Erro ao verificar alertas:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
