
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

// GET single boleto
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const boleto = await prisma.boleto.findUnique({
      where: { id: params.id },
      include: {
        Customer: true,
        Order: {
          include: {
            OrderItem: {
              include: {
                Product: true
              }
            }
          }
        }
      }
    })

    if (!boleto) {
      return NextResponse.json({ error: 'Boleto not found' }, { status: 404 })
    }

    // Check authorization
    if (user?.userType === 'CUSTOMER' && boleto.customerId !== user.customerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Serialize response
    const serializedBoleto = {
      ...boleto,
      amount: Number(boleto.amount),
      dueDate: boleto.dueDate.toISOString(),
      paidDate: boleto.paidDate?.toISOString() || null,
      createdAt: boleto.createdAt.toISOString(),
      updatedAt: boleto.updatedAt.toISOString()
    }

    return NextResponse.json(serializedBoleto)
  } catch (error) {
    console.error('Error fetching boleto:', error)
    return NextResponse.json(
      { error: 'Failed to fetch boleto' },
      { status: 500 }
    )
  }
}

// PUT - Update boleto (admin only - for paying boleto)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, notes } = body

    const boleto = await prisma.boleto.findUnique({
      where: { id: params.id },
      include: { Customer: true }
    })

    if (!boleto) {
      return NextResponse.json({ error: 'Boleto not found' }, { status: 404 })
    }

    if (action === 'pay') {
      // Extrair dados do recebimento
      const { 
        bankAccountId, 
        interestAmount = 0, 
        fineAmount = 0,
        paymentDate 
      } = body
      
      // Validar conta bancária (obrigatória para recebimento)
      if (!bankAccountId) {
        return NextResponse.json(
          { error: 'Conta bancária é obrigatória para dar entrada no boleto' },
          { status: 400 }
        )
      }
      
      // Verificar se a conta existe
      const bankAccount = await prisma.bankAccount.findUnique({
        where: { id: bankAccountId }
      })
      
      if (!bankAccount) {
        return NextResponse.json(
          { error: 'Conta bancária não encontrada' },
          { status: 404 }
        )
      }
      
      // Calcular valor total recebido (valor original + juros + multa)
      const originalAmount = Number(boleto.amount)
      const interest = Number(interestAmount) || 0
      const fine = Number(fineAmount) || 0
      const totalReceived = originalAmount + interest + fine
      
      console.log(`💰 [BOLETO_RECEIVE] Recebendo boleto ${boleto.boletoNumber}`)
      console.log(`   Valor original: R$ ${originalAmount.toFixed(2)}`)
      console.log(`   Juros: R$ ${interest.toFixed(2)}`)
      console.log(`   Multa: R$ ${fine.toFixed(2)}`)
      console.log(`   Total recebido: R$ ${totalReceived.toFixed(2)}`)
      console.log(`   Conta bancária: ${bankAccount.name}`)
      
      // Usar data de pagamento informada ou data atual
      const paidDateValue = paymentDate ? new Date(paymentDate) : new Date()
      
      // Executar tudo em uma transação
      const [updatedBoleto] = await prisma.$transaction([
        // 1. Atualizar o boleto
        prisma.boleto.update({
          where: { id: params.id },
          data: {
            status: 'PAID',
            paidDate: paidDateValue,
            paidBy: user.name || user.email,
            paidAmount: totalReceived,
            interestAmount: interest,
            fineAmount: fine,
            bankAccountId: bankAccountId,
            notes: notes || boleto.notes
          },
          include: {
            Customer: true,
            Order: true
          }
        }),
        // 2. Restaurar crédito do cliente
        prisma.customer.update({
          where: { id: boleto.customerId },
          data: {
            availableCredit: {
              increment: originalAmount // Só restaura o valor original, não os juros
            }
          }
        }),
        // 3. Atualizar saldo da conta bancária
        prisma.bankAccount.update({
          where: { id: bankAccountId },
          data: {
            balance: {
              increment: totalReceived
            }
          }
        }),
        // 4. Criar transação bancária
        prisma.transaction.create({
          data: {
            bankAccountId: bankAccountId,
            type: 'INCOME',
            amount: totalReceived,
            description: `Boleto ${boleto.boletoNumber} - ${boleto.Customer?.name || 'Cliente'}`,
            date: paidDateValue,
            balanceAfter: Number(bankAccount.balance) + totalReceived,
            referenceType: 'BOLETO',
            referenceId: boleto.id,
            notes: interest > 0 || fine > 0 
              ? `Original: R$ ${originalAmount.toFixed(2)} | Juros: R$ ${interest.toFixed(2)} | Multa: R$ ${fine.toFixed(2)}`
              : null
          }
        })
      ])
      
      console.log(`✅ [BOLETO_RECEIVE] Boleto recebido com sucesso!`)
      console.log(`   Saldo anterior da conta: R$ ${bankAccount.balance.toFixed(2)}`)
      console.log(`   Novo saldo: R$ ${(Number(bankAccount.balance) + totalReceived).toFixed(2)}`)

      // Serialize response
      const serializedBoleto = {
        ...updatedBoleto,
        amount: Number(updatedBoleto.amount),
        paidAmount: Number(updatedBoleto.paidAmount),
        interestAmount: Number(updatedBoleto.interestAmount),
        fineAmount: Number(updatedBoleto.fineAmount),
        dueDate: updatedBoleto.dueDate.toISOString(),
        paidDate: updatedBoleto.paidDate?.toISOString() || null,
        createdAt: updatedBoleto.createdAt.toISOString(),
        updatedAt: updatedBoleto.updatedAt.toISOString()
      }

      return NextResponse.json(serializedBoleto)
    } else if (action === 'cancel') {
      // Cancel the boleto and restore customer's available credit
      const [updatedBoleto] = await prisma.$transaction([
        prisma.boleto.update({
          where: { id: params.id },
          data: {
            status: 'CANCELLED',
            notes: notes || boleto.notes
          },
          include: {
            Customer: true,
            Order: true
          }
        }),
        prisma.customer.update({
          where: { id: boleto.customerId },
          data: {
            availableCredit: {
              increment: Number(boleto.amount)
            }
          }
        })
      ])

      // Serialize response
      const serializedBoleto = {
        ...updatedBoleto,
        amount: Number(updatedBoleto.amount),
        dueDate: updatedBoleto.dueDate.toISOString(),
        paidDate: updatedBoleto.paidDate?.toISOString() || null,
        createdAt: updatedBoleto.createdAt.toISOString(),
        updatedAt: updatedBoleto.updatedAt.toISOString()
      }

      return NextResponse.json(serializedBoleto)
    } else if (action === 'revert') {
      // 🔄 REVERTER boleto pago para PENDING
      console.log(`🔄 [BOLETO_REVERT] Revertendo boleto ${boleto.boletoNumber}`)
      
      if (boleto.status !== 'PAID') {
        return NextResponse.json(
          { error: 'Apenas boletos PAGOS podem ser revertidos' },
          { status: 400 }
        )
      }
      
      const paidAmount = Number(boleto.paidAmount) || Number(boleto.amount)
      
      // Buscar transação bancária associada (SEMPRE buscar, independente do bankAccountId)
      const bankTransaction = await prisma.transaction.findFirst({
        where: {
          referenceType: 'BOLETO',
          referenceId: boleto.id
        }
      })
      
      console.log(`   📊 Transação bancária encontrada:`, bankTransaction ? bankTransaction.id : 'Nenhuma')
      
      // Preparar operações para transação
      const operations: any[] = [
        // 1. Reverter boleto para PENDING
        prisma.boleto.update({
          where: { id: params.id },
          data: {
            status: 'PENDING',
            paidDate: null,
            paidBy: null,
            paidAmount: null,
            interestAmount: null,
            fineAmount: null,
            bankAccountId: null, // Limpar também o bankAccountId
            notes: notes ? `${notes} | Revertido por ${user.name || user.email}` : `Revertido por ${user.name || user.email}`
          },
          include: {
            Customer: true,
            Order: true
          }
        })
      ]
      
      // 2. Reverter saldo da conta bancária 
      // Prioridade: usar bankAccountId da transação, depois do boleto
      const bankAccountIdToRevert = bankTransaction?.bankAccountId || boleto.bankAccountId
      
      if (bankAccountIdToRevert) {
        const amountToRevert = bankTransaction ? Number(bankTransaction.amount) : paidAmount
        operations.push(
          prisma.bankAccount.update({
            where: { id: bankAccountIdToRevert },
            data: {
              balance: {
                decrement: amountToRevert
              }
            }
          })
        )
        console.log(`   💰 Revertendo R$ ${amountToRevert.toFixed(2)} da conta bancária ${bankAccountIdToRevert}`)
      }
      
      // 3. Excluir transação bancária (se existir)
      if (bankTransaction) {
        operations.push(
          prisma.transaction.delete({
            where: { id: bankTransaction.id }
          })
        )
        console.log(`   🗑️ Excluindo transação bancária: ${bankTransaction.id}`)
      }
      
      // 4. Reduzir crédito disponível do cliente (pois o boleto voltou a estar pendente)
      operations.push(
        prisma.customer.update({
          where: { id: boleto.customerId },
          data: {
            availableCredit: {
              decrement: Number(boleto.amount)
            }
          }
        })
      )
      
      const [updatedBoleto] = await prisma.$transaction(operations)
      
      console.log(`✅ [BOLETO_REVERT] Boleto revertido com sucesso!`)

      // Serialize response
      const serializedBoleto = {
        ...updatedBoleto,
        amount: Number(updatedBoleto.amount),
        dueDate: updatedBoleto.dueDate.toISOString(),
        paidDate: null,
        createdAt: updatedBoleto.createdAt.toISOString(),
        updatedAt: updatedBoleto.updatedAt.toISOString()
      }

      return NextResponse.json(serializedBoleto)
    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Error updating boleto:', error)
    return NextResponse.json(
      { error: 'Failed to update boleto' },
      { status: 500 }
    )
  }
}

