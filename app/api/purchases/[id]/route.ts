export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET - Buscar compra por ID
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      );
    }

    const purchase = await prisma.purchase.findUnique({
      where: { id: params.id },
      include: {
        Supplier: true,
        BankAccount: true,
        PurchaseItem: {
          include: {
            RawMaterial: true,
          },
        },
      },
    });

    if (!purchase) {
      return NextResponse.json(
        { error: 'Compra não encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json(purchase);
  } catch (error) {
    console.error('Erro ao buscar compra:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar compra' },
      { status: 500 }
    );
  }
}

// PUT - Atualizar compra
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      status,
      dueDate,
      paymentDate,
      paymentMethod,
      bankAccountId,
      invoiceNumber,
      invoiceUrl,
      notes,
    } = body;

    // Verificar se compra existe
    const existing = await prisma.purchase.findUnique({
      where: { id: params.id },
      include: {
        BankAccount: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Compra não encontrada' },
        { status: 404 }
      );
    }

    // Se mudou de PENDING para PAID, processar pagamento
    const shouldProcessPayment = existing.status !== 'PAID' && status === 'PAID';
    
    const purchase = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.purchase.update({
        where: { id: params.id },
        data: {
          status,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          paymentDate: paymentDate ? new Date(paymentDate) : (status === 'PAID' ? new Date() : null),
          paymentMethod,
          bankAccountId,
          invoiceNumber,
          invoiceUrl,
          notes,
          paidBy: status === 'PAID' ? (session.user as any).email : undefined,
        },
        include: {
          Supplier: true,
          BankAccount: true,
          PurchaseItem: {
            include: {
              RawMaterial: true,
            },
          },
        },
      });

      // Processar pagamento se necessário
      if (shouldProcessPayment && bankAccountId) {
        // Deduzir do saldo da conta bancária
        await tx.bankAccount.update({
          where: { id: bankAccountId },
          data: {
            balance: {
              decrement: updated.totalAmount,
            },
          },
        });

        // Obter o novo saldo
        const account = await tx.bankAccount.findUnique({
          where: { id: bankAccountId },
        });

        // Registrar transação
        await tx.transaction.create({
          data: {
            bankAccountId,
            type: 'EXPENSE',
            amount: updated.totalAmount,
            description: `Compra ${updated.purchaseNumber} - ${updated.Supplier.name}`,
            referenceId: updated.id,
            referenceType: 'PURCHASE',
            category: updated.expenseType,
            date: paymentDate ? new Date(paymentDate) : new Date(),
            balanceAfter: account!.balance,
            createdBy: (session.user as any).email,
          },
        });
      }

      return updated;
    });

    return NextResponse.json(purchase);
  } catch (error) {
    console.error('Erro ao atualizar compra:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar compra' },
      { status: 500 }
    );
  }
}

