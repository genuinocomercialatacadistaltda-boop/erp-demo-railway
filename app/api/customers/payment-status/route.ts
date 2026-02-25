
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

// 🔧 FUNÇÃO DE TIMEZONE - Calcula o início do dia ATUAL em Brasília (00:00 Brasília = 03:00 UTC)
function getBrasiliaToday(): Date {
  const now = new Date()
  // Brasília está em UTC-3
  const brasiliaTime = new Date(now.getTime() - (3 * 60 * 60 * 1000))
  
  // Pega ano, mês, dia em Brasília
  const year = brasiliaTime.getUTCFullYear()
  const month = brasiliaTime.getUTCMonth()
  const day = brasiliaTime.getUTCDate()
  
  // Cria data UTC para 00:00 do DIA ATUAL de Brasília
  // Exemplo: se hoje é 24/11 em Brasília, retorna 24/11 00:00 Brasília (03:00 UTC)
  const todayStart = new Date(Date.UTC(year, month, day, 0, 0, 0, 0))
  return todayStart
}

export async function GET(request: NextRequest) {
  try {
    console.log('🚨🚨🚨 [PAYMENT-STATUS API v5.0 - BUILD 1768351200] 🚨🚨🚨')
    
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    // Pegar customerId da URL ou do usuário logado
    const { searchParams } = new URL(request.url)
    const customerIdParam = searchParams.get('customerId')
    
    let customerId: string | null = null
    
    // Se é um CUSTOMER, usar o customerId dele
    if (user?.userType === 'CUSTOMER' && user?.customerId) {
      customerId = user.customerId
    }
    // Se é SELLER ou ADMIN e passou customerId, usar esse
    else if ((user?.userType === 'SELLER' || user?.userType === 'ADMIN') && customerIdParam) {
      customerId = customerIdParam
    }

    if (!customerId) {
      return NextResponse.json(
        { error: 'Cliente não identificado' },
        { status: 400 }
      )
    }

    // Buscar informações do cliente incluindo status de liberação manual
    const customer = await prisma.customer.findUnique({
      where: { id: customerId }
    })

    // 🔧 CORREÇÃO DE TIMEZONE: Usa início do dia ATUAL de Brasília
    // Só é considerado vencido se dueDate < início de hoje (ou seja, de ontem ou antes)
    const brasiliaToday = getBrasiliaToday()
    console.log('[PAYMENT_STATUS] Verificando pagamentos vencidos para cliente:', customerId)
    console.log('[PAYMENT_STATUS] Data de referência (início de hoje em Brasília):', brasiliaToday.toISOString())
    
    // 🔧 Verificar boletos vencidos (APENAS PENDING ou OVERDUE - excluindo PAID e CANCELLED)
    const overdueBoletos = await prisma.boleto.findMany({
      where: {
        customerId,
        status: {
          in: ['PENDING', 'OVERDUE']  // ✅ CORRETO: Ignora PAID e CANCELLED
        },
        dueDate: {
          lt: brasiliaToday  // ✅ Só considera vencido se for de ONTEM ou antes
        }
      },
      orderBy: {
        dueDate: 'asc'
      }
    })

    console.log(`[PAYMENT_STATUS] Boletos vencidos (não pagos) encontrados: ${overdueBoletos.length}`)
    overdueBoletos.forEach((bol: any) => {
      console.log(`[PAYMENT_STATUS] - Boleto ${bol.boletoNumber}: vencimento=${bol.dueDate.toISOString()}, status=${bol.status}, valor=${bol.amount}`)
    })
    
    // 🔧 Verificar receivables (contas a receber) pendentes e vencidos (PENDING ou OVERDUE - excluindo PAID e CANCELLED)
    // ⚠️ IMPORTANTE: Ignorar receivables que têm boletoId para evitar duplicidade (já contados via boletos)
    const overdueReceivables = await prisma.receivable.findMany({
      where: {
        customerId,
        boletoId: null,  // ✅ NOVO: Ignora receivables vinculados a boletos para evitar duplicidade
        status: {
          in: ['PENDING', 'OVERDUE']  // ✅ CORRETO: Inclui PENDING e OVERDUE, ignora PAID e CANCELLED
        },
        dueDate: {
          lt: brasiliaToday  // ✅ Só considera vencido se for de ONTEM ou antes
        }
      },
      orderBy: {
        dueDate: 'asc'
      }
    })

    console.log(`[PAYMENT_STATUS] Receivables vencidos (não pagos) encontrados: ${overdueReceivables.length}`)
    overdueReceivables.forEach((rec: any) => {
      console.log(`[PAYMENT_STATUS] - Receivable ${rec.description}: vencimento=${rec.dueDate.toISOString()}, valor=${rec.amount}`)
    })

    const hasOverdueBoletos = overdueBoletos.length > 0
    const hasOverdueReceivables = overdueReceivables.length > 0
    const hasAnyOverdue = hasOverdueBoletos || hasOverdueReceivables
    
    const boletoAmount = overdueBoletos.reduce((sum: number, bol: any) => sum + Number(bol.amount), 0)
    const receivableAmount = overdueReceivables.reduce((sum: number, rec: any) => sum + Number(rec.amount), 0)
    const totalOverdueAmount = boletoAmount + receivableAmount
    
    // Cliente está bloqueado se tem pagamentos em atraso E NÃO foi liberado manualmente
    const isBlocked = hasAnyOverdue && !customer?.manuallyUnblocked
    
    console.log('========================================')
    console.log('[PAYMENT_STATUS] 📊 RESUMO DO STATUS:')
    console.log(`   Cliente ID: ${customerId}`)
    console.log(`   Cliente Nome: ${customer?.name}`)
    console.log(`   Has any overdue: ${hasAnyOverdue}`)
    console.log(`   Manually unblocked: ${customer?.manuallyUnblocked}`)
    console.log(`   Unblocked at: ${customer?.unblockedAt?.toISOString() || 'N/A'}`)
    console.log(`   Unblocked by: ${customer?.unblockedBy || 'N/A'}`)
    console.log(`   IS BLOCKED: ${isBlocked}`)
    console.log(`   Overdue count: ${overdueBoletos.length + overdueReceivables.length}`)
    console.log(`   Overdue amount: R$ ${totalOverdueAmount.toFixed(2)}`)
    console.log('========================================')

    const response = {
      hasOverdueBoletos,
      hasOverdueReceivables,
      hasAnyOverdue,
      isBlocked, // Novo campo que considera a liberação manual
      manuallyUnblocked: customer?.manuallyUnblocked || false,
      unblockedAt: customer?.unblockedAt?.toISOString() || null,
      unblockedBy: customer?.unblockedBy || null,
      overdueCount: overdueBoletos.length + overdueReceivables.length,
      overdueAmount: totalOverdueAmount,
      overdueBoletos: overdueBoletos.map((b: any) => ({
        id: b.id,
        boletoNumber: b.boletoNumber,
        amount: Number(b.amount),
        dueDate: b.dueDate.toISOString(),
        status: b.status
      })),
      overdueReceivables: overdueReceivables.map((r: any) => ({
        id: r.id,
        description: r.description,
        amount: Number(r.amount),
        dueDate: r.dueDate.toISOString()
      }))
    }
    
    console.log('[PAYMENT_STATUS] Retornando resposta:', JSON.stringify(response, null, 2))
    
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-API-Version': 'v5.0-BUILD-1768351200'
      }
    })
  } catch (error) {
    console.error('Error checking payment status:', error)
    return NextResponse.json(
      { error: 'Failed to check payment status' },
      { status: 500 }
    )
  }
}
