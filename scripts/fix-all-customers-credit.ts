/**
 * Script para corrigir o crédito de TODOS os clientes
 * Recalcula o crédito baseado no limite e dívidas pendentes
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

async function fixAllCustomersCredit() {
  console.log('🔧 CORREÇÃO GLOBAL DE CRÉDITO')
  console.log('='.repeat(80))
  
  // Buscar todos os clientes ativos
  const customers = await prisma.customer.findMany({
    where: {
      isActive: true
    },
    orderBy: { name: 'asc' }
  })
  
  console.log(`\n📊 Total de clientes ativos: ${customers.length}\n`)
  
  const updates: Array<{
    id: string,
    name: string,
    oldCredit: number,
    newCredit: number,
    difference: number
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
    
    const creditoCorreto = Number(customer.creditLimit) - totalPendente
    const creditoAtual = Number(customer.availableCredit)
    const diferenca = creditoCorreto - creditoAtual
    
    // Se a diferença for > R$ 1,00, adicionar à lista de atualizações
    if (Math.abs(diferenca) > 1.00) {
      updates.push({
        id: customer.id,
        name: customer.name,
        oldCredit: creditoAtual,
        newCredit: creditoCorreto,
        difference: diferenca
      })
    }
  }
  
  if (updates.length === 0) {
    console.log('✅ Todos os clientes já estão com crédito CORRETO!\n')
    return
  }
  
  console.log(`🔧 ${updates.length} clientes precisam de correção:\n`)
  console.log('Cliente | Crédito Atual | Crédito Correto | Diferença')
  console.log('-'.repeat(80))
  
  for (const update of updates) {
    const name = update.name.substring(0, 25).padEnd(27)
    const oldCredit = `R$ ${update.oldCredit.toFixed(2)}`.padEnd(15)
    const newCredit = `R$ ${update.newCredit.toFixed(2)}`.padEnd(17)
    const diff = `R$ ${update.difference.toFixed(2)}`
    
    console.log(`${name} | ${oldCredit} | ${newCredit} | ${diff}`)
  }
  
  console.log('-'.repeat(80))
  console.log(`\nTotal de clientes: ${updates.length}`)
  console.log(`Soma das diferenças: R$ ${updates.reduce((sum, u) => sum + u.difference, 0).toFixed(2)}\n`)
  
  console.log('='.repeat(80))
  console.log('\n⚠️  ATENÇÃO: Esta operação irá CORRIGIR o crédito de TODOS os clientes acima!\n')
  
  const answer = await askQuestion('Deseja continuar? (Digite "SIM" para confirmar): ')
  
  if (answer.trim().toUpperCase() !== 'SIM') {
    console.log('\n❌ Operação cancelada pelo usuário.\n')
    return
  }
  
  console.log('\n🔧 Aplicando correções...\n')
  
  let sucessos = 0
  let erros = 0
  
  for (const update of updates) {
    try {
      await prisma.customer.update({
        where: { id: update.id },
        data: {
          availableCredit: update.newCredit
        }
      })
      
      console.log(`✅ ${update.name.substring(0, 30)}: R$ ${update.oldCredit.toFixed(2)} → R$ ${update.newCredit.toFixed(2)}`)
      sucessos++
    } catch (error: any) {
      console.log(`❌ ${update.name.substring(0, 30)}: ERRO - ${error.message}`)
      erros++
    }
  }
  
  console.log('\n' + '='.repeat(80))
  console.log(`\n🎯 RESULTADO FINAL:`)
  console.log(`   ✅ Sucessos: ${sucessos}`)
  console.log(`   ❌ Erros: ${erros}`)
  console.log(`   📄 Total: ${updates.length}\n`)
}

fixAllCustomersCredit()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
