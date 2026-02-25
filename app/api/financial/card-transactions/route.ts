
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET - Listar transações com cartão
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const cardType = searchParams.get('cardType');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const whereConditions: any = {};

    if (status) {
      whereConditions.status = status;
    }

    if (cardType) {
      whereConditions.cardType = cardType;
    }

    if (startDate) {
      whereConditions.saleDate = {
        ...whereConditions.saleDate,
        gte: new Date(startDate),
      };
    }

    if (endDate) {
      whereConditions.saleDate = {
        ...whereConditions.saleDate,
        lte: new Date(endDate),
      };
    }

    const transactions = await prisma.cardTransaction.findMany({
      where: whereConditions,
      include: {
        Order: {
          select: {
            orderNumber: true,
            customerName: true,
          },
        },
        Receivable: {
          select: {
            id: true,
            description: true,
            amount: true,
            Customer: {
              select: {
                name: true,
              },
            },
          },
        },
        Customer: {
          select: {
            name: true,
          },
        },
        BankAccount: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { saleDate: 'desc' },
    });

    return NextResponse.json(transactions);
  } catch (error) {
    console.error('Erro ao buscar transações:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar transações' },
      { status: 500 }
    );
  }
}

// POST - Confirmar recebimento de transação
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { transactionId, receivedDate } = await request.json();

    if (!transactionId) {
      return NextResponse.json(
        { error: 'ID da transação é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar transação
    const transaction = await prisma.cardTransaction.findUnique({
      where: { id: transactionId },
      include: {
        Order: true,
        Customer: true,
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transação não encontrada' },
        { status: 404 }
      );
    }

    if (transaction.status === 'RECEIVED') {
      return NextResponse.json(
        { error: 'Transação já foi confirmada' },
        { status: 400 }
      );
    }

    // Buscar conta Itaú
    const itauAccount = await prisma.bankAccount.findFirst({
      where: { name: 'Itaú', isActive: true },
    });

    if (!itauAccount) {
      return NextResponse.json(
        { error: 'Conta Itaú não encontrada' },
        { status: 404 }
      );
    }

    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Atualizar transação
      const updatedTransaction = await tx.cardTransaction.update({
        where: { id: transactionId },
        data: {
          status: 'RECEIVED',
          receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
          bankAccountId: itauAccount.id,
        },
      });

      // 2. 🔧 CORREÇÃO: Buscar receivable existente para esse pedido
      const existingReceivable = await tx.receivable.findFirst({
        where: {
          orderId: transaction.orderId,
        },
        orderBy: {
          createdAt: 'desc' // Pega o mais recente
        }
      });

      let receivable;
      
      if (existingReceivable) {
        // 🔧 CORREÇÃO: Atualizar receivable existente ao invés de criar novo
        console.log(`🔄 [CARD_RECEIVE] Atualizando receivable existente ${existingReceivable.id} para o pedido ${transaction.Order.orderNumber}`);
        
        receivable = await tx.receivable.update({
          where: { id: existingReceivable.id },
          data: {
            status: 'PAID', // Marca como PAGO
            paymentDate: receivedDate ? new Date(receivedDate) : new Date(),
            paymentMethod: transaction.cardType === 'DEBIT' ? 'DEBIT_CARD' : 'CREDIT_CARD',
            feeAmount: transaction.feeAmount,
            netAmount: transaction.netAmount,
            bankAccountId: itauAccount.id,
            paidBy: session.user?.name || 'Admin',
          },
        });
        
        console.log(`✅ [CARD_RECEIVE] Receivable ${existingReceivable.id} atualizado para status PAID`);
      } else {
        // Criar novo receivable apenas se não existir (caso raro)
        console.log(`⚠️ [CARD_RECEIVE] Nenhum receivable existente encontrado para pedido ${transaction.Order.orderNumber}, criando novo...`);
        
        receivable = await tx.receivable.create({
          data: {
            customerId: transaction.customerId || null,
            orderId: transaction.orderId,
            description: `Recebimento ${transaction.cardType === 'DEBIT' ? 'Débito' : 'Crédito'} - Pedido ${transaction.Order.orderNumber}`,
            amount: transaction.grossAmount,
            dueDate: transaction.expectedDate,
            paymentDate: receivedDate ? new Date(receivedDate) : new Date(),
            status: 'PAID',
            paymentMethod: transaction.cardType === 'DEBIT' ? 'DEBIT_CARD' : 'CREDIT_CARD',
            feeAmount: transaction.feeAmount,
            netAmount: transaction.netAmount,
            bankAccountId: itauAccount.id,
            paidBy: session.user?.name || 'Admin',
          },
        });
      }

      // 3. Atualizar transação com receivable
      await tx.cardTransaction.update({
        where: { id: transactionId },
        data: { receivableId: receivable.id },
      });

      // 4. Atualizar saldo da conta
      await tx.bankAccount.update({
        where: { id: itauAccount.id },
        data: {
          balance: {
            increment: transaction.netAmount,
          },
        },
      });

      // 5. Criar transação bancária
      await tx.transaction.create({
        data: {
          bankAccountId: itauAccount.id,
          type: 'INCOME',
          amount: transaction.netAmount,
          description: `Recebimento ${transaction.cardType === 'DEBIT' ? 'Débito' : 'Crédito'} - Pedido ${transaction.Order.orderNumber}`,
          category: 'CARD_PAYMENT',
          referenceId: transaction.orderId,
          balanceAfter: itauAccount.balance + transaction.netAmount,
        },
      });

      // 6. Registrar taxa como despesa operacional
      if (transaction.feeAmount > 0) {
        // Buscar categoria de taxa de cartão
        const feeCategory = await tx.expenseCategory.findFirst({
          where: { name: 'Taxa de Cartão' },
        });

        if (feeCategory) {
          await tx.expense.create({
            data: {
              description: `Taxa ${transaction.cardType === 'DEBIT' ? 'Débito' : 'Crédito'} (${transaction.feePercentage}%) - Pedido ${transaction.Order.orderNumber}`,
              amount: transaction.feeAmount,
              categoryId: feeCategory.id,
              expenseType: 'OPERATIONAL',
              dueDate: receivedDate ? new Date(receivedDate) : new Date(),
              paymentDate: receivedDate ? new Date(receivedDate) : new Date(),
              status: 'PAID',
              bankAccountId: itauAccount.id,
              paidBy: 'Sistema',
            },
          });
        }
      }

      return updatedTransaction;
    });

    return NextResponse.json({
      message: 'Recebimento confirmado com sucesso',
      transaction: result,
    });
  } catch (error) {
    console.error('Erro ao confirmar recebimento:', error);
    return NextResponse.json(
      { error: 'Erro ao confirmar recebimento' },
      { status: 500 }
    );
  }
}
