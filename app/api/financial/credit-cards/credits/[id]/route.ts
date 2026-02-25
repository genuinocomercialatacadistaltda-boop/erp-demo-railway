import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user || session.user.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const creditId = params.id

    console.log('🗑️ [CREDIT_CARD_CREDIT_DELETE] Excluindo crédito:', creditId)

    // Buscar o crédito
    const credit = await prisma.creditCardCredit.findUnique({
      where: { id: creditId },
      include: {
        CreditCard: true,
        Invoice: true
      }
    })

    if (!credit) {
      return NextResponse.json(
        { error: 'Crédito não encontrado' },
        { status: 404 }
      )
    }

    console.log('📋 Crédito encontrado:', {
      id: credit.id,
      description: credit.description,
      amount: credit.amount,
      invoiceId: credit.invoiceId,
      cardId: credit.creditCardId
    })

    // Usar transação para reverter todas as operações
    await prisma.$transaction(async (tx) => {
      // 1. Reverter o total da fatura (adicionar de volta o valor do crédito)
      if (credit.invoiceId) {
        const updatedInvoice = await tx.creditCardInvoice.update({
          where: { id: credit.invoiceId },
          data: {
            totalAmount: {
              increment: Number(credit.amount) // Aumenta o total da fatura
            }
          }
        })
        console.log('✅ Fatura atualizada (valor adicionado de volta):', {
          invoiceId: updatedInvoice.id,
          newTotal: updatedInvoice.totalAmount
        })
      }

      // 2. Reverter o limite disponível do cartão (diminuir)
      const updatedCard = await tx.creditCard.update({
        where: { id: credit.creditCardId },
        data: {
          availableLimit: {
            decrement: Number(credit.amount) // Diminui o limite disponível
          }
        }
      })
      console.log('✅ Limite do cartão revertido:', {
        cardId: updatedCard.id,
        newAvailableLimit: updatedCard.availableLimit
      })

      // 3. Deletar o crédito
      await tx.creditCardCredit.delete({
        where: { id: creditId }
      })
      console.log('✅ Crédito excluído com sucesso')
    })

    console.log('🎉 Exclusão do crédito concluída!')

    return NextResponse.json({
      success: true,
      message: 'Crédito excluído com sucesso'
    })

  } catch (error) {
    console.error('❌ [CREDIT_CARD_CREDIT_DELETE] Erro:', error)
    return NextResponse.json(
      { 
        error: 'Erro ao excluir crédito',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}
