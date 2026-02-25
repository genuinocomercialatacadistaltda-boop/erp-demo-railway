import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getInstantPixStatus, CoraAccountType } from '@/lib/cora'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

// Tipos para cartData
interface CartItem {
  productId: string
  quantity: number
  price: number
}

interface CartData {
  items: CartItem[]
  customerData: {
    name: string
    phone?: string
    email?: string
    address?: string
    city?: string
  }
  orderType: string
  deliveryType?: string
  paymentMethod: string
  notes?: string
  couponId?: string
  couponCode?: string
  couponDiscount?: number
  customerId?: string
}

/**
 * Cria um pedido automaticamente a partir do cartData salvo no PIX
 */
async function createOrderFromCart(pixCharge: any): Promise<{ orderId: string; orderNumber: string } | null> {
  const cartData = pixCharge.cartData as CartData | null
  
  if (!cartData || !cartData.items || cartData.items.length === 0) {
    console.log('⚠️ [PIX] Sem cartData ou itens - pedido não será criado automaticamente')
    return null
  }
  
  console.log('🛒 [PIX] Criando pedido automaticamente a partir do carrinho...')
  console.log('🛒 [PIX] Itens:', cartData.items.length)
  
  const now = new Date()
  const orderId = randomUUID()
  const orderNumber = `VAR-${Date.now()}`
  
  try {
    // Calcular subtotal dos itens
    const subtotal = cartData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    const couponDiscount = cartData.couponDiscount || 0
    const total = Number(pixCharge.amount)
    
    // Criar pedido
    const order = await prisma.order.create({
      data: {
        id: orderId,
        orderNumber,
        customerName: cartData.customerData?.name || pixCharge.customerName || 'Cliente PIX',
        casualCustomerName: cartData.customerData?.name || pixCharge.customerName,
        customerPhone: cartData.customerData?.phone || null,
        customerEmail: cartData.customerData?.email || null,
        address: cartData.customerData?.address || null,
        city: cartData.customerData?.city || null,
        customerId: cartData.customerId || pixCharge.customerId || null,
        orderType: 'WHOLESALE',
        deliveryType: (cartData.deliveryType as any) || 'PICKUP',
        paymentMethod: 'PIX',
        paymentStatus: 'PAID',
        paidAmount: total,
        status: 'PENDING',
        subtotal,
        total,
        discount: couponDiscount,
        discountPercent: 0,
        cardFee: 0,
        couponId: cartData.couponId || null,
        couponCode: cartData.couponCode || null,
        couponDiscount,
        boletoFee: 0,
        volumes: 1,
        notes: cartData.notes || 'Pedido criado automaticamente via PIX',
        createdByRole: 'AUTO-PIX',
        createdAt: pixCharge.paidAt || now,
        updatedAt: now,
      }
    })
    
    console.log('✅ [PIX] Pedido criado:', order.orderNumber)
    
    // Criar itens do pedido
    for (const item of cartData.items) {
      await prisma.orderItem.create({
        data: {
          id: randomUUID(),
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.price,
          total: item.price * item.quantity,
        }
      })
    }
    
    console.log('✅ [PIX] Itens do pedido criados:', cartData.items.length)
    
    // Vincular PIX ao pedido
    await prisma.pixCharge.update({
      where: { id: pixCharge.id },
      data: { orderId: order.id }
    })
    
    // Criar recebível
    await prisma.receivable.create({
      data: {
        id: randomUUID(),
        orderId: order.id,
        description: `Pedido ${order.orderNumber} - PIX`,
        amount: total,
        dueDate: now,
        status: 'PAID',
        paymentMethod: 'PIX',
        paymentDate: pixCharge.paidAt || now,
        createdAt: pixCharge.paidAt || now,
        updatedAt: now,
      }
    })
    
    console.log('✅ [PIX] Recebível criado')
    
    // Encontrar conta bancária correta
    const bankAccounts = await prisma.bankAccount.findMany()
    const bankAccount = pixCharge.coraAccount === 'GENUINO'
      ? bankAccounts.find((a: any) => a.name.toLowerCase().includes('genuino') || a.name.toLowerCase().includes('genuíno'))
      : bankAccounts.find((a: any) => a.name.toLowerCase().includes('espetos') && a.name.toLowerCase().includes('cora'))
    
    if (bankAccount) {
      const newBalance = Number(bankAccount.balance) + Number(pixCharge.netAmount)
      
      await prisma.transaction.create({
        data: {
          id: randomUUID(),
          bankAccountId: bankAccount.id,
          type: 'INCOME',
          amount: Number(pixCharge.netAmount),
          description: `PIX ${order.orderNumber} - ${pixCharge.customerName}`,
          date: pixCharge.paidAt || now,
          createdAt: pixCharge.paidAt || now,
          balanceAfter: newBalance,
        }
      })
      
      await prisma.bankAccount.update({
        where: { id: bankAccount.id },
        data: { balance: newBalance }
      })
      
      console.log('✅ [PIX] Transação bancária criada - +R$', Number(pixCharge.netAmount).toFixed(2))
    }
    
    return { orderId: order.id, orderNumber: order.orderNumber }
  } catch (error) {
    console.error('❌ [PIX] Erro ao criar pedido automático:', error)
    return null
  }
}

