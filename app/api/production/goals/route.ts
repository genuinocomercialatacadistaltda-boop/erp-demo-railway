export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { authOptions } from '@/lib/auth-options'

// GET /api/production/goals - Listar metas
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const teamId = searchParams.get('teamId')
    const productId = searchParams.get('productId')
    const goalType = searchParams.get('goalType')
    const isActive = searchParams.get('isActive')

    const userType = (session.user as any)?.userType
    const sessionEmployeeId = (session.user as any)?.employeeId

    console.log('[PRODUCTION_GOALS_GET] Verificando permissões:', {
      userType,
      sessionEmployeeId,
      requestedEmployeeId: employeeId
    })

    // ADMIN e SELLER podem ver todas as metas
    // EMPLOYEE só pode ver suas próprias metas
    if (userType !== 'ADMIN') {
      // Se é EMPLOYEE ou SELLER com employeeId, só pode ver metas do próprio funcionário
      if (employeeId && sessionEmployeeId && employeeId !== sessionEmployeeId) {
        console.log('[PRODUCTION_GOALS_GET] ❌ Acesso negado - tentando ver metas de outro funcionário')
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
      }
    }

    console.log('[PRODUCTION_GOALS_GET] Buscando metas com filtros:', {
      employeeId,
      teamId,
      productId,
      goalType,
      isActive
    })

    const where: any = {}
    
    if (employeeId) where.employeeId = employeeId
    if (teamId) where.teamId = teamId
    if (productId) where.productId = productId
    if (goalType) where.goalType = goalType
    if (isActive !== null) where.isActive = isActive === 'true'

    const goals = await prisma.productionGoal.findMany({
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
        team: {
          select: {
            id: true,
            name: true,
            description: true
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
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Calcular progresso atual de cada meta baseado nos registros de produção
    const goalsWithProgress = await Promise.all(goals.map(async (goal) => {
      // Determinar período para buscar registros de produção
      const now = new Date()
      let periodStart: Date
      let periodEnd: Date = now

      if (goal.period === 'Diária' || goal.period === 'DAILY') {
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
        periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
      } else if (goal.period === 'Semanal' || goal.period === 'WEEKLY') {
        const dayOfWeek = now.getDay()
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Segunda = início da semana
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff, 0, 0, 0)
        periodEnd = new Date(periodStart.getTime() + 6 * 24 * 60 * 60 * 1000)
        periodEnd.setHours(23, 59, 59)
      } else { // Mensal
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
      }

      // Buscar registros de produção no período
      const productionWhere: any = {
        date: {
          gte: periodStart,
          lte: periodEnd
        }
      }

      // Filtrar por funcionário ou equipe
      if (goal.goalType === 'INDIVIDUAL' && goal.employeeId) {
        productionWhere.employeeId = goal.employeeId
      } else if (goal.goalType === 'TEAM' && goal.teamId) {
        // Buscar membros da equipe
        const teamMembers = await prisma.teamMember.findMany({
          where: { teamId: goal.teamId },
          select: { employeeId: true }
        })
        productionWhere.employeeId = { in: teamMembers.map(m => m.employeeId) }
      }

      // Se meta é por produto, filtrar também por produto
      if (goal.productId) {
        productionWhere.productId = goal.productId
      }

      const production = await prisma.productionRecord.aggregate({
        where: productionWhere,
        _sum: { quantity: true }
      })

      const currentProgress = production._sum.quantity || 0

      return {
        ...goal,
        currentProgress,
        periodStart,
        periodEnd
      }
    }))

    console.log(`[PRODUCTION_GOALS_GET] ✅ ${goals.length} metas encontradas com progresso calculado`)

    return NextResponse.json({ goals: goalsWithProgress }, { status: 200 })
  } catch (error: any) {
    console.error('[PRODUCTION_GOALS_GET] ❌ Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar metas', details: error.message },
      { status: 500 }
    )
  }
}

// POST /api/production/goals - Criar meta
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const {
      goalType,
      employeeId,
      teamId,
      productId,
      targetQuantity,
      period,
      startDate,
      endDate,
      bonusAmount,
      bonusType,
      notes
    } = body

    console.log('[PRODUCTION_GOALS_POST] Criando meta:', {
      goalType,
      employeeId,
      teamId,
      targetQuantity,
      period
    })

    // Validações
    if (!goalType || !targetQuantity || !period || !startDate) {
      return NextResponse.json(
        { error: 'Tipo, quantidade, período e data de início são obrigatórios' },
        { status: 400 }
      )
    }

    if (goalType !== 'INDIVIDUAL' && goalType !== 'TEAM' && goalType !== 'PRODUCT') {
      return NextResponse.json(
        { error: 'Tipo de meta deve ser INDIVIDUAL, TEAM ou PRODUCT' },
        { status: 400 }
      )
    }

    if (goalType === 'INDIVIDUAL' && !employeeId) {
      return NextResponse.json(
        { error: 'Funcionário é obrigatório para meta individual' },
        { status: 400 }
      )
    }

    if (goalType === 'TEAM' && !teamId) {
      return NextResponse.json(
        { error: 'Equipe é obrigatória para meta de equipe' },
        { status: 400 }
      )
    }

    if (goalType === 'PRODUCT' && !productId) {
      return NextResponse.json(
        { error: 'Produto é obrigatório para meta de produto' },
        { status: 400 }
      )
    }

    if (targetQuantity <= 0) {
      return NextResponse.json(
        { error: 'Meta deve ser maior que zero' },
        { status: 400 }
      )
    }

    // Verificar se funcionário existe (se meta individual)
    if (goalType === 'INDIVIDUAL' && employeeId) {
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId }
      })

      if (!employee) {
        return NextResponse.json(
          { error: 'Funcionário não encontrado' },
          { status: 404 }
        )
      }
    }

    // Verificar se equipe existe (se meta de equipe)
    if (goalType === 'TEAM' && teamId) {
      const team = await prisma.productionTeam.findUnique({
        where: { id: teamId }
      })

      if (!team) {
        return NextResponse.json(
          { error: 'Equipe não encontrada' },
          { status: 404 }
        )
      }
    }

    // Criar meta
    const goal = await prisma.productionGoal.create({
      data: {
        goalType,
        employeeId: goalType === 'INDIVIDUAL' ? employeeId : null,
        teamId: goalType === 'TEAM' ? teamId : null,
        productId: productId || null,
        targetQuantity: parseFloat(targetQuantity),
        period,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        bonusAmount: bonusAmount ? parseFloat(bonusAmount) : null,
        bonusType: bonusType || null,
        notes: notes || null,
        createdBy: session.user.id
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeNumber: true,
            position: true
          }
        },
        team: {
          select: {
            id: true,
            name: true,
            description: true
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

    console.log('[PRODUCTION_GOALS_POST] ✅ Meta criada:', goal.id)

    return NextResponse.json({ goal }, { status: 201 })
  } catch (error: any) {
    console.error('[PRODUCTION_GOALS_POST] ❌ Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao criar meta', details: error.message },
      { status: 500 }
    )
  }
}
