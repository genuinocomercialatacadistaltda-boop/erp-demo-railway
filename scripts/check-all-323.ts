import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('=== BUSCA AMPLA: TODOS OS BOLETOS DE R$ 323 ===\n')
  
  const boletos = await prisma.boleto.findMany({
    where: {
      amount: { gte: 322.99, lte: 323.01 }
    },
    include: { Customer: true },
    orderBy: { createdAt: 'desc' }
  })
  
  console.log(`Total de boletos de R$ 323,00: ${boletos.length}\n`)
  
  for (const b of boletos) {
    console.log(`${b.boletoNumber} - ${b.Customer?.name}`)
    console.log(`  Valor: R$ ${Number(b.amount).toFixed(2)}`)
    console.log(`  Vencimento: ${b.dueDate?.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`)
    console.log(`  Status: ${b.status}`)
    console.log(`  Pago em: ${b.paidDate?.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) || 'N/A'}`)
    console.log(`  Criado em: ${b.createdAt?.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`)
    console.log('')
  }
  
  // Verificar TODAS as transações de R$ 323
  console.log('\n=== TODAS AS TRANSAÇÕES DE R$ 323,00 ===\n')
  
  const transactions = await prisma.transaction.findMany({
    where: {
      amount: { gte: 322.99, lte: 323.01 },
      type: 'INCOME'
    },
    orderBy: { createdAt: 'desc' }
  })
  
  console.log(`Total de transações: ${transactions.length}\n`)
  
  for (const t of transactions) {
    console.log(`${t.description}`)
    console.log(`  Valor: R$ ${Number(t.amount).toFixed(2)}`)
    console.log(`  Data: ${t.createdAt?.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} ${t.createdAt?.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`)
    console.log(`  ID: ${t.id}`)
    console.log('')
  }
  
  // Verificar pedidos do Marcivan de ~323
  console.log('\n=== PEDIDOS DO MARCIVAN COM VALOR ~R$ 323 ===\n')
  
  const marcivan = await prisma.customer.findFirst({
    where: { name: { contains: 'marcivan', mode: 'insensitive' } }
  })
  
  if (marcivan) {
    const orders = await prisma.order.findMany({
      where: {
        customerId: marcivan.id,
        total: { gte: 320, lte: 326 }
      },
      orderBy: { createdAt: 'desc' }
    })
    
    for (const o of orders) {
      console.log(`${o.orderNumber}`)
      console.log(`  Total: R$ ${Number(o.total).toFixed(2)}`)
      console.log(`  Pagamento: ${o.paymentMethod}`)
      console.log(`  Status: ${o.paymentStatus}`)
      console.log(`  Criado: ${o.createdAt?.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`)
      console.log('')
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
