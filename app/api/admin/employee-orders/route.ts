export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

// GET - Método não permitido
export async function GET() {
  return NextResponse.json(
    { error: 'Método não permitido. Use POST para criar pedidos de funcionários.' },
    { status: 405 }
  )
}

// POST - Admin criar pedido para funcionário
export async function POST(req: NextRequest) {
  try {
    console.log('\n🏠 [EMPLOYEE-ORDER-API] === INÍCIO ===')
    console.log('🏠 [EMPLOYEE-ORDER-API] Método:', req.method)
    console.log('🏠 [EMPLOYEE-ORDER-API] URL:', req.url)
    
    const session = await getServerSession(authOptions)
    const user = session?.user as any
    
    console.log('🏠 [EMPLOYEE-ORDER-API] Session:', session ? 'EXISTS' : 'NULL')
    console.log('🏠 [EMPLOYEE-ORDER-API] User Type:', user?.userType)
    
    // Apenas admin pode criar pedidos para funcionários
    if (!session || user?.userType !== 'ADMIN') {
      console.log('❌ [EMPLOYEE-ORDER-API] ACESSO NEGADO')
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json()
    console.log('🏠 [EMPLOYEE-ORDER-API] Body recebido:', JSON.stringify(body, null, 2))
    const {
      employeeId, // ID do funcionário (sellerId)
      orderType,
      deliveryType,
      deliveryDate,
      deliveryTime,
      paymentMethod,
      items,
      discountPercent,
      notes
    } = body

    // ====== VALIDAÇÕES ======
    console.log('\n📝 [ADMIN] Validando pedido para funcionário...')
    
    // Validar funcionário
    if (!employeeId) {
      return NextResponse.json(
        { error: '⚠️ ERRO: Funcionário não foi selecionado!' },
        { status: 400 }
      )
    }

    // Buscar funcionário
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId }
    })

    if (!employee) {
      return NextResponse.json(
        { error: '⚠️ ERRO: Funcionário não encontrado no sistema!' },
        { status: 404 }
      )
    }

    console.log('✓ Funcionário encontrado:', employee.name)
    console.log('✓ Funcionário tem sellerId?', employee.sellerId ? 'SIM' : 'NÃO')

    // Validar itens do carrinho
    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: '⚠️ ERRO: Nenhum produto foi adicionado ao carrinho!' },
        { status: 400 }
      )
    }
    console.log('✓ Carrinho tem', items.length, 'itens')

    // Validar data de entrega
    if (!deliveryDate) {
      return NextResponse.json(
        { error: '⚠️ ERRO: Data de entrega/retirada não foi informada!' },
        { status: 400 }
      )
    }
    console.log('✓ Data de entrega:', deliveryDate)

    // Validar forma de pagamento
    if (!paymentMethod) {
      return NextResponse.json(
        { error: '⚠️ ERRO: Forma de pagamento não foi selecionada!' },
        { status: 400 }
      )
    }
    console.log('✓ Forma de pagamento:', paymentMethod)

    // Validação: Pedido de funcionário não pode usar boleto ou notinha
    if (paymentMethod === 'BOLETO' || paymentMethod === 'CREDIT') {
      return NextResponse.json(
        { error: '⚠️ ERRO: Pedidos para funcionários não podem usar BOLETO ou NOTINHA!\n\nUse PIX, Dinheiro, Cartão de Crédito ou Débito.' },
        { status: 400 }
      )
    }

    // Calcular subtotal
    console.log('\n💰 Calculando valores do pedido...')
    console.log('🏠 [EMPLOYEE-ORDER-API] Items recebidos:', JSON.stringify(items))
    let subtotal = 0
    const itemsWithPrices: any[] = []

    for (const item of items) {
      console.log('🏠 [EMPLOYEE-ORDER-API] Buscando produto:', item.productId)
      
      try {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: {
            id: true,
            name: true,
            priceRetail: true,
            priceWholesale: true,
          }
        })

        console.log('🏠 [EMPLOYEE-ORDER-API] Produto encontrado:', product ? product.name : 'NULL')

        if (!product) {
          return NextResponse.json(
            { error: `⚠️ ERRO: Produto não encontrado no sistema!\n\nID do produto: ${item.productId}` },
            { status: 404 }
          )
        }

        const price = Number(orderType === 'WHOLESALE' ? product.priceWholesale : product.priceRetail)
        const itemTotal = item.isGift ? 0 : price * item.quantity

        const itemId = `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        
        itemsWithPrices.push({
          id: itemId,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.isGift ? 0 : price,
          total: itemTotal,
          isGift: item.isGift || false
        })

        subtotal += itemTotal
        console.log(`  - ${product.name}: ${item.quantity} x R$ ${price.toFixed(2)} = R$ ${itemTotal.toFixed(2)}`)
      } catch (productError: any) {
        console.error('❌ [EMPLOYEE-ORDER-API] Erro ao buscar produto:', productError)
        return NextResponse.json(
          { error: `Erro ao buscar produto: ${productError.message}` },
          { status: 500 }
        )
      }
    }

    // Aplicar desconto
    const discountAmount = (subtotal * (discountPercent || 0)) / 100
    const total = subtotal - discountAmount

    console.log(`  Subtotal: R$ ${subtotal.toFixed(2)}`)
    console.log(`  Desconto: R$ ${discountAmount.toFixed(2)}`)
    console.log(`  Total: R$ ${total.toFixed(2)}`)

    // Gerar número do pedido
    const orderNumber = `ADM-${Date.now()}`
    console.log('🏠 [EMPLOYEE-ORDER-API] Order Number:', orderNumber)

    // Gerar ID único
    const orderId = `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    console.log('🏠 [EMPLOYEE-ORDER-API] Order ID:', orderId)

    // Criar pedido
    console.log('🏠 [EMPLOYEE-ORDER-API] Preparando dados do pedido...')
    const orderData: any = {
      id: orderId,
      orderNumber,
      customerId: null, // Sem cliente
      employeeId, // 🆕 Associar ao funcionário pelo ID do Employee
      sellerId: employee.sellerId || null, // Conectar ao Seller se funcionário tiver sellerId
      createdByUserId: user.id, // Admin que criou
      createdByRole: 'ADMIN', // Admin criou o pedido
      customerName: employee.name, // Nome do funcionário
      customerPhone: employee.phone || '',
      customerEmail: employee.email || '',
      casualCustomerName: null,
      address: null,
      city: null,
      orderType,
      deliveryType,
      deliveryDate: deliveryDate ? new Date(deliveryDate + 'T12:00:00.000Z') : null, // 🔧 T12:00 evita problema de fuso horário
      deliveryTime,
      paymentMethod,
      secondaryPaymentMethod: null,
      primaryPaymentAmount: total,
      secondaryPaymentAmount: null,
      subtotal,
      discount: discountAmount,
      discountPercent: discountPercent || 0,
      total,
      notes,
      updatedAt: new Date(),
      OrderItem: {
        create: itemsWithPrices
      }
    }

    console.log('🏠 [EMPLOYEE-ORDER-API] Criando pedido no banco...')
    
    let order
    try {
      order = await prisma.order.create({
        data: orderData,
        include: {
          OrderItem: {
            include: {
              Product: true
            }
          }
        }
      })
      console.log('🏠 [EMPLOYEE-ORDER-API] Pedido criado com sucesso!')
    } catch (createError: any) {
      console.error('❌ [EMPLOYEE-ORDER-API] Erro ao criar pedido:', createError)
      return NextResponse.json(
        { error: `Erro ao criar pedido: ${createError.message}` },
        { status: 500 }
      )
    }

    console.log(`✅ Pedido criado com employeeId: ${employeeId}`)
    console.log(`   SellerId: ${employee.sellerId || 'N/A'}`)

    // NÃO criar comissão para pedidos próprios de funcionários
    console.log('🏠 PEDIDO DE FUNCIONÁRIO - Comissão NÃO criada (pedido próprio)')

    // Descontar limite do funcionário
    try {
      // Descontar do creditLimit do funcionário (usando o employee já buscado)
      await prisma.employee.update({
        where: { id: employeeId },
        data: {
          creditLimit: {
            decrement: total
          }
        }
      })
      console.log(`🏠 ✅ Limite descontado (Admin): R$ ${total.toFixed(2)} do funcionário ${employee.name}`)
      console.log(`   Limite anterior: R$ ${employee.creditLimit.toFixed(2)}`)
      console.log(`   Novo limite: R$ ${(employee.creditLimit - total).toFixed(2)}`)
    } catch (limitError) {
      console.error('❌ Erro ao descontar limite do funcionário:', limitError)
    }

    console.log(`\n✅ Pedido ${orderNumber} criado com sucesso para funcionário ${employee.name}!`)
    
    return NextResponse.json({
      message: 'Pedido criado com sucesso',
      orderNumber: order.orderNumber,
      order
    })
  } catch (error: any) {
    console.error('\n❌ ERRO ao criar pedido para funcionário:', error)
    
    const errorMessage = error.message || 'Erro desconhecido ao criar pedido'
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
