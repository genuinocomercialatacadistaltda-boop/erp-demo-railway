import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const customerId = 'c433bac6-1adc-46c7-8d3b-93aa3cf19fb8'
  
  // Buscar receivables sem boleto
  const receivablesWithoutBoleto = await prisma.receivable.findMany({
    where: {
      customerId,
      status: { in: ['PENDING', 'OVERDUE'] },
      boletoId: null
    },
    select: { amount: true }
  })
  
  // Buscar boletos pendentes
  const pendingBoletos = await prisma.boleto.findMany({
    where: {
      customerId,
      status: { in: ['PENDING', 'OVERDUE'] }
    },
    select: { amount: true }
  })
  
  // Buscar limite do cliente
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { creditLimit: true, availableCredit: true }
  })
  
  if (!customer) return
  
  const totalReceivables = receivablesWithoutBoleto.reduce((sum, r) => sum + Number(r.amount), 0)
  const totalBoletos = pendingBoletos.reduce((sum, b) => sum + Number(b.amount), 0)
  const totalUsed = totalReceivables + totalBoletos
  const correctCredit = Number(customer.creditLimit) - totalUsed
  
  console.log('📊 Cálculo correto:')
  console.log(`   Limite: R$ ${Number(customer.creditLimit).toFixed(2)}`)
  console.log(`   Receivables sem boleto: R$ ${totalReceivables.toFixed(2)}`)
  console.log(`   Boletos pendentes: R$ ${totalBoletos.toFixed(2)}`)
  console.log(`   Total usado: R$ ${totalUsed.toFixed(2)}`)
  console.log(`   Crédito disponível: R$ ${correctCredit.toFixed(2)}`)
  console.log(`   Valor atual no banco: R$ ${Number(customer.availableCredit).toFixed(2)}`)
  
  if (Math.abs(correctCredit - Number(customer.availableCredit)) > 0.01) {
    await prisma.customer.update({
      where: { id: customerId },
      data: { availableCredit: correctCredit }
    })
    console.log('\n✅ Crédito atualizado no banco!')
  } else {
    console.log('\n✅ Crédito já está correto no banco!')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
