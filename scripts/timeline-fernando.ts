import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('=== LINHA DO TEMPO: PEDIDO FERNANDO ===\n')
  
  const order = await prisma.order.findFirst({
    where: { orderNumber: 'ADM-1768410828556' }
  })
  
  if (!order) return
  
  const receivable = await prisma.receivable.findFirst({
    where: { orderId: order.id }
  })
  
  const transaction = await prisma.transaction.findFirst({
    where: { referenceId: receivable?.id }
  })
  
  console.log('📅 CRONOLOGIA:\n')
  console.log(`1. Pedido criado: ${order.createdAt}`)
  console.log(`   - Pagamento: ${order.paymentMethod}`)
  console.log(`   - Status: ${order.paymentStatus}`)
  console.log(`   - Conta bancária: ${order.bankAccountId || 'NENHUMA'}`)
  
  if (receivable) {
    console.log(`\n2. Receivable criado: ${receivable.createdAt}`)
    console.log(`   - Método: ${receivable.paymentMethod}`)
    console.log(`   - Status: ${receivable.status}`)
    console.log(`   - Conta bancária: ${receivable.bankAccountId || 'NENHUMA'}`)
    console.log(`   - Última atualização: ${receivable.updatedAt}`)
  }
  
  if (transaction) {
    console.log(`\n3. Transação bancária criada: ${transaction.createdAt}`)
    console.log(`   - Conta: ${transaction.bankAccountId}`)
    console.log(`   - Valor: R$ ${Number(transaction.amount).toFixed(2)}`)
  }
  
  console.log('\n⚠️ ANÁLISE:')
  if (receivable && transaction) {
    const orderTime = new Date(order.createdAt).getTime()
    const txTime = new Date(transaction.createdAt).getTime()
    const diffMinutes = Math.round((txTime - orderTime) / 1000 / 60)
    
    console.log(`  - Transação criada ${diffMinutes} minutos após o pedido`)
    
    if (receivable.paymentMethod === 'CREDIT_CARD' || receivable.paymentMethod === 'DEBIT' || receivable.paymentMethod === 'CARD') {
      console.log(`  - ❌ ERRO: Receivable é de CARTÃO mas tem transação bancária`)
      console.log(`  - ❌ Cartões devem ir para "Gestor de Cartões" primeiro`)
      console.log(`  - ❌ Só depois de dar entrada manual lá é que cai na conta`)
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
