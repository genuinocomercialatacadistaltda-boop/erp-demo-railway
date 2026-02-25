import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { authOptions } from '@/lib/auth-options'

export const dynamic = 'force-dynamic'

/**
 * GET /api/products/stock - Buscar estoque de produtos acabados, matérias-primas e insumos
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    console.log('[PRODUCTS_STOCK_GET] Buscando estoque completo (produtos, matérias-primas e insumos)')

    // 1. Buscar Produtos Acabados
    const products = await prisma.product.findMany({
      where: {
        isActive: true
      },
      include: {
        Recipe: {
          include: {
            Ingredients: {
              include: {
                RawMaterial: true
              }
            }
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    const productsWithAlerts = products.map(product => {
      let alert = null
      
      if (product.minStock && product.currentStock <= product.minStock) {
        alert = 'LOW_STOCK'
      } else if (product.maxStock && product.currentStock >= product.maxStock) {
        alert = 'HIGH_STOCK'
      }

      return {
        ...product,
        type: 'product',
        alert,
        hasRecipe: product.Recipe && product.Recipe.length > 0,
        ingredientsCount: product.Recipe?.[0]?.Ingredients?.length || 0,
        unit: 'un'
      }
    })

    // 2. Buscar Matérias-Primas
    const rawMaterials = await prisma.rawMaterial.findMany({
      where: {
        isActive: true
      },
      orderBy: {
        name: 'asc'
      }
    })

    const rawMaterialsWithAlerts = rawMaterials.map(material => {
      let alert = null
      
      if (material.minStock && material.currentStock <= material.minStock) {
        alert = 'LOW_STOCK'
      } else if (material.maxStock && material.currentStock >= material.maxStock) {
        alert = 'HIGH_STOCK'
      }

      return {
        id: material.id,
        name: material.name,
        type: 'raw_material',
        category: 'Matéria-Prima',
        imageUrl: material.imageUrl || '',
        currentStock: material.currentStock,
        minStock: material.minStock,
        maxStock: material.maxStock,
        unit: material.measurementUnit,
        sku: material.sku,
        alert,
        hasRecipe: false,
        ingredientsCount: 0
      }
    })

    // 3. Buscar Insumos
    const supplies = await prisma.productionSupplyGlobal.findMany({
      where: {
        isActive: true
      },
      orderBy: {
        name: 'asc'
      }
    })

    const suppliesWithAlerts = supplies.map(supply => {
      let alert = null
      
      if (supply.minStock && supply.currentStock <= supply.minStock) {
        alert = 'LOW_STOCK'
      } else if (supply.maxStock && supply.currentStock >= supply.maxStock) {
        alert = 'HIGH_STOCK'
      }

      return {
        id: supply.id,
        name: supply.name,
        type: 'supply',
        category: supply.category,
        imageUrl: '',
        currentStock: supply.currentStock,
        minStock: supply.minStock,
        maxStock: supply.maxStock,
        unit: supply.unit,
        sku: supply.sku,
        alert,
        hasRecipe: false,
        ingredientsCount: 0
      }
    })

    // Combinar todos os itens
    const allItems = [
      ...productsWithAlerts,
      ...rawMaterialsWithAlerts,
      ...suppliesWithAlerts
    ]

    const stats = {
      totalProducts: products.length,
      totalRawMaterials: rawMaterials.length,
      totalSupplies: supplies.length,
      totalItems: allItems.length,
      productsWithRecipe: products.filter(p => p.Recipe && p.Recipe.length > 0).length,
      productsWithoutRecipe: products.filter(p => !p.Recipe || p.Recipe.length === 0).length,
      lowStockCount: allItems.filter(p => p.alert === 'LOW_STOCK').length,
      highStockCount: allItems.filter(p => p.alert === 'HIGH_STOCK').length,
      totalStock: products.reduce((sum, p) => sum + (p.currentStock || 0), 0)
    }

    console.log(`[PRODUCTS_STOCK_GET] ${allItems.length} itens encontrados (${products.length} produtos, ${rawMaterials.length} matérias-primas, ${supplies.length} insumos)`)

    return NextResponse.json({ 
      items: allItems,
      products: productsWithAlerts, // Mantém compatibilidade
      rawMaterials: rawMaterialsWithAlerts,
      supplies: suppliesWithAlerts,
      stats
    }, { status: 200 })
  } catch (error: any) {
    console.error('[PRODUCTS_STOCK_GET] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar estoque', details: error.message },
      { status: 500 }
    )
  }
}
