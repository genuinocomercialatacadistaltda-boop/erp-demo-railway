export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth-options";

// POST - Baixar conta a receber automaticamente quando boleto for pago
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { boletoId, bankAccountId } = body;

    if (!boletoId) {
      return NextResponse.json(
        { error: "ID do boleto é obrigatório" },
        { status: 400 }
      );
    }

    // Buscar boleto
    const boleto = await prisma.boleto.findUnique({
      where: { id: boletoId },
      include: {
        Order: true,
        Customer: true,
      },
    });

    if (!boleto) {
      return NextResponse.json(
        { error: "Boleto não encontrado" },
        { status: 404 }
      );
    }

    if (boleto.status !== "PAID") {
      return NextResponse.json(
        { error: "Boleto ainda não foi pago" },
        { status: 400 }
      );
    }

    // Buscar conta a receber relacionada
    let receivable = await prisma.receivable.findFirst({
      where: {
        boletoId: boletoId,
      },
    });

    // Se não existir, criar
    if (!receivable) {
      const feeAmount = (boleto.fineAmount || 0) + (boleto.interestAmount || 0);
      const netAmount = boleto.amount + feeAmount;

      receivable = await prisma.receivable.create({
        data: {
          customerId: boleto.customerId || null,
          orderId: boleto.orderId,
          boletoId: boleto.id,
          description: `Boleto ${boleto.boletoNumber} - ${boleto.Customer?.name || "Cliente"}`,
          amount: netAmount,
          dueDate: boleto.dueDate,
          status: "PAID",
          paymentDate: boleto.paidDate || new Date(),
          paymentMethod: "BOLETO",
          feeAmount: feeAmount,
          netAmount: netAmount,
          bankAccountId: bankAccountId,
          referenceNumber: boleto.boletoNumber,
          notes: feeAmount > 0 ? `Multa/Juros: R$ ${feeAmount.toFixed(2)}` : undefined,
          isInstallment: boleto.isInstallment,
          installmentNumber: boleto.installmentNumber,
          totalInstallments: boleto.totalInstallments,
          createdBy: (session.user as any)?.id,
          paidBy: (session.user as any)?.id,
        },
      });
    } else if (receivable.status !== "PAID") {
      // Atualizar como pago
      const feeAmount = (boleto.fineAmount || 0) + (boleto.interestAmount || 0);
      const netAmount = boleto.amount + feeAmount;

      receivable = await prisma.receivable.update({
        where: { id: receivable.id },
        data: {
          status: "PAID",
          paymentDate: boleto.paidDate || new Date(),
          paymentMethod: "BOLETO",
          feeAmount: feeAmount,
          netAmount: netAmount,
          bankAccountId: bankAccountId,
          paidBy: (session.user as any)?.id,
          notes: feeAmount > 0 ? `Multa/Juros: R$ ${feeAmount.toFixed(2)}` : undefined,
        },
      });
    }

    // Criar transação bancária se conta bancária foi especificada
    if (bankAccountId && receivable.status === "PAID") {
      const bankAccount = await prisma.bankAccount.findUnique({
        where: { id: bankAccountId },
      });

      if (bankAccount) {
        const netAmount = receivable.netAmount || receivable.amount;
        const newBalance = bankAccount.balance + netAmount;

        // Verificar se já existe transação para este recebimento
        const existingTransaction = await prisma.transaction.findFirst({
          where: {
            referenceId: receivable.id,
            referenceType: "RECEIVABLE",
          },
        });

        if (!existingTransaction) {
          await prisma.transaction.create({
            data: {
              bankAccountId: bankAccountId,
              type: "INCOME",
              amount: netAmount,
              description: `Recebimento Boleto: ${boleto.boletoNumber}`,
              referenceId: receivable.id,
              referenceType: "RECEIVABLE",
              category: "BOLETO",
              date: boleto.paidDate || new Date(),
              balanceAfter: newBalance,
              notes: receivable.notes,
              createdBy: (session.user as any)?.id,
            },
          });

          // Atualizar saldo da conta bancária
          await prisma.bankAccount.update({
            where: { id: bankAccountId },
            data: { balance: newBalance },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      receivable,
      message: "Conta a receber baixada automaticamente",
    });
  } catch (error) {
    console.error("Erro ao integrar boleto com contas a receber:", error);
    return NextResponse.json(
      { error: "Erro ao integrar boleto com contas a receber" },
      { status: 500 }
    );
  }
}
