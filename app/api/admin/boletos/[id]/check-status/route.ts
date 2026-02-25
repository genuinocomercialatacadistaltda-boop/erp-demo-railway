
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { getPixCharge } from '@/lib/cora'

export const dynamic = 'force-dynamic'

/**
 * ⚠️ MODO SOMENTE CONSULTA - SEM PROCESSAMENTO AUTOMÁTICO
 * 
 * Verifica o status de um boleto específico no Cora
 * mas NÃO faz nenhuma atualização automática.
 * 
 * A secretária do financeiro deve:
 * 1. Ver o status do boleto no Cora
 * 2. Se pago, dar entrada MANUALMENTE no recebível
 * 3. Vincular à conta bancária correta
 * 
 * Endpoint: GET /api/admin/boletos/[id]/check-status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = params

    // Buscar o boleto
    const boleto = await prisma.boleto.findUnique({
      where: { id },
      include: {
        Customer: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    if (!boleto) {
      return NextResponse.json({ error: 'Boleto não encontrado' }, { status: 404 })
    }

    // Se não tem pixPaymentId, não pode verificar
    if (!boleto.pixPaymentId) {
      return NextResponse.json({ 
        error: 'Boleto não tem ID de pagamento associado',
        message: 'Este boleto não foi gerado via Cora'
      }, { status: 400 })
    }

    console.log('🔍 [MODO CONSULTA] Verificando status do boleto no Cora:', boleto.boletoNumber)

    // Consultar status no Cora - APENAS CONSULTA
    const coraCharge = await getPixCharge(boleto.pixPaymentId)

    console.log('📊 Status retornado pelo Cora:', coraCharge.status)
    console.log('📊 Status atual no Sistema:', boleto.status)

    // Determinar se precisa de ação manual
    let acaoNecessaria = ''
    
    if (coraCharge.status === 'PAID' && boleto.status !== 'PAID') {
      acaoNecessaria = '⚠️ BOLETO PAGO NO CORA! Dar entrada MANUAL no financeiro.'
      console.log('💰 BOLETO FOI PAGO NO CORA!')
      console.log(`   Cliente: ${boleto.Customer.name}`)
      console.log(`   Valor: R$ ${Number(boleto.amount).toFixed(2)}`)
      console.log('   ⚠️ AÇÃO NECESSÁRIA: Dar entrada manual no recebível!')
      console.log('   ⚠️ NENHUMA ATUALIZAÇÃO AUTOMÁTICA FOI FEITA!')
    } else if (coraCharge.status === 'CANCELLED' && boleto.status !== 'CANCELLED') {
      acaoNecessaria = '🚫 BOLETO CANCELADO NO CORA! Atualizar status manualmente se necessário.'
      console.log('🚫 BOLETO FOI CANCELADO NO CORA!')
    }

    return NextResponse.json({
      success: true,
      mode: 'CONSULTA_APENAS',
      boleto: {
        id: boleto.id,
        boletoNumber: boleto.boletoNumber,
        statusSistema: boleto.status,
        statusCora: coraCharge.status,
        amount: Number(boleto.amount),
        customerName: boleto.Customer.name
      },
      acaoNecessaria: acaoNecessaria || 'Nenhuma ação necessária. Status já está sincronizado.',
      aviso: '⚠️ NENHUMA ATUALIZAÇÃO AUTOMÁTICA FOI FEITA. Se o boleto foi pago, processar manualmente no financeiro.'
    })

  } catch (error) {
    console.error('❌ Erro ao verificar status do boleto:', error)
    return NextResponse.json(
      { 
        error: 'Erro ao verificar status',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}
