
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { getImageUrl } from '@/lib/s3'
import { productSelect } from '@/lib/product-select'

export const dynamic = "force-dynamic"

// GET - Buscar produtos personalizados de um cliente
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const customerId = params.id

    // 🔧 CORREÇÃO: Buscar cliente, produtos E matérias-primas personalizadas
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        CustomerProduct: {
          include: {
            Product: true
          }
        },
        CustomerRawMaterial: {
          include: {
            RawMaterial: true
          }
        }
      }
    })

    if (!customer) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    }

    // Buscar todos os produtos disponíveis
    const allProducts = await prisma.product.findMany({
      where: {
        isActive: true,
        availableIn: {
          in: ['WHOLESALE', 'BOTH']
        }
      },
      orderBy: { name: 'asc' },
      select: productSelect
    })

    // 🆕 Buscar todas as matérias-primas disponíveis para venda
    const allRawMaterials = await prisma.rawMaterial.findMany({
      where: {
        isActive: true,
        showInCatalog: true
      },
      orderBy: { name: 'asc' },
    })

    // Mapear produtos com configuração personalizada
    const productsWithConfig = allProducts.map((product: any) => {
      const customProduct = customer.CustomerProduct.find((cp: any) => cp.productId === product.id)
      
      return {
        ...product,
        priceWholesale: Number(product.priceWholesale),
        priceRetail: Number(product.priceRetail),
        bulkDiscountMinQty: product.bulkDiscountMinQty || null,
        bulkDiscountPrice: product.bulkDiscountPrice ? Number(product.bulkDiscountPrice) : null,
        customPrice: customProduct?.customPrice ? Number(customProduct.customPrice) : null,
        isVisible: customProduct?.isVisible ?? false,
        hasCustomConfig: !!customProduct,
        type: 'product', // 🆕 Identificador de tipo
        isRawMaterial: false
      }
    })

    // 🆕 Mapear matérias-primas com configuração personalizada
    const rawMaterialsWithConfig = allRawMaterials.map((rawMaterial: any) => {
      const customRawMaterial = customer.CustomerRawMaterial.find((crm: any) => crm.rawMaterialId === rawMaterial.id)
      
      return {
        id: rawMaterial.id,
        name: rawMaterial.name,
        description: rawMaterial.description || 'Matéria-prima',
        sku: rawMaterial.sku,
        weight: rawMaterial.measurementUnit || 'kg',
        measurementUnit: rawMaterial.measurementUnit,
        priceWholesale: Number(rawMaterial.priceWholesale || 0),
        priceRetail: Number(rawMaterial.priceWholesale || 0),
        bulkDiscountMinQty: null,
        bulkDiscountPrice: null,
        customPrice: customRawMaterial?.customPrice ? Number(customRawMaterial.customPrice) : null,
        isVisible: customRawMaterial?.isVisible ?? false,
        hasCustomConfig: !!customRawMaterial,
        imageUrl: rawMaterial.imageUrl,
        isActive: rawMaterial.isActive,
        soldByWeight: rawMaterial.soldByWeight || false, // ✅ FIX CRÍTICO: Campo obrigatório para conversão de vírgula!
        type: 'rawMaterial', // 🆕 Identificador de tipo
        isRawMaterial: true
      }
    })

    // 🆕 Combinar produtos e matérias-primas
    const allItems = [...productsWithConfig, ...rawMaterialsWithConfig]

    // 🔧 CORREÇÃO: Gerar URLs assinadas para TODOS os itens (produtos + matérias-primas)
    const allItemsWithSignedUrls = await Promise.all(allItems.map(async (item: any) => ({
      ...item,
      imageUrl: await getImageUrl(item.imageUrl)
    })))

    return NextResponse.json({
      customer: {
        ...customer,
        useCustomCatalog: customer.useCustomCatalog
      },
      products: allItemsWithSignedUrls // Retorna produtos E matérias-primas
    })
  } catch (error) {
    console.error('Erro ao buscar produtos do cliente:', error)
    return NextResponse.json({ error: 'Erro ao buscar produtos' }, { status: 500 })
  }
}

