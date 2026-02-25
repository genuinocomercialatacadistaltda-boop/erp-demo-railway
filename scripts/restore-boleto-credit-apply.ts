/**
 * Script para APLICAR a restauração de crédito dos clientes afetados
 * ATENÇÃO: Este script FAZ ALTERAÇÕES NO BANCO DE DADOS!
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

async function applyBoletoCredit() {
  console.log('⚠️  ATENÇÃO: Este script fará alterações no banco de dados!')
  console.log('⚠️  Certifique-se de que revisou o relatório antes de continuar.\n')

  const answer = await askQuestion('Deseja continuar? (Digite "SIM" para confirmar): ')
  
  if (answer.trim().toUpperCase() !== 'SIM') {
    console.log('\n❌ Operação cancelada pelo usuário.\n')
    return
  }

  console.log('\n🔍 Buscando receivables PAID com boleto vinculado...')
  
  const receivablesWithBoleto = await prisma.receivable.findMany({
    where: {
      status: 'PAID',
      boletoId: { not: null },
      customerId: { not: null }
    },
    include: {
      Boleto: true,
      Customer: {
        select: {
          id: true,
          name: true,
          availableCredit: true,
          creditLimit: true
        }
      }
    }
  })

  const clientesAfetados = new Map<string, {
    customer: any,
    receivables: any[],
    totalValue: number
  }>()

  for (const receivable of receivablesWithBoleto) {
    if (!receivable.Customer) continue

    const customerId = receivable.customerId!
    if (!clientesAfetados.has(customerId)) {
      clientesAfetados.set(customerId, {
        customer: receivable.Customer,
        receivables: [],
        totalValue: 0
      })
    }

    const data = clientesAfetados.get(customerId)!
    data.receivables.push(receivable)
    data.totalValue += Number(receivable.amount)
  }

  const clientesParaCorrigir: Array<{
    customerId: string,
    customerName: string,
    creditoAtual: number,
    limite: number,
    valorParaRestaurar: number,
    novoCreditoCalculado: number
  }> = []

  for (const [customerId, data] of clientesAfetados) {
    const creditoAtual = Number(data.customer.availableCredit)
    const limite = Number(data.customer.creditLimit)
    const valorParaRestaurar = data.totalValue
    const novoCreditoCalculado = Math.min(creditoAtual + valorParaRestaurar, limite)

    const creditoEsperado = creditoAtual + valorParaRestaurar
    if (creditoEsperado <= limite) {
      clientesParaCorrigir.push({
        customerId,
        customerName: data.customer.name,
        creditoAtual,
        limite,
        valorParaRestaurar,
        novoCreditoCalculado
      })
    }
  }

  if (clientesParaCorrigir.length === 0) {
    console.log('\n✅ Nenhum cliente precisa de correção!\n')
    return
  }

  console.log(`\n🔧 Aplicando correção em ${clientesParaCorrigir.length} clientes...\n`)

  let sucessos = 0
  let erros = 0

  for (const cliente of clientesParaCorrigir) {
    try {
      console.log(`👤 Atualizando ${cliente.customerName}...`)
      console.log(`   Crédito: R$ ${cliente.creditoAtual.toFixed(2)} → R$ ${cliente.novoCreditoCalculado.toFixed(2)}`)

      await prisma.customer.update({
        where: { id: cliente.customerId },
        data: {
          availableCredit: cliente.novoCreditoCalculado
        }
      })

      console.log(`   ✅ Sucesso!\n`)
      sucessos++
    } catch (error: any) {
      console.log(`   ❌ Erro: ${error.message}\n`)
      erros++
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log(`\n🎯 RESULTADO FINAL:`)
  console.log(`   ✅ Sucessos: ${sucessos}`)
  console.log(`   ❌ Erros: ${erros}`)
  console.log(`   📄 Total: ${clientesParaCorrigir.length}\n`)
}

applyBoletoCredit()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
