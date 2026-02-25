import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Buscar conta itau-card-account
  const itauCard = await prisma.bankAccount.findUnique({
    where: { id: 'itau-card-account' }
  })
  
  console.log('=== CONTA ITAU-CARD-ACCOUNT ===\n')
  if (itauCard) {
    console.log(`Nome: ${itauCard.name}`)
    console.log(`Tipo: ${itauCard.accountType}`)
    console.log(`Saldo: R$ ${Number(itauCard.balance).toFixed(2)}`)
  } else {
    console.log('❌ Conta não encontrada')
    return
  }
  
  // Buscar transações recentes dessa conta com valor ~330
  console.log('\n=== TRANSAÇÕES ~R$ 330 NO ITAÚ (últimas) ===\n')
  const transactions = await prisma.transaction.findMany({
    where: {
      bankAccountId: 'itau-card-account',
      amount: { gte: 329, lte: 332 }
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  })
  
  for (const t of transactions) {
    console.log(`${t.description}`)
    console.log(`  Valor: R$ ${Number(t.amount).toFixed(2)}`)
    console.log(`  Data: ${t.createdAt}`)
    console.log(`  ReferenceId: ${t.referenceId}`)
    console.log(`  ID: ${t.id}`)
    console.log('')
  }
  
  // Buscar receivable específico
  console.log('\n=== RECEIVABLE DO FERNANDO ===\n')
  const receivable = await prisma.receivable.findFirst({
    where: {
      description: { contains: 'ADM-1768410828556' }
    }
  })
  
  if (receivable) {
    console.log(`Descrição: ${receivable.description}`)
    console.log(`Valor: R$ ${Number(receivable.amount).toFixed(2)}`)
    console.log(`Status: ${receivable.status}`)
    console.log(`Método: ${receivable.paymentMethod}`)
    console.log(`Conta ID: ${receivable.bankAccountId}`)
    console.log(`Data Pagamento: ${receivable.paymentDate}`)
    console.log(`Receivable ID: ${receivable.id}`)
    
    // Buscar transação vinculada a este receivable
    console.log('\n=== TRANSAÇÃO VINCULADA A ESTE RECEIVABLE ===\n')
    const linkedTx = await prisma.transaction.findFirst({
      where: { referenceId: receivable.id }
    })
    
    if (linkedTx) {
      console.log(`⚠️ TRANSAÇÃO ENCONTRADA:`)
      console.log(`  ${linkedTx.description}`)
      console.log(`  Valor: R$ ${Number(linkedTx.amount).toFixed(2)}`)
      console.log(`  Conta: ${linkedTx.bankAccountId}`)
      console.log(`  Criado: ${linkedTx.createdAt}`)
      console.log(`  ID: ${linkedTx.id}`)
    } else {
      console.log('✅ Nenhuma transação bancária vinculada')
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
