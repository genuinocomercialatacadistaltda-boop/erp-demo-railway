import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Buscar pedido da Eliete sem receivable
  const elietePedido = await prisma.order.findFirst({
    where: { 
      orderNumber: 'ADM-1767995945235',
      employeeId: { not: null }
    }
  })
  
  if (!elietePedido) {
    console.log('❌ Pedido não encontrado')
    return
  }
  
  console.log('📦 Pedido encontrado:', elietePedido.orderNumber)
  console.log('   - Total:', elietePedido.total)
  console.log('   - Employee ID:', elietePedido.employeeId)
  
  // Verificar se já existe receivable
  const existingReceivable = await prisma.receivable.findFirst({
    where: { orderId: elietePedido.id }
  })
  
  if (existingReceivable) {
    console.log('✅ Receivable já existe:', existingReceivable.id)
    return
  }
  
  // Criar receivable
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 30)
  
  const receivable = await prisma.receivable.create({
    data: {
      description: `Pedido ${elietePedido.orderNumber}`,
      amount: Number(elietePedido.total),
      dueDate,
      status: 'PENDING',
      paymentMethod: elietePedido.paymentMethod || 'PIX',
      orderId: elietePedido.id,
      employeeId: elietePedido.employeeId!
    }
  })
  
  console.log('\n✅ RECEIVABLE CRIADO COM SUCESSO!')
  console.log('   - ID:', receivable.id)
  console.log('   - Valor:', receivable.amount)
  console.log('   - Vencimento:', receivable.dueDate)
  console.log('   - Employee ID:', receivable.employeeId)
  
  // Atualizar limite da Eliete
  const employee = await prisma.employee.findUnique({
    where: { id: elietePedido.employeeId! }
  })
  
  if (employee) {
    const newLimit = Number(employee.creditLimit) - Number(elietePedido.total)
    await prisma.employee.update({
      where: { id: employee.id },
      data: { creditLimit: newLimit }
    })
    console.log('\n💰 LIMITE ATUALIZADO!')
    console.log(`   - Limite anterior: R$ ${employee.creditLimit}`)
    console.log(`   - Valor descontado: R$ ${elietePedido.total}`)
    console.log(`   - Novo limite: R$ ${newLimit}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
