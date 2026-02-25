import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/hr/evaluations/summary
 * Retorna o resumo mensal de avaliações de funcionários
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    
    const userType = (session.user as any)?.userType
    if (userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }
    
    const { searchParams } = new URL(request.url)
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
    const employeeId = searchParams.get('employeeId')
    
    // Calcular início e fim do mês
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59)
    
    console.log(`[EVALUATIONS_SUMMARY] Período: ${startDate.toISOString()} - ${endDate.toISOString()}`)
    
    // Buscar todas as avaliações do período
    const evaluations = await prisma.goalEvaluation.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate
        },
        ...(employeeId && { employeeId })
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeNumber: true
          }
        }
      }
    })
    
    // Agrupar por funcionário
    const summaryMap = new Map<string, {
      employeeId: string
      employeeName: string
      employeeNumber: string
      totalEvaluations: number
      totalStars: number
      positiveCount: number
      negativeCount: number
      neutralCount: number
    }>()
    
    for (const evaluation of evaluations) {
      const existing = summaryMap.get(evaluation.employeeId) || {
        employeeId: evaluation.employeeId,
        employeeName: evaluation.employee.name,
        employeeNumber: String(evaluation.employee.employeeNumber),
        totalEvaluations: 0,
        totalStars: 0,
        positiveCount: 0,
        negativeCount: 0,
        neutralCount: 0
      }
      
      existing.totalEvaluations++
      existing.totalStars += evaluation.rating
      
      if (evaluation.rating > 0) {
        existing.positiveCount++
      } else if (evaluation.rating < 0) {
        existing.negativeCount++
      } else {
        existing.neutralCount++
      }
      
      summaryMap.set(evaluation.employeeId, existing)
    }
    
    // Calcular médias e níveis de desempenho
    const summaries = Array.from(summaryMap.values()).map(summary => {
      const averageStars = summary.totalEvaluations > 0 
        ? summary.totalStars / summary.totalEvaluations 
        : 0
      
      // Determinar nível de desempenho
      let performanceLevel: string
      if (averageStars >= 4) {
        performanceLevel = 'EXCELENTE'
      } else if (averageStars >= 3) {
        performanceLevel = 'BOM'
      } else if (averageStars >= 2) {
        performanceLevel = 'REGULAR'
      } else if (averageStars >= 0) {
        performanceLevel = 'NECESSITA_ATENCAO'
      } else {
        performanceLevel = 'CRITICO'
      }
      
      return {
        ...summary,
        averageStars: Math.round(averageStars * 10) / 10,
        performanceLevel
      }
    })
    
    // Ordenar por média de estrelas (descendente)
    summaries.sort((a, b) => b.averageStars - a.averageStars)
    
    console.log(`[EVALUATIONS_SUMMARY] ${summaries.length} funcionários com avaliações`)
    
    return NextResponse.json(summaries)
    
  } catch (error: any) {
    console.error('[EVALUATIONS_SUMMARY] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar resumo de avaliações' },
      { status: 500 }
    )
  }
}
