import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('=== INVESTIGAÇÃO: PEDIDO ADM-1768410828556 ===\n')
  
  // Buscar o pedido
  const order = await prisma.order.findFirst({
    where: { orderNumber: 'ADM-1768410828556' },
    include: { Customer: true }
  })
  
  if (!order) {
    console.log('❌ Pedido não encontrado')
    return
  }
  
  console.log('📦 PEDIDO:')
  console.log(`  Cliente: ${order.Customer?.name || order.casualCustomerName}`)
  console.log(`  Total: R$ ${Number(order.total).toFixed(2)}`)
  console.log(`  Pagamento: ${order.paymentMethod}`)
  console.log(`  Status: ${order.paymentStatus}`)
  console.log(`  Conta Bancária ID: ${order.bankAccountId || 'NULL'}`)
  console.log(`  Criado: ${order.createdAt}`)
  console.log(`  ID: ${order.id}`)
  
  // Buscar transações bancárias relacionadas a este pedido
  console.log('\n💳 TRANSAÇÕES BANCÁRIAS RELACIONADAS:')
  
  const transactions = await prisma.transaction.findMany({
    where: { referenceId: order.id },
    include: { BankAccount: true }
  })
  
  if (transactions.length === 0) {
    console.log('  ✅ Nenhuma transação bancária encontrada (correto para cartão)')
  } else {
    console.log(`  ⚠️ ${transactions.length} transação(ões) encontrada(s):`)
    for (const t of transactions) {
      console.log(`\n  - ${t.description}`)
      console.log(`    Conta: ${t.BankAccount?.name}`)
      console.log(`    Valor: R$ ${Number(t.amount).toFixed(2)}`)
      console.log(`    Tipo: ${t.type}`)
      console.log(`    Criado: ${t.createdAt}`)
      console.log(`    ID: ${t.id}`)
    }
  }
  
  // Buscar receivables
  console.log('\n📋 RECEIVABLES:')
  const receivables = await prisma.receivable.findMany({
    where: { orderId: order.id }
  })
  
  if (receivables.length === 0) {
    console.log('  Nenhum receivable encontrado')
  } else {
    for (const r of receivables) {
      console.log(`\n  - ${r.description}`)
      console.log(`    Valor: R$ ${Number(r.amount).toFixed(2)}`)
      console.log(`    Status: ${r.status}`)
      console.log(`    Método: ${r.paymentMethod}`)
      console.log(`    Conta ID: ${r.bankAccountId || 'NULL'}`)
    }
  }
  
  // Buscar transações de cartão de crédito
  console.log('\n💳 TRANSAÇÕES DE CARTÃO:')
  const cardTransactions = await prisma.cardTransaction.findMany({
    where: { 
      OR: [
        { orderId: order.id },
        { description: { contains: order.orderNumber } }
      ]
    }
  })
  
  if (cardTransactions.length === 0) {
    console.log('  ⚠️ Nenhuma transação de cartão encontrada!')
  } else {
    for (const ct of cardTransactions) {
      console.log(`\n  - ${ct.description}`)
      console.log(`    Valor: R$ ${Number(ct.amount).toFixed(2)}`)
      console.log(`    Status: ${ct.status}`)
      console.log(`    Data Recebimento: ${ct.receivedDate || 'Não recebido'}`)
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