// DELETE - Excluir compra
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      );
    }

    // Verificar se compra existe
    const existing = await prisma.purchase.findUnique({
      where: { id: params.id },
      include: {
        PurchaseItem: true,
        PurchaseSupplyItems: true,
        Expense: true, // Despesa vinculada diretamente
        Supplier: true, // Para buscar despesas pelo nome do fornecedor
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Compra não encontrada' },
        { status: 404 }
      );
    }

    // Não permitir exclusão de compras pagas
    if (existing.status === 'PAID') {
      return NextResponse.json(
        { error: 'Não é possível excluir uma compra já paga. Cancele primeiro.' },
        { status: 400 }
      );
    }

    console.log(`🗑️ Iniciando exclusão da compra ${existing.purchaseNumber}...`);
    console.log(`📋 Método de pagamento: ${existing.paymentMethod}`);

    await prisma.$transaction(async (tx: any) => {
      // 1️⃣ Buscar TODAS as despesas normais (Expense) relacionadas a esta compra
      const relatedExpenses = await tx.expense.findMany({
        where: {
          OR: [
            { id: existing.expenseId || 'none' }, // Despesa vinculada diretamente
            { 
              description: { 
                contains: existing.purchaseNumber 
              } 
            }, // Despesas com número da compra na descrição
            {
              AND: [
                { supplierId: existing.supplierId },
                { 
                  description: { 
                    contains: existing.Supplier?.name || 'xxx' 
                  } 
                },
                {
                  createdAt: {
                    gte: new Date(existing.createdAt.getTime() - 60000), // 1 minuto antes
                    lte: new Date(existing.createdAt.getTime() + 60000), // 1 minuto depois
                  }
                }
              ]
            }
          ]
        },
        include: {
          BankAccount: true,
        }
      });

      console.log(`📋 Encontradas ${relatedExpenses.length} despesas (Expense) vinculadas`);

      // 2️⃣ Para cada despesa vinculada, reverter transações bancárias e excluir
      for (const expense of relatedExpenses) {
        console.log(`🗑️ Processando despesa: ${expense.description} - R$ ${expense.amount}`);
        
        // Se a despesa tinha conta bancária, reverter transação
        if (expense.bankAccountId && expense.status === 'PAID') {
          // Reverter saldo da conta
          await tx.bankAccount.update({
            where: { id: expense.bankAccountId },
            data: {
              balance: {
                increment: expense.amount, // Devolver o valor
              },
            },
          });
          console.log(`💰 Revertido R$ ${expense.amount} para conta bancária`);

          // Excluir transação bancária vinculada
          await tx.transaction.deleteMany({
            where: {
              OR: [
                { referenceId: expense.id, referenceType: 'EXPENSE' },
                { referenceId: existing.id, referenceType: 'PURCHASE' },
              ]
            }
          });
          console.log(`🏦 Transação bancária excluída`);
        }

        // Excluir a despesa
        await tx.expense.delete({
          where: { id: expense.id },
        });
        console.log(`✅ Despesa ${expense.id} excluída`);
      }

      // 3️⃣ Buscar e excluir despesas de CARTÃO DE CRÉDITO (CreditCardExpense) relacionadas
      // Essas são identificadas pelo referenceNumber = purchaseNumber
      const creditCardExpenses = await tx.creditCardExpense.findMany({
        where: {
          OR: [
            { referenceNumber: existing.purchaseNumber }, // Número da compra como referência
            { description: { contains: existing.purchaseNumber } }, // Número da compra na descrição
          ]
        },
        include: {
          CreditCard: true,
          Invoice: true,
        }
      });

      console.log(`💳 Encontradas ${creditCardExpenses.length} despesas de cartão de crédito vinculadas`);

      for (const ccExpense of creditCardExpenses) {
        console.log(`💳 Processando despesa de cartão: ${ccExpense.description} - R$ ${ccExpense.amount}`);
        
        // Devolver o valor ao limite do cartão
        if (ccExpense.creditCardId) {
          await tx.creditCard.update({
            where: { id: ccExpense.creditCardId },
            data: {
              availableLimit: {
                increment: ccExpense.amount,
              },
            },
          });
          console.log(`💳 Devolvido R$ ${ccExpense.amount} ao limite do cartão ${ccExpense.CreditCard?.name || ccExpense.creditCardId}`);
        }

        // Atualizar o total da fatura
        if (ccExpense.invoiceId) {
          await tx.creditCardInvoice.update({
            where: { id: ccExpense.invoiceId },
            data: {
              totalAmount: {
                decrement: ccExpense.amount,
              },
            },
          });
          console.log(`📄 Fatura ${ccExpense.Invoice?.referenceMonth || ccExpense.invoiceId} atualizada`);
        }

        // Excluir a despesa de cartão
        await tx.creditCardExpense.delete({
          where: { id: ccExpense.id },
        });
        console.log(`✅ Despesa de cartão ${ccExpense.id} excluída`);
      }

      // 4️⃣ Excluir transações bancárias vinculadas diretamente à compra
      await tx.transaction.deleteMany({
        where: {
          referenceId: existing.id,
          referenceType: 'PURCHASE',
        }
      });
      console.log(`🏦 Transações bancárias da compra excluídas`);

      // 5️⃣ Reverter estoque de matérias-primas
      for (const item of existing.PurchaseItem) {
        if (item.rawMaterialId) {
          await tx.rawMaterial.update({
            where: { id: item.rawMaterialId },
            data: {
              currentStock: {
                decrement: item.quantity,
              },
            },
          });
          console.log(`📦 Estoque revertido: ${item.quantity} unidades`);
        }
      }

      // 6️⃣ Reverter estoque de insumos
      for (const item of existing.PurchaseSupplyItems || []) {
        if (item.supplyId) {
          await tx.supply.update({
            where: { id: item.supplyId },
            data: {
              currentStock: {
                decrement: item.quantity,
              },
            },
          });
          console.log(`📦 Estoque de insumo revertido: ${item.quantity} unidades`);
        }
      }

      // 7️⃣ Excluir compra (itens serão excluídos em cascata)
      await tx.purchase.delete({
        where: { id: params.id },
      });
      
      console.log(`✅ Compra ${existing.purchaseNumber} excluída com sucesso!`);
    });

    return NextResponse.json({ 
      message: 'Compra e todas as despesas vinculadas excluídas com sucesso',
      purchaseNumber: existing.purchaseNumber
    });
  } catch (error) {
    console.error('Erro ao excluir compra:', error);
    return NextResponse.json(
      { error: 'Erro ao excluir compra', details: (error as Error).message },
      { status: 500 }
    );
  }
}
