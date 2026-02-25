import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const coraAccount = await prisma.bankAccount.findFirst({
    where: { name: { contains: 'cora', mode: 'insensitive' } }
  })
  
  if (!coraAccount) return
  
  // Buscar transações entre 13/01 e 14/01
  const startDate = new Date('2026-01-13T00:00:00.000Z')
  const endDate = new Date('2026-01-14T23:59:59.999Z')
  
  const transactions = await prisma.transaction.findMany({
    where: {
      bankAccountId: coraAccount.id,
      createdAt: { gte: startDate, lte: endDate },
      type: 'INCOME'
    },
    orderBy: { createdAt: 'asc' }
  })
  
  console.log(`=== TRANSAÇÕES CORA 13/01 a 14/01 ===\n`)
  console.log(`Total: ${transactions.length} transações\n`)
  
  // Agrupar por número de boleto/pedido
  const byRef: Record<string, any[]> = {}
  
  for (const t of transactions) {
    const match = t.description?.match(/(BOL\d+|ESP\d+|ADM-\d+)/i)
    const key = match ? match[0].toUpperCase() : t.id
    if (!byRef[key]) byRef[key] = []
    byRef[key].push(t)
  }
  
  // Listar todas
  for (const t of transactions) {
    const date = new Date(t.createdAt)
    const dateStr = date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const timeStr = date.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    console.log(`${dateStr} ${timeStr} | R$ ${Number(t.amount).toFixed(2).padStart(10)} | ${t.description?.substring(0, 50)}`)
  }
  
  // Verificar duplicatas
  console.log('\n=== DUPLICATAS ENCONTRADAS ===')
  let found = false
  for (const [ref, txs] of Object.entries(byRef)) {
    if (txs.length > 1) {
      found = true
      console.log(`\n⚠️  ${ref}: ${txs.length} transações`)
      for (const t of txs) {
        console.log(`   R$ ${Number(t.amount).toFixed(2)} | ID: ${t.id}`)
      }
    }
  }
  
  if (!found) {
    console.log('✅ Nenhuma duplicata encontrada nesse período')
  }
  
  // Filtrar valores entre 300 e 320
  console.log('\n=== TRANSAÇÕES R$ 300-320 NESSE PERÍODO ===')
  const filtered = transactions.filter(t => Number(t.amount) >= 300 && Number(t.amount) <= 320)
  if (filtered.length === 0) {
    console.log('Nenhuma transação nessa faixa de valor')
  } else {
    for (const t of filtered) {
      console.log(`R$ ${Number(t.amount).toFixed(2)} | ${t.description}`)
      console.log(`  ID: ${t.id}`)
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
