export const dynamic = 'force-dynamic';


import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

/**
 * API: Orçamentos
 * GET /api/financial/budgets - Lista orçamentos
 * POST /api/financial/budgets - Cria orçamento
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
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const month = searchParams.get('month') ? parseInt(searchParams.get('month') as string) : null;
    const categoryId = searchParams.get('categoryId');

    const where: any = {
      referenceYear: year,
    };

    if (month) {
      where.referenceMonth = month;
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    const budgets = await prisma.budget.findMany({
      where,
      include: {
        Category: true,
      },
      orderBy: [
        { referenceYear: 'desc' },
        { referenceMonth: 'asc' },
      ],
    });

    // Calcula valores reais gastos para cada orçamento
    const budgetsWithActuals = await Promise.all(
      budgets.map(async (budget: any) => {
        // Busca despesas reais
        const actualExpenses = await prisma.expense.aggregate({
          where: {
            status: 'PAID',
            categoryId: budget.categoryId || undefined,
            paymentDate: {
              gte: new Date(budget.referenceYear, (budget.referenceMonth || 1) - 1, 1),
              lt: budget.referenceMonth 
                ? new Date(budget.referenceYear, budget.referenceMonth, 1)
                : new Date(budget.referenceYear + 1, 0, 1),
            },
          },
          _sum: {
            amount: true,
          },
        });

        const actualAmount = actualExpenses._sum.amount || 0;
        const variance = actualAmount - budget.plannedAmount;
        const variancePercent = budget.plannedAmount > 0 
          ? (variance / budget.plannedAmount) * 100 
          : 0;

        return {
          ...budget,
          actualAmount,
          variance,
          variancePercent,
          status: actualAmount > budget.plannedAmount ? 'EXCEEDED' : 
                  actualAmount > budget.plannedAmount * 0.9 ? 'WARNING' : 'OK',
        };
      })
    );

    return NextResponse.json(budgetsWithActuals);
  } catch (error: any) {
    console.error('Erro ao buscar orçamentos:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar orçamentos: ' + error.message },
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

    const body = await request.json();
    const {
      categoryId,
      categoryName,
      budgetType,
      referenceYear,
      referenceMonth,
      plannedAmount,
      notes,
    } = body;

    if (!budgetType || !referenceYear || !plannedAmount) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios: budgetType, referenceYear, plannedAmount' },
        { status: 400 }
      );
    }

    const budget = await prisma.budget.create({
      data: {
        categoryId,
        categoryName,
        budgetType,
        referenceYear,
        referenceMonth,
        plannedAmount,
        notes,
        createdBy: session.user?.email || undefined,
      },
      include: {
        Category: true,
      },
    });

    return NextResponse.json(budget);
  } catch (error: any) {
    console.error('Erro ao criar orçamento:', error);
    return NextResponse.json(
      { error: 'Erro ao criar orçamento: ' + error.message },
      { status: 500 }
    );
  }
}
