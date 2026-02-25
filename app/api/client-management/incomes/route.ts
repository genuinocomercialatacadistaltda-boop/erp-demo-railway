export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).userType !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Acesso negado" },
        { status: 401 }
      );
    }

    const customerId = (session.user as any).customerId;
    if (!customerId) {
      return NextResponse.json(
        { error: "Cliente não identificado" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const where: any = { customerId };
    if (status) {
      where.status = status;
    }

    const incomes = await prisma.clientIncome.findMany({
      where,
      include: {
        BankAccount: true,
      },
      orderBy: { dueDate: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: incomes,
    });
  } catch (error) {
    console.error("[CLIENT_INCOMES_GET] Error:", error);
    return NextResponse.json(
      { error: "Erro ao carregar receitas" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).userType !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Acesso negado" },
        { status: 401 }
      );
    }

    const customerId = (session.user as any).customerId;
    if (!customerId) {
      return NextResponse.json(
        { error: "Cliente não identificado" },
        { status: 400 }
      );
    }

    const body = await req.json();

    const income = await prisma.clientIncome.create({
      data: {
        customerId,
        ...body,
      },
    });

    // Se recebido, criar transação
    if (body.status === "RECEIVED" && body.bankAccountId) {
      const account = await prisma.clientBankAccount.findUnique({
        where: { id: body.bankAccountId },
      });

      if (account) {
        const newBalance = account.balance + body.amount;

        await prisma.clientBankAccount.update({
          where: { id: body.bankAccountId },
          data: { balance: newBalance },
        });

        await prisma.clientTransaction.create({
          data: {
            customerId,
            bankAccountId: body.bankAccountId,
            type: "INCOME",
            amount: body.amount,
            description: body.description,
            category: body.category,
            referenceId: income.id,
            referenceType: "INCOME",
            balanceAfter: newBalance,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: income,
    });
  } catch (error) {
    console.error("[CLIENT_INCOMES_POST] Error:", error);
    return NextResponse.json(
      { error: "Erro ao criar receita" },
      { status: 500 }
    );
  }
}
