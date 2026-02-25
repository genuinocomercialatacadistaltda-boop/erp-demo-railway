import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { productSelect } from '@/lib/product-select'

export const dynamic = "force-dynamic"

// ⚡ API ULTRA-OTIMIZADA - SEM processamento de URLs S3
// Retorna apenas cloud_storage_path, frontend processa URLs sob demanda
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!session || (user?.userType !== 'ADMIN' && user?.userType !== 'SELLER' && user?.userType !== 'CUSTOMER')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId')
    const showAll = searchParams.get('showAll') === 'true'
    
    if (user?.userType === 'CUSTOMER' && user?.customerId !== customerId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    if (!customerId) {
      return NextResponse.json({ error: 'Cliente não especificado' }, { status: 400 })
    }

    console.log(`⚡ [CATALOG_FAST] Buscando produtos para cliente ${customerId}...`)

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        CustomerProduct: {
          include: {
            Product: {
              select: productSelect
            }
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

    let products

    if (customer.useCustomCatalog && !showAll) {
      // Catálogo personalizado
      const customProducts = customer.CustomerProduct
        .filter((cp: any) => cp.isVisible && cp.Product.isActive)
        .map((cp: any) => ({
          ...cp.Product,
          // ✅ CORREÇÃO: Respeita customPrice quando existe (desconto), senão usa preço base
          priceWholesale: cp.customPrice !== null ? Number(cp.customPrice) : Number(cp.Product.priceWholesale),
          priceRetail: Number(cp.Product.priceRetail),
          bulkDiscountMinQty: cp.Product.bulkDiscountMinQty || null,
          bulkDiscountPrice: cp.Product.bulkDiscountPrice ? Number(cp.Product.bulkDiscountPrice) : null,
          hasCustomPrice: cp.customPrice !== null,
          isRawMaterial: false
        }))

      const customRawMaterials = customer.CustomerRawMaterial
        .filter((crm: any) => crm.isVisible && crm.RawMaterial.isActive && crm.RawMaterial.showInCatalog)
        .map((crm: any) => ({
          id: crm.RawMaterial.id,
          name: crm.RawMaterial.name,
          description: crm.RawMaterial.description || 'Matéria-prima',
          sku: crm.RawMaterial.sku,
          weight: crm.RawMaterial.measurementUnit || 'kg',
          measurementUnit: crm.RawMaterial.measurementUnit,
          category: 'Matéria-Prima',
          // ✅ CORREÇÃO: Respeita customPrice quando existe (desconto), senão usa preço base
          priceWholesale: crm.customPrice !== null ? Number(crm.customPrice) : Number(crm.RawMaterial.priceWholesale || 0),
          priceRetail: crm.customPrice !== null ? Number(crm.customPrice) : Number(crm.RawMaterial.priceWholesale || 0),
          bulkDiscountMinQty: null,
          bulkDiscountPrice: null,
          currentStock: crm.RawMaterial.currentStock,
          imageUrl: crm.RawMaterial.imageUrl || '/placeholder-product.jpg',
          isActive: crm.RawMaterial.isActive,
          availableIn: 'WHOLESALE',
          quantityIncrement: 1,
          hasCustomPrice: crm.customPrice !== null,
          isRawMaterial: true
        }))

      products = [...customProducts, ...customRawMaterials]
    } else {
      // Catálogo geral
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

      const rawMaterials = await prisma.rawMaterial.findMany({
        where: {
          isActive: true,
          showInCatalog: true
        },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          description: true,
          sku: true,
          measurementUnit: true,
          priceWholesale: true,
          currentStock: true,
          imageUrl: true,
          isActive: true,
          categoryId: true
        }
      })

      const customProductsMap = new Map(
        customer.CustomerProduct.map((cp: any) => [cp.productId, cp])
      )

      const mappedProducts = allProducts.map((product: any) => {
        const customProduct = customProductsMap.get(product.id) as any
        return {
          ...product,
          // ✅ CORREÇÃO: Respeita customPrice quando existe (desconto), senão usa preço base
          priceWholesale: customProduct?.customPrice !== null && customProduct?.customPrice !== undefined
            ? Number(customProduct.customPrice) 
            : Number(product.priceWholesale),
          priceRetail: Number(product.priceRetail),
          bulkDiscountMinQty: product.bulkDiscountMinQty || null,
          bulkDiscountPrice: product.bulkDiscountPrice ? Number(product.bulkDiscountPrice) : null,
          hasCustomPrice: customProduct?.customPrice !== null && customProduct?.customPrice !== undefined,
          isRawMaterial: false
        }
      })

      const mappedRawMaterials = rawMaterials.map((material: any) => ({
        id: material.id,
        name: material.name,
        description: material.description || 'Matéria-prima',
        sku: material.sku,
        weight: material.measurementUnit || 'kg',
        measurementUnit: material.measurementUnit,
        category: 'Matéria-Prima',
        priceWholesale: Number(material.priceWholesale || 0),
        priceRetail: Number(material.priceWholesale || 0),
        bulkDiscountMinQty: null,
        bulkDiscountPrice: null,
        currentStock: material.currentStock,
        imageUrl: material.imageUrl || '/placeholder-product.jpg',
        isActive: material.isActive,
        availableIn: 'WHOLESALE',
        quantityIncrement: 1,
        hasCustomPrice: false,
        isRawMaterial: true,
        categoryId: material.categoryId
      }))

      products = [...mappedProducts, ...mappedRawMaterials]
    }

    console.log(`⚡ [CATALOG_FAST] Retornando ${products.length} produtos SEM processar URLs`)

    // ⚡ OTIMIZAÇÃO CRÍTICA: NÃO processar URLs S3, retornar cloud_storage_path direto
    // Frontend carrega imagens sob demanda com lazy loading
    return NextResponse.json({
      products,
      useCustomCatalog: customer.useCustomCatalog
    })
  } catch (error) {
    console.error('❌ [CATALOG_FAST] Erro:', error)
    return NextResponse.json({ error: 'Erro ao buscar catálogo' }, { status: 500 })
  }
}
