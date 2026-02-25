import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Rentabilidade Real - Baseada em vendas reais (preços efetivamente praticados no checkout)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Filtro de data (padrão: mês atual)
    const now = new Date()
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const defaultEnd = now

    const dateFilter = {
      gte: startDate ? new Date(startDate + 'T00:00:00') : defaultStart,
      lte: endDate ? new Date(endDate + 'T23:59:59') : defaultEnd
    }

    console.log('📊 [RENTABILIDADE REAL] Período:', dateFilter.gte, 'até', dateFilter.lte)

    // Buscar todos os itens de pedidos no período
    const orderItems = await prisma.orderItem.findMany({
      where: {
        Order: {
          createdAt: dateFilter,
          status: {
            in: ['CONFIRMED', 'PREPARING', 'READY', 'DELIVERING', 'DELIVERED']
          }
        },
        productId: { not: null }
      },
      include: {
        Product: {
          select: {
            id: true,
            name: true,
            unitCost: true,  // 💰 Custo unitário para produtos sem receita (revenda)
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
                Supplies: true // ProductionSupply já tem costPerUnit diretamente
              }
            }
          }
        },
        Order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
            discount: true,
            createdAt: true
          }
        }
      }
    }) as any[]

    console.log(`📦 [RENTABILIDADE REAL] ${orderItems.length} itens de pedidos encontrados`)

    // Tipagem para métricas
    interface ProductMetric {
      productId: string
      productName: string
      hasRecipe: boolean
      hasUnitCost: boolean  // 💰 Indica se tem custo cadastrado (produto de revenda)
      recipeName: string | null
      costPerUnit: number
      totalQuantitySold: number
      totalRevenue: number
      totalCost: number
      avgPriceSold: number
      realProfit: number
      realMargin: number
      priceWholesale: number
      salesByPrice: Record<string, { qty: number; revenue: number }>
    }

    const productMetrics: Record<string, ProductMetric> = {}

    for (const item of orderItems) {
      const product = item.Product
      if (!product || !item.productId) continue

      const productId = item.productId
      const productName = product.name

      // Calcular custo de produção (da receita ou unitCost cadastrado)
      let costPerUnit = 0
      let hasRecipe = false
      let recipeName: string | null = null
      let hasUnitCost = false  // 💰 Indica se tem custo cadastrado (produto de revenda)

      // Recipe é um array (um produto pode ter múltiplas receitas), pegar a primeira
      const recipe = product.Recipe?.[0]
      if (recipe) {
        hasRecipe = true
        recipeName = recipe.name

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
            
            // 🔧 APLICAR QUEBRAS (waste) - multiplicativo
            // Aplicar quebra invisível (ex: 110g × 1.10 = 121g)
            if (ing.invisibleWastePercent > 0) {
              adjustedQuantity = adjustedQuantity * (1 + ing.invisibleWastePercent / 100)
            }
            // Aplicar quebra visível (ex: 121g × 1.10 = 133.1g)
            if (ing.visibleWastePercent > 0) {
              adjustedQuantity = adjustedQuantity * (1 + ing.visibleWastePercent / 100)
            }
            
            // Se a unidade de medida é KG ou G, o costPerUnit é por kg
            // Então dividimos adjustedQuantity por 1000 para converter para kg
            // Se for UN (unidade), adjustedQuantity representa quantidade de unidades
            if (measurementUnit === 'KG' || measurementUnit === 'G') {
              // costPerUnit é por KG, adjustedQuantity está em gramas
              costPerUnit += rawMaterialCost * (adjustedQuantity / 1000)
            } else {
              // costPerUnit é por unidade, adjustedQuantity representa quantidade de unidades
              costPerUnit += rawMaterialCost * adjustedQuantity
            }
          }
        }

        // Custo dos insumos (ProductionSupply já tem costPerUnit)
        // CORREÇÃO: Dividir pelo quantityPerUnit (quantas unidades do produto são produzidas com 1 insumo)
        // Ex: Embalagem R$ 0,11 produz 5 espetos → R$ 0,11 / 5 = R$ 0,022 por espeto
        for (const sup of recipe.Supplies || []) {
          const supplyCost = Number(sup.costPerUnit) || 0
          const qty = Number(sup.quantityPerUnit) || 1
          costPerUnit += supplyCost / qty
        }
      } else if (product.unitCost && Number(product.unitCost) > 0) {
        // 💰 Produto SEM RECEITA mas COM CUSTO CADASTRADO (revenda: acendedor, pão de alho, etc)
        hasUnitCost = true
        costPerUnit = Number(product.unitCost)
        recipeName = 'Custo Cadastrado (Revenda)'
        console.log(`💰 [RENTABILIDADE REAL] Produto "${productName}" usa custo cadastrado: R$ ${costPerUnit.toFixed(2)}`)
      }

      // Preço real vendido
      const priceSold = Number(item.unitPrice) || 0
      const quantity = item.quantity
      const revenue = priceSold * quantity

      // Inicializar métricas do produto se não existir
      if (!productMetrics[productId]) {
        productMetrics[productId] = {
          productId,
          productName,
          hasRecipe,
          hasUnitCost,  // 💰 Se tem custo cadastrado (revenda)
          recipeName,
          costPerUnit,
          totalQuantitySold: 0,
          totalRevenue: 0,
          totalCost: 0,
          avgPriceSold: 0,
          realProfit: 0,
          realMargin: 0,
          priceWholesale: 0,
          salesByPrice: {}
        }
      }

      // Acumular métricas
      const metrics = productMetrics[productId]
      metrics.totalQuantitySold += quantity
      metrics.totalRevenue += revenue
      metrics.totalCost += costPerUnit * quantity

      // Agrupar vendas por faixa de preço
      const priceKey = priceSold.toFixed(2)
      if (!metrics.salesByPrice[priceKey]) {
        metrics.salesByPrice[priceKey] = { qty: 0, revenue: 0 }
      }
      metrics.salesByPrice[priceKey].qty += quantity
      metrics.salesByPrice[priceKey].revenue += revenue
    }

    // Calcular métricas finais
    const FIXED_MARGIN_FOR_NO_RECIPE = 0.30

    const products = Object.values(productMetrics).map(p => {
      p.avgPriceSold = p.totalQuantitySold > 0 ? p.totalRevenue / p.totalQuantitySold : 0

      // 💰 Se não tem receita E não tem custo cadastrado, estimar custo com margem fixa de 30%
      // Se tem custo cadastrado (hasUnitCost), já foi calculado corretamente
      if (!p.hasRecipe && !p.hasUnitCost) {
        p.costPerUnit = p.avgPriceSold / (1 + FIXED_MARGIN_FOR_NO_RECIPE)
        p.totalCost = p.costPerUnit * p.totalQuantitySold
        p.recipeName = 'Margem ~30% (sem custo)'
      }

      p.realProfit = p.totalRevenue - p.totalCost
      p.realMargin = p.totalRevenue > 0 ? (p.realProfit / p.totalRevenue) * 100 : 0

      return p
    })

    // Ordenar por quantidade vendida
    products.sort((a, b) => b.totalQuantitySold - a.totalQuantitySold)

    // 🔧 BUSCAR FATURAMENTO REAL via Order.total (inclui taxa de entrega, serviços, etc)
    const ordersForRevenue = await prisma.order.findMany({
      where: {
        createdAt: dateFilter,
        status: {
          in: ['CONFIRMED', 'PREPARING', 'READY', 'DELIVERING', 'DELIVERED']
        }
      },
      select: { total: true }
    })
    const realTotalRevenue = ordersForRevenue.reduce((sum, o) => sum + Number(o.total), 0)
    
    // Resumo geral
    // totalRevenue dos produtos (para cálculo de lucro dos produtos)
    const productTotalRevenue = products.reduce((sum, p) => sum + p.totalRevenue, 0)
    const totalCost = products.reduce((sum, p) => sum + p.totalCost, 0)
    
    // 🔧 Usar faturamento REAL para o resumo (inclui itens sem produto como taxa de entrega)
    const totalRevenue = realTotalRevenue
    const totalProfit = totalRevenue - totalCost
    const totalQuantity = products.reduce((sum, p) => sum + p.totalQuantitySold, 0)
    const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0

    const productsWithRecipe = products.filter(p => p.hasRecipe)
    const productsWithoutRecipe = products.filter(p => !p.hasRecipe)
    
    console.log(`📊 [RENTABILIDADE] Faturamento produtos: R$ ${productTotalRevenue.toFixed(2)}, Faturamento REAL: R$ ${realTotalRevenue.toFixed(2)}`)

    const summary = {
      period: {
        start: dateFilter.gte.toISOString(),
        end: dateFilter.lte.toISOString()
      },
      totalProducts: products.length,
      totalQuantitySold: totalQuantity,
      totalRevenue,
      totalCost,
      totalProfit,
      avgMargin,
      productsWithRecipe: productsWithRecipe.length,
      productsWithoutRecipe: productsWithoutRecipe.length,
      topByProfit: products.slice().sort((a, b) => b.realProfit - a.realProfit).slice(0, 5),
      topByMargin: productsWithRecipe.slice().sort((a, b) => b.realMargin - a.realMargin).slice(0, 5),
      lowMarginProducts: productsWithRecipe.filter(p => p.realMargin < 20 && p.totalQuantitySold >= 10)
    }

    console.log(`✅ [RENTABILIDADE REAL] ${products.length} produtos analisados`)
    console.log(`💰 [RENTABILIDADE REAL] Receita: R$ ${totalRevenue.toFixed(2)}, Lucro: R$ ${totalProfit.toFixed(2)}, Margem: ${avgMargin.toFixed(2)}%`)

    return NextResponse.json({ summary, products })

  } catch (error) {
    console.error('❌ [RENTABILIDADE REAL] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao calcular rentabilidade real', details: String(error) },
      { status: 500 }
    )
  }
}
