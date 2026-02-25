export const dynamic = 'force-dynamic';


import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { startOfMonth, endOfMonth, addMonths, subMonths, format } from 'date-fns';

/**
 * API: Previsões de Fluxo de Caixa
 * GET /api/financial/predictions - Lista previsões
 * POST /api/financial/predictions/generate - Gera previsões com IA
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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const months = parseInt(searchParams.get('months') || '6');

    const where: any = {};

    if (startDate || endDate) {
      where.predictionDate = {};
      if (startDate) {
        where.predictionDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.predictionDate.lte = new Date(endDate);
      }
    } else {
      // Por padrão, últimos 6 meses de previsões
      where.predictionDate = {
        gte: new Date(),
        lte: addMonths(new Date(), months),
      };
    }

    const predictions = await prisma.cashFlowPrediction.findMany({
      where,
      orderBy: {
        predictionDate: 'asc',
      },
    });

    return NextResponse.json(predictions);
  } catch (error: any) {
    console.error('Erro ao buscar previsões:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar previsões: ' + error.message },
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
    const { months = 6, method = 'AI' } = body;

    // Análise histórica dos últimos 6 meses
    const historicalMonths = 6;
    const historicalData = [];

    for (let i = historicalMonths; i > 0; i--) {
      const monthDate = subMonths(new Date(), i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      // Receitas do mês
      const income = await prisma.receivable.aggregate({
        where: {
          status: 'PAID',
          paymentDate: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
        _sum: {
          netAmount: true,
        },
      });

      // Despesas do mês
      const expenses = await prisma.expense.aggregate({
        where: {
          status: 'PAID',
          paymentDate: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
        _sum: {
          amount: true,
        },
      });

      historicalData.push({
        month: format(monthDate, 'yyyy-MM'),
        income: income._sum.netAmount || 0,
        expense: expenses._sum.amount || 0,
        balance: (income._sum.netAmount || 0) - (expenses._sum.amount || 0),
      });
    }

    // Calcula médias
    const avgIncome = historicalData.reduce((sum, m) => sum + m.income, 0) / historicalMonths;
    const avgExpense = historicalData.reduce((sum, m) => sum + m.expense, 0) / historicalMonths;

    // Calcula tendência (crescimento/decrescimento)
    const recentIncome = historicalData.slice(-3).reduce((sum, m) => sum + m.income, 0) / 3;
    const oldIncome = historicalData.slice(0, 3).reduce((sum, m) => sum + m.income, 0) / 3;
    const incomeTrend = oldIncome > 0 ? (recentIncome - oldIncome) / oldIncome : 0;

    const recentExpense = historicalData.slice(-3).reduce((sum, m) => sum + m.expense, 0) / 3;
    const oldExpense = historicalData.slice(0, 3).reduce((sum, m) => sum + m.expense, 0) / 3;
    const expenseTrend = oldExpense > 0 ? (recentExpense - oldExpense) / oldExpense : 0;

    // Gera previsões para os próximos meses
    const predictions = [];
    
    // Busca saldo atual
    const currentBalance = await prisma.bankAccount.aggregate({
      where: {
        isActive: true,
      },
      _sum: {
        balance: true,
      },
    });

    let runningBalance = currentBalance._sum.balance || 0;

    for (let i = 1; i <= months; i++) {
      const predictionDate = addMonths(new Date(), i);
      
      // Aplica tendência
      const predictedIncome = avgIncome * (1 + incomeTrend * i * 0.1);
      const predictedExpense = avgExpense * (1 + expenseTrend * i * 0.1);
      const predictedBalance = runningBalance + predictedIncome - predictedExpense;

      // Confiança diminui com o tempo
      const confidence = Math.max(0.5, 0.9 - (i * 0.05));

      const prediction = await prisma.cashFlowPrediction.create({
        data: {
          predictionDate: startOfMonth(predictionDate),
          predictedIncome,
          predictedExpense,
          predictedBalance,
          confidence,
          method,
          notes: `Baseado em média de ${historicalMonths} meses. Tendência receita: ${(incomeTrend * 100).toFixed(1)}%, Tendência despesa: ${(expenseTrend * 100).toFixed(1)}%`,
        },
      });

      predictions.push(prediction);
      runningBalance = predictedBalance;
    }

    return NextResponse.json({
      success: true,
      generated: predictions.length,
      historicalData,
      predictions,
      summary: {
        avgIncome,
        avgExpense,
        incomeTrend: (incomeTrend * 100).toFixed(2) + '%',
        expenseTrend: (expenseTrend * 100).toFixed(2) + '%',
      },
    });
  } catch (error: any) {
    console.error('Erro ao gerar previsões:', error);
    return NextResponse.json(
      { error: 'Erro ao gerar previsões: ' + error.message },
      { status: 500 }
    );
  }
}
