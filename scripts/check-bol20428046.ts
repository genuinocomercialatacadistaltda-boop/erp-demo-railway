import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('=== ANÁLISE COMPLETA BOL20428046 ===\n')
  
  // Buscar o boleto
  const boleto = await prisma.boleto.findFirst({
    where: { boletoNumber: 'BOL20428046' },
    include: { Customer: true, Order: true }
  })
  
  if (!boleto) {
    console.log('Boleto não encontrado')
    return
  }
  
  console.log('📋 BOLETO BOL20428046:')
  console.log(`  Cliente: ${boleto.Customer?.name}`)
  console.log(`  Valor: R$ ${Number(boleto.amount).toFixed(2)}`)
  console.log(`  Status: ${boleto.status}`)
  console.log(`  Vencimento: ${boleto.dueDate}`)
  console.log(`  Data Pagamento (paidDate): ${boleto.paidDate || 'N/A'}`)
  console.log(`  Criado em: ${boleto.createdAt}`)
  console.log(`  Atualizado em: ${boleto.updatedAt}`)
  console.log(`  ID: ${boleto.id}`)
  
  // Buscar TODAS as transações relacionadas a este boleto
  console.log('\n📊 TRANSAÇÕES RELACIONADAS:')
  
  // Por referenceId
  const txByRef = await prisma.transaction.findMany({
    where: { referenceId: boleto.id }
  })
  console.log(`\n  Por referenceId (${boleto.id}): ${txByRef.length} transações`)
  for (const t of txByRef) {
    console.log(`    - R$ ${Number(t.amount).toFixed(2)} | ${t.description}`)
    console.log(`      Criado: ${t.createdAt}`)
    console.log(`      ID: ${t.id}`)
  }
  
  // Por descrição contendo BOL20428046
  const txByDesc = await prisma.transaction.findMany({
    where: { description: { contains: 'BOL20428046', mode: 'insensitive' } }
  })
  console.log(`\n  Por descrição (contém "BOL20428046"): ${txByDesc.length} transações`)
  for (const t of txByDesc) {
    console.log(`    - R$ ${Number(t.amount).toFixed(2)} | ${t.description}`)
    console.log(`      Criado: ${t.createdAt}`)
    console.log(`      ID: ${t.id}`)
  }
  
  // Verificar logs de integração Cora
  console.log('\n📝 LOGS DE INTEGRAÇÃO CORA (últimos 7 dias):')
  const logs = await prisma.coraIntegrationLog.findMany({
    where: {
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      metadata: { contains: 'BOL20428046' }
    },
    orderBy: { createdAt: 'desc' }
  })
  
  if (logs.length === 0) {
    console.log('  Nenhum log encontrado')
  } else {
    for (const log of logs) {
      console.log(`  ${log.operationType} - ${log.status} - ${log.createdAt}`)
    }
  }
  
  // Verificar pedido relacionado
  if (boleto.orderId) {
    const order = await prisma.order.findUnique({
      where: { id: boleto.orderId }
    })
    console.log('\n📦 PEDIDO RELACIONADO:')
    console.log(`  Número: ${order?.orderNumber}`)
    console.log(`  Total: R$ ${Number(order?.total || 0).toFixed(2)}`)
    console.log(`  Status Pagamento: ${order?.paymentStatus}`)
    console.log(`  Criado: ${order?.createdAt}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
