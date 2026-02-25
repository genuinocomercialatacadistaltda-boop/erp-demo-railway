export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params
    const { searchParams } = new URL(req.url)
    const customerId = searchParams.get('customerId')

    if (!customerId) {
      return NextResponse.json(
        { error: 'customerId é obrigatório' },
        { status: 400 }
      )
    }

    // Buscar o vendedor (assador) pelo slug
    const seller = await prisma.customer.findUnique({
      where: { storeSlug: slug }
    })

    if (!seller) {
      return NextResponse.json(
        { error: 'Loja não encontrada' },
        { status: 404 }
      )
    }

    // Buscar pedidos do cliente
    const orders = await prisma.clientCustomerOrder.findMany({
      where: {
        clientCustomerId: customerId,
        customerId: seller.id
      },
      include: {
        Items: {
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            subtotal: true,
            productName: true,
            productImage: true,
            notes: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Formatar resposta para coincidir com o formato esperado pelo frontend
    const formattedOrders = orders.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      totalAmount: order.total,
      status: order.status,
      paymentMethod: order.paymentMethod || 'PIX',
      createdAt: order.createdAt.toISOString(),
      items: order.Items.map(item => ({
        id: item.id,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        Product: {
          name: item.productName,
          measurementUnit: 'un' // Você pode adicionar isso ao schema se precisar
        }
      }))
    }))

    return NextResponse.json({
      orders: formattedOrders
    })

  } catch (error) {
    console.error('Erro ao buscar pedidos:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar pedidos' },
      { status: 500 }
    )
  }
}
