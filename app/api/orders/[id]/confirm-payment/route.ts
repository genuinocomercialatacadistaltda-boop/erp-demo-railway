
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { authOptions } from '@/lib/auth-options'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    // Only admin can confirm payments
    if (user?.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { paymentMethod, paymentDate, notes } = body

    console.log(`\n💰 Confirmando pagamento do pedido ${params.id}...`)

    // Buscar pedido
    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: {
        Customer: true
      }
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Pedido não encontrado' },
        { status: 404 }
      )
    }

    if (order.paymentStatus === 'PAID') {
      return NextResponse.json(
        { error: 'Pagamento já foi confirmado anteriormente' },
        { status: 400 }
      )
    }

    // Executar em transação
    await prisma.$transaction(async (tx: any) => {
      // 1️⃣ Atualizar status de pagamento do pedido
      await tx.order.update({
        where: { id: params.id },
        data: {
          paymentStatus: 'PAID',
          paidAmount: order.total
        }
      })

      // 2️⃣ Criar registro de pagamento
      await tx.payment.create({
        data: {
          orderId: params.id,
          amount: order.total,
          paymentMethod: paymentMethod || order.paymentMethod,
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
          receivedBy: user?.id || 'ADMIN',
          notes: notes || 'Pagamento confirmado pelo administrador'
        }
      })

      // 3️⃣ Atualizar status da compra do cliente para PAID
      if (order.customerId) {
        const purchase = await tx.purchase.findFirst({
          where: {
            customerId: order.customerId,
            invoiceNumber: order.orderNumber,
            status: 'PENDING'
          }
        })

        if (purchase) {
          await tx.purchase.update({
            where: { id: purchase.id },
            data: {
              status: 'PAID',
              paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
              paymentMethod: paymentMethod || order.paymentMethod,
              paidBy: user?.id || 'ADMIN'
            }
          })
          console.log(`✅ Compra ${purchase.purchaseNumber} marcada como PAGA`)
        }
      }

      console.log(`✅ Pagamento confirmado com sucesso!`)
    })

    // Buscar pedido atualizado
    const updatedOrder = await prisma.order.findUnique({
      where: { id: params.id },
      include: {
        Customer: true,
        Payment: true
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Pagamento confirmado com sucesso',
      order: updatedOrder
    })
  } catch (error) {
    console.error('Error confirming payment:', error)
    return NextResponse.json(
      { error: 'Falha ao confirmar pagamento' },
      { status: 500 }
    )
  }
}
