import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

// POST - Transferir dinheiro entre contas
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 401 });
    }

    const body = await req.json();
    const { fromAccountId, toAccountId, amount, description } = body;

    // Validações
    if (!fromAccountId || !toAccountId) {
      return NextResponse.json(
        { error: "Selecione as contas de origem e destino" },
        { status: 400 }
      );
    }

    if (fromAccountId === toAccountId) {
      return NextResponse.json(
        { error: "As contas de origem e destino devem ser diferentes" },
        { status: 400 }
      );
    }

    const transferAmount = parseFloat(amount);
    if (!transferAmount || transferAmount <= 0) {
      return NextResponse.json(
        { error: "O valor da transferência deve ser maior que zero" },
        { status: 400 }
      );
    }

    // Buscar contas
    const fromAccount = await prisma.bankAccount.findUnique({
      where: { id: fromAccountId }
    });

    const toAccount = await prisma.bankAccount.findUnique({
      where: { id: toAccountId }
    });

    if (!fromAccount || !toAccount) {
      return NextResponse.json(
        { error: "Uma ou mais contas não foram encontradas" },
        { status: 404 }
      );
    }

    // Verificar saldo suficiente
    if (Number(fromAccount.balance) < transferAmount) {
      return NextResponse.json(
        { error: `Saldo insuficiente na conta ${fromAccount.name}. Saldo atual: R$ ${Number(fromAccount.balance).toFixed(2)}` },
        { status: 400 }
      );
    }

    const transferDate = new Date();
    const transferDescription = description || `Transferência para ${toAccount.name}`;
    const receiveDescription = description || `Transferência de ${fromAccount.name}`;

    // Executar transferência em transação
    const result = await prisma.$transaction(async (tx) => {
      // 1. Debitar da conta de origem
      const updatedFromAccount = await tx.bankAccount.update({
        where: { id: fromAccountId },
        data: {
          balance: { decrement: transferAmount }
        }
      });

      // 2. Creditar na conta de destino
      const updatedToAccount = await tx.bankAccount.update({
        where: { id: toAccountId },
        data: {
          balance: { increment: transferAmount }
        }
      });

      // 3. Criar transação de saída na conta de origem
      await tx.transaction.create({
        data: {
          bankAccountId: fromAccountId,
          type: "TRANSFER",
          amount: -transferAmount,
          description: transferDescription,
          date: transferDate,
          balanceAfter: Number(updatedFromAccount.balance),
          category: "Transferência (Saída)",
          notes: `Transferência para conta: ${toAccount.name}`,
          referenceType: "TRANSFER",
          referenceId: toAccountId
        }
      });

      // 4. Criar transação de entrada na conta de destino
      await tx.transaction.create({
        data: {
          bankAccountId: toAccountId,
          type: "TRANSFER",
          amount: transferAmount,
          description: receiveDescription,
          date: transferDate,
          balanceAfter: Number(updatedToAccount.balance),
          category: "Transferência (Entrada)",
          notes: `Transferência da conta: ${fromAccount.name}`,
          referenceType: "TRANSFER",
          referenceId: fromAccountId
        }
      });

      return {
        fromAccount: updatedFromAccount,
        toAccount: updatedToAccount
      };
    });

    console.log(`✅ Transferência realizada: R$ ${transferAmount.toFixed(2)} de ${fromAccount.name} para ${toAccount.name}`);

    return NextResponse.json({
      success: true,
      message: `Transferência de R$ ${transferAmount.toFixed(2)} realizada com sucesso!`,
      fromAccount: {
        name: fromAccount.name,
        newBalance: Number(result.fromAccount.balance)
      },
      toAccount: {
        name: toAccount.name,
        newBalance: Number(result.toAccount.balance)
      }
    });

  } catch (error: any) {
    console.error("Erro na transferência:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao processar transferência" },
      { status: 500 }
    );
  }
}
