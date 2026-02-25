export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user || session.user.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const formData = await request.formData()
    const creditCardId = formData.get('creditCardId') as string
    const description = formData.get('description') as string
    const amount = parseFloat(formData.get('amount') as string)
    const creditDate = formData.get('creditDate') as string
    const referenceNumber = formData.get('referenceNumber') as string || null
    const notes = formData.get('notes') as string || null

    console.log('💳 [CREDIT_CARD_CREDIT_CREATE] Criando crédito:', {
      creditCardId,
      description,
      amount,
      creditDate,
      referenceNumber
    })

    if (!creditCardId || !description || !amount || !creditDate) {
      return NextResponse.json(
        { error: 'Dados incompletos' },
        { status: 400 }
      )
    }

    // Buscar o cartão de crédito
    const card = await prisma.creditCard.findUnique({
      where: { id: creditCardId }
    })

    if (!card) {
      return NextResponse.json(
        { error: 'Cartão de crédito não encontrado' },
        { status: 404 }
      )
    }

    // Converter creditDate para Date object
    const creditDateObj = new Date(creditDate)
    const creditDay = creditDateObj.getDate()
    const creditMonth = creditDateObj.getMonth()
    const creditYear = creditDateObj.getFullYear()

    console.log('📅 Data do crédito:', {
      creditDay,
      creditMonth,
      creditYear,
      closingDay: card.closingDay
    })

    // Determinar a fatura correta baseado no dia de fechamento
    let invoiceMonth: Date
    
    if (creditDay <= card.closingDay) {
      // Crédito antes do fechamento: vai para a fatura do mês atual
      invoiceMonth = new Date(creditYear, creditMonth, 1, 12, 0, 0)
    } else {
      // Crédito após o fechamento: vai para a fatura do próximo mês
      invoiceMonth = new Date(creditYear, creditMonth + 1, 1, 12, 0, 0)
    }

    console.log('📋 Fatura determinada:', {
      invoiceMonth: invoiceMonth.toISOString(),
      referenceMonth: `${invoiceMonth.getFullYear()}-${String(invoiceMonth.getMonth() + 1).padStart(2, '0')}`
    })

    // Buscar ou criar a fatura
    // CRITICAL: Usar range de datas para evitar duplicação devido a timezone
    const invoiceMonthStart = new Date(invoiceMonth.getFullYear(), invoiceMonth.getMonth(), 1, 0, 0, 0)
    const invoiceMonthEnd = new Date(invoiceMonth.getFullYear(), invoiceMonth.getMonth() + 1, 0, 23, 59, 59)
    
    let invoice = await prisma.creditCardInvoice.findFirst({
      where: {
        creditCardId: creditCardId,
        referenceMonth: {
          gte: invoiceMonthStart,
          lte: invoiceMonthEnd
        },
        status: 'OPEN' // Buscar apenas faturas ABERTAS
      },
      orderBy: {
        createdAt: 'asc' // Pegar a mais antiga (provavelmente a correta)
      }
    })

    console.log('📋 Fatura encontrada:', invoice ? `ID: ${invoice.id} | Total: R$ ${Number(invoice.totalAmount).toFixed(2)}` : 'Nenhuma')

    if (!invoice) {
      console.log('📋 Criando nova fatura para o crédito...')
      
      // Calcular closingDate e dueDate
      const closingDate = new Date(creditYear, creditMonth + 1, card.closingDay, 12, 0, 0)
      const dueDate = new Date(creditYear, creditMonth + 1, card.dueDay, 12, 0, 0)

      if (dueDate < closingDate) {
        dueDate.setMonth(dueDate.getMonth() + 1)
      }

      invoice = await prisma.creditCardInvoice.create({
        data: {
          creditCardId: creditCardId,
          referenceMonth: invoiceMonth,
          closingDate,
          dueDate,
          totalAmount: 0,
          status: 'OPEN'
        }
      })

      console.log('✅ Fatura criada:', invoice.id)
    } else {
      console.log('✅ Usando fatura existente:', invoice.id)
    }

    // Criar o crédito usando transação
    const result = await prisma.$transaction(async (tx) => {
      // 1. Criar registro do crédito
      const credit = await tx.creditCardCredit.create({
        data: {
          creditCardId: creditCardId,
          invoiceId: invoice.id,
          description,
          amount,
          creditDate: new Date(creditDate + 'T12:00:00'),
          referenceNumber,
          notes,
          createdBy: session.user.id
        }
      })

      console.log('✅ Crédito criado:', credit.id)

      // 2. Atualizar o total da fatura (subtrair o crédito)
      const updatedInvoice = await tx.creditCardInvoice.update({
        where: { id: invoice.id },
        data: {
          totalAmount: {
            decrement: amount // Diminui o total da fatura
          }
        }
      })

      console.log('✅ Fatura atualizada:', {
        invoiceId: updatedInvoice.id,
        newTotal: updatedInvoice.totalAmount
      })

      // 3. Aumentar o limite disponível do cartão
      const updatedCard = await tx.creditCard.update({
        where: { id: creditCardId },
        data: {
          availableLimit: {
            increment: amount // Aumenta o limite disponível
          }
        }
      })

      console.log('✅ Limite do cartão atualizado:', {
        cardId: updatedCard.id,
        newAvailableLimit: updatedCard.availableLimit
      })

      return { credit, invoice: updatedInvoice, card: updatedCard }
    })

    console.log('🎉 Crédito processado com sucesso!')

    return NextResponse.json({
      success: true,
      credit: result.credit,
      message: 'Crédito adicionado com sucesso'
    })

  } catch (error) {
    console.error('❌ [CREDIT_CARD_CREDIT_CREATE] Erro:', error)
    return NextResponse.json(
      { 
        error: 'Erro ao criar crédito',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user || session.user.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const creditCardId = searchParams.get('creditCardId')
    const invoiceId = searchParams.get('invoiceId')

    const where: any = {}
    
    if (creditCardId) where.creditCardId = creditCardId
    if (invoiceId) where.invoiceId = invoiceId

    const credits = await prisma.creditCardCredit.findMany({
      where,
      include: {
        CreditCard: {
          select: {
            name: true,
            cardNumber: true
          }
        },
        Invoice: {
          select: {
            referenceMonth: true,
            status: true
          }
        }
      },
      orderBy: {
        creditDate: 'desc'
      }
    })

    return NextResponse.json({ credits })

  } catch (error) {
    console.error('❌ [CREDIT_CARD_CREDIT_LIST] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar créditos' },
      { status: 500 }
    )
  }
}
