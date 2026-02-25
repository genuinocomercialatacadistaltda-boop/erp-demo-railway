
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// POST - Confirmar recebimento de múltiplas transações
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [CONFIRM_BATCH] Iniciando confirmação de recebimentos...');
    
    const session = await getServerSession(authOptions);
    console.log('👤 [CONFIRM_BATCH] Session userType:', (session?.user as any)?.userType);
    
    if (!session?.user || (session.user as any).userType !== 'ADMIN') {
      console.log('❌ [CONFIRM_BATCH] Acesso negado - não autorizado');
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { transactionIds, receivedDate } = await request.json();
    console.log('📋 [CONFIRM_BATCH] Transaction IDs recebidos:', transactionIds);
    console.log('📅 [CONFIRM_BATCH] Received Date:', receivedDate);

    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      console.log('❌ [CONFIRM_BATCH] IDs inválidos ou vazios');
      return NextResponse.json(
        { error: 'IDs das transações são obrigatórios' },
        { status: 400 }
      );
    }

    // Buscar conta Itaú
    console.log('🏦 [CONFIRM_BATCH] Buscando conta bancária Itaú...');
    const itauAccount = await prisma.bankAccount.findFirst({
      where: { name: 'Itaú', isActive: true },
    });

    if (!itauAccount) {
      console.log('❌ [CONFIRM_BATCH] Conta Itaú não encontrada');
      return NextResponse.json(
        { error: 'Conta Itaú não encontrada' },
        { status: 404 }
      );
    }
    
    console.log('✅ [CONFIRM_BATCH] Conta Itaú encontrada:', { id: itauAccount.id, balance: itauAccount.balance });

    console.log('🔄 [CONFIRM_BATCH] Iniciando transação do Prisma...');
    const result = await prisma.$transaction(async (tx: any) => {
      const confirmedTransactions = [];
      let totalNetAmount = 0;
      let totalFeeAmount = 0;

      console.log(`📊 [CONFIRM_BATCH] Processando ${transactionIds.length} transação(ões)...`);
      for (const transactionId of transactionIds) {
        console.log(`🔍 [CONFIRM_BATCH] Processando transação ID: ${transactionId}`);
        
        try {
          // Buscar transação
          const transaction = await tx.cardTransaction.findUnique({
            where: { id: transactionId },
            include: {
              Order: true,
              Customer: true,
            },
          });

          if (!transaction) {
            console.log(`❌ [CONFIRM_BATCH] Transação ${transactionId} não encontrada`);
            throw new Error(`Transação ${transactionId} não encontrada`);
          }

          console.log(`✅ [CONFIRM_BATCH] Transação encontrada:`, {
            id: transaction.id,
            status: transaction.status,
            cardType: transaction.cardType,
            grossAmount: transaction.grossAmount,
            netAmount: transaction.netAmount,
          });

          if (transaction.status === 'RECEIVED') {
            console.log(`⏭️ [CONFIRM_BATCH] Transação ${transactionId} já foi confirmada, pulando...`);
            continue; // Pular transações já confirmadas
          }

          // 1. Atualizar transação
          console.log(`💳 [CONFIRM_BATCH] Atualizando status da transação para RECEIVED...`);
          const updatedTransaction = await tx.cardTransaction.update({
            where: { id: transactionId },
            data: {
              status: 'RECEIVED',
              receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
              bankAccountId: itauAccount.id,
            },
          });
          console.log(`✅ [CONFIRM_BATCH] Transação atualizada com sucesso`);

          // 2. 🔧 CORREÇÃO: Buscar receivable existente para esse pedido
          console.log(`🔍 [CONFIRM_BATCH] Buscando receivable existente para pedido ${transaction.Order.orderNumber}...`);
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
            console.log(`🔄 [CONFIRM_BATCH] Atualizando receivable existente ${existingReceivable.id}...`);
            
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
            
            console.log(`✅ [CONFIRM_BATCH] Receivable ${existingReceivable.id} atualizado para status PAID`);
          } else {
            // Criar novo receivable apenas se não existir (caso raro)
            console.log(`⚠️ [CONFIRM_BATCH] Nenhum receivable existente encontrado, criando novo...`);
            
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
            
            console.log(`✅ [CONFIRM_BATCH] Receivable criado:`, receivable.id);
          }

          // 3. Atualizar transação com receivable
          console.log(`🔗 [CONFIRM_BATCH] Vinculando receivable à transação...`);
          await tx.cardTransaction.update({
            where: { id: transactionId },
            data: { receivableId: receivable.id },
          });
          console.log(`✅ [CONFIRM_BATCH] Receivable vinculado`);

          // 4. Criar transação bancária
          console.log(`🏦 [CONFIRM_BATCH] Criando transação bancária...`);
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
          console.log(`✅ [CONFIRM_BATCH] Transação bancária criada`);

          // 5. Registrar taxa como despesa operacional
          if (transaction.feeAmount > 0) {
            console.log(`💰 [CONFIRM_BATCH] Registrando taxa de R$ ${transaction.feeAmount} como despesa...`);
            // Buscar categoria de taxa de cartão
            const feeCategory = await tx.expenseCategory.findFirst({
              where: { name: 'Taxa de Cartão' },
            });

            if (feeCategory) {
              console.log(`✅ [CONFIRM_BATCH] Categoria "Taxa de Cartão" encontrada:`, feeCategory.id);
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
              console.log(`✅ [CONFIRM_BATCH] Despesa de taxa criada`);
            } else {
              console.log(`⚠️ [CONFIRM_BATCH] Categoria "Taxa de Cartão" não encontrada - pulando criação de despesa`);
            }
          }

          totalNetAmount += transaction.netAmount;
          totalFeeAmount += transaction.feeAmount;
          confirmedTransactions.push(updatedTransaction);
          console.log(`✅ [CONFIRM_BATCH] Transação ${transactionId} processada com sucesso!\n`);
        } catch (processError) {
          console.error(`❌ [CONFIRM_BATCH] Erro ao processar transação ${transactionId}:`, processError);
          throw processError;
        }
      }

      // Atualizar saldo da conta
      if (totalNetAmount > 0) {
        console.log(`💵 [CONFIRM_BATCH] Atualizando saldo da conta bancária (+R$ ${totalNetAmount})...`);
        await tx.bankAccount.update({
          where: { id: itauAccount.id },
          data: {
            balance: {
              increment: totalNetAmount,
            },
          },
        });
        console.log(`✅ [CONFIRM_BATCH] Saldo da conta atualizado`);
      }

      console.log(`🎉 [CONFIRM_BATCH] Transação do Prisma concluída com sucesso!`);
      console.log(`📊 [CONFIRM_BATCH] Resumo:`);
      console.log(`   - Transações confirmadas: ${confirmedTransactions.length}`);
      console.log(`   - Valor líquido total: R$ ${totalNetAmount}`);
      console.log(`   - Taxas totais: R$ ${totalFeeAmount}`);

      return {
        confirmedTransactions,
        totalNetAmount,
        totalFeeAmount,
        count: confirmedTransactions.length,
      };
    });

    console.log(`✅ [CONFIRM_BATCH] Operação concluída com sucesso!`);
    return NextResponse.json({
      message: `${result.count} transação(ões) confirmada(s) com sucesso`,
      ...result,
    });
  } catch (error) {
    console.error('❌ [CONFIRM_BATCH] ERRO FATAL:', error);
    console.error('❌ [CONFIRM_BATCH] Stack trace:', (error as Error).stack);
    console.error('❌ [CONFIRM_BATCH] Mensagem:', (error as Error).message);
    
    return NextResponse.json(
      { 
        error: 'Erro ao confirmar recebimentos',
        details: (error as Error).message,
        stack: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
      },
      { status: 500 }
    );
  }
}
