export const dynamic = "force-dynamic"


import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // 🔧 Extrair parâmetro 'date' da query string
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')

    function getBrasiliaDate() {
      const now = new Date()
      const brasiliaOffset = -3 * 60
      const localOffset = now.getTimezoneOffset()
      const brasiliaTime = new Date(now.getTime() + (localOffset + brasiliaOffset) * 60 * 1000)
      return brasiliaTime
    }

    function getBrasiliaDayStart(specificDate?: string) {
      if (specificDate) {
        // Se uma data específica foi fornecida, usar ela
        const [year, month, day] = specificDate.split('-').map(Number)
        return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
      }
      // Caso contrário, usar a data de Brasília hoje
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

    function formatDateBrasilia(date: Date | null): string | null {
      if (!date) return null
      const brasilia = new Date(date)
      brasilia.setMinutes(brasilia.getMinutes() + brasilia.getTimezoneOffset() + 180)
      return brasilia.toISOString().split('T')[0]
    }

    const today = getBrasiliaDayStart(dateParam || undefined)
    const tomorrow = getBrasiliaDayEnd(dateParam || undefined)

    console.log('🔍 [DAILY_PROLABORE] Buscando pró-labore para:', {
      dateParam: dateParam || 'hoje (Brasília)',
      today: today.toISOString(),
      tomorrow: tomorrow.toISOString()
    })

    // 🔧 CORREÇÃO: Mesma lógica do RESUMO FINANCEIRO (monthly-summary)
    const allProlaboreExpenses = await prisma.expense.findMany({
      where: { expenseType: 'PROLABORE' },
      include: {
        Category: true,
        Purchase: { select: { purchaseDate: true } }
      },
    })

    // Filtrar por competência
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
      return competenceDate && competenceDate >= today && competenceDate < tomorrow;
    })

    // 🔧 CORREÇÃO: Busca despesas de cartão pelo DIA DA COMPRA, não pelo mês da fatura
    // O card diário deve mostrar apenas despesas compradas NAQUELE DIA
    const creditCardProlabore = await prisma.creditCardExpense.findMany({
      where: {
        expenseType: 'PROLABORE',
        purchaseDate: {
          gte: today,
          lt: tomorrow
        }
      },
      include: {
        Category: true,
        CreditCard: true,
        Invoice: {
          select: {
            referenceMonth: true,
            dueDate: true
          }
        }
      },
      orderBy: {
        purchaseDate: 'desc'
      }
    })

    console.log('📊 [DAILY_PROLABORE] Registros encontrados:', {
      normalProlabore: normalProlabore.length,
      creditCardProlabore: creditCardProlabore.length
    })

    if (creditCardProlabore.length > 0) {
      console.log('💳 [DAILY_PROLABORE] Primeira despesa de cartão:', {
        description: creditCardProlabore[0].description,
        amount: creditCardProlabore[0].amount,
        purchaseDate: creditCardProlabore[0].purchaseDate
      })
    }

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
        dueDate: exp.Invoice?.dueDate ? formatDateBrasilia(exp.Invoice.dueDate) : formatDateBrasilia(exp.purchaseDate),
        paymentDate: null,
        category: exp.Category?.name || 'Sem categoria',
        supplier: exp.supplierName || 'Não informado',
        type: `Cartão (${exp.CreditCard?.name || 'Desconhecido'})`,
        paymentMethod: 'CREDIT_CARD'
      }))
    ]

    console.log('✅ [DAILY_PROLABORE] Total de registros retornados:', allProlabore.length)

    return NextResponse.json({ prolabore: allProlabore })
  } catch (error: any) {
    console.error('[daily-prolabore] Erro:', error)
    return NextResponse.json({ error: 'Erro ao buscar pró-labore' }, { status: 500 })
  }
}
