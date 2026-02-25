export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { getImageUrl } from '@/lib/s3'
import { productSelect } from '@/lib/product-select'
import { sortProductsByCategory } from '@/lib/category-sort'

/**
 * GET - Buscar catálogo completo (produtos + matérias-primas) para vendedores/funcionários
 * Esta API é usada quando vendedores/funcionários precisam ver todos os itens disponíveis
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    // Permitir acesso para ADMIN, SELLER e EMPLOYEE
    if (!session || !['ADMIN', 'SELLER', 'EMPLOYEE'].includes(user?.userType)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    console.log('[PRODUCTS_CATALOG] Buscando catálogo completo para:', user?.userType, user?.email)

    // Buscar todos os produtos ativos de atacado
    const allProducts = await prisma.product.findMany({
      where: {
        isActive: true,
        availableIn: {
          in: ['WHOLESALE', 'BOTH']
        }
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        imageUrl: true,
        weight: true,
        priceWholesale: true,
        priceRetail: true,
        category: true,
        availableIn: true,
        quantityIncrement: true,
        soldByWeight: true,
        bulkDiscountMinQty: true,
        bulkDiscountPrice: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        currentStock: true,
        minStock: true,
        // 🏷️ Promoções
        isOnPromotion: true,
        promotionalPrice: true,
        isWeeklyPromotion: true
      }
    })

    console.log('[PRODUCTS_CATALOG] Produtos encontrados:', allProducts.length)

    // Buscar matérias-primas disponíveis no catálogo
    const rawMaterials = await prisma.rawMaterial.findMany({
      where: {
        isActive: true,
        showInCatalog: true
      },
      orderBy: { name: 'asc' }
    })

    console.log('[PRODUCTS_CATALOG] Matérias-primas encontradas:', rawMaterials.length)

    // Mapear produtos normais
    const mappedProducts = allProducts.map((product: any) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      sku: product.sku,
      weight: product.weight,
      category: product.category,
      priceWholesale: Number(product.priceWholesale),
      priceRetail: Number(product.priceRetail),
      bulkDiscountMinQty: product.bulkDiscountMinQty || null,
      bulkDiscountPrice: product.bulkDiscountPrice ? Number(product.bulkDiscountPrice) : null,
      imageUrl: product.imageUrl || '/placeholder-product.jpg',
      isActive: product.isActive,
      availableIn: product.availableIn,
      quantityIncrement: product.quantityIncrement || 1,
      soldByWeight: product.soldByWeight || false,
      currentStock: Number(product.currentStock || 0),
      minStock: product.minStock ? Number(product.minStock) : null,
      isRawMaterial: false,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      // 🏷️ Promoções
      isOnPromotion: product.isOnPromotion || false,
      promotionalPrice: product.promotionalPrice ? Number(product.promotionalPrice) : null,
      isWeeklyPromotion: product.isWeeklyPromotion || false
    }))

    // Mapear matérias-primas como produtos
    const mappedRawMaterials = rawMaterials.map((material: any) => ({
      id: material.id,
      name: material.name,
      description: material.description || 'Matéria-prima',
      sku: material.sku || '',
      weight: material.measurementUnit || 'kg',
      measurementUnit: material.measurementUnit,
      category: 'Matéria-Prima',
      priceWholesale: Number(material.priceWholesale || 0),
      priceRetail: Number(material.priceWholesale || 0),
      bulkDiscountMinQty: null,
      bulkDiscountPrice: null,
      currentStock: Number(material.currentStock || 0),
      minStock: material.minStock ? Number(material.minStock) : null,
      imageUrl: material.imageUrl || '/placeholder-product.jpg',
      isActive: material.isActive,
      availableIn: 'WHOLESALE',
      quantityIncrement: 1,
      soldByWeight: material.soldByWeight || false,
      isRawMaterial: true,
      categoryId: material.categoryId
    }))

    // Combinar produtos e matérias-primas
    const allItems = [...mappedProducts, ...mappedRawMaterials]

    console.log('[PRODUCTS_CATALOG] Total de itens (produtos + matérias-primas):', allItems.length)
    console.log('[PRODUCTS_CATALOG] Matérias-primas no array:', mappedRawMaterials.length)
    console.log('[PRODUCTS_CATALOG] Nomes das matérias-primas:', mappedRawMaterials.map((m: any) => m.name).join(', '))

    // ⚡ Gerar URLs S3 assinadas (COM CACHE de 50 minutos)
    const itemsWithUrls = await Promise.all(
      allItems.map(async (item: any) => {
        try {
          if (item.imageUrl && item.imageUrl !== '/placeholder-product.jpg') {
            const signedUrl = await getImageUrl(item.imageUrl)
            return {
              ...item,
              imageUrl: signedUrl
            }
          }
          return item
        } catch (err) {
          console.error(`[PRODUCTS_CATALOG] Erro ao gerar URL para item ${item.id}:`, err)
          return {
            ...item,
            imageUrl: '/placeholder-product.jpg'
          }
        }
      })
    )

    // 📦 Ordenar por categoria: 1-Espeto, 2-Hamburguers, 3-Carvao, 4-Outros
    const sortedItems = sortProductsByCategory(itemsWithUrls)
    
    console.log('[PRODUCTS_CATALOG] 🚀 Retornando resposta com URLs S3 (cache ativo)')
    console.log('[PRODUCTS_CATALOG] 🚀 Total de itens:', sortedItems.length)
    console.log('[PRODUCTS_CATALOG] 🚀 Matérias-primas:', sortedItems.filter((i: any) => i.isRawMaterial).length)

    return NextResponse.json({ products: sortedItems })
  } catch (error) {
    console.error('[PRODUCTS_CATALOG] Erro ao buscar catálogo:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar catálogo completo' },
      { status: 500 }
    )
  }
}
