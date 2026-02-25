
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

// DELETE - Excluir fatura (com todas as despesas vinculadas)
export async function DELETE(
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

    console.log(`🗑️ [DELETE_INVOICE] Tentando excluir fatura: ${params.id}`);

    // Buscar fatura com todas as despesas vinculadas
    const invoice = await prisma.creditCardInvoice.findUnique({
      where: { id: params.id },
      include: {
        Expenses: true,
        CreditCard: true
      }
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Fatura não encontrada" },
        { status: 404 }
      );
    }

    console.log(`🗑️ [DELETE_INVOICE] Fatura: ${new Date(invoice.referenceMonth).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}, Status: ${invoice.status}, Despesas: ${invoice.Expenses.length}, Valor: R$ ${invoice.totalAmount.toFixed(2)}`);

    // Bloquear exclusão de faturas pagas
    if (invoice.status === "PAID") {
      return NextResponse.json(
        { 
          error: "Não é possível excluir fatura paga. Reabra a fatura primeiro."
        },
        { status: 400 }
      );
    }

    // Iniciar transação para garantir consistência
    await prisma.$transaction(async (tx) => {
      // 1. Excluir todas as despesas vinculadas à fatura
      if (invoice.Expenses.length > 0) {
        console.log(`🧹 [DELETE_INVOICE] Excluindo ${invoice.Expenses.length} despesa(s) vinculada(s)...`);
        
        for (const expense of invoice.Expenses) {
          console.log(`   ↳ Despesa: ${expense.description} - R$ ${expense.amount.toFixed(2)}`);
        }

        await tx.creditCardExpense.deleteMany({
          where: { invoiceId: invoice.id }
        });

        console.log(`✅ [DELETE_INVOICE] Despesas excluídas`);
      }

      // 2. Se a fatura foi fechada e gerou uma despesa em Contas a Pagar, excluir
      if (invoice.expenseId) {
        console.log(`💳 [DELETE_INVOICE] Fatura tem despesa vinculada em Contas a Pagar: ${invoice.expenseId}`);
        
        const payableExpense = await tx.expense.findUnique({
          where: { id: invoice.expenseId }
        });

        if (payableExpense) {
          if (payableExpense.status === "PAID") {
            console.log(`⚠️ [DELETE_INVOICE] Despesa em Contas a Pagar já foi paga. Revertendo pagamento...`);
            
            // Se foi paga, reverter o pagamento (remover da conta bancária)
            if (payableExpense.bankAccountId && payableExpense.paymentDate) {
              await tx.transaction.deleteMany({
                where: {
                  bankAccountId: payableExpense.bankAccountId,
                  type: "EXPENSE",
                  description: { contains: payableExpense.description }
                }
              });
              console.log(`✅ [DELETE_INVOICE] Transação bancária revertida`);
            }
          }

          await tx.expense.delete({
            where: { id: invoice.expenseId }
          });
          console.log(`✅ [DELETE_INVOICE] Despesa em Contas a Pagar excluída`);
        }
      }

      // 3. Devolver o limite disponível do cartão (se fatura estava fechada/aberta com valor)
      if (invoice.totalAmount > 0 && invoice.CreditCard.limit) {
        console.log(`💳 [DELETE_INVOICE] Devolvendo R$ ${invoice.totalAmount.toFixed(2)} ao limite disponível do cartão`);
        
        const currentAvailable = invoice.CreditCard.availableLimit || invoice.CreditCard.limit;
        const newAvailable = currentAvailable + invoice.totalAmount;
        
        console.log(`💳 [DELETE_INVOICE] Limite disponível atual: R$ ${currentAvailable.toFixed(2)}`);
        console.log(`💳 [DELETE_INVOICE] Novo limite disponível: R$ ${newAvailable.toFixed(2)}`);
        
        await tx.creditCard.update({
          where: { id: invoice.creditCardId },
          data: {
            availableLimit: newAvailable
          }
        });
        console.log(`✅ [DELETE_INVOICE] Limite disponível do cartão atualizado`);
      }

      // 4. Excluir a fatura
      await tx.creditCardInvoice.delete({
        where: { id: invoice.id }
      });

      console.log(`✅ [DELETE_INVOICE] Fatura excluída com sucesso`);
    });

    return NextResponse.json({ 
      message: "Fatura e todas as despesas vinculadas foram excluídas com sucesso",
      deletedExpenses: invoice.Expenses.length,
      amount: invoice.totalAmount
    });
  } catch (error: any) {
    console.error("❌ [DELETE_INVOICE] Erro:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao excluir fatura" },
      { status: 500 }
    );
  }
}

