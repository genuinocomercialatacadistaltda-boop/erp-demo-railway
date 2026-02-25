
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

function getBrasiliaDate() {
  const now = new Date()
  const brasiliaOffset = -3 * 60
  const localOffset = now.getTimezoneOffset()
  const brasiliaTime = new Date(now.getTime() + (localOffset + brasiliaOffset) * 60 * 1000)
  return brasiliaTime
}

function formatDateBrasilia(date: Date): string {
  const brasilia = new Date(date)
  brasilia.setMinutes(brasilia.getMinutes() + brasilia.getTimezoneOffset() + 180)
  return brasilia.toISOString().split('T')[0]
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    console.log('📊 [MONTHLY EXPENSES] Buscando despesas operacionais do mês detalhadas')

    // Calcular início e fim do mês atual em horário de Brasília
    const now = getBrasiliaDate()
    const firstDay = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 3, 0, 0, 0))
    const lastDay = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1, 2, 59, 59, 999))

    // 🔧 CORREÇÃO: Mesma lógica do RESUMO FINANCEIRO (monthly-summary)
    // Busca TODAS as despesas e depois filtra por DATA DE COMPETÊNCIA
    const allOperationalExpenses = await prisma.expense.findMany({
      where: {
        expenseType: 'OPERATIONAL',
      },
      include: {
        Category: { select: { name: true } },
        Purchase: { select: { purchaseDate: true } }
      },
    })

    // Filtrar por competência (mesma lógica do monthly-summary)
    const regularExpenses = allOperationalExpenses.filter((exp: any) => {
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
      return competenceDate && competenceDate >= firstDay && competenceDate <= lastDay;
    })

    console.log('✅ [MONTHLY EXPENSES] Despesas normais:', regularExpenses.length)

    // 2. Buscar despesas de CARTÃO DE CRÉDITO OPERACIONAIS do mês atual
    // 🔧 CORREÇÃO: Mesma lógica do RESUMO FINANCEIRO - filtrar por purchaseDate
    const creditCardExpenses = await prisma.creditCardExpense.findMany({
      where: {
        expenseType: 'OPERATIONAL',
        purchaseDate: {
          gte: firstDay,
          lte: lastDay
        }
      },
      include: {
        Category: { select: { name: true } },
        Invoice: { select: { status: true, dueDate: true, referenceMonth: true } },
        CreditCard: { select: { name: true } }
      },
      orderBy: {
        purchaseDate: 'desc'
      }
    })

    console.log('✅ [MONTHLY EXPENSES] Despesas de cartão:', creditCardExpenses.length)

    // 3. Combinar e formatar ambos os tipos de despesa em um formato único
    const allExpenses = [
      // Despesas normais
      ...regularExpenses.map((exp: any) => ({
        id: exp.id,
        description: exp.description,
        amount: exp.amount + (exp.feeAmount || 0),
        dueDate: formatDateBrasilia(exp.dueDate),
        paymentDate: exp.paymentDate ? formatDateBrasilia(exp.paymentDate) : undefined,
        status: exp.status,
        Category: exp.Category || { name: 'Sem Categoria' },
        type: 'EXPENSE' as const
      })),
      // Despesas de cartão
      ...creditCardExpenses.map((exp: any) => {
        // Usar a data de vencimento da fatura, se disponível, senão a data de compra
        const dueDate = exp.Invoice?.dueDate || exp.purchaseDate
        
        return {
          id: `card-${exp.id}`,
          description: `[${exp.CreditCard.name}] ${exp.description}`,
          amount: exp.amount,
          dueDate: formatDateBrasilia(dueDate),
          paymentDate: exp.Invoice?.status === 'PAID' ? formatDateBrasilia(dueDate) : undefined,
          status: exp.Invoice?.status === 'PAID' ? 'PAID' : 'PENDING',
          Category: exp.Category || { name: 'Cartão de Crédito' },
          type: 'CREDIT_CARD' as const
        }
      })
    ]

    // Ordenar por data de vencimento (mais recente primeiro)
    allExpenses.sort((a, b) => {
      const dateA = new Date(a.dueDate)
      const dateB = new Date(b.dueDate)
      return dateB.getTime() - dateA.getTime()
    })

    console.log('✅ [MONTHLY EXPENSES] Total de despesas:', allExpenses.length)
    console.log('   - Normais:', regularExpenses.length)
    console.log('   - Cartão:', creditCardExpenses.length)

    return NextResponse.json({ expenses: allExpenses })
  } catch (error) {
    console.error('❌ [MONTHLY EXPENSES] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar despesas mensais' },
      { status: 500 }
    )
  }
}
