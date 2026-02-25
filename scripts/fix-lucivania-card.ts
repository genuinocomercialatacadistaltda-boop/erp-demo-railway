import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixLucivaniaCard() {
  // Buscar pedido
  const order = await prisma.order.findFirst({
    where: { orderNumber: { contains: '49695115' } },
    include: { Customer: true, Receivable: true }
  })
  
  if (!order) {
    console.log('Pedido não encontrado')
    return
  }
  
  console.log('Pedido encontrado:', order.orderNumber)
  console.log('Valor:', order.total)
  console.log('Método:', order.paymentMethod)
  
  // Verificar se já existe CardTransaction
  const existingTransaction = await prisma.cardTransaction.findFirst({
    where: { orderId: order.id }
  })
  
  if (existingTransaction) {
    console.log('CardTransaction já existe:', existingTransaction.id)
    return
  }
  
  // Buscar configuração de taxa
  const feeConfig = await prisma.cardFeeConfig.findFirst({
    where: { cardType: 'CREDIT', isActive: true }
  })
  
  const feePercentage = feeConfig?.feePercentage || 3.24
  const grossAmount = Number(order.total)
  const feeAmount = grossAmount * (feePercentage / 100)
  const netAmount = grossAmount - feeAmount
  
  // Calcular data esperada (D+2 para crédito, dias úteis)
  const saleDate = new Date(order.createdAt)
  let expectedDate = new Date(saleDate)
  expectedDate.setDate(expectedDate.getDate() + 2)
  
  // Pular fins de semana
  while (expectedDate.getDay() === 0 || expectedDate.getDay() === 6) {
    expectedDate.setDate(expectedDate.getDate() + 1)
  }
  
  // Criar CardTransaction
  const cardTransaction = await prisma.cardTransaction.create({
    data: {
      id: crypto.randomUUID(),
      orderId: order.id,
      customerId: order.customerId || undefined,
      receivableId: order.Receivable[0]?.id || undefined,
      cardType: 'CREDIT',
      grossAmount,
      feePercentage,
      feeAmount,
      netAmount,
      status: 'PENDING',
      saleDate,
      expectedDate
    }
  })
  
  console.log('\n✅ CardTransaction criada!')
  console.log('ID:', cardTransaction.id)
  console.log('Valor Bruto:', grossAmount)
  console.log('Taxa:', feePercentage, '% =', feeAmount.toFixed(2))
  console.log('Valor Líquido:', netAmount.toFixed(2))
  console.log('Data Venda:', saleDate.toISOString().split('T')[0])
  console.log('Data Esperada:', expectedDate.toISOString().split('T')[0])
  
  await prisma.$disconnect()
}

fixLucivaniaCard()
