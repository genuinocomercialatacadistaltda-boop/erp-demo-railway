import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Buscar pedidos de funcionários
  const employeeOrders = await prisma.order.findMany({
    where: { employeeId: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      employeeId: true,
      total: true,
      paymentStatus: true,
      createdAt: true
    }
  })
  
  console.log('\n=== PEDIDOS DE FUNCIONÁRIOS ===')
  console.log(JSON.stringify(employeeOrders, null, 2))
  
  // Buscar receivables de funcionários
  const employeeReceivables = await prisma.receivable.findMany({
    where: { employeeId: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      description: true,
      amount: true,
      status: true,
      employeeId: true,
      createdAt: true
    }
  })
  
  console.log('\n=== RECEIVABLES DE FUNCIONÁRIOS ===')
  console.log(JSON.stringify(employeeReceivables, null, 2))
  
  // Buscar Eliete
  const eliete = await prisma.employee.findFirst({
    where: { name: { contains: 'ELIETE', mode: 'insensitive' } },
    select: { id: true, name: true, creditLimit: true }
  })
  
  console.log('\n=== FUNCIONÁRIA ELIETE ===')
  console.log(JSON.stringify(eliete, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
