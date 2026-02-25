
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!session || (user?.userType !== 'ADMIN' && user?.userType !== 'SELLER')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { items, orderDate } = await request.json()
    const orderId = params.id

    console.log('🔄 [UPDATE_ORDER] Atualizando pedido:', {
      orderId,
      itemsCount: items.length,
      orderDate
    })

    // Buscar o pedido atual
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { OrderItem: true }
    })

    if (!order) {
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
    }

    // Deletar itens antigos
    await prisma.orderItem.deleteMany({
      where: { orderId }
    })

    // Criar novos itens
    let newSubtotal = 0
    for (const item of items) {
      const itemTotal = item.quantity * item.unitPrice
      newSubtotal += itemTotal

      await prisma.orderItem.create({
        data: {
          id: crypto.randomUUID(),
          orderId,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: itemTotal
        }
      })
    }

    // Recalcular totais
    const discount = Number(order.discount) || 0
    const newTotal = newSubtotal - discount

    // 🆕 Preparar dados de atualização
    const updateData: any = {
      subtotal: newSubtotal,
      total: newTotal
    }

    // 🆕 Se uma nova data foi fornecida, atualizar createdAt
    if (orderDate) {
      const newCreatedAt = new Date(orderDate + 'T' + new Date(order.createdAt).toISOString().split('T')[1])
      updateData.createdAt = newCreatedAt
      console.log('📅 [UPDATE_ORDER] Atualizando data:', {
        oldDate: order.createdAt,
        newDate: newCreatedAt
      })
    }

    // Atualizar o pedido
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: {
        OrderItem: {
          include: {
            Product: true
          }
        }
      }
    })

    return NextResponse.json(updatedOrder)
  } catch (error) {
    console.error('Error updating order items:', error)
    return NextResponse.json({ error: 'Erro ao atualizar pedido' }, { status: 500 })
  }
}
