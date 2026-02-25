
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    function getBrasiliaDate() {
      const now = new Date()
      const brasiliaOffset = -3 * 60
      const localOffset = now.getTimezoneOffset()
      const brasiliaTime = new Date(now.getTime() + (localOffset + brasiliaOffset) * 60 * 1000)
      return brasiliaTime
    }

    function getBrasiliaMonthStart() {
      const brasilia = getBrasiliaDate()
      const monthStart = new Date(brasilia.getFullYear(), brasilia.getMonth(), 1)
      return monthStart
    }

    function getBrasiliaMonthEnd() {
      const brasilia = getBrasiliaDate()
      const monthEnd = new Date(brasilia.getFullYear(), brasilia.getMonth() + 1, 1)
      return monthEnd
    }

    function formatDateBrasilia(date: Date | null): string | null {
      if (!date) return null
      const brasilia = new Date(date)
      brasilia.setMinutes(brasilia.getMinutes() + brasilia.getTimezoneOffset() + 180)
      return brasilia.toISOString().split("T")[0]
    }

    const firstDayOfMonth = getBrasiliaMonthStart()
    const firstDayOfNextMonth = getBrasiliaMonthEnd()

    // 🔧 CORREÇÃO: Mesma lógica do RESUMO FINANCEIRO (monthly-summary)
    // Busca TODAS as despesas e depois filtra por DATA DE COMPETÊNCIA
    const allProlaboreExpenses = await prisma.expense.findMany({
      where: {
        expenseType: 'PROLABORE',
      },
      include: {
        Category: true,
        Purchase: { select: { purchaseDate: true } }
      },
    })

    // Filtrar por competência (mesma lógica do monthly-summary)
    const normalProlabore = allProlaboreExpenses.filter((exp: any) => {
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
      return competenceDate && competenceDate >= firstDayOfMonth && competenceDate < firstDayOfNextMonth;
    })

    // 🔧 CORREÇÃO: Mesma lógica do RESUMO FINANCEIRO - filtrar por purchaseDate
    const creditCardProlabore = await prisma.creditCardExpense.findMany({
      where: {
        expenseType: 'PROLABORE',
        purchaseDate: {
          gte: firstDayOfMonth,
          lt: firstDayOfNextMonth
        }
      },
      include: {
        Category: true,
        CreditCard: true,
        Invoice: {
          select: {
            referenceMonth: true
          }
        }
      },
      orderBy: {
        purchaseDate: 'desc'
      }
    })

    const allProlabore = [
      ...normalProlabore.map((exp: any) => ({
        id: exp.id,
        description: exp.description,
        amount: exp.amount,
        status: exp.status,
        dueDate: formatDateBrasilia(exp.dueDate),
        paymentDate: formatDateBrasilia(exp.paymentDate),
        category: exp.Category?.name || 'Sem categoria',
        supplier: exp.supplierName || 'Não informado',
        type: 'Normal',
        paymentMethod: exp.paymentMethod
      })),
      ...creditCardProlabore.map((exp: any) => ({
        id: exp.id,
        description: exp.description,
        amount: exp.amount,
        status: 'PENDING',
        dueDate: formatDateBrasilia(exp.purchaseDate),
        paymentDate: null,
        category: exp.Category?.name || 'Sem categoria',
        supplier: exp.supplierName || 'Não informado',
        type: `Cartão (${exp.CreditCard?.name || 'Desconhecido'})`,
        paymentMethod: 'CREDIT_CARD'
      }))
    ]

    return NextResponse.json({ prolabore: allProlabore })
  } catch (error: any) {
    console.error('[monthly-prolabore] Erro:', error)
    return NextResponse.json({ error: 'Erro ao buscar pró-labore' }, { status: 500 })
  }
}
