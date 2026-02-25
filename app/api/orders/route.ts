
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { authOptions } from '@/lib/auth-options'
// import { sendWhatsAppNotification } from '@/lib/whatsapp'
// ATENÇÃO: Apenas CORA é usado para gerar boletos
import { createPixCharge, isCoraConfigured } from '@/lib/cora'
import { addPointsForOrder } from '@/lib/rewards'
import { productSelect } from '@/lib/product-select'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    // 🆕 Paginação
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    console.log(`📋 [ORDERS_GET] Buscando pedidos - Página: ${page}, Limite: ${limit}`)

    let whereClause = {}

    if (user?.userType === 'CUSTOMER') {
      // Customer can only see their own orders
      whereClause = { customerId: user.customerId }
    }
    // Admin can see all orders (no where clause)

    // 🆕 Query otimizada com paginação e select específico
    const [orders, totalCount] = await Promise.all([
      prisma.order.findMany({
        where: whereClause,
        select: {
          id: true,
          orderNumber: true,
          orderType: true,
          deliveryType: true,
          deliveryDate: true,
          deliveryTime: true,
          paymentMethod: true,
          status: true,
          paymentStatus: true,
          subtotal: true,
          discount: true,
          couponDiscount: true,
          discountPercent: true,
          total: true,
          createdAt: true,
          updatedAt: true,
          customerId: true,
          sellerId: true,
          userId: true,
          couponId: true,
          // 🔧 CORREÇÃO: Incluir campos do pedido para busca funcionar
          customerName: true,
          casualCustomerName: true,
          customerPhone: true,
          customerEmail: true,
          address: true,
          city: true,
          Customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              city: true
            }
          },
          User: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          Seller: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          Coupon: {
            select: {
              id: true,
              code: true,
              description: true,
              discountType: true,
              discountValue: true
            }
          },
          OrderItem: {
            select: {
              id: true,
              quantity: true,
              unitPrice: true,
              total: true,
              productId: true,
              Product: {
                select: {
                  id: true,
                  name: true,
                  priceWholesale: true,
                  priceRetail: true
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit,
        skip: skip
      }),
      prisma.order.count({ where: whereClause })
    ])

    console.log(`✅ [ORDERS_GET] ${orders.length} pedidos encontrados de ${totalCount} total`)

    // Serialize the orders
    const serializedOrders = orders.map((order: any) => ({
      ...order,
      subtotal: Number(order.subtotal),
      discount: Number(order.discount),
      couponDiscount: Number(order.couponDiscount || 0),
      discountPercent: Number(order.discountPercent || 0),
      total: Number(order.total),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      deliveryDate: order.deliveryDate?.toISOString() || null,
      // 🔧 CORREÇÃO: Usar campos do Order primeiro, depois fallback para Customer
      customerName: order.customerName || order.casualCustomerName || order.Customer?.name || 'Cliente não identificado',
      casualCustomerName: order.casualCustomerName || null,
      customerPhone: order.customerPhone || order.Customer?.phone || null,
      customerEmail: order.customerEmail || order.Customer?.email || null,
      city: order.city || order.Customer?.city || null,
      address: order.address || null,
      // 🎟️ Incluir dados do cupom se existir
      coupon: order.Coupon ? {
        id: order.Coupon.id,
        code: order.Coupon.code,
        description: order.Coupon.description,
        discountType: order.Coupon.discountType,
        discountValue: Number(order.Coupon.discountValue)
      } : null,
      OrderItem: order.OrderItem?.map((item: any) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
        product: {
          ...item.Product,
          priceWholesale: Number(item.Product?.priceWholesale || 0),
          priceRetail: Number(item.Product?.priceRetail || 0)
        }
      }))
    }))

    // 🆕 Retornar com metadados de paginação
    return NextResponse.json({
      orders: serializedOrders,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + orders.length < totalCount
      }
    })
  } catch (error) {
    console.error('Error fetching Order:', error)
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      items,
      customerData,
      orderType, // 'WHOLESALE' or 'RETAIL'
      deliveryType, // 'DELIVERY' or 'PICKUP'
      deliveryDate,
      deliveryTime,
      paymentMethod,
      secondaryPaymentMethod, // Para pagamento combinado
      primaryPaymentAmount, // Valor pago com método primário
      secondaryPaymentAmount, // Valor pago com método secundário
      boletoInstallments, // Número de parcelas do boleto (null, 2 ou 4)
      coraAccount, // 🏦 Conta Cora selecionada (ESPETOS ou GENUINO)
      couponId, // ID do cupom aplicado
      couponCode, // Código do cupom aplicado
      couponDiscount, // Valor do desconto do cupom
      exemptCardFee, // ⚠️ NOVO: Isentar taxa do cartão para este pedido
      casualCustomerName, // 🆕 Nome do cliente avulso
      bankAccountId, // 🆕 ID da conta bancária para registrar pagamento imediato
      isAlreadyPaid, // 🆕 CRÍTICO: Checkbox "Já pago?" do checkout - controla se receivable vai para PAID ou PENDING
      pixChargeId, // 💜 ID da cobrança PIX confirmada
      pixPaid, // 💜 Flag indicando que foi pago via PIX
      notes
    } = body

    // 🔍 DEBUG: Log do coraAccount recebido
    console.log('🏦🏦🏦 [ORDERS API] coraAccount recebido do frontend:', coraAccount);
    console.log('🏦🏦🏦 [ORDERS API] paymentMethod:', paymentMethod);
    console.log('🏦🏦🏦 [ORDERS API] body.coraAccount:', body.coraAccount);
    console.log('🏦🏦🏦 [ORDERS API] pixChargeId:', pixChargeId);
    console.log('🏦🏦🏦 [ORDERS API] pixPaid:', pixPaid);

    // 💜 Se tem pixChargeId, forçar paymentMethod para PIX
    let finalPaymentMethod = paymentMethod
    if (pixChargeId && pixPaid && !paymentMethod) {
      console.log('💜 [ORDERS API] PIX confirmado mas paymentMethod vazio - forçando para PIX')
      finalPaymentMethod = 'PIX'
    }
    
    // Usar finalPaymentMethod em todo o restante do código
    const effectivePaymentMethod = finalPaymentMethod

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'No items in order' },
        { status: 400 }
      )
    }

    if (!customerData?.name || !finalPaymentMethod) {
      return NextResponse.json(
        { error: 'Missing required customer data or payment method' },
        { status: 400 }
      )
    }

    // Generate order number
    const orderNumber = `ESP${Date.now().toString().slice(-8)}`

    // Calculate totals
    let subtotal = 0
    let discount = 0
    let cardFee = 0
    
    const session = await getServerSession(authOptions)
    const user = session?.user as any
    let customerId: string | null = null
    let customerInfo: any = null

    // Verificar se é pedido ATACADO (WHOLESALE)
    if (orderType === 'WHOLESALE') {
      // Se o cliente está logado, usar o ID dele
      if (user?.customerId) {
        customerId = user.customerId
      } 
      // Se admin está fazendo pedido para um cliente, usar o ID do customerData
      else if (customerData?.id) {
        customerId = customerData.id
      }

      // Buscar informações do cliente
      if (customerId) {
        customerInfo = await prisma.customer.findUnique({
          where: { id: customerId }
        })
        discount = customerInfo?.customDiscount || 0
        
        // VALIDAÇÃO: CONSUMIDOR FINAL não pode pagar depois
        if (customerInfo?.customerType === 'CONSUMIDOR_FINAL') {
          if (effectivePaymentMethod === 'BOLETO') {
            return NextResponse.json(
              { 
                error: 'Cliente "Consumidor Final" deve pagar na hora. Boleto não é permitido.',
                details: 'Este tipo de cliente não pode fazer pagamento posterior.'
              },
              { status: 400 }
            )
          }
        }
      }
    }

    // Fetch products to get prices (incluindo dados de promoção)
    const productIds = items.map((item: any) => item.productId)
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds }
      },
      select: {
        id: true,
        name: true,
        priceWholesale: true,
        priceRetail: true,
        isOnPromotion: true,
        promotionalPrice: true,
        isWeeklyPromotion: true,
        bulkDiscountMinQty: true,
        bulkDiscountPrice: true
      }
    })

    // Fetch custom prices if customer exists (seja logado ou selecionado pelo admin)
    let customPrices = new Map<string, number>()
    
    console.log(`\n🔍 [CUSTOM_PRICES] Verificando preços personalizados...`)
    console.log(`   customerId: ${customerId}`)
    console.log(`   orderType: ${orderType}`)
    console.log(`   productIds: ${JSON.stringify(productIds)}`)
    
    if (customerId) {
      const customerProducts = await prisma.customerProduct.findMany({
        where: {
          customerId,
          productId: { in: productIds }
        },
        include: { Product: { select: { name: true } } }
      })
      
      console.log(`   📋 CustomerProducts encontrados: ${customerProducts.length}`)
      
      customerProducts.forEach((cp: any) => {
        // Verificar se customPrice é um número válido (não nulo, não zero)
        const customPrice = Number(cp.customPrice)
        console.log(`   → ${cp.Product?.name}: customPrice=${cp.customPrice}, parsed=${customPrice}, isValid=${customPrice > 0}`)
        
        if (customPrice > 0) {
          customPrices.set(cp.productId, customPrice)
        }
      })
      
      console.log(`📋 Preços personalizados FINAIS para cliente ${customerInfo?.name}:`)
      if (customPrices.size > 0) {
        customPrices.forEach((price, productId) => {
          console.log(`   ✅ productId=${productId}: R$ ${price.toFixed(2)}`)
        })
      } else {
        console.log(`   ⚠️ Nenhum preço personalizado encontrado!`)
      }
    } else {
      console.log(`   ⚠️ Sem customerId - preços personalizados NÃO serão aplicados`)
    }

    const orderItems = items.map((item: any) => {
      const product = products.find(p => p.id === item.productId)
      if (!product) {
        throw new Error(`Product not found: ${item.productId}`)
      }

      // Determinar o preço base (atacado ou varejo)
      const basePrice = orderType === 'WHOLESALE' ? Number(product.priceWholesale) : Number(product.priceRetail)
      
      // 🏷️ NOVA LÓGICA: Promoção vale para TODOS os métodos EXCETO boleto
      // Cartão: promoção aplica, mas taxa de cartão é obrigatória (tratada no cálculo de fees)
      const isBoletoPayment = effectivePaymentMethod === 'BOLETO'
      
      const hasPromotion = (product as any).isOnPromotion && (product as any).promotionalPrice
      const customPrice = customPrices.get(item.productId)
      const hasBulkDiscount = product.bulkDiscountMinQty && product.bulkDiscountPrice && item.quantity >= product.bulkDiscountMinQty
      const bulkDiscountPrice = hasBulkDiscount ? Number(product.bulkDiscountPrice) : null
      
      let unitPrice: number
      
      // 🏷️ PRIORIDADE 1: PROMOÇÃO SEMPRE PREVALECE (exceto boleto)
      if (hasPromotion && !isBoletoPayment) {
        unitPrice = Number((product as any).promotionalPrice)
        if (customPrice) {
          console.log(`🏷️ PROMOÇÃO PREVALECE sobre catálogo personalizado! Produto: ${product.name}, Catálogo: R$ ${customPrice.toFixed(2)} → Promocional: R$ ${unitPrice.toFixed(2)}, Método: ${paymentMethod}`)
        } else {
          console.log(`🏷️ Promoção aplicada! Produto: ${product.name}, Base: R$ ${basePrice.toFixed(2)} → Promocional: R$ ${unitPrice.toFixed(2)}, Método: ${paymentMethod}`)
        }
      }
      // 🏷️ PRIORIDADE 2: MENOR PREÇO entre catálogo personalizado e desconto por quantidade
      else if (customPrice && hasBulkDiscount && bulkDiscountPrice) {
        // Usar o MENOR preço entre catálogo e desconto por quantidade
        if (bulkDiscountPrice < customPrice) {
          unitPrice = bulkDiscountPrice
          console.log(`💰 DESCONTO POR QUANTIDADE é MENOR que catálogo! Produto: ${product.name}, Catálogo: R$ ${customPrice.toFixed(2)} → Desconto: R$ ${unitPrice.toFixed(2)} (qtd ${item.quantity} >= ${product.bulkDiscountMinQty})`)
        } else {
          unitPrice = customPrice
          console.log(`📋 CATÁLOGO é MENOR/IGUAL ao desconto! Produto: ${product.name}, Desconto: R$ ${bulkDiscountPrice.toFixed(2)} → Catálogo: R$ ${unitPrice.toFixed(2)}`)
        }
      }
      // 🏷️ PRIORIDADE 3: Só catálogo personalizado (sem desconto por quantidade aplicável)
      else if (customPrice) {
        unitPrice = customPrice
        console.log(`📋 Preço do catálogo personalizado: ${product.name}, Preço: R$ ${unitPrice.toFixed(2)}`)
      }
      // 🏷️ PRIORIDADE 4: Só desconto progressivo por quantidade (sem catálogo)
      else if (hasBulkDiscount && bulkDiscountPrice) {
        unitPrice = bulkDiscountPrice
        console.log(`💰 Desconto progressivo aplicado! Produto: ${product.name}, Qtd: ${item.quantity} >= ${product.bulkDiscountMinQty}, Preço: R$ ${basePrice.toFixed(2)} → R$ ${unitPrice.toFixed(2)}`)
      } 
      // 🏷️ PRIORIDADE 5: Preço base (atacado ou varejo)
      else {
        unitPrice = basePrice
      }
      
      const itemTotal = unitPrice * item.quantity
      subtotal += itemTotal
      
      // 🔒 VALIDAÇÃO: Verificar se o preço calculado pelo backend bate com o esperado pelo frontend
      const expectedPrice = item.expectedUnitPrice
      if (expectedPrice !== undefined && Math.abs(unitPrice - expectedPrice) > 0.01) {
        console.error(`❌ DIFERENÇA DE PREÇO DETECTADA!`)
        console.error(`   Produto: ${product.name}`)
        console.error(`   Preço Frontend: R$ ${expectedPrice.toFixed(2)}`)
        console.error(`   Preço Backend: R$ ${unitPrice.toFixed(2)}`)
        console.error(`   Diferença: R$ ${Math.abs(unitPrice - expectedPrice).toFixed(2)}`)
        
        throw new Error(`PRICE_MISMATCH:${product.name}:${expectedPrice}:${unitPrice}`)
      }

      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        total: itemTotal
      }
    })

    const discountAmount = subtotal * (discount / 100)
    const couponDiscountAmount = couponDiscount ? Number(couponDiscount) : 0
    let total = subtotal - discountAmount - couponDiscountAmount

    // 🏷️ Verificar se tem item em promoção (taxa obrigatória se cartão + promoção)
    const hasPromotionalItem = orderItems.some((item: any) => {
      const product = products.find(p => p.id === item.productId)
      return (product as any)?.isOnPromotion && (product as any)?.promotionalPrice
    })
    const isCardPayment = effectivePaymentMethod === 'CREDIT_CARD' || effectivePaymentMethod === 'DEBIT'
    const forceCardFee = hasPromotionalItem && isCardPayment
    
    // Calculate card fee for wholesale if paying with card (unless exempted, but FORCE if promotional item + card)
    console.log(`💳 exemptCardFee: ${exemptCardFee}, orderType: ${orderType}, hasPromotionalItem: ${hasPromotionalItem}, forceCardFee: ${forceCardFee}`)
    
    if (orderType === 'WHOLESALE' && (!exemptCardFee || forceCardFee)) {
      if (effectivePaymentMethod === 'CREDIT_CARD') {
        cardFee = total * 0.035 // 3.5% para crédito
        total += cardFee
        console.log(`💳 Taxa de crédito aplicada: R$ ${cardFee.toFixed(2)}${forceCardFee ? ' (OBRIGATÓRIA por item promocional)' : ''}`)
      } else if (effectivePaymentMethod === 'DEBIT') {
        cardFee = total * 0.01 // 1% para débito
        total += cardFee
        console.log(`💳 Taxa de débito aplicada: R$ ${cardFee.toFixed(2)}${forceCardFee ? ' (OBRIGATÓRIA por item promocional)' : ''}`)
      }
      
      // Check secondary payment method for combined payment
      if (secondaryPaymentMethod) {
        if (secondaryPaymentMethod === 'CREDIT_CARD') {
          const secondaryFee = (secondaryPaymentAmount || 0) * 0.035
          cardFee += secondaryFee
          total += secondaryFee
          console.log(`💳 Taxa secundária de crédito aplicada: R$ ${secondaryFee.toFixed(2)}`)
        } else if (secondaryPaymentMethod === 'DEBIT') {
          const secondaryFee = (secondaryPaymentAmount || 0) * 0.01
          cardFee += secondaryFee
          total += secondaryFee
          console.log(`💳 Taxa secundária de débito aplicada: R$ ${secondaryFee.toFixed(2)}`)
        }
      }
    } else if (exemptCardFee && !forceCardFee) {
      console.log(`✅ Taxa de cartão ISENTADA para este pedido (exemptCardFee=true)`)
      cardFee = 0
    }

    // 🛡️ VALIDAÇÃO ANTI-DIVERGÊNCIA: Se PIX já foi pago, o total deve corresponder ao valor do PIX
    if (pixChargeId && pixPaid) {
      const pixChargeForValidation = await prisma.pixCharge.findUnique({
        where: { id: pixChargeId },
        select: { amount: true, status: true }
      })
      
      if (pixChargeForValidation) {
        const pixAmount = Number(pixChargeForValidation.amount)
        const tolerancia = 2.00 // R$ 2,00 de tolerância para taxas/arredondamentos
        const diferenca = Math.abs(total - pixAmount)
        
        console.log(`🛡️ [ANTI-DIVERGÊNCIA] Total calculado: R$ ${total.toFixed(2)} | PIX pago: R$ ${pixAmount.toFixed(2)} | Diferença: R$ ${diferenca.toFixed(2)}`)
        
        if (diferenca > tolerancia) {
          console.error(`❌ [ANTI-DIVERGÊNCIA] BLOQUEADO! Diferença de R$ ${diferenca.toFixed(2)} excede tolerância de R$ ${tolerancia.toFixed(2)}`)
          return NextResponse.json(
            { 
              error: `O valor do carrinho (R$ ${total.toFixed(2)}) é diferente do PIX pago (R$ ${pixAmount.toFixed(2)}). Por favor, gere um novo QR Code PIX com o valor atualizado.`,
              code: 'PIX_AMOUNT_MISMATCH',
              details: {
                totalCarrinho: total,
                totalPix: pixAmount,
                diferenca: diferenca
              }
            },
            { status: 400 }
          )
        }
        
        // Se diferença está dentro da tolerância, ajustar total para o valor do PIX
        if (diferenca > 0.01 && diferenca <= tolerancia) {
          console.log(`🛡️ [ANTI-DIVERGÊNCIA] Ajustando total de R$ ${total.toFixed(2)} para R$ ${pixAmount.toFixed(2)} (diferença de R$ ${diferenca.toFixed(2)} dentro da tolerância)`)
          total = pixAmount
        }
      }
    }

    // Map payment method from frontend to enum
    const paymentMethodMap: { [key: string]: string } = {
      'Dinheiro': 'CASH',
      'Cartão': 'CARD',
      'PIX': 'PIX',
      'Crédito (30 dias)': 'CREDIT',
      'CASH': 'CASH',
      'CARD': 'CARD',
      'CREDIT': 'CREDIT',
      'BOLETO': 'BOLETO',
      'DEBIT': 'DEBIT',
      'CREDIT_CARD': 'CREDIT_CARD'
    }
    
    const mappedPaymentMethod = paymentMethodMap[effectivePaymentMethod] || paymentMethod
    const mappedSecondaryPaymentMethod = secondaryPaymentMethod ? (paymentMethodMap[secondaryPaymentMethod] || secondaryPaymentMethod) : null

    // Validate combined payment amounts
    if (secondaryPaymentMethod) {
      const expectedTotal = (primaryPaymentAmount || 0) + (secondaryPaymentAmount || 0)
      if (Math.abs(expectedTotal - total) > 0.01) { // Allow small rounding differences
        return NextResponse.json(
          { error: 'Combined payment amounts do not match total' },
          { status: 400 }
        )
      }
    }

    // 🔧 Check if customer has overdue payments (boletos + receivables) - RESPECTING MANUAL UNBLOCK
    if (orderType === 'WHOLESALE' && customerId) {
      console.log('\n🔍 [ORDER_VALIDATION] Verificando status de pagamento do cliente:', customerId)
      
      // Buscar informações do cliente incluindo status de liberação manual
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          name: true,
          manuallyUnblocked: true,
          unblockedAt: true,
          unblockedBy: true
        }
      })
      
      if (customer?.manuallyUnblocked) {
        console.log('✅ [ORDER_VALIDATION] Cliente liberado manualmente - permitindo pedido')
        console.log(`   Data da liberação: ${customer.unblockedAt ? new Date(customer.unblockedAt).toLocaleString('pt-BR') : 'N/A'}`)
        console.log(`   Liberado por: ${customer.unblockedBy || 'N/A'}`)
        // Cliente foi liberado manualmente - permitir pedido mesmo com pendências
      } else {
        // Cliente NÃO foi liberado manualmente - verificar pendências
        console.log('⚠️ [ORDER_VALIDATION] Cliente NÃO está liberado manualmente - verificando pendências')
        
        // Calcular início do dia atual em Brasília (mesma lógica de payment-status)
        const now = new Date()
        const brasiliaTime = new Date(now.getTime() - (3 * 60 * 60 * 1000))
        const year = brasiliaTime.getUTCFullYear()
        const month = brasiliaTime.getUTCMonth()
        const day = brasiliaTime.getUTCDate()
        // 🔧 CORREÇÃO: Usar 00:00 UTC (início do dia), igual à API payment-status
        // Isso evita que boletos que vencem HOJE sejam considerados vencidos
        const brasiliaToday = new Date(Date.UTC(year, month, day, 0, 0, 0, 0))
        
        console.log(`   Data de referência (início de hoje em Brasília): ${brasiliaToday.toISOString()}`)
        
        // Verificar boletos vencidos
        const overdueBoletos = await prisma.boleto.findMany({
          where: {
            customerId,
            status: {
              in: ['PENDING', 'OVERDUE']
            },
            dueDate: {
              lt: brasiliaToday // Só considera vencido se for de ontem ou antes
            }
          }
        })
        
        // 🆕 Verificar receivables (contas a receber) pendentes e vencidos
        // ⚠️ IMPORTANTE: Ignora receivables que têm boletoId para evitar duplicidade (já contados via boletos)
        const overdueReceivables = await prisma.receivable.findMany({
          where: {
            customerId,
            boletoId: null, // 🔧 CORREÇÃO: Evita contar duas vezes (boleto + receivable)
            status: { in: ['PENDING', 'OVERDUE'] }, // 🔧 CORREÇÃO: Inclui OVERDUE também
            dueDate: {
              lt: brasiliaToday // Só considera vencido se for de ontem ou antes
            }
          }
        })
        
        console.log(`   Boletos vencidos: ${overdueBoletos.length}`)
        console.log(`   Receivables vencidos: ${overdueReceivables.length}`)
        
        const totalOverdueItems = overdueBoletos.length + overdueReceivables.length
        
        if (totalOverdueItems > 0) {
          const boletoAmount = overdueBoletos.reduce((sum: number, bol: any) => sum + Number(bol.amount), 0)
          const receivableAmount = overdueReceivables.reduce((sum: number, rec: any) => sum + Number(rec.amount), 0)
          const totalOverdueAmount = boletoAmount + receivableAmount
          
          console.log(`   ❌ [ORDER_VALIDATION] Cliente BLOQUEADO - Total vencido: R$ ${totalOverdueAmount.toFixed(2)}`)
          
          return NextResponse.json(
            { 
              error: `⚠️ Compra bloqueada! Você possui ${totalOverdueItems} pagamento(s) vencido(s) no valor total de R$ ${totalOverdueAmount.toFixed(2)}. Por favor, regularize sua situação antes de fazer novos pedidos.`,
              overdueBoletos: overdueBoletos.map((b: any) => ({
                boletoNumber: b.boletoNumber,
                amount: Number(b.amount),
                dueDate: b.dueDate.toISOString()
              })),
              overdueReceivables: overdueReceivables.map((r: any) => ({
                description: r.description,
                amount: Number(r.amount),
                dueDate: r.dueDate.toISOString()
              }))
            },
            { status: 400 }
          )
        }
        
        console.log('   ✅ [ORDER_VALIDATION] Nenhuma pendência vencida - permitindo pedido')
      }
    }

    // Check if using boleto or credit (notinha) and validate credit limit
    const usesCreditLimit = mappedPaymentMethod === 'BOLETO' || mappedPaymentMethod === 'CREDIT' ||
                            mappedSecondaryPaymentMethod === 'BOLETO' || mappedSecondaryPaymentMethod === 'CREDIT'

    if (usesCreditLimit) {
      if (!customerInfo) {
        return NextResponse.json(
          { error: 'Pagamento a crédito ou boleto disponível apenas para clientes cadastrados' },
          { status: 400 }
        )
      }

      // Calculate amount that will consume credit
      let creditAmount = 0
      if (mappedPaymentMethod === 'BOLETO' || mappedPaymentMethod === 'CREDIT') {
        creditAmount += (primaryPaymentAmount || total)
      }
      if (mappedSecondaryPaymentMethod === 'BOLETO' || mappedSecondaryPaymentMethod === 'CREDIT') {
        creditAmount += (secondaryPaymentAmount || 0)
      }
      
      if (customerInfo.availableCredit < creditAmount) {
        return NextResponse.json(
          { error: `Limite insuficiente. Disponível: R$ ${customerInfo.availableCredit.toFixed(2)}, Necessário: R$ ${creditAmount.toFixed(2)}` },
          { status: 400 }
        )
      }
    }

    // ============================================
    // PREPARAR DADOS DOS BOLETOS ANTES DA TRANSAÇÃO
    // ============================================
    let boletoDataList: any[] = []
    
    if (mappedPaymentMethod === 'BOLETO' || mappedSecondaryPaymentMethod === 'BOLETO') {
      const boletoAmount = mappedPaymentMethod === 'BOLETO' ? (primaryPaymentAmount || total) : (secondaryPaymentAmount || 0)
      
      // Validar configuração do Cora
      console.log('\n========================================')
      console.log('🔍 VERIFICANDO CONFIGURAÇÃO DO CORA')
      console.log('========================================')
      const useCoraForBoleto = isCoraConfigured()
      console.log('useCoraForBoleto:', useCoraForBoleto ? '✅ SIM - Usando CORA' : '❌ NÃO - ERRO: Cora não configurado!')
      
      if (!useCoraForBoleto) {
        console.error('❌ ERRO CRÍTICO: Cora não está configurado! Boletos não podem ser gerados.')
        return NextResponse.json(
          { error: 'Sistema de boletos não configurado. Entre em contato com o suporte.' },
          { status: 500 }
        )
      }
      
      // Validar CPF/CNPJ do cliente
      if (!customerInfo?.cpfCnpj || customerInfo.cpfCnpj.trim() === '') {
        return NextResponse.json(
          { error: `Cliente ${customerData.name} não possui CPF/CNPJ cadastrado. O CPF/CNPJ é obrigatório para gerar boletos.` },
          { status: 400 }
        )
      }
      
      const cpfCnpj = customerInfo.cpfCnpj.replace(/\D/g, '')
      if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
        return NextResponse.json(
          { error: `CPF/CNPJ inválido para o cliente ${customerData.name}. O CPF deve ter 11 dígitos e o CNPJ 14 dígitos.` },
          { status: 400 }
        )
      }
      
      // Preparar boletos
      if (boletoInstallments) {
        const parts = boletoInstallments.split('x-')
        if (parts.length === 2) {
          const numInstallments = parseInt(parts[0])
          const daysString = parts[1]
          const daysList = daysString.split('-').map((d: string) => parseInt(d))
          
          if (numInstallments > 0 && daysList.length === numInstallments) {
            const installmentAmount = boletoAmount / numInstallments
            
            for (let i = 0; i < numInstallments; i++) {
              // 🔧 CORREÇÃO CRÍTICA: Vencimento conta da data de ENTREGA, não do pedido
              const date = new Date(deliveryDate || new Date())
              date.setDate(date.getDate() + daysList[i])
              
              boletoDataList.push({
                boletoNumber: `BOL${Date.now().toString().slice(-8)}-${i + 1}`,
                amount: installmentAmount,
                dueDate: date,
                isInstallment: true,
                installmentNumber: i + 1,
                totalInstallments: numInstallments
              })
              
              await new Promise(resolve => setTimeout(resolve, 10))
            }
          } else {
            // 🔧 CORREÇÃO CRÍTICA: Vencimento conta da data de ENTREGA, não do pedido
            const date = new Date(deliveryDate || new Date())
            date.setDate(date.getDate() + (customerInfo?.paymentTerms || 30))
            boletoDataList.push({
              boletoNumber: `BOL${Date.now().toString().slice(-8)}`,
              amount: boletoAmount,
              dueDate: date,
              isInstallment: false
            })
          }
        } else {
          // 🔧 CORREÇÃO CRÍTICA: Vencimento conta da data de ENTREGA, não do pedido
          const date = new Date(deliveryDate || new Date())
          date.setDate(date.getDate() + (customerInfo?.paymentTerms || 30))
          boletoDataList.push({
            boletoNumber: `BOL${Date.now().toString().slice(-8)}`,
            amount: boletoAmount,
            dueDate: date,
            isInstallment: false
          })
        }
      } else {
        // 🔧 CORREÇÃO CRÍTICA: Vencimento conta da data de ENTREGA, não do pedido
        const date = new Date(deliveryDate || new Date())
        date.setDate(date.getDate() + (customerInfo?.paymentTerms || 30))
        boletoDataList.push({
          boletoNumber: `BOL${Date.now().toString().slice(-8)}`,
          amount: boletoAmount,
          dueDate: date,
          isInstallment: false
        })
      }
      
      // GERAR BOLETOS NO CORA ANTES DA TRANSAÇÃO
      console.log('\n🔄 Gerando boletos no Cora...')
      
      // 🔧 Validar valor mínimo do Cora (R$ 5,00 = 500 centavos)
      for (const boletoData of boletoDataList) {
        if (Number(boletoData.amount) < 5.00) {
          return NextResponse.json(
            { 
              error: `Valor mínimo para boleto é R$ 5,00. O valor do pedido (R$ ${Number(boletoData.amount).toFixed(2)}) é inferior ao mínimo permitido pelo banco. Por favor, escolha outro método de pagamento ou adicione mais itens ao pedido.`
            },
            { status: 400 }
          )
        }
      }
      
      for (const boletoData of boletoDataList) {
        try {
          let description = `Pedido #${orderNumber}`
          if (boletoData.isInstallment) {
            description += ` - Parcela ${boletoData.installmentNumber}/${boletoData.totalInstallments}`
          }
          
          const dueDateFormatted = boletoData.dueDate.toISOString().split('T')[0]
          
          console.log(`🏦 Gerando boleto na conta Cora: ${coraAccount || 'GENUINO'}`)
          const coraResult = await createPixCharge({
            code: boletoData.boletoNumber,
            customerName: customerData.name,
            customerDocument: cpfCnpj,
            customerEmail: customerData.email || customerInfo?.email,
            amount: Math.round(Number(boletoData.amount) * 100),
            dueDate: dueDateFormatted,
            description,
            account: coraAccount || 'GENUINO' // 🏦 Conta Cora selecionada (padrão: GENUINO)
          })
          
          // Gerar QR Code
          let qrCodeBase64 = null
          if (coraResult.qr_code) {
            try {
              const QRCode = require('qrcode')
              const qrCodeDataUrl = await QRCode.toDataURL(coraResult.qr_code, {
                errorCorrectionLevel: 'M',
                type: 'image/png',
                width: 300,
                margin: 2
              })
              qrCodeBase64 = qrCodeDataUrl.split(',')[1]
            } catch (qrError) {
              console.error('❌ Erro ao gerar QR Code:', qrError)
            }
          }
          
          // Adicionar dados do Cora ao boletoData
          boletoData.pixQrCode = coraResult.qr_code || null
          boletoData.pixQrCodeBase64 = qrCodeBase64
          boletoData.pixPaymentId = coraResult.id || null
          boletoData.barcodeNumber = coraResult.barcode || null
          boletoData.digitableLine = coraResult.digitable_line || null
          boletoData.boletoUrl = coraResult.qr_code_image || null
          
          console.log(`✅ Boleto gerado no Cora: ${boletoData.boletoNumber}`)
        } catch (coraError: any) {
          console.error(`❌ Erro ao gerar boleto no Cora:`, coraError)
          return NextResponse.json(
            { error: `Falha ao gerar boleto: ${coraError?.message || 'Erro desconhecido'}` },
            { status: 500 }
          )
        }
      }
    }
    
    // ============================================
    // TRANSAÇÃO: CRIAR PEDIDO E TODAS AS ENTIDADES RELACIONADAS
    // ============================================
    console.log('\n🔄 Iniciando transação para criar pedido...')
    
    // 🆕 CONSUMIDOR FINAL: Marcar automaticamente como entregue (venda de balcão)
    const isConsumidorFinal = customerInfo?.customerType === 'CONSUMIDOR_FINAL'
    const orderStatus = isConsumidorFinal ? 'DELIVERED' : 'PENDING'
    
    if (isConsumidorFinal) {
      console.log('🏪 [CONSUMIDOR FINAL] Pedido será marcado como ENTREGUE automaticamente (venda de balcão)')
    }
    
    const result = await prisma.$transaction(async (tx: any) => {
      // Create the order
      const order = await tx.order.create({
        data: {
          id: crypto.randomUUID(),
          orderNumber,
          customerId,
          userId: user?.id || null,
          sellerId: customerInfo?.sellerId || null,
          createdByUserId: user?.id || null,
          createdByRole: orderType === 'RETAIL' ? 'RETAIL' : (user?.userType || 'CUSTOMER'),
          customerName: customerData.name,
          customerPhone: customerData.phone,
          customerEmail: customerData.email,
          casualCustomerName: casualCustomerName || null, // 🆕 Nome do cliente avulso
          address: customerData.address,
          city: customerData.city,
          orderType,
          deliveryType: isConsumidorFinal ? 'PICKUP' : deliveryType, // Consumidor Final sempre é PICKUP (retirada)
          deliveryDate: deliveryDate ? new Date(deliveryDate + 'T12:00:00.000Z') : null, // 🔧 T12:00 evita problema de fuso horário
          deliveryTime,
          paymentMethod: mappedPaymentMethod,
          secondaryPaymentMethod: mappedSecondaryPaymentMethod,
          primaryPaymentAmount: primaryPaymentAmount || null,
          secondaryPaymentAmount: secondaryPaymentAmount || null,
          subtotal,
          discount: discountAmount,
          discountPercent: discount,
          couponId: couponId || null,
          couponCode: couponCode || null,
          couponDiscount: couponDiscountAmount,
          cardFee,
          total,
          notes,
          status: orderStatus, // 🆕 DELIVERED para Consumidor Final, PENDING para outros
          paymentStatus: isConsumidorFinal ? 'UNPAID' : undefined, // Ainda não pagou (vai pagar no checkout)
          updatedAt: new Date(),
          OrderItem: {
            create: orderItems.map((item: any) => ({
              id: crypto.randomUUID(),
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
              isGift: item.isGift || false,
              isChecked: false
            }))
          }
        },
        include: {
          OrderItem: {
            include: {
              Product: true
            }
          }
        }
      })
      
      console.log(`✅ Pedido criado: ${order.orderNumber}`)
      
      // 📦 DECREMENTAR ESTOQUE DOS PRODUTOS VENDIDOS
      console.log('📦 [ESTOQUE] Decrementando estoque dos produtos vendidos...')
      
      for (const item of orderItems) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { id: true, name: true, currentStock: true }
        })
        
        if (product) {
          const previousStock = product.currentStock
          const newStock = previousStock - item.quantity
          
          // Atualizar estoque do produto
          await tx.product.update({
            where: { id: item.productId },
            data: {
              currentStock: { decrement: item.quantity }
            }
          })
          
          // Registrar movimentação de estoque
          await tx.inventoryMovement.create({
            data: {
              id: crypto.randomUUID(),
              productId: item.productId,
              type: 'EXIT',
              quantity: -item.quantity, // Negativo para saída
              previousStock,
              newStock,
              reason: `Venda - Pedido ${order.orderNumber}`,
              notes: `Cliente: ${customerInfo?.name || 'Consumidor Final'}`,
              referenceId: order.id,
              performedBy: session?.user?.name || 'Sistema',
              performedById: session?.user?.id || null
            }
          })
          
          console.log(`   ✅ ${product.name}: ${previousStock} → ${newStock} (vendido: ${item.quantity})`)
        }
      }
      
      // Update coupon usage if applicable
      if (couponId && customerId) {
        await tx.coupon.update({
          where: { id: couponId },
          data: {
            usageCount: { increment: 1 },
            updatedAt: new Date()
          }
        })
        
        await tx.couponUsage.create({
          data: {
            id: crypto.randomUUID(),
            couponId,
            customerId,
            orderId: order.id,
            usedAt: new Date()
          }
        })
        console.log(`✅ Cupom atualizado`)
      }
      
      // Create commission for the seller
      if (customerInfo?.sellerId) {
        const seller = await tx.seller.findUnique({
          where: { id: customerInfo.sellerId },
          select: { commissionRate: true }
        })
        
        if (seller) {
          const commissionAmount = total * (seller.commissionRate / 100)
          await tx.commission.create({
            data: {
              id: crypto.randomUUID(),
              sellerId: customerInfo.sellerId,
              orderId: order.id,
              amount: commissionAmount,
              description: `Comissão do pedido ${order.orderNumber} (Cliente: ${customerInfo.name})`,
              status: 'PENDING',
              updatedAt: new Date()
            }
          })
          console.log(`✅ Comissão criada`)
        }
      }
      
      // ✅ CORREÇÃO: DESCONTAR LIMITE DE CRÉDITO PARA TODOS OS PEDIDOS
      // (independente do método de pagamento - reserva o valor até o pedido ser pago e entregue)
      if (customerId && customerInfo) {
        console.log('💰 [LIMITE] Descontando valor do pedido do limite do cliente')
        console.log(`   - Valor do pedido: R$ ${total.toFixed(2)}`)
        console.log(`   - Limite disponível antes: R$ ${customerInfo.availableCredit.toFixed(2)}`)
        
        // Verificar se o cliente tem limite suficiente
        if (customerInfo.availableCredit < total) {
          throw new Error(`Limite insuficiente. Disponível: R$ ${customerInfo.availableCredit.toFixed(2)}, Necessário: R$ ${total.toFixed(2)}`)
        }
        
        await tx.customer.update({
          where: { id: customerId },
          data: {
            availableCredit: { decrement: total }
          }
        })
        
        console.log(`   ✅ Crédito descontado do limite: R$ ${total.toFixed(2)}`)
        console.log(`   - Limite disponível após: R$ ${(customerInfo.availableCredit - total).toFixed(2)}`)
      }
      
      // Create boletos if applicable
      const boletos: any[] = []
      if (boletoDataList.length > 0) {
        const boletoAmount = mappedPaymentMethod === 'BOLETO' ? (primaryPaymentAmount || total) : (secondaryPaymentAmount || 0)
        
        // Create boletos in database with Cora data
        for (const boletoData of boletoDataList) {
          // Validar que customerId existe para boletos (obrigatório)
          if (!customerId) {
            throw new Error('CustomerId é obrigatório para criar boletos')
          }
          
          const boleto = await tx.boleto.create({
            data: {
              id: crypto.randomUUID(),
              boletoNumber: boletoData.boletoNumber,
              customerId: customerId,
              orderId: order.id,
              amount: boletoData.amount,
              dueDate: boletoData.dueDate,
              status: 'PENDING',
              isInstallment: boletoData.isInstallment || false,
              installmentNumber: boletoData.installmentNumber,
              totalInstallments: boletoData.totalInstallments,
              pixQrCode: boletoData.pixQrCode,
              pixQrCodeBase64: boletoData.pixQrCodeBase64,
              pixPaymentId: boletoData.pixPaymentId,
              barcodeNumber: boletoData.barcodeNumber,
              digitableLine: boletoData.digitableLine,
              boletoUrl: boletoData.boletoUrl,
              updatedAt: new Date()
            }
          })
          boletos.push(boleto)
          console.log(`✅ Boleto salvo no banco: ${boleto.boletoNumber}`)
          
          // Create receivable for this boleto
          let description = `Pedido #${order.orderNumber}`
          if (boleto.isInstallment && boleto.installmentNumber && boleto.totalInstallments) {
            description += ` - Parcela ${boleto.installmentNumber}/${boleto.totalInstallments}`
          }
          
          // 🔧 CORREÇÃO: Receivable sempre é criado com a mesma dueDate do boleto
          // (que agora já usa deliveryDate + paymentTerms)
          await tx.receivable.create({
            data: {
              id: crypto.randomUUID(),
              customerId: customerId || null,
              orderId: order.id,
              boletoId: boleto.id,
              description,
              amount: Number(boleto.amount),
              dueDate: boleto.dueDate,
              status: 'PENDING',
              paymentMethod: 'BOLETO',
              isInstallment: boleto.isInstallment || false,
              installmentNumber: boleto.installmentNumber,
              totalInstallments: boleto.totalInstallments,
              createdBy: user?.id || null,
            }
          })
          console.log(`✅ Conta a receber criada para boleto ${boleto.boletoNumber} - Vencimento: ${boleto.dueDate.toISOString().split('T')[0]}`)
        }
        
        // ✅ CORREÇÃO: Removido desconto duplicado de crédito para boletos
        // (já foi descontado no início da transação para todos os pedidos)
        console.log(`✅ Boletos processados (crédito já foi descontado anteriormente)`)
        
        // 🔧 CORREÇÃO CRÍTICA: Criar receivable para pagamento secundário em pagamentos combinados com boleto
        // Quando primary = BOLETO e há secondary (ex: CASH, PIX), o receivable secundário deve ser criado aqui
        if (mappedSecondaryPaymentMethod && secondaryPaymentAmount && mappedSecondaryPaymentMethod !== 'BOLETO') {
          console.log(`\n💰 [ORDERS] Criando receivable para pagamento secundário (combinado com boleto)`)
          console.log(`   - Método secundário: ${mappedSecondaryPaymentMethod}`)
          console.log(`   - Valor: R$ ${secondaryPaymentAmount}`)
          
          // Calcular vencimento baseado na data de ENTREGA + prazo de pagamento
          const baseDate = deliveryDate ? new Date(deliveryDate) : new Date()
          const paymentTermsDays = customerInfo?.paymentTerms || 0
          const calculatedDueDate = new Date(baseDate)
          calculatedDueDate.setDate(calculatedDueDate.getDate() + paymentTermsDays)
          
          const isSecondaryPaid = isAlreadyPaid && ['CASH', 'PIX'].includes(mappedSecondaryPaymentMethod)
          
          const secondaryReceivable = await tx.receivable.create({
            data: {
              id: crypto.randomUUID(),
              customerId: customerId || null,
              orderId: order.id,
              boletoId: null,
              description: `Pedido #${order.orderNumber} - ${mappedSecondaryPaymentMethod}`,
              amount: Number(secondaryPaymentAmount),
              dueDate: calculatedDueDate,
              paymentDate: isSecondaryPaid ? new Date() : null,
              status: isSecondaryPaid ? 'PAID' : 'PENDING',
              paymentMethod: mappedSecondaryPaymentMethod,
              bankAccountId: (isSecondaryPaid && bankAccountId) ? bankAccountId : null,
              createdBy: user?.id || null,
            }
          })
          console.log(`✅ Receivable secundário criado (R$ ${secondaryPaymentAmount}) - Status: ${isSecondaryPaid ? 'PAID' : 'PENDING'}`)
          
          // 🏦 Criar transação bancária para pagamento secundário se pago imediatamente
          if (isSecondaryPaid && bankAccountId) {
            const bankAccount = await tx.bankAccount.update({
              where: { id: bankAccountId },
              data: {
                balance: {
                  increment: Number(secondaryPaymentAmount)
                }
              }
            })
            
            const customerName = customerInfo?.name || casualCustomerName || 'Cliente não identificado'
            await tx.transaction.create({
              data: {
                bankAccountId: bankAccountId,
                type: 'INCOME',
                amount: Number(secondaryPaymentAmount),
                date: new Date(),
                description: `Recebimento ${mappedSecondaryPaymentMethod} - Pedido #${order.orderNumber} - Cliente: ${customerName} (Parcial)`,
                notes: null,
                referenceType: 'RECEIVABLE',
                referenceId: secondaryReceivable.id,
                balanceAfter: bankAccount.balance
              }
            })
            
            console.log(`💰 Transação bancária secundária criada! R$ ${Number(secondaryPaymentAmount).toFixed(2)} → Novo saldo: R$ ${Number(bankAccount.balance).toFixed(2)}`)
          }
        }
      }
      
      // 🔧 CORREÇÃO CRÍTICA: SEMPRE criar receivables para TODOS os pedidos
      // Independente se tem boleto ou não, TODOS os pedidos DEVEM estar em contas a receber
      if (boletoDataList.length === 0) {
        console.log(`\n💰 [ORDERS] Criando receivables para pedido sem boleto`)
        console.log(`   - Método: ${mappedPaymentMethod}`)
        console.log(`   - Total: R$ ${total}`)
        console.log(`   - Cliente ID: ${customerId || 'Sem cliente'}`)
        
        // 🔧 CORREÇÃO CRÍTICA: Calcular vencimento baseado na data de ENTREGA + prazo de pagamento
        const baseDate = deliveryDate ? new Date(deliveryDate) : new Date()
        const paymentTermsDays = customerInfo?.paymentTerms || 0 // 0 para pagamento imediato
        const calculatedDueDate = new Date(baseDate)
        calculatedDueDate.setDate(calculatedDueDate.getDate() + paymentTermsDays)
        
        console.log(`   - Data de entrega: ${baseDate.toISOString().split('T')[0]}`)
        console.log(`   - Prazo de pagamento: ${paymentTermsDays} dias`)
        console.log(`   - Vencimento calculado: ${calculatedDueDate.toISOString().split('T')[0]}`)
        
        // 🆕 CORREÇÃO CRÍTICA: Usar o checkbox "Já pago?" do frontend
        // Se isAlreadyPaid = true E método é PIX/CASH → receivable = PAID + cria transação bancária
        // Se isAlreadyPaid = false → receivable = PENDING (mesmo se for PIX/CASH)
        // Isso permite criar pedidos PIX que ainda não foram pagos (aguardando confirmação)
        const canBePaidImmediately = ['CASH', 'PIX'].includes(mappedPaymentMethod)
        const isPaidImmediately = isAlreadyPaid && canBePaidImmediately
        
        console.log(`   - isAlreadyPaid (do checkbox): ${isAlreadyPaid}`)
        console.log(`   - Método permite pagamento imediato: ${canBePaidImmediately}`)
        console.log(`   - Será marcado como PAID: ${isPaidImmediately}`)
        
        if (secondaryPaymentMethod && secondaryPaymentAmount) {
          // Combined payment
          const isPrimaryPaid = isAlreadyPaid && ['CASH', 'PIX'].includes(mappedPaymentMethod)
          
          const primaryReceivable = await tx.receivable.create({
            data: {
              id: crypto.randomUUID(),
              customerId: customerId || null,
              orderId: order.id,
              boletoId: null,
              description: `Pedido #${order.orderNumber} - ${mappedPaymentMethod}`,
              amount: Number(primaryPaymentAmount),
              dueDate: calculatedDueDate,
              paymentDate: isPrimaryPaid ? new Date() : null,
              status: isPrimaryPaid ? 'PAID' : 'PENDING',
              paymentMethod: mappedPaymentMethod,
              bankAccountId: (isPrimaryPaid && bankAccountId) ? bankAccountId : null,
              createdBy: user?.id || null,
            }
          })
          console.log(`✅ Receivable primário criado - Vencimento: ${calculatedDueDate.toISOString().split('T')[0]}`)
          
          // 🏦 Criar transação bancária para pagamento primário se pago imediatamente
          if (isPrimaryPaid && bankAccountId) {
            const bankAccount = await tx.bankAccount.update({
              where: { id: bankAccountId },
              data: {
                balance: {
                  increment: Number(primaryPaymentAmount)
                }
              }
            })
            
            const customerName = customerInfo?.name || casualCustomerName || 'Cliente não identificado'
            await tx.transaction.create({
              data: {
                bankAccountId: bankAccountId,
                type: 'INCOME',
                amount: Number(primaryPaymentAmount),
                date: new Date(),
                description: `Recebimento ${mappedPaymentMethod} - Pedido #${order.orderNumber} - Cliente: ${customerName} (Parcial)`,
                notes: null,
                referenceType: 'RECEIVABLE',
                referenceId: primaryReceivable.id,
                balanceAfter: bankAccount.balance
              }
            })
            
            console.log(`💰 Transação bancária primária criada! R$ ${Number(primaryPaymentAmount).toFixed(2)} → Novo saldo: R$ ${Number(bankAccount.balance).toFixed(2)}`)
          }
          
          if (mappedSecondaryPaymentMethod !== 'BOLETO') {
            const isSecondaryPaid = isAlreadyPaid && ['CASH', 'PIX'].includes(mappedSecondaryPaymentMethod!)
            
            const secondaryReceivable = await tx.receivable.create({
              data: {
                id: crypto.randomUUID(),
                customerId: customerId || null,
                orderId: order.id,
                boletoId: null,
                description: `Pedido #${order.orderNumber} - ${mappedSecondaryPaymentMethod}`,
                amount: Number(secondaryPaymentAmount),
                dueDate: calculatedDueDate,
                paymentDate: isSecondaryPaid ? new Date() : null,
                status: isSecondaryPaid ? 'PAID' : 'PENDING',
                paymentMethod: mappedSecondaryPaymentMethod!,
                bankAccountId: (isSecondaryPaid && bankAccountId) ? bankAccountId : null,
                createdBy: user?.id || null,
              }
            })
            console.log(`✅ Receivable secundário criado - Vencimento: ${calculatedDueDate.toISOString().split('T')[0]}`)
            
            // 🏦 Criar transação bancária para pagamento secundário se pago imediatamente
            if (isSecondaryPaid && bankAccountId) {
              const bankAccount = await tx.bankAccount.update({
                where: { id: bankAccountId },
                data: {
                  balance: {
                    increment: Number(secondaryPaymentAmount)
                  }
                }
              })
              
              const customerName = customerInfo?.name || casualCustomerName || 'Cliente não identificado'
              await tx.transaction.create({
                data: {
                  bankAccountId: bankAccountId,
                  type: 'INCOME',
                  amount: Number(secondaryPaymentAmount),
                  date: new Date(),
                  description: `Recebimento ${mappedSecondaryPaymentMethod} - Pedido #${order.orderNumber} - Cliente: ${customerName} (Parcial)`,
                  notes: null,
                  referenceType: 'RECEIVABLE',
                  referenceId: secondaryReceivable.id,
                  balanceAfter: bankAccount.balance
                }
              })
              
              console.log(`💰 Transação bancária secundária criada! R$ ${Number(secondaryPaymentAmount).toFixed(2)} → Novo saldo: R$ ${Number(bankAccount.balance).toFixed(2)}`)
            }
          }
        } else {
          // Single payment
          const receivable = await tx.receivable.create({
            data: {
              id: crypto.randomUUID(),
              customerId: customerId || null,
              orderId: order.id,
              boletoId: null,
              description: `Pedido #${order.orderNumber}`,
              amount: Number(total),
              dueDate: calculatedDueDate,
              paymentDate: isPaidImmediately ? new Date() : null,
              status: isPaidImmediately ? 'PAID' : 'PENDING',
              paymentMethod: mappedPaymentMethod,
              bankAccountId: bankAccountId || null,
              createdBy: user?.id || null,
            }
          })
          
          if (['DEBIT', 'CREDIT_CARD', 'CARD'].includes(mappedPaymentMethod)) {
            console.log(`💳 Receivable criado com status PENDING (cartão ${mappedPaymentMethod}) - Vencimento: ${calculatedDueDate.toISOString().split('T')[0]}`)
          } else if (isPaidImmediately) {
            console.log(`✅ Receivable criado com status PAID (${mappedPaymentMethod}) - Pago na hora - Vencimento: ${calculatedDueDate.toISOString().split('T')[0]}`)
            
            // 🏦 CRIAR TRANSAÇÃO BANCÁRIA se bankAccountId foi fornecido
            if (bankAccountId) {
              const bankAccount = await tx.bankAccount.update({
                where: { id: bankAccountId },
                data: {
                  balance: {
                    increment: Number(total)
                  }
                }
              })
              
              const customerName = customerInfo?.name || casualCustomerName || 'Cliente não identificado'
              await tx.transaction.create({
                data: {
                  bankAccountId: bankAccountId,
                  type: 'INCOME',
                  amount: Number(total),
                  date: new Date(),
                  description: `Recebimento ${mappedPaymentMethod} - Pedido #${order.orderNumber} - Cliente: ${customerName}`,
                  notes: null,
                  referenceType: 'RECEIVABLE',
                  referenceId: receivable.id,
                  balanceAfter: bankAccount.balance
                }
              })
              
              console.log(`💰 Transação bancária criada! Conta: ${bankAccount.name} | Saldo anterior: R$ ${(Number(bankAccount.balance) - Number(total)).toFixed(2)} | Recebido: R$ ${Number(total).toFixed(2)} | Novo saldo: R$ ${Number(bankAccount.balance).toFixed(2)}`)
            } else {
              console.log(`⚠️  AVISO: Pagamento imediato (${mappedPaymentMethod}) mas sem conta bancária informada. Transação bancária NÃO foi criada.`)
            }
          } else {
            console.log(`✅ Receivable criado com status PENDING (${mappedPaymentMethod}) - Vencimento: ${calculatedDueDate.toISOString().split('T')[0]}`)
          }
        }
      }
      
      // Create card transactions if applicable
      console.log(`\n💳 VERIFICANDO PAGAMENTOS COM CARTÃO...`)
      console.log(`Método Primário: ${mappedPaymentMethod}`)
      console.log(`Método Secundário: ${mappedSecondaryPaymentMethod || 'N/A'}`)
      
      const cardPayments: Array<{method: string, amount: number}> = [];
      
      // Check primary payment (inclui CARD genérico que deve ser tratado como cartão)
      if (['DEBIT', 'CREDIT_CARD', 'CARD'].includes(mappedPaymentMethod)) {
        const amount = secondaryPaymentMethod && secondaryPaymentAmount 
          ? primaryPaymentAmount 
          : total;
        console.log(`✅ Pagamento primário é cartão (${mappedPaymentMethod}): R$ ${amount}`)
        cardPayments.push({
          method: mappedPaymentMethod,
          amount: amount || 0
        });
      } else {
        console.log(`ℹ️  Pagamento primário NÃO é cartão (${mappedPaymentMethod})`)
      }
      
      // Check secondary payment (inclui CARD genérico)
      if (mappedSecondaryPaymentMethod && ['DEBIT', 'CREDIT_CARD', 'CARD'].includes(mappedSecondaryPaymentMethod)) {
        console.log(`✅ Pagamento secundário é cartão (${mappedSecondaryPaymentMethod}): R$ ${secondaryPaymentAmount}`)
        cardPayments.push({
          method: mappedSecondaryPaymentMethod,
          amount: secondaryPaymentAmount || 0
        });
      }
      
      console.log(`📊 Total de pagamentos com cartão identificados: ${cardPayments.length}`)
      
      // Create card transactions
      if (cardPayments.length > 0) {
        console.log(`\n🔄 CRIANDO TRANSAÇÕES DE CARTÃO...`)
        for (const payment of cardPayments) {
          const cardType = payment.method === 'DEBIT' ? 'DEBIT' : 'CREDIT';
          
          // Get fee configuration
          const feeConfig = await tx.cardFeeConfig.findFirst({
            where: { cardType, isActive: true },
            select: productSelect
          });
          
          const feePercentage = feeConfig?.feePercentage || (cardType === 'DEBIT' ? 0.9 : 3.24);
          const feeAmount = payment.amount * (feePercentage / 100);
          const netAmount = payment.amount - feeAmount;
          
          // Calculate expected date (D+1 for debit, D+2 for credit - business days)
          const today = new Date();
          let expectedDate = new Date(today);
          expectedDate.setDate(expectedDate.getDate() + (cardType === 'DEBIT' ? 1 : 2));
          
          // Skip weekends (Saturday and Sunday)
          while (expectedDate.getDay() === 0 || expectedDate.getDay() === 6) {
            expectedDate.setDate(expectedDate.getDate() + 1);
          }
          
          try {
            console.log(`  Criando transação ${cardType}:`)
            console.log(`    - Valor Bruto: R$ ${payment.amount.toFixed(2)}`)
            console.log(`    - Taxa: ${feePercentage}% (R$ ${feeAmount.toFixed(2)})`)
            console.log(`    - Valor Líquido: R$ ${netAmount.toFixed(2)}`)
            console.log(`    - Data Esperada: ${expectedDate.toISOString()}`)
            
            await tx.cardTransaction.create({
              data: {
                id: crypto.randomUUID(),
                orderId: order.id,
                customerId: customerId || undefined,
                cardType,
                grossAmount: payment.amount,
                feePercentage,
                feeAmount,
                netAmount,
                status: 'PENDING',
                saleDate: new Date(),
                expectedDate,
              }
            });
            
            console.log(`  ✅ Transação com cartão ${cardType} criada com sucesso!`);
          } catch (txError) {
            console.error(`  ❌ ERRO ao criar transação de cartão:`, txError);
            throw txError; // Re-throw para causar rollback da transação principal
          }
        }
        console.log(`✅ Todas as transações de cartão foram criadas`)
      } else {
        console.log(`ℹ️  Nenhuma transação de cartão a ser criada`)
      }
      
      // Return data from transaction
      return { order, boletos }
    })
    
    // Extract order and boletos from transaction result
    const order = result.order
    const boletos = result.boletos
    
    console.log(`\n✅✅✅ TRANSAÇÃO CONCLUÍDA COM SUCESSO! ✅✅✅`)
    console.log(`Pedido ${order.orderNumber} criado com todos os dados`)
    
    // ============================================
    // 🆕 ADICIONAR PRODUTOS COMPRADOS AO CATÁLOGO PERSONALIZADO
    // ============================================
    if (customerId && customerInfo?.useCustomCatalog) {
      try {
        console.log('\n📦 [CATÁLOGO AUTO] Cliente tem catálogo personalizado. Verificando produtos comprados...')
        
        // Buscar produtos que já estão no catálogo personalizado
        const existingCustomerProducts = await prisma.customerProduct.findMany({
          where: {
            customerId: customerId,
            productId: { in: productIds }
          },
          select: { productId: true }
        })
        
        const existingProductIds = new Set(existingCustomerProducts.map(cp => cp.productId))
        console.log(`   - Produtos já no catálogo: ${existingProductIds.size}/${productIds.length}`)
        
        // Identificar produtos novos (não estão no catálogo)
        const newProductIds = productIds.filter((pid: string) => !existingProductIds.has(pid))
        
        if (newProductIds.length > 0) {
          console.log(`   - Produtos novos a adicionar: ${newProductIds.length}`)
          console.log(`   - IDs dos novos produtos:`, newProductIds)
          
          // Adicionar produtos ao catálogo personalizado
          const createPromises = newProductIds.map((productId: string) => 
            prisma.customerProduct.create({
              data: {
                id: crypto.randomUUID(),
                customerId: customerId,
                productId: productId,
                customPrice: null, // Sem preço customizado (usa o padrão)
                isVisible: true, // Visível no catálogo
                updatedAt: new Date()
              }
            })
          )
          
          await Promise.all(createPromises)
          
          // Buscar nomes dos produtos adicionados para log
          const addedProducts = await prisma.product.findMany({
            where: { id: { in: newProductIds } },
            select: { name: true }
          })
          
          console.log(`   ✅ ${newProductIds.length} produto(s) adicionado(s) ao catálogo personalizado:`)
          addedProducts.forEach(p => console.log(`      - ${p.name}`))
        } else {
          console.log(`   ℹ️ Todos os produtos comprados já estavam no catálogo personalizado`)
        }
      } catch (catalogError) {
        // Log do erro mas não falha o pedido (operação não-crítica)
        console.error('❌ Erro ao adicionar produtos ao catálogo personalizado:', catalogError)
      }
    } else if (customerId && !customerInfo?.useCustomCatalog) {
      console.log('\n📦 [CATÁLOGO AUTO] Cliente não possui catálogo personalizado (usa catálogo geral)')
    }
    
    // ============================================
    // 💜 PROCESSAR PIX CONFIRMADO (VAREJO)
    // ============================================
    if (pixChargeId && pixPaid) {
      try {
        console.log('\n💜 [PIX VAREJO] Processando PIX confirmado...')
        console.log(`   - pixChargeId: ${pixChargeId}`)
        
        // Buscar dados do PixCharge
        const pixCharge = await prisma.pixCharge.findUnique({
          where: { id: pixChargeId },
          select: { id: true, coraAccount: true, feeAmount: true, netAmount: true, amount: true }
        })
        
        if (pixCharge) {
          console.log(`   - Conta Cora: ${pixCharge.coraAccount}`)
          console.log(`   - Valor Bruto: R$ ${Number(pixCharge.amount).toFixed(2)}`)
          console.log(`   - Taxa: R$ ${Number(pixCharge.feeAmount).toFixed(2)}`)
          console.log(`   - Valor Líquido: R$ ${Number(pixCharge.netAmount).toFixed(2)}`)
          
          // Vincular PixCharge ao pedido
          await prisma.pixCharge.update({
            where: { id: pixChargeId },
            data: { orderId: order.id }
          })
          console.log(`   ✅ PixCharge vinculado ao pedido`)
          
          // Atualizar paymentStatus do pedido para PAID
          await prisma.order.update({
            where: { id: order.id },
            data: { paymentStatus: 'PAID' }
          })
          console.log(`   ✅ Pedido atualizado para PAID`)
          
          // Buscar conta bancária Cora correspondente
          const allBankAccounts = await prisma.bankAccount.findMany({
            where: { isActive: true },
            select: { id: true, name: true, balance: true }
          })
          
          const searchTerm = pixCharge.coraAccount === 'ESPETOS' ? 'espetos' : 'genuino'
          const coraBankAccount = allBankAccounts.find(a => 
            a.name.toLowerCase().includes('cora') && 
            a.name.toLowerCase().includes(searchTerm)
          ) || allBankAccounts.find(a => a.name.toLowerCase().includes('cora'))
          
          if (coraBankAccount) {
            console.log(`   - Conta bancária: ${coraBankAccount.name}`)
            
            const netAmount = Number(pixCharge.netAmount)
            const newBalance = Number(coraBankAccount.balance) + netAmount
            
            // Criar transação bancária
            await prisma.transaction.create({
              data: {
                bankAccountId: coraBankAccount.id,
                type: 'INCOME',
                amount: netAmount,
                date: new Date(),
                description: `Recebimento PIX - Pedido #${order.orderNumber} - Cliente: ${customerData.name} (Líquido, Taxa: R$ ${Number(pixCharge.feeAmount).toFixed(2)})`,
                notes: null,
                category: 'VENDAS',
                balanceAfter: newBalance
              }
            })
            
            // Atualizar saldo da conta
            await prisma.bankAccount.update({
              where: { id: coraBankAccount.id },
              data: { balance: newBalance }
            })
            
            console.log(`   💰 Transação bancária criada! Valor líquido: R$ ${netAmount.toFixed(2)} → Novo saldo: R$ ${newBalance.toFixed(2)}`)
            
            // Atualizar receivable com conta bancária e status PAID
            const receivable = await prisma.receivable.findFirst({
              where: { orderId: order.id, paymentMethod: 'PIX' }
            })
            
            if (receivable) {
              await prisma.receivable.update({
                where: { id: receivable.id },
                data: { 
                  status: 'PAID',
                  paymentDate: new Date(),
                  bankAccountId: coraBankAccount.id
                }
              })
              console.log(`   ✅ Receivable atualizado para PAID com conta bancária`)
            }
          } else {
            console.log(`   ⚠️ Conta Cora não encontrada. Transação bancária NÃO foi criada.`)
          }
        } else {
          console.log(`   ⚠️ PixCharge não encontrado: ${pixChargeId}`)
        }
      } catch (pixError) {
        console.error('❌ Erro ao processar PIX confirmado:', pixError)
        // Não falha o pedido, apenas loga o erro
      }
    }
    
    // ============================================
    // OPERAÇÕES NÃO-CRÍTICAS (FORA DA TRANSAÇÃO)
    // ============================================

    // Notificação de novo pedido removida - apenas notificações de mudança de status e pontos devem ser enviadas

    // Send email notification
    try {
      const itemsList = order.OrderItem.map((item: any) => 
        `<li>${item.quantity}x ${item.Product.name} - ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(item.total))}</li>`
      ).join('')

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ef4444;">🍢 Novo Pedido - [SUA EMPRESA]</h2>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>📋 Pedido:</strong> ${order.orderNumber}</p>
            <p><strong>👤 Cliente:</strong> ${order.customerName}</p>
            <p><strong>📱 Telefone:</strong> ${order.customerPhone || 'Não informado'}</p>
            <p><strong>📧 Email:</strong> ${order.customerEmail || 'Não informado'}</p>
            <p><strong>💰 Total:</strong> ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(order.total))}</p>
            <p><strong>🏪 Tipo:</strong> ${orderType === 'WHOLESALE' ? 'Atacado' : 'Varejo'}</p>
            <p><strong>🚚 Entrega:</strong> ${deliveryType === 'DELIVERY' ? 'Entrega' : 'Retirada'}</p>
            ${deliveryDate ? `<p><strong>📅 Data de Entrega:</strong> ${new Date(deliveryDate).toLocaleDateString('pt-BR')}</p>` : ''}
            ${deliveryTime ? `<p><strong>⏰ Horário:</strong> ${deliveryTime}</p>` : ''}
            ${order.address ? `<p><strong>📍 Endereço:</strong> ${order.address}, ${order.city}</p>` : ''}
          </div>
          <div style="margin: 20px 0;">
            <h3>📦 Itens do Pedido:</h3>
            <ul style="list-style-type: none; padding: 0;">
              ${itemsList}
            </ul>
          </div>
          ${notes ? `<div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>📝 Observações:</strong></p>
            <p>${notes}</p>
          </div>` : ''}
          <p style="color: #6b7280; font-size: 14px;">
            ⏰ Pedido realizado em: ${new Date().toLocaleString('pt-BR')}
          </p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px; text-align: center;">
            Acesse o painel administrativo para mais detalhes e gerenciar o pedido.
          </p>
        </div>
      `

      await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: 'franciscovieiraa574@gmail.com',
          subject: `🍢 Novo Pedido ${order.orderNumber} - [SUA EMPRESA]`,
          html: emailHtml
        })
      })
    } catch (emailError) {
      console.error('Error sending email notification:', emailError)
    }

    // ============================================
    // SISTEMA DE PONTOS/RECOMPENSAS
    // REGRA: Apenas pedidos criados pelo próprio cliente geram pontos
    // ============================================
    if (customerId && orderType === 'WHOLESALE') {
      try {
        console.log('\n🎯 Verificando acúmulo de pontos...')
        console.log('customerId:', customerId)
        console.log('createdByRole:', order.createdByRole)
        console.log('orderAmount:', total)
        
        // A função addPointsForOrder já valida se createdByRole === 'CUSTOMER'
        const pointsResult = await addPointsForOrder(
          order.id,
          customerId,
          total,
          order.createdByRole
        )
        
        if (pointsResult) {
          console.log(`✅ Pontos adicionados com sucesso!`)
        } else {
          console.log(`ℹ️ Nenhum ponto adicionado (pedido não criado pelo cliente ou configuração inválida)`)
        }
      } catch (pointsError) {
        console.error('❌ Erro ao adicionar pontos:', pointsError)
        // Não bloqueia o pedido se houver erro nos pontos
      }
    }

    // Serialize the response
    const serializedOrder = {
      ...order,
      subtotal: Number(order.subtotal),
      discount: Number(order.discount),
      cardFee: Number(order.cardFee),
      total: Number(order.total),
      primaryPaymentAmount: order.primaryPaymentAmount ? Number(order.primaryPaymentAmount) : null,
      secondaryPaymentAmount: order.secondaryPaymentAmount ? Number(order.secondaryPaymentAmount) : null,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      deliveryDate: order.deliveryDate?.toISOString() || null,
      boletos: boletos.map(bol => ({
        ...bol,
        amount: Number(bol.amount),
        dueDate: bol.dueDate.toISOString(),
        createdAt: bol.createdAt.toISOString(),
        updatedAt: bol.updatedAt.toISOString()
      })),
      OrderItem: order.OrderItem?.map((item: any) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
        createdAt: item.createdAt.toISOString(),
        product: {
          ...item.Product,
          priceWholesale: Number(item.Product.priceWholesale),
          priceRetail: Number(item.Product.priceRetail),
          bulkDiscountMinQty: item.Product.bulkDiscountMinQty || null,
          bulkDiscountPrice: item.Product.bulkDiscountPrice ? Number(item.Product.bulkDiscountPrice) : null,
          createdAt: item.Product.createdAt.toISOString(),
          updatedAt: item.Product.updatedAt.toISOString()
        }
      }))
    }

    return NextResponse.json(serializedOrder)
  } catch (error) {
    console.error('❌❌❌ Error creating order:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : ''
    console.error('❌❌❌ Error message:', errorMessage)
    console.error('❌❌❌ Error stack:', errorStack)
    
    // 🔒 VALIDAÇÃO: Tratar erro de PRICE_MISMATCH de forma especial
    if (errorMessage.startsWith('PRICE_MISMATCH:')) {
      const [, productName, frontendPrice, backendPrice] = errorMessage.split(':')
      return NextResponse.json({
        error: `Preço divergente detectado para "${productName}". Frontend: R$ ${Number(frontendPrice).toFixed(2)}, Backend: R$ ${Number(backendPrice).toFixed(2)}. Por favor, atualize a página e tente novamente.`,
        code: 'PRICE_MISMATCH',
        details: {
          productName,
          frontendPrice: Number(frontendPrice),
          backendPrice: Number(backendPrice)
        }
      }, { status: 400 })
    }
    
    return NextResponse.json(
      { error: 'Failed to create order', details: errorMessage },
      { status: 500 }
    )
  }
}
