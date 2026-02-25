
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { authOptions } from '@/lib/auth-options'
import { notifyOrderStatusChange } from '@/lib/notifications'
import { cancelPixCharge, isCoraConfigured } from '@/lib/cora'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    const order = await prisma.order.findUnique({
      where: {
        id: params.id
      },
      include: {
        Customer: true,
        User: true,
        OrderItem: {
          include: {
            Product: true
          }
        }
      }
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Check permissions - customers can only see their own orders
    if (user?.userType === 'CUSTOMER' && order.customerId !== user.customerId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Serialize the order
    const serializedOrder = {
      ...order,
      subtotal: Number(order.subtotal),
      discount: Number(order.discount),
      total: Number(order.total),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      deliveryDate: order.deliveryDate?.toISOString() || null,
      orderItems: order.OrderItem?.map((item: any) => ({
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
    console.error('Error fetching order:', error)
    return NextResponse.json(
      { error: 'Failed to fetch order' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    // Only admin can update orders
    if (user?.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { status, notes, paymentStatus, bankAccountId, deliveryDate, deliveryType } = body
    
    console.log(`\n📝 [UPDATE] Atualizando pedido ${params.id}:`, { status, paymentStatus, bankAccountId, notes, deliveryDate, deliveryType })
    
    // 🆕 VALIDAÇÃO: Conta bancária obrigatória ao marcar como pago
    if (paymentStatus === 'PAID' && !bankAccountId) {
      return NextResponse.json(
        { 
          error: 'Conta bancária é obrigatória',
          details: 'Por favor, selecione a conta que recebeu o pagamento.'
        },
        { status: 400 }
      )
    }

    // 💰 GERENCIAR availableCredit QUANDO paymentStatus MUDA
    if (paymentStatus) {
      const currentOrder = await prisma.order.findUnique({
        where: { id: params.id },
        select: { 
          customerId: true, 
          total: true, 
          paymentStatus: true 
        }
      })

      if (currentOrder && currentOrder.customerId) {
        const oldStatus = currentOrder.paymentStatus
        const newStatus = paymentStatus

        // UNPAID → PAID: Devolver crédito
        if (oldStatus === 'UNPAID' && newStatus === 'PAID') {
          await prisma.customer.update({
            where: { id: currentOrder.customerId },
            data: {
              availableCredit: { increment: currentOrder.total }
            }
          })
          console.log(`💰 [CREDIT] Crédito devolvido: R$ ${currentOrder.total.toFixed(2)} (Pedido pago)`)
        }
        
        // PAID → UNPAID: Descontar crédito novamente
        if (oldStatus === 'PAID' && newStatus === 'UNPAID') {
          await prisma.customer.update({
            where: { id: currentOrder.customerId },
            data: {
              availableCredit: { decrement: currentOrder.total }
            }
          })
          console.log(`💰 [CREDIT] Crédito descontado: R$ ${currentOrder.total.toFixed(2)} (Pedido marcado como não pago)`)
        }
      }
    }

    // Se o pedido está sendo cancelado, precisamos cancelar os boletos e restaurar o crédito
    if (status === 'CANCELLED') {
      // Buscar o pedido primeiro para obter os dados
      const existingOrder = await prisma.order.findUnique({
        where: { id: params.id },
        include: {
          Boleto: true,
          Customer: true
        }
      })

      if (existingOrder) {
        // Cancelar todos os boletos pendentes associados ao pedido
        const pendingBoletos = existingOrder.Boleto.filter(b => b.status === 'PENDING')
        
        if (pendingBoletos.length > 0) {
          // Calcular o valor total dos boletos pendentes
          const totalBoletoAmount = pendingBoletos.reduce((sum, boleto) => sum + Number(boleto.amount), 0)
          
          // Cancelar os boletos no Cora primeiro (se configurado)
          const coraConfigured = isCoraConfigured()
          if (coraConfigured) {
            console.log(`\n🔄 Cancelando ${pendingBoletos.length} boleto(s) no Cora (pedido cancelado)...`)
            
            for (const boleto of pendingBoletos) {
              if (boleto.pixPaymentId) {
                try {
                  // 🏦 Usar a conta Cora salva no boleto (ou ESPETOS como padrão)
                  const boletoAccount = (boleto.coraAccount as 'ESPETOS' | 'GENUINO') || 'ESPETOS'
                  console.log(`🏦 Cancelando boleto ${boleto.id} na conta Cora: ${boletoAccount}`)
                  await cancelPixCharge(boleto.pixPaymentId, boletoAccount)
                  console.log(`✅ Boleto ${boleto.id} cancelado no Cora com sucesso (Invoice ID: ${boleto.pixPaymentId})`)
                } catch (error: any) {
                  // Log o erro mas não trava o processo - o boleto será cancelado localmente
                  console.error(`❌ Erro ao cancelar boleto ${boleto.id} no Cora:`, error?.message || error)
                  console.log(`⚠️ Continuando com o cancelamento local do boleto...`)
                }
              } else {
                console.log(`⚠️ Boleto ${boleto.id} não tem pixPaymentId - pulando cancelamento no Cora`)
              }
            }
          } else {
            console.log('⚠️ Cora não configurado - cancelando boletos apenas localmente')
          }
          
          // Cancelar os boletos no banco de dados local
          await prisma.boleto.updateMany({
            where: {
              orderId: params.id,
              status: 'PENDING'
            },
            data: {
              status: 'CANCELLED',
              notes: 'Pedido cancelado'
            }
          })

          // Restaurar o crédito do cliente
          if (existingOrder.customerId && totalBoletoAmount > 0) {
            await prisma.customer.update({
              where: { id: existingOrder.customerId },
              data: {
                availableCredit: {
                  increment: totalBoletoAmount
                }
              }
            })
          }
          
          console.log(`✅ Crédito restaurado: R$ ${totalBoletoAmount.toFixed(2)} para cliente ${existingOrder.Customer?.name}`)
        }
      }
    }

    // 🆕 SE O PEDIDO ESTÁ SENDO MARCADO COMO ENTREGUE
    if (status === 'DELIVERED') {
      console.log(`\n📦 [DELIVERY] Processando entrega do pedido ${params.id}...`)
      
      try {
        // Buscar pedido completo com itens
        const orderToDeliver = await prisma.order.findUnique({
          where: { id: params.id },
          include: {
            Customer: true,
            OrderItem: {
              include: {
                Product: true
              }
            }
          }
        })

        if (!orderToDeliver || !orderToDeliver.customerId) {
          console.log('⚠️ [DELIVERY] Pedido não encontrado ou sem cliente vinculado')
        } else {
          console.log(`✅ [DELIVERY] Pedido encontrado: ${orderToDeliver.orderNumber} - Cliente: ${orderToDeliver.Customer?.name}`)
          console.log(`📊 [DELIVERY] Itens no pedido: ${orderToDeliver.OrderItem.length}`)
          
          // Executar em transação para garantir atomicidade
          await prisma.$transaction(async (tx: any) => {
            console.log(`\n🔄 [TRANSACTION] Iniciando transação de entrega...`)
            
            // Buscar ou criar fornecedor "FÁBRICA"
            let factorySupplier = await tx.supplier.findFirst({
              where: { document: '00000000000000' } // CNPJ fictício para fábrica
            })

            if (!factorySupplier) {
              console.log(`➕ [SUPPLIER] Criando fornecedor FÁBRICA...`)
              factorySupplier = await tx.supplier.create({
                data: {
                  name: '[SUA EMPRESA] - Fábrica',
                  companyName: '[SUA EMPRESA] Ltda',
                  document: '00000000000000',
                  documentType: 'CNPJ',
                  email: 'fabrica@espetos.com.br',
                  phone: '(00) 00000-0000',
                  isActive: true
                }
              })
              console.log(`✅ [SUPPLIER] Fornecedor criado: ${factorySupplier.id}`)
            } else {
              console.log(`✅ [SUPPLIER] Fornecedor já existe: ${factorySupplier.id}`)
            }
            
            // 1️⃣ VERIFICAR SE JÁ EXISTE COMPRA PARA ESTE PEDIDO
            let purchase = await tx.purchase.findFirst({
              where: {
                customerId: orderToDeliver.customerId!,
                invoiceNumber: orderToDeliver.orderNumber
              }
            })

            if (purchase) {
              console.log(`ℹ️ [PURCHASE] Compra já existe: ${purchase.id} (Status: ${purchase.status})`)
              console.log(`⚠️ [PURCHASE] PULANDO criação de nova compra - apenas atualizando estoque`)
            } else {
              // CRIAR COMPRA NO MÓDULO DO CLIENTE (SEM ITENS)
              const purchaseNumber = `COMP-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
              
              console.log(`📝 [PURCHASE] Criando compra ${purchaseNumber} para cliente...`)
              console.log(`💰 [PURCHASE] Payment Status: ${paymentStatus || 'UNPAID'}`)
              
              purchase = await tx.purchase.create({
                data: {
                  purchaseNumber,
                  customerId: orderToDeliver.customerId, // 🔑 Compra do cliente (venda para o admin)
                  supplierId: factorySupplier.id,
                  totalAmount: orderToDeliver.total,
                  status: paymentStatus === 'PAID' ? 'PAID' : 'PENDING',
                  expenseType: 'PRODUCTS',
                  purchaseDate: new Date(),
                  dueDate: new Date(),
                  paymentDate: paymentStatus === 'PAID' ? new Date() : null,
                  invoiceNumber: orderToDeliver.orderNumber,
                  notes: `Compra automática do pedido #${orderToDeliver.orderNumber} - ${orderToDeliver.OrderItem.length} produto(s)`
                }
              })

              console.log(`✅ [PURCHASE] Compra criada: ${purchase.id} (Status: ${purchase.status})`)
            }

            // 2️⃣ ATUALIZAR ESTOQUE DO CLIENTE
            let productosProcessados = 0
            for (const item of orderToDeliver.OrderItem) {
              console.log(`\n📦 [PRODUCT ${productosProcessados + 1}/${orderToDeliver.OrderItem.length}] Processando: ${item.Product.name} (${item.quantity} un)`)
              
              try {
                // Verificar se produto já existe no catálogo do cliente
                let clientProduct = await tx.clientProduct.findFirst({
                  where: {
                    customerId: orderToDeliver.customerId!,
                    name: item.Product.name
                  }
                })

                // Se não existe, criar
                if (!clientProduct) {
                  console.log(`➕ [CATALOG] Criando produto no catálogo do cliente...`)
                  clientProduct = await tx.clientProduct.create({
                    data: {
                      customerId: orderToDeliver.customerId!,
                      name: item.Product.name,
                      description: item.Product.description || '',
                      category: item.Product.category || 'ESPETO',
                      unitPrice: item.unitPrice,
                      costPrice: item.unitPrice,
                      imageUrl: item.Product.imageUrl,
                      isActive: true,
                      trackInventory: true
                    }
                  })
                  console.log(`✅ [CATALOG] Produto criado: ${clientProduct.id}`)
                } else {
                  console.log(`✅ [CATALOG] Produto já existe: ${clientProduct.id}`)
                }

                // Verificar se existe estoque para este produto
                let inventory = await tx.clientInventory.findFirst({
                  where: {
                    customerId: orderToDeliver.customerId!,
                    productId: clientProduct.id
                  }
                })

                // Se não existe, criar
                if (!inventory) {
                  console.log(`📊 [INVENTORY] Criando registro de estoque...`)
                  inventory = await tx.clientInventory.create({
                    data: {
                      customerId: orderToDeliver.customerId!,
                      productId: clientProduct.id,
                      currentStock: 0,
                      measurementUnit: 'UN'
                    }
                  })
                  console.log(`✅ [INVENTORY] Estoque criado: ${inventory.id}`)
                } else {
                  console.log(`✅ [INVENTORY] Estoque já existe: ${inventory.id} (estoque atual: ${inventory.currentStock})`)
                }

                // Atualizar estoque (adicionar quantidade)
                const estoqueAntes = inventory.currentStock
                console.log(`📈 [STOCK UPDATE] ${estoqueAntes} + ${item.quantity} = ${estoqueAntes + item.quantity}`)
                await tx.clientInventory.update({
                  where: { id: inventory.id },
                  data: {
                    currentStock: { increment: item.quantity },
                    lastRestockDate: new Date(),
                    lastRestockQuantity: item.quantity
                  }
                })

                // Criar movimentação de entrada
                await tx.clientInventoryMovement.create({
                  data: {
                    customerId: orderToDeliver.customerId!,
                    inventoryId: inventory.id,
                    type: 'ENTRY',
                    quantity: item.quantity,
                    reason: 'PURCHASE',
                    referenceId: purchase.id,
                    notes: `Entrada automática do pedido #${orderToDeliver.orderNumber}`,
                    performedBy: user?.id || 'SYSTEM'
                  }
                })

                console.log(`✅ [MOVEMENT] Movimentação de estoque registrada`)
                productosProcessados++
              } catch (itemError: any) {
                console.error(`❌ [ERROR] Erro ao processar produto ${item.Product.name}:`, itemError.message)
                throw itemError // Propagar erro para cancelar transação
              }
            }

            console.log(`\n✅ [TRANSACTION] Transação concluída com sucesso!`)
            console.log(`📊 [SUMMARY] Produtos processados: ${productosProcessados}/${orderToDeliver.OrderItem.length}`)
          })
          
          console.log(`\n✅ [DELIVERY] Entrega processada com sucesso!`)
          
          // 🎁 PROCESSAR BÔNUS DE INDICAÇÃO SE APLICÁVEL
          if (orderToDeliver.customerId) {
            try {
              const { processReferralBonus } = await import('@/lib/referral-helpers');
              const referralResult = await processReferralBonus(
                orderToDeliver.customerId,
                params.id,
                orderToDeliver.total
              );
              
              if (referralResult && referralResult.success) {
                console.log(`🎁 [REFERRAL] Bônus processado com sucesso!`);
                console.log(`   - ${referralResult.referrerName}: ${referralResult.bonusReferrer.toLocaleString()} pontos`);
                console.log(`   - ${referralResult.referredName}: ${referralResult.bonusReferred.toLocaleString()} pontos`);
              }
            } catch (referralError) {
              console.error('⚠️ [REFERRAL ERROR] Erro ao processar bônus de indicação:', referralError);
              // Não bloqueia a entrega se falhar
            }
          }
        }
      } catch (deliveryError: any) {
        console.error(`❌ [DELIVERY ERROR] Erro ao processar entrega:`, deliveryError)
        console.error(`📋 [STACK]`, deliveryError.stack)
        throw deliveryError // Propagar erro para o catch principal
      }
    }

    // 🆕 CRIAR OU ATUALIZAR CONTA A RECEBER BASEADO NO STATUS DE PAGAMENTO
    // ✅ ALTERADO: Criar receivable quando CONFIRMED, não apenas quando DELIVERED
    if ((status === 'CONFIRMED' || status === 'DELIVERED') && paymentStatus) {
      console.log(`\n💰 [RECEIVABLE] Gerenciando conta a receber (status: ${paymentStatus}, orderStatus: ${status})...`)
      
      try {
        // Buscar pedido para obter dados
        const orderForReceivable = await prisma.order.findUnique({
          where: { id: params.id },
          include: { Customer: true }
        })

        if (orderForReceivable && orderForReceivable.customerId) {
          // Verificar se já existe conta a receber para este pedido
          const existingReceivable = await prisma.receivable.findFirst({
            where: { orderId: params.id }
          })

          if (paymentStatus === 'UNPAID') {
            // CRIAR conta a receber se não existe
            if (!existingReceivable) {
              const receivable = await prisma.receivable.create({
                data: {
                  customerId: orderForReceivable.customerId || null,
                  orderId: params.id,
                  description: `Pedido #${orderForReceivable.orderNumber} - ${orderForReceivable.paymentMethod}`,
                  amount: orderForReceivable.total,
                  dueDate: new Date(), // Vencimento imediato
                  status: 'PENDING',
                  bankAccountId: null // Remove conta ao marcar como não pago
                }
              })
              
              console.log(`✅ [RECEIVABLE] Conta a receber criada: ${receivable.id} - R$ ${orderForReceivable.total.toFixed(2)}`)
            } else if (existingReceivable.status === 'PAID') {
              // Se já estava pago e marcou como não pago, reabrir
              await prisma.receivable.update({
                where: { id: existingReceivable.id },
                data: { 
                  status: 'PENDING',
                  paymentDate: null,
                  netAmount: null,
                  bankAccountId: null // Remove conta bancária ao reabrir
                }
              })
              console.log(`⚠️ [RECEIVABLE] Conta a receber reaberta (estava paga)`)
            } else {
              console.log(`ℹ️ [RECEIVABLE] Conta a receber já existe e está pendente`)
            }
          } else if (paymentStatus === 'PAID') {
            // MARCAR como pago se existe
            if (existingReceivable && existingReceivable.status !== 'PAID') {
              await prisma.receivable.update({
                where: { id: existingReceivable.id },
                data: { 
                  status: 'PAID',
                  paymentDate: new Date(),
                  netAmount: orderForReceivable.total,
                  bankAccountId: bankAccountId || null, // Associar conta bancária
                  paymentMethod: orderForReceivable.paymentMethod
                }
              })
              console.log(`✅ [RECEIVABLE] Conta a receber marcada como paga: R$ ${orderForReceivable.total.toFixed(2)}`)
              console.log(`🏦 [RECEIVABLE] Conta bancária: ${bankAccountId || 'Não especificada'}`)
              
              // 🔧 CORREÇÃO CRÍTICA: Criar transação bancária quando pedido é marcado como PAID
              // ⚠️ ANTI-DUPLICATA: Verificar se já existe PIX/transação com valor similar
              if (bankAccountId) {
                console.log(`\n🏦 [TRANSACTION] Verificando se já existe transação para este pagamento...`)
                
                const bankAccount = await prisma.bankAccount.findUnique({
                  where: { id: bankAccountId },
                })
                
                if (bankAccount) {
                  const netAmount = orderForReceivable.total
                  const customerName = orderForReceivable.casualCustomerName || orderForReceivable.Customer?.name || 'Cliente não identificado'
                  
                  // 🔍 VERIFICAÇÃO ANTI-DUPLICATA: Buscar transações recentes com valor similar
                  const tolerancia = 2.00 // R$ 2,00 de tolerância para taxas
                  const dataLimite = new Date()
                  dataLimite.setHours(dataLimite.getHours() - 72) // Últimas 72 horas
                  
                  const transacaoExistente = await prisma.transaction.findFirst({
                    where: {
                      bankAccountId: bankAccountId,
                      type: 'INCOME',
                      createdAt: { gte: dataLimite },
                      amount: {
                        gte: Number(netAmount) - tolerancia,
                        lte: Number(netAmount) + tolerancia
                      },
                      OR: [
                        // PIX com nome do cliente
                        { description: { contains: customerName.split(' ')[0], mode: 'insensitive' } },
                        // Já vinculado a este pedido
                        { description: { contains: orderForReceivable.orderNumber || '', mode: 'insensitive' } }
                      ]
                    }
                  })
                  
                  if (transacaoExistente) {
                    // ✅ JÁ EXISTE - Apenas vincular ao receivable, não criar duplicata
                    console.log(`   ⚠️ ANTI-DUPLICATA: Transação similar já existe!`)
                    console.log(`   - Transação existente: ${transacaoExistente.description}`)
                    console.log(`   - Valor: R$ ${Number(transacaoExistente.amount).toFixed(2)}`)
                    console.log(`   - Data: ${transacaoExistente.createdAt}`)
                    
                    // Atualizar a transação existente para vincular ao receivable (se não estiver vinculada)
                    if (!transacaoExistente.referenceId) {
                      await prisma.transaction.update({
                        where: { id: transacaoExistente.id },
                        data: {
                          referenceId: existingReceivable.id,
                          referenceType: 'RECEIVABLE',
                          notes: `${transacaoExistente.notes || ''} | Vinculado ao pedido #${orderForReceivable.orderNumber}`.trim()
                        }
                      })
                      console.log(`   ✅ Transação existente vinculada ao pedido (sem criar duplicata)`)
                    } else {
                      console.log(`   ℹ️ Transação já estava vinculada a outro registro`)
                    }
                  } else {
                    // 🆕 NÃO EXISTE - Criar nova transação
                    const newBalance = Number(bankAccount.balance) + Number(netAmount)
                    
                    console.log(`   - Conta: ${bankAccount.name}`)
                    console.log(`   - Saldo atual: R$ ${Number(bankAccount.balance).toFixed(2)}`)
                    console.log(`   - Valor recebido: R$ ${netAmount.toFixed(2)}`)
                    console.log(`   - Novo saldo: R$ ${newBalance.toFixed(2)}`)
                    
                    // Criar transação de entrada
                    await prisma.transaction.create({
                      data: {
                        bankAccountId: bankAccountId,
                        type: 'INCOME',
                        amount: Number(netAmount),
                        description: `Recebimento: Pedido #${orderForReceivable.orderNumber} - Cliente: ${customerName}`,
                        referenceId: existingReceivable.id,
                        referenceType: 'RECEIVABLE',
                        category: 'VENDA',
                        date: new Date(),
                        balanceAfter: newBalance,
                        notes: `Pagamento do pedido #${orderForReceivable.orderNumber}`,
                        createdBy: user?.id,
                      },
                    })
                    
                    // Atualizar saldo da conta bancária
                    await prisma.bankAccount.update({
                      where: { id: bankAccountId },
                      data: { balance: newBalance },
                    })
                    
                    console.log(`   ✅ Transação bancária criada e saldo atualizado!`)
                  }
                } else {
                  console.log(`   ⚠️ Conta bancária não encontrada: ${bankAccountId}`)
                }
              }
            } else {
              console.log(`ℹ️ [RECEIVABLE] Conta a receber já está paga ou não existe`)
            }
          }
        }
      } catch (receivableError: any) {
        console.error(`❌ [RECEIVABLE ERROR] Erro ao gerenciar conta a receber:`, receivableError.message)
        // Não bloqueia a atualização do pedido se falhar
      }
    }

    // 🆕 ATUALIZAR COMPRA SE O PAGAMENTO MUDAR APÓS ENTREGA
    if (paymentStatus && status !== 'DELIVERED') {
      console.log(`\n📦 [PURCHASE UPDATE] Atualizando status de compra existente (paymentStatus: ${paymentStatus})...`)
      
      try {
        // Buscar pedido para obter o orderNumber
        const orderForPurchase = await prisma.order.findUnique({
          where: { id: params.id },
          select: { orderNumber: true, customerId: true, total: true }
        })

        if (orderForPurchase && orderForPurchase.customerId) {
          // Buscar compra vinculada a este pedido (pelo invoiceNumber que é o orderNumber)
          const existingPurchase = await prisma.purchase.findFirst({
            where: {
              customerId: orderForPurchase.customerId,
              invoiceNumber: orderForPurchase.orderNumber
            }
          })

          if (existingPurchase) {
            console.log(`📝 [PURCHASE UPDATE] Compra encontrada: ${existingPurchase.id} - Status atual: ${existingPurchase.status}`)
            
            // Atualizar status da compra baseado no paymentStatus
            await prisma.purchase.update({
              where: { id: existingPurchase.id },
              data: {
                status: paymentStatus === 'PAID' ? 'PAID' : 'PENDING',
                paymentDate: paymentStatus === 'PAID' ? new Date() : null,
                bankAccountId: paymentStatus === 'PAID' ? (bankAccountId || null) : null // Associar conta ao pagar, remover ao marcar não pago
              }
            })
            
            console.log(`✅ [PURCHASE UPDATE] Compra atualizada para status: ${paymentStatus === 'PAID' ? 'PAID' : 'PENDING'}`)
            console.log(`🏦 [PURCHASE UPDATE] Conta bancária: ${paymentStatus === 'PAID' ? (bankAccountId || 'Não especificada') : 'Removida'}`)
          } else {
            console.log(`ℹ️ [PURCHASE UPDATE] Nenhuma compra encontrada para o pedido #${orderForPurchase.orderNumber}`)
          }
        }
      } catch (purchaseError: any) {
        console.error(`❌ [PURCHASE UPDATE ERROR] Erro ao atualizar compra:`, purchaseError.message)
        // Não bloqueia a atualização do pedido se falhar
      }
    }

    const order = await prisma.order.update({
      where: {
        id: params.id
      },
      data: {
        ...(status && { status }),
        ...(notes !== undefined && { notes }),
        // 🆕 Usar paymentStatus do body ou UNPAID como padrão quando entregue
        ...(status === 'DELIVERED' && { 
          paymentStatus: paymentStatus || 'UNPAID' 
        }),
        // Se paymentStatus for explicitamente PAID, atualizar
        ...(paymentStatus === 'PAID' && { paymentStatus: 'PAID' }),
        // 🆕 Permitir alterar deliveryDate - usa T12:00:00.000Z para evitar problema de fuso horário
        ...(deliveryDate && { deliveryDate: new Date(deliveryDate + 'T12:00:00.000Z') }),
        // 🆕 Permitir alterar deliveryType
        ...(deliveryType && { deliveryType })
      },
      include: {
        Customer: true,
        User: true,
        OrderItem: {
          include: {
            Product: true
          }
        }
      }
    })

    // Enviar notificação automática quando o status mudar
    if (status && order.customerId) {
      await notifyOrderStatusChange(order.id, order.customerId, status);
    }

    // Serialize the order
    const serializedOrder = {
      ...order,
      subtotal: Number(order.subtotal),
      discount: Number(order.discount),
      total: Number(order.total),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      deliveryDate: order.deliveryDate?.toISOString() || null,
      orderItems: order.OrderItem?.map((item: any) => ({
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
    console.error('Error updating order:', error)
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    // Admin e vendedores podem excluir pedidos
    if (!user || (user.userType !== 'ADMIN' && user.userType !== 'SELLER')) {
      return NextResponse.json(
        { error: 'Não autorizado. Somente administradores e vendedores podem excluir pedidos.' },
        { status: 403 }
      )
    }

    // Se for vendedor, só pode excluir seus próprios pedidos
    if (user.userType === 'SELLER') {
      const order = await prisma.order.findUnique({
        where: { id: params.id },
        select: { sellerId: true }
      })

      if (!order) {
        return NextResponse.json(
          { error: 'Pedido não encontrado' },
          { status: 404 }
        )
      }

      if (order.sellerId !== user.sellerId) {
        return NextResponse.json(
          { error: 'Você só pode excluir pedidos que você mesmo criou' },
          { status: 403 }
        )
      }
    }

    // Use transaction to ensure all operations succeed or fail together
    const result = await prisma.$transaction(async (tx: any) => {
      // Buscar o pedido com todos os dados associados
      const order = await tx.order.findUnique({
        where: { id: params.id },
        include: {
          Boleto: true,
          Customer: true
        }
      })

      if (!order) {
        throw new Error('Order not found')
      }

      // ✅ RESTAURAR CRÉDITO DO CLIENTE (SEMPRE, independente do método de pagamento)
      // Como TODOS os pedidos reservam crédito na criação, precisamos devolver ao excluir
      let creditRestored = false
      
      if (order.customerId && order.paymentStatus !== 'PAID') {
        // Apenas devolve crédito se o pedido NÃO foi pago
        // Se foi pago, o crédito já foi devolvido no momento do pagamento
        const orderTotal = Number(order.total)
        
        console.log(`\n💰 [CRÉDITO] Devolvendo crédito do pedido excluído...`)
        console.log(`   - Cliente: ${order.Customer?.name}`)
        console.log(`   - Total do Pedido: R$ ${orderTotal.toFixed(2)}`)
        console.log(`   - Status de Pagamento: ${order.paymentStatus}`)
        console.log(`   - Método de Pagamento: ${order.paymentMethod}`)
        
        // Devolver o crédito total do pedido
        await tx.customer.update({
          where: { id: order.customerId },
          data: {
            availableCredit: {
              increment: orderTotal
            }
          }
        })
        
        console.log(`✅ Crédito restaurado: R$ ${orderTotal.toFixed(2)} para cliente ${order.Customer?.name}`)
        creditRestored = true
      } else if (order.paymentStatus === 'PAID') {
        console.log(`\n💰 [CRÉDITO] Pedido já estava PAGO - crédito não precisa ser devolvido`)
      }
      
      // Cancelar boletos pendentes (se houver)
      const pendingBoletos = order.Boleto.filter(b => b.status === 'PENDING')
      if (pendingBoletos.length > 0) {
        // Cancelar os boletos no Cora primeiro (se configurado)
        const coraConfigured = isCoraConfigured()
        if (coraConfigured) {
          console.log(`\n🔄 Cancelando ${pendingBoletos.length} boleto(s) no Cora...`)
          
          for (const boleto of pendingBoletos) {
            if (boleto.pixPaymentId) {
              try {
                // 🏦 Usar a conta Cora salva no boleto (ou ESPETOS como padrão)
                const boletoAccount = (boleto.coraAccount as 'ESPETOS' | 'GENUINO') || 'ESPETOS'
                console.log(`🏦 Cancelando boleto ${boleto.id} na conta Cora: ${boletoAccount}`)
                await cancelPixCharge(boleto.pixPaymentId, boletoAccount)
                console.log(`✅ Boleto ${boleto.id} cancelado no Cora com sucesso (Invoice ID: ${boleto.pixPaymentId})`)
              } catch (error: any) {
                // Log o erro mas não trava o processo - o boleto será cancelado localmente
                console.error(`❌ Erro ao cancelar boleto ${boleto.id} no Cora:`, error?.message || error)
                console.log(`⚠️ Continuando com o cancelamento local do boleto...`)
              }
            } else {
              console.log(`⚠️ Boleto ${boleto.id} não tem pixPaymentId - pulando cancelamento no Cora`)
            }
          }
        } else {
          console.log('⚠️ Cora não configurado - cancelando boletos apenas localmente')
        }
        
        // Cancelar os boletos pendentes no banco de dados local
        await tx.boleto.updateMany({
          where: {
            orderId: params.id,
            status: 'PENDING'
          },
          data: {
            status: 'CANCELLED',
            notes: 'Pedido excluído pelo administrador'
          }
        })
        
        console.log(`✅ ${pendingBoletos.length} boleto(s) cancelado(s)`)
      }

      // Remover pontos ganhos neste pedido
      let pointsRemoved = false
      if (order.customerId) {
        // Buscar a transação de pontos deste pedido
        const pointTransaction = await tx.pointTransaction.findFirst({
          where: {
            customerId: order.customerId,
            orderId: params.id,
            type: 'EARNED_FROM_ORDER'
          }
        })

        if (pointTransaction && pointTransaction.points > 0) {
          const pointsToRemove = Math.abs(pointTransaction.points)
          
          // Remover os pontos do cliente
          await tx.customer.update({
            where: { id: order.customerId },
            data: {
              pointsBalance: { decrement: pointsToRemove },
              totalPointsEarned: { decrement: pointsToRemove }
            }
          })

          // Excluir a transação de pontos
          await tx.pointTransaction.delete({
            where: { id: pointTransaction.id }
          })

          pointsRemoved = true
          console.log(`Pontos removidos: ${pointsToRemove} pontos do cliente ${order.Customer?.name}`)
        }
      }

      // Excluir manualmente as comissões associadas ao pedido
      await tx.commission.deleteMany({
        where: { orderId: params.id }
      })

      // 🗑️ EXCLUIR Purchase do módulo de gestão do cliente (se existir)
      console.log(`\n📦 [PURCHASE DELETE] Verificando compras associadas ao pedido...`)
      const relatedPurchases = await tx.purchase.findMany({
        where: {
          customerId: order.customerId,
          invoiceNumber: order.orderNumber
        },
        include: {
          PurchaseItem: true,
          Expense: true
        }
      })

      if (relatedPurchases.length > 0) {
        console.log(`📋 [PURCHASE DELETE] Encontradas ${relatedPurchases.length} compra(s) para excluir`)
        
        for (const purchase of relatedPurchases) {
          // Excluir itens da compra
          await tx.purchaseItem.deleteMany({
            where: { purchaseId: purchase.id }
          })
          console.log(`   ✅ ${purchase.PurchaseItem.length} item(ns) excluído(s) da compra ${purchase.purchaseNumber}`)
          
          // Excluir despesa associada (se existir)
          if (purchase.Expense) {
            await tx.expense.delete({
              where: { id: purchase.Expense.id }
            })
            console.log(`   ✅ Despesa ${purchase.Expense.id} excluída`)
          }
          
          // Excluir a compra
          await tx.purchase.delete({
            where: { id: purchase.id }
          })
          console.log(`   ✅ Compra ${purchase.purchaseNumber} excluída do módulo de gestão`)
        }
      } else {
        console.log(`📋 [PURCHASE DELETE] Nenhuma compra encontrada para este pedido`)
      }

      // 📦 REVERTER ESTOQUE DO CLIENTE (SEMPRE, independente do status)
      if (order.customerId) {
        console.log(`\n📦 [INVENTORY REVERT] Revertendo estoque do pedido...`)
        console.log(`   Status do pedido: ${order.status}`)
        
        // Buscar os itens do pedido
        const orderItems = await tx.orderItem.findMany({
          where: { orderId: params.id },
          include: { 
            Product: true,
            RawMaterial: true // 🔧 FIX: Incluir matérias-primas
          }
        })
        
        console.log(`📋 [INVENTORY REVERT] Encontrados ${orderItems.length} item(ns) para reverter`)
        
        for (const item of orderItems) {
          // 🔧 FIX: Buscar nome do Product ou RawMaterial
          const itemName = item.Product?.name || item.RawMaterial?.name || 'Item Desconhecido';
          
          // Buscar o produto no catálogo do cliente
          const clientProduct = await tx.clientProduct.findFirst({
            where: {
              customerId: order.customerId,
              name: itemName
            }
          })
          
          if (clientProduct) {
            // Buscar o estoque deste produto
            const inventory = await tx.clientInventory.findFirst({
              where: {
                customerId: order.customerId,
                productId: clientProduct.id
              }
            })
            
            if (inventory) {
              const estoqueAtual = inventory.currentStock
              const quantidadeRemover = item.quantity
              const novoEstoque = Math.max(0, estoqueAtual - quantidadeRemover) // Não deixa negativo
              
              console.log(`   📉 ${itemName}: ${estoqueAtual} - ${quantidadeRemover} = ${novoEstoque}`)
              
              // Remover do estoque
              await tx.clientInventory.update({
                where: { id: inventory.id },
                data: {
                  currentStock: novoEstoque
                }
              })
              
              // Criar movimentação de saída (EXIT)
              await tx.clientInventoryMovement.create({
                data: {
                  customerId: order.customerId,
                  inventoryId: inventory.id,
                  type: 'EXIT',
                  quantity: quantidadeRemover,
                  reason: 'ORDER_DELETION',
                  referenceId: params.id,
                  notes: `Reversão automática - pedido #${order.orderNumber} excluído (Status: ${order.status})`,
                  performedBy: user?.id || 'SYSTEM'
                }
              })
              
              console.log(`   ✅ Estoque revertido e movimentação registrada`)
            } else {
              console.log(`   ⚠️ Estoque não encontrado para ${itemName}`)
            }
          } else {
            console.log(`   ⚠️ Produto ${itemName} não encontrado no catálogo do cliente`)
          }
        }
        
        console.log(`✅ [INVENTORY REVERT] Estoque revertido com sucesso!`)
      } else {
        console.log(`\n📦 [INVENTORY REVERT] Pedido não tem cliente associado - pulando reversão de estoque`)
      }

      // ✅ CRÍTICO: Reverter transações bancárias ANTES de excluir receivables
      console.log(`\n🏦 [BANK REVERT] Verificando transações bancárias do pedido...`)
      
      // 0️⃣ REVERTER TRANSAÇÕES PELA DESCRIÇÃO (contendo o número do pedido)
      // Isso cobre transações que não foram criadas com referenceType/referenceId
      const transactionsByDescription = await tx.transaction.findMany({
        where: {
          description: { contains: order.orderNumber },
          type: 'INCOME'
        },
        include: {
          BankAccount: true
        }
      })
      
      console.log(`📊 [BANK REVERT] Encontradas ${transactionsByDescription.length} transação(ões) pela descrição (${order.orderNumber})`)
      
      for (const transaction of transactionsByDescription) {
        console.log(`   🔄 Revertendo R$ ${Number(transaction.amount).toFixed(2)} da conta ${transaction.BankAccount.name}`)
        
        // Atualizar saldo da conta bancária (decrementar)
        await tx.bankAccount.update({
          where: { id: transaction.bankAccountId },
          data: {
            balance: {
              decrement: transaction.amount
            }
          }
        })
        
        // Excluir a transação
        await tx.transaction.delete({
          where: { id: transaction.id }
        })
        
        console.log(`   ✅ Transação revertida e excluída`)
      }
      
      // 1️⃣ REVERTER TRANSAÇÕES DIRETAS DO PEDIDO (referenceType: 'ORDER')
      const orderTransactions = await tx.transaction.findMany({
        where: {
          referenceId: params.id,
          referenceType: 'ORDER',
          type: 'INCOME'
        },
        include: {
          BankAccount: true
        }
      })
      
      console.log(`📊 [BANK REVERT] Encontradas ${orderTransactions.length} transação(ões) diretas do pedido`)
      
      for (const transaction of orderTransactions) {
        console.log(`   🔄 Revertendo R$ ${transaction.amount.toFixed(2)} da conta ${transaction.BankAccount.name}`)
        
        // Atualizar saldo da conta bancária (decrementar)
        await tx.bankAccount.update({
          where: { id: transaction.bankAccountId },
          data: {
            balance: {
              decrement: transaction.amount
            }
          }
        })
        
        console.log(`   ✅ Saldo revertido com sucesso`)
      }
      
      // Excluir as transações diretas do pedido
      const deletedOrderTransactions = await tx.transaction.deleteMany({
        where: {
          referenceId: params.id,
          referenceType: 'ORDER'
        }
      })
      
      if (deletedOrderTransactions.count > 0) {
        console.log(`   🗑️ ${deletedOrderTransactions.count} transação(ões) direta(s) excluída(s)`)
      }
      
      // 2️⃣ REVERTER TRANSAÇÕES DE RECEIVABLES
      const orderReceivables = await tx.receivable.findMany({
        where: { orderId: params.id }
      })
      
      console.log(`📊 [BANK REVERT] Encontrados ${orderReceivables.length} receivable(s)`)
      
      // Para cada receivable, buscar e reverter transações bancárias
      for (const receivable of orderReceivables) {
        // Buscar transações associadas a este receivable
        const transactions = await tx.transaction.findMany({
          where: {
            referenceId: receivable.id,
            referenceType: 'RECEIVABLE',
            type: 'INCOME'
          },
          include: {
            BankAccount: true
          }
        })
        
        console.log(`   💳 Receivable ${receivable.id}: ${transactions.length} transação(ões)`)
        
        // Reverter cada transação
        for (const transaction of transactions) {
          console.log(`      🔄 Revertendo R$ ${transaction.amount.toFixed(2)} da conta ${transaction.BankAccount.name}`)
          
          // Atualizar saldo da conta bancária (decrementar)
          await tx.bankAccount.update({
            where: { id: transaction.bankAccountId },
            data: {
              balance: {
                decrement: transaction.amount
              }
            }
          })
          
          console.log(`      ✅ Saldo revertido com sucesso`)
        }
        
        // Excluir as transações bancárias dos receivables
        const deletedTransactions = await tx.transaction.deleteMany({
          where: {
            referenceId: receivable.id,
            referenceType: 'RECEIVABLE'
          }
        })
        
        if (deletedTransactions.count > 0) {
          console.log(`   🗑️ ${deletedTransactions.count} transação(ões) de receivable excluída(s)`)
        }
      }

      // ✅ AGORA SIM: Excluir todas as entradas de Contas a Receber associadas ao pedido
      const deletedReceivables = await tx.receivable.deleteMany({
        where: { orderId: params.id }
      })
      console.log(`✅ ${deletedReceivables.count} entrada(s) de Contas a Receber excluída(s)`)

      // Excluir o pedido (cascata irá excluir orderItems automaticamente)
      // Os boletos NÃO serão excluídos, apenas cancelados para manter o histórico
      await tx.order.delete({
        where: { id: params.id }
      })

      return {
        success: true,
        message: 'Pedido excluído com sucesso',
        creditRestored,
        pointsRemoved
      }
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error deleting order:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to delete order' },
      { status: 500 }
    )
  }
}
