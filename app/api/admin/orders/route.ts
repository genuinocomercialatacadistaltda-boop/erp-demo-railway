

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { createPixPayment } from '@/lib/mercado-pago'
import { createPixCharge, isCoraConfigured } from '@/lib/cora'
import QRCode from 'qrcode'
import crypto from 'crypto'
import { productSelect } from '@/lib/product-select'

// GET - Buscar pedidos com filtros
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const date = searchParams.get('date') // YYYY-MM-DD
    const month = searchParams.get('month') // YYYY-MM

    let where: any = {}

    // Filtro por status
    if (status) {
      where.status = status
    }

    // Filtro por data específica (usa deliveryDate)
    if (date) {
      const [year, monthNum, day] = date.split('-').map(Number)
      const startDate = new Date(Date.UTC(year, monthNum - 1, day, 0, 0, 0, 0)) // 00:00 UTC
      const endDate = new Date(Date.UTC(year, monthNum - 1, day + 1, 0, 0, 0, 0)) // 00:00 UTC próximo dia
      
      where.deliveryDate = {
        gte: startDate,
        lt: endDate
      }
    }

    // Filtro por mês (usa deliveryDate)
    if (month) {
      const [year, monthNum] = month.split('-').map(Number)
      const startDate = new Date(Date.UTC(year, monthNum - 1, 1, 0, 0, 0, 0)) // Primeiro dia do mês 00:00 UTC
      const endDate = new Date(Date.UTC(year, monthNum, 1, 0, 0, 0, 0)) // Primeiro dia do próximo mês 00:00 UTC
      
      where.deliveryDate = {
        gte: startDate,
        lt: endDate
      }
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        Customer: true,
        OrderItem: {
          include: {
            Product: {
              select: productSelect
            }
          }
        }
      },
      orderBy: {
        deliveryDate: 'desc'
      }
    })

    // Serializar pedidos para garantir compatibilidade com JSON
    const serializedOrders = orders.map((order: any) => ({
      ...order,
      subtotal: Number(order.subtotal),
      discount: Number(order.discount),
      couponDiscount: Number(order.couponDiscount || 0),
      cardFee: Number(order.cardFee || 0),
      boletoFee: Number(order.boletoFee || 0), // 🎫 Taxa de boleto
      total: Number(order.total),
      primaryPaymentAmount: order.primaryPaymentAmount ? Number(order.primaryPaymentAmount) : null,
      secondaryPaymentAmount: order.secondaryPaymentAmount ? Number(order.secondaryPaymentAmount) : null,
      OrderItem: order.OrderItem.map((item: any) => ({
        ...item,
        quantity: Number(item.quantity),
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
    }))

    return NextResponse.json({ orders: serializedOrders })
  } catch (error: any) {
    console.error('❌ Erro ao buscar pedidos:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar pedidos' },
      { status: 500 }
    )
  }
}

