import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const customerId = 'c433bac6-1adc-46c7-8d3b-93aa3cf19fb8' // Thais
  
  const customerProducts = await prisma.customerProduct.findMany({
    where: { customerId },
    include: {
      Product: {
        select: {
          id: true,
          name: true,
          priceWholesale: true,
          priceRetail: true,
        }
      }
    }
  })
  
  console.log('=== SIMULANDO API /api/customers/catalog ===\n')
  
  // Filtrar produtos relevantes
  const relevantProducts = customerProducts.filter(cp => 
    cp.Product.name.toLowerCase().includes('contra file 130') ||
    cp.Product.name.toLowerCase().includes('cupim 130')
  )
  
  console.log('📦 Produtos retornados pela API (simulação):\n')
  
  for (const cp of relevantProducts) {
    // A API retorna priceWholesale como customPrice quando existe
    const returnedPrice = cp.customPrice !== null 
      ? Number(cp.customPrice) 
      : Number(cp.Product.priceWholesale)
    
    console.log(`${cp.Product.name}:`)
    console.log(`   ID: ${cp.Product.id}`)
    console.log(`   customPrice no banco: ${cp.customPrice}`)
    console.log(`   priceWholesale do produto: ${cp.Product.priceWholesale}`)
    console.log(`   >>> priceWholesale RETORNADO PELA API: R$ ${returnedPrice.toFixed(2)}`)
    console.log(`   hasCustomPrice: ${cp.customPrice !== null}`)
    console.log('')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
