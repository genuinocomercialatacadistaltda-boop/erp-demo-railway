import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const marcivan = await prisma.customer.findFirst({
    where: { name: { contains: 'marcivan', mode: 'insensitive' } }
  })
  
  if (!marcivan) {
    console.log('Cliente não encontrado')
    return
  }
  
  console.log('=== TODOS OS BOLETOS DO MARCIVAN ===\n')
  
  const boletos = await prisma.boleto.findMany({
    where: { customerId: marcivan.id },
    orderBy: { dueDate: 'desc' }
  })
  
  // Filtrar boletos de ~R$ 323
  console.log('📋 BOLETOS COM VALOR ~R$ 323,00:\n')
  
  for (const b of boletos) {
    const amount = Number(b.amount)
    if (amount >= 320 && amount <= 326) {
      console.log(`Boleto: ${b.boletoNumber}`)
      console.log(`  Valor: R$ ${amount.toFixed(2)}`)
      console.log(`  Vencimento: ${b.dueDate?.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`)
      console.log(`  Status: ${b.status}`)
      console.log(`  Data Pagamento: ${b.paidDate?.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) || 'N/A'}`)
      console.log(`  ID: ${b.id}`)
      console.log('')
    }
  }
  
  // Verificar transações de boletos do Marcivan
  console.log('\n=== TRANSAÇÕES DE BOLETO DO MARCIVAN (R$ 320-326) ===\n')
  
  const transactions = await prisma.transaction.findMany({
    where: {
      description: { contains: 'marcivan', mode: 'insensitive' },
      type: 'INCOME'
    },
    orderBy: { createdAt: 'desc' }
  })
  
  for (const t of transactions) {
    const amount = Number(t.amount)
    if (amount >= 320 && amount <= 326) {
      console.log(`${t.description}`)
      console.log(`  Valor: R$ ${amount.toFixed(2)}`)
      console.log(`  Data: ${t.createdAt?.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} ${t.createdAt?.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`)
      console.log(`  ID: ${t.id}`)
      console.log(`  ReferenceId: ${t.referenceId}`)
      console.log('')
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
