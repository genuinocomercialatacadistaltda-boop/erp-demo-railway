import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('=== VERIFICANDO CAMPO customerName NOS PEDIDOS ===\n')
  
  // Pedidos da SAMARA
  console.log('📋 PEDIDOS SAMARA (verificando customerName):')
  const samaraOrders = await prisma.order.findMany({
    where: {
      Customer: { name: { contains: 'SAMARA BARBOSA', mode: 'insensitive' } }
    },
    select: {
      orderNumber: true,
      customerName: true,
      casualCustomerName: true,
      customerId: true,
      Customer: { select: { name: true } }
    }
  })
  
  for (const o of samaraOrders) {
    console.log(`   ${o.orderNumber}:`)
    console.log(`      customerName: "${o.customerName || 'NULL'}"`)
    console.log(`      casualCustomerName: "${o.casualCustomerName || 'NULL'}"`)
    console.log(`      Customer.name: "${o.Customer?.name || 'NULL'}"`)
    console.log(`      customerId: ${o.customerId || 'NULL'}`)
    console.log('')
  }
  
  // Pedidos M M
  console.log('\n📋 PEDIDOS M M (verificando customerName):')
  const mmOrders = await prisma.order.findMany({
    where: {
      Customer: { name: { contains: 'M M', mode: 'insensitive' } }
    },
    select: {
      orderNumber: true,
      customerName: true,
      casualCustomerName: true,
      customerId: true,
      Customer: { select: { name: true } }
    }
  })
  
  for (const o of mmOrders) {
    console.log(`   ${o.orderNumber}:`)
    console.log(`      customerName: "${o.customerName || 'NULL'}"`)
    console.log(`      casualCustomerName: "${o.casualCustomerName || 'NULL'}"`)
    console.log(`      Customer.name: "${o.Customer?.name || 'NULL'}"`)
    console.log('')
  }
  
  // Estatística geral
  const ordersWithNullName = await prisma.order.count({
    where: { customerName: null }
  })
  const totalOrders = await prisma.order.count()
  console.log(`\n📊 ESTATÍSTICA:`)
  console.log(`   Total de pedidos: ${totalOrders}`)
  console.log(`   Pedidos com customerName NULL: ${ordersWithNullName}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
