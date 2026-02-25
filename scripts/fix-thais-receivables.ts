import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('=== CORRIGINDO RECEIVABLES DA THAIS ===\n')
  
  const today = new Date()
  today.setUTCHours(3, 0, 0, 0) // Meia-noite em Brasília
  console.log('Hoje (Brasília):', today.toISOString())
  
  // 1. Corrigir receivable que está OVERDUE mas vence hoje ou depois
  console.log('\n1️⃣ Corrigindo receivables marcados como OVERDUE incorretamente...')
  
  const wronglyOverdue = await prisma.receivable.findMany({
    where: {
      status: 'OVERDUE',
      dueDate: { gte: today }
    }
  })
  
  console.log(`   Encontrados ${wronglyOverdue.length} receivables com status OVERDUE mas não vencidos:`)
  
  for (const r of wronglyOverdue) {
    console.log(`   - ${r.description}`)
    console.log(`     Vencimento: ${r.dueDate}`)
    console.log(`     Corrigindo para PENDING...`)
    
    await prisma.receivable.update({
      where: { id: r.id },
      data: { status: 'PENDING' }
    })
  }
  
  // 2. Corrigir receivables vinculados a boletos já pagos
  console.log('\n2️⃣ Corrigindo receivables vinculados a boletos já pagos...')
  
  const receivablesWithPaidBoletos = await prisma.receivable.findMany({
    where: {
      boletoId: { not: null },
      status: { in: ['PENDING', 'OVERDUE'] }
    },
    include: {
      Boleto: true
    }
  })
  
  let correctedCount = 0
  for (const r of receivablesWithPaidBoletos) {
    if (r.Boleto && r.Boleto.status === 'PAID') {
      console.log(`   - ${r.description}`)
      console.log(`     Boleto ${r.Boleto.boletoNumber} está PAID`)
      console.log(`     Corrigindo receivable para PAID...`)
      
      await prisma.receivable.update({
        where: { id: r.id },
        data: { 
          status: 'PAID',
          paymentDate: r.Boleto.paidDate || new Date()
        }
      })
      correctedCount++
    }
  }
  
  console.log(`   Total corrigidos: ${correctedCount}`)
  
  // 3. Verificar resultado final
  console.log('\n\n=== ESTADO FINAL DA THAIS ===\n')
  
  const thais = await prisma.customer.findFirst({
    where: { name: { contains: 'THAIS ABREU' } }
  })
  
  if (thais) {
    const receivables = await prisma.receivable.findMany({
      where: { 
        customerId: thais.id,
        status: { in: ['PENDING', 'OVERDUE'] },
        boletoId: null // Apenas os que não têm boleto vinculado
      },
      orderBy: { dueDate: 'asc' }
    })
    
    console.log(`Receivables pendentes (sem boleto): ${receivables.length}`)
    for (const r of receivables) {
      const dueDate = new Date(r.dueDate!)
      const isOverdue = dueDate < today
      console.log(`  - ${r.description}`)
      console.log(`    Vencimento: ${r.dueDate}`)
      console.log(`    Status atual: ${r.status}`)
      console.log(`    Está vencido de fato? ${isOverdue ? 'SIM' : 'NÃO'}`)
    }
    
    const boletos = await prisma.boleto.findMany({
      where: {
        customerId: thais.id,
        status: { in: ['PENDING', 'OVERDUE'] }
      },
      orderBy: { dueDate: 'asc' }
    })
    
    console.log(`\nBoletos pendentes: ${boletos.length}`)
    for (const b of boletos) {
      console.log(`  - ${b.boletoNumber}: venc. ${b.dueDate} - ${b.status}`)
    }
  }
  
  console.log('\n✅ CORREÇÕES CONCLUÍDAS!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
