export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

// Função para recalcular todos os saldos de uma conta em ordem cronológica
async function recalculateAccountBalances(bankAccountId: string) {
  const allTransactions = await prisma.transaction.findMany({
    where: { bankAccountId },
    orderBy: { createdAt: 'asc' }
  });

  const account = await prisma.bankAccount.findUnique({
    where: { id: bankAccountId }
  });

  if (!account) return;

  // Calcular soma total das transações
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
  let runningBalance = baseBalance;

  // Recalcular cada balanceAfter
  for (const t of allTransactions) {
    const amount = Number(t.amount);
    if (t.type === 'INCOME' || t.type === 'ADJUSTMENT') {
      runningBalance += amount;
    } else if (t.type === 'EXPENSE') {
      runningBalance -= amount;
    }

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

// DELETE - Excluir transação e reverter saldo
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json(
        { error: "Não autorizado. Apenas administradores podem excluir transações." },
        { status: 403 }
      );
    }

    const { id } = params;

    // Buscar a transação para obter os dados antes de excluir
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        BankAccount: true
      }
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Transação não encontrada" },
        { status: 404 }
      );
    }

    console.log(`\n🗑️ [DELETE TRANSACTION] Excluindo transação...`);
    console.log(`   ID: ${transaction.id}`);
    console.log(`   Tipo: ${transaction.type}`);
    console.log(`   Valor: R$ ${transaction.amount.toFixed(2)}`);
    console.log(`   Conta: ${transaction.BankAccount.name}`);
    console.log(`   Saldo Atual da Conta: R$ ${transaction.BankAccount.balance.toFixed(2)}`);

    // ⚠️ VALIDAÇÃO: Não permitir deletar transações de Receivables ou Orders PAGOS
    // (apenas transações manuais ou de referência NULL)
    if (transaction.referenceType === 'RECEIVABLE' || transaction.referenceType === 'ORDER') {
      // Verificar se a transação está associada a um pedido/receivable pago
      let isPaidReference = false;
      
      if (transaction.referenceType === 'RECEIVABLE' && transaction.referenceId) {
        const receivable = await prisma.receivable.findUnique({
          where: { id: transaction.referenceId }
        });
        
        if (receivable && receivable.status === 'PAID') {
          isPaidReference = true;
        }
      }
      
      if (transaction.referenceType === 'ORDER' && transaction.referenceId) {
        const order = await prisma.order.findUnique({
          where: { id: transaction.referenceId }
        });
        
        if (order && order.paymentStatus === 'PAID') {
          isPaidReference = true;
        }
      }
      
      if (isPaidReference) {
        return NextResponse.json(
          { 
            error: "Esta transação está associada a um pedido/receivable pago e não pode ser excluída diretamente.",
            details: "Para remover esta transação, você deve excluir o pedido ou marcar o receivable como não pago."
          },
          { status: 400 }
        );
      }
    }

    // Salvar dados antes de excluir
    const bankAccountId = transaction.bankAccountId;
    const oldBalance = Number(transaction.BankAccount.balance);
    const transactionAmount = Number(transaction.amount);

    // Calcular novo saldo DIRETAMENTE baseado no tipo da transação
    // Se era INCOME, ao deletar precisamos SUBTRAIR do saldo
    // Se era EXPENSE, ao deletar precisamos SOMAR de volta ao saldo
    let newBalance = oldBalance;
    if (transaction.type === 'INCOME' || transaction.type === 'ADJUSTMENT') {
      newBalance = oldBalance - transactionAmount;
      console.log(`   💰 Transação era INCOME - Subtraindo R$ ${transactionAmount.toFixed(2)} do saldo`);
    } else if (transaction.type === 'EXPENSE') {
      newBalance = oldBalance + transactionAmount;
      console.log(`   💰 Transação era EXPENSE - Somando R$ ${transactionAmount.toFixed(2)} de volta ao saldo`);
    }

    // Excluir a transação E atualizar o saldo em uma transação atômica
    await prisma.$transaction([
      prisma.transaction.delete({
        where: { id }
      }),
      prisma.bankAccount.update({
        where: { id: bankAccountId },
        data: { balance: newBalance }
      })
    ]);

    console.log(`✅ [DELETE TRANSACTION] Transação excluída e saldo atualizado!`);
    console.log(`   📊 Saldo anterior: R$ ${oldBalance.toFixed(2)} -> Novo: R$ ${newBalance.toFixed(2)}`);

    return NextResponse.json({
      success: true,
      message: "Transação excluída com sucesso",
      oldBalance: oldBalance,
      newBalance: newBalance,
      amountReverted: Number(transaction.amount)
    });

  } catch (error: any) {
    console.error("❌ [DELETE TRANSACTION ERROR]", error);
    return NextResponse.json(
      { 
        error: "Erro ao excluir transação",
        details: error?.message || "Erro desconhecido"
      },
      { status: 500 }
    );
  }
}
