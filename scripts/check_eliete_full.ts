import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Buscar receivable da Eliete
  const receivable = await prisma.receivable.findUnique({
    where: { id: '81e60e6c-ea4d-4b2c-920b-3f3725b7ab79' },
    include: {
      Employee: true,
      Order: true
    }
  })
  
  console.log('\n=== RECEIVABLE ===')
  console.log(JSON.stringify(receivable, null, 2))
  
  // Buscar Eliete
  const eliete = await prisma.employee.findFirst({
    where: { id: 'cmhuxb0090001nz09ya4vd5ic' }
  })
  
  console.log('\n=== FUNCIONÁRIA ELIETE ===')
  console.log('Nome:', eliete?.name)
  console.log('Limite de Crédito:', eliete?.creditLimit)
}

main().catch(console.error).finally(() => prisma.$disconnect())
