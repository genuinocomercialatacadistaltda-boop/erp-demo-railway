import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('=== COMPARAÇÃO: BOLETOS PAGOS vs TRANSAÇÕES ===\n')
  
  // Buscar conta Cora
  const coraAccount = await prisma.bankAccount.findFirst({
    where: { name: { contains: 'cora', mode: 'insensitive' } }
  })
  
  if (!coraAccount) {
    console.log('Conta CORA não encontrada')
    return
  }
  
  // Buscar TODOS os boletos pagos
  const paidBoletos = await prisma.boleto.findMany({
    where: { status: 'PAID' },
    include: { Customer: true },
    orderBy: { createdAt: 'desc' }
  })
  
  console.log(`Total de boletos PAGOS: ${paidBoletos.length}`)
  
  // Buscar TODAS as transações de boleto no Cora
  const boletoTransactions = await prisma.transaction.findMany({
    where: {
      bankAccountId: coraAccount.id,
      description: { contains: 'boleto', mode: 'insensitive' },
      type: 'INCOME'
    },
    orderBy: { createdAt: 'desc' }
  })
  
  console.log(`Total de transações de boleto no Cora: ${boletoTransactions.length}`)
  
  // Calcular totais
  let totalBoletosPaid = 0
  let totalTransactions = 0
  
  for (const b of paidBoletos) {
    totalBoletosPaid += Number(b.paidAmount || b.amount)
  }
  
  for (const t of boletoTransactions) {
    totalTransactions += Number(t.amount)
  }
  
  console.log(`\n💰 Total valor boletos pagos: R$ ${totalBoletosPaid.toFixed(2)}`)
  console.log(`💰 Total transações boleto: R$ ${totalTransactions.toFixed(2)}`)
  console.log(`📊 Diferença: R$ ${(totalTransactions - totalBoletosPaid).toFixed(2)}`)
  
  // Verificar duplicatas por número do boleto
  console.log('\n=== VERIFICANDO DUPLICATAS ===')
  const txByBoleto: Record<string, any[]> = {}
  
  for (const t of boletoTransactions) {
    const match = t.description?.match(/BOL\d+/i)
    if (match) {
      const boletoNum = match[0].toUpperCase()
      if (!txByBoleto[boletoNum]) txByBoleto[boletoNum] = []
      txByBoleto[boletoNum].push(t)
    }
  }
  
  let duplicateCount = 0
  let duplicateTotal = 0
  const duplicateIds: string[] = []
  
  for (const [num, txs] of Object.entries(txByBoleto)) {
    if (txs.length > 1) {
      duplicateCount++
      console.log(`\n⚠️  ${num}: ${txs.length} transações (DUPLICATA)`)
      for (let i = 0; i < txs.length; i++) {
        const t = txs[i]
        console.log(`   ${i + 1}. R$ ${Number(t.amount).toFixed(2)} | ${t.description?.substring(0, 50)}`)
        console.log(`      ID: ${t.id}`)
        console.log(`      Criado: ${t.createdAt}`)
        
        // Marcar as duplicatas (todas menos a primeira)
        if (i > 0) {
          duplicateTotal += Number(t.amount)
          duplicateIds.push(t.id)
        }
      }
    }
  }
  
  console.log(`\n=== RESUMO ===`)
  console.log(`Boletos com transações duplicadas: ${duplicateCount}`)
  console.log(`Valor total duplicado: R$ ${duplicateTotal.toFixed(2)}`)
  console.log(`\nSaldo atual no app: R$ ${Number(coraAccount.balance).toFixed(2)}`)
  console.log(`Saldo após remover duplicatas: R$ ${(Number(coraAccount.balance) - duplicateTotal).toFixed(2)}`)
  
  if (duplicateIds.length > 0) {
    console.log(`\n🗑️  IDs das transações duplicadas para remover:`)
    for (const id of duplicateIds) {
      console.log(`   - ${id}`)
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
