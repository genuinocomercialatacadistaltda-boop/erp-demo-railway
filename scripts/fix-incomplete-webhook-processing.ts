
/**
 * Script de Correção Automática
 * 
 * Corrige boletos pagos que não foram completamente processados
 * pelo webhook (casos raros de falha).
 */

import dotenv from 'dotenv'
dotenv.config()

import { prisma } from '../lib/db'

async function fixIncompleteProcessing() {
  console.log('🔧 CORREÇÃO AUTOMÁTICA - WEBHOOK INCOMPLETO')
  console.log('═'.repeat(70))
  console.log(`⏰ Início: ${new Date().toLocaleString('pt-BR')}\n`)

  try {
    // 1. Buscar boletos pagos com problemas
    const problematicBoletos = await prisma.boleto.findMany({
      where: {
        status: 'PAID',
        Order: {
          paymentStatus: {
            not: 'PAID'
          }
        }
      },
      include: {
        Customer: true,
        Order: {
          include: {
            Receivable: true
          }
        }
      }
    })

    console.log(`📊 Encontrados ${problematicBoletos.length} boleto(s) com processamento incompleto\n`)

    if (problematicBoletos.length === 0) {
      console.log('✅ Nenhum problema encontrado!')
      console.log('📌 Todos os boletos pagos foram processados corretamente.\n')
      return
    }

    // 2. Corrigir cada boleto
    for (const boleto of problematicBoletos) {
      console.log(`\n${'─'.repeat(70)}`)
      console.log(`🔧 Corrigindo boleto: ${boleto.boletoNumber}`)
      console.log(`   Cliente: ${boleto.Customer.name}`)
      console.log(`   Valor: R$ ${boleto.amount.toFixed(2)}`)

      if (!boleto.Order) {
        console.log('   ℹ️  Boleto sem pedido, pulando...')
        continue
      }

      const operations: any[] = []

      // Atualizar pedido
      if (boleto.Order.paymentStatus !== 'PAID') {
        console.log('   📝 Atualizando status do pedido...')
        operations.push(
          prisma.order.update({
            where: { id: boleto.Order.id },
            data: {
              paymentStatus: 'PAID',
              updatedAt: new Date()
            }
          })
        )
      }

      // Atualizar receivables
      const unpaidReceivables = boleto.Order.Receivable?.filter(r => r.status !== 'PAID') || []
      
      if (unpaidReceivables.length > 0) {
        console.log(`   💵 Atualizando ${unpaidReceivables.length} receivable(s)...`)
        for (const receivable of unpaidReceivables) {
          operations.push(
            prisma.receivable.update({
              where: { id: receivable.id },
              data: {
                status: 'PAID',
                paymentDate: boleto.paidDate || new Date(),
                updatedAt: new Date()
              }
            })
          )
        }
      }

      // Executar correções
      if (operations.length > 0) {
        await prisma.$transaction(operations)
        console.log('   ✅ Correções aplicadas com sucesso!')
      } else {
        console.log('   ℹ️  Nenhuma correção necessária')
      }
    }

    console.log(`\n${'═'.repeat(70)}`)
    console.log('\n✅ CORREÇÃO CONCLUÍDA!')
    console.log(`📊 ${problematicBoletos.length} boleto(s) corrigido(s)`)
    console.log()

  } catch (error) {
    console.error('\n❌ Erro ao executar correção:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixIncompleteProcessing()
