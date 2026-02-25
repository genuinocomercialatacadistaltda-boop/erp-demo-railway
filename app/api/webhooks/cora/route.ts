
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * Webhook do Cora para notificações de pagamento
 * 
 * 💜 PIX INSTANTÂNEO: Processamento AUTOMÁTICO
 *    - Atualiza status para PAID
 *    - 🆕 CRIA PEDIDO AUTOMATICAMENTE se cliente fechou a página antes do polling detectar
 * 🏦 BOLETOS: Processamento MANUAL (somente LOG)
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔔 ============================================')
    console.log('🔔 WEBHOOK RECEBIDO DO CORA')
    console.log('🔔 Timestamp:', new Date().toISOString())
    console.log('🔔 ============================================')
    
    const body = await request.json()
    console.log('📦 Payload completo do webhook:', JSON.stringify(body, null, 2))

    // O Cora pode enviar diferentes estruturas de payload
    let invoiceId: string | undefined
    let eventType: string | undefined
    let paymentStatus: string | undefined

    // Formato 1: { event_type, invoice_id, status }
    if (body.invoice_id) {
      invoiceId = body.invoice_id
      eventType = body.event_type
      paymentStatus = body.status
    }
    // Formato 2: { id, type, data: { status } }
    else if (body.id && body.data) {
      invoiceId = body.id
      eventType = body.type
      paymentStatus = body.data.status
    }
    // Formato 3: nested invoice { invoice: { id, status }, event }
    else if (body.invoice) {
      invoiceId = body.invoice.id
      eventType = body.event
      paymentStatus = body.invoice.status
    }

    console.log('📋 Dados extraídos:')
    console.log('   invoice_id:', invoiceId)
    console.log('   event_type:', eventType)
    console.log('   status:', paymentStatus)

    // Verificar se é um evento de pagamento
    const isPaidEvent = 
      eventType?.toLowerCase().includes('paid') || 
      paymentStatus?.toUpperCase() === 'PAID' ||
      eventType?.toLowerCase().includes('payment')

    if (!isPaidEvent) {
      console.log('⚠️ Evento ignorado (não é pagamento):', eventType || paymentStatus)
      return NextResponse.json({ message: 'Evento ignorado' }, { status: 200 })
    }

    if (!invoiceId) {
      console.log('⚠️ Invoice ID não encontrado no payload')
      return NextResponse.json({ message: 'Invoice ID não encontrado' }, { status: 200 })
    }

    // 💜 VERIFICAR SE É PIX INSTANTÂNEO (checkout)
    const pixCharge = await prisma.pixCharge.findFirst({
      where: { coraInvoiceId: invoiceId },
      include: {
        Order: { select: { id: true, orderNumber: true } },
        Customer: { select: { id: true, name: true, cpfCnpj: true } },
      },
    })

    if (pixCharge) {
      console.log('💜 ============================================')
      console.log('💜 PIX INSTANTÂNEO - PROCESSAMENTO AUTOMÁTICO')
      console.log('💜 ============================================')
      console.log('   ID:', pixCharge.id)
      console.log('   Código:', pixCharge.code)
      console.log('   Valor: R$', Number(pixCharge.amount).toFixed(2))
      console.log('   Taxa: R$', Number(pixCharge.feeAmount).toFixed(2))
      console.log('   Líquido: R$', Number(pixCharge.netAmount).toFixed(2))
      console.log('   Cliente:', pixCharge.customerName || pixCharge.Customer?.name || 'N/A')
      console.log('   Pedido vinculado:', pixCharge.Order?.orderNumber || 'NENHUM')
      console.log('   Status atual:', pixCharge.status)
      console.log('   CartData presente:', pixCharge.cartData ? 'SIM' : 'NÃO')

      // Atualizar status para PAID se ainda não estiver
      if (pixCharge.status !== 'PAID') {
        await prisma.pixCharge.update({
          where: { id: pixCharge.id },
          data: {
            status: 'PAID',
            paidAt: new Date(),
          },
        })
        console.log('💜 ✅ PIX atualizado para PAID!')
      } else {
        console.log('💜 ℹ️ PIX já estava marcado como PAID')
      }

      // 🆕 CRIAR PEDIDO AUTOMATICAMENTE SE NÃO EXISTE
      // Isso acontece quando o cliente fecha a página antes do polling detectar o pagamento
      if (!pixCharge.orderId && pixCharge.cartData) {
        console.log('🛒 ============================================')
        console.log('🛒 CRIANDO PEDIDO AUTOMATICAMENTE (cliente fechou a página)')
        console.log('🛒 ============================================')
        
        try {
          const cartData = pixCharge.cartData as any
          
          // Gerar número do pedido
          const orderNumber = `ESP${Math.floor(10000000 + Math.random() * 90000000)}`
          
          // Calcular totais
          let subtotal = 0
          const orderItems: any[] = []
          
          for (const item of cartData.items || []) {
            const product = await prisma.product.findUnique({
              where: { id: item.productId },
              select: { id: true, name: true, priceWholesale: true }
            })
            
            if (product) {
              const unitPrice = item.price || Number(product.priceWholesale)
              const itemTotal = unitPrice * item.quantity
              subtotal += itemTotal
              
              orderItems.push({
                productId: product.id,
                quantity: item.quantity,
                unitPrice: unitPrice,
                total: itemTotal
              })
            }
          }
          
          const deliveryFee = cartData.deliveryFee || 0
          const couponDiscount = cartData.couponDiscount || 0
          const total = subtotal + deliveryFee - couponDiscount
          
          console.log('   Items:', orderItems.length)
          console.log('   Subtotal: R$', subtotal.toFixed(2))
          console.log('   Taxa entrega: R$', deliveryFee.toFixed(2))
          console.log('   Desconto cupom: R$', couponDiscount.toFixed(2))
          console.log('   Total: R$', total.toFixed(2))
          
          const customerId = cartData.customerId || pixCharge.customerId
          
          // Criar o pedido
          const order = await prisma.order.create({
            data: {
              id: crypto.randomUUID(),
              orderNumber,
              customerId: customerId || null,
              customerName: cartData.customerData?.name || pixCharge.customerName || 'Cliente',
              customerPhone: cartData.customerData?.phone || null,
              customerEmail: cartData.customerData?.email || null,
              address: cartData.customerData?.address || null,
              city: cartData.customerData?.city || null,
              orderType: cartData.orderType || 'WHOLESALE',
              deliveryType: cartData.deliveryType || 'PICKUP',
              deliveryDate: cartData.deliveryDate ? new Date(cartData.deliveryDate) : null,
              deliveryTime: cartData.deliveryTime || null,
              paymentMethod: 'PIX',
              subtotal,
              discount: couponDiscount,
              total,
              status: 'CONFIRMED',
              notes: cartData.notes || `Pedido criado automaticamente via webhook - PIX pago`,
              couponCode: cartData.couponCode || null,
              couponDiscount: couponDiscount,
              createdByUserId: pixCharge.createdBy || null,
              updatedAt: new Date(),
              OrderItem: {
                create: orderItems.map((item: any) => ({
                  id: crypto.randomUUID(),
                  productId: item.productId,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  total: item.total
                }))
              }
            }
          })
          
          console.log('✅ Pedido criado:', order.orderNumber)
          
          // Vincular o PIX ao pedido
          await prisma.pixCharge.update({
            where: { id: pixCharge.id },
            data: { orderId: order.id }
          })
          
          console.log('✅ PIX vinculado ao pedido')
          
          // Criar receivable como PAID (já foi pago via PIX)
          if (customerId) {
            await prisma.receivable.create({
              data: {
                id: crypto.randomUUID(),
                customerId: customerId,
                orderId: order.id,
                amount: total,
                netAmount: Number(pixCharge.netAmount),
                paymentMethod: 'PIX',
                status: 'PAID',
                dueDate: new Date(),
                description: `Pedido ${orderNumber} - PIX`
              }
            })
            console.log('✅ Receivable criado como PAID')
          }
          
          console.log('🛒 ============================================')
          
          return NextResponse.json({ 
            message: 'PIX processado e PEDIDO CRIADO automaticamente',
            mode: 'AUTO_PIX_WITH_ORDER',
            pixChargeId: pixCharge.id,
            orderNumber: order.orderNumber,
            orderId: order.id
          }, { status: 200 })
          
        } catch (orderError: any) {
          console.error('❌ Erro ao criar pedido automaticamente:', orderError)
          // Não falha o webhook, apenas loga o erro
          // O PIX já foi marcado como pago, então o pedido pode ser verificado manualmente
        }
      }

      console.log('💜 ============================================')

      return NextResponse.json({ 
        message: 'PIX processado automaticamente',
        mode: 'AUTO_PIX',
        pixChargeId: pixCharge.id,
      }, { status: 200 })
    }

    // 🏦 BOLETO - Apenas LOG (processamento manual)
    const boleto = await prisma.boleto.findFirst({
      where: { pixPaymentId: invoiceId },
      include: { Customer: true, Order: true }
    })

    if (boleto) {
      console.log('📝 ============================================')
      console.log('📝 BOLETO - PROCESSAR MANUALMENTE')
      console.log('📝 ============================================')
      console.log('   Boleto:', boleto.boletoNumber)
      console.log('   Cliente:', boleto.Customer?.name)
      console.log('   Valor: R$', Number(boleto.amount).toFixed(2))
      console.log('   Pedido:', boleto.Order?.orderNumber || 'N/A')
      console.log('   Status atual no sistema:', boleto.status)
      console.log('📝 ============================================')
      console.log('⚠️ AÇÃO NECESSÁRIA: Dar entrada manual no financeiro!')
      console.log('📝 ============================================')
    } else {
      console.log('⚠️ Nenhum registro encontrado para invoice_id:', invoiceId)
    }

    return NextResponse.json({ 
      message: 'Webhook recebido - processamento manual necessário',
      mode: 'LOG_ONLY'
    }, { status: 200 })

  } catch (error) {
    console.error('❌ Erro ao processar webhook do Cora:', error)
    return NextResponse.json(
      { error: 'Erro ao processar webhook' },
      { status: 500 }
    )
  }
}

// GET para testar se o endpoint está funcionando
export async function GET() {
  return NextResponse.json({ 
    message: 'Webhook do Cora está ativo',
    endpoint: '/api/webhooks/cora',
    method: 'POST'
  })
}
