export const dynamic = 'force-dynamic';


import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

/**
 * API: Alertas Financeiros
 * GET /api/financial/alerts - Lista alertas
 * POST /api/financial/alerts/check - Verifica e cria alertas automaticamente
 */

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    const user = session?.user as any;

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const isRead = searchParams.get('isRead');
    const isResolved = searchParams.get('isResolved');
    const severity = searchParams.get('severity');
    const limit = parseInt(searchParams.get('limit') || '100');

    const where: any = {};

    if (isRead !== null) {
      where.isRead = isRead === 'true';
    }

    if (isResolved !== null) {
      where.isResolved = isResolved === 'true';
    }

    if (severity) {
      where.severity = severity;
    }

    const alerts = await prisma.financialAlert.findMany({
      where,
      orderBy: [
        { isResolved: 'asc' },
        { severity: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
    });

    return NextResponse.json(alerts);
  } catch (error: any) {
    console.error('Erro ao buscar alertas:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar alertas: ' + error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    const user = session?.user as any;

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const createdAlerts = [];

    // 1. Verifica saldos baixos
    const lowBalanceAccounts = await prisma.bankAccount.findMany({
      where: {
        isActive: true,
        balance: {
          lt: 1000, // Menos de R$ 1.000
        },
      },
    });

    for (const account of lowBalanceAccounts) {
      const existingAlert = await prisma.financialAlert.findFirst({
        where: {
          alertType: 'LOW_BALANCE',
          isResolved: false,
          message: {
            contains: account.name,
          },
        },
      });

      if (!existingAlert) {
        const alert = await prisma.financialAlert.create({
          data: {
            alertType: 'LOW_BALANCE',
            severity: account.balance < 500 ? 'CRITICAL' : 'HIGH',
            title: 'Saldo Baixo',
            message: `Conta ${account.name} com saldo baixo: R$ ${account.balance.toFixed(2)}`,
            triggerValue: account.balance,
            thresholdValue: 1000,
          },
        });
        createdAlerts.push(alert);
      }
    }

    // 2. Verifica pagamentos atrasados
    const overdueExpenses = await prisma.expense.findMany({
      where: {
        status: 'PENDING',
        dueDate: {
          lt: new Date(),
        },
      },
    });

    if (overdueExpenses.length > 0) {
      const existingAlert = await prisma.financialAlert.findFirst({
        where: {
          alertType: 'OVERDUE_PAYMENT',
          isResolved: false,
        },
      });

      if (!existingAlert) {
        const totalOverdue = overdueExpenses.reduce((sum: number, e: any) => sum + e.amount, 0);
        const alert = await prisma.financialAlert.create({
          data: {
            alertType: 'OVERDUE_PAYMENT',
            severity: 'HIGH',
            title: 'Pagamentos Atrasados',
            message: `${overdueExpenses.length} pagamento(s) atrasado(s). Total: R$ ${totalOverdue.toFixed(2)}`,
            triggerValue: totalOverdue,
          },
        });
        createdAlerts.push(alert);
      }
    }

    // 3. Verifica recebíveis atrasados
    const overdueReceivables = await prisma.receivable.findMany({
      where: {
        status: 'PENDING',
        dueDate: {
          lt: new Date(),
        },
      },
    });

    if (overdueReceivables.length > 0) {
      const existingAlert = await prisma.financialAlert.findFirst({
        where: {
          alertType: 'OVERDUE_RECEIVABLE',
          isResolved: false,
        },
      });

      if (!existingAlert) {
        const totalOverdue = overdueReceivables.reduce((sum: number, r: any) => sum + r.amount, 0);
        const alert = await prisma.financialAlert.create({
          data: {
            alertType: 'OVERDUE_RECEIVABLE',
            severity: 'MEDIUM',
            title: 'Recebimentos Atrasados',
            message: `${overdueReceivables.length} recebimento(s) atrasado(s). Total: R$ ${totalOverdue.toFixed(2)}`,
            triggerValue: totalOverdue,
          },
        });
        createdAlerts.push(alert);
      }
    }

    // 4. Verifica orçamentos excedidos
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const budgets = await prisma.budget.findMany({
      where: {
        referenceYear: currentYear,
        referenceMonth: currentMonth,
      },
      include: {
        Category: true,
      },
    });

    for (const budget of budgets) {
      const actualExpenses = await prisma.expense.aggregate({
        where: {
          status: 'PAID',
          categoryId: budget.categoryId || undefined,
          paymentDate: {
            gte: new Date(currentYear, currentMonth - 1, 1),
            lt: new Date(currentYear, currentMonth, 1),
          },
        },
        _sum: {
          amount: true,
        },
      });

      const actualAmount = actualExpenses._sum.amount || 0;

      if (actualAmount > budget.plannedAmount) {
        const existingAlert = await prisma.financialAlert.findFirst({
          where: {
            alertType: 'BUDGET_EXCEEDED',
            isResolved: false,
            message: {
              contains: budget.Category?.name || budget.categoryName || '',
            },
          },
        });

        if (!existingAlert) {
          const exceededBy = actualAmount - budget.plannedAmount;
          const exceededPercent = ((exceededBy / budget.plannedAmount) * 100).toFixed(1);
          
          const alert = await prisma.financialAlert.create({
            data: {
              alertType: 'BUDGET_EXCEEDED',
              severity: exceededPercent > '50' ? 'CRITICAL' : 'HIGH',
              title: 'Orçamento Excedido',
              message: `Orçamento de ${budget.Category?.name || budget.categoryName} excedido em ${exceededPercent}% (R$ ${exceededBy.toFixed(2)})`,
              triggerValue: actualAmount,
              thresholdValue: budget.plannedAmount,
            },
          });
          createdAlerts.push(alert);
        }
      }
    }

    return NextResponse.json({
      success: true,
      alertsCreated: createdAlerts.length,
      alerts: createdAlerts,
    });
  } catch (error: any) {
    console.error('Erro ao verificar alertas:', error);
    return NextResponse.json(
      { error: 'Erro ao verificar alertas: ' + error.message },
      { status: 500 }
    );
  }
}
