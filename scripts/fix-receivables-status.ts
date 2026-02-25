import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixReceivablesStatus() {
  // Buscar todos os receivables com status PENDING/OVERDUE que têm boleto PAID
  const inconsistentReceivables = await prisma.receivable.findMany({
    where: {
      status: { in: ['PENDING', 'OVERDUE'] },
      boletoId: { not: null }
    },
    include: {
      Boleto: true,
      Customer: true
    }
  })
  
  console.log(`Total de receivables com boleto vinculado e status PENDING/OVERDUE: ${inconsistentReceivables.length}`)
  
  let fixed = 0
  for (const rec of inconsistentReceivables) {
    if (rec.Boleto?.status === 'PAID') {
      console.log(`Corrigindo: ${rec.description} - Cliente: ${rec.Customer?.name || 'N/A'}`)
      console.log(`  Receivable: ${rec.status} -> PAID`)
      console.log(`  Boleto: ${rec.Boleto.boletoNumber} - Status: ${rec.Boleto.status}`)
      
      await prisma.receivable.update({
        where: { id: rec.id },
        data: { 
          status: 'PAID',
          paymentDate: rec.Boleto.paidAt || new Date()
        }
      })
      fixed++
    }
  }
  
  console.log(`\n✅ Corrigidos ${fixed} receivables`)
  
  await prisma.$disconnect()
}

fixReceivablesStatus()