// PUT - Atualizar configuração de produtos de um cliente
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const customerId = params.id
    const body = await request.json()
    const { useCustomCatalog, products } = body

    console.log('🔧 [PUT /products] Recebendo dados:', {
      customerId,
      useCustomCatalog,
      productsCount: products?.length || 0
    })

    // Atualizar cliente
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        useCustomCatalog: useCustomCatalog
      }
    })

    // 🔧 CORREÇÃO: Se usar catálogo personalizado, atualizar produtos E matérias-primas
    if (useCustomCatalog && products && Array.isArray(products)) {
      // Separar produtos e matérias-primas
      const regularProducts = products.filter((p: any) => p.type === 'product' || !p.isRawMaterial)
      const rawMaterials = products.filter((p: any) => p.type === 'rawMaterial' || p.isRawMaterial)

      console.log('🔧 [PUT /products] Separação:', {
        regularProducts: regularProducts.length,
        rawMaterials: rawMaterials.length
      })

      // Deletar configurações antigas de produtos
      const deletedProducts = await prisma.customerProduct.deleteMany({
        where: { customerId }
      })
      console.log(`🗑️ Deletados ${deletedProducts.count} produtos antigos`)

      // 🆕 Deletar configurações antigas de matérias-primas
      const deletedRawMaterials = await prisma.customerRawMaterial.deleteMany({
        where: { customerId },
      })
      console.log(`🗑️ Deletadas ${deletedRawMaterials.count} matérias-primas antigas`)

      // Criar novas configurações de produtos (apenas para visíveis ou com preço customizado)
      const productsToCreate = regularProducts.filter((p: any) => p.isVisible || p.customPrice !== null)
      
      if (productsToCreate.length > 0) {
        console.log('📦 Criando produtos:', productsToCreate.map((p: any) => ({
          id: p.id,
          productId: p.productId,
          name: p.name,
          isVisible: p.isVisible,
          customPrice: p.customPrice
        })))

        await prisma.customerProduct.createMany({
          data: productsToCreate.map(p => ({
            id: crypto.randomUUID(),
            customerId,
            productId: p.productId || p.id, // Compatibilidade com ambos os formatos
            customPrice: p.customPrice,
            isVisible: p.isVisible,
            updatedAt: new Date()
          }))
        })
      }

      // 🆕 Criar novas configurações de matérias-primas
      const rawMaterialsToCreate = rawMaterials.filter((rm: any) => rm.isVisible || rm.customPrice !== null)
      
      if (rawMaterialsToCreate.length > 0) {
        console.log('🧪 Criando matérias-primas:', rawMaterialsToCreate.map((rm: any) => ({
          id: rm.id,
          rawMaterialId: rm.rawMaterialId,
          name: rm.name,
          isVisible: rm.isVisible,
          customPrice: rm.customPrice
        })))

        try {
          await prisma.customerRawMaterial.createMany({
            data: rawMaterialsToCreate.map(rm => ({
              id: crypto.randomUUID(),
              customerId,
              rawMaterialId: rm.rawMaterialId || rm.id, // 🔧 CORREÇÃO: Aceitar ambos os formatos
              customPrice: rm.customPrice,
              isVisible: rm.isVisible,
              updatedAt: new Date()
            }))
          })
          console.log(`✅ ${rawMaterialsToCreate.length} matérias-primas criadas`)
        } catch (rmError) {
          console.error('❌ Erro ao criar matérias-primas:', rmError)
          throw rmError
        }
      }

      console.log(`✅ Configurações salvas: ${productsToCreate.length} produtos + ${rawMaterialsToCreate.length} matérias-primas`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ Erro ao atualizar produtos do cliente:', error)
    console.error('❌ Stack trace:', (error as Error).stack)
    return NextResponse.json({ 
      error: 'Erro ao atualizar produtos',
      details: (error as Error).message 
    }, { status: 500 })
  }
}
