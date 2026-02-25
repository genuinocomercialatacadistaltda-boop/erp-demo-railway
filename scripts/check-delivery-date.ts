import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('=== VERIFICANDO deliveryDate NOS PEDIDOS ===\n')
  
  // Pedidos da SAMARA
  console.log('📋 PEDIDOS SAMARA (verificando deliveryDate):')
  const samaraOrders = await prisma.order.findMany({
    where: {
      Customer: { name: { contains: 'SAMARA BARBOSA', mode: 'insensitive' } }
    },
    select: {
      orderNumber: true,
      customerName: true,
      deliveryDate: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' }
  })
  
  for (const o of samaraOrders) {
    console.log(`   ${o.orderNumber}: deliveryDate=${o.deliveryDate?.toISOString().split('T')[0] || 'NULL'} | createdAt=${o.createdAt.toISOString().split('T')[0]}`)
  }
  
  // Pedidos M M
  console.log('\n📋 PEDIDOS M M (verificando deliveryDate):')
  const mmOrders = await prisma.order.findMany({
    where: {
      Customer: { name: { contains: 'M M', mode: 'insensitive' } }
    },
    select: {
      orderNumber: true,
      customerName: true,
      deliveryDate: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' }
  })
  
  for (const o of mmOrders) {
    console.log(`   ${o.orderNumber}: deliveryDate=${o.deliveryDate?.toISOString().split('T')[0] || 'NULL'} | createdAt=${o.createdAt.toISOString().split('T')[0]}`)
  }
  
  // Contar pedidos sem deliveryDate
  const ordersWithoutDeliveryDate = await prisma.order.findMany({
    where: { deliveryDate: null },
    select: { orderNumber: true, customerName: true, createdAt: true },
    take: 20
  })
  
  console.log(`\n📊 Pedidos SEM deliveryDate (primeiros 20):`)
  console.log(`   Total: ${ordersWithoutDeliveryDate.length}+`)
  for (const o of ordersWithoutDeliveryDate.slice(0, 10)) {
    console.log(`   - ${o.orderNumber} | ${o.customerName} | ${o.createdAt.toISOString().split('T')[0]}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
