
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { productSelect } from '@/lib/product-select'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const product = await prisma.product.findUnique({
      where: {
        id: params.id
      },
      select: {
        id: true,
        name: true,
        description: true,
        imageUrl: true,
        weight: true,
        priceWholesale: true,
        priceRetail: true,
        unitCost: true,  // Custo unitário para produtos sem receita
        category: true,
        availableIn: true,
        quantityIncrement: true,
        soldByWeight: true,
        bulkDiscountMinQty: true,
        bulkDiscountPrice: true,
        isActive: true,
        // 🏷️ Promoções
        isOnPromotion: true,
        promotionalPrice: true,
        isWeeklyPromotion: true,
        createdAt: true,
        updatedAt: true,
      }
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    const serializedProduct = {
      ...product,
      priceWholesale: Number(product.priceWholesale),
      priceRetail: Number(product.priceRetail),
      bulkDiscountMinQty: product.bulkDiscountMinQty || null,
      bulkDiscountPrice: product.bulkDiscountPrice ? Number(product.bulkDiscountPrice) : null,
      promotionalPrice: product.promotionalPrice ? Number(product.promotionalPrice) : null,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString()
    }

    return NextResponse.json(serializedProduct)
  } catch (error) {
    console.error('Error fetching product:', error)
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { name, description, imageUrl, weight, priceWholesale, priceRetail, unitCost, category, isActive, availableIn, quantityIncrement, soldByWeight, bulkDiscountMinQty, bulkDiscountPrice, isOnPromotion, promotionalPrice, isWeeklyPromotion } = body

    console.log('[PRODUCTS_PUT] ID:', params.id, 'soldByWeight recebido:', soldByWeight, 'isOnPromotion:', isOnPromotion, 'imageUrl recebido:', imageUrl ? 'SIM' : 'NÃO')

    // 🖼️ PRESERVAR IMAGEURL: Buscar existente primeiro
    const existingProduct = await prisma.product.findUnique({
      where: { id: params.id },
      select: { imageUrl: true }
    })
    
    let finalImageUrl = existingProduct?.imageUrl || ''
    
    // 🖼️ Se recebeu uma nova imageUrl
    if (imageUrl && imageUrl.trim() !== '') {
      // ⚠️ CORREÇÃO: Se a imageUrl é uma URL assinada (contém X-Amz-), manter a existente do banco
      // URLs assinadas expiram e não devem ser salvas no banco
      if (imageUrl.includes('X-Amz-')) {
        console.log('[PRODUCTS_PUT] Detectada URL assinada, mantendo imageUrl existente do banco:', finalImageUrl)
        // Manter a imageUrl existente do banco
      } else if (imageUrl.startsWith('data:')) {
        // Data URI (novo upload local), será processado separadamente
        console.log('[PRODUCTS_PUT] Detectada Data URI, ignorando (upload deve usar endpoint especifico)')
      } else if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        // URL externa - verificar se nao eh do S3 assinada
        if (!imageUrl.includes('amazonaws.com') || !imageUrl.includes('X-Amz-')) {
          finalImageUrl = imageUrl
          console.log('[PRODUCTS_PUT] URL externa valida, salvando:', finalImageUrl)
        }
      } else {
        // Eh uma key S3 valida (ex: 8647/uploads/...)
        finalImageUrl = imageUrl
        console.log('[PRODUCTS_PUT] Key S3 valida, salvando:', finalImageUrl)
      }
    } else {
      console.log('[PRODUCTS_PUT] ImageUrl nao recebido, mantendo existente:', finalImageUrl)
    }

    const product = await prisma.product.update({
      where: {
        id: params.id
      },
      data: {
        ...(name && { name }),
        ...(description && { description }),
        ...(finalImageUrl && { imageUrl: finalImageUrl }),
        ...(weight && { weight }),
        ...(priceWholesale !== undefined && { priceWholesale: parseFloat(priceWholesale) }),
        ...(priceRetail !== undefined && { priceRetail: parseFloat(priceRetail) }),
        ...(unitCost !== undefined && { 
          unitCost: unitCost === null || unitCost === '' ? null : parseFloat(unitCost) 
        }),
        ...(bulkDiscountMinQty !== undefined && { 
          bulkDiscountMinQty: bulkDiscountMinQty === null || bulkDiscountMinQty === '' ? null : parseInt(bulkDiscountMinQty) 
        }),
        ...(bulkDiscountPrice !== undefined && { 
          bulkDiscountPrice: bulkDiscountPrice === null || bulkDiscountPrice === '' ? null : parseFloat(bulkDiscountPrice) 
        }),
        ...(category && { category }),
        ...(isActive !== undefined && { isActive }),
        ...(availableIn && { availableIn }),
        ...(quantityIncrement !== undefined && { quantityIncrement: parseInt(quantityIncrement) }),
        ...(soldByWeight !== undefined && { soldByWeight: soldByWeight === true || soldByWeight === 'true' }),
        // 🏷️ Promoções
        ...(isOnPromotion !== undefined && { isOnPromotion: isOnPromotion === true }),
        ...(promotionalPrice !== undefined && { 
          promotionalPrice: promotionalPrice === null || promotionalPrice === '' ? null : parseFloat(promotionalPrice) 
        }),
        ...(isWeeklyPromotion !== undefined && { isWeeklyPromotion: isWeeklyPromotion === true })
      }
    })
    
    console.log('[PRODUCTS_PUT] Produto atualizado - soldByWeight:', product.soldByWeight, 'isOnPromotion:', product.isOnPromotion)

    const serializedProduct = {
      ...product,
      priceWholesale: Number(product.priceWholesale),
      priceRetail: Number(product.priceRetail),
      bulkDiscountMinQty: product.bulkDiscountMinQty || null,
      bulkDiscountPrice: product.bulkDiscountPrice ? Number(product.bulkDiscountPrice) : null,
      promotionalPrice: product.promotionalPrice ? Number(product.promotionalPrice) : null,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString()
    }

    return NextResponse.json(serializedProduct)
  } catch (error) {
    console.error('Error updating product:', error)
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('[PRODUCTS_DELETE] Tentando deletar produto:', params.id);

    // Verificar se o produto tem relações (pedidos, receitas, etc.)
    const product = await prisma.product.findUnique({
      where: { id: params.id },
      include: {
        OrderItem: true,
        Recipe: true,
        CustomerProduct: true,
        ProductProfitability: true,
        PriceHistory: true,
        productionRecords: true,
        productionGoals: true,
        employeeStats: true,
        teamStats: true,
        inventoryMovements: true,
      }
    });

    if (!product) {
      console.log('[PRODUCTS_DELETE] Produto nao encontrado');
      return NextResponse.json(
        { error: 'Produto nao encontrado' },
        { status: 404 }
      );
    }

    // Verificar se tem relações
    const hasRelations = 
      product.OrderItem.length > 0 ||
      (product.Recipe && product.Recipe.length > 0) ||
      product.CustomerProduct.length > 0 ||
      product.ProductProfitability.length > 0 ||
      product.PriceHistory.length > 0 ||
      product.productionRecords.length > 0 ||
      product.productionGoals.length > 0 ||
      product.employeeStats.length > 0 ||
      product.teamStats.length > 0 ||
      product.inventoryMovements.length > 0;

    if (hasRelations) {
      console.log('[PRODUCTS_DELETE] Produto tem relacoes, marcando como inativo ao inves de deletar');
      
      // Marcar como inativo ao invés de deletar
      const updatedProduct = await prisma.product.update({
        where: { id: params.id },
        data: { isActive: false }
      });

      console.log('[PRODUCTS_DELETE] Produto marcado como inativo:', updatedProduct.id);

      return NextResponse.json({ 
        message: 'Produto possui vinculos com pedidos ou outros registros. Foi marcado como inativo.',
        action: 'deactivated',
        productId: updatedProduct.id
      });
    }

    // Se nao tem relacoes, pode deletar
    console.log('[PRODUCTS_DELETE] Produto sem relacoes, deletando permanentemente');
    await prisma.product.delete({
      where: { id: params.id }
    });

    console.log('[PRODUCTS_DELETE] Produto deletado com sucesso');
    return NextResponse.json({ 
      message: 'Produto deletado com sucesso',
      action: 'deleted'
    });

  } catch (error: any) {
    console.error('[PRODUCTS_DELETE] Erro ao deletar produto:', error);
    
    // Tratamento específico para erro de constraint de FK
    if (error.code === 'P2003' || error.message?.includes('Foreign key constraint')) {
      console.log('[PRODUCTS_DELETE] Erro de FK, tentando marcar como inativo');
      
      try {
        const updatedProduct = await prisma.product.update({
          where: { id: params.id },
          data: { isActive: false }
        });

        return NextResponse.json({ 
          message: 'Nao foi possivel deletar o produto pois ele esta vinculado a outros registros. Foi marcado como inativo.',
          action: 'deactivated',
          productId: updatedProduct.id
        });
      } catch (updateError) {
        console.error('[PRODUCTS_DELETE] Erro ao marcar produto como inativo:', updateError);
        return NextResponse.json(
          { error: 'Erro ao processar exclusao do produto' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Falha ao deletar produto', details: error.message },
      { status: 500 }
    );
  }
}
