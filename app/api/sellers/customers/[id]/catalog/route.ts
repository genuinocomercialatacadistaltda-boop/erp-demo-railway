export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import crypto from 'crypto'
import { productSelect } from '@/lib/product-select'
import { sortProductsByCategory } from '@/lib/category-sort'

// GET - Buscar produtos e configurações de catálogo do cliente
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || (session.user as any).userType !== 'SELLER') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const sellerId = (session.user as any).sellerId

    // Verificar se o cliente pertence ao vendedor
    const customer = await prisma.customer.findFirst({
      where: { 
        id: params.id,
        sellerId
      }
    })

    if (!customer) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    }

    // Buscar todos os produtos ativos (de atacado ou ambos)
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        availableIn: {
          in: ['WHOLESALE', 'BOTH']
        }
      },
      orderBy: {
        name: 'asc'
      },
      select: productSelect
    })

    // Buscar configurações customizadas do cliente
    const customerProducts = await prisma.customerProduct.findMany({
      where: {
        customerId: params.id
      }
    })

    // Criar mapa de configurações por produto
    const customerProductMap = new Map(
      customerProducts.map(cp => [cp.productId, cp])
    )

    // Combinar dados dos produtos com as configurações do cliente
    const productsWithCustomizations = products.map((product: any) => {
      const customization = customerProductMap.get(product.id) as any
      
      return {
        id: product.id,
        name: product.name,
        description: product.description,
        imageUrl: product.imageUrl,
        priceWholesale: product.priceWholesale,
        category: product.category,
        currentStock: Number(product.currentStock || 0),
        minStock: product.minStock ? Number(product.minStock) : null,
        isVisible: customization?.isVisible ?? true, // Padrão: visível
        customPrice: customization?.customPrice ?? null,
        customerProductId: customization?.id ?? null
      }
    })

    // 📦 Ordenar por categoria: 1-Espeto, 2-Hamburguers, 3-Carvao, 4-Outros
    const sortedProducts = sortProductsByCategory(productsWithCustomizations)

    return NextResponse.json({
      customer: {
        id: customer.id,
        name: customer.name,
        useCustomCatalog: customer.useCustomCatalog
      },
      products: sortedProducts
    })
  } catch (error) {
    console.error('Error fetching catalog:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar catálogo' },
      { status: 500 }
    )
  }
}

// PUT - Atualizar configurações de catálogo do cliente
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || (session.user as any).userType !== 'SELLER') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const sellerId = (session.user as any).sellerId
    const body = await req.json()
    const { useCustomCatalog, products } = body

    // Verificar se o cliente pertence ao vendedor
    const customer = await prisma.customer.findFirst({
      where: { 
        id: params.id,
        sellerId
      }
    })

    if (!customer) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    }

    // Atualizar em transação
    await prisma.$transaction(async (tx: any) => {
      // Atualizar flag de uso de catálogo customizado
      if (useCustomCatalog !== undefined) {
        await tx.customer.update({
          where: { id: params.id },
          data: { useCustomCatalog }
        })
      }

      // Se houver produtos para atualizar
      if (products && Array.isArray(products)) {
        for (const product of products) {
          const { productId, isVisible, customPrice } = product

          // Verificar se já existe configuração
          const existing = await tx.customerProduct.findFirst({
            where: {
              customerId: params.id,
              productId
            }
          })

          if (existing) {
            // Atualizar existente
            await tx.customerProduct.update({
              where: { id: existing.id },
              data: {
                isVisible: isVisible !== undefined ? isVisible : existing.isVisible,
                customPrice: customPrice !== undefined ? customPrice : existing.customPrice
              }
            })
          } else {
            // Criar novo
            await tx.customerProduct.create({
              data: {
                id: crypto.randomUUID(),
                customerId: params.id,
                productId,
                isVisible: isVisible ?? true,
                customPrice: customPrice ?? null,
                updatedAt: new Date()
              }
            })
          }
        }
      }
    })

    return NextResponse.json({
      message: 'Catálogo atualizado com sucesso'
    })
  } catch (error) {
    console.error('Error updating catalog:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar catálogo' },
      { status: 500 }
    )
  }
}
