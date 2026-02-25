export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { createPixPayment } from '@/lib/mercado-pago'
import { createPixCharge, isCoraConfigured } from '@/lib/cora'
import QRCode from 'qrcode'
import crypto from 'crypto'
import { productSelect } from '@/lib/product-select'

// GET - Listar pedidos do vendedor (ou funcionário)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any
    
    if (!session || !['SELLER', 'EMPLOYEE'].includes(user?.userType)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const sellerId = user?.sellerId

    const orders = await prisma.order.findMany({
      where: { sellerId },
      include: {
        Customer: {
          select: {
            name: true,
            email: true,
            phone: true
          }
        },
        OrderItem: {
          include: {
            Product: {
              select: {
                name: true,
                imageUrl: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(orders)
  } catch (error) {
    console.error('Error fetching Order:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar pedidos' },
      { status: 500 }
    )
  }
}

// POST - Vendedor ou funcionário criar novo pedido
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any
    
    if (!session || !['SELLER', 'EMPLOYEE'].includes(user?.userType)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const sellerId = user?.sellerId
    
    // Buscar dados do vendedor para verificar limites (apenas se houver sellerId)
    let seller = null
    if (sellerId) {
      seller = await prisma.seller.findUnique({
        where: { id: sellerId }
      })

      if (!seller || !seller.isActive) {
        return NextResponse.json(
          { error: 'Vendedor inativo' },
          { status: 403 }
        )
      }
    }

    const body = await req.json()
    const {
      customerId,
      casualCustomerName, // Nome do cliente casual (sem cadastro completo)
      orderType,
      deliveryType,
      deliveryDate,
      deliveryTime,
      paymentMethod,
      secondaryPaymentMethod,
      primaryPaymentAmount,
      secondaryPaymentAmount,
      boletoInstallments,
      items,
      discountPercent,
      notes,
      isOwnOrder  // Indica se é pedido próprio (sem comissão)
    } = body

    // ====== VALIDAÇÕES COM MENSAGENS CLARAS ======
    console.log('\n📝 Validando dados do pedido...')
    console.log('🏠 Pedido próprio (sem comissão)?', isOwnOrder ? 'SIM' : 'NÃO')
    
    // Validar cliente (não obrigatório para pedido próprio)
    if (!customerId && !isOwnOrder) {
      return NextResponse.json(
        { error: '⚠️ ERRO: Cliente não foi selecionado!' },
        { status: 400 }
      )
    }

    // Buscar cliente (opcional para pedido próprio)
    let customer = null
    if (customerId) {
      customer = await prisma.customer.findUnique({
        where: { id: customerId }
      })

      if (!customer && !isOwnOrder) {
        return NextResponse.json(
          { error: '⚠️ ERRO: Cliente não encontrado no sistema!' },
          { status: 404 }
        )
      }
      
      if (customer) {
        console.log('✓ Cliente encontrado:', customer.name)
        
        // VALIDAÇÃO: CONSUMIDOR FINAL não pode pagar depois
        if (customer.customerType === 'CONSUMIDOR_FINAL') {
          if (paymentMethod === 'BOLETO' || secondaryPaymentMethod === 'BOLETO') {
            return NextResponse.json(
              { 
                error: '⚠️ Cliente "Consumidor Final" deve pagar na hora. Boleto não é permitido.',
                details: 'Este tipo de cliente não pode fazer pagamento posterior.'
              },
              { status: 400 }
            )
          }
        }
      }
    } else if (isOwnOrder) {
      console.log('✓ Pedido próprio - sem cliente associado')
    }

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

    // Validar CPF/CNPJ para boleto (apenas se houver cliente e não for pedido próprio)
    if ((paymentMethod === 'BOLETO' || secondaryPaymentMethod === 'BOLETO') && customer && !isOwnOrder) {
      if (!customer.cpfCnpj || customer.cpfCnpj.trim() === '') {
        return NextResponse.json(
          { error: `⚠️ ERRO: O cliente "${customer.name}" não possui CPF/CNPJ cadastrado!\n\nPara gerar boleto, é necessário cadastrar o CPF/CNPJ do cliente.` },
          { status: 400 }
        )
      }
      
      const cpfCnpj = customer.cpfCnpj.replace(/\D/g, '')
      if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
        return NextResponse.json(
          { error: `⚠️ ERRO: CPF/CNPJ do cliente "${customer.name}" está inválido!\n\nCPF deve ter 11 dígitos e CNPJ 14 dígitos.` },
          { status: 400 }
        )
      }
      console.log('✓ CPF/CNPJ válido:', cpfCnpj)
    }
    
    // Validação especial: Pedido próprio não pode usar boleto
    if (isOwnOrder && (paymentMethod === 'BOLETO' || secondaryPaymentMethod === 'BOLETO')) {
      return NextResponse.json(
        { error: '⚠️ ERRO: Pedidos próprios não podem usar BOLETO como forma de pagamento!\n\nUse PIX, Dinheiro, Cartão de Crédito ou Débito.' },
        { status: 400 }
      )
    }

    // Validar desconto (apenas se houver seller)
    if (seller && discountPercent > seller.maxDiscountRate) {
      return NextResponse.json(
        { error: `⚠️ ERRO: Desconto máximo permitido é ${seller.maxDiscountRate}%!` },
        { status: 400 }
      )
    }

    // Calcular subtotal
    console.log('\n💰 Calculando valores do pedido...')
    let subtotal = 0
    const itemsWithPrices: any[] = []

    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: productSelect
      })

      if (!product) {
        return NextResponse.json(
          { error: `⚠️ ERRO: Produto não encontrado no sistema!\n\nID do produto: ${item.productId}` },
          { status: 404 }
        )
      }

      const price = Number(orderType === 'WHOLESALE' ? product.priceWholesale : product.priceRetail)
      const itemTotal = item.isGift ? 0 : price * item.quantity

      itemsWithPrices.push({
        id: crypto.randomUUID(),
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.isGift ? 0 : price,
        total: itemTotal,
        isGift: item.isGift || false
      })

      subtotal += itemTotal
      console.log(`  - ${product.name}: ${item.quantity} x R$ ${price.toFixed(2)} = R$ ${itemTotal.toFixed(2)}`)
    }

    // Aplicar desconto
    const discountAmount = (subtotal * (discountPercent || 0)) / 100
    const total = subtotal - discountAmount

    console.log(`  Subtotal: R$ ${subtotal.toFixed(2)}`)
    console.log(`  Desconto: R$ ${discountAmount.toFixed(2)}`)
    console.log(`  Total: R$ ${total.toFixed(2)}`)

    // Gerar número do pedido
    const orderNumber = `ORD-${Date.now()}`

    // ====== VERIFICAR BOLETOS EM ATRASO (apenas se houver cliente) ======
    if (customer && customerId && !isOwnOrder) {
      console.log('\n🔍 Verificando boletos em atraso...')
      const now = new Date()
      const overdueBoletos = await prisma.boleto.findMany({
        where: {
          customerId,
          status: {
            in: ['PENDING', 'OVERDUE']
          },
          dueDate: {
            lt: now
          }
        }
      })

      if (overdueBoletos.length > 0) {
        const overdueAmount = overdueBoletos.reduce((sum: number, bol: any) => sum + Number(bol.amount), 0)
        const overdueCount = overdueBoletos.length
        
        console.log('❌ Cliente possui boletos em atraso!')
        console.log(`  Quantidade: ${overdueCount}`)
        console.log(`  Valor total: R$ ${overdueAmount.toFixed(2)}`)
        
        return NextResponse.json(
          { 
            error: `⚠️ COMPRA BLOQUEADA!\n\nO cliente "${customer.name}" possui ${overdueCount} boleto(s) vencido(s) no valor total de R$ ${overdueAmount.toFixed(2)}.\n\nPor favor, oriente o cliente a regularizar sua situação antes de fazer novos pedidos.`,
            overdueBoletos: overdueBoletos.map((b: any) => ({
              boletoNumber: b.boletoNumber,
              amount: Number(b.amount),
              dueDate: b.dueDate.toISOString()
            }))
          },
          { status: 400 }
        )
      }
      console.log('✓ Sem boletos em atraso')
    } else if (isOwnOrder) {
      console.log('🏠 Pedido próprio - verificação de boletos não necessária')
    }

    // Validar limite de crédito para boleto ou notinha (apenas se houver cliente)
    const usesCreditLimit = paymentMethod === 'BOLETO' || paymentMethod === 'CREDIT' ||
                            secondaryPaymentMethod === 'BOLETO' || secondaryPaymentMethod === 'CREDIT'

    if (usesCreditLimit && customer && !isOwnOrder) {
      let creditAmount = 0
      if (paymentMethod === 'BOLETO' || paymentMethod === 'CREDIT') {
        creditAmount += (primaryPaymentAmount || total)
      }
      if (secondaryPaymentMethod === 'BOLETO' || secondaryPaymentMethod === 'CREDIT') {
        creditAmount += (secondaryPaymentAmount || 0)
      }

      console.log(`\n💳 Validando limite de crédito...`)
      console.log(`  Crédito disponível: R$ ${customer.availableCredit.toFixed(2)}`)
      console.log(`  Crédito necessário: R$ ${creditAmount.toFixed(2)}`)

      if (customer.availableCredit < creditAmount) {
        return NextResponse.json(
          { error: `⚠️ ERRO: LIMITE DE CRÉDITO INSUFICIENTE!\n\nCliente: ${customer.name}\nLimite disponível: R$ ${customer.availableCredit.toFixed(2)}\nValor necessário: R$ ${creditAmount.toFixed(2)}\n\nDiferença: R$ ${(creditAmount - customer.availableCredit).toFixed(2)}` },
          { status: 400 }
        )
      }
      console.log('✓ Limite de crédito OK')
    } else if (isOwnOrder) {
      console.log('🏠 Pedido próprio - validação de crédito não necessária')
    }

    // Criar pedido em uma transação
    const order = await prisma.$transaction(async (tx: any) => {
      const newOrder = await tx.order.create({
        data: {
          id: crypto.randomUUID(),
          orderNumber,
          customerId: customerId || null,
          sellerId,
          createdByUserId: sellerId, // Quem realmente criou o pedido
          createdByRole: user?.userType === 'EMPLOYEE' ? 'EMPLOYEE' : 'SELLER', // Funcionário ou vendedor criou o pedido
          customerName: customer?.name || (isOwnOrder ? seller?.name || 'Pedido Próprio' : 'Cliente Avulso'),
          customerPhone: customer?.phone || null,
          customerEmail: customer?.email || null,
          casualCustomerName: casualCustomerName || null, // Nome do cliente casual (para encomendas)
          address: customer?.address || null,
          city: customer?.city || null,
          orderType,
          deliveryType,
          deliveryDate: deliveryDate ? new Date(deliveryDate + 'T12:00:00.000Z') : null, // 🔧 T12:00 evita problema de fuso horário
          deliveryTime,
          paymentMethod,
          secondaryPaymentMethod,
          primaryPaymentAmount,
          secondaryPaymentAmount,
          subtotal,
          discount: discountAmount,
          discountPercent: discountPercent || 0,
          total,
          notes,
          updatedAt: new Date(),
          OrderItem: {
            create: itemsWithPrices
          }
        },
        include: {
          OrderItem: {
            include: {
              Product: true
            }
          },
          Customer: true
        }
      })

      // Criar comissão para o vendedor (APENAS se não for pedido próprio e houver seller)
      if (!isOwnOrder && seller && sellerId) {
        const commissionAmount = (total * seller.commissionRate) / 100
        
        await tx.commission.create({
          data: {
            id: crypto.randomUUID(),
            sellerId,
            orderId: newOrder.id,
            amount: commissionAmount,
            description: `Comissão do pedido ${orderNumber}`,
            status: 'PENDING',
            updatedAt: new Date()
          }
        })
        console.log('✅ Comissão criada: R$', commissionAmount.toFixed(2))
      } else {
        console.log('🏠 PEDIDO PRÓPRIO - Comissão NÃO criada')
      }

      // Criar boleto(s) se o pagamento for BOLETO
      if (paymentMethod === 'BOLETO' || secondaryPaymentMethod === 'BOLETO') {
        const boletoAmount = paymentMethod === 'BOLETO' ? (primaryPaymentAmount || total) : (secondaryPaymentAmount || 0)
        
        console.log('\n📋 CRIAÇÃO DE BOLETOS (VENDEDOR)')
        console.log('  boletoAmount:', boletoAmount)
        console.log('  boletoInstallments:', boletoInstallments)
        
        // Verificar se tem parcelamento
        if (boletoInstallments) {
          console.log('  ✅ TEM PARCELAMENTO!')
          // Parse installment option (format: "3x-10-20-30")
          const parts = boletoInstallments.split('x-')
          console.log('  parts:', parts)
          
          if (parts.length === 2) {
            const numInstallments = parseInt(parts[0])
            const daysString = parts[1]
            const daysList = daysString.split('-').map((d: string) => parseInt(d))
            
            console.log('  numInstallments:', numInstallments)
            console.log('  daysList:', daysList)

            if (numInstallments > 0 && daysList.length === numInstallments) {
              console.log('  ✅ VALIDAÇÃO OK! Criando', numInstallments, 'boletos parcelados...')
              // Criar múltiplos boletos (parcelas)
              const installmentAmount = boletoAmount / numInstallments
              
              // Definir datas de vencimento
              for (let i = 0; i < numInstallments; i++) {
                const dueDate = new Date()
                dueDate.setDate(dueDate.getDate() + daysList[i])
                const boletoNumber = `BOL${Date.now().toString().slice(-8)}-${i + 1}`
                
                console.log(`    Criando boleto ${i + 1}/${numInstallments}: ${boletoNumber}, venc: ${dueDate.toISOString().split('T')[0]}, valor: R$ ${installmentAmount.toFixed(2)}`)
                
                await tx.boleto.create({
                  data: {
                    id: crypto.randomUUID(),
                    boletoNumber,
                    customerId,
                    orderId: newOrder.id,
                    amount: installmentAmount,
                    dueDate,
                    status: 'PENDING',
                    isInstallment: true,
                    installmentNumber: i + 1,
                    totalInstallments: numInstallments,
                    updatedAt: new Date()
                  }
                })
                
                console.log(`    ✅ Boleto ${boletoNumber} criado no banco!`)
                
                // Pequeno delay para garantir número único
                await new Promise(resolve => setTimeout(resolve, 10))
              }
            } else {
              console.log('  ⚠️ VALIDAÇÃO FALHOU (numInstallments ou daysList)! Criando boleto único...')
              // Criar boleto único
              const boletoNumber = `BOL${Date.now().toString().slice(-8)}`
              const dueDate = new Date()
              dueDate.setDate(dueDate.getDate() + (customer.paymentTerms || 30))

              await tx.boleto.create({
                data: {
                  id: crypto.randomUUID(),
                  boletoNumber,
                  customerId,
                  orderId: newOrder.id,
                  amount: boletoAmount,
                  dueDate,
                  status: 'PENDING',
                  updatedAt: new Date()
                }
              })
            }
          } else {
            console.log('  ⚠️ VALIDAÇÃO FALHOU (parts.length)! Criando boleto único...')
            // Criar boleto único
            const boletoNumber = `BOL${Date.now().toString().slice(-8)}`
            const dueDate = new Date()
            dueDate.setDate(dueDate.getDate() + (customer.paymentTerms || 30))

            await tx.boleto.create({
              data: {
                id: crypto.randomUUID(),
                boletoNumber,
                customerId,
                orderId: newOrder.id,
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
          dueDate.setDate(dueDate.getDate() + (customer.paymentTerms || 30))

          await tx.boleto.create({
            data: {
              id: crypto.randomUUID(),
              boletoNumber,
              customerId,
              orderId: newOrder.id,
              amount: boletoAmount,
              dueDate,
              status: 'PENDING',
              updatedAt: new Date()
            }
          })
        }
      }

      return newOrder
    })

    // Atualizar crédito para pagamento CREDIT (notinha) - apenas se houver cliente
    if ((paymentMethod === 'CREDIT' || secondaryPaymentMethod === 'CREDIT') && customer && customerId && !isOwnOrder) {
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
        console.log(`✅ Crédito descontado (Vendedor): R$ ${creditAmount.toFixed(2)} do cliente ${customer.name}`)
      } catch (creditError) {
        console.error('❌ Erro ao descontar crédito:', creditError)
      }
    }

    // Descontar limite do funcionário para pedidos próprios (isOwnOrder = true)
    if (isOwnOrder && sellerId && user?.userType === 'EMPLOYEE') {
      try {
        // Buscar funcionário vinculado ao seller
        const employee = await prisma.employee.findFirst({
          where: { sellerId }
        })

        if (employee) {
          // Descontar do creditLimit do funcionário
          await prisma.employee.update({
            where: { id: employee.id },
            data: {
              creditLimit: {
                decrement: total
              }
            }
          })
          console.log(`🏠 ✅ Limite descontado (Pedido Próprio): R$ ${total.toFixed(2)} do funcionário ${employee.name}`)
          console.log(`   Limite anterior: R$ ${employee.creditLimit.toFixed(2)}`)
          console.log(`   Novo limite: R$ ${(employee.creditLimit - total).toFixed(2)}`)
        } else {
          console.log('⚠️ Funcionário não encontrado para desconto de limite')
        }
      } catch (limitError) {
        console.error('❌ Erro ao descontar limite do funcionário:', limitError)
      }
    }

    // Gerar Boleto + PIX para os boletos criados
    if (paymentMethod === 'BOLETO' || secondaryPaymentMethod === 'BOLETO') {
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

        console.log('\n💳 GERANDO BOLETOS/PIX (VENDEDOR)')
        console.log('  Boletos encontrados:', boletos.length)
        boletos.forEach((b, idx) => {
          console.log(`  Boleto ${idx + 1}: ${b.boletoNumber}, Parcela: ${b.isInstallment ? `${b.installmentNumber}/${b.totalInstallments}` : 'Único'}, Vencimento: ${b.dueDate.toISOString().split('T')[0]}`)
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
                throw new Error(`⚠️ ERRO: Cliente ${customer.name} não possui CPF/CNPJ cadastrado. O CPF/CNPJ é obrigatório para gerar boletos.`)
              }
              
              // Formatar CPF/CNPJ
              const cpfCnpj = customer.cpfCnpj.replace(/\D/g, '')
              
              // Validar tamanho do documento
              if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
                throw new Error(`⚠️ ERRO: CPF/CNPJ inválido para o cliente ${customer.name}. O CPF deve ter 11 dígitos e o CNPJ 14 dígitos.`)
              }
              
              // Formatar data de vencimento (YYYY-MM-DD)
              const dueDateStr = boleto.dueDate.toISOString().split('T')[0]
              
              // Criar cobrança via Cora (gera boleto + PIX)
              const coraCharge = await createPixCharge({
                code: boleto.boletoNumber,
                customerName: customer.name,
                customerDocument: cpfCnpj,
                customerEmail: customer.email || undefined,
                amount: Math.round(boleto.amount * 100), // Converter para centavos
                dueDate: dueDateStr,
                description
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
                  pixPaymentId: coraCharge.id
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

    // Enviar notificação por email (mesmo código anterior)
    try {
      await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          total: order.total,
          items: order.OrderItem,
          isSeller: true,
          sellerName: seller?.name || 'Funcionário'
        })
      })

      // Notificação de novo pedido removida - apenas notificações de mudança de status e pontos devem ser enviadas
    } catch (emailError) {
      console.error('Error sending notification:', emailError)
    }

    console.log(`\n✅ Pedido ${orderNumber} criado com sucesso!`)
    
    return NextResponse.json({
      message: 'Pedido criado com sucesso',
      orderNumber: order.orderNumber,
      order
    })
  } catch (error: any) {
    console.error('\n❌ ERRO ao criar pedido:', error)
    
    // Retornar mensagem de erro clara
    const errorMessage = error.message || 'Erro desconhecido ao criar pedido'
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
