import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('=== VERIFICANDO DATAS DA THAIS ===\n')
  
  const thais = await prisma.customer.findFirst({
    where: { name: { contains: 'THAIS ABREU' } }
  })
  
  if (!thais) return
  
  // Buscar receivables pendentes
  const receivables = await prisma.receivable.findMany({
    where: { 
      customerId: thais.id,
      status: { in: ['PENDING', 'OVERDUE'] },
      boletoId: null
    },
    orderBy: { dueDate: 'asc' }
  })
  
  console.log('📋 Receivables da Thais no banco de dados:\n')
  
  for (const r of receivables) {
    const dueDate = new Date(r.dueDate!)
    console.log(`Descrição: ${r.description}`)
    console.log(`  dueDate (raw): ${r.dueDate}`)
    console.log(`  dueDate ISO: ${dueDate.toISOString()}`)
    console.log(`  dueDate UTC: ${dueDate.getUTCFullYear()}-${String(dueDate.getUTCMonth()+1).padStart(2,'0')}-${String(dueDate.getUTCDate()).padStart(2,'0')}`)
    console.log(`  Status: ${r.status}`)
    console.log('')
  }
  
  // Verificar como a API retorna
  console.log('\n=== COMO A DATA DEVERIA SER EXIBIDA ===')
  const firstReceivable = receivables[0]
  if (firstReceivable) {
    const d = new Date(firstReceivable.dueDate!)
    // Formato BR: dd/mm/yyyy
    const br = `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`
    console.log(`Usando getUTCDate(): ${br}`)
    
    // Se usar getDate() em vez de getUTCDate()
    const brLocal = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
    console.log(`Usando getDate(): ${brLocal}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
