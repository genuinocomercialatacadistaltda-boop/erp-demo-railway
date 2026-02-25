import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkMarcivan() {
  const customer = await prisma.customer.findFirst({
    where: {
      name: { contains: 'Marcivan', mode: 'insensitive' }
    }
  })
  
  if (!customer) return
  
  console.log('Customer ID:', customer.id)
  
  // TODOS os receivables do cliente
  const allReceivables = await prisma.receivable.findMany({
    where: { customerId: customer.id },
    orderBy: { dueDate: 'desc' }
  })
  
  console.log('\n=== TODOS OS RECEIVABLES ===')
  allReceivables.forEach(r => {
    console.log(`  ${r.description}: R$ ${r.amount} - Venc: ${r.dueDate.toISOString()} - Status: ${r.status} - boletoId: ${r.boletoId || 'null'}`)
  })
  
  // Verificar se há receivables PENDENTES/OVERDUE (independente de boleto)
  const pendingReceivables = await prisma.receivable.findMany({
    where: {
      customerId: customer.id,
      status: { in: ['PENDING', 'OVERDUE'] }
    }
  })
  
  console.log('\n=== RECEIVABLES PENDENTES/OVERDUE (TODOS) ===')
  console.log('Total:', pendingReceivables.length)
  pendingReceivables.forEach(r => {
    console.log(`  ${r.description}: R$ ${r.amount} - Venc: ${r.dueDate.toISOString()} - Status: ${r.status} - boletoId: ${r.boletoId || 'null'}`)
  })
  
  // Calcular R$ 517 - quais combinações dão esse valor?
  const pendingBoletos = await prisma.boleto.findMany({
    where: {
      customerId: customer.id,
      status: { in: ['PENDING', 'OVERDUE'] }
    }
  })
  
  console.log('\n=== BOLETOS PENDING/OVERDUE ===')
  pendingBoletos.forEach(b => {
    console.log(`  ${b.boletoNumber}: R$ ${b.amount} - Venc: ${b.dueDate.toISOString()} - Status: ${b.status}`)
  })
  
  // Testar combinações que dão R$ 517
  console.log('\n=== COMBINAÇÕES QUE DÃO ~R$ 517 ===')
  for (let i = 0; i < pendingBoletos.length; i++) {
    for (let j = i+1; j < pendingBoletos.length; j++) {
      const sum = Number(pendingBoletos[i].amount) + Number(pendingBoletos[j].amount)
      if (Math.abs(sum - 517) < 1) {
        console.log(`${pendingBoletos[i].boletoNumber} (${pendingBoletos[i].amount}) + ${pendingBoletos[j].boletoNumber} (${pendingBoletos[j].amount}) = ${sum}`)
      }
    }
  }
  
  await prisma.$disconnect()
}

checkMarcivan()
