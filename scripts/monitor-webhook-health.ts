
/**
 * Monitor de Saúde do Webhook Cora
 * 
 * Este script verifica se há boletos pagos que não foram
 * completamente processados pelo webhook.
 * 
 * Execute periodicamente para garantir que tudo está funcionando.
 */

import dotenv from 'dotenv'
dotenv.config()

import { prisma } from '../lib/db'

interface HealthIssue {
  severity: 'ERROR' | 'WARNING'
  type: string
  description: string
  boletoNumber: string
  customerId?: string
}

async function monitorWebhookHealth() {
  console.log('🏥 MONITOR DE SAÚDE - WEBHOOK CORA')
  console.log('═'.repeat(70))
  console.log(`⏰ Verificação: ${new Date().toLocaleString('pt-BR')}\n`)

  const issues: HealthIssue[] = []

  try {
    // 1. Buscar boletos pagos nos últimos 7 dias
    const recentPaidBoletos = await prisma.boleto.findMany({
      where: {
        status: 'PAID',
        paidDate: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
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

    console.log(`📊 Analisando ${recentPaidBoletos.length} boleto(s) pago(s) nos últimos 7 dias...\n`)

    // 2. Verificar cada boleto
    for (const boleto of recentPaidBoletos) {
      // Verificação 1: Boleto tem pedido mas pedido não está pago
      if (boleto.orderId && boleto.Order) {
        if (boleto.Order.paymentStatus !== 'PAID') {
          issues.push({
            severity: 'ERROR',
            type: 'PEDIDO_NAO_ATUALIZADO',
            description: `Boleto pago mas pedido ${boleto.Order.orderNumber} ainda está com status ${boleto.Order.paymentStatus}`,
            boletoNumber: boleto.boletoNumber,
            customerId: boleto.customerId
          })
        }

        // Verificação 2: Receivables não estão pagos
        const receivables = boleto.Order.Receivable || []
        const unpaidReceivables = receivables.filter(r => r.status !== 'PAID')
        
        if (unpaidReceivables.length > 0) {
          issues.push({
            severity: 'ERROR',
            type: 'RECEIVABLES_NAO_ATUALIZADOS',
            description: `Boleto pago mas ${unpaidReceivables.length} receivable(s) ainda estão pendentes`,
            boletoNumber: boleto.boletoNumber,
            customerId: boleto.customerId
          })
        }
      }

      // Verificação 3: Transação bancária não foi criada
      const transaction = await prisma.transaction.findFirst({
        where: {
          referenceId: boleto.id,
          referenceType: 'BOLETO',
          type: 'INCOME'
        }
      })

      if (!transaction) {
        issues.push({
          severity: 'WARNING',
          type: 'TRANSACAO_AUSENTE',
          description: `Boleto pago mas transação bancária não encontrada`,
          boletoNumber: boleto.boletoNumber,
          customerId: boleto.customerId
        })
      }
    }

    // 3. Reportar resultados
    console.log('─'.repeat(70))
    
    if (issues.length === 0) {
      console.log('\n✅ TUDO OK! Nenhum problema encontrado.')
      console.log('📌 Webhook está funcionando perfeitamente.\n')
    } else {
      console.log('\n⚠️  PROBLEMAS DETECTADOS:\n')
      
      const errors = issues.filter(i => i.severity === 'ERROR')
      const warnings = issues.filter(i => i.severity === 'WARNING')
      
      if (errors.length > 0) {
        console.log('❌ ERROS CRÍTICOS:')
        errors.forEach((issue, index) => {
          console.log(`\n${index + 1}. ${issue.type}`)
          console.log(`   Boleto: ${issue.boletoNumber}`)
          console.log(`   Descrição: ${issue.description}`)
        })
      }
      
      if (warnings.length > 0) {
        console.log('\n⚠️  AVISOS:')
        warnings.forEach((issue, index) => {
          console.log(`\n${index + 1}. ${issue.type}`)
          console.log(`   Boleto: ${issue.boletoNumber}`)
          console.log(`   Descrição: ${issue.description}`)
        })
      }

      console.log('\n📋 RESUMO:')
      console.log(`   ❌ Erros críticos: ${errors.length}`)
      console.log(`   ⚠️  Avisos: ${warnings.length}`)
      console.log(`   📊 Total de problemas: ${issues.length}`)
      
      if (errors.length > 0) {
        console.log('\n🔧 AÇÃO NECESSÁRIA:')
        console.log('   Execute o script de correção manual:')
        console.log('   npx tsx scripts/fix-incomplete-webhook-processing.ts')
      }
    }

    console.log('\n' + '═'.repeat(70))
    console.log(`⏰ Próxima verificação recomendada: ${new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleString('pt-BR')}`)
    console.log()

  } catch (error) {
    console.error('\n❌ Erro ao executar monitoramento:', error)
  } finally {
    await prisma.$disconnect()
  }
}

monitorWebhookHealth()
