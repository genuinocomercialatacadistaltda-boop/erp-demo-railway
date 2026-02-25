
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { CustomerProductsConfig } from './customer-products-config'
import { productSelect } from '@/lib/product-select'

export const dynamic = "force-dynamic"

export default async function CustomerProductsPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any

  if (!session || user?.userType !== 'ADMIN') {
    redirect('/auth/login')
  }

  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
    include: {
      CustomerProduct: {
        include: {
          Product: {
            select: productSelect  // ✅ Usar apenas campos que existem no banco
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
    redirect('/admin/customers')
  }

  // 🔧 Buscar todos os produtos ativos de atacado
  const allProducts = await prisma.product.findMany({
    where: {
      isActive: true,
      availableIn: {
        in: ['WHOLESALE', 'BOTH']
      }
    },
    orderBy: { name: 'asc' },
    select: productSelect  // ✅ Usar apenas campos que existem no banco
  })

  // 🆕 Buscar todas as matérias-primas ativas marcadas para venda
  const allRawMaterials = await prisma.rawMaterial.findMany({
    where: {
      isActive: true,
      showInCatalog: true
    },
    orderBy: { name: 'asc' }
  })

  // Serializar produtos
  const serializedProducts = allProducts.map((product: any) => {
    const customProduct = customer.CustomerProduct.find((cp: any) => cp.productId === product.id)
    
    // Se o cliente usa catálogo personalizado E o produto não tem config, padrão é NÃO visível
    // Se o cliente NÃO usa catálogo personalizado, todos são visíveis de qualquer forma
    const defaultVisibility = customer.useCustomCatalog ? false : true
    
    return {
      id: product.id,
      name: product.name,
      priceWholesale: Number(product.priceWholesale),
      priceRetail: Number(product.priceRetail),
      imageUrl: product.imageUrl,
      description: product.description || '',
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      customPrice: customProduct?.customPrice ? Number(customProduct.customPrice) : null,
      isVisible: customProduct?.isVisible ?? defaultVisibility,
      hasCustomConfig: !!customProduct,
      type: 'product' as const,
      isRawMaterial: false
    }
  })

  // 🆕 Serializar matérias-primas
  const serializedRawMaterials = allRawMaterials.map((rawMaterial: any) => {
    const customRawMaterial = customer.CustomerRawMaterial.find((crm: any) => crm.rawMaterialId === rawMaterial.id)
    
    const defaultVisibility = customer.useCustomCatalog ? false : true
    
    return {
      id: rawMaterial.id,
      name: rawMaterial.name,
      priceWholesale: Number(rawMaterial.priceWholesale || 0),
      priceRetail: Number(rawMaterial.priceWholesale || 0),
      imageUrl: rawMaterial.imageUrl || '/placeholder-product.jpg',
      description: rawMaterial.description || 'Matéria-prima',
      createdAt: rawMaterial.createdAt.toISOString(),
      updatedAt: rawMaterial.updatedAt.toISOString(),
      customPrice: customRawMaterial?.customPrice ? Number(customRawMaterial.customPrice) : null,
      isVisible: customRawMaterial?.isVisible ?? defaultVisibility,
      hasCustomConfig: !!customRawMaterial,
      type: 'rawMaterial' as const,
      isRawMaterial: true
    }
  })

  // 🆕 Combinar produtos e matérias-primas em um único array
  const allItems = [...serializedProducts, ...serializedRawMaterials]

  return (
    <CustomerProductsConfig
      customer={{
        id: customer.id,
        name: customer.name,
        useCustomCatalog: customer.useCustomCatalog
      }}
      products={allItems}
    />
  )
}
