export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

/**
 * POST - Recalcular saldo da conta baseado nas transações
 * Útil para corrigir inconsistências causadas por race conditions
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
    }

    const accountId = params.id;
    
    // Buscar conta
    const account = await prisma.bankAccount.findUnique({
      where: { id: accountId }
    });

    if (!account) {
      return NextResponse.json(
        { error: "Conta bancária não encontrada" },
        { status: 404 }
      );
    }

    // Buscar todas as transações da conta
    const transactions = await prisma.transaction.findMany({
      where: { bankAccountId: accountId },
      orderBy: { createdAt: 'asc' }
    });

    // Calcular saldo baseado em TODAS as transações
    // Assumindo que a conta começou com saldo zero
    // Entradas (INCOME) somam, Saídas (EXPENSE) subtraem
    let calculatedBalance = 0;
    let totalIncome = 0;
    let totalExpense = 0;
    
    for (const t of transactions) {
      if (t.type === 'INCOME') {
        calculatedBalance += Number(t.amount);
        totalIncome += Number(t.amount);
      } else if (t.type === 'EXPENSE') {
        calculatedBalance -= Number(t.amount);
        totalExpense += Number(t.amount);
      }
    }

    const oldBalance = Number(account.balance);
    const difference = oldBalance - calculatedBalance;

    console.log('📊 [RECALCULATE] Conta:', account.name);
    console.log('📊 [RECALCULATE] Total transações:', transactions.length);
    console.log('📊 [RECALCULATE] Total entradas:', totalIncome);
    console.log('📊 [RECALCULATE] Total saídas:', totalExpense);
    console.log('📊 [RECALCULATE] Saldo antigo:', oldBalance);
    console.log('📊 [RECALCULATE] Saldo calculado:', calculatedBalance);
    console.log('📊 [RECALCULATE] Diferença:', difference);

    // Atualizar saldo da conta
    const updatedAccount = await prisma.bankAccount.update({
      where: { id: accountId },
      data: { balance: calculatedBalance }
    });

    // Recalcular balanceAfter de todas as transações
    let runningBalance = 0;
    let updatedTransactions = 0;
    
    for (const t of transactions) {
      if (t.type === 'INCOME') {
        runningBalance += Number(t.amount);
      } else if (t.type === 'EXPENSE') {
        runningBalance -= Number(t.amount);
      }
      
      // Atualizar balanceAfter se diferente
      if (Math.abs(Number(t.balanceAfter) - runningBalance) > 0.01) {
        await prisma.transaction.update({
          where: { id: t.id },
          data: { balanceAfter: runningBalance }
        });
        updatedTransactions++;
      }
    }

    console.log('📊 [RECALCULATE] Transações corrigidas:', updatedTransactions);

    return NextResponse.json({
      success: true,
      account: updatedAccount.name,
      oldBalance,
      newBalance: calculatedBalance,
      difference,
      totalTransactions: transactions.length,
      totalIncome,
      totalExpense,
      transactionsUpdated: updatedTransactions,
      message: `Saldo recalculado de R$ ${oldBalance.toFixed(2)} para R$ ${calculatedBalance.toFixed(2)}`
    });
  } catch (error) {
    console.error("Erro ao recalcular saldo:", error);
    return NextResponse.json(
      { error: "Erro ao recalcular saldo" },
      { status: 500 }
    );
  }
}
