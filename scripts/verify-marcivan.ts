import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const marcivan = await prisma.customer.findFirst({
    where: { name: { contains: 'marcivan', mode: 'insensitive' } }
  })
  
  if (!marcivan) return
  
  // Buscar boleto BOL20428046
  const boleto = await prisma.boleto.findFirst({
    where: { boletoNumber: 'BOL20428046' }
  })
  
  // Buscar pedido ADM-1767976641624
  const order = await prisma.order.findFirst({
    where: { orderNumber: 'ADM-1767976641624' }
  })
  
  console.log('=== ANÁLISE MARCIVAN ===\n')
  
  console.log('📋 BOLETO BOL20428046:')
  if (boleto) {
    console.log(`  Valor: R$ ${Number(boleto.amount).toFixed(2)}`)
    console.log(`  Status: ${boleto.status}`)
    console.log(`  Vencimento: ${boleto.dueDate}`)
    console.log(`  ID: ${boleto.id}`)
  }
  
  console.log('\n📦 PEDIDO ADM-1767976641624:')
  if (order) {
    console.log(`  Valor: R$ ${Number(order.total).toFixed(2)}`)
    console.log(`  Pagamento: ${order.paymentMethod}`)
    console.log(`  Status: ${order.paymentStatus}`)
    console.log(`  Data: ${order.createdAt}`)
    console.log(`  ID: ${order.id}`)
  }
  
  // Verificar se o pedido está vinculado ao boleto
  if (boleto && order) {
    const sameDayOrder = order.createdAt?.toISOString().split('T')[0]
    const boletoDue = boleto.dueDate?.toISOString().split('T')[0]
    console.log(`\n⚠️  Pedido criado em: ${sameDayOrder}`)
    console.log(`⚠️  Boleto vencia em: ${boletoDue}`)
    
    if (Math.abs(Number(boleto.amount) - Number(order.total)) < 1) {
      console.log('\n🔴 ATENÇÃO: Boleto e Pedido têm o MESMO VALOR!')
      console.log('   Pode ser uma duplicata ou dois pagamentos separados.')
    }
  }
  
  // Listar todos os pedidos recentes do Marcivan
  console.log('\n\n=== ÚLTIMOS PEDIDOS DO MARCIVAN ===')
  const orders = await prisma.order.findMany({
    where: { customerId: marcivan.id },
    orderBy: { createdAt: 'desc' },
    take: 10
  })
  
  for (const o of orders) {
    console.log(`\n${o.orderNumber}`)
    console.log(`  Total: R$ ${Number(o.total).toFixed(2)}`)
    console.log(`  Pagamento: ${o.paymentMethod}`)
    console.log(`  Status: ${o.paymentStatus}`)
    console.log(`  Data: ${o.createdAt}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
