/**
 * Script para investigar o problema de crédito do cliente Marcivan
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function investigateMarcivan() {
  console.log('🔍 INVESTIGANDO CLIENTE MARCIVAN')
  console.log('='.repeat(80))
  
  // 1. Buscar dados do cliente
  const customer = await prisma.customer.findFirst({
    where: {
      name: {
        contains: 'Marcivan',
        mode: 'insensitive'
      }
    }
  })
  
  if (!customer) {
    console.log('❌ Cliente Marcivan não encontrado!')
    return
  }
  
  console.log('\n📊 DADOS DO CLIENTE:')
  console.log(`   ID: ${customer.id}`)
  console.log(`   Nome: ${customer.name}`)
  console.log(`   💰 Limite de Crédito: R$ ${Number(customer.creditLimit).toFixed(2)}`)
  console.log(`   💳 Crédito Disponível: R$ ${Number(customer.availableCredit).toFixed(2)}`)
  console.log(`   🔒 Bloqueado: ${customer.isBlocked ? 'SIM' : 'NÃO'}`)
  console.log(`   🔓 Liberado Manualmente: ${customer.manuallyUnblocked ? 'SIM' : 'NÃO'}`)
  
  // 2. Buscar TODOS os boletos
  const boletos = await prisma.boleto.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: 'desc' }
  })
  
  console.log(`\n📋 BOLETOS (Total: ${boletos.length}):`)
  console.log('   Status | Número | Valor | Data Vencimento | Data Pagamento')
  console.log('   ' + '-'.repeat(70))
  
  let boletosPendingTotal = 0
  let boletosPaidTotal = 0
  
  for (const boleto of boletos) {
    const status = boleto.status.padEnd(10)
    const numero = boleto.boletoNumber?.padEnd(15) || 'N/A'.padEnd(15)
    const valor = `R$ ${Number(boleto.amount).toFixed(2)}`.padEnd(12)
    const vencimento = boleto.dueDate.toISOString().split('T')[0]
    const pagamento = boleto.paidDate ? boleto.paidDate.toISOString().split('T')[0] : 'N/A'
    
    console.log(`   ${status} | ${numero} | ${valor} | ${vencimento} | ${pagamento}`)
    
    if (boleto.status === 'PENDING' || boleto.status === 'OVERDUE') {
      boletosPendingTotal += Number(boleto.amount)
    } else if (boleto.status === 'PAID') {
      boletosPaidTotal += Number(boleto.amount)
    }
  }
  
  console.log('   ' + '-'.repeat(70))
  console.log(`   💵 Total PENDING/OVERDUE: R$ ${boletosPendingTotal.toFixed(2)}`)
  console.log(`   ✅ Total PAID: R$ ${boletosPaidTotal.toFixed(2)}`)
  
  // 3. Buscar TODOS os receivables
  const receivables = await prisma.receivable.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: 'desc' }
  })
  
  console.log(`\n💰 RECEIVABLES (Total: ${receivables.length}):`)
  console.log('   Status | Descrição | Valor | Data Vencimento | Boleto ID')
  console.log('   ' + '-'.repeat(80))
  
  let receivablesPendingTotal = 0
  let receivablesPaidTotal = 0
  
  for (const receivable of receivables) {
    const status = receivable.status.padEnd(10)
    const desc = receivable.description.substring(0, 30).padEnd(32)
    const valor = `R$ ${Number(receivable.amount).toFixed(2)}`.padEnd(12)
    const vencimento = receivable.dueDate.toISOString().split('T')[0]
    const boletoId = receivable.boletoId ? 'SIM' : 'NÃO'
    
    console.log(`   ${status} | ${desc} | ${valor} | ${vencimento} | ${boletoId}`)
    
    if (receivable.status === 'PENDING' || receivable.status === 'OVERDUE') {
      receivablesPendingTotal += Number(receivable.amount)
    } else if (receivable.status === 'PAID') {
      receivablesPaidTotal += Number(receivable.amount)
    }
  }
  
  console.log('   ' + '-'.repeat(80))
  console.log(`   💵 Total PENDING/OVERDUE: R$ ${receivablesPendingTotal.toFixed(2)}`)
  console.log(`   ✅ Total PAID: R$ ${receivablesPaidTotal.toFixed(2)}`)
  
  // 4. Buscar pedidos recentes
  const orders = await prisma.order.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: 'desc' },
    take: 10
  })
  
  console.log(`\n📦 PEDIDOS RECENTES (Últimos 10):`)
  console.log('   Número | Total | Status Pagamento | Data Criação')
  console.log('   ' + '-'.repeat(60))
  
  for (const order of orders) {
    const numero = order.orderNumber.padEnd(12)
    const total = `R$ ${Number(order.totalAmount).toFixed(2)}`.padEnd(12)
    const paymentStatus = order.paymentStatus.padEnd(10)
    const data = order.createdAt.toISOString().split('T')[0]
    
    console.log(`   ${numero} | ${total} | ${paymentStatus} | ${data}`)
  }
  
  // 5. CÁLCULO DO CRÉDITO ESPERADO
  console.log('\n' + '='.repeat(80))
  console.log('\n🧮 CÁLCULO DO CRÉDITO ESPERADO:')
  console.log(`   Limite de Crédito: R$ ${Number(customer.creditLimit).toFixed(2)}`)
  console.log(`   (-) Boletos Pendentes: R$ ${boletosPendingTotal.toFixed(2)}`)
  console.log(`   (-) Receivables Pendentes: R$ ${receivablesPendingTotal.toFixed(2)}`)
  console.log('   ' + '-'.repeat(60))
  
  const creditoEsperado = Number(customer.creditLimit) - boletosPendingTotal - receivablesPendingTotal
  console.log(`   = Crédito Esperado: R$ ${creditoEsperado.toFixed(2)}`)
  console.log(`   💳 Crédito Atual no Sistema: R$ ${Number(customer.availableCredit).toFixed(2)}`)
  console.log(`   ❌ DIFERENÇA: R$ ${(creditoEsperado - Number(customer.availableCredit)).toFixed(2)}`)
  
  // 6. ANÁLISE DE DISCREPÂNCIA
  console.log('\n' + '='.repeat(80))
  console.log('\n⚠️  ANÁLISE DE DISCREPÂNCIA:')
  
  const diferenca = creditoEsperado - Number(customer.availableCredit)
  
  if (Math.abs(diferenca) < 0.01) {
    console.log('   ✅ Crédito está CORRETO!')
  } else if (diferenca > 0) {
    console.log(`   ❌ Cliente está com MENOS crédito do que deveria ter!`)
    console.log(`   ❌ Faltam R$ ${diferenca.toFixed(2)} no crédito disponível`)
  } else {
    console.log(`   ⚠️  Cliente está com MAIS crédito do que deveria ter!`)
    console.log(`   ⚠️  Sobraram R$ ${Math.abs(diferenca).toFixed(2)} no crédito disponível`)
  }
  
  console.log('\n' + '='.repeat(80))
}

investigateMarcivan()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