// DELETE boleto (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const boleto = await prisma.boleto.findUnique({
      where: { id: params.id }
    })

    if (!boleto) {
      return NextResponse.json({ error: 'Boleto not found' }, { status: 404 })
    }

    // SEMPRE verificar se precisa devolver crédito ao excluir boleto
    console.log(`🗑️ Excluindo boleto ${boleto.boletoNumber} (Status: ${boleto.status})`)
    
    // Buscar customer atual para calcular se precisa devolver crédito
    const customer = await prisma.customer.findUnique({
      where: { id: boleto.customerId },
      select: {
        creditLimit: true,
        availableCredit: true
      }
    })

    if (!customer) {
      // Se não achou customer, só exclui o boleto
      await prisma.boleto.delete({
        where: { id: params.id }
      })
      return NextResponse.json({ success: true })
    }

    // Calcular quanto de crédito está sendo usado atualmente
    const currentUsedCredit = customer.creditLimit - customer.availableCredit
    
    // Se há crédito sendo usado E o boleto não está PAID (pois PAID já devolveu o crédito)
    // OU se o status é PENDING/OVERDUE/CANCELLED (que sempre bloqueiam crédito)
    const shouldRestoreCredit = (
      boleto.status === 'PENDING' || 
      boleto.status === 'OVERDUE' || 
      boleto.status === 'CANCELLED' ||
      (currentUsedCredit >= boleto.amount) // Há crédito suficiente bloqueado
    ) && boleto.status !== 'PAID' // PAID já devolveu, não devolver de novo

    if (shouldRestoreCredit) {
      console.log(`💰 Devolvendo R$ ${boleto.amount.toFixed(2)} ao cliente ${boleto.customerId}`)
      
      await prisma.$transaction([
        prisma.boleto.delete({
          where: { id: params.id }
        }),
        prisma.customer.update({
          where: { id: boleto.customerId },
          data: {
            availableCredit: {
              increment: Number(boleto.amount)
            }
          }
        })
      ])
      
      console.log(`✅ Boleto excluído e crédito devolvido`)
    } else {
      console.log(`ℹ️ Boleto ${boleto.status} - não precisa devolver crédito (já foi devolvido)`)
      
      await prisma.boleto.delete({
        where: { id: params.id }
      })
      
      console.log(`✅ Boleto excluído`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting boleto:', error)
    return NextResponse.json(
      { error: 'Failed to delete boleto' },
      { status: 500 }
    )
  }
}
