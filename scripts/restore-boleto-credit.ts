/**
 * Script para restaurar crédito de clientes que tiveram boletos marcados como pagos
 * mas não receberam o crédito de volta
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function restoreBoletoCredit() {
  console.log('🔍 Buscando receivables PAID com boleto vinculado...')
  
  // Buscar todos os receivables que foram marcados como PAID e têm boleto vinculado
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

  console.log(`✅ Encontrados ${receivablesWithBoleto.length} receivables com boleto vinculado`)

  // Agrupar por cliente
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

  console.log(`\n📊 Total de clientes potencialmente afetados: ${clientesAfetados.size}`)
  console.log('\n' + '='.repeat(80))

  // Analisar cada cliente
  const clientesParaCorrigir: Array<{
    customerId: string,
    customerName: string,
    creditoAtual: number,
    limite: number,
    valorParaRestaurar: number,
    novoCreditoCalculado: number,
    receivablesCount: number
  }> = []

  for (const [customerId, data] of clientesAfetados) {
    const creditoAtual = Number(data.customer.availableCredit)
    const limite = Number(data.customer.creditLimit)
    const valorParaRestaurar = data.totalValue
    const novoCreditoCalculado = Math.min(creditoAtual + valorParaRestaurar, limite)

    console.log(`\n👤 Cliente: ${data.customer.name}`)
    console.log(`   ID: ${customerId}`)
    console.log(`   💰 Crédito Atual: R$ ${creditoAtual.toFixed(2)}`)
    console.log(`   📊 Limite: R$ ${limite.toFixed(2)}`)
    console.log(`   📋 Receivables PAID com boleto: ${data.receivables.length}`)
    console.log(`   💵 Valor total dos receivables: R$ ${valorParaRestaurar.toFixed(2)}`)
    console.log(`   ✨ Novo crédito (se restaurado): R$ ${novoCreditoCalculado.toFixed(2)}`)

    // Verificar se o crédito está "faltando"
    // Se o crédito atual + valor dos receivables <= limite, então pode estar faltando crédito
    const creditoEsperado = creditoAtual + valorParaRestaurar
    if (creditoEsperado <= limite) {
      console.log(`   ⚠️ POSSÍVEL PROBLEMA: Crédito pode estar faltando!`)
      clientesParaCorrigir.push({
        customerId,
        customerName: data.customer.name,
        creditoAtual,
        limite,
        valorParaRestaurar,
        novoCreditoCalculado,
        receivablesCount: data.receivables.length
      })
    } else {
      console.log(`   ✅ OK: Crédito parece estar correto (já no limite)`)
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log(`\n📝 RESUMO: ${clientesParaCorrigir.length} clientes precisam de correção\n`)

  if (clientesParaCorrigir.length === 0) {
    console.log('✅ Nenhum cliente precisa de correção!\n')
    return
  }

  // Mostrar clientes que precisam de correção
  console.log('\n🔧 CLIENTES QUE PRECISAM DE CORREÇÃO:\n')
  for (const cliente of clientesParaCorrigir) {
    console.log(`   • ${cliente.customerName}`)
    console.log(`     - Crédito atual: R$ ${cliente.creditoAtual.toFixed(2)}`)
    console.log(`     - Valor a restaurar: R$ ${cliente.valorParaRestaurar.toFixed(2)}`)
    console.log(`     - Novo crédito: R$ ${cliente.novoCreditoCalculado.toFixed(2)}`)
    console.log(`     - Receivables: ${cliente.receivablesCount}`)
    console.log()
  }

  console.log('\n⚠️  PARA APLICAR A CORREÇÃO, execute:')
  console.log('\ncd /home/ubuntu/espetos_genuino/nextjs_space && yarn tsx scripts/restore-boleto-credit-apply.ts\n')
}

restoreBoletoCredit()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
