export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function POST(
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

    const body = await req.json();
    const { saleId, bankAccountId, paymentMethod } = body;

    if (!saleId || !bankAccountId) {
      return NextResponse.json(
        { error: "Dados incompletos" },
        { status: 400 }
      );
    }

    // Buscar a venda
    const sale = await prisma.clientSale.findFirst({
      where: {
        id: saleId,
        customerId,
        linkedCustomerId: params.id,
        isPaid: false,
      },
    });

    if (!sale) {
      return NextResponse.json(
        { error: "Venda não encontrada ou já paga" },
        { status: 404 }
      );
    }

    // Buscar conta bancária
    const bankAccount = await prisma.clientBankAccount.findFirst({
      where: {
        id: bankAccountId,
        customerId,
      },
    });

    if (!bankAccount) {
      return NextResponse.json(
        { error: "Conta bancária não encontrada" },
        { status: 404 }
      );
    }

    // Executar transação atômica
    await prisma.$transaction(async (tx) => {
      // 1. Atualizar a venda
      await tx.clientSale.update({
        where: { id: saleId },
        data: {
          isPaid: true,
          paymentStatus: "PAID",
          paymentMethod: paymentMethod || sale.paymentMethod,
          updatedAt: new Date(),
        },
      });

      // 2. Criar transação bancária
      const newBalance = bankAccount.balance + sale.total;
      
      await tx.clientBankAccount.update({
        where: { id: bankAccountId },
        data: { balance: newBalance },
      });

      await tx.clientTransaction.create({
        data: {
          customerId,
          bankAccountId,
          type: "INCOME",
          amount: sale.total,
          description: `Recebimento - ${sale.saleNumber}`,
          category: "SALE",
          referenceId: sale.id,
          referenceType: "SALE",
          balanceAfter: newBalance,
        },
      });

      console.log(`[RECEIVE_PAYMENT] ✅ Pagamento recebido: ${sale.saleNumber} - R$ ${sale.total}`);
    });

    return NextResponse.json({
      success: true,
      message: "Pagamento recebido com sucesso",
    });
  } catch (error) {
    console.error("[RECEIVE_PAYMENT] Error:", error);
    return NextResponse.json(
      { error: "Erro ao receber pagamento" },
      { status: 500 }
      );
  }
}
