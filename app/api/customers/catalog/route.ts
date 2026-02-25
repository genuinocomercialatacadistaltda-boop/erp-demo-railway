
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { getImageUrl } from '@/lib/s3'
import { catalogSelect } from '@/lib/product-select'
import { sortProductsByCategory } from '@/lib/category-sort'

export const dynamic = "force-dynamic"

// GET - Buscar catálogo de produtos para um cliente específico
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  console.log(`🚀 [CATALOG] === INÍCIO ===`)
  
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    // Permitir acesso para ADMIN, SELLER e CUSTOMER
    if (!session || (user?.userType !== 'ADMIN' && user?.userType !== 'SELLER' && user?.userType !== 'CUSTOMER')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId')
    const showAll = searchParams.get('showAll') === 'true'
    
    console.log(`⏱️  [CATALOG] Sessão validada: ${Date.now() - startTime}ms`)
    
    // Se for CUSTOMER, só pode acessar seu próprio catálogo
    if (user?.userType === 'CUSTOMER' && user?.customerId !== customerId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    if (!customerId) {
      return NextResponse.json({ error: 'Cliente não especificado' }, { status: 400 })
    }

    // 🔧 OTIMIZADO: Select minimalista para reduzir tamanho do JSON
    console.log(`⏱️  [CATALOG] Iniciando busca do cliente...`)
    const dbStartTime = Date.now()
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        name: true,
        useCustomCatalog: true,
        CustomerProduct: {
          where: { isVisible: true },
          select: {
            customPrice: true,
            Product: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
                weight: true,
                priceWholesale: true,
                priceRetail: true,
                isActive: true,
                availableIn: true,
                quantityIncrement: true,
                soldByWeight: true,
                bulkDiscountMinQty: true,
                bulkDiscountPrice: true,
                category: true,
                // 🏷️ Promoções
                isOnPromotion: true,
                promotionalPrice: true,
                isWeeklyPromotion: true,
              }
            }
          }
        },
        CustomerRawMaterial: {
          where: { isVisible: true },
          select: {
            customPrice: true,
            RawMaterial: {
              select: {
                id: true,
                name: true,
                measurementUnit: true,
                priceWholesale: true,
                imageUrl: true,
                isActive: true,
                showInCatalog: true
              }
            }
          }
        }
      }
    })
    const dbTime = Date.now() - dbStartTime
    console.log(`⏱️  [CATALOG] Cliente encontrado em ${dbTime}ms`)
    if (dbTime > 1000) {
      console.warn(`⚠️  [CATALOG] Query do banco LENTA: ${dbTime}ms`)
    }

    if (!customer) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    }

    let products

    // 🆕 Se showAll é true, sempre mostrar catálogo completo
    if (customer.useCustomCatalog && !showAll) {
      // 🔧 CORREÇÃO: Catálogo personalizado - produtos E matérias-primas configuradas e visíveis
      
      // Mapear produtos personalizados (já filtrados por isVisible=true na query)
      const customProducts = customer.CustomerProduct
        .filter((cp: any) => cp.Product?.isActive)
        .map((cp: any) => {
          const product = cp.Product
          // 🏷️ REGRA: Preço promocional SEMPRE prevalece sobre preço personalizado
          const isOnPromo = product.isOnPromotion && product.promotionalPrice !== null
          
          // 🔧 CORREÇÃO: Manter priceWholesale ORIGINAL para exibição correta em Boleto/Cartão
          // O preço personalizado só é aplicado se NÃO houver promoção
          let customPrice: number | null = null
          if (!isOnPromo && cp.customPrice !== null) {
            customPrice = Number(cp.customPrice)
          }
          
          // priceWholesale deve ser o preço BASE (sem promoção) para cálculos corretos de Boleto/Cartão
          const baseWholesalePrice = customPrice !== null ? customPrice : Number(product.priceWholesale)
          
          return {
            id: product.id,
            name: product.name,
            imageUrl: product.imageUrl,
            weight: product.weight,
            category: product.category,
            priceWholesale: baseWholesalePrice,  // Preço base para Boleto/Cartão
            priceRetail: Number(product.priceRetail),
            availableIn: product.availableIn,
            quantityIncrement: product.quantityIncrement,
            soldByWeight: product.soldByWeight,
            bulkDiscountMinQty: product.bulkDiscountMinQty || null,
            bulkDiscountPrice: product.bulkDiscountPrice ? Number(product.bulkDiscountPrice) : null,
            isActive: product.isActive,
            hasCustomPrice: customPrice !== null,
            isRawMaterial: false,
            // 🏷️ Informações de promoção para o frontend
            isOnPromotion: product.isOnPromotion,
            promotionalPrice: product.promotionalPrice ? Number(product.promotionalPrice) : null,
            isWeeklyPromotion: product.isWeeklyPromotion
          }
        })

      // 🆕 Mapear matérias-primas personalizadas (já filtradas por isVisible=true na query)
      const customRawMaterials = customer.CustomerRawMaterial
        .filter((crm: any) => crm.RawMaterial?.isActive && crm.RawMaterial?.showInCatalog)
        .map((crm: any) => ({
          id: crm.RawMaterial.id,
          name: crm.RawMaterial.name,
          imageUrl: crm.RawMaterial.imageUrl || '/placeholder-product.jpg',
          weight: crm.RawMaterial.measurementUnit || 'kg',
          // ✅ CORREÇÃO: Respeita customPrice quando existe (desconto), senão usa preço base
          priceWholesale: crm.customPrice !== null ? Number(crm.customPrice) : Number(crm.RawMaterial.priceWholesale || 0),
          priceRetail: crm.customPrice !== null ? Number(crm.customPrice) : Number(crm.RawMaterial.priceWholesale || 0),
          availableIn: 'WHOLESALE',
          quantityIncrement: crm.RawMaterial.quantityIncrement || 0.1,
          soldByWeight: crm.RawMaterial.soldByWeight || false,
          bulkDiscountMinQty: null,
          bulkDiscountPrice: null,
          isActive: crm.RawMaterial.isActive,
          hasCustomPrice: crm.customPrice !== null,
          isRawMaterial: true
        }))

      // Combinar produtos e matérias-primas
      products = [...customProducts, ...customRawMaterials]
    } else {
      // Catálogo geral (PADRÃO) - todos os produtos ativos de atacado
      const allProducts = await prisma.product.findMany({
        where: {
          isActive: true,
          availableIn: {
            in: ['WHOLESALE', 'BOTH']
          }
        },
        orderBy: { name: 'asc' },
        select: catalogSelect  // ⚡ OTIMIZADO - Apenas campos essenciais
      })

      // 🆕 Buscar matérias-primas disponíveis no catálogo (⚡ OTIMIZADO)
      const rawMaterials = await prisma.rawMaterial.findMany({
        where: {
          isActive: true,
          showInCatalog: true
        },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          measurementUnit: true,
          priceWholesale: true,
          imageUrl: true,
          isActive: true,
          currentStock: true,
          minStock: true,
          soldByWeight: true
        }
      })

      // Mapear preços customizados se existirem
      const customProductsMap = new Map(
        customer.CustomerProduct.map((cp: any) => [cp.Product?.id || cp.productId, cp])
      )

      // Mapear produtos normais
      const mappedProducts = allProducts.map((product: any) => {
        const customProduct = customProductsMap.get(product.id) as any
        
        // 🏷️ REGRA: Preço promocional SEMPRE prevalece sobre preço personalizado
        const isOnPromo = product.isOnPromotion && product.promotionalPrice !== null
        
        // 🔧 CORREÇÃO: Manter priceWholesale ORIGINAL para exibição correta em Boleto/Cartão
        // O preço personalizado só é aplicado se NÃO houver promoção
        let customPrice: number | null = null
        if (!isOnPromo && customProduct?.customPrice !== null && customProduct?.customPrice !== undefined) {
          customPrice = Number(customProduct.customPrice)
        }
        
        // priceWholesale deve ser o preço BASE (sem promoção) para cálculos corretos de Boleto/Cartão
        const baseWholesalePrice = customPrice !== null ? customPrice : Number(product.priceWholesale)
        
        return {
          ...product,
          priceWholesale: baseWholesalePrice,  // Preço base para Boleto/Cartão
          priceRetail: Number(product.priceRetail),
          bulkDiscountMinQty: product.bulkDiscountMinQty || null,
          bulkDiscountPrice: product.bulkDiscountPrice ? Number(product.bulkDiscountPrice) : null,
          currentStock: Number(product.currentStock || 0),
          minStock: product.minStock ? Number(product.minStock) : null,
          quantityIncrement: product.quantityIncrement || 1,
          soldByWeight: product.soldByWeight || false,
          hasCustomPrice: customPrice !== null,
          isRawMaterial: false,
          // 🏷️ Campos de promoção preservados para lógica do frontend
          isOnPromotion: product.isOnPromotion,
          promotionalPrice: product.promotionalPrice ? Number(product.promotionalPrice) : null
        }
      })

      // 🆕 Mapear matérias-primas como produtos (⚡ OTIMIZADO)
      const mappedRawMaterials = rawMaterials.map((material: any) => ({
        id: material.id,
        name: material.name,
        weight: material.measurementUnit || 'kg',
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
        quantityIncrement: material.soldByWeight ? 0.1 : 1,
        soldByWeight: material.soldByWeight || false,
        hasCustomPrice: false,
        isRawMaterial: true
      }))

      // 🆕 Combinar produtos e matérias-primas
      products = [...mappedProducts, ...mappedRawMaterials]
    }

    // 🔍 DEBUG: Logs detalhados dos produtos retornados
    console.log('🛒 [CATALOG_API] ========================================')
    console.log('🛒 [CATALOG_API] Total de produtos retornados:', products.length)
    console.log('🛒 [CATALOG_API] IDs dos primeiros 10 produtos:', products.slice(0, 10).map((p: any) => p.id))
    console.log('🛒 [CATALOG_API] showAll:', showAll)
    console.log('🛒 [CATALOG_API] useCustomCatalog:', customer.useCustomCatalog)
    console.log('🛒 [CATALOG_API] ========================================')

    // ⚡ OTIMIZAÇÃO CRÍTICA: NÃO gerar URLs S3 no backend (deixar para o frontend fazer lazy)
    console.log(`⏱️  [CATALOG] Dados montados: ${Date.now() - startTime}ms`)
    console.log(`⚡ [CATALOG] Serializando ${products.length} produtos (SEM gerar URLs S3)...`)
    
    const productsWithUrls = products.map((product: any) => ({
      ...product,
      // ⚡ Manter caminho S3 original (frontend vai gerar URL quando precisar renderizar)
      imageUrl: product.imageUrl || '/placeholder-product.jpg',
      priceWholesale: Number(product.priceWholesale),
      priceRetail: Number(product.priceRetail),
      bulkDiscountPrice: product.bulkDiscountPrice ? Number(product.bulkDiscountPrice) : null,
    }))
    
    console.log(`⚡ [CATALOG] Serialização concluída em ${Date.now() - startTime}ms`)
    console.log(`⏱️  [CATALOG] TEMPO TOTAL DA API: ${Date.now() - startTime}ms`)

    // 📦 Ordenar por categoria: 1-Espeto, 2-Hamburguers, 3-Carvao, 4-Outros
    const sortedProducts = sortProductsByCategory(productsWithUrls)
    console.log(`📦 [CATALOG] Produtos ordenados por categoria`)

    // 🔍 CRITICAL DEBUG: Tamanho do JSON que será enviado
    const responsePayload = {
      products: sortedProducts,
      useCustomCatalog: customer.useCustomCatalog
    }
    const jsonString = JSON.stringify(responsePayload)
    const jsonSizeKB = (jsonString.length / 1024).toFixed(2)
    console.log(`📊 [CATALOG] Tamanho do JSON: ${jsonSizeKB} KB`)
    console.log(`📊 [CATALOG] Número de produtos: ${productsWithUrls.length}`)
    
    // 🔍 Amostra do primeiro produto (verificar se há campos problemáticos)
    if (productsWithUrls.length > 0) {
      const firstProduct = productsWithUrls[0]
      console.log(`🔍 [CATALOG] Primeiro produto (amostra):`, {
        id: firstProduct.id?.substring(0, 8),
        name: firstProduct.name,
        imageUrlLength: firstProduct.imageUrl?.length || 0,
        priceWholesale: typeof firstProduct.priceWholesale,
        hasCustomPrice: firstProduct.hasCustomPrice
      })
    }

    return NextResponse.json(responsePayload)
  } catch (error) {
    console.error('Erro ao buscar catálogo do cliente:', error)
    return NextResponse.json({ error: 'Erro ao buscar catálogo' }, { status: 500 })
  }
}
