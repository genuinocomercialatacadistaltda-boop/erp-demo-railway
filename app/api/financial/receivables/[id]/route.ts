
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { authOptions } from '@/lib/auth-options'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    // Apenas admin pode excluir entradas de contas a receber
    if (!user || user.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Não autorizado. Somente administradores podem excluir entradas de contas a receber.' },
        { status: 403 }
      )
    }

    // Buscar a entrada para verificar se existe
    const receivable = await prisma.receivable.findUnique({
      where: { id: params.id },
      include: {
        Order: true,
        BankAccount: true
      }
    })

    if (!receivable) {
      return NextResponse.json(
        { error: 'Entrada de contas a receber não encontrada' },
        { status: 404 }
      )
    }

    // Verificar se o pedido ainda existe
    if (receivable.Order) {
      return NextResponse.json(
        { error: 'Não é possível excluir esta entrada. O pedido correspondente ainda existe. Exclua o pedido primeiro.' },
        { status: 400 }
      )
    }

    // Se a conta estava PAGA, reverter o saldo da conta bancária
    if (receivable.status === 'PAID' && receivable.bankAccountId && receivable.BankAccount) {
      const netAmount = receivable.netAmount || receivable.amount;
      const currentBalance = receivable.BankAccount.balance;
      const newBalance = currentBalance - netAmount;

      // Atualizar saldo da conta bancária (reverter)
      await prisma.bankAccount.update({
        where: { id: receivable.bankAccountId },
        data: { balance: newBalance }
      });

      // Criar transação de estorno
      await prisma.transaction.create({
        data: {
          bankAccountId: receivable.bankAccountId,
          type: 'EXPENSE',
          amount: netAmount,
          description: `Estorno: ${receivable.description}`,
          referenceId: receivable.id,
          referenceType: 'RECEIVABLE_REVERSAL',
          category: 'ESTORNO',
          date: new Date(),
          balanceAfter: newBalance,
          notes: 'Estorno de pagamento excluído',
          createdBy: user.id,
        }
      });

      // Excluir a transação original de recebimento (se existir)
      await prisma.transaction.deleteMany({
        where: {
          referenceId: receivable.id,
          referenceType: 'RECEIVABLE',
          type: 'INCOME'
        }
      });
    }

    // Excluir a entrada
    await prisma.receivable.delete({
      where: { id: params.id }
    })

    return NextResponse.json({
      success: true,
      message: receivable.status === 'PAID' 
        ? 'Pagamento estornado e entrada excluída com sucesso. O saldo da conta bancária foi revertido.'
        : 'Entrada de contas a receber excluída com sucesso'
    })
  } catch (error: any) {
    console.error('Erro ao excluir entrada de contas a receber:', error)
    return NextResponse.json(
      { error: error?.message || 'Falha ao excluir entrada de contas a receber' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('\n📝 [RECEIVABLES_PUT] Editando receivable')
    console.log('   - ID:', params.id)
    
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    // Apenas admin pode atualizar entradas de contas a receber
    if (!user || user.userType !== 'ADMIN') {
      console.log('❌ [RECEIVABLES_PUT] Usuário não autorizado')
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { description, amount, dueDate, status, paymentMethod, bankAccountId, revertPayment } = body
    
    console.log('   - Nova descrição:', description)
    console.log('   - Novo valor:', amount)
    console.log('   - Nova data vencimento:', dueDate)
    console.log('   - Novo status:', status)
    console.log('   - Novo método pagamento:', paymentMethod)
    console.log('   - Nova conta bancária:', bankAccountId)
    console.log('   - É reversão?', revertPayment)

    const receivable = await prisma.receivable.findUnique({
      where: { id: params.id },
      include: {
        Order: {
          include: {
            CardTransactions: true
          }
        }
      }
    })

    if (!receivable) {
      console.log('❌ [RECEIVABLES_PUT] Receivable não encontrado')
      return NextResponse.json(
        { error: 'Entrada não encontrada' },
        { status: 404 }
      )
    }

    // 🔄 REVERSÃO DE PAGAMENTO: Quando usuário quer reverter um recebimento
    if (revertPayment && receivable.status === 'PAID' && status === 'PENDING') {
      console.log('\n🔄 [RECEIVABLES_PUT] === REVERSÃO DE PAGAMENTO ===')
      console.log('   📋 Receivable ID:', receivable.id)
      console.log('   📋 Receivable bankAccountId:', receivable.bankAccountId)
      console.log('   📋 Receivable description:', receivable.description)
      
      // 1. Reverter transação bancária se houver
      if (receivable.bankAccountId) {
        console.log('   🔍 Buscando transação com referenceId:', receivable.id)
        
        const bankTransaction = await prisma.transaction.findFirst({
          where: {
            referenceType: 'RECEIVABLE',
            referenceId: receivable.id
          }
        })
        
        console.log('   🔍 Transação encontrada?', bankTransaction ? 'SIM' : 'NÃO')
        
        if (bankTransaction) {
          console.log('   💰 Revertendo transação bancária:', bankTransaction.id)
          console.log('   💰 Valor da transação:', bankTransaction.amount)
          
          // Reverter saldo da conta bancária
          const bankAccount = await prisma.bankAccount.findUnique({
            where: { id: receivable.bankAccountId }
          })
          
          if (bankAccount) {
            const newBalance = Number(bankAccount.balance) - Number(bankTransaction.amount)
            await prisma.bankAccount.update({
              where: { id: bankAccount.id },
              data: { balance: newBalance }
            })
            console.log('   - Saldo anterior:', bankAccount.balance)
            console.log('   - Novo saldo:', newBalance)
          }
          
          // Excluir transação
          await prisma.transaction.delete({
            where: { id: bankTransaction.id }
          })
          console.log('   ✅ Transação bancária excluída')
        } else {
          // 🔍 FALLBACK: Tentar buscar por valor (amount ou netAmount) na mesma conta
          console.log('   ⚠️ Transação não encontrada por referenceId. Tentando fallback...')
          
          // Usar netAmount se disponível, senão amount
          const searchAmount = receivable.netAmount || receivable.amount
          console.log('   🔍 Buscando por valor:', searchAmount)
          
          const fallbackTransaction = await prisma.transaction.findFirst({
            where: {
              bankAccountId: receivable.bankAccountId,
              type: 'INCOME',
              amount: searchAmount
            },
            orderBy: { createdAt: 'desc' }
          })
          
          if (fallbackTransaction) {
            console.log('   🔄 Transação encontrada via fallback:', fallbackTransaction.id)
            console.log('   🔄 Descrição:', fallbackTransaction.description)
            
            const bankAccount = await prisma.bankAccount.findUnique({
              where: { id: receivable.bankAccountId }
            })
            
            if (bankAccount) {
              const newBalance = Number(bankAccount.balance) - Number(fallbackTransaction.amount)
              await prisma.bankAccount.update({
                where: { id: bankAccount.id },
                data: { balance: newBalance }
              })
              console.log('   - Saldo anterior:', bankAccount.balance)
              console.log('   - Novo saldo:', newBalance)
            }
            
            await prisma.transaction.delete({
              where: { id: fallbackTransaction.id }
            })
            console.log('   ✅ Transação bancária excluída via fallback')
          } else {
            console.log('   ❌ ERRO: Nenhuma transação encontrada para reverter!')
            console.log('   ❌ Buscado na conta:', receivable.bankAccountId)
            console.log('   ❌ Valor buscado:', searchAmount)
          }
        }
      }
      
      // 2. Reverter boleto se houver (via boletoId no receivable ou orderId)
      let linkedBoleto = null
      if (receivable.boletoId) {
        linkedBoleto = await prisma.boleto.findUnique({
          where: { id: receivable.boletoId }
        })
      } else if (receivable.orderId) {
        linkedBoleto = await prisma.boleto.findFirst({
          where: { orderId: receivable.orderId }
        })
      }
      
      if (linkedBoleto && linkedBoleto.status === 'PAID') {
        console.log('   🎫 Revertendo boleto:', linkedBoleto.boletoNumber)
        await prisma.boleto.update({
          where: { id: linkedBoleto.id },
          data: {
            status: 'PENDING',
            paidDate: null,
            paidBy: null
          }
        })
        console.log('   ✅ Boleto revertido para PENDING')
      }
      
      // 3. Reverter CardTransaction se houver
      if (receivable.orderId) {
        const cardTx = await prisma.cardTransaction.findFirst({
          where: { orderId: receivable.orderId }
        })
        
        if (cardTx) {
          console.log('   💳 Excluindo CardTransaction:', cardTx.id)
          await prisma.cardTransaction.delete({
            where: { id: cardTx.id }
          })
          console.log('   ✅ CardTransaction excluída')
        }
      }
      
      // 4. Atualizar o receivable para PENDING
      const reverted = await prisma.receivable.update({
        where: { id: params.id },
        data: {
          status: 'PENDING',
          paymentDate: null,
          bankAccountId: null
        }
      })
      
      console.log('   ✅ Receivable revertido para PENDING')
      console.log('=== FIM DA REVERSÃO ===\n')
      
      return NextResponse.json(reverted)
    }

    // Detectar mudança para CARTÃO
    const oldMethod = receivable.paymentMethod
    const newMethod = paymentMethod || oldMethod
    const isChangingToCard = (newMethod === 'CREDIT_CARD' || newMethod === 'DEBIT' || newMethod === 'CARD') && 
                             (oldMethod !== 'CREDIT_CARD' && oldMethod !== 'DEBIT' && oldMethod !== 'CARD')
    
    console.log('\n🔍 [RECEIVABLES_PUT] Análise de mudança de método:')
    console.log('   - Método antigo:', oldMethod)
    console.log('   - Método novo:', newMethod)
    console.log('   - Mudando para cartão?', isChangingToCard)
    console.log('   - Pedido tem CardTransactions?', receivable.Order?.CardTransactions?.length || 0)

    // 🔧 CORREÇÃO CRÍTICA: Se receivable já está PAID e estamos adicionando conta bancária,
    // precisamos criar a transação bancária!
    // ⚠️ EXCETO se for método de pagamento CARTÃO (pois cartões devem ir pro gestor primeiro)
    const isAddingBankAccount = bankAccountId && !receivable.bankAccountId
    const isAlreadyPaid = receivable.status === 'PAID' || status === 'PAID'
    const isCardPayment = newMethod === 'CREDIT_CARD' || newMethod === 'DEBIT' || newMethod === 'CARD'
    const shouldCreateTransaction = isAddingBankAccount && isAlreadyPaid && !isCardPayment
    
    console.log('\n💰 [RECEIVABLES_PUT] Análise de transação bancária:')
    console.log('   - Receivable já está PAID?', receivable.status === 'PAID')
    console.log('   - Novo status será PAID?', status === 'PAID')
    console.log('   - Conta bancária anterior:', receivable.bankAccountId || 'Nenhuma')
    console.log('   - Nova conta bancária:', bankAccountId || 'Nenhuma')
    console.log('   - Está ADICIONANDO conta bancária?', isAddingBankAccount)
    console.log('   - É pagamento com CARTÃO?', isCardPayment)
    console.log('   - Deve criar transação?', shouldCreateTransaction)

    const updated = await prisma.receivable.update({
      where: { id: params.id },
      data: {
        ...(description && { description }),
        ...(amount && { amount: parseFloat(amount.toString()) }),
        ...(dueDate && { dueDate: new Date(dueDate) }),
        ...(status && { status }),
        ...(paymentMethod && { paymentMethod }),
        ...(bankAccountId && { bankAccountId }),
      }
    })
    
    // 🔧 CORREÇÃO: Criar transação bancária quando receivable PAID recebe conta bancária
    // 🚨 IMPORTANTE: Verificar se JÁ EXISTE transação para evitar duplicatas!
    if (shouldCreateTransaction && bankAccountId) {
      console.log('\n🏦 [RECEIVABLES_PUT] Verificando se já existe transação bancária...')
      
      // 🔍 Verificar se já existe transação para este receivable
      const existingTransaction = await prisma.transaction.findFirst({
        where: {
          referenceType: 'RECEIVABLE',
          referenceId: receivable.id
        }
      })
      
      if (existingTransaction) {
        console.log('   ⚠️ JÁ EXISTE transação bancária para este receivable!')
        console.log('   - Transação ID:', existingTransaction.id)
        console.log('   - Valor:', existingTransaction.amount)
        console.log('   - Data:', existingTransaction.date)
        console.log('   ❌ NÃO criando transação duplicada!')
      } else {
        console.log('   ✅ Nenhuma transação existente encontrada. Criando nova...')
        
        const bankAccount = await prisma.bankAccount.findUnique({
          where: { id: bankAccountId },
        })
        
        if (bankAccount) {
          const netAmount = receivable.netAmount || receivable.amount
          const newBalance = Number(bankAccount.balance) + Number(netAmount)
          
          console.log('   - Conta bancária:', bankAccount.name)
          console.log('   - Saldo atual:', bankAccount.balance)
          console.log('   - Valor líquido do receivable:', netAmount)
          console.log('   - Novo saldo:', newBalance)
          
          // Criar transação de entrada
          await prisma.transaction.create({
            data: {
              bankAccountId: bankAccountId,
              type: 'INCOME',
              amount: Number(netAmount),
              description: `Recebimento: ${receivable.description}`,
              referenceId: receivable.id,
              referenceType: 'RECEIVABLE',
              category: 'VENDA',
              date: receivable.paymentDate || new Date(),
              balanceAfter: newBalance,
              notes: 'Transação criada ao editar receivable já pago',
              createdBy: user?.id,
            },
          })
          
          // Atualizar saldo da conta bancária
          await prisma.bankAccount.update({
            where: { id: bankAccountId },
            data: { balance: newBalance },
          })
          
          console.log('   ✅ Transação bancária criada e saldo atualizado!')
        } else {
          console.log('   ⚠️ Conta bancária não encontrada:', bankAccountId)
        }
      }
    }

    // 💳 Se mudou para CARTÃO, criar CardTransaction automaticamente
    // ⚠️ IMPORTANTE: Funciona tanto para receivables vinculados a pedidos quanto para receivables manuais
    if (isChangingToCard) {
      console.log('\n💳 [RECEIVABLES_PUT] Detectada mudança para CARTÃO!')
      
      // Verificar se já existe CardTransaction (caso tenha Order vinculado)
      const hasExistingCardTransaction = receivable.Order?.CardTransactions && receivable.Order.CardTransactions.length > 0
      
      console.log('   - Tem Order vinculado?', !!receivable.Order)
      console.log('   - Já tem CardTransaction?', hasExistingCardTransaction)
      
      if (!hasExistingCardTransaction) {
        console.log('\n💳 [RECEIVABLES_PUT] Criando CardTransaction automaticamente...')
        
        // Determinar tipo de cartão (padrão: DÉBITO)
        let cardType: 'DEBIT' | 'CREDIT' = 'DEBIT'
        if (newMethod === 'CREDIT_CARD') {
          cardType = 'CREDIT'
        }
        
        const feePercentage = cardType === 'DEBIT' ? 2.0 : 3.24
        const daysToReceive = cardType === 'DEBIT' ? 1 : 30
        
        const grossAmount = updated.amount
        const feeAmount = (Number(grossAmount) * feePercentage) / 100
        const netAmount = Number(grossAmount) - feeAmount
        
        // Se tem Order vinculado, usar a data de criação do pedido
        // Senão, usar a data de vencimento do receivable
        const saleDate = receivable.Order?.createdAt || receivable.dueDate
        const expectedDate = new Date(saleDate)
        expectedDate.setDate(expectedDate.getDate() + daysToReceive)
        
        // IMPORTANTE: Sempre criar como PENDING quando vem de edição de receivable
        // Mesmo que o cliente já tenha passado o cartão (receivable PAID),
        // o dinheiro ainda não caiu na conta (D+1 para débito, D+30 para crédito)
        // O status só muda para RECEIVED quando confirmar na Gestão de Cartões
        const cardStatus = 'PENDING'
        const receivedDate = null
        
        console.log('   - Tipo de cartão:', cardType)
        console.log('   - Taxa:', feePercentage + '%')
        console.log('   - Valor bruto:', grossAmount)
        console.log('   - Taxa (R$):', feeAmount.toFixed(2))
        console.log('   - Valor líquido:', netAmount.toFixed(2))
        console.log('   - Status CardTransaction:', cardStatus)
        console.log('   ℹ️  SEMPRE criado como PENDING - só muda para RECEIVED ao confirmar na Gestão de Cartões')
        
        await prisma.cardTransaction.create({
          data: {
            orderId: receivable.Order?.id || null, // ⚠️ Pode ser null se for receivable manual
            grossAmount: grossAmount,
            feeAmount: feeAmount,
            netAmount: netAmount,
            feePercentage: feePercentage,
            cardType: cardType,
            saleDate: saleDate,
            expectedDate: expectedDate,
            receivedDate: receivedDate,
            status: cardStatus,
            bankAccountId: bankAccountId || receivable.bankAccountId || undefined,
            // 🔗 Se não tem Order, vincular ao receivable diretamente
            receivableId: receivable.Order ? undefined : receivable.id
          }
        })
        
        console.log('✅ [RECEIVABLES_PUT] CardTransaction criado com sucesso!')
        console.log('   ℹ️  Agora o pedido aparecerá na Gestão de Cartões')
      } else {
        console.log('   ⚠️ Já existe CardTransaction para este pedido. Não criando duplicata.')
      }
    }

    console.log('✅ [RECEIVABLES_PUT] Receivable atualizado com sucesso!')

    return NextResponse.json({
      success: true,
      receivable: {
        ...updated,
        amount: Number(updated.amount),
        dueDate: updated.dueDate.toISOString(),
        paymentDate: updated.paymentDate?.toISOString() || null,
        createdAt: updated.createdAt.toISOString()
      }
    })
  } catch (error: any) {
    console.error('❌ [RECEIVABLES_PUT] Erro ao atualizar:', error)
    return NextResponse.json(
      { error: error?.message || 'Falha ao atualizar', details: error?.message },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    // Apenas admin pode atualizar entradas de contas a receber
    if (!user || user.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { status, paymentDate, notes } = body

    const receivable = await prisma.receivable.findUnique({
      where: { id: params.id }
    })

    if (!receivable) {
      return NextResponse.json(
        { error: 'Entrada não encontrada' },
        { status: 404 }
      )
    }

    const updated = await prisma.receivable.update({
      where: { id: params.id },
      data: {
        ...(status && { status }),
        ...(paymentDate !== undefined && { paymentDate: paymentDate ? new Date(paymentDate) : null }),
        ...(notes !== undefined && { notes })
      }
    })

    return NextResponse.json({
      success: true,
      receivable: {
        ...updated,
        amount: Number(updated.amount),
        dueDate: updated.dueDate.toISOString(),
        paymentDate: updated.paymentDate?.toISOString() || null,
        createdAt: updated.createdAt.toISOString()
      }
    })
  } catch (error: any) {
    console.error('Erro ao atualizar entrada de contas a receber:', error)
    return NextResponse.json(
      { error: error?.message || 'Falha ao atualizar' },
      { status: 500 }
    )
  }
}
