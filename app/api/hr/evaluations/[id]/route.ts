import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/hr/evaluations/[id]
 * Retorna uma avaliação específica
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    
    const evaluation = await prisma.goalEvaluation.findUnique({
      where: { id: params.id },
      include: {
        employee: {
          select: { id: true, name: true, employeeNumber: true }
        },
        evaluator: {
          select: { id: true, name: true }
        }
      }
    })
    
    if (!evaluation) {
      return NextResponse.json({ error: 'Avaliação não encontrada' }, { status: 404 })
    }
    
    return NextResponse.json(evaluation)
    
  } catch (error: any) {
    console.error('[EVALUATION_GET] Erro:', error)
    return NextResponse.json({ error: 'Erro ao buscar avaliação' }, { status: 500 })
  }
}

/**
 * PUT /api/hr/evaluations/[id]
 * Atualiza uma avaliação
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    
    const userType = (session.user as any)?.userType
    if (userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }
    
    const body = await request.json()
    const { rating, observations, achieved, punctuality, attitude, quality } = body
    
    // Verificar se avaliação existe
    const existing = await prisma.goalEvaluation.findUnique({
      where: { id: params.id }
    })
    
    if (!existing) {
      return NextResponse.json({ error: 'Avaliação não encontrada' }, { status: 404 })
    }
    
    // Normalizar rating - permitir valores de -5 a 5
    const normalizedRating = typeof rating === 'number' 
      ? Math.max(-5, Math.min(5, rating)) 
      : existing.rating
    
    // Recalcular bônus se necessário
    let bonusEarned = existing.bonusEarned || 0
    if (existing.dailyGoalId && (achieved ?? existing.achieved) && normalizedRating > 0) {
      const goal = await prisma.dailyGoal.findUnique({
        where: { id: existing.dailyGoalId }
      })
      if (goal?.bonusAmount) {
        const ratingMultiplier = normalizedRating * 0.2
        bonusEarned = goal.bonusAmount * ratingMultiplier
      }
    } else if (normalizedRating <= 0) {
      bonusEarned = 0
    }
    
    const evaluation = await prisma.goalEvaluation.update({
      where: { id: params.id },
      data: {
        rating: normalizedRating,
        observations: observations ?? existing.observations,
        achieved: achieved ?? existing.achieved,
        punctuality: punctuality ?? existing.punctuality,
        attitude: attitude ?? existing.attitude,
        quality: quality ?? existing.quality,
        bonusEarned
      },
      include: {
        employee: {
          select: { id: true, name: true, employeeNumber: true }
        },
        evaluator: {
          select: { id: true, name: true }
        }
      }
    })
    
    console.log(`[EVALUATION_UPDATE] Avaliação ${params.id} atualizada: rating=${normalizedRating}`)
    
    return NextResponse.json(evaluation)
    
  } catch (error: any) {
    console.error('[EVALUATION_UPDATE] Erro:', error)
    return NextResponse.json({ error: 'Erro ao atualizar avaliação' }, { status: 500 })
  }
}

/**
 * DELETE /api/hr/evaluations/[id]
 * Deleta uma avaliação
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    
    const userType = (session.user as any)?.userType
    if (userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }
    
    await prisma.goalEvaluation.delete({
      where: { id: params.id }
    })
    
    console.log(`[EVALUATION_DELETE] Avaliação ${params.id} deletada`)
    
    return NextResponse.json({ success: true })
    
  } catch (error: any) {
    console.error('[EVALUATION_DELETE] Erro:', error)
    return NextResponse.json({ error: 'Erro ao deletar avaliação' }, { status: 500 })
  }
}
