import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const coraAccount = await prisma.bankAccount.findFirst({
    where: { name: { contains: 'cora', mode: 'insensitive' } }
  })
  
  if (!coraAccount) return
  
  const allTx = await prisma.transaction.findMany({
    where: { bankAccountId: coraAccount.id },
    orderBy: { createdAt: 'asc' }
  })
  
  // Separar entradas e saídas
  let totalIncome = 0
  let totalExpense = 0
  let incomeCount = 0
  let expenseCount = 0
  
  for (const t of allTx) {
    if (t.type === 'INCOME') {
      totalIncome += Number(t.amount)
      incomeCount++
    } else {
      totalExpense += Math.abs(Number(t.amount))
      expenseCount++
    }
  }
  
  console.log('=== RESUMO DA CONTA CORA ===')
  console.log(`Saldo no APP: R$ ${Number(coraAccount.balance).toFixed(2)}`)
  console.log(`\nTotal de Entradas (${incomeCount}): R$ ${totalIncome.toFixed(2)}`)
  console.log(`Total de Saídas (${expenseCount}): R$ ${totalExpense.toFixed(2)}`)
  console.log(`Saldo Calculado: R$ ${(totalIncome - totalExpense).toFixed(2)}`)
  console.log(`\nDIFERENÇA: R$ ${(Number(coraAccount.balance) - (totalIncome - totalExpense)).toFixed(2)}`)
  
  // Verificar duplicatas de boleto
  console.log('\n=== DUPLICATAS DE BOLETOS ===')
  const boletoTx = allTx.filter(t => 
    t.description?.toLowerCase().includes('boleto') && t.type === 'INCOME'
  )
  
  // Agrupar por número do boleto
  const byBoleto: Record<string, any[]> = {}
  for (const t of boletoTx) {
    const match = t.description?.match(/BOL\d+/i)
    if (match) {
      const boletoNum = match[0]
      if (!byBoleto[boletoNum]) byBoleto[boletoNum] = []
      byBoleto[boletoNum].push(t)
    }
  }
  
  let duplicateTotal = 0
  for (const [num, txs] of Object.entries(byBoleto)) {
    if (txs.length > 1) {
      console.log(`\n⚠️  ${num}: ${txs.length} transações`)
      for (const t of txs) {
        console.log(`   R$ ${Number(t.amount).toFixed(2)} - ${t.description?.substring(0, 60)}`)
        console.log(`   ID: ${t.id}`)
      }
      // Soma duplicada (todas menos a primeira)
      for (let i = 1; i < txs.length; i++) {
        duplicateTotal += Number(txs[i].amount)
      }
    }
  }
  
  console.log(`\n💰 TOTAL DUPLICADO EM BOLETOS: R$ ${duplicateTotal.toFixed(2)}`)
  
  // Listar as últimas 10 transações para debug
  console.log('\n=== ÚLTIMAS 10 TRANSAÇÕES ===')
  const last10 = allTx.slice(-10)
  for (const t of last10) {
    const sign = t.type === 'INCOME' ? '+' : '-'
    console.log(`${sign} R$ ${Number(t.amount).toFixed(2)} | ${t.description?.substring(0, 50)}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
