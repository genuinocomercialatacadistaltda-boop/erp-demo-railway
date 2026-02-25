export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Verificar se a conta pertence ao cliente
    const account = await prisma.clientBankAccount.findFirst({
      where: {
        id: params.id,
        customerId,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Conta não encontrada" },
        { status: 404 }
      );
    }

    // Buscar transações da conta
    const transactions = await prisma.clientTransaction.findMany({
      where: {
        bankAccountId: params.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50, // Limitar a 50 transações mais recentes
    });

    return NextResponse.json({
      success: true,
      data: transactions,
    });
  } catch (error) {
    console.error("[CLIENT_BANK_ACCOUNT_TRANSACTIONS_GET] Error:", error);
    return NextResponse.json(
      { error: "Erro ao carregar transações" },
      { status: 500 }
    );
  }
}
