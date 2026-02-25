
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function PUT(
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
    const oldIncome = await prisma.clientIncome.findUnique({
      where: { id: params.id },
    });

    const income = await prisma.clientIncome.update({
      where: {
        id: params.id,
        customerId,
      },
      data: {
        ...body,
        updatedAt: new Date(),
      },
    });

    // Se mudou de PENDING para RECEIVED, criar transação
    if (oldIncome?.status !== "RECEIVED" && body.status === "RECEIVED" && body.bankAccountId) {
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
    console.error("[CLIENT_INCOME_PUT] Error:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar receita" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    await prisma.clientIncome.delete({
      where: {
        id: params.id,
        customerId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Receita excluída com sucesso",
    });
  } catch (error) {
    console.error("[CLIENT_INCOME_DELETE] Error:", error);
    return NextResponse.json(
      { error: "Erro ao excluir receita" },
      { status: 500 }
    );
  }
}
