import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkMarcivan() {
  const customer = await prisma.customer.findFirst({
    where: {
      name: { contains: 'Marcivan', mode: 'insensitive' }
    }
  })
  
  if (!customer) {
    console.log('Cliente Marcivan não encontrado')
    return
  }
  
  console.log('=== CLIENTE MARCIVAN ===')
  console.log('ID:', customer.id)
  console.log('Nome:', customer.name)
  console.log('Liberado manualmente:', customer.manuallyUnblocked)
  
  const boletos = await prisma.boleto.findMany({
    where: { customerId: customer.id },
    orderBy: { dueDate: 'desc' }
  })
  
  console.log('\n=== TODOS OS BOLETOS ===')
  boletos.forEach(b => {
    console.log(`  ${b.boletoNumber}: R$ ${b.amount} - Venc: ${b.dueDate.toISOString().split('T')[0]} - Status: ${b.status}`)
  })
  
  const today = new Date()
  today.setUTCHours(0,0,0,0)
  
  const pendingBoletos = await prisma.boleto.findMany({
    where: {
      customerId: customer.id,
      status: { in: ['PENDING', 'OVERDUE'] },
      dueDate: { lt: today }
    }
  })
  
  console.log('\n=== BOLETOS VENCIDOS (PENDING/OVERDUE, dueDate < hoje) ===')
  console.log('Hoje:', today.toISOString())
  console.log('Total:', pendingBoletos.length)
  pendingBoletos.forEach(b => {
    console.log(`  ${b.boletoNumber}: R$ ${b.amount} - Venc: ${b.dueDate.toISOString()} - Status: ${b.status}`)
  })
  
  const receivables = await prisma.receivable.findMany({
    where: {
      customerId: customer.id,
      boletoId: null,
      status: { in: ['PENDING', 'OVERDUE'] },
      dueDate: { lt: today }
    }
  })
  
  console.log('\n=== RECEIVABLES VENCIDOS (sem boleto) ===')
  console.log('Total:', receivables.length)
  receivables.forEach(r => {
    console.log(`  ${r.description}: R$ ${r.amount} - Venc: ${r.dueDate.toISOString()} - Status: ${r.status}`)
  })
  
  const totalBoletos = pendingBoletos.reduce((sum, b) => sum + Number(b.amount), 0)
  const totalReceivables = receivables.reduce((sum, r) => sum + Number(r.amount), 0)
  
  console.log('\n=== RESUMO ===')
  console.log('Total boletos vencidos:', pendingBoletos.length, '- R$', totalBoletos)
  console.log('Total receivables vencidos:', receivables.length, '- R$', totalReceivables)
  console.log('TOTAL GERAL:', pendingBoletos.length + receivables.length, '- R$', totalBoletos + totalReceivables)
  
  await prisma.$disconnect()
}

checkMarcivan()
