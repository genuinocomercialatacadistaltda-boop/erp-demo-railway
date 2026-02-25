
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function getBrasiliaDate() {
  const now = new Date()
  const brasiliaOffset = -3 * 60
  const localOffset = now.getTimezoneOffset()
  const brasiliaTime = new Date(now.getTime() + (localOffset + brasiliaOffset) * 60 * 1000)
  return brasiliaTime
}

function getBrasiliaDayStart(specificDate?: string) {
  if (specificDate) {
    const [year, month, day] = specificDate.split('-').map(Number)
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
  }
  const brasilia = getBrasiliaDate()
  brasilia.setHours(0, 0, 0, 0)
  return brasilia
}

function getBrasiliaDayEnd(specificDate?: string) {
  const start = getBrasiliaDayStart(specificDate)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return end
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // 🔧 Extrair parâmetro 'date' da query string
    const dateParam = req.nextUrl.searchParams.get('date')

    // 🔧 FIX: Usar UTC para evitar problemas de timezone
    const dateFilter = dateParam || undefined
    const today = dateFilter ? new Date(dateFilter + 'T00:00:00.000Z') : getBrasiliaDayStart()
    const tomorrow = dateFilter ? new Date(dateFilter + 'T23:59:59.999Z') : getBrasiliaDayEnd()

    console.log('💸 [DAILY EXPENSES] Buscando despesas para:', dateParam || 'hoje')
    console.log('💸 [DAILY EXPENSES] Período:', today.toISOString(), 'até', tomorrow.toISOString())

    // 🔧 CORREÇÃO: Mesma lógica do RESUMO FINANCEIRO (monthly-summary)
    const allOperationalExpenses = await prisma.expense.findMany({
      where: { expenseType: 'OPERATIONAL' },
      include: {
        Category: { select: { name: true } },
        Purchase: { select: { purchaseDate: true } }
      },
    })

    // Filtrar por competência (mesma lógica do monthly-summary)
    const expenses = allOperationalExpenses.filter((exp: any) => {
      let competenceDate: Date | null = null;
      if (exp.competenceDate) {
        competenceDate = new Date(exp.competenceDate);
      } else if (exp.Purchase?.purchaseDate) {
        competenceDate = new Date(exp.Purchase.purchaseDate);
      } else if (exp.status === 'PAID' && exp.paymentDate) {
        competenceDate = new Date(exp.paymentDate);
      } else if (exp.dueDate) {
        competenceDate = new Date(exp.dueDate);
      }
      return competenceDate && competenceDate >= today && competenceDate <= tomorrow;
    })
    
    console.log('💸 [DAILY EXPENSES] Despesas encontradas:', expenses.length)
    expenses.forEach((exp: any, idx: number) => {
      console.log(`  ${idx + 1}. ${exp.description?.substring(0, 40)} | R$ ${exp.amount} | comp: ${exp.competenceDate?.toISOString()?.substring(0, 10) || 'NULL'} | due: ${exp.dueDate?.toISOString()?.substring(0, 10)}`)
    })

    // 🔧 CORREÇÃO: Busca despesas de cartão pelo DIA DA COMPRA (purchaseDate)
    // Para relatório DIÁRIO, deve filtrar por dia, não por mês!
    const creditCardExpenses = await prisma.creditCardExpense.findMany({
      where: {
        expenseType: 'OPERATIONAL',
        purchaseDate: {
          gte: today,
          lte: tomorrow
        }
      },
      include: {
        Category: {
          select: {
            name: true
          }
        },
        Invoice: {
          select: {
            referenceMonth: true,
            dueDate: true
          }
        }
      }
    })
    
    console.log('💸 [DAILY EXPENSES] Despesas de cartão encontradas:', creditCardExpenses.length)

    // Combinar e formatar despesas
    const allExpenses = [
      ...expenses.map((e: any) => ({
        ...e,
        source: 'normal' as const
      })),
      ...creditCardExpenses.map((e: any) => ({
        ...e,
        dueDate: e.Invoice?.dueDate || e.purchaseDate,
        status: 'PAID' as const,
        paymentDate: e.Invoice?.dueDate || e.purchaseDate,
        source: 'credit_card' as const
      }))
    ].sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime())

    console.log('✅ [DAILY EXPENSES v2] TOTAL FINAL:', allExpenses.length, 'despesas (normais:', expenses.length, '+ cartão:', creditCardExpenses.length, ')')

    // 🔧 Headers anti-cache
    return NextResponse.json({ expenses: allExpenses }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('❌ [DAILY EXPENSES] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar despesas diárias' },
      { status: 500 }
    )
  }
}
// v3 build 1736682600 FINAL FIX
