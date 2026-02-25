import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Buscar conta Cora
  const coraAccount = await prisma.bankAccount.findFirst({
    where: { name: { contains: 'cora', mode: 'insensitive' } }
  })
  
  if (!coraAccount) {
    console.log('Conta CORA não encontrada')
    return
  }
  
  console.log('=== CONTA CORA ===')
  console.log(`ID: ${coraAccount.id}`)
  console.log(`Nome: ${coraAccount.name}`)
  console.log(`SALDO ATUAL NO APP: R$ ${Number(coraAccount.balance).toFixed(2)}`)
  
  // Buscar TODAS as transações da conta Cora
  const allTransactions = await prisma.transaction.findMany({
    where: { bankAccountId: coraAccount.id },
    orderBy: { createdAt: 'asc' }
  })
  
  console.log(`\nTotal de transações: ${allTransactions.length}`)
  
  // Calcular saldo baseado nas transações
  let calculatedBalance = 0
  for (const t of allTransactions) {
    if (t.type === 'INCOME') {
      calculatedBalance += Number(t.amount)
    } else {
      calculatedBalance -= Math.abs(Number(t.amount))
    }
  }
  
  console.log(`\nSALDO CALCULADO (soma das transações): R$ ${calculatedBalance.toFixed(2)}`)
  console.log(`DIFERENÇA: R$ ${(Number(coraAccount.balance) - calculatedBalance).toFixed(2)}`)
  
  // Verificar transações duplicadas (mesmo referenceId)
  console.log('\n=== VERIFICANDO DUPLICATAS ===')
  const txByRef: Record<string, any[]> = {}
  for (const t of allTransactions) {
    if (t.referenceId) {
      if (!txByRef[t.referenceId]) txByRef[t.referenceId] = []
      txByRef[t.referenceId].push(t)
    }
  }
  
  let hasDuplicates = false
  for (const [refId, txs] of Object.entries(txByRef)) {
    if (txs.length > 1) {
      hasDuplicates = true
      console.log(`\n⚠️  DUPLICATA ENCONTRADA (referenceId: ${refId}):`)
      for (const t of txs) {
        console.log(`   - ID: ${t.id}`)
        console.log(`     Descrição: ${t.description}`)
        console.log(`     Valor: R$ ${Number(t.amount).toFixed(2)}`)
        console.log(`     Data: ${t.createdAt}`)
      }
    }
  }
  
  if (!hasDuplicates) {
    console.log('✅ Nenhuma transação duplicada encontrada')
  }
  
  // Listar transações com valores 323 ou 337
  console.log('\n=== TRANSAÇÕES COM VALORES ~323 ou ~337 ===')
  const relevantTx = allTransactions.filter(t => {
    const amount = Number(t.amount)
    return amount >= 320 && amount <= 340
  })
  
  for (const t of relevantTx) {
    console.log(`\n${t.description}`)
    console.log(`  ID: ${t.id}`)
    console.log(`  Valor: R$ ${Number(t.amount).toFixed(2)}`)
    console.log(`  Tipo: ${t.type}`)
    console.log(`  Data Criação: ${t.createdAt}`)
    console.log(`  ReferenceId: ${t.referenceId}`)
  }
  
  // Buscar boletos pagos do Marcivan para comparar
  console.log('\n=== BOLETOS PAGOS DO MARCIVAN ===')
  const marcivan = await prisma.customer.findFirst({
    where: { name: { contains: 'marcivan', mode: 'insensitive' } }
  })
  
  if (marcivan) {
    const paidBoletos = await prisma.boleto.findMany({
      where: { 
        customerId: marcivan.id,
        status: 'PAID'
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    })
    
    for (const b of paidBoletos) {
      // Verificar se existe transação para este boleto
      const txForBoleto = allTransactions.filter(t => t.referenceId === b.id)
      console.log(`\nBoleto: ${b.boletoNumber}`)
      console.log(`  Valor Original: R$ ${Number(b.amount).toFixed(2)}`)
      console.log(`  Valor Pago: R$ ${b.paidAmount ? Number(b.paidAmount).toFixed(2) : 'N/A'}`)
      console.log(`  Transações vinculadas: ${txForBoleto.length}`)
      for (const t of txForBoleto) {
        console.log(`    - ${t.description}: R$ ${Number(t.amount).toFixed(2)}`)
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
