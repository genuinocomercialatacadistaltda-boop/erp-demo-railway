import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('=== INVESTIGANDO PEDIDOS SUMINDO ===\n')
  
  // 1. Verificar pedidos da SAMARA
  console.log('📋 PEDIDOS DA SAMARA:')
  const samaraOrders = await prisma.order.findMany({
    where: {
      OR: [
        { customerName: { contains: 'SAMARA', mode: 'insensitive' } },
        { Customer: { name: { contains: 'SAMARA', mode: 'insensitive' } } }
      ]
    },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      customerId: true,
      total: true,
      createdAt: true,
      Customer: { select: { name: true } }
    },
    orderBy: { createdAt: 'desc' }
  })
  
  console.log(`   Total encontrado: ${samaraOrders.length}`)
  for (const o of samaraOrders) {
    console.log(`   - ${o.orderNumber} | ${o.Customer?.name || o.customerName} | R$ ${Number(o.total).toFixed(2)} | ${o.createdAt.toISOString().split('T')[0]}`)
    console.log(`     customerId: ${o.customerId || 'NULL'}`)
  }
  
  // 2. Verificar cliente "M M"
  console.log('\n📋 PEDIDOS COM "M M":')
  const mmOrders = await prisma.order.findMany({
    where: {
      OR: [
        { customerName: { contains: 'M M', mode: 'insensitive' } },
        { Customer: { name: { contains: 'M M', mode: 'insensitive' } } }
      ]
    },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      customerId: true,
      total: true,
      createdAt: true,
      Customer: { select: { name: true } }
    },
    orderBy: { createdAt: 'desc' }
  })
  
  console.log(`   Total encontrado: ${mmOrders.length}`)
  for (const o of mmOrders) {
    console.log(`   - ${o.orderNumber} | ${o.Customer?.name || o.customerName} | R$ ${Number(o.total).toFixed(2)}`)
  }
  
  // 3. Verificar se existe cliente com nome "M M" ou similar
  console.log('\n📋 CLIENTES COM NOME CONTENDO "M M":')
  const mmCustomers = await prisma.customer.findMany({
    where: {
      name: { contains: 'M M', mode: 'insensitive' }
    },
    select: { id: true, name: true }
  })
  console.log(`   Total: ${mmCustomers.length}`)
  for (const c of mmCustomers) {
    console.log(`   - ${c.name} (${c.id})`)
  }
  
  // 4. Verificar total de pedidos no sistema
  const totalOrders = await prisma.order.count()
  console.log(`\n📊 TOTAL DE PEDIDOS NO SISTEMA: ${totalOrders}`)
  
  // 5. Verificar se há pedidos sem customerId e sem customerName
  const orphanOrders = await prisma.order.count({
    where: {
      AND: [
        { customerId: null },
        { customerName: null }
      ]
    }
  })
  console.log(`   Pedidos sem cliente (customerId E customerName null): ${orphanOrders}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
