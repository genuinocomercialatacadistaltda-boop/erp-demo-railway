import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Pedidos da SAMARA BARBOSA
  const samaraOrders = await prisma.order.findMany({
    where: { Customer: { name: { contains: 'SAMARA BARBOSA', mode: 'insensitive' } } },
    select: { orderNumber: true, createdAt: true, deliveryDate: true },
    orderBy: { createdAt: 'desc' }
  })
  
  console.log('📋 PEDIDOS SAMARA BARBOSA (ordenados por data):')
  for (const o of samaraOrders) {
    console.log(`   ${o.orderNumber} - createdAt: ${o.createdAt.toISOString().split('T')[0]}`)
  }
  
  // Ver quantos pedidos existem no total
  const totalOrders = await prisma.order.count()
  console.log(`\n📊 Total de pedidos: ${totalOrders}`)
  
  // Ver a data do 200º pedido mais recente
  const order200 = await prisma.order.findMany({
    select: { createdAt: true },
    orderBy: { createdAt: 'desc' },
    skip: 199,
    take: 1
  })
  
  if (order200.length > 0) {
    console.log(`📅 Data do 200º pedido mais recente: ${order200[0].createdAt.toISOString().split('T')[0]}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
