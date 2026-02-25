import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'
import { productSelect } from '@/lib/product-select'
import { sortProductsByCategory, CATEGORY_DISPLAY_ORDER } from '@/lib/category-sort'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Não autenticado' },
        { status: 401 }
      )
    }

    // Buscar produtos ativos (catálogo simplificado - apenas produtos finais)
    const products = await prisma.product.findMany({
      where: {
        isActive: true
      },
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ],
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        priceRetail: true,
        priceWholesale: true,
        weight: true,
        isActive: true,
        availableIn: true,
        quantityIncrement: true,
        imageUrl: true,
        // 🏷️ Promoções
        isOnPromotion: true,
        promotionalPrice: true,
        isWeeklyPromotion: true
      }
    })

    // 📦 Ordenar produtos por categoria: 1-Espeto, 2-Hamburguers, 3-Carvao, 4-Outros
    const sortedProducts = sortProductsByCategory(products)
    
    // Agrupar por categoria (já ordenados)
    const productsByCategory: Record<string, typeof products> = {}
    
    sortedProducts.forEach(product => {
      const category = product.category || 'Outros'
      if (!productsByCategory[category]) {
        productsByCategory[category] = []
      }
      productsByCategory[category].push(product)
    })

    // Ordenar categorias na ordem correta: Espeto, Hamburguers, Carvao, Outros
    const sortedCategories = Object.keys(productsByCategory).sort((a, b) => {
      const orderA = CATEGORY_DISPLAY_ORDER.find(c => c.label.toLowerCase() === a.toLowerCase())?.order || 4
      const orderB = CATEGORY_DISPLAY_ORDER.find(c => c.label.toLowerCase() === b.toLowerCase())?.order || 4
      return orderA - orderB
    })

    return NextResponse.json({
      success: true,
      categories: sortedCategories,
      productsByCategory
    })
  } catch (error) {
    console.error('Erro ao buscar catálogo varejo:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao carregar catálogo' },
      { status: 500 }
    )
  }
}
