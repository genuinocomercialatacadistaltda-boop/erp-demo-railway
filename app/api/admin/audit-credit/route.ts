import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * API para auditar e corrigir crédito de todos os clientes
 * Endpoint: POST /api/admin/audit-credit
 * Parametros: autoFix (boolean) - se true, corrige automaticamente
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { autoFix } = await request.json()

    console.log('🔍 [AUDIT_CREDIT] Iniciando auditoria de crédito')
    console.log(`   Auto-Fix: ${autoFix ? 'SIM' : 'NÃO'}`)

    // Buscar todos os clientes ativos
    const customers = await prisma.customer.findMany({
      where: { isActive: true }
    })

    const issues: Array<{
      customerId: string,
      customerName: string,
      creditLimit: number,
      currentCredit: number,
      expectedCredit: number,
      difference: number,
      boletosPending: number,
      receivablesPending: number,
      fixed: boolean
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

      const creditoEsperado = Number(customer.creditLimit) - totalPendente
      const creditoAtual = Number(customer.availableCredit)
      const diferenca = creditoEsperado - creditoAtual

      // Se a diferença for > R$ 1,00, considerar como problema
      if (Math.abs(diferenca) > 1.00) {
        const issue = {
          customerId: customer.id,
          customerName: customer.name,
          creditLimit: Number(customer.creditLimit),
          currentCredit: creditoAtual,
          expectedCredit: creditoEsperado,
          difference: diferenca,
          boletosPending: boletosPending.length,
          receivablesPending: receivablesPending.filter(r => !r.boletoId).length,
          fixed: false
        }

        // Se autoFix estiver habilitado, corrigir automaticamente
        if (autoFix) {
          try {
            await prisma.customer.update({
              where: { id: customer.id },
              data: {
                availableCredit: creditoEsperado
              }
            })
            issue.fixed = true
            console.log(`✅ [AUDIT_CREDIT] ${customer.name}: R$ ${creditoAtual.toFixed(2)} → R$ ${creditoEsperado.toFixed(2)}`)
          } catch (error: any) {
            console.log(`❌ [AUDIT_CREDIT] Erro ao corrigir ${customer.name}: ${error.message}`)
          }
        }

        issues.push(issue)
      }
    }

    console.log(`📊 [AUDIT_CREDIT] Auditoria concluída`)
    console.log(`   Total de clientes: ${customers.length}`)
    console.log(`   Problemas encontrados: ${issues.length}`)
    console.log(`   Problemas corrigidos: ${issues.filter(i => i.fixed).length}`)

    return NextResponse.json({
      totalCustomers: customers.length,
      issuesFound: issues.length,
      issuesFixed: issues.filter(i => i.fixed).length,
      issues,
      message: autoFix 
        ? `${issues.length} problemas encontrados, ${issues.filter(i => i.fixed).length} corrigidos automaticamente`
        : `${issues.length} problemas encontrados. Use autoFix=true para corrigir automaticamente.`
    })

  } catch (error: any) {
    console.error('❌ [AUDIT_CREDIT] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao auditar crédito', details: error.message },
      { status: 500 }
    )
  }
}
