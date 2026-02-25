// Importa diretamente as funções da lib
import { getBankStatements, BankStatementFilters } from '../lib/cora'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== COMPARAÇÃO: CORA REAL vs APP ===\n')
  
  // Buscar conta Cora no app
  const coraAccount = await prisma.bankAccount.findFirst({
    where: { name: { contains: 'cora', mode: 'insensitive' } }
  })
  
  if (!coraAccount) {
    console.log('❌ Conta CORA não encontrada no app')
    return
  }
  
  console.log('📱 SALDO NO APP: R$ ' + Number(coraAccount.balance).toFixed(2))
  
  // Buscar extratos reais do Cora - últimos 7 dias
  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - 7)
  
  const filters: BankStatementFilters = {
    startDate: startDate.toISOString().split('T')[0],
    endDate: today.toISOString().split('T')[0],
    type: 'ALL'
  }
  
  console.log(`\n🔍 Buscando extratos de ${filters.startDate} a ${filters.endDate}...`)
  
  try {
    const coraTransactions = await getBankStatements(filters)
    
    console.log(`\n✅ ${coraTransactions.length} transações encontradas no Cora real:\n`)
    
    let totalCredits = 0
    let totalDebits = 0
    
    for (const tx of coraTransactions) {
      const sign = tx.type === 'CREDIT' ? '+' : '-'
      const amount = tx.amount / 100
      
      if (tx.type === 'CREDIT') {
        totalCredits += amount
      } else {
        totalDebits += amount
      }
      
      console.log(`  ${sign} R$ ${amount.toFixed(2)} | ${tx.description?.substring(0, 50)}`)
      console.log(`    ID: ${tx.id} | Data: ${tx.date}`)
    }
    
    console.log('\n=== RESUMO CORA REAL (7 dias) ===')
    console.log(`  Total Entradas: R$ ${totalCredits.toFixed(2)}`)
    console.log(`  Total Saídas: R$ ${totalDebits.toFixed(2)}`)
    console.log(`  Líquido: R$ ${(totalCredits - totalDebits).toFixed(2)}`)
    
  } catch (error: any) {
    console.error('❌ Erro ao buscar extratos:', error.message)
    console.log('\nDetalhes do erro:', error)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