/**
 * GET /api/pix/[id]/status
 * Verifica o status de uma cobrança PIX
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Buscar a cobrança no banco
    const pixCharge = await prisma.pixCharge.findUnique({
      where: { id },
      include: {
        Order: { select: { id: true, orderNumber: true } },
        Customer: { select: { id: true, name: true } },
      },
    })

    if (!pixCharge) {
      return NextResponse.json(
        { error: 'Cobrança PIX não encontrada' },
        { status: 404 }
      )
    }

    // Se já está pago ou cancelado, retorna direto
    if (pixCharge.status === 'PAID' || pixCharge.status === 'CANCELLED') {
      return NextResponse.json({
        id: pixCharge.id,
        status: pixCharge.status,
        paidAt: pixCharge.paidAt,
        amount: Number(pixCharge.amount),
        netAmount: Number(pixCharge.netAmount),
        order: pixCharge.Order,
        customer: pixCharge.Customer,
      })
    }

    // Consultar status no Cora
    if (pixCharge.coraInvoiceId) {
      try {
        const coraStatus = await getInstantPixStatus(
          pixCharge.coraInvoiceId,
          pixCharge.coraAccount as CoraAccountType
        )

        console.log('💜 [PIX STATUS] Cora status:', coraStatus.status)

        // Se foi pago no Cora, atualizar no banco
        if (coraStatus.status === 'PAID') {
          const updated = await prisma.pixCharge.update({
            where: { id },
            data: {
              status: 'PAID',
              paidAt: new Date(),
            },
          })

          console.log('💜 [PIX] Pagamento confirmado!')
          
          // Se não tem pedido vinculado e tem cartData, criar pedido automaticamente
          let order = pixCharge.Order
          if (!order && updated.cartData) {
            console.log('🛒 [PIX] Criando pedido automaticamente...')
            const createdOrder = await createOrderFromCart({ ...updated, cartData: updated.cartData })
            if (createdOrder) {
              order = { id: createdOrder.orderId, orderNumber: createdOrder.orderNumber }
              console.log('✅ [PIX] Pedido criado automaticamente:', createdOrder.orderNumber)
            }
          }

          return NextResponse.json({
            id: updated.id,
            status: 'PAID',
            paidAt: updated.paidAt,
            amount: Number(updated.amount),
            netAmount: Number(updated.netAmount),
            order,
            customer: pixCharge.Customer,
            autoCreatedOrder: !pixCharge.Order && order ? true : false,
          })
        }
      } catch (coraError) {
        console.error('⚠️ [PIX] Erro ao consultar Cora:', coraError)
        // Continua com o status local se erro no Cora
      }
    }

    // Retorna status atual
    return NextResponse.json({
      id: pixCharge.id,
      status: pixCharge.status,
      amount: Number(pixCharge.amount),
      netAmount: Number(pixCharge.netAmount),
      qrCode: pixCharge.qrCode,
      order: pixCharge.Order,
      customer: pixCharge.Customer,
    })
  } catch (error: any) {
    console.error('❌ [PIX STATUS] Erro:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao verificar status' },
      { status: 500 }
    )
  }
}
