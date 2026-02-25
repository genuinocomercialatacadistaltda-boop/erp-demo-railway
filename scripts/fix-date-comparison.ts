import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('=== CORRIGINDO COMPARAÇÃO DE DATAS ===\n')
  
  // Calcular "hoje" em Brasília
  const now = new Date()
  const brasiliaTime = new Date(now.getTime() - (3 * 60 * 60 * 1000))
  const year = brasiliaTime.getUTCFullYear()
  const month = brasiliaTime.getUTCMonth()
  const day = brasiliaTime.getUTCDate()
  
  console.log('Agora UTC:', now.toISOString())
  console.log('Agora Brasília:', brasiliaTime.toISOString())
  console.log(`Data de hoje (Brasília): ${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`)
  
  // Início do dia de hoje em Brasília (03:00 UTC)
  const todayStart = new Date(Date.UTC(year, month, day, 3, 0, 0, 0))
  // FIM do dia de hoje em Brasília (02:59:59 UTC do dia seguinte)
  const todayEnd = new Date(Date.UTC(year, month, day + 1, 2, 59, 59, 999))
  
  console.log('\nIntervalo do dia de hoje:')
  console.log('  Início:', todayStart.toISOString())
  console.log('  Fim:', todayEnd.toISOString())
  
  // Buscar receivables com vencimento HOJE que estão OVERDUE (erro!)
  console.log('\n📋 Receivables que vencem HOJE mas estão OVERDUE:')
  
  const wronglyOverdueToday = await prisma.receivable.findMany({
    where: {
      status: 'OVERDUE',
      dueDate: {
        gte: new Date(Date.UTC(year, month, day, 0, 0, 0, 0)), // 00:00 UTC do dia
        lt: new Date(Date.UTC(year, month, day + 1, 0, 0, 0, 0))  // 00:00 UTC do dia seguinte
      }
    }
  })
  
  console.log(`Encontrados: ${wronglyOverdueToday.length}`)
  
  for (const r of wronglyOverdueToday) {
    console.log(`\n  - ${r.description}`)
    console.log(`    Vencimento: ${r.dueDate}`)
    console.log(`    Status atual: ${r.status}`)
    console.log(`    Corrigindo para PENDING...`)
    
    await prisma.receivable.update({
      where: { id: r.id },
      data: { status: 'PENDING' }
    })
  }
  
  console.log('\n✅ Correções aplicadas!')
  
  // Verificar resultado
  console.log('\n=== VERIFICAÇÃO FINAL THAIS ===')
  const thais = await prisma.customer.findFirst({
    where: { name: { contains: 'THAIS ABREU' } }
  })
  
  if (thais) {
    const receivables = await prisma.receivable.findMany({
      where: { 
        customerId: thais.id,
        status: { in: ['PENDING', 'OVERDUE'] },
        boletoId: null
      },
      orderBy: { dueDate: 'asc' }
    })
    
    console.log(`\nReceivables pendentes da Thais:`)
    for (const r of receivables) {
      console.log(`  - ${r.description}`)
      console.log(`    Vencimento: ${r.dueDate}`)
      console.log(`    Status: ${r.status}`)
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
