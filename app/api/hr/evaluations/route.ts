import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'

// GET /api/hr/evaluations - Listar avaliações
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const evaluatorId = searchParams.get('evaluatorId')
    const date = searchParams.get('date')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: any = {}
    
    if (employeeId) where.employeeId = employeeId
    if (evaluatorId) where.evaluatorId = evaluatorId
    
    if (date) {
      const targetDate = new Date(date + 'T12:00:00')
      where.date = {
        gte: new Date(targetDate.setHours(0, 0, 0, 0)),
        lt: new Date(new Date(date + 'T12:00:00').setHours(23, 59, 59, 999))
      }
    } else if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate + 'T00:00:00'),
        lte: new Date(endDate + 'T23:59:59')
      }
    }

    const evaluations = await prisma.goalEvaluation.findMany({
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
        evaluator: {
          select: {
            id: true,
            name: true,
            employeeNumber: true
          }
        },
        dailyGoal: {
          select: {
            id: true,
            description: true,
            targetQuantity: true,
            category: true,
            bonusAmount: true
          }
        }
      },
      orderBy: [{ date: 'desc' }, { employee: { name: 'asc' } }]
    })

    return NextResponse.json({ evaluations })
  } catch (error: any) {
    console.error('[EVALUATIONS_GET] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar avaliações', details: error.message },
      { status: 500 }
    )
  }
}

// POST /api/hr/evaluations - Criar avaliação (checklist do encarregado)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const {
      employeeId,
      evaluatorId,
      dailyGoalId,
      date,
      achieved,
      achievedQuantity,
      rating,
      observations,
      attitude,
      punctuality,
      quality
    } = body

    if (!employeeId || !evaluatorId || !date) {
      return NextResponse.json(
        { error: 'Funcionário, avaliador e data são obrigatórios' },
        { status: 400 }
      )
    }

    // Verificar se tem permissão para avaliar
    // ADMIN pode avaliar qualquer um
    // CEO pode avaliar qualquer um (exceto ele mesmo)
    // Gerente pode avaliar qualquer um (exceto CEO e outros gerentes)
    // Supervisor só pode avaliar subordinados diretos
    const userType = (session.user as any)?.userType
    
    if (userType !== 'ADMIN') {
      // Buscar dados do avaliador e do funcionário sendo avaliado
      const [evaluator, targetEmployee] = await Promise.all([
        prisma.employee.findUnique({
          where: { id: evaluatorId },
          select: { id: true, isCEO: true, isManager: true, isSupervisor: true }
        }),
        prisma.employee.findUnique({
          where: { id: employeeId },
          select: { id: true, supervisorId: true, isCEO: true, isManager: true }
        })
      ])

      if (!evaluator) {
        return NextResponse.json(
          { error: 'Avaliador não encontrado' },
          { status: 404 }
        )
      }

      let canEvaluate = false

      if (evaluator.isCEO) {
        // CEO pode avaliar qualquer um (exceto ele mesmo)
        canEvaluate = evaluator.id !== employeeId
        console.log(`[EVALUATIONS] CEO tentando avaliar: ${canEvaluate ? 'PERMITIDO' : 'BLOQUEADO (auto-avaliação)'}`)
      } else if (evaluator.isManager) {
        // Gerente pode avaliar qualquer um que não seja CEO ou outro gerente
        canEvaluate = !targetEmployee?.isCEO && !targetEmployee?.isManager && evaluator.id !== employeeId
        console.log(`[EVALUATIONS] Gerente tentando avaliar: ${canEvaluate ? 'PERMITIDO' : 'BLOQUEADO'}`)
      } else if (evaluator.isSupervisor) {
        // Supervisor só pode avaliar subordinados diretos
        canEvaluate = targetEmployee?.supervisorId === evaluatorId
        console.log(`[EVALUATIONS] Supervisor tentando avaliar: ${canEvaluate ? 'PERMITIDO (subordinado direto)' : 'BLOQUEADO'}`)
      }

      if (!canEvaluate) {
        return NextResponse.json(
          { error: 'Você não tem permissão para avaliar este funcionário' },
          { status: 403 }
        )
      }
    }

    // Normalizar rating - permitir valores de -5 a 5
    // Usar ?? ao invés de || para permitir 0 e valores negativos
    const normalizedRating = typeof rating === 'number' ? rating : 0
    
    // Buscar meta para calcular bônus
    let bonusEarned = 0
    if (dailyGoalId && achieved && normalizedRating > 0) {
      const goal = await prisma.dailyGoal.findUnique({
        where: { id: dailyGoalId }
      })
      if (goal?.bonusAmount) {
        // Cálculo do bônus baseado no rating (estrelas positivas)
        // 5 estrelas = 100%, 4 = 80%, 3 = 60%, 2 = 40%, 1 = 20%
        const ratingMultiplier = normalizedRating * 0.2
        bonusEarned = goal.bonusAmount * ratingMultiplier
      }
    }

    const evaluationDate = new Date(date + 'T12:00:00')

    // Upsert: atualizar se já existe avaliação para este funcionário/dia
    const evaluation = await prisma.goalEvaluation.upsert({
      where: {
        employeeId_date: {
          employeeId,
          date: evaluationDate
        }
      },
      update: {
        evaluatorId,
        dailyGoalId: dailyGoalId || null,
        achieved: achieved || false,
        achievedQuantity: achievedQuantity ? parseInt(achievedQuantity) : null,
        rating: normalizedRating, // Permite 0 e valores negativos
        observations: observations || null,
        attitude: attitude || null,
        punctuality: punctuality !== false,
        quality: quality || null,
        bonusEarned
      },
      create: {
        employeeId,
        evaluatorId,
        dailyGoalId: dailyGoalId || null,
        date: evaluationDate,
        achieved: achieved || false,
        achievedQuantity: achievedQuantity ? parseInt(achievedQuantity) : null,
        rating: normalizedRating, // Permite 0 e valores negativos
        observations: observations || null,
        attitude: attitude || null,
        punctuality: punctuality !== false,
        quality: quality || null,
        bonusEarned
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeNumber: true
          }
        },
        evaluator: {
          select: {
            id: true,
            name: true
          }
        },
        dailyGoal: {
          select: {
            id: true,
            description: true,
            targetQuantity: true
          }
        }
      }
    })

    console.log('[EVALUATIONS_POST] ✅ Avaliação salva:', evaluation.id)

    return NextResponse.json({ evaluation }, { status: 201 })
  } catch (error: any) {
    console.error('[EVALUATIONS_POST] ❌ Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao salvar avaliação', details: error.message },
      { status: 500 }
    )
  }
}
