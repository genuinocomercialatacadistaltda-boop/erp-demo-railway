export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

// GET /api/employee/goals - Buscar metas e avaliações do funcionário logado
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Buscar funcionário pelo email
    const employee = await prisma.employee.findFirst({
      where: { email: session.user.email },
      select: { id: true, name: true }
    })

    if (!employee) {
      return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') // formato: YYYY-MM
    
    // Definir período do mês
    let startDate: Date
    let endDate: Date
    
    if (month) {
      const [year, m] = month.split('-').map(Number)
      startDate = new Date(year, m - 1, 1, 0, 0, 0)
      endDate = new Date(year, m, 0, 23, 59, 59) // Último dia do mês
    } else {
      // Mês atual
      const now = new Date()
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    }

    console.log(`[EMPLOYEE_GOALS] Funcionário: ${employee.name}, Período: ${startDate.toISOString()} a ${endDate.toISOString()}`)

    // Buscar metas do funcionário no período
    const goals = await prisma.dailyGoal.findMany({
      where: {
        employeeId: employee.id,
        date: {
          gte: startDate,
          lte: endDate
        },
        isActive: true
      },
      orderBy: { date: 'desc' }
    })

    // Buscar avaliações do funcionário no período
    const evaluations = await prisma.goalEvaluation.findMany({
      where: {
        employeeId: employee.id,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { date: 'desc' },
      include: {
        evaluator: {
          select: { name: true }
        },
        dailyGoal: {
          select: { description: true, targetQuantity: true, category: true }
        }
      }
    })

    // Buscar produção diária do funcionário no período
    const productions = await prisma.productionRecord.findMany({
      where: {
        employeeId: employee.id,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { date: 'desc' },
      include: {
        product: {
          select: { name: true }
        }
      }
    })

    // Calcular estatísticas
    const totalGoals = goals.length
    const evaluatedGoals = evaluations.filter(e => e.dailyGoalId).length
    const achievedGoals = evaluations.filter(e => e.achieved).length
    const totalProduction = productions.reduce((sum, p) => sum + p.quantity, 0)
    const avgRating = evaluations.length > 0 
      ? evaluations.reduce((sum, e) => sum + (e.rating || 0), 0) / evaluations.length 
      : 0
    const totalBonus = evaluations.reduce((sum, e) => sum + (e.bonusEarned || 0), 0)

    // Agrupar produção por dia para o gráfico
    const productionByDay: Record<string, number> = {}
    productions.forEach(p => {
      const day = p.date.toISOString().split('T')[0]
      productionByDay[day] = (productionByDay[day] || 0) + p.quantity
    })

    // Converter para array ordenado
    const dailyProductionChart = Object.entries(productionByDay)
      .map(([date, quantity]) => ({ date, quantity }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Agrupar produção por produto
    const productionByProduct: Record<string, number> = {}
    productions.forEach((p: any) => {
      const productName = p.product?.name || 'Sem produto'
      productionByProduct[productName] = (productionByProduct[productName] || 0) + p.quantity
    })

    const productionSummary = Object.entries(productionByProduct)
      .map(([product, quantity]) => ({ product, quantity }))
      .sort((a, b) => b.quantity - a.quantity)

    console.log(`[EMPLOYEE_GOALS] Encontradas ${goals.length} metas, ${evaluations.length} avaliações, ${productions.length} produções`)

    return NextResponse.json({
      employee: { id: employee.id, name: employee.name },
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        month: month || `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`
      },
      goals: goals.map(g => ({
        id: g.id,
        date: g.date,
        description: g.description,
        targetQuantity: g.targetQuantity,
        category: g.category,
        bonusAmount: g.bonusAmount,
        createdBy: g.createdBy || 'Sistema'
      })),
      evaluations: evaluations.map(e => ({
        id: e.id,
        date: e.date,
        achieved: e.achieved,
        achievedQuantity: e.achievedQuantity,
        rating: e.rating,
        observations: e.observations,
        attitude: e.attitude,
        punctuality: e.punctuality,
        quality: e.quality,
        bonusEarned: e.bonusEarned,
        evaluator: e.evaluator?.name || 'Encarregado',
        goal: e.dailyGoal ? {
          description: e.dailyGoal.description,
          targetQuantity: e.dailyGoal.targetQuantity,
          category: e.dailyGoal.category
        } : null
      })),
      productions,
      stats: {
        totalGoals,
        evaluatedGoals,
        achievedGoals,
        achievementRate: totalGoals > 0 ? Math.round((achievedGoals / totalGoals) * 100) : 0,
        totalProduction,
        avgRating: Math.round(avgRating * 10) / 10,
        totalBonus
      },
      charts: {
        dailyProduction: dailyProductionChart,
        productionSummary
      }
    })
  } catch (error: any) {
    console.error('[EMPLOYEE_GOALS] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar metas', details: error.message },
      { status: 500 }
    )
  }
}
