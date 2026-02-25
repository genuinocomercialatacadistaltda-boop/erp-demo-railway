import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('=== VERIFICANDO RECEIVABLE DA THAIS ===\n')
  console.log('Data de HOJE:', new Date().toISOString())
  console.log('')
  
  // Buscar receivable do pedido ADM-1767976203782
  const receivable = await prisma.receivable.findFirst({
    where: {
      description: { contains: 'ADM-1767976203782' }
    }
  })
  
  if (receivable) {
    console.log('📋 RECEIVABLE NO BANCO DE DADOS:')
    console.log(`  Descrição: ${receivable.description}`)
    console.log(`  Valor: R$ ${Number(receivable.amount).toFixed(2)}`)
    console.log(`  Status: ${receivable.status}`)
    console.log(`  Data Vencimento (dueDate): ${receivable.dueDate}`)
    console.log(`  Data Vencimento ISO: ${receivable.dueDate?.toISOString()}`)
    
    // Comparar datas
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dueDate = new Date(receivable.dueDate!)
    dueDate.setHours(0, 0, 0, 0)
    
    console.log('\n📅 COMPARAÇÃO DE DATAS:')
    console.log(`  Hoje (zerado): ${today.toISOString()}`)
    console.log(`  Vencimento (zerado): ${dueDate.toISOString()}`)
    console.log(`  Diferença em dias: ${Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))}`)
    
    if (dueDate < today) {
      console.log('  ⚠️ VENCIDO (dueDate < today)')
    } else if (dueDate.getTime() === today.getTime()) {
      console.log('  ✅ VENCE HOJE (dueDate === today) - NÃO ESTÁ VENCIDO')
    } else {
      console.log('  ✅ A VENCER (dueDate > today)')
    }
  }
  
  // Verificar o que a API customers-health retorna
  console.log('\n\n=== VERIFICANDO BOLETOS E RECEIVABLES DA THAIS ===\n')
  
  const thais = await prisma.customer.findFirst({
    where: { name: { contains: 'THAIS ABREU' } }
  })
  
  if (thais) {
    console.log(`Cliente: ${thais.name}`)
    console.log(`ID: ${thais.id}`)
    
    // Buscar todos os receivables
    const receivables = await prisma.receivable.findMany({
      where: { 
        customerId: thais.id,
        status: { in: ['PENDING', 'OVERDUE'] }
      },
      orderBy: { dueDate: 'asc' }
    })
    
    console.log(`\n📋 Receivables pendentes/vencidos: ${receivables.length}`)
    for (const r of receivables) {
      console.log(`  - ${r.description}`)
      console.log(`    Vencimento: ${r.dueDate}`)
      console.log(`    Status: ${r.status}`)
      console.log(`    boletoId: ${r.boletoId || 'null'}`)
    }
    
    // Buscar boletos
    const boletos = await prisma.boleto.findMany({
      where: {
        customerId: thais.id,
        status: { in: ['PENDING', 'OVERDUE'] }
      },
      orderBy: { dueDate: 'asc' }
    })
    
    console.log(`\n📋 Boletos pendentes/vencidos: ${boletos.length}`)
    for (const b of boletos) {
      console.log(`  - ${b.boletoNumber}`)
      console.log(`    Vencimento: ${b.dueDate}`)
      console.log(`    Status: ${b.status}`)
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
