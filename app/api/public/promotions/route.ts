import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getImageUrl } from '@/lib/s3'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    console.log('[PUBLIC_PROMOTIONS] Buscando promoções da semana...')
    
    // Buscar produtos em promoção
    const promotions = await prisma.product.findMany({
      where: {
        isActive: true,
        isOnPromotion: true,
        promotionalPrice: {
          not: null
        }
      },
      select: {
        id: true,
        name: true,
        description: true,
        imageUrl: true,
        weight: true,
        priceWholesale: true,
        priceRetail: true,
        promotionalPrice: true,
        isWeeklyPromotion: true,
        category: true
      },
      orderBy: [
        { isWeeklyPromotion: 'desc' }, // Promoção da semana primeiro
        { name: 'asc' }
      ]
    })

    console.log(`[PUBLIC_PROMOTIONS] ${promotions.length} promoções encontradas`)

    // Gerar signed URLs
    const promotionsWithUrls = await Promise.all(
      promotions.map(async (product) => {
        try {
          let imageUrl = product.imageUrl
          
          // Se for path S3, gerar signed URL
          if (product.imageUrl && !product.imageUrl.startsWith('http') && !product.imageUrl.startsWith('data:')) {
            imageUrl = await getImageUrl(product.imageUrl) || product.imageUrl
          }
          
          return {
            ...product,
            imageUrl,
            priceWholesale: product.priceWholesale ? Number(product.priceWholesale) : 0,
            priceRetail: product.priceRetail ? Number(product.priceRetail) : 0,
            promotionalPrice: product.promotionalPrice ? Number(product.promotionalPrice) : null,
            // Calcular desconto
            discountPercent: product.priceWholesale && product.promotionalPrice 
              ? Math.round((1 - Number(product.promotionalPrice) / Number(product.priceWholesale)) * 100)
              : 0
          }
        } catch (error) {
          console.error(`[PUBLIC_PROMOTIONS] Erro ao processar ${product.name}:`, error)
          return null
        }
      })
    )

    const validPromotions = promotionsWithUrls.filter(p => p !== null)
    
    // Separar promoção da semana das outras
    const weeklyPromotion = validPromotions.find(p => p?.isWeeklyPromotion)
    const otherPromotions = validPromotions.filter(p => !p?.isWeeklyPromotion)

    console.log(`[PUBLIC_PROMOTIONS] Retornando ${validPromotions.length} promoções (${weeklyPromotion ? '1 da semana' : '0 da semana'})`)

    return NextResponse.json(
      { 
        weeklyPromotion,
        promotions: otherPromotions,
        total: validPromotions.length
      },
      { 
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        }
      }
    )
  } catch (error) {
    console.error('[PUBLIC_PROMOTIONS] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar promoções' },
      { status: 500 }
    )
  }
}
