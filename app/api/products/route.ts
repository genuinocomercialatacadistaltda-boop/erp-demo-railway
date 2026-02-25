
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import crypto from 'crypto'
import { getImageUrl } from '@/lib/s3'
import { productSelect } from '@/lib/product-select'
import { sortProductsByCategory } from '@/lib/category-sort'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'
    
    // 🆕 FILTRO POR MÊS DE CADASTRO
    const monthParam = searchParams.get('month') // Formato: "2026-02"
    
    // Construir filtro de data de criação
    let createdAtFilter: any = undefined;
    if (monthParam) {
      const [year, month] = monthParam.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999); // Último dia do mês
      createdAtFilter = {
        gte: startDate,
        lte: endDate
      };
      console.log(`[PRODUCTS_GET] Filtro de mês aplicado: ${monthParam} (${startDate.toISOString()} - ${endDate.toISOString()})`);
    }
    
    const products = await prisma.product.findMany({
      where: {
        ...(includeInactive ? {} : { isActive: true }),
        ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
      },
      orderBy: {
        name: 'asc'  // Ordenação secundária por nome
      },
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
        currentStock: true, // ✅ Incluído para modal de movimentação de estoque
        minStock: true,
        maxStock: true,
        createdAt: true,
        updatedAt: true,
        // 🏷️ Promoções
        isOnPromotion: true,
        promotionalPrice: true,
        isWeeklyPromotion: true,
      }
    })

    // Convert BigInt values to numbers and generate signed URLs for S3 images
    const serializedProducts = await Promise.all(products.map(async (product) => ({
      ...product,
      imageUrl: await getImageUrl(product.imageUrl),
      priceWholesale: Number(product.priceWholesale),
      priceRetail: Number(product.priceRetail),
      bulkDiscountMinQty: product.bulkDiscountMinQty || null,
      bulkDiscountPrice: product.bulkDiscountPrice ? Number(product.bulkDiscountPrice) : null,
      currentStock: Number(product.currentStock || 0),
      minStock: product.minStock ? Number(product.minStock) : null,
      maxStock: product.maxStock ? Number(product.maxStock) : null,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      // 🏷️ Promoções
      isOnPromotion: product.isOnPromotion || false,
      promotionalPrice: product.promotionalPrice ? Number(product.promotionalPrice) : null,
      isWeeklyPromotion: product.isWeeklyPromotion || false,
    })))

    // 📦 Ordenar por categoria: 1-Espeto, 2-Hamburguers, 3-Carvao, 4-Outros
    const sortedProducts = sortProductsByCategory(serializedProducts)

    return NextResponse.json(sortedProducts)
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, imageUrl, weight, priceWholesale, priceRetail, unitCost, category, availableIn, quantityIncrement, soldByWeight, bulkDiscountMinQty, bulkDiscountPrice, isOnPromotion, promotionalPrice, isWeeklyPromotion } = body

    console.log('[PRODUCTS_POST] Recebido soldByWeight:', soldByWeight, typeof soldByWeight)

    // Sem validações - aceita tudo

    const product = await prisma.product.create({
      data: {
        id: crypto.randomUUID(),
        name,
        description,
        imageUrl,
        weight,
        priceWholesale: parseFloat(priceWholesale),
        priceRetail: parseFloat(priceRetail),
        unitCost: unitCost ? parseFloat(unitCost) : null,  // Custo unitário para produtos sem receita
        ...(bulkDiscountMinQty !== undefined && bulkDiscountMinQty !== null && bulkDiscountMinQty !== '' && { bulkDiscountMinQty: parseInt(bulkDiscountMinQty) }),
        ...(bulkDiscountPrice !== undefined && bulkDiscountPrice !== null && bulkDiscountPrice !== '' && { bulkDiscountPrice: parseFloat(bulkDiscountPrice) }),
        category: category || 'Espetos',
        availableIn: availableIn || 'BOTH',
        quantityIncrement: quantityIncrement ? parseInt(quantityIncrement) : 1,
        soldByWeight: soldByWeight === true || soldByWeight === 'true',
        // 🏷️ Promoções
        isOnPromotion: isOnPromotion === true,
        promotionalPrice: promotionalPrice ? parseFloat(promotionalPrice) : null,
        isWeeklyPromotion: isWeeklyPromotion === true,
        updatedAt: new Date()
      }
    })
    
    console.log('[PRODUCTS_POST] Produto criado com soldByWeight:', product.soldByWeight)

    const serializedProduct = {
      ...product,
      priceWholesale: Number(product.priceWholesale),
      priceRetail: Number(product.priceRetail),
      bulkDiscountMinQty: product.bulkDiscountMinQty || null,
      bulkDiscountPrice: product.bulkDiscountPrice ? Number(product.bulkDiscountPrice) : null,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString()
    }

    return NextResponse.json(serializedProduct)
  } catch (error) {
    console.error('Error creating product:', error)
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    )
  }
}
