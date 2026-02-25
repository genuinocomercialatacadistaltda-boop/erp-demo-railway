import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getImageUrl } from '@/lib/s3'
import { productSelect } from '@/lib/product-select'
import { sortProductsByCategory } from '@/lib/category-sort'

export const dynamic = 'force-dynamic' // 🔥 SEMPRE regenerar signed URLs
export const revalidate = 0 // 🔥 Não cachear

export async function GET() {
  try {
    console.log('[PUBLIC_PRODUCTS] Buscando produtos para o carrossel...')
    
    // Buscar TODOS os produtos ativos com imagens VÁLIDAS (S3)
    // 🚫 Filtrar produtos com imagens base64 (placeholders da internet)
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        imageUrl: {
          not: ''
        },
        // 🎯 Excluir imagens base64 (fotos aleatórias da internet)
        NOT: {
          imageUrl: {
            startsWith: 'data:image'
          }
        }
      },
      select: {
        id: true,
        name: true,
        description: true,
        imageUrl: true,
        priceWholesale: true,
        priceRetail: true,
        bulkDiscountMinQty: true,
        bulkDiscountPrice: true
      },
      orderBy: {
        name: 'asc'
      }
      // 🎯 SEM LIMITE - Mostra TODOS os produtos no carrossel
    })

    console.log(`[PUBLIC_PRODUCTS] ${products.length} produtos encontrados com imagens S3 válidas`)

    // 🔥 Gerar signed URLs FRESCAS a cada requisição (não cachear)
    const productsWithSignedUrls = await Promise.all(
      products.map(async (product) => {
        try {
          // 🔍 Verificar se é um path S3 válido
          if (!product.imageUrl || product.imageUrl.trim() === '') {
            throw new Error('ImageUrl vazio')
          }
          
          // 🔥 SEMPRE gerar nova signed URL (válida por 1h)
          const signedUrl = await getImageUrl(product.imageUrl)
          
          if (!signedUrl) {
            throw new Error('Signed URL não gerada')
          }
          
          console.log(`[PUBLIC_PRODUCTS] ✅ "${product.name}": Signed URL regenerada`)
          
          return {
            ...product,
            imageUrl: signedUrl,
            priceWholesale: product.priceWholesale ? Number(product.priceWholesale) : 0,
            priceRetail: product.priceRetail ? Number(product.priceRetail) : 0,
            bulkDiscountMinQty: product.bulkDiscountMinQty || null,
            bulkDiscountPrice: product.bulkDiscountPrice ? Number(product.bulkDiscountPrice) : null
          }
        } catch (error) {
          console.error(`[PUBLIC_PRODUCTS] ❌ FALHA "${product.name}" (${product.id}):`, error)
          // ⚠️ Retornar null para remover produtos com erro
          return null
        }
      })
    )
    
    // 🎯 Filtrar produtos com erro (null) para não aparecerem no carrossel
    const validProducts = productsWithSignedUrls.filter(p => p !== null)

    // 📦 Ordenar por categoria: 1-Espeto, 2-Hamburguers, 3-Carvao, 4-Outros
    const sortedProducts = sortProductsByCategory(validProducts as any[])

    console.log(`[PUBLIC_PRODUCTS] Retornando ${sortedProducts.length} produtos válidos com URLs frescas (ordenados por categoria)`)
    
    // 🔥 Headers para não cachear
    return NextResponse.json(
      { products: sortedProducts },
      { 
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        }
      }
    )
  } catch (error) {
    console.error('[PUBLIC_PRODUCTS] Erro ao buscar produtos:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar produtos' },
      { status: 500 }
    )
  }
}
