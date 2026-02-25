import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('=== CORRIGINDO PEDIDO E RECEIVABLE DA LUCIVANIA ===\n')
  
  // 1. Buscar a cliente Lucivania
  const lucivania = await prisma.customer.findFirst({
    where: { name: { contains: 'Lucivania', mode: 'insensitive' } }
  })
  
  if (!lucivania) {
    console.log('❌ Cliente Lucivania não encontrada!')
    return
  }
  console.log('✅ Cliente encontrada:', lucivania.id, '-', lucivania.name)
  
  // 2. Buscar o pedido
  const order = await prisma.order.findFirst({
    where: { orderNumber: 'ATAC43112931' }
  })
  
  if (!order) {
    console.log('❌ Pedido não encontrado!')
    return
  }
  console.log('✅ Pedido encontrado:', order.id)
  console.log('   customerId atual:', order.customerId || 'NULL')
  
  // 3. Atualizar o pedido com o customerId correto
  await prisma.order.update({
    where: { id: order.id },
    data: { customerId: lucivania.id }
  })
  console.log('✅ Pedido atualizado com customerId:', lucivania.id)
  
  // 4. Buscar o receivable do pedido
  const receivable = await prisma.receivable.findFirst({
    where: { orderId: order.id }
  })
  
  if (!receivable) {
    console.log('❌ Receivable não encontrado!')
    return
  }
  console.log('✅ Receivable encontrado:', receivable.id)
  console.log('   customerId atual:', receivable.customerId || 'NULL')
  
  // 5. Atualizar o receivable com o customerId correto
  await prisma.receivable.update({
    where: { id: receivable.id },
    data: { customerId: lucivania.id }
  })
  console.log('✅ Receivable atualizado com customerId:', lucivania.id)
  
  console.log('\n🎉 CORREÇÃO COMPLETA!')
  console.log('   Agora o pedido e receivable estão vinculados à cliente Lucivania')
  console.log('   O filtro por nome deve funcionar corretamente')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
