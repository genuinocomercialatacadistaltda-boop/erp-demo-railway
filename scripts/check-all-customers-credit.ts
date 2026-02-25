/**
 * Script para verificar se há outros clientes com problemas de crédito
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkAllCustomersCredit() {
  console.log('🔍 VERIFICANDO CRÉDITO DE TODOS OS CLIENTES')
  console.log('='.repeat(80))
  
  // Buscar todos os clientes ativos
  const customers = await prisma.customer.findMany({
    where: {
      isActive: true
    },
    orderBy: { name: 'asc' }
  })
  
  console.log(`\n📊 Total de clientes ativos: ${customers.length}\n`)
  
  const problemCustomers: Array<{
    id: string,
    name: string,
    creditLimit: number,
    availableCredit: number,
    expectedCredit: number,
    difference: number,
    boletosPending: number,
    receivablesPending: number
  }> = []
  
  for (const customer of customers) {
    // Buscar boletos pendentes
    const boletosPending = await prisma.boleto.findMany({
      where: { 
        customerId: customer.id,
        status: { in: ['PENDING', 'OVERDUE'] }
      }
    })
    
    // Buscar receivables pendentes
    const receivablesPending = await prisma.receivable.findMany({
      where: { 
        customerId: customer.id,
        status: { in: ['PENDING', 'OVERDUE'] }
      }
    })
    
    // Calcular total pendente (sem duplicar)
    let totalPendente = 0
    
    // Receivables sem boleto
    for (const receivable of receivablesPending) {
      if (!receivable.boletoId) {
        totalPendente += Number(receivable.amount)
      }
    }
    
    // Boletos (já inclui receivables com boleto)
    for (const boleto of boletosPending) {
      totalPendente += Number(boleto.amount)
    }
    
    const creditoEsperado = Number(customer.creditLimit) - totalPendente
    const creditoAtual = Number(customer.availableCredit)
    const diferenca = creditoEsperado - creditoAtual
    
    // Se a diferença for > R$ 1,00, considerar como problema
    if (Math.abs(diferenca) > 1.00) {
      problemCustomers.push({
        id: customer.id,
        name: customer.name,
        creditLimit: Number(customer.creditLimit),
        availableCredit: creditoAtual,
        expectedCredit: creditoEsperado,
        difference: diferenca,
        boletosPending: boletosPending.length,
        receivablesPending: receivablesPending.filter(r => !r.boletoId).length
      })
    }
  }
  
  if (problemCustomers.length === 0) {
    console.log('✅ Todos os clientes estão com crédito CORRETO!\n')
    return
  }
  
  console.log(`❌ ${problemCustomers.length} clientes com PROBLEMAS de crédito:\n`)
  console.log('Cliente | Limite | Atual | Esperado | Diferença | Boletos | Receivables')
  console.log('-'.repeat(100))
  
  for (const customer of problemCustomers) {
    const name = customer.name.substring(0, 25).padEnd(27)
    const limite = `R$ ${customer.creditLimit.toFixed(2)}`.padEnd(10)
    const atual = `R$ ${customer.availableCredit.toFixed(2)}`.padEnd(10)
    const esperado = `R$ ${customer.expectedCredit.toFixed(2)}`.padEnd(10)
    const diferenca = `R$ ${customer.difference.toFixed(2)}`.padEnd(12)
    const boletos = customer.boletosPending.toString().padEnd(8)
    const receivables = customer.receivablesPending.toString()
    
    console.log(`${name} | ${limite} | ${atual} | ${esperado} | ${diferenca} | ${boletos} | ${receivables}`)
  }
  
  console.log('-'.repeat(100))
  console.log(`\nTotal de clientes com problemas: ${problemCustomers.length}`)
  console.log(`Diferença total: R$ ${problemCustomers.reduce((sum, c) => sum + c.difference, 0).toFixed(2)}\n`)
  
  console.log('\n🔧 Para corrigir TODOS os clientes automaticamente, execute:')
  console.log('\ncd /home/ubuntu/espetos_genuino/nextjs_space && yarn tsx scripts/fix-all-customers-credit.ts\n')
}

checkAllCustomersCredit()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