// POST - Admin criar novo pedido (SEM COMISSÃO)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const {
      customerId,
      orderType,
      deliveryType,
      deliveryDate,
      deliveryTime,
      paymentMethod,
      secondaryPaymentMethod,
      primaryPaymentAmount,
      secondaryPaymentAmount,
      items,
      discountPercent,
      discountAmount, // 🔧 NOVO: Aceitar desconto fixo em reais
      boletoInstallments,
      coraAccount, // 🏦 NOVO: Conta Cora selecionada (ESPETOS ou GENUINO)
      notes,
      isAlreadyPaid,
      bankAccountId, // 🔧 LEGACY: Mantido para compatibilidade
      primaryBankAccountId, // 🆕 Conta bancária para método primário
      secondaryBankAccountId, // 🆕 Conta bancária para método secundário (pagamento combinado)
      exemptCardFee, // ⚠️ NOVO: Isentar taxa do cartão para este pedido
      exemptBoletoFee, // 🎫 NOVO: Isentar taxa de boleto para este pedido
      boletoFee: boletoFeeFromClient, // 🎫 Taxa de boleto calculada no frontend
      deliveryFee: deliveryFeeFromClient, // 🚚 Taxa de entrega
      isEmployee, // 🆕 Flag para indicar que é pedido de funcionário
      employeeId, // 🆕 ID do funcionário (se aplicável)
      casualCustomerName, // 🆕 Nome do cliente avulso
      pixChargeId, // 💜 PIX: ID da cobrança PIX confirmada
      pixPaid, // 💜 PIX: Flag indicando que foi pago via PIX
      cashReceivedAmount // 💵 Valor recebido em dinheiro (para registrar na conta bancária)
    } = body
    
    // 🚚 Processar taxa de entrega (BUILD v2)
    const deliveryFee = Number(deliveryFeeFromClient) || 0
    console.log(`🚚 [ADMIN_ORDERS] Taxa de entrega recebida: R$ ${deliveryFee.toFixed(2)}`)
    
    // 🏦 DEBUG: Log da conta Cora selecionada
    console.log('🏦🏦🏦 [ADMIN-ORDERS] coraAccount recebido:', coraAccount)
    console.log('🏦🏦🏦 [ADMIN-ORDERS] paymentMethod:', paymentMethod, 'tipo:', typeof paymentMethod, 'JSON:', JSON.stringify(paymentMethod))
    console.log('🏦🏦🏦 [ADMIN-ORDERS] Body completo:', JSON.stringify({ customerId, paymentMethod, items: items?.length, isAlreadyPaid, pixChargeId, pixPaid }))
    
    // 🔧 Validar paymentMethod
    const validPaymentMethods = ['CASH', 'CARD', 'DEBIT', 'CREDIT_CARD', 'PIX', 'CREDIT', 'BOLETO', 'NOTINHA']
    if (!paymentMethod || !validPaymentMethods.includes(paymentMethod)) {
      console.error('❌ [ADMIN-ORDERS] paymentMethod INVÁLIDO:', paymentMethod, '- válidos:', validPaymentMethods)
      return NextResponse.json({ error: `Método de pagamento inválido: "${paymentMethod}". Valores válidos: ${validPaymentMethods.join(', ')}` }, { status: 400 })
    }
    console.log('✅ [ADMIN-ORDERS] paymentMethod VÁLIDO:', paymentMethod)
    
    // 🆕 Compatibilidade: Se não tiver primaryBankAccountId, usar bankAccountId (legacy)
    const finalPrimaryBankAccountId = primaryBankAccountId || bankAccountId

    // 🆕 FUNCIONÁRIO = CLIENTE: Tratar funcionário como cliente
    let customer: any = null
    let employee: any = null
    
    if (isEmployee && employeeId) {
      console.log('🏠 [ADMIN-ORDERS] Pedido de FUNCIONÁRIO detectado!')
      console.log('   employeeId:', employeeId)
      
      // Buscar funcionário
      employee = await prisma.employee.findUnique({
        where: { id: employeeId }
      })
      
      if (!employee) {
        return NextResponse.json(
          { error: 'Funcionário não encontrado' },
          { status: 404 }
        )
      }
      
      console.log('   Funcionário encontrado:', employee.name)
      
      // Criar objeto "customer-like" com dados do funcionário
      customer = {
        id: null, // Não é cliente real
        name: employee.name,
        phone: employee.phone || '',
        email: employee.email || '',
        cpfCnpj: employee.cpf || '',
        creditLimit: employee.creditLimit || 0,
        availableCredit: employee.creditLimit || 0,
        customDiscount: 0,
        customerType: 'NORMAL',
        isBlocked: false
      }
    } else {
      // Buscar cliente normal
      customer = await prisma.customer.findUnique({
        where: { id: customerId }
      })

      if (!customer) {
        return NextResponse.json(
          { error: 'Cliente não encontrado' },
          { status: 404 }
        )
      }
    }

    // Buscar preços personalizados do cliente (se existirem)
    const productIds = items.map((item: any) => item.productId)
    const customPrices = new Map<string, number>()
    
    // 🔧 CORREÇÃO: Buscar preços personalizados para QUALQUER cliente (não só WHOLESALE)
    // WHOLESALE é o padrão quando o cliente está selecionado
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
      
      console.log(`📋 Preços personalizados FINAIS para cliente ${customer.name}:`)
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

    // Calcular subtotal
    let subtotal = 0
    const itemsWithPrices: any[] = []
    let hasPromotionalItemInCart = false  // 🏷️ Rastrear se tem item em promoção

    for (const item of items) {
      console.log(`🔍 Buscando item: ${item.productId}`)
      
      // 🆕 Tentar buscar primeiro em Product
      let product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: productSelect
      })

      // 🆕 Se não encontrar em Product, buscar em RawMaterial
      let rawMaterial = null
      let isRawMaterial = false
      if (!product) {
        console.log(`⚠️ Não encontrado em Product, buscando em RawMaterial...`)
        rawMaterial = await prisma.rawMaterial.findUnique({
          where: { id: item.productId },
          select: {
            id: true,
            name: true,
            priceWholesale: true,
            costPerUnit: true
          }
        })
        
        if (rawMaterial) {
          isRawMaterial = true
          console.log(`✅ Matéria-prima encontrada: ${rawMaterial.name}`)
        }
      }

      // Se não encontrou nem em Product nem em RawMaterial
      if (!product && !rawMaterial) {
        console.log(`❌ Item ${item.productId} não encontrado em Product nem RawMaterial`)
        return NextResponse.json(
          { error: `Item ${item.productId} não encontrado` },
          { status: 404 }
        )
      }

      // Determinar nome e preço baseado no tipo de item
      const itemName = isRawMaterial ? rawMaterial!.name : product!.name
      let price: number

      if (isRawMaterial) {
        // Para matérias-primas, usar priceWholesale ou costPerUnit
        price = Number(rawMaterial!.priceWholesale) || Number(rawMaterial!.costPerUnit) || 0
        console.log(`🥓 Matéria-prima: ${itemName}, Preço: R$ ${price.toFixed(2)}`)
      } else {
        // Para produtos, aplicar lógica de preços com PROMOÇÃO SEMPRE PREVALECENDO
        const basePrice = orderType === 'WHOLESALE' ? Number(product!.priceWholesale) : Number(product!.priceRetail)
        
        // 🏷️ NOVA LÓGICA: Promoção vale para TODOS os métodos EXCETO boleto
        // Cartão: promoção aplica, mas taxa de cartão é obrigatória (tratada no cálculo de fees)
        const isBoletoPayment = paymentMethod === 'BOLETO'
        
        const hasPromotion = product!.isOnPromotion && product!.promotionalPrice
        const customPrice = customPrices.get(item.productId)
        const hasBulkDiscount = product!.bulkDiscountMinQty && product!.bulkDiscountPrice && item.quantity >= product!.bulkDiscountMinQty
        const bulkDiscountPrice = hasBulkDiscount ? Number(product!.bulkDiscountPrice) : null
        
        // 🏷️ PRIORIDADE 1: PROMOÇÃO SEMPRE PREVALECE (exceto boleto)
        if (hasPromotion && !isBoletoPayment) {
          price = Number(product!.promotionalPrice)
          hasPromotionalItemInCart = true  // 🏷️ Marcar que tem item em promoção
          if (customPrice) {
            console.log(`🏷️ PROMOÇÃO PREVALECE sobre catálogo! Produto: ${itemName}, Catálogo: R$ ${customPrice.toFixed(2)} → Promocional: R$ ${price.toFixed(2)} (${paymentMethod})`)
          } else {
            console.log(`🏷️ PROMOÇÃO aplicada! Produto: ${itemName}, Preço: R$ ${basePrice.toFixed(2)} → R$ ${price.toFixed(2)} (${paymentMethod})`)
          }
        }
        // 🏷️ PRIORIDADE 2: MENOR PREÇO entre catálogo personalizado e desconto por quantidade
        else if (customPrice && hasBulkDiscount && bulkDiscountPrice) {
          // Usar o MENOR preço entre catálogo e desconto por quantidade
          if (bulkDiscountPrice < customPrice) {
            price = bulkDiscountPrice
            console.log(`💰 DESCONTO POR QUANTIDADE é MENOR que catálogo! Produto: ${itemName}, Catálogo: R$ ${customPrice.toFixed(2)} → Desconto: R$ ${price.toFixed(2)} (qtd ${item.quantity} >= ${product!.bulkDiscountMinQty})`)
          } else {
            price = customPrice
            console.log(`📋 CATÁLOGO é MENOR/IGUAL ao desconto! Produto: ${itemName}, Desconto: R$ ${bulkDiscountPrice.toFixed(2)} → Catálogo: R$ ${price.toFixed(2)}`)
          }
        }
        // 🏷️ PRIORIDADE 3: Só catálogo personalizado (sem desconto por quantidade aplicável)
        else if (customPrice) {
          price = customPrice
          console.log(`📋 Preço do catálogo personalizado: ${itemName}, Preço: R$ ${price.toFixed(2)}`)
          if (hasPromotion && isBoletoPayment) {
            console.log(`⚠️ Promoção NÃO aplicada (BOLETO). Usando catálogo.`)
          }
        }
        // 🏷️ PRIORIDADE 4: Só desconto progressivo por quantidade (sem catálogo)
        else if (hasBulkDiscount && bulkDiscountPrice) {
          price = bulkDiscountPrice
          console.log(`💰 Desconto progressivo aplicado! Produto: ${itemName}, Qtd: ${item.quantity} >= ${product!.bulkDiscountMinQty}, Preço: R$ ${basePrice.toFixed(2)} → R$ ${price.toFixed(2)}`)
        }
        // 🏷️ PRIORIDADE 5: Preço base (atacado ou varejo)
        else {
          price = basePrice
          if (hasPromotion && isBoletoPayment) {
            console.log(`⚠️ Promoção NÃO aplicada (BOLETO). Produto: ${itemName}, Preço: R$ ${price.toFixed(2)}`)
          }
        }
      }

      const itemTotal = item.isGift ? 0 : price * item.quantity

      // 🆕 Determinar se é produto ou matéria-prima para criar OrderItem corretamente
      const orderItemData: any = {
        quantity: item.quantity,
        unitPrice: item.isGift ? 0 : price,
        total: itemTotal,
        isGift: item.isGift || false
      }

      // Se for matéria-prima, usar rawMaterialId; senão, usar productId
      if (isRawMaterial) {
        orderItemData.rawMaterialId = item.productId
        console.log(`🥓 Item é matéria-prima: rawMaterialId=${item.productId}`)
      } else {
        orderItemData.productId = item.productId
        console.log(`📦 Item é produto: productId=${item.productId}`)
      }

      itemsWithPrices.push(orderItemData)

      subtotal += itemTotal
      
      // 🔒 VALIDAÇÃO: Verificar se o preço calculado pelo backend bate com o esperado pelo frontend
      const expectedPrice = item.expectedUnitPrice
      if (expectedPrice !== undefined && Math.abs(price - expectedPrice) > 0.01) {
        console.error(`❌ DIFERENÇA DE PREÇO DETECTADA!`)
        console.error(`   Produto: ${itemName}`)
        console.error(`   Preço Frontend: R$ ${expectedPrice.toFixed(2)}`)
        console.error(`   Preço Backend: R$ ${price.toFixed(2)}`)
        console.error(`   Diferença: R$ ${Math.abs(price - expectedPrice).toFixed(2)}`)
        
        return NextResponse.json({
          error: `Preço divergente detectado para "${itemName}". Frontend: R$ ${expectedPrice.toFixed(2)}, Backend: R$ ${price.toFixed(2)}. Por favor, atualize a página e tente novamente.`,
          code: 'PRICE_MISMATCH',
          details: {
            productName: itemName,
            frontendPrice: expectedPrice,
            backendPrice: price
          }
        }, { status: 400 })
      }
    }

    // Aplicar desconto
    // 🔧 CORREÇÃO: Processar desconto percentual OU fixo
    let finalDiscountAmount = 0
    if (discountPercent && discountPercent > 0) {
      // Desconto percentual sobre o subtotal
      finalDiscountAmount = (subtotal * discountPercent) / 100
      console.log(`💰 [ADMIN_ORDERS] Desconto PERCENTUAL: ${discountPercent}% de R$ ${subtotal.toFixed(2)} = R$ ${finalDiscountAmount.toFixed(2)}`)
    } else if (discountAmount && discountAmount > 0) {
      // Desconto fixo em reais
      finalDiscountAmount = Number(discountAmount)
      console.log(`💰 [ADMIN_ORDERS] Desconto FIXO: R$ ${finalDiscountAmount.toFixed(2)}`)
    }
    
    let total = subtotal - finalDiscountAmount

    // 🏷️ Verificar se cartão + item em promoção = taxa obrigatória
    const isCardPayment = paymentMethod === 'CREDIT_CARD' || paymentMethod === 'DEBIT'
    const forceCardFee = hasPromotionalItemInCart && isCardPayment

    // Calcular taxa de cartão
    // ⚠️ Aplicar taxa de cartão (apenas se não houver isenção, MAS FORÇAR se promoção + cartão)
    console.log(`💳 [ADMIN_ORDERS] exemptCardFee recebido: ${exemptCardFee}, hasPromotionalItemInCart: ${hasPromotionalItemInCart}, forceCardFee: ${forceCardFee}`)
    
    let cardFee = 0
    if (!exemptCardFee || forceCardFee) {
      if (paymentMethod === 'CREDIT_CARD') {
        cardFee = total * 0.035
        console.log(`💳 Taxa de crédito aplicada: R$ ${cardFee.toFixed(2)} (3.5%)${forceCardFee ? ' - OBRIGATÓRIA (item promocional)' : ''}`)
      } else if (paymentMethod === 'DEBIT') {
        cardFee = total * 0.01
        console.log(`💳 Taxa de débito aplicada: R$ ${cardFee.toFixed(2)} (1%)${forceCardFee ? ' - OBRIGATÓRIA (item promocional)' : ''}`)
      }

      if (secondaryPaymentMethod) {
        if (secondaryPaymentMethod === 'CREDIT_CARD') {
          const secondaryFee = (parseFloat(secondaryPaymentAmount) || 0) * 0.035
          cardFee += secondaryFee
          console.log(`💳 Taxa secundária de crédito: R$ ${secondaryFee.toFixed(2)}`)
        } else if (secondaryPaymentMethod === 'DEBIT') {
          const secondaryFee = (parseFloat(secondaryPaymentAmount) || 0) * 0.01
          cardFee += secondaryFee
          console.log(`💳 Taxa secundária de débito: R$ ${secondaryFee.toFixed(2)}`)
        }
      }
    } else if (exemptCardFee && !forceCardFee) {
      console.log(`✅ Taxa de cartão ISENTADA (exemptCardFee=true)`)
    }

    // 🎫 Calcular taxa de boleto - R$ 2,50
    console.log(`🎫 [ADMIN_ORDERS] exemptBoletoFee recebido: ${exemptBoletoFee}`)
    
    let boletoFee = 0
    if (!exemptBoletoFee) {
      if (paymentMethod === 'BOLETO') {
        boletoFee = 2.50
        console.log(`🎫 Taxa de boleto aplicada: R$ ${boletoFee.toFixed(2)}`)
      }
      if (secondaryPaymentMethod === 'BOLETO') {
        boletoFee += 2.50
        console.log(`🎫 Taxa secundária de boleto: R$ 2.50`)
      }
    } else {
      console.log(`✅ Taxa de boleto ISENTADA (exemptBoletoFee=true)`)
    }

    total += cardFee + boletoFee + deliveryFee
    console.log(`📦 [ADMIN_ORDERS] Total Final: R$ ${total.toFixed(2)} (subtotal=${subtotal.toFixed(2)} - desconto=${finalDiscountAmount.toFixed(2)} + cartão=${cardFee.toFixed(2)} + boleto=${boletoFee.toFixed(2)} + entrega=${deliveryFee.toFixed(2)})`)

    // Gerar número do pedido
    const orderNumber = `ADM-${Date.now()}`

    // 🆕 Funcionários não podem usar BOLETO ou NOTINHA (CREDIT)
    if (isEmployee && (paymentMethod === 'BOLETO' || paymentMethod === 'CREDIT' ||
                       secondaryPaymentMethod === 'BOLETO' || secondaryPaymentMethod === 'CREDIT')) {
      return NextResponse.json(
        { error: '⚠️ Funcionários não podem usar BOLETO ou NOTINHA. Use PIX, Dinheiro, Cartão de Crédito ou Débito.' },
        { status: 400 }
      )
    }

    // Validar limite de crédito para boleto ou notinha (apenas clientes)
    const usesCreditLimit = !isEmployee && (paymentMethod === 'BOLETO' || paymentMethod === 'CREDIT' ||
                            secondaryPaymentMethod === 'BOLETO' || secondaryPaymentMethod === 'CREDIT')

    if (usesCreditLimit) {
      let creditAmount = 0
      if (paymentMethod === 'BOLETO' || paymentMethod === 'CREDIT') {
        creditAmount += (primaryPaymentAmount || total)
      }
      if (secondaryPaymentMethod === 'BOLETO' || secondaryPaymentMethod === 'CREDIT') {
        creditAmount += (secondaryPaymentAmount || 0)
      }

      if (customer.availableCredit < creditAmount) {
        return NextResponse.json(
          { error: `Limite insuficiente. Disponível: R$ ${customer.availableCredit.toFixed(2)}, Necessário: R$ ${creditAmount.toFixed(2)}` },
          { status: 400 }
        )
      }
    }

    // Determinar status inicial (CONSUMIDOR FINAL já é entregue)
    const initialStatus = customer.customerType === 'CONSUMIDOR_FINAL' ? 'DELIVERED' : 'PENDING'
    
    // 🆕 Determinar paymentStatus baseado em isAlreadyPaid e customerType
    const initialPaymentStatus: 'UNPAID' | 'PAID' | 'PARTIAL' = (isAlreadyPaid || customer.customerType === 'CONSUMIDOR_FINAL') ? 'PAID' : 'UNPAID'

    console.log('💰 Status de Pagamento:', {
      isAlreadyPaid,
      customerType: customer.customerType,
      initialPaymentStatus,
      bankAccountId
    })

    // Criar pedido em uma transação
    const order = await prisma.$transaction(async (tx: any) => {
      const createdOrder = await tx.order.create({
        data: {
          id: crypto.randomUUID(),
          orderNumber,
          // 🔧 CORREÇÃO: Usar sintaxe de relação em vez de ID direto
          ...(isEmployee ? {} : customerId ? { Customer: { connect: { id: customerId } } } : {}),
          ...(isEmployee && employeeId ? { Employee: { connect: { id: employeeId } } } : {}),
          User: { connect: { id: (session.user as any).id } }, // ID do admin que criou o pedido
          ...(isEmployee ? 
            (employee?.sellerId ? { Seller: { connect: { id: employee.sellerId } } } : {}) : 
            (customer.sellerId ? { Seller: { connect: { id: customer.sellerId } } } : {})),
          createdByUserId: (session.user as any).id, // Quem realmente criou o pedido
          createdByRole: 'ADMIN', // Admin criou o pedido
          customerName: customer.name,
          casualCustomerName: casualCustomerName || null, // 🆕 Nome do cliente avulso
          customerPhone: customer.phone || '',
          customerEmail: customer.email || '',
          address: isEmployee ? null : customer.address,
          city: isEmployee ? null : customer.city,
          orderType,
          deliveryType,
          deliveryDate: deliveryDate ? new Date(deliveryDate + 'T12:00:00.000Z') : null,
          deliveryTime,
          paymentMethod,
          secondaryPaymentMethod,
          primaryPaymentAmount,
          secondaryPaymentAmount,
          subtotal,
          discount: finalDiscountAmount,
          discountPercent: discountPercent || 0,
          cardFee,
          boletoFee,
          total,
          notes,
          status: initialStatus, // 🆕 CONSUMIDOR_FINAL já é DELIVERED
          paymentStatus: initialPaymentStatus, // 🆕 Definir status de pagamento
          paidAmount: initialPaymentStatus === 'PAID' ? total : 0, // 🆕 Definir valor pago
          updatedAt: new Date(),
          OrderItem: {
            create: itemsWithPrices.map((item: any) => ({
              id: crypto.randomUUID(),
              ...item
            }))
          }
        },
        include: {
          OrderItem: {
            include: {
              Product: true,
              RawMaterial: true // 🆕 Incluir matérias-primas também
            }
          },
          Customer: true
        }
      })

      // Criar comissão se o cliente tiver um vendedor associado
      // 🆕 NÃO criar comissão para funcionários (eles não geram comissão própria)
      if (!isEmployee && customer.sellerId) {
        const seller = await tx.seller.findUnique({
          where: { id: customer.sellerId }
        })

        if (seller && seller.isActive) {
          const commissionAmount = (total * seller.commissionRate) / 100
          
          await tx.commission.create({
            data: {
              id: crypto.randomUUID(),
              sellerId: customer.sellerId,
              orderId: createdOrder.id,
              amount: commissionAmount,
              description: `Comissão do pedido ${orderNumber} (Admin)`,
              status: 'PENDING',
              updatedAt: new Date()
            }
          })
          
          console.log(`✅ Comissão criada: R$ ${commissionAmount.toFixed(2)} para vendedor ${seller.name}`)
        }
      } else if (isEmployee) {
        console.log('🏠 Pedido de FUNCIONÁRIO - Comissão NÃO criada (pedido próprio)')
      }

      // 💳 Criar CardTransaction para pagamentos com cartão
      console.log(`🔍 Verificando criação de CardTransaction...`)
      console.log(`   paymentMethod: ${paymentMethod}`)
      console.log(`   secondaryPaymentMethod: ${secondaryPaymentMethod}`)
      
      // Métodos de pagamento que são considerados "cartão"
      const isCardPayment = ['CREDIT_CARD', 'DEBIT', 'CARD'].includes(paymentMethod)
      const isSecondaryCardPayment = ['CREDIT_CARD', 'DEBIT', 'CARD'].includes(secondaryPaymentMethod || '')
      
      if (isCardPayment || isSecondaryCardPayment) {
        
        // Array para armazenar os pagamentos que serão processados
        const cardPayments: Array<{ cardType: 'DEBIT' | 'CREDIT', amount: number }> = []
        
        // Adicionar pagamento primário se for cartão
        // CARD genérico é tratado como DEBIT (débito) por padrão
        if (paymentMethod === 'CREDIT_CARD') {
          cardPayments.push({ cardType: 'CREDIT', amount: primaryPaymentAmount || total })
        } else if (paymentMethod === 'DEBIT' || paymentMethod === 'CARD') {
          cardPayments.push({ cardType: 'DEBIT', amount: primaryPaymentAmount || total })
        }
        
        // Adicionar pagamento secundário se for cartão
        if (secondaryPaymentMethod === 'CREDIT_CARD') {
          cardPayments.push({ cardType: 'CREDIT', amount: secondaryPaymentAmount || 0 })
        } else if (secondaryPaymentMethod === 'DEBIT' || secondaryPaymentMethod === 'CARD') {
          cardPayments.push({ cardType: 'DEBIT', amount: secondaryPaymentAmount || 0 })
        }
        
        console.log(`📝 Total de pagamentos com cartão: ${cardPayments.length}`)
        
        // Processar cada pagamento com cartão
        for (const payment of cardPayments) {
          try {
            // Buscar configuração de taxa do cartão
            const feeConfig = await tx.cardFeeConfig.findFirst({
              where: { cardType: payment.cardType, isActive: true }
            })
            
            const feePercentage = feeConfig?.feePercentage || (payment.cardType === 'DEBIT' ? 0.9 : 3.24)
            const feeAmount = payment.amount * (feePercentage / 100)
            const netAmount = payment.amount - feeAmount
            
            // Calcular data esperada de recebimento
            const expectedDate = new Date()
            expectedDate.setDate(expectedDate.getDate() + (payment.cardType === 'DEBIT' ? 1 : 30))
            
            console.log(`  💳 Criando CardTransaction:`)
            console.log(`    - Tipo: ${payment.cardType}`)
            console.log(`    - Valor Bruto: R$ ${payment.amount.toFixed(2)}`)
            console.log(`    - Taxa: ${feePercentage}% (R$ ${feeAmount.toFixed(2)})`)
            console.log(`    - Valor Líquido: R$ ${netAmount.toFixed(2)}`)
            console.log(`    - Data Esperada: ${expectedDate.toISOString()}`)
            
            await tx.cardTransaction.create({
              data: {
                id: crypto.randomUUID(),
                orderId: createdOrder.id,
                customerId: customerId || undefined,
                cardType: payment.cardType,
                grossAmount: payment.amount,
                feePercentage,
                feeAmount,
                netAmount,
                status: 'PENDING',
                saleDate: new Date(),
                expectedDate,
              }
            })
            
            console.log(`  ✅ Transação com cartão ${payment.cardType} criada com sucesso!`)
          } catch (txError) {
            console.error(`  ❌ ERRO ao criar transação de cartão:`, txError)
            throw txError // Re-throw para causar rollback da transação principal
          }
        }
      } else {
        console.log(`  ℹ️ Nenhum pagamento com cartão detectado, pulando criação de CardTransaction`)
      }

      // Criar boleto(s) se o pagamento for BOLETO
      if (paymentMethod === 'BOLETO' || secondaryPaymentMethod === 'BOLETO') {
        // ⚠️ VALIDAÇÃO CRÍTICA: Boleto requer customerId (não funciona para Consumidor Final ou Funcionários)
        if (!customerId || isEmployee) {
          throw new Error('❌ Boleto não pode ser usado para "Consumidor Final" ou "Funcionário". Use dinheiro, PIX ou cartão.')
        }
        
        const boletoAmount = paymentMethod === 'BOLETO' ? (primaryPaymentAmount || total) : (secondaryPaymentAmount || 0)
        
        // Verificar se tem parcelamento
        if (boletoInstallments) {
          // Parse installment option (format: "3x-10-20-30")
          const parts = boletoInstallments.split('x-')
          if (parts.length === 2) {
            const numInstallments = parseInt(parts[0])
            const daysString = parts[1]
            const daysList = daysString.split('-').map((d: string) => parseInt(d))

            if (numInstallments > 0 && daysList.length === numInstallments) {
              // Criar múltiplos boletos (parcelas)
              const installmentAmount = boletoAmount / numInstallments
              
              // Definir datas de vencimento
              for (let i = 0; i < numInstallments; i++) {
                const dueDate = new Date()
                dueDate.setDate(dueDate.getDate() + daysList[i])
                const boletoNumber = `BOL${Date.now().toString().slice(-8)}-${i + 1}`
                
                await tx.boleto.create({
                  data: {
                    id: crypto.randomUUID(),
                    boletoNumber,
                    customerId,
                    orderId: createdOrder.id,
                    amount: installmentAmount,
                    dueDate,
                    status: 'PENDING',
                    isInstallment: true,
                    installmentNumber: i + 1,
                    totalInstallments: numInstallments,
                    updatedAt: new Date()
                  }
                })
                
                // Pequeno delay para garantir número único
                await new Promise(resolve => setTimeout(resolve, 10))
              }
            } else {
              // Criar boleto único
              const boletoNumber = `BOL${Date.now().toString().slice(-8)}`
              const dueDate = new Date()
              // 🔧 CORREÇÃO: Cliente avulso = prazo 0 (mesmo dia)
              const isCasualCustomer = !!casualCustomerName && !customerId
              const paymentDays = isCasualCustomer ? 0 : (customer?.paymentTerms || 30)
              dueDate.setDate(dueDate.getDate() + paymentDays)

              await tx.boleto.create({
                data: {
                  id: crypto.randomUUID(),
                  boletoNumber,
                  customerId,
                  orderId: createdOrder.id,
                  amount: boletoAmount,
                  dueDate,
                  status: 'PENDING',
                  updatedAt: new Date()
                }
              })
            }
          } else {
            // Criar boleto único
            const boletoNumber = `BOL${Date.now().toString().slice(-8)}`
            const dueDate = new Date()
            // 🔧 CORREÇÃO: Cliente avulso = prazo 0 (mesmo dia)
            const isCasualCustomer = !!casualCustomerName && !customerId
            const paymentDays = isCasualCustomer ? 0 : (customer?.paymentTerms || 30)
            dueDate.setDate(dueDate.getDate() + paymentDays)

            await tx.boleto.create({
              data: {
                id: crypto.randomUUID(),
                boletoNumber,
                customerId,
                orderId: createdOrder.id,
                amount: boletoAmount,
                dueDate,
                status: 'PENDING',
                updatedAt: new Date()
              }
            })
          }
        } else {
          // Criar boleto único (sem parcelamento)
          const boletoNumber = `BOL${Date.now().toString().slice(-8)}`
          const dueDate = new Date()
          // 🔧 CORREÇÃO: Cliente avulso = prazo 0 (mesmo dia)
          const isCasualCustomer = !!casualCustomerName && !customerId
          const paymentDays = isCasualCustomer ? 0 : (customer?.paymentTerms || 30)
          dueDate.setDate(dueDate.getDate() + paymentDays)

          await tx.boleto.create({
            data: {
              id: crypto.randomUUID(),
              boletoNumber,
              customerId,
              orderId: createdOrder.id,
              amount: boletoAmount,
              dueDate,
              status: 'PENDING',
              updatedAt: new Date()
            }
          })
        }
      }

      // 📦 DECREMENTAR ESTOQUE DOS PRODUTOS VENDIDOS
      console.log('📦 [ESTOQUE] Decrementando estoque dos produtos vendidos...')
      
      for (const item of itemsWithPrices) {
        if (item.productId) {
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
                reason: `Venda - Pedido ${orderNumber}`,
                notes: `Cliente: ${customer.name} | Criado por Admin`,
                referenceId: createdOrder.id,
                performedBy: session.user?.name || 'Admin',
                performedById: (session.user as any).id || null
              }
            })
            
            console.log(`   ✅ ${product.name}: ${previousStock} → ${newStock} (vendido: ${item.quantity})`)
          }
        }
      }

      return createdOrder
    })

    // 🆕 Descontar limite do FUNCIONÁRIO (se aplicável)
    if (isEmployee && employeeId) {
      try {
        await prisma.employee.update({
          where: { id: employeeId },
          data: {
            creditLimit: {
              decrement: total
            }
          }
        })
        console.log(`🏠 ✅ Limite descontado do FUNCIONÁRIO: R$ ${total.toFixed(2)} de ${customer.name}`)
      } catch (limitError) {
        console.error('❌ Erro ao descontar limite do funcionário:', limitError)
      }
    }

    // Atualizar crédito para pagamento CREDIT (notinha) - apenas para clientes
    if (!isEmployee && (paymentMethod === 'CREDIT' || secondaryPaymentMethod === 'CREDIT')) {
      let creditAmount = 0
      if (paymentMethod === 'CREDIT') {
        creditAmount += (primaryPaymentAmount || total)
      }
      if (secondaryPaymentMethod === 'CREDIT') {
        creditAmount += (secondaryPaymentAmount || 0)
      }

      try {
        await prisma.customer.update({
          where: { id: customerId },
          data: {
            availableCredit: {
              decrement: creditAmount
            }
          }
        })
        console.log(`✅ Crédito descontado (Admin): R$ ${creditAmount.toFixed(2)} do cliente ${customer.name}`)
      } catch (creditError) {
        console.error('❌ Erro ao descontar crédito:', creditError)
      }
    }

    // Gerar Boleto + PIX para os boletos criados - APENAS PARA CLIENTES
    if (!isEmployee && (paymentMethod === 'BOLETO' || secondaryPaymentMethod === 'BOLETO')) {
      const boletoAmount = paymentMethod === 'BOLETO' ? (primaryPaymentAmount || total) : (secondaryPaymentAmount || 0)
      
      try {
        // Atualizar crédito disponível do cliente (para boleto)
        await prisma.customer.update({
          where: { id: customerId },
          data: {
            availableCredit: {
              decrement: boletoAmount
            }
          }
        })

        // Buscar boletos criados para esse pedido
        const boletos = await prisma.boleto.findMany({
          where: { orderId: order.id }
        })

        // Verificar se Cora está configurada
        const usesCora = await isCoraConfigured()
        console.log('\n🔍 Sistema de pagamento:', usesCora ? 'CORA' : 'Mercado Pago')
        
        for (const boleto of boletos) {
          try {
            // Create description
            let description = `Pedido #${order.orderNumber}`
            if (boleto.isInstallment && boleto.installmentNumber && boleto.totalInstallments) {
              description += ` - Parcela ${boleto.installmentNumber}/${boleto.totalInstallments}`
            }

            if (usesCora) {
              // ===== USAR CORA =====
              console.log(`\n💳 Gerando boleto com CORA para: ${boleto.boletoNumber}`)
              
              // Validar se cliente tem CPF/CNPJ cadastrado
              if (!customer.cpfCnpj || customer.cpfCnpj.trim() === '') {
                throw new Error(`Cliente ${customer.name} não possui CPF/CNPJ cadastrado. O CPF/CNPJ é obrigatório para gerar boletos.`)
              }
              
              // Formatar CPF/CNPJ
              const cpfCnpj = customer.cpfCnpj.replace(/\D/g, '')
              
              // Validar tamanho do documento
              if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
                throw new Error(`CPF/CNPJ inválido para o cliente ${customer.name}. O CPF deve ter 11 dígitos e o CNPJ 14 dígitos.`)
              }
              
              // Formatar data de vencimento (YYYY-MM-DD)
              const dueDateStr = boleto.dueDate.toISOString().split('T')[0]
              
              // 🏦 Criar cobrança via Cora (gera boleto + PIX)
              console.log(`🏦 [ADMIN-ORDERS] Gerando boleto na conta Cora: ${coraAccount || 'GENUINO'}`)
              const coraCharge = await createPixCharge({
                code: boleto.boletoNumber,
                customerName: customer.name,
                customerDocument: cpfCnpj,
                customerEmail: customer.email || undefined,
                amount: Math.round(boleto.amount * 100), // Converter para centavos
                dueDate: dueDateStr,
                description,
                account: coraAccount || 'GENUINO' // 🏦 Conta Cora selecionada (padrão: GENUINO)
              })

              console.log('✅ Boleto Cora criado:', {
                id: coraCharge.id,
                barcode: coraCharge.barcode,
                digitableLine: coraCharge.digitable_line,
                pixQrCode: coraCharge.qr_code ? 'Gerado' : 'Não gerado',
                boletoUrl: coraCharge.qr_code_image
              })

              // Gerar QR Code base64 a partir do código copia e cola
              let pixQrCodeBase64: string | undefined
              if (coraCharge.qr_code) {
                try {
                  const qrCodeDataUrl = await QRCode.toDataURL(coraCharge.qr_code)
                  // Remover o prefixo "data:image/png;base64," para salvar apenas a parte base64
                  pixQrCodeBase64 = qrCodeDataUrl.split(',')[1]
                  console.log('✅ QR Code PIX gerado em base64 (tamanho:', pixQrCodeBase64.length, 'chars)')
                } catch (error) {
                  console.error('❌ Erro ao gerar QR Code PIX:', error)
                }
              }

              // Atualizar boleto com dados da Cora
              await prisma.boleto.update({
                where: { id: boleto.id },
                data: {
                  barcodeNumber: coraCharge.barcode,
                  digitableLine: coraCharge.digitable_line,
                  pixQrCode: coraCharge.qr_code,
                  pixQrCodeBase64,
                  boletoUrl: coraCharge.qr_code_image,
                  pixPaymentId: coraCharge.id,
                  coraAccount: coraAccount || 'GENUINO' // 🏦 Salvar conta Cora usada (padrão: GENUINO)
                }
              })

              console.log(`✅ Boleto ${boleto.boletoNumber} atualizado com dados da Cora`)
            } else {
              // ===== USAR MERCADO PAGO =====
              console.log(`\n💳 Gerando PIX com Mercado Pago para: ${boleto.boletoNumber}`)
              
              // Split name into first and last
              const nameParts = customer.name.split(' ')
              const firstName = nameParts[0] || customer.name
              const lastName = nameParts.slice(1).join(' ') || firstName

              // Determine identification type
              const cpfCnpj = (customer.cpfCnpj || '00000000000').replace(/\D/g, '')
              const identificationType = cpfCnpj.length === 11 ? 'CPF' : 'CNPJ'

              // Get notification URL (webhook)
              const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
              const notificationUrl = `${baseUrl}/api/boletos/webhook`

              // Create PIX payment via Mercado Pago
              const pixPayment = await createPixPayment({
                transactionAmount: Number(boleto.amount),
                description,
                payerEmail: customer.email || 'cliente@espetos.com',
                payerFirstName: firstName,
                payerLastName: lastName,
                payerIdentification: {
                  type: identificationType,
                  number: cpfCnpj
                },
                externalReference: boleto.boletoNumber,
                notificationUrl
              })

              // Extract PIX data
              const pixQrCode = pixPayment.point_of_interaction?.transaction_data?.qr_code
              const pixQrCodeBase64 = pixPayment.point_of_interaction?.transaction_data?.qr_code_base64

              // Update boleto with PIX info
              if (pixQrCode && pixQrCodeBase64) {
                await prisma.boleto.update({
                  where: { id: boleto.id },
                  data: {
                    pixQrCode,
                    pixQrCodeBase64,
                    pixPaymentId: pixPayment.id
                  }
                })

                console.log(`✅ Boleto ${boleto.boletoNumber} atualizado com PIX do Mercado Pago`)
              }
            }
          } catch (pixError) {
            console.error(`❌ Erro ao gerar pagamento para boleto ${boleto.boletoNumber}:`, pixError)
            // Continue even if payment generation fails - boleto still exists
          }
        }
      } catch (boletoError) {
        console.error('❌ Erro ao processar boletos:', boletoError)
      }
    }

    // Criar Conta a Receber automaticamente APENAS para métodos que NÃO são BOLETO
    // ⚠️ CRÍTICO: Boleto já representa a cobrança, então não deve criar Receivable duplicado
    // ⚠️ CRÍTICO: Se houver erro aqui, a transação inteira será revertida
    // 🔧 CORRIGIDO: Se houver 2 métodos (ex: Boleto + Dinheiro), criar receivable para o NÃO-BOLETO
    
    const hasCombinedPaymentForReceivable = secondaryPaymentMethod && secondaryPaymentMethod !== null
    const isPrimaryBoleto = paymentMethod === 'BOLETO'
    const isSecondaryBoleto = secondaryPaymentMethod === 'BOLETO'
    
    // Helper function para criar receivable
    const createReceivable = async (method: string, amount: number, description: string) => {
      const dueDate = new Date()
      // 🔧 CORREÇÃO: Cliente avulso = prazo 0 (mesmo dia), cliente cadastrado = paymentTerms ou 30
      const isCasualCustomer = !!casualCustomerName && !customerId
      const paymentDays = isCasualCustomer ? 0 : (customer?.paymentTerms || 30)
      dueDate.setDate(dueDate.getDate() + paymentDays)
      console.log(`   🗓️ Prazo: ${paymentDays} dias (Cliente avulso: ${isCasualCustomer ? 'SIM' : 'NÃO'})`)

      let receivableStatus: 'PENDING' | 'PAID' = 'PENDING'
      let receivedDate = null
      
      // 🔧 CORREÇÃO: O receivable só deve ser marcado como PAID se isAlreadyPaid for true
      // NÃO devemos mais assumir que CASH/CARD/DEBIT são pagos automaticamente
      // O usuário deve marcar explicitamente "Pedido já foi pago" para isso acontecer
      if (isAlreadyPaid) {
        receivableStatus = 'PAID'
        receivedDate = new Date()
        console.log(`   ✅ Receivable marcado como PAID (isAlreadyPaid=true)`)
      } else {
        console.log(`   ⏳ Receivable marcado como PENDING (isAlreadyPaid=false)`)
      }

      console.log(`\n💰 [ADMIN_ORDERS] Criando receivable:`)
      console.log(`   - Pedido: ${order.orderNumber}`)
      console.log(`   - Cliente/Funcionário: ${customer.name}`)
      console.log(`   - É Funcionário: ${isEmployee ? 'SIM' : 'NÃO'}`)
      console.log(`   - Valor: R$ ${amount.toFixed(2)}`)
      console.log(`   - Método: ${method}`)
      console.log(`   - Status: ${receivableStatus}`)
      console.log(`   - Vencimento: ${dueDate.toISOString().split('T')[0]}`)

      const receivableData: any = {
        id: crypto.randomUUID(),
        description,
        amount: Number(amount),
        dueDate,
        status: receivableStatus,
        paymentMethod: method,
        paymentDate: receivedDate,
        Order: {
          connect: { id: order.id }
        }
      }

      if (isEmployee && employeeId) {
        receivableData.Employee = { connect: { id: employeeId } }
        console.log(`   🏠 Conectando Receivable ao FUNCIONÁRIO: ${employeeId}`)
      } else if (order.customerId) {
        receivableData.Customer = { connect: { id: order.customerId } }
        console.log(`   👤 Conectando Receivable ao CLIENTE: ${order.customerId}`)
      }

      const receivable = await prisma.receivable.create({ data: receivableData })

      console.log(`✅ Receivable criado com sucesso: ${receivable.id}`)
      console.log(`   - Status: ${receivableStatus}`)
      console.log(`   - Método: ${method}`)
      console.log(`   - Vinculado a: ${isEmployee ? 'FUNCIONÁRIO' : 'CLIENTE'}`)
      
      return receivable
    }

    // Descrição base para receivables
    const baseDescription = casualCustomerName 
      ? `Pedido ${order.orderNumber} - ${casualCustomerName}`
      : `Pedido ${order.orderNumber}`

    // 🔧 LÓGICA CORRIGIDA: Criar receivables para cada método que NÃO é BOLETO
    if (hasCombinedPaymentForReceivable) {
      // Pagamento combinado (2 métodos)
      // 🔧 CORREÇÃO: Calcular primaryPaymentAmount se estiver null
      const secondaryAmount = Number(secondaryPaymentAmount) || 0
      const calculatedPrimaryAmount = primaryPaymentAmount != null 
        ? Number(primaryPaymentAmount) 
        : Math.max(0, Number(order.total) - secondaryAmount)
      
      console.log(`\n💰 [ADMIN_ORDERS] Pagamento combinado detectado:`)
      console.log(`   - Total do pedido: R$ ${Number(order.total).toFixed(2)}`)
      console.log(`   - Método 1: ${paymentMethod} = R$ ${calculatedPrimaryAmount.toFixed(2)} (original: ${primaryPaymentAmount})`)
      console.log(`   - Método 2: ${secondaryPaymentMethod} = R$ ${secondaryAmount.toFixed(2)}`)
      
      // Criar receivable para método primário se NÃO for BOLETO e valor > 0
      if (!isPrimaryBoleto && calculatedPrimaryAmount > 0) {
        await createReceivable(
          paymentMethod, 
          calculatedPrimaryAmount, 
          `${baseDescription} (${paymentMethod})`
        )
      } else if (isPrimaryBoleto) {
        console.log(`   ⏭️ Método primário é BOLETO - receivable não criado (boleto já representa a cobrança)`)
      } else if (calculatedPrimaryAmount <= 0) {
        console.log(`   ⏭️ Método primário tem valor R$ 0 - receivable não criado`)
      }
      
      // Criar receivable para método secundário se NÃO for BOLETO e valor > 0
      if (!isSecondaryBoleto && secondaryAmount > 0) {
        await createReceivable(
          secondaryPaymentMethod, 
          secondaryAmount, 
          `${baseDescription} (${secondaryPaymentMethod})`
        )
      } else if (isSecondaryBoleto) {
        console.log(`   ⏭️ Método secundário é BOLETO - receivable não criado (boleto já representa a cobrança)`)
      } else if (secondaryAmount <= 0) {
        console.log(`   ⏭️ Método secundário tem valor R$ 0 - receivable não criado`)
      }
    } else {
      // Pagamento único
      if (!isPrimaryBoleto) {
        await createReceivable(paymentMethod, order.total, baseDescription)
      } else {
        console.log(`\n💰 [ADMIN_ORDERS] Receivable NÃO criado (pagamento único via BOLETO - o boleto já representa a cobrança)`)
      }
    }

    // 🆕 Criar transação(ões) bancária(s) se o pagamento já foi recebido
    // ⚠️ IMPORTANTE: NÃO criar transação para CARTÃO (débito/crédito)
    //    Esses valores caem em D+1 ou D+30 e devem ser confirmados na "Gestão de Cartões"
    const hasCombinedPayment = secondaryPaymentMethod && secondaryPaymentMethod !== null
    const isPrimaryCardPayment = paymentMethod === 'DEBIT' || paymentMethod === 'CREDIT_CARD'
    const isSecondaryCardPayment = secondaryPaymentMethod === 'DEBIT' || secondaryPaymentMethod === 'CREDIT_CARD'
    
    console.log(`💳 [ADMIN_ORDERS] Verificação de transação bancária:`)
    console.log(`   - isAlreadyPaid: ${isAlreadyPaid}`)
    console.log(`   - hasCombinedPayment: ${hasCombinedPayment}`)
    console.log(`   - primaryBankAccountId: ${finalPrimaryBankAccountId}`)
    console.log(`   - secondaryBankAccountId: ${secondaryBankAccountId}`)
    console.log(`   - paymentMethod: ${paymentMethod}`)
    console.log(`   - secondaryPaymentMethod: ${secondaryPaymentMethod}`)
    
    if (isAlreadyPaid) {
      try {
        // 💜 PIX: Se foi pago via PIX, buscar dados da cobrança para usar conta Cora correta
        let pixChargeData: { coraAccount: string; feeAmount: number; netAmount: number } | null = null
        if (pixChargeId && pixPaid) {
          const pixCharge = await prisma.pixCharge.findUnique({
            where: { id: pixChargeId },
            select: { coraAccount: true, feeAmount: true, netAmount: true }
          })
          if (pixCharge) {
            pixChargeData = {
              coraAccount: pixCharge.coraAccount,
              feeAmount: Number(pixCharge.feeAmount),
              netAmount: Number(pixCharge.netAmount)
            }
            console.log(`💜 [PIX] Cobrança encontrada:`, pixChargeData)
          }
        }

        // 💜 Função auxiliar para buscar conta Cora pelo nome
        const getCoraBankAccount = async (coraAccount: string) => {
          console.log(`💜 [PIX] Buscando conta Cora para: ${coraAccount}`)
          
          // Busca case-insensitive usando raw query
          const searchTerm = coraAccount === 'ESPETOS' ? 'espetos' : 'genuino'
          const accounts = await prisma.bankAccount.findMany({
            where: { isActive: true },
            select: { id: true, name: true, balance: true }
          })
          
          // Buscar conta que contenha "cora" e o termo (espetos/genuino) - case insensitive
          let account = accounts.find(a => 
            a.name.toLowerCase().includes('cora') && 
            a.name.toLowerCase().includes(searchTerm)
          )
          
          if (account) {
            console.log(`💜 [PIX] ✅ Conta encontrada: ${account.name}`)
            return account
          }
          
          // Fallback: buscar qualquer conta com "cora"
          account = accounts.find(a => a.name.toLowerCase().includes('cora'))
          if (account) {
            console.log(`💜 [PIX] ⚠️ Fallback - Conta Cora genérica: ${account.name}`)
            return account
          }
          
          console.log(`💜 [PIX] ❌ Nenhuma conta Cora encontrada`)
          return null
        }

        // 🆕 Transação 1: Método Primário
        const isPrimaryPix = paymentMethod === 'PIX'
        const isPrimaryCash = paymentMethod === 'CASH'
        if (!isPrimaryCardPayment) {
          // 🔧 CORREÇÃO: Calcular primaryPaymentAmount se estiver null (pagamento combinado)
          const secondaryAmtForCalc = Number(secondaryPaymentAmount) || 0
          let primaryAmount = hasCombinedPayment 
            ? (primaryPaymentAmount != null ? Number(primaryPaymentAmount) : Math.max(0, Number(order.total) - secondaryAmtForCalc))
            : Number(order.total)
          let targetBankAccountId = finalPrimaryBankAccountId
          let pixFee = 0

          // 💵 Se for CASH e cashReceivedAmount foi informado, usar o valor recebido (não o valor do pedido)
          if (isPrimaryCash && cashReceivedAmount != null && Number(cashReceivedAmount) > 0) {
            const originalAmount = primaryAmount
            primaryAmount = Number(cashReceivedAmount)
            console.log(`💵 [CASH] Usando valor recebido: R$ ${primaryAmount.toFixed(2)} (pedido: R$ ${originalAmount.toFixed(2)}, troco: R$ ${(primaryAmount - originalAmount).toFixed(2)})`)
          }

          // 💜 Se for PIX, usar conta Cora e descontar taxa
          if (isPrimaryPix && pixChargeData) {
            const coraBankAccount = await getCoraBankAccount(pixChargeData.coraAccount)
            if (coraBankAccount) {
              targetBankAccountId = coraBankAccount.id
              pixFee = pixChargeData.feeAmount
              primaryAmount = pixChargeData.netAmount // Usar valor líquido
              console.log(`💜 [PIX] Usando conta Cora: ${coraBankAccount.name} | Bruto: R$ ${(pixChargeData.netAmount + pixFee).toFixed(2)} | Taxa: R$ ${pixFee.toFixed(2)} | Líquido: R$ ${primaryAmount.toFixed(2)}`)
            } else {
              console.log(`⚠️ [PIX] Conta Cora não encontrada, usando conta selecionada`)
            }
          }

          // 🔧 CORREÇÃO: Só criar transação se valor > 0
          if (primaryAmount > 0 && targetBankAccountId) {
            const bankAccount = await prisma.bankAccount.findUnique({
              where: { id: targetBankAccountId },
              select: { id: true, name: true, balance: true }
            })

            if (bankAccount) {
              const newBalance = Number(bankAccount.balance) + primaryAmount
              
              // Buscar nome do cliente
              let customerName = casualCustomerName || 'Cliente não identificado'
              if (customerId) {
                const customer = await prisma.customer.findUnique({
                  where: { id: customerId },
                  select: { name: true }
                })
                if (customer) customerName = customer.name
              }

              // Descrição com info da taxa se for PIX
              const description = isPrimaryPix && pixFee > 0
                ? `Recebimento - Pedido ${order.orderNumber} - Cliente: ${customerName} (PIX - Líquido, Taxa: R$ ${pixFee.toFixed(2)})`
                : `Recebimento - Pedido ${order.orderNumber} - Cliente: ${customerName} (${paymentMethod})`

              // Buscar receivable associado para vincular à transação
              const linkedReceivable = await prisma.receivable.findFirst({
                where: { orderId: order.id, paymentMethod: paymentMethod }
              })

              await prisma.transaction.create({
                data: {
                  id: crypto.randomUUID(),
                  bankAccountId: targetBankAccountId,
                  type: 'INCOME',
                  amount: primaryAmount,
                  description,
                  category: 'VENDAS',
                  balanceAfter: newBalance,
                  date: new Date(),
                  createdAt: new Date(),
                  // 🔗 VINCULAR À RECEIVABLE PARA PERMITIR REVERSÃO
                  referenceType: 'RECEIVABLE',
                  referenceId: linkedReceivable?.id || order.id
                }
              })

              await prisma.bankAccount.update({
                where: { id: targetBankAccountId },
                data: { balance: newBalance, updatedAt: new Date() }
              })

              // 💜 Atualizar Receivable com a conta bancária
              const receivables = await prisma.receivable.findMany({
                where: { orderId: order.id, paymentMethod: paymentMethod }
              })
              for (const rec of receivables) {
                await prisma.receivable.update({
                  where: { id: rec.id },
                  data: { bankAccountId: targetBankAccountId }
                })
                console.log(`💜 Receivable ${rec.id} atualizado com bankAccountId: ${targetBankAccountId}`)
              }

              console.log(`💰 Transação bancária 1 criada: ${order.orderNumber} - Conta: ${bankAccount.name} - Valor: R$ ${primaryAmount.toFixed(2)}`)
            }
          } else if (primaryAmount <= 0) {
            console.log(`⏭️ Transação do método primário NÃO criada (valor R$ 0)`)
          }
        } else if (isPrimaryCardPayment) {
          console.log(`⏳ Transação do método primário NÃO criada (cartão - aguardando confirmação)`)
        }

        // 🆕 Transação 2: Método Secundário (se houver pagamento combinado)
        const isSecondaryPix = secondaryPaymentMethod === 'PIX'
        const isSecondaryCash = secondaryPaymentMethod === 'CASH'
        if (hasCombinedPayment && !isSecondaryCardPayment) {
          let secondaryAmount = Number(secondaryPaymentAmount) || 0
          let targetBankAccountId = secondaryBankAccountId
          let pixFee = 0

          // 💵 Se for CASH secundário e cashReceivedAmount foi informado, e o primário NÃO é CASH
          // (se primário for CASH, o cashReceivedAmount já foi usado lá)
          if (isSecondaryCash && !isPrimaryCash && cashReceivedAmount != null && Number(cashReceivedAmount) > 0) {
            const originalAmount = secondaryAmount
            secondaryAmount = Number(cashReceivedAmount)
            console.log(`💵 [CASH 2] Usando valor recebido: R$ ${secondaryAmount.toFixed(2)} (esperado: R$ ${originalAmount.toFixed(2)}, diferença: R$ ${(secondaryAmount - originalAmount).toFixed(2)})`)
          }

          // 💜 Se for PIX secundário, usar conta Cora e descontar taxa
          if (isSecondaryPix && pixChargeData) {
            const coraBankAccount = await getCoraBankAccount(pixChargeData.coraAccount)
            if (coraBankAccount) {
              targetBankAccountId = coraBankAccount.id
              pixFee = pixChargeData.feeAmount
              secondaryAmount = pixChargeData.netAmount // Usar valor líquido
              console.log(`💜 [PIX 2] Usando conta Cora: ${coraBankAccount.name} | Líquido: R$ ${secondaryAmount.toFixed(2)}`)
            }
          }

          // 🔧 CORREÇÃO: Só criar transação se valor > 0
          if (secondaryAmount > 0 && targetBankAccountId) {
            const bankAccount = await prisma.bankAccount.findUnique({
              where: { id: targetBankAccountId },
              select: { id: true, name: true, balance: true }
            })

            if (bankAccount) {
              const newBalance = Number(bankAccount.balance) + secondaryAmount
              
              // Buscar nome do cliente
              let customerName = casualCustomerName || 'Cliente não identificado'
              if (customerId) {
                const customer = await prisma.customer.findUnique({
                  where: { id: customerId },
                  select: { name: true }
                })
                if (customer) customerName = customer.name
              }

              const description = isSecondaryPix && pixFee > 0
                ? `Recebimento - Pedido ${order.orderNumber} - Cliente: ${customerName} (PIX - Líquido, Taxa: R$ ${pixFee.toFixed(2)})`
                : `Recebimento - Pedido ${order.orderNumber} - Cliente: ${customerName} (${secondaryPaymentMethod})`

              // Buscar receivable secundário associado para vincular à transação
              const linkedReceivable2 = await prisma.receivable.findFirst({
                where: { orderId: order.id, paymentMethod: secondaryPaymentMethod }
              })

              await prisma.transaction.create({
                data: {
                  id: crypto.randomUUID(),
                  bankAccountId: targetBankAccountId,
                  type: 'INCOME',
                  amount: secondaryAmount,
                  description,
                  category: 'VENDAS',
                  balanceAfter: newBalance,
                  date: new Date(),
                  createdAt: new Date(),
                  // 🔗 VINCULAR À RECEIVABLE PARA PERMITIR REVERSÃO
                  referenceType: 'RECEIVABLE',
                  referenceId: linkedReceivable2?.id || order.id
                }
              })

              await prisma.bankAccount.update({
                where: { id: targetBankAccountId },
                data: { balance: newBalance, updatedAt: new Date() }
              })

              // 💜 Atualizar Receivable secundário com a conta bancária
              const receivables2 = await prisma.receivable.findMany({
                where: { orderId: order.id, paymentMethod: secondaryPaymentMethod }
              })
              for (const rec of receivables2) {
                await prisma.receivable.update({
                  where: { id: rec.id },
                  data: { bankAccountId: targetBankAccountId }
                })
                console.log(`💜 Receivable secundário ${rec.id} atualizado com bankAccountId: ${targetBankAccountId}`)
              }

              console.log(`💰 Transação bancária 2 criada: ${order.orderNumber} - Conta: ${bankAccount.name} - Valor: R$ ${secondaryAmount.toFixed(2)}`)
            }
          } else if (secondaryAmount <= 0) {
            console.log(`⏭️ Transação do método secundário NÃO criada (valor R$ 0)`)
          }
        } else if (hasCombinedPayment && isSecondaryCardPayment) {
          console.log(`⏳ Transação do método secundário NÃO criada (cartão - aguardando confirmação)`)
        }
      } catch (bankError) {
        console.error('❌ Erro ao criar transação bancária:', bankError)
      }
    }

    // 💜 Vincular PixCharge ao pedido
    if (pixChargeId) {
      try {
        await prisma.pixCharge.update({
          where: { id: pixChargeId },
          data: { orderId: order.id }
        })
        console.log(`💜 [PIX] Cobrança ${pixChargeId} vinculada ao pedido ${order.orderNumber}`)
      } catch (pixError) {
        console.error('⚠️ Erro ao vincular PixCharge ao pedido:', pixError)
      }
    }

    // Enviar notificação
    try {
      // Buscar order com items para notificação
      const orderWithItems = await prisma.order.findUnique({
        where: { id: order.id },
        include: { OrderItem: true }
      })

      await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          total: order.total,
          items: orderWithItems?.OrderItem || [],
          isAdmin: true
        })
      })

      // Notificação de novo pedido removida - apenas notificações de mudança de status e pontos devem ser enviadas
    } catch (emailError) {
      console.error('Error sending notification:', emailError)
    }

    return NextResponse.json({
      message: 'Pedido criado com sucesso',
      order
    })
  } catch (error) {
    console.error('Error creating order:', error)
    return NextResponse.json(
      { error: 'Erro ao criar pedido' },
      { status: 500 }
    )
  }
}