// PUT - Pagar fatura de cartão de crédito
export async function PUT(
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

    const body = await req.json();
    const { bankAccountId, paymentDate } = body;

    console.log(`💳 [PAY_INVOICE] Pagando fatura: ${params.id}`);
    console.log(`💳 [PAY_INVOICE] Conta bancária: ${bankAccountId}, Data: ${paymentDate}`);

    // Buscar fatura com cartão
    const invoice = await prisma.creditCardInvoice.findUnique({
      where: { id: params.id },
      include: {
        CreditCard: true,
        Expenses: true
      }
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Fatura não encontrada" },
        { status: 404 }
      );
    }

    if (invoice.status === "PAID") {
      return NextResponse.json(
        { error: "Fatura já está paga" },
        { status: 400 }
      );
    }

    if (invoice.status === "OPEN") {
      return NextResponse.json(
        { error: "Fatura ainda está aberta. Feche a fatura antes de pagar." },
        { status: 400 }
      );
    }

    console.log(`💳 [PAY_INVOICE] Fatura: ${invoice.CreditCard.name} - ${new Date(invoice.referenceMonth).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`);
    console.log(`💳 [PAY_INVOICE] Valor: R$ ${invoice.totalAmount.toFixed(2)}`);

    // Iniciar transação
    const result = await prisma.$transaction(async (tx) => {
      // 1. Atualizar status da fatura para PAID
      const updatedInvoice = await tx.creditCardInvoice.update({
        where: { id: params.id },
        data: {
          status: "PAID",
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
          paidAmount: invoice.totalAmount,
          bankAccountId: bankAccountId || undefined
        }
      });

      // 2. Se tem conta bancária, criar transação de saída
      if (bankAccountId) {
        // Buscar conta bancária
        const bankAccount = await tx.bankAccount.findUnique({
          where: { id: bankAccountId }
        });

        if (!bankAccount) {
          throw new Error("Conta bancária não encontrada");
        }

        const newBalance = (bankAccount.balance || 0) - invoice.totalAmount;

        // Criar transação de saída
        await tx.transaction.create({
          data: {
            BankAccount: { connect: { id: bankAccountId } },
            type: "EXPENSE",
            amount: -Math.abs(invoice.totalAmount),
            description: `Pagamento fatura ${invoice.CreditCard.name} - ${new Date(invoice.referenceMonth).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`,
            date: paymentDate ? new Date(paymentDate) : new Date(),
            category: "Cartão de Crédito",
            balanceAfter: newBalance
          }
        });

        // Atualizar saldo da conta bancária
        await tx.bankAccount.update({
          where: { id: bankAccountId },
          data: {
            balance: newBalance
          }
        });

        console.log(`💳 [PAY_INVOICE] Transação bancária criada - Debitado R$ ${invoice.totalAmount.toFixed(2)} de ${bankAccount.name}`);
      }

      // 3. Se a fatura tem despesa vinculada em Contas a Pagar, marcar como paga também
      if (invoice.expenseId) {
        await tx.expense.update({
          where: { id: invoice.expenseId },
          data: {
            status: "PAID",
            paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
            bankAccountId: bankAccountId || undefined
          }
        });
        console.log(`💳 [PAY_INVOICE] Despesa vinculada em Contas a Pagar atualizada para PAID`);
      }

      // 4. Devolver limite ao cartão (se ainda não foi devolvido)
      // Quando a fatura é paga, o limite é liberado
      const currentAvailable = invoice.CreditCard.availableLimit || 0;
      const newAvailable = currentAvailable + invoice.totalAmount;

      await tx.creditCard.update({
        where: { id: invoice.creditCardId },
        data: {
          availableLimit: newAvailable
        }
      });

      console.log(`💳 [PAY_INVOICE] Limite do cartão restaurado: R$ ${currentAvailable.toFixed(2)} -> R$ ${newAvailable.toFixed(2)}`);

      return updatedInvoice;
    });

    console.log(`✅ [PAY_INVOICE] Fatura paga com sucesso!`);

    return NextResponse.json({
      message: "Fatura paga com sucesso",
      invoice: result
    });

  } catch (error: any) {
    console.error("❌ [PAY_INVOICE] Erro:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao pagar fatura" },
      { status: 500 }
    );
  }
}

// GET - Buscar despesas de uma fatura específica
export async function GET(
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

    // Buscar fatura sem incluir despesas
    const invoice = await prisma.creditCardInvoice.findUnique({
      where: { id: params.id },
      include: {
        CreditCard: {
          select: {
            name: true
          }
        }
      }
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Fatura não encontrada" },
        { status: 404 }
      );
    }

    // Buscar despesas APENAS desta fatura (query separada)
    const expenses = await prisma.creditCardExpense.findMany({
      where: {
        invoiceId: params.id
      },
      include: {
        Category: true
      },
      orderBy: {
        purchaseDate: 'desc'
      }
    });

    // Retornar fatura com despesas filtradas
    return NextResponse.json(
      { 
        invoice: {
          ...invoice,
          Expenses: expenses
        }
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate'
        }
      }
    );
  } catch (error) {
    console.error("Erro ao buscar fatura:", error);
    return NextResponse.json(
      { error: "Erro ao buscar fatura" },
      { status: 500 }
    );
  }
}
