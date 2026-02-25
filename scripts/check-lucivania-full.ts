import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('=== INVESTIGANDO PEDIDO ATAC43112931 ===\n')
  
  const order = await prisma.order.findFirst({
    where: { orderNumber: 'ATAC43112931' },
    include: { 
      Customer: true,
      Receivable: true
    }
  })
  
  if (!order) {
    console.log('❌ Pedido não encontrado!')
    return
  }
  
  console.log('📋 Dados do Pedido:')
  console.log('   orderNumber:', order.orderNumber)
  console.log('   customerId:', order.customerId || '❌ NULL')
  console.log('   customerName:', order.customerName || '❌ NULL')
  console.log('   customerPhone:', order.customerPhone || '❌ NULL')
  console.log('   customerEmail:', order.customerEmail || '❌ NULL')
  console.log('   Customer (relação):', order.Customer?.name || '❌ NULL')
  
  // Verificar se a cliente Lucivania existe no banco
  const lucivania = await prisma.customer.findFirst({
    where: {
      name: { contains: 'Lucivania', mode: 'insensitive' }
    }
  })
  
  console.log('\n📋 Cliente Lucivania no banco:')
  if (lucivania) {
    console.log('   ID:', lucivania.id)
    console.log('   Nome:', lucivania.name)
    console.log('   Telefone:', lucivania.phone)
    console.log('   Email:', lucivania.email)
  } else {
    console.log('   ❌ NÃO ENCONTRADA!')
  }
  
  // Verificar se o pedido tem customerId vinculado
  if (order.customerId && lucivania) {
    console.log('\n🔗 Vinculação:')
    console.log('   Pedido customerId:', order.customerId)
    console.log('   Lucivania ID:', lucivania.id)
    console.log('   Match?', order.customerId === lucivania.id ? '✅ SIM' : '❌ NÃO')
  }
  
  // Verificar receivable
  console.log('\n📄 Receivables do pedido:')
  for (const r of order.Receivable) {
    console.log(`   - ${r.description}`)
    console.log(`     customerId: ${r.customerId || '❌ NULL'}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
