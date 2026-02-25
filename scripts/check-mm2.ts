import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Buscar cliente conveniencia
  const customers = await prisma.customer.findMany({
    where: { 
      OR: [
        { name: { contains: 'conveni', mode: 'insensitive' } },
        { name: { contains: 'M M', mode: 'insensitive' } }
      ]
    },
    select: { id: true, name: true }
  })
  console.log('📋 Clientes encontrados:', customers)
  
  if (customers.length > 0) {
    for (const c of customers) {
      const orders = await prisma.order.findMany({
        where: { customerId: c.id },
        select: { orderNumber: true, createdAt: true },
        orderBy: { createdAt: 'desc' }
      })
      console.log(`\n📦 Pedidos de "${c.name}":`)
      for (const o of orders) {
        console.log(`   ${o.orderNumber} - ${o.createdAt.toISOString().split('T')[0]}`)
      }
    }
  }
  
  // Buscar pedidos com customerName contendo conveniencia ou M M
  const ordersWithName = await prisma.order.findMany({
    where: {
      OR: [
        { customerName: { contains: 'conveni', mode: 'insensitive' } },
        { customerName: { contains: 'M M', mode: 'insensitive' } },
        { casualCustomerName: { contains: 'conveni', mode: 'insensitive' } },
        { casualCustomerName: { contains: 'M M', mode: 'insensitive' } }
      ]
    },
    select: { orderNumber: true, customerName: true, casualCustomerName: true, createdAt: true }
  })
  console.log('\n📦 Pedidos com customerName/casualCustomerName contendo conveni ou M M:', ordersWithName)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
