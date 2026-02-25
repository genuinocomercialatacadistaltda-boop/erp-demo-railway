import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const coraAccount = await prisma.bankAccount.findFirst({
    where: { name: { contains: 'cora', mode: 'insensitive' } }
  })
  
  if (!coraAccount) return
  
  // Buscar TODAS as transações de 323,00
  const tx323 = await prisma.transaction.findMany({
    where: { 
      bankAccountId: coraAccount.id,
      amount: { gte: 322.99, lte: 323.01 }
    },
    orderBy: { createdAt: 'desc' }
  })
  
  console.log('=== TODAS AS TRANSAÇÕES DE R$ 323,00 NO CORA ===')
  console.log(`Total encontradas: ${tx323.length}`)
  for (const t of tx323) {
    console.log(`\n${t.description}`)
    console.log(`  ID: ${t.id}`)
    console.log(`  Valor: R$ ${Number(t.amount).toFixed(2)}`)
    console.log(`  Data: ${t.createdAt}`)
    console.log(`  ReferenceId: ${t.referenceId}`)
  }
  
  // Buscar transações de 337,22
  const tx337 = await prisma.transaction.findMany({
    where: { 
      bankAccountId: coraAccount.id,
      amount: { gte: 337.21, lte: 337.23 }
    },
    orderBy: { createdAt: 'desc' }
  })
  
  console.log('\n=== TODAS AS TRANSAÇÕES DE R$ 337,22 NO CORA ===')
  console.log(`Total encontradas: ${tx337.length}`)
  for (const t of tx337) {
    console.log(`\n${t.description}`)
    console.log(`  ID: ${t.id}`)
    console.log(`  Valor: R$ ${Number(t.amount).toFixed(2)}`)
    console.log(`  Data: ${t.createdAt}`)
    console.log(`  ReferenceId: ${t.referenceId}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
