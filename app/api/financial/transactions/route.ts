export const dynamic = 'force-dynamic';


import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

// Função para recalcular todos os saldos de uma conta em ordem cronológica
async function recalculateAccountBalances(bankAccountId: string) {
  // Buscar todas as transações da conta em ordem cronológica
  const allTransactions = await prisma.transaction.findMany({
    where: { bankAccountId },
    orderBy: { createdAt: 'asc' }
  });

  // Calcular saldo inicial (saldo da conta menos todas as transações)
  const account = await prisma.bankAccount.findUnique({
    where: { id: bankAccountId }
  });

  if (!account) return;

  // Recalcular do zero
  let runningBalance = 0;
  
  // Calcular o saldo base (antes da primeira transação)
  // Precisamos "reverter" todas as transações para encontrar o saldo inicial
  for (const t of allTransactions) {
    const amount = Number(t.amount);
    if (t.type === 'INCOME' || t.type === 'ADJUSTMENT') {
      runningBalance -= amount; // Reverter para encontrar saldo inicial
    } else if (t.type === 'EXPENSE') {
      runningBalance += amount; // Reverter para encontrar saldo inicial
    }
  }
  
  // runningBalance agora representa o saldo inicial teórico
  // Mas vamos usar 0 e recalcular baseado no saldo atual da conta
  // A abordagem mais segura: começar do saldo atual e subtrair todas as transações
  // para encontrar o saldo base, depois recalcular do zero
  
  // Abordagem simplificada: recalcular a partir do zero e atualizar o saldo final
  runningBalance = 0;
  
  // Se existir uma transação de abertura ou se quisermos preservar um saldo base,
  // podemos buscá-lo. Por agora, vamos recalcular assumindo que a primeira transação
  // define o primeiro saldo
  
  // Buscar saldo base da última transação ANTES de todas (se existir)
  // Como não temos isso, vamos assumir que o saldo inicial é account.balance - soma das transações
  let totalTransactions = 0;
  for (const t of allTransactions) {
    const amount = Number(t.amount);
    if (t.type === 'INCOME' || t.type === 'ADJUSTMENT') {
      totalTransactions += amount;
    } else if (t.type === 'EXPENSE') {
      totalTransactions -= amount;
    }
  }
  
  // Saldo base = saldo atual - soma das transações
  const baseBalance = Number(account.balance) - totalTransactions;
  runningBalance = baseBalance;

  // Agora recalcular cada balanceAfter
  for (const t of allTransactions) {
    const amount = Number(t.amount);
    if (t.type === 'INCOME' || t.type === 'ADJUSTMENT') {
      runningBalance += amount;
    } else if (t.type === 'EXPENSE') {
      runningBalance -= amount;
    }

    // Atualizar balanceAfter se estiver diferente
    if (Math.abs(Number(t.balanceAfter) - runningBalance) > 0.01) {
      await prisma.transaction.update({
        where: { id: t.id },
        data: { balanceAfter: runningBalance }
      });
    }
  }

  // Atualizar saldo final da conta se necessário
  if (Math.abs(Number(account.balance) - runningBalance) > 0.01) {
    await prisma.bankAccount.update({
      where: { id: bankAccountId },
      data: { balance: runningBalance }
    });
  }
  
  console.log(`[RECALCULATE] Conta ${bankAccountId}: ${allTransactions.length} transações recalculadas. Saldo final: R$ ${runningBalance.toFixed(2)}`);
}

// GET - Listar transações
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const bankAccountId = searchParams.get("bankAccountId");
    const type = searchParams.get("type");
    const limit = searchParams.get("limit");

    const where: any = {};
    if (bankAccountId) where.bankAccountId = bankAccountId;
    if (type) where.type = type;

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        BankAccount: {
          select: {
            name: true,
            color: true
          }
        }
      },
      orderBy: [
        { createdAt: "desc" } // Ordenar por timestamp real de criação no banco
      ],
      take: limit ? parseInt(limit) : 100
    });

    return NextResponse.json({ transactions });
  } catch (error) {
    console.error("Erro ao buscar transações:", error);
    return NextResponse.json(
      { error: "Erro ao buscar transações" },
      { status: 500 }
    );
  }
}

// POST - Criar transação manual (ajuste de saldo)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
    }

    const data = await req.json();
    const {
      bankAccountId,
      type,
      amount,
      description,
      category,
      notes,
      date
    } = data;

    // Validações
    if (!bankAccountId || !type || !amount || !description) {
      return NextResponse.json(
        { error: "Dados incompletos" },
        { status: 400 }
      );
    }

    // Buscar conta atual
    const account = await prisma.bankAccount.findUnique({
      where: { id: bankAccountId }
    });

    if (!account) {
      return NextResponse.json(
        { error: "Conta não encontrada" },
        { status: 404 }
      );
    }

    // Criar transação primeiro (balanceAfter será recalculado)
    const transaction = await prisma.transaction.create({
      data: {
        bankAccountId,
        type,
        amount,
        description,
        category: category || null,
        notes: notes || null,
        balanceAfter: 0, // Será recalculado
        date: date ? new Date(date) : new Date(),
        referenceType: "MANUAL",
        createdBy: session.user?.email || undefined
      }
    });

    // RECALCULAR TODOS OS SALDOS da conta em ordem cronológica
    await recalculateAccountBalances(bankAccountId);

    // Buscar a transação atualizada
    const updatedTransaction = await prisma.transaction.findUnique({
      where: { id: transaction.id }
    });

    return NextResponse.json({ transaction: updatedTransaction }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar transação:", error);
    return NextResponse.json(
      { error: "Erro ao criar transação" },
      { status: 500 }
    );
  }
}
