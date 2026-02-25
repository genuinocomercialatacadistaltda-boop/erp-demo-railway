/**
 * Script para corrigir o crédito do cliente Marcivan
 */

import { PrismaClient } from '@prisma/client'
import * as readline from 'readline'

const prisma = new PrismaClient()

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise(resolve => rl.question(query, ans => {
    rl.close()
    resolve(ans)
  }))
}

async function fixMarcivanCredit() {
  console.log('🔧 CORREÇÃO DE CRÉDITO - CLIENTE MARCIVAN')
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
  
  console.log('\n📊 DADOS ATUAIS:')
  console.log(`   ID: ${customer.id}`)
  console.log(`   Nome: ${customer.name}`)
  console.log(`   💰 Limite de Crédito: R$ ${Number(customer.creditLimit).toFixed(2)}`)
  console.log(`   💳 Crédito Disponível ATUAL: R$ ${Number(customer.availableCredit).toFixed(2)}`)
  
  // 2. Buscar boletos e receivables pendentes
  const boletosPending = await prisma.boleto.findMany({
    where: { 
      customerId: customer.id,
      status: { in: ['PENDING', 'OVERDUE'] }
    }
  })
  
  const receivablesPending = await prisma.receivable.findMany({
    where: { 
      customerId: customer.id,
      status: { in: ['PENDING', 'OVERDUE'] }
    }
  })
  
  // 3. Calcular total pendente (sem duplicar boletos vinculados)
  let totalPendente = 0
  
  // Adicionar receivables sem boleto
  for (const receivable of receivablesPending) {
    if (!receivable.boletoId) {
      totalPendente += Number(receivable.amount)
    }
  }
  
  // Adicionar boletos (isso já inclui os receivables com boleto)
  for (const boleto of boletosPending) {
    totalPendente += Number(boleto.amount)
  }
  
  const creditoCorreto = Number(customer.creditLimit) - totalPendente
  
  console.log('\n🧮 CÁLCULO DO CRÉDITO CORRETO:')
  console.log(`   Limite de Crédito: R$ ${Number(customer.creditLimit).toFixed(2)}`)
  console.log(`   (-) Boletos Pendentes: ${boletosPending.length} = R$ ${boletosPending.reduce((sum, b) => sum + Number(b.amount), 0).toFixed(2)}`)
  console.log(`   (-) Receivables Pendentes (sem boleto): ${receivablesPending.filter(r => !r.boletoId).length} = R$ ${receivablesPending.filter(r => !r.boletoId).reduce((sum, r) => sum + Number(r.amount), 0).toFixed(2)}`)
  console.log('   ' + '-'.repeat(60))
  console.log(`   = Crédito CORRETO: R$ ${creditoCorreto.toFixed(2)}`)
  console.log(`   💳 Crédito ATUAL no sistema: R$ ${Number(customer.availableCredit).toFixed(2)}`)
  console.log(`   ❌ DIFERENÇA: R$ ${(creditoCorreto - Number(customer.availableCredit)).toFixed(2)}`)
  
  console.log('\n' + '='.repeat(80))
  console.log('\n⚠️  ATENÇÃO: Esta operação irá CORRIGIR o crédito do cliente!')
  console.log(`\nCrédito será atualizado de R$ ${Number(customer.availableCredit).toFixed(2)} para R$ ${creditoCorreto.toFixed(2)}\n`)
  
  const answer = await askQuestion('Deseja continuar? (Digite "SIM" para confirmar): ')
  
  if (answer.trim().toUpperCase() !== 'SIM') {
    console.log('\n❌ Operação cancelada pelo usuário.\n')
    return
  }
  
  // 4. Atualizar crédito
  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      availableCredit: creditoCorreto
    }
  })
  
  console.log('\n✅ Crédito atualizado com sucesso!')
  console.log(`   Novo crédito disponível: R$ ${creditoCorreto.toFixed(2)}`)
  console.log('\n' + '='.repeat(80))
}

fixMarcivanCredit()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
