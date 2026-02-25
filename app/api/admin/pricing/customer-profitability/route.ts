import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Rentabilidade por Cliente - Baseada em vendas reais para cada cliente
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const customerId = searchParams.get('customerId') // Filtro opcional por cliente específico

    // Filtro de data (padrão: mês atual)
    const now = new Date()
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const defaultEnd = now

    const dateFilter = {
      gte: startDate ? new Date(startDate + 'T00:00:00') : defaultStart,
      lte: endDate ? new Date(endDate + 'T23:59:59') : defaultEnd
    }

    console.log('📊 [RENTABILIDADE POR CLIENTE] Período:', dateFilter.gte, 'até', dateFilter.lte)

    // Buscar todos os pedidos no período com itens e cliente
    const orders = await prisma.order.findMany({
      where: {
        createdAt: dateFilter,
        status: {
          in: ['CONFIRMED', 'PREPARING', 'READY', 'DELIVERING', 'DELIVERED']
        },
        ...(customerId ? { customerId } : {})
      },
      include: {
        Customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        OrderItem: {
          where: {
            productId: { not: null }
          },
          include: {
            Product: {
              include: {
                Recipe: {
                  include: {
                    Ingredients: {
                      include: {
                        RawMaterial: {
                          select: {
                            id: true,
                            name: true,
                            costPerUnit: true,
                            measurementUnit: true,
                            icmsRate: true
                          }
                        }
                      }
                    },
                    Supplies: true
                  }
                }
              }
            }
          }
        }
      }
    }) as any[]

    console.log(`📦 [RENTABILIDADE POR CLIENTE] ${orders.length} pedidos encontrados`)

    // Tipagem para métricas por cliente
    interface CustomerProductMetric {
      productId: string
      productName: string
      hasRecipe: boolean
      costPerUnit: number
      totalQuantity: number
      totalRevenue: number
      totalCost: number
      avgPrice: number
      profit: number
      margin: number
    }

    interface CustomerMetric {
      customerId: string
      customerName: string
      customerEmail: string | null
      customerPhone: string | null
      totalOrders: number
      totalQuantity: number
      totalRevenue: number
      totalCost: number
      totalProfit: number
      avgMargin: number
      products: Record<string, CustomerProductMetric>
    }

    const customerMetrics: Record<string, CustomerMetric> = {}

    // Função para calcular custo de um produto
    const calculateProductCost = (product: any): { cost: number; hasRecipe: boolean } => {
      let costPerUnit = 0
      let hasRecipe = false

      const recipe = product?.Recipe?.[0]
      if (recipe) {
        hasRecipe = true

        // Custo dos ingredientes (COM QUEBRAS e ICMS)
        for (const ing of recipe.Ingredients || []) {
          if (ing.RawMaterial) {
            // Usar o custo da matéria-prima + ICMS fixo de 3.6% (se habilitado)
            let rawMaterialCost = Number(ing.RawMaterial.costPerUnit) || 0
            const hasIcms = ((ing.RawMaterial as any).icmsRate || 0) > 0
            if (hasIcms) {
              rawMaterialCost = rawMaterialCost * 1.036
            }
            let adjustedQuantity = ing.quantityGrams || 0
            const measurementUnit = ing.RawMaterial.measurementUnit
            
            if (ing.invisibleWastePercent > 0) {
              adjustedQuantity = adjustedQuantity * (1 + ing.invisibleWastePercent / 100)
            }
            if (ing.visibleWastePercent > 0) {
              adjustedQuantity = adjustedQuantity * (1 + ing.visibleWastePercent / 100)
            }
            
            if (measurementUnit === 'KG' || measurementUnit === 'G') {
              costPerUnit += rawMaterialCost * (adjustedQuantity / 1000)
            } else {
              costPerUnit += rawMaterialCost * adjustedQuantity
            }
          }
        }

        // Custo dos insumos
        for (const sup of recipe.Supplies || []) {
          const unitCost = Number(sup.costPerUnit) || 0
          const qty = Number(sup.quantityPerUnit) || 1
          costPerUnit += unitCost / qty
        }
      }

      return { cost: costPerUnit, hasRecipe }
    }

    const FIXED_MARGIN_FOR_NO_RECIPE = 0.30

    // Processar pedidos
    for (const order of orders) {
      const customer = order.Customer
      if (!customer) continue

      const customerId = customer.id

      // Inicializar métricas do cliente se não existir
      if (!customerMetrics[customerId]) {
        customerMetrics[customerId] = {
          customerId,
          customerName: customer.name || 'Cliente sem nome',
          customerEmail: customer.email,
          customerPhone: customer.phone,
          totalOrders: 0,
          totalQuantity: 0,
          totalRevenue: 0,
          totalCost: 0,
          totalProfit: 0,
          avgMargin: 0,
          products: {}
        }
      }

      const customerData = customerMetrics[customerId]
      customerData.totalOrders += 1

      // Processar itens do pedido
      for (const item of order.OrderItem) {
        const product = item.Product
        if (!product || !item.productId) continue

        const productId = item.productId
        const productName = product.name
        const priceSold = Number(item.unitPrice) || 0
        const quantity = item.quantity
        const revenue = priceSold * quantity

        const { cost: costPerUnit, hasRecipe } = calculateProductCost(product)

        // Inicializar produto para este cliente se não existir
        if (!customerData.products[productId]) {
          customerData.products[productId] = {
            productId,
            productName,
            hasRecipe,
            costPerUnit,
            totalQuantity: 0,
            totalRevenue: 0,
            totalCost: 0,
            avgPrice: 0,
            profit: 0,
            margin: 0
          }
        }

        const productData = customerData.products[productId]
        productData.totalQuantity += quantity
        productData.totalRevenue += revenue
        productData.totalCost += costPerUnit * quantity

        customerData.totalQuantity += quantity
        customerData.totalRevenue += revenue
        customerData.totalCost += costPerUnit * quantity
      }
    }

    // Calcular métricas finais
    const customers = Object.values(customerMetrics).map(customer => {
      // Processar produtos do cliente
      const productsList = Object.values(customer.products).map(p => {
        p.avgPrice = p.totalQuantity > 0 ? p.totalRevenue / p.totalQuantity : 0

        // Se não tem receita, estimar custo com margem fixa de 30%
        if (!p.hasRecipe) {
          p.costPerUnit = p.avgPrice / (1 + FIXED_MARGIN_FOR_NO_RECIPE)
          p.totalCost = p.costPerUnit * p.totalQuantity
        }

        p.profit = p.totalRevenue - p.totalCost
        p.margin = p.totalRevenue > 0 ? (p.profit / p.totalRevenue) * 100 : 0

        return p
      })

      // Ordenar produtos por quantidade
      productsList.sort((a, b) => b.totalQuantity - a.totalQuantity)

      // Recalcular totais do cliente com estimativas de produtos sem receita
      customer.totalCost = productsList.reduce((sum, p) => sum + p.totalCost, 0)
      customer.totalProfit = customer.totalRevenue - customer.totalCost
      customer.avgMargin = customer.totalRevenue > 0 ? (customer.totalProfit / customer.totalRevenue) * 100 : 0

      return {
        ...customer,
        products: productsList
      }
    })

    // Ordenar clientes por faturamento
    customers.sort((a, b) => b.totalRevenue - a.totalRevenue)

    // Resumo geral
    const totalRevenue = customers.reduce((sum, c) => sum + c.totalRevenue, 0)
    const totalCost = customers.reduce((sum, c) => sum + c.totalCost, 0)
    const totalProfit = customers.reduce((sum, c) => sum + c.totalProfit, 0)
    const totalQuantity = customers.reduce((sum, c) => sum + c.totalQuantity, 0)
    const totalOrders = customers.reduce((sum, c) => sum + c.totalOrders, 0)
    const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

    const summary = {
      period: {
        start: dateFilter.gte.toISOString(),
        end: dateFilter.lte.toISOString()
      },
      totalCustomers: customers.length,
      totalOrders,
      totalQuantitySold: totalQuantity,
      totalRevenue,
      totalCost,
      totalProfit,
      avgMargin,
      topByRevenue: customers.slice(0, 5),
      topByProfit: customers.slice().sort((a, b) => b.totalProfit - a.totalProfit).slice(0, 5),
      lowMarginCustomers: customers.filter(c => c.avgMargin < 20 && c.totalOrders >= 2)
    }

    console.log(`✅ [RENTABILIDADE POR CLIENTE] ${customers.length} clientes analisados`)
    console.log(`💰 [RENTABILIDADE POR CLIENTE] Receita: R$ ${totalRevenue.toFixed(2)}, Lucro: R$ ${totalProfit.toFixed(2)}, Margem: ${avgMargin.toFixed(2)}%`)

    return NextResponse.json({ summary, customers })

  } catch (error) {
    console.error('❌ [RENTABILIDADE POR CLIENTE] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao calcular rentabilidade por cliente', details: String(error) },
      { status: 500 }
    )
  }
}
