export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { addPointsForOrder } from '@/lib/rewards'
// import { sendWhatsAppNotification } from '@/lib/whatsapp'
import { randomUUID } from 'crypto'
import { productSelect } from '@/lib/product-select'

// API para pedidos de ATACADO SEM CADASTRO (cliente avulso) E CLIENTES VAREJO COM CADASTRO
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      items,
      customerData,
      customerId, // 🎯 ID do cliente se estiver logado
      orderType, // 'WHOLESALE_CASUAL'
      deliveryType, // 'DELIVERY' or 'PICKUP'
      deliveryDate, // 🆕 Data de entrega
      deliveryTime, // 🆕 Horário de entrega
      paymentMethod,
      notes,
      totalAmount,
      // 🎟️ CUPOM DE DESCONTO
      couponId,
      couponCode,
      couponDiscount
    } = body

    console.log('📦 [WHOLESALE_CASUAL] Criando pedido:', {
      items: items?.length,
      customerData,
      customerId: customerId || 'Sem cadastro',
      orderType,
      deliveryType,
      paymentMethod,
      couponCode: couponCode || 'Nenhum',
      couponDiscount: couponDiscount || 0
    })

    // Validações básicas
    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum item no pedido' },
        { status: 400 }
      )
    }

    if (!customerData?.name || !customerData?.phone) {
      return NextResponse.json(
        { error: 'Nome e telefone do cliente são obrigatórios' },
        { status: 400 }
      )
    }

    if (!paymentMethod) {
      return NextResponse.json(
        { error: 'Método de pagamento é obrigatório' },
        { status: 400 }
      )
    }

    // Validar quantidade mínima de espetos (25)
    const totalEspetos = items.reduce((sum: number, item: any) => sum + item.quantity, 0)
    if (totalEspetos < 25) {
      return NextResponse.json(
        { error: `Pedido mínimo de 25 espetos. Você tem ${totalEspetos}.` },
        { status: 400 }
      )
    }

    // 🆕 CORREÇÃO: Se não tem customerId, tentar encontrar cliente pelo telefone ou email
    let resolvedCustomerId = customerId
    if (!resolvedCustomerId && customerData) {
      const phoneClean = customerData.phone?.replace(/\D/g, '') || ''
      const emailLower = customerData.email?.toLowerCase().trim() || ''
      
      // Buscar cliente existente por telefone ou email
      const existingCustomer = await prisma.customer.findFirst({
        where: {
          OR: [
            phoneClean ? { phone: { contains: phoneClean } } : {},
            emailLower ? { email: { equals: emailLower, mode: 'insensitive' as const } } : {}
          ].filter(condition => Object.keys(condition).length > 0)
        },
        select: { id: true, name: true }
      })
      
      if (existingCustomer) {
        resolvedCustomerId = existingCustomer.id
        console.log(`🔗 [WHOLESALE_CASUAL] Cliente existente encontrado! ${existingCustomer.name} (${existingCustomer.id})`)
      } else {
        console.log(`⚠️ [WHOLESALE_CASUAL] Nenhum cliente encontrado para telefone: ${phoneClean} ou email: ${emailLower}`)
      }
    }

    // Gerar número do pedido
    const orderNumber = `ATAC${Date.now().toString().slice(-8)}`

    // Buscar produtos para validar preços
    const productIds = items.map((item: any) => item.productId)
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds }
      },
      select: productSelect
    })

    // Calcular total e preparar itens
    let subtotal = 0
    const orderItems = items.map((item: any) => {
      const product = products.find(p => p.id === item.productId)
      if (!product) {
        throw new Error(`Produto não encontrado: ${item.productId}`)
      }

      // Determinar preço base (atacado)
      const basePrice = Number(product.priceWholesale)
      
      // Aplicar desconto progressivo se configurado e quantidade atingir o mínimo
      let unitPrice: number
      if (product.bulkDiscountMinQty && product.bulkDiscountPrice && item.quantity >= product.bulkDiscountMinQty) {
        unitPrice = Number(product.bulkDiscountPrice)
        console.log(`💰 Desconto progressivo aplicado! Produto: ${product.name}, Qtd: ${item.quantity} >= ${product.bulkDiscountMinQty}, Preço: R$ ${basePrice.toFixed(2)} → R$ ${unitPrice.toFixed(2)}`)
      } else {
        unitPrice = basePrice
      }
      
      const itemTotal = unitPrice * item.quantity
      subtotal += itemTotal

      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        total: itemTotal
      }
    })

    console.log('💰 Subtotal calculado:', subtotal)

    // 🎟️ Aplicar desconto de cupom se fornecido
    const finalCouponDiscount = couponDiscount ? Number(couponDiscount) : 0
    const finalTotal = subtotal - finalCouponDiscount

    console.log('🎟️ [CUPOM] Desconto aplicado:', {
      subtotal,
      couponDiscount: finalCouponDiscount,
      total: finalTotal
    })

    // Criar pedido no banco
    const orderId = randomUUID()
    const now = new Date()
    
    // 🆕 Calcular deliveryDate: usa a data informada ou a data atual (hoje)
    // Usa T12:00:00.000Z para evitar problemas de fuso horário
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const finalDeliveryDate = deliveryDate 
      ? new Date(deliveryDate + 'T12:00:00.000Z')
      : new Date(todayStr + 'T12:00:00.000Z')
    
    console.log('📅 [WHOLESALE_CASUAL] Data de entrega:', {
      informada: deliveryDate || 'não informada (usando hoje)',
      calculada: finalDeliveryDate.toISOString()
    })
    
    // 🎯 Preparar dados do pedido baseado em se há customerId
    const orderCreateData: any = {
      id: orderId,
      orderNumber,
      orderType: 'WHOLESALE', // Tipo base é WHOLESALE
      deliveryType: deliveryType || 'DELIVERY',
      deliveryDate: finalDeliveryDate, // 🆕 Data de entrega (sempre preenchida)
      deliveryTime: deliveryTime || undefined, // 🆕 Horário de entrega
      paymentMethod,
      status: 'PENDING',
      paymentStatus: 'UNPAID',
      subtotal,
      discount: 0, // Desconto normal (mantém 0 para cliente avulso)
      // 🎟️ CUPOM DE DESCONTO
      couponId: couponId || undefined,
      couponCode: couponCode || undefined,
      couponDiscount: finalCouponDiscount,
      total: finalTotal,
      updatedAt: now,
      // Armazenar dados básicos do cliente no pedido
      customerName: customerData.name,
      customerPhone: customerData.phone,
      customerEmail: customerData.email || undefined,
      address: customerData.address || undefined,
      city: customerData.city || undefined,
      OrderItem: {
        create: orderItems.map(item => ({
          id: randomUUID(),
          ...item
        }))
      }
    }

    // 🎯 Se há customerId (original ou encontrado), vincular pedido ao cliente
    if (resolvedCustomerId) {
      orderCreateData.customerId = resolvedCustomerId
      orderCreateData.createdByRole = 'CUSTOMER' // 🎯 Necessário para acúmulo de pontos
      orderCreateData.notes = notes || `Pedido Varejo - Cliente: ${customerData.name}`
      console.log('🎯 Pedido vinculado ao cliente:', resolvedCustomerId)
    } else {
      orderCreateData.notes = notes || `PEDIDO ATACADO SEM CADASTRO - Cliente: ${customerData.name}`
      console.log('📦 Pedido sem vínculo de cliente (sem cadastro)')
    }
    
    const order = await prisma.order.create({
      data: orderCreateData,
      include: {
        OrderItem: {
          include: {
            Product: true
          }
        }
      }
    })

    console.log('✅ Pedido criado com sucesso:', order.id, order.orderNumber)

    // 🆕 CORREÇÃO: SEMPRE criar receivable para controle financeiro
    // Isso estava faltando e causava pedidos sem registro em contas a receber!
    try {
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 7) // Vencimento padrão de 7 dias para atacado sem cadastro
      
      // Mapear método de pagamento
      const paymentMethodMap: Record<string, string> = {
        'PIX': 'PIX',
        'Cartão': 'CARD',
        'Cartão de Crédito': 'CREDIT_CARD',
        'Cartão de Débito': 'DEBIT',
        'CARD': 'CARD',
        'CREDIT_CARD': 'CREDIT_CARD',
        'DEBIT': 'DEBIT',
        'CASH': 'CASH',
        'Dinheiro': 'CASH'
      }
      
      const mappedPaymentMethod = paymentMethodMap[paymentMethod] || paymentMethod
      
      // Para cartão, receivable fica PENDING até o dinheiro cair
      // Para PIX/Dinheiro de cliente sem cadastro, também fica PENDING (precisa confirmar manualmente)
      const receivableStatus = 'PENDING'
      
      await prisma.receivable.create({
        data: {
          id: randomUUID(),
          customerId: resolvedCustomerId || null, // 🔧 Usa o ID resolvido (encontrado ou original)
          orderId: order.id,
          boletoId: null,
          description: `Pedido #${order.orderNumber} - ${customerData.name}`,
          amount: finalTotal,
          dueDate: dueDate,
          paymentDate: null,
          status: receivableStatus,
          paymentMethod: mappedPaymentMethod,
          bankAccountId: null, // Será preenchido quando der baixa
          createdBy: null, // Pedido feito pelo cliente
        }
      })
      
      console.log(`✅ Receivable criado para pedido ${order.orderNumber} - Valor: R$ ${finalTotal.toFixed(2)} - Método: ${mappedPaymentMethod}`)
    } catch (receivableError) {
      console.error('❌ Erro ao criar receivable:', receivableError)
      // Não falhar o pedido se a criação do receivable falhar
    }

    // 🎯 Adicionar pontos se o pedido foi feito por um cliente (logado ou identificado)
    if (resolvedCustomerId && order.createdByRole === 'CUSTOMER') {
      try {
        console.log('🎯 Tentando adicionar pontos...', {
          orderId: order.id,
          customerId: resolvedCustomerId,
          total: finalTotal,
          createdByRole: order.createdByRole
        })
        
        await addPointsForOrder(
          order.id,
          resolvedCustomerId,
          finalTotal,
          order.createdByRole
        )
        
        console.log('🎉 Pontos adicionados com sucesso!')
      } catch (pointsError) {
        console.error('❌ Erro ao adicionar pontos:', pointsError)
        // Não falhar o pedido se a adição de pontos falhar
      }
    } else {
      console.log('⚠️ Pontos não adicionados:', {
        customerId: resolvedCustomerId || 'Não informado',
        createdByRole: order.createdByRole || 'Não definido',
        razao: !resolvedCustomerId ? 'Cliente sem cadastro' : 'createdByRole diferente de CUSTOMER'
      })
    }

    // 🎟️ Incrementar contador de uso do cupom se foi usado
    if (couponId) {
      try {
        await prisma.coupon.update({
          where: { id: couponId },
          data: {
            usageCount: { increment: 1 }
          }
        })
        console.log('🎟️ [CUPOM] Contador de uso incrementado:', couponCode)
      } catch (couponError) {
        console.error('❌ [CUPOM] Erro ao incrementar contador:', couponError)
        // Não falhar o pedido se a atualização do cupom falhar
      }
    }

    // Enviar notificação WhatsApp (opcional) - DESABILITADO
    // Usar /admin/whatsapp para enviar mensagens manualmente
    /*
    try {
      const itemsText = order.OrderItem.map(
        (item: any) => `${item.quantity}x ${item.Product.name}`
      ).join('\n')

      await sendWhatsAppNotification({
        orderNumber: order.orderNumber,
        customerName: customerData.name,
        customerPhone: customerData.phone,
        total: subtotal.toFixed(2),
        orderType: 'ATACADO SEM CADASTRO',
        deliveryType: deliveryType === 'DELIVERY' ? 'Entrega' : 'Retirada',
        items: itemsText
      })
    } catch (whatsappError) {
      console.error('❌ Erro ao enviar notificação WhatsApp:', whatsappError)
      // Não falhar o pedido se WhatsApp falhar
    }
    */

    // Serializar resposta
    const serializedOrder = {
      ...order,
      subtotal: Number(order.subtotal),
      discount: Number(order.discount),
      couponDiscount: order.couponDiscount ? Number(order.couponDiscount) : 0,
      couponCode: order.couponCode || null,
      couponId: order.couponId || null,
      total: Number(order.total),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      deliveryDate: order.deliveryDate?.toISOString() || null,
      OrderItem: order.OrderItem.map((item: any) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
        Product: {
          ...item.Product,
          priceWholesale: Number(item.Product.priceWholesale),
          priceRetail: Number(item.Product.priceRetail),
          bulkDiscountMinQty: item.Product.bulkDiscountMinQty || null,
          bulkDiscountPrice: item.Product.bulkDiscountPrice ? Number(item.Product.bulkDiscountPrice) : null
        }
      }))
    }

    return NextResponse.json(serializedOrder)
  } catch (error) {
    console.error('❌ Erro ao criar pedido atacado sem cadastro:', error)
    return NextResponse.json(
      { error: 'Falha ao criar pedido' },
      { status: 500 }
    )
  }
}
