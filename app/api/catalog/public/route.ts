import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getImageUrl } from '@/lib/s3'
import { productSelect } from '@/lib/product-select'
import { sortProductsByCategory, CATEGORY_DISPLAY_ORDER } from '@/lib/category-sort'

export const dynamic = 'force-dynamic'

export async function GET() {
  console.log('🔥🔥🔥 API /api/catalog/public CHAMADA 🔥🔥🔥')
  try {
    // Buscar todos os produtos ativos
    console.log('📦 Buscando produtos ativos do banco...')
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
        priceWholesale: true,
        priceRetail: true,
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

    // 🔧 CORREÇÃO: Gerar URLs S3 assinadas para todas as imagens
    console.log(`🖼️ Gerando URLs S3 para ${products.length} produtos...`)
    
    if (products.length > 0) {
      console.log(`📸 AMOSTRA - Produto 1:`)
      console.log(`   - Nome: ${products[0].name}`)
      console.log(`   - imageUrl ANTES: ${products[0].imageUrl}`)
    }
    
    const productsWithUrls = await Promise.all(
      products.map(async (product) => {
        try {
          if (product.imageUrl) {
            console.log(`🔍 Chamando getImageUrl para: ${product.imageUrl}`)
            const signedUrl = await getImageUrl(product.imageUrl)
            console.log(`✅ Retornou URL assinada: ${signedUrl}`)
            return {
              ...product,
              imageUrl: signedUrl
            }
          }
          console.log(`⚠️ Produto ${product.name} sem imageUrl, retornando original`)
          return product
        } catch (err) {
          console.error(`❌ Erro ao gerar URL para produto ${product.id}:`, err)
          return {
            ...product,
            imageUrl: '/placeholder-product.jpg'
          }
        }
      })
    )
    
    if (productsWithUrls.length > 0) {
      console.log(`📸 AMOSTRA - Produto 1 DEPOIS:`)
      console.log(`   - Nome: ${productsWithUrls[0].name}`)
      console.log(`   - imageUrl DEPOIS: ${productsWithUrls[0].imageUrl}`)
    }
    
    console.log(`✅ URLs S3 geradas com sucesso`)

    // 📦 Ordenar produtos por categoria: 1-Espeto, 2-Hamburguers, 3-Carvao, 4-Outros
    const sortedProducts = sortProductsByCategory(productsWithUrls)
    
    // Agrupar produtos por categoria (já ordenados)
    const productsByCategory: Record<string, typeof productsWithUrls> = {}
    
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
    console.error('Erro ao buscar catálogo público:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro ao carregar catálogo' 
      },
      { status: 500 }
    )
  }
}
