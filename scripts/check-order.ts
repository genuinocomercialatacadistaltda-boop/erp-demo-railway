import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const order = await prisma.order.findFirst({
    where: { orderNumber: 'ESP38309353' },
    include: { PixCharges: true }
  })
  
  console.log('=== PEDIDO ===')
  console.log('ID:', order?.id)
  console.log('Número:', order?.orderNumber)
  console.log('Método:', order?.paymentMethod)
  console.log('Status Pagamento:', order?.paymentStatus)
  console.log('Total:', order?.total)
  console.log('Criado em:', order?.createdAt)
  console.log('\n=== PIX CHARGES ===')
  console.log(order?.PixCharges)
  
  const receivables = await prisma.receivable.findMany({
    where: { orderId: order?.id }
  })
  console.log('\n=== RECEIVABLES ===')
  receivables.forEach(r => {
    console.log('ID:', r.id, '| Status:', r.status, '| Valor:', r.amount, '| Método:', r.paymentMethod, '| bankAccountId:', r.bankAccountId)
  })
  
  if (order?.id) {
    const transactions = await prisma.transaction.findMany({
      where: {
        OR: [
          { description: { contains: order.orderNumber } },
          { referenceId: order.id }
        ]
      }
    })
    console.log('\n=== TRANSAÇÕES BANCÁRIAS ===')
    console.log(transactions.length > 0 ? transactions : 'NENHUMA')
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
