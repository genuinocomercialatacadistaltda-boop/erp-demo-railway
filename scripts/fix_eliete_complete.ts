import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const receivableId = '81e60e6c-ea4d-4b2c-920b-3f3725b7ab79'
  const employeeId = 'cmhuxb0090001nz09ya4vd5ic'
  const orderTotal = 87.475
  
  // 1. Atualizar receivable para vincular ao funcionário
  const updatedReceivable = await prisma.receivable.update({
    where: { id: receivableId },
    data: { employeeId: employeeId }
  })
  
  console.log('✅ Receivable atualizado!')
  console.log('   - ID:', updatedReceivable.id)
  console.log('   - Employee ID:', updatedReceivable.employeeId)
  
  // 2. Descontar do limite da Eliete
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId }
  })
  
  if (employee) {
    const newLimit = Number(employee.creditLimit) - orderTotal
    await prisma.employee.update({
      where: { id: employeeId },
      data: { creditLimit: newLimit }
    })
    
    console.log('\n💰 Limite atualizado!')
    console.log(`   - Limite anterior: R$ ${employee.creditLimit}`)
    console.log(`   - Valor descontado: R$ ${orderTotal}`)
    console.log(`   - Novo limite: R$ ${newLimit.toFixed(2)}`)
  }
  
  // 3. Verificar resultado final
  const finalEmployee = await prisma.employee.findUnique({
    where: { id: employeeId }
  })
  const finalReceivable = await prisma.receivable.findUnique({
    where: { id: receivableId }
  })
  
  console.log('\n=== RESULTADO FINAL ===')
  console.log('Eliete - Limite:', finalEmployee?.creditLimit)
  console.log('Receivable - Employee ID:', finalReceivable?.employeeId)
}

main().catch(console.error).finally(() => prisma.$disconnect())
