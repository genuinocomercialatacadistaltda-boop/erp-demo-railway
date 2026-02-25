
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { getPixCharge } from '@/lib/cora'

/**
 * ⚠️ MODO SOMENTE CONSULTA - SEM PROCESSAMENTO AUTOMÁTICO
 * 
 * Verifica o status de TODOS os boletos pendentes no CORA
 * mas NÃO faz nenhuma atualização automática.
 * 
 * A secretária do financeiro deve:
 * 1. Ver quais boletos foram pagos
 * 2. Dar entrada MANUALMENTE no recebível
 * 3. Vincular à conta bancária correta
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!user || user.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    // Busca TODOS os boletos pendentes no sistema que têm pixPaymentId
    const boletosPendentes = await prisma.boleto.findMany({
      where: {
        status: 'PENDING',
        pixPaymentId: {
          not: null
        }
      },
      include: {
        Customer: true
      }
    })

    console.log(`🔍 [MODO CONSULTA] Verificando ${boletosPendentes.length} boleto(s) pendente(s)...`)

    const boletosParaProcessarManualmente: Array<{
      boletoNumber: string
      customerName: string
      amount: number
      statusCora: string
    }> = []
    
    let boletosVerificados = 0
    let erros = 0

    // Verifica cada boleto pendente - APENAS CONSULTA, SEM ATUALIZAÇÃO
    for (const boleto of boletosPendentes) {
      try {
        boletosVerificados++

        // Consulta o status do boleto no CORA
        const statusCora = await getPixCharge(boleto.pixPaymentId!)

        console.log(`📋 Boleto ${boleto.boletoNumber}:`)
        console.log(`   Cliente: ${boleto.Customer.name}`)
        console.log(`   Valor: R$ ${Number(boleto.amount).toFixed(2)}`)
        console.log(`   Status no Cora: ${statusCora.status}`)
        console.log(`   Status no Sistema: ${boleto.status}`)

        if (statusCora.status === 'PAID') {
          console.log(`   ⚠️ AÇÃO NECESSÁRIA: Dar entrada manual no financeiro!`)
          boletosParaProcessarManualmente.push({
            boletoNumber: boleto.boletoNumber,
            customerName: boleto.Customer.name,
            amount: Number(boleto.amount),
            statusCora: statusCora.status
          })
        }
      } catch (error) {
        console.error(`❌ Erro ao verificar boleto ${boleto.id}:`, error)
        erros++
      }
    }

    console.log(`
    📊 Relatório da Verificação (MODO CONSULTA):
    - Boletos pendentes no sistema: ${boletosPendentes.length}
    - Boletos verificados no Cora: ${boletosVerificados}
    - Boletos PAGOS no Cora (processar manualmente): ${boletosParaProcessarManualmente.length}
    - Erros: ${erros}
    
    ⚠️ NENHUMA ATUALIZAÇÃO AUTOMÁTICA FOI FEITA!
    A secretária deve processar os boletos pagos MANUALMENTE.
    `)

    return NextResponse.json({
      success: true,
      mode: 'CONSULTA_APENAS',
      totalPendentes: boletosPendentes.length,
      boletosVerificados,
      boletosParaProcessarManualmente: boletosParaProcessarManualmente.length,
      detalhes: boletosParaProcessarManualmente,
      erros,
      message: boletosParaProcessarManualmente.length > 0 
        ? `${boletosParaProcessarManualmente.length} boleto(s) pago(s) encontrado(s). PROCESSAR MANUALMENTE!`
        : 'Nenhum boleto pago encontrado no Cora.',
      aviso: '⚠️ NENHUMA ATUALIZAÇÃO AUTOMÁTICA FOI FEITA. Processar manualmente no financeiro.'
    })

  } catch (error) {
    console.error('Erro ao verificar boletos pendentes:', error)
    return NextResponse.json(
      { 
        error: 'Erro ao verificar boletos pendentes',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}
