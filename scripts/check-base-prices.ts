import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const products = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: 'contra file 130', mode: 'insensitive' } },
        { name: { contains: 'cupim 130', mode: 'insensitive' } }
      ]
    },
    select: { id: true, name: true, priceWholesale: true, priceRetail: true }
  })
  
  console.log('📦 Produtos base encontrados:')
  for (const p of products) {
    console.log(`\n${p.name}:`)
    console.log(`   ID: ${p.id}`)
    console.log(`   Preço Atacado: R$ ${Number(p.priceWholesale).toFixed(2)}`)
    console.log(`   Preço Varejo: R$ ${Number(p.priceRetail).toFixed(2)}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
