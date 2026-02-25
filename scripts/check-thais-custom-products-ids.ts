import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const thais = await prisma.customer.findFirst({
    where: { name: { contains: 'THAIS ABREU' } }
  })
  
  if (!thais) return
  
  const customProducts = await prisma.customerProduct.findMany({
    where: { 
      customerId: thais.id,
      Product: {
        name: { contains: 'contra file 130', mode: 'insensitive' }
      }
    },
    include: {
      Product: true
    }
  })
  
  console.log('📦 Produtos "contra file 130" customizados para Thais:')
  for (const cp of customProducts) {
    console.log(`\n   Produto: ${cp.Product.name}`)
    console.log(`   Product ID: ${cp.productId}`)
    console.log(`   Preço Base: R$ ${Number(cp.Product.priceWholesale).toFixed(2)}`)
    console.log(`   Preço Customizado: R$ ${cp.customPrice ? Number(cp.customPrice).toFixed(2) : 'NULL'}`)
  }
  
  // Verificar também cupim
  const cupimProducts = await prisma.customerProduct.findMany({
    where: { 
      customerId: thais.id,
      Product: {
        name: { contains: 'cupim 130', mode: 'insensitive' }
      }
    },
    include: {
      Product: true
    }
  })
  
  console.log('\n📦 Produtos "cupim 130" customizados para Thais:')
  for (const cp of cupimProducts) {
    console.log(`\n   Produto: ${cp.Product.name}`)
    console.log(`   Product ID: ${cp.productId}`)
    console.log(`   Preço Base: R$ ${Number(cp.Product.priceWholesale).toFixed(2)}`)
    console.log(`   Preço Customizado: R$ ${cp.customPrice ? Number(cp.customPrice).toFixed(2) : 'NULL'}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
