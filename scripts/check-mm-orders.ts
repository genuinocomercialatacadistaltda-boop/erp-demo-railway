import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Buscar cliente MM
  const mmCustomers = await prisma.customer.findMany({
    where: { name: { contains: 'MM', mode: 'insensitive' } },
    select: { id: true, name: true }
  })
  console.log('📋 Clientes com "MM" no nome:', mmCustomers)
  
  // Buscar pedidos com customerName contendo MM
  const mmOrders = await prisma.order.findMany({
    where: {
      OR: [
        { customerName: { contains: 'MM', mode: 'insensitive' } },
        { Customer: { name: { contains: 'MM', mode: 'insensitive' } } }
      ]
    },
    select: { 
      id: true, 
      orderNumber: true, 
      customerName: true, 
      casualCustomerName: true,
      createdAt: true,
      Customer: { select: { name: true } }
    },
    orderBy: { createdAt: 'desc' }
  })
  
  console.log(`\n📦 Pedidos encontrados: ${mmOrders.length}`)
  for (const o of mmOrders) {
    console.log(`   ${o.orderNumber} - customerName: "${o.customerName}" | Customer.name: "${o.Customer?.name}" | createdAt: ${o.createdAt.toISOString().split('T')[0]}`)
  }
  
  // Verificar posição do 500º pedido
  const order500 = await prisma.order.findMany({
    select: { createdAt: true, orderNumber: true },
    orderBy: { createdAt: 'desc' },
    skip: 499,
    take: 1
  })
  
  if (order500.length > 0) {
    console.log(`\n📅 500º pedido mais recente: ${order500[0].orderNumber} - ${order500[0].createdAt.toISOString().split('T')[0]}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
