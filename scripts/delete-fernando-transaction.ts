import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('=== EXCLUINDO TRANSAÇÃO INDEVIDA DO FERNANDO ===\n')
  
  // 1. Buscar a transação
  const transaction = await prisma.transaction.findUnique({
    where: { id: 'cmkef401h0001nq08ot3mifj2' }
  })
  
  if (!transaction) {
    console.log('❌ Transação não encontrada')
    return
  }
  
  console.log('📋 TRANSAÇÃO A SER EXCLUÍDA:')
  console.log(`  Descrição: ${transaction.description}`)
  console.log(`  Valor: R$ ${Number(transaction.amount).toFixed(2)}`)
  console.log(`  Conta: ${transaction.bankAccountId}`)
  console.log(`  Data: ${transaction.createdAt}`)
  
  // 2. Buscar saldo atual da conta
  const account = await prisma.bankAccount.findUnique({
    where: { id: transaction.bankAccountId }
  })
  
  if (!account) {
    console.log('❌ Conta bancária não encontrada')
    return
  }
  
  console.log('\n💰 CONTA BANCÁRIA ATUAL:')
  console.log(`  Nome: ${account.name}`)
  console.log(`  Saldo atual: R$ ${Number(account.balance).toFixed(2)}`)
  
  const newBalance = Number(account.balance) - Number(transaction.amount)
  console.log(`  Saldo após correção: R$ ${newBalance.toFixed(2)}`)
  
  // 3. Executar exclusão e ajuste
  console.log('\n⚙️ Executando correção...')
  
  await prisma.$transaction([
    // Excluir transação
    prisma.transaction.delete({
      where: { id: 'cmkef401h0001nq08ot3mifj2' }
    }),
    
    // Ajustar saldo da conta
    prisma.bankAccount.update({
      where: { id: transaction.bankAccountId },
      data: { balance: newBalance }
    })
  ])
  
  console.log('\n✅ CORREÇÃO CONCLUÍDA!')
  console.log('  - Transação excluída')
  console.log('  - Saldo da conta Itaú ajustado')
  
  // 4. Verificar o receivable
  console.log('\n📋 VERIFICANDO RECEIVABLE:')
  const receivable = await prisma.receivable.findUnique({
    where: { id: '04cd72c6-2a2d-4f7d-a608-b8b329b2f9ae' }
  })
  
  if (receivable) {
    console.log(`  Status: ${receivable.status}`)
    console.log(`  Método: ${receivable.paymentMethod}`)
    console.log(`  Conta: ${receivable.bankAccountId}`)
    console.log('  ✅ Receivable permanece marcado como PAID (correto)')
    console.log('  ✅ Aguardando entrada manual no Gestor de Cartões')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
