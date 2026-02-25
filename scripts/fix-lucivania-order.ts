import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
const prisma = new PrismaClient()

async function main() {
  console.log('=== CRIANDO RECEIVABLE PARA PEDIDO ATAC43112931 ===\n')
  
  const order = await prisma.order.findFirst({
    where: { orderNumber: 'ATAC43112931' },
    include: { Customer: true }
  })
  
  if (!order) {
    console.log('❌ Pedido não encontrado!')
    return
  }
  
  // Verificar se já tem receivable
  const existing = await prisma.receivable.findFirst({
    where: { orderId: order.id }
  })
  
  if (existing) {
    console.log('⚠️ Já existe receivable para este pedido!')
    return
  }
  
  // Criar receivable
  const dueDate = new Date(order.createdAt)
  dueDate.setDate(dueDate.getDate() + 7)
  
  const receivable = await prisma.receivable.create({
    data: {
      id: randomUUID(),
      customerId: order.customerId,
      orderId: order.id,
      boletoId: null,
      description: `Pedido #${order.orderNumber} - ${order.customerName || order.Customer?.name || 'Cliente não identificado'}`,
      amount: Number(order.total),
      dueDate: dueDate,
      paymentDate: null,
      status: 'PENDING',
      paymentMethod: order.paymentMethod || 'CARD',
      bankAccountId: null,
      createdBy: null,
    }
  })
  
  console.log('✅ Receivable criado com sucesso!')
  console.log(`   ID: ${receivable.id}`)
  console.log(`   Descrição: ${receivable.description}`)
  console.log(`   Valor: R$ ${Number(receivable.amount).toFixed(2)}`)
  console.log(`   Vencimento: ${receivable.dueDate.toISOString().split('T')[0]}`)
  console.log(`   Método: ${receivable.paymentMethod}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
