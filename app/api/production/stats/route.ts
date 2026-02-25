import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { authOptions } from '@/lib/auth-options'
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'

// GET /api/production/stats - Estatísticas de produção
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const teamId = searchParams.get('teamId')
    const productId = searchParams.get('productId')
    const period = searchParams.get('period') || 'DAILY' // DAILY, WEEKLY, MONTHLY
    const date = searchParams.get('date') // Data de referência

    console.log('[PRODUCTION_STATS_GET] Buscando estatísticas:', {
      employeeId,
      teamId,
      productId,
      period,
      date
    })

    const referenceDate = date ? new Date(date) : new Date()
    let startDate: Date
    let endDate: Date

    // Definir intervalo de datas com base no período
    switch (period) {
      case 'DAILY':
        startDate = startOfDay(referenceDate)
        endDate = endOfDay(referenceDate)
        break
      case 'WEEKLY':
        startDate = startOfWeek(referenceDate, { weekStartsOn: 0 }) // Domingo
        endDate = endOfWeek(referenceDate, { weekStartsOn: 0 })
        break
      case 'MONTHLY':
        startDate = startOfMonth(referenceDate)
        endDate = endOfMonth(referenceDate)
        break
      default:
        startDate = startOfDay(referenceDate)
        endDate = endOfDay(referenceDate)
    }

    console.log('[PRODUCTION_STATS] Período:', {
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    })

    // Construir filtros
    const where: any = {
      date: {
        gte: startDate,
        lte: endDate
      }
    }

    if (employeeId) where.employeeId = employeeId
    if (productId) where.productId = productId

    // Buscar registros de produção
    const records = await prisma.productionRecord.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeNumber: true,
            position: true
          }
        },
        product: {
          select: {
            id: true,
            name: true,
            category: true,
            imageUrl: true
          }
        }
      }
    })

    // Calcular estatísticas agregadas
    const totalProduced = records.reduce((sum, r) => sum + r.quantity, 0)
    const totalRejected = records.reduce((sum, r) => sum + (r.rejectedQty || 0), 0)
    const qualityScores = records.filter(r => r.qualityScore !== null).map(r => r.qualityScore!)
    const averageQuality = qualityScores.length > 0
      ? qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length
      : null

    // Dias únicos de trabalho
    const uniqueDays = new Set(records.map(r => r.date.toISOString().split('T')[0]))
    const workDays = uniqueDays.size
    const averagePerDay = workDays > 0 ? totalProduced / workDays : 0

    // Agrupar por produto
    const byProduct = records.reduce((acc: any, record) => {
      const productId = record.productId
      if (!acc[productId]) {
        acc[productId] = {
          product: record.product,
          totalProduced: 0,
          totalRejected: 0,
          recordCount: 0
        }
      }
      acc[productId].totalProduced += record.quantity
      acc[productId].totalRejected += record.rejectedQty || 0
      acc[productId].recordCount += 1
      return acc
    }, {})

    const productStats = Object.values(byProduct)

    // Agrupar por funcionário (se não filtrou por funcionário específico)
    let employeeStats: any[] = []
    if (!employeeId) {
      const byEmployee = records.reduce((acc: any, record) => {
        const empId = record.employeeId
        if (!acc[empId]) {
          acc[empId] = {
            employee: record.employee,
            totalProduced: 0,
            totalRejected: 0,
            recordCount: 0,
            qualityScores: []
          }
        }
        acc[empId].totalProduced += record.quantity
        acc[empId].totalRejected += record.rejectedQty || 0
        acc[empId].recordCount += 1
        if (record.qualityScore !== null) {
          acc[empId].qualityScores.push(record.qualityScore)
        }
        return acc
      }, {})

      employeeStats = Object.values(byEmployee).map((emp: any) => ({
        ...emp,
        averageQuality: emp.qualityScores.length > 0
          ? emp.qualityScores.reduce((sum: number, score: number) => sum + score, 0) / emp.qualityScores.length
          : null
      }))

      // Ordenar por total produzido (decrescente)
      employeeStats.sort((a: any, b: any) => b.totalProduced - a.totalProduced)
    }

    // Buscar metas ativas no período
    const goalsWhere: any = {
      isActive: true,
      startDate: {
        lte: endDate
      },
      OR: [
        { endDate: null },
        { endDate: { gte: startDate } }
      ]
    }

    if (employeeId) goalsWhere.employeeId = employeeId
    if (teamId) goalsWhere.teamId = teamId
    if (productId) goalsWhere.productId = productId

    const goals = await prisma.productionGoal.findMany({
      where: goalsWhere,
      include: {
        employee: {
          select: {
            id: true,
            name: true
          }
        },
        team: {
          select: {
            id: true,
            name: true
          }
        },
        product: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    // Calcular atingimento de metas
    const goalsWithAchievement = goals.map(goal => {
      let achieved = 0
      let target = goal.targetQuantity

      if (goal.goalType === 'INDIVIDUAL' && goal.employeeId) {
        achieved = records
          .filter(r => r.employeeId === goal.employeeId)
          .filter(r => !goal.productId || r.productId === goal.productId)
          .reduce((sum, r) => sum + r.quantity, 0)
      } else if (goal.goalType === 'TEAM' && goal.teamId) {
        // Buscar membros da equipe
        // TODO: Implementar cálculo de equipe
        achieved = 0
      }

      const achievementPercentage = target > 0 ? (achieved / target) * 100 : 0

      return {
        ...goal,
        achieved,
        achievementPercentage: Math.round(achievementPercentage * 100) / 100
      }
    })

    const stats = {
      period,
      startDate,
      endDate,
      summary: {
        totalProduced,
        totalRejected,
        averageQuality: averageQuality ? Math.round(averageQuality * 100) / 100 : null,
        workDays,
        averagePerDay: Math.round(averagePerDay * 100) / 100,
        recordCount: records.length
      },
      byProduct: productStats,
      byEmployee: employeeStats,
      goals: goalsWithAchievement,
      records: records.slice(0, 50) // Limitar a 50 registros mais recentes
    }

    console.log('[PRODUCTION_STATS_GET] ✅ Estatísticas calculadas:', {
      totalRecords: records.length,
      totalProduced,
      workDays
    })

    return NextResponse.json(stats, { status: 200 })
  } catch (error: any) {
    console.error('[PRODUCTION_STATS_GET] ❌ Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar estatísticas', details: error.message },
      { status: 500 }
    )
  }
}
