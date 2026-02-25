
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getPaymentStatus } from '@/lib/mercado-pago'
import crypto from 'crypto'

// POST - Webhook to receive payment notifications from Mercado Pago
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('Mercado Pago Webhook received:', body)

    // Mercado Pago sends different types of notifications
    // We're interested in 'payment' type
    if (body.type !== 'payment') {
      return NextResponse.json({ message: 'Not a payment notification' })
    }

    const paymentId = body.data?.id

    if (!paymentId) {
      return NextResponse.json({ error: 'No payment ID' }, { status: 400 })
    }

    // Get payment details from Mercado Pago
    const payment = await getPaymentStatus(paymentId)

    console.log('Payment status:', payment.status)

    // Find boleto by payment ID
    const boleto = await prisma.boleto.findFirst({
      where: { pixPaymentId: paymentId },
      include: {
        Order: true,
        Customer: true
      }
    })

    if (!boleto) {
      console.log('Boleto not found for payment ID:', paymentId)
      return NextResponse.json({ message: 'Boleto not found' })
    }

    // Update boleto status based on payment status
    if (payment.status === 'approved') {
      // Payment approved - mark boleto as paid
      await prisma.boleto.update({
        where: { id: boleto.id },
        data: {
          status: 'PAID',
          paidDate: new Date()
        }
      })

      // If boleto is linked to an order, update order status
      if (boleto.Order) {
        await prisma.order.update({
          where: { id: boleto.Order.id },
          data: {
            status: 'CONFIRMED'
          }
        })

        // Create notification for admin
        await prisma.notification.create({
          data: {
            id: crypto.randomUUID(),
            title: '💰 Pagamento Recebido!',
            message: `Boleto ${boleto.boletoNumber} foi pago. Pedido #${boleto.Order.orderNumber} confirmado.`,
            category: 'BOLETO',
            targetRole: null,
            targetUserId: null,
            type: 'ORDER_UPDATE'
          }
        })
      } else {
        // Create notification for standalone boleto payment
        await prisma.notification.create({
          data: {
            id: crypto.randomUUID(),
            title: '💰 Pagamento de Boleto Recebido',
            message: `Boleto ${boleto.boletoNumber} foi pago por ${boleto.Customer.name}.`,
            category: 'BOLETO',
            targetRole: null,
            targetUserId: null,
            type: 'ORDER_UPDATE'
          }
        })
      }

      console.log('Boleto marked as paid:', boleto.boletoNumber)
    } else if (payment.status === 'cancelled' || payment.status === 'rejected') {
      // Payment cancelled or rejected
      await prisma.boleto.update({
        where: { id: boleto.id },
        data: {
          status: 'CANCELLED'
        }
      })

      console.log('Boleto cancelled:', boleto.boletoNumber)
    }

    return NextResponse.json({ message: 'Webhook processed successfully' })
  } catch (error) {
    console.error('Error processing webhook:', error)
    // Return 200 to prevent Mercado Pago from retrying
    return NextResponse.json({ error: 'Error processing webhook' }, { status: 200 })
  }
}

// GET - For testing webhook URL
export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'Mercado Pago webhook endpoint is active',
    timestamp: new Date().toISOString()
  })
}
