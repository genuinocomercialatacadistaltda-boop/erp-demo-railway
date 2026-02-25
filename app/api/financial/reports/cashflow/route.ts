export const dynamic = 'force-dynamic';


import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth-options";

// GET - Fluxo de Caixa Projetado
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Datas de início e fim são obrigatórias" },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Saldo inicial (soma de todas as contas bancárias ativas)
    const bankAccounts = await prisma.bankAccount.findMany({
      where: { isActive: true },
      select: { balance: true },
    });
    const initialBalance = bankAccounts.reduce((sum: number, acc: any) => sum + acc.balance, 0);

    // Contas a receber pendentes no período
    const receivablesPending = await prisma.receivable.findMany({
      where: {
        dueDate: { gte: start, lte: end },
        status: { in: ["PENDING", "OVERDUE"] },
      },
      select: {
        dueDate: true,
        amount: true,
        feeAmount: true,
        description: true,
      },
      orderBy: { dueDate: "asc" },
    });

    // Contas a pagar pendentes no período
    const expensesPending = await prisma.expense.findMany({
      where: {
        dueDate: { gte: start, lte: end },
        status: "PENDING",
      },
      select: {
        dueDate: true,
        amount: true,
        description: true,
      },
      orderBy: { dueDate: "asc" },
    });

    // Agrupar por dia
    const dailyCashFlow: Record<string, {
      date: string;
      inflows: number;
      outflows: number;
      balance: number;
    }> = {};

    let runningBalance = initialBalance;

    // Processar entradas (contas a receber)
    receivablesPending.forEach((r) => {
      const dateKey = r.dueDate.toISOString().split('T')[0];
      if (!dailyCashFlow[dateKey]) {
        dailyCashFlow[dateKey] = { date: dateKey, inflows: 0, outflows: 0, balance: 0 };
      }
      const netAmount = r.amount - (r.feeAmount || 0);
      dailyCashFlow[dateKey].inflows += netAmount;
    });

    // Processar saídas (despesas)
    expensesPending.forEach((e) => {
      const dateKey = e.dueDate.toISOString().split('T')[0];
      if (!dailyCashFlow[dateKey]) {
        dailyCashFlow[dateKey] = { date: dateKey, inflows: 0, outflows: 0, balance: 0 };
      }
      dailyCashFlow[dateKey].outflows += e.amount;
    });

    // Calcular saldo acumulado por dia
    const sortedDays = Object.keys(dailyCashFlow).sort();
    sortedDays.forEach((day) => {
      runningBalance += dailyCashFlow[day].inflows - dailyCashFlow[day].outflows;
      dailyCashFlow[day].balance = runningBalance;
    });

    const cashFlow = {
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
      initialBalance,
      finalBalance: runningBalance,
      totalInflows: receivablesPending.reduce(
        (sum: number, r: any) => sum + (r.amount - (r.feeAmount || 0)),
        0
      ),
      totalOutflows: expensesPending.reduce((sum: number, e: any) => sum + e.amount, 0),
      netCashFlow: runningBalance - initialBalance,
      daily: Object.values(dailyCashFlow).sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      ),
      summary: {
        receivablesPending: receivablesPending.length,
        expensesPending: expensesPending.length,
      },
    };

    return NextResponse.json(cashFlow);
  } catch (error) {
    console.error("Erro ao gerar fluxo de caixa:", error);
    return NextResponse.json(
      { error: "Erro ao gerar fluxo de caixa" },
      { status: 500 }
    );
  }
}
