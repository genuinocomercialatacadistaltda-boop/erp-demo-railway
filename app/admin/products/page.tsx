
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { getImageUrl } from '@/lib/s3'
import { ProductManagement } from './product-management'
import { productSelect } from '@/lib/product-select'

export const dynamic = "force-dynamic"

export default async function ProductsPage() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any

  if (!session || user?.userType !== 'ADMIN') {
    redirect('/auth/login')
  }

  // ✅ Buscar produtos (SEM limite para não perder dados)
  const products = await prisma.product.findMany({
    orderBy: { createdAt: 'desc' },
    select: productSelect
  })

  // ✅ MANTIDO - Processar URLs do S3 corretamente
  const serializedProducts = await Promise.all(products.map(async (product: any) => ({
    ...product,
    imageUrl: await getImageUrl(product.imageUrl),
    priceWholesale: Number(product.priceWholesale),
    priceRetail: Number(product.priceRetail),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString()
  })))

  return <ProductManagement products={serializedProducts} />
}
