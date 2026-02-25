import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('=== VERIFICANDO PREÇOS CUSTOMIZADOS DA THAIS ===\n')
  
  const thais = await prisma.customer.findFirst({
    where: { name: { contains: 'THAIS ABREU' } }
  })
  
  if (!thais) return
  
  // Buscar produtos customizados
  const customProducts = await prisma.customerProduct.findMany({
    where: { customerId: thais.id },
    include: {
      Product: {
        select: { name: true, priceWholesale: true }
      }
    }
  })
  
  console.log(`📋 Produtos customizados de ${thais.name}:`)
  console.log(`   Total: ${customProducts.length} produtos\n`)
  
  // Filtrar os produtos do pedido (contra file 130g e cupim 130g)
  const relevantProducts = customProducts.filter(cp => 
    cp.Product.name.toLowerCase().includes('contra file 130') ||
    cp.Product.name.toLowerCase().includes('cupim 130')
  )
  
  console.log('📦 Produtos relevantes para o pedido:')
  for (const cp of relevantProducts) {
    console.log(`\n   ${cp.Product.name}:`)
    console.log(`      Preço Base: R$ ${Number(cp.Product.priceWholesale).toFixed(2)}`)
    console.log(`      Preço Customizado: R$ ${cp.customPrice ? Number(cp.customPrice).toFixed(2) : 'NÃO DEFINIDO'}`)
    console.log(`      Diferença: R$ ${cp.customPrice ? (Number(cp.Product.priceWholesale) - Number(cp.customPrice)).toFixed(2) : 'N/A'}`)
  }
  
  // Se não encontrou, buscar todos os produtos com esses nomes
  if (relevantProducts.length === 0) {
    console.log('\n⚠️ Nenhum produto customizado encontrado para contra file ou cupim')
    console.log('   Buscando produtos base...')
    
    const products = await prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: 'contra file 130', mode: 'insensitive' } },
          { name: { contains: 'cupim 130', mode: 'insensitive' } }
        ]
      },
      select: { id: true, name: true, priceWholesale: true }
    })
    
    console.log('\n📦 Produtos base encontrados:')
    for (const p of products) {
      console.log(`   ${p.name}: R$ ${Number(p.priceWholesale).toFixed(2)}`)
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
