export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'

// GET /api/hr/daily-goals - Listar metas diárias
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const date = searchParams.get('date')
    const category = searchParams.get('category')
    const supervisorId = searchParams.get('supervisorId')

    const where: any = { isActive: true }
    
    if (employeeId) where.employeeId = employeeId
    if (category) where.category = category
    if (date) {
      const targetDate = new Date(date + 'T12:00:00')
      where.date = {
        gte: new Date(targetDate.setHours(0, 0, 0, 0)),
        lt: new Date(targetDate.setHours(23, 59, 59, 999))
      }
    }

    // Se buscar por supervisorId, buscar funcionários sob supervisão
    if (supervisorId) {
      const supervisees = await prisma.employee.findMany({
        where: { supervisorId, status: 'ACTIVE' },
        select: { id: true }
      })
      where.employeeId = { in: supervisees.map(s => s.id) }
    }

    const goals = await prisma.dailyGoal.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeNumber: true,
            position: true,
            supervisorId: true,
            supervisor: {
              select: { id: true, name: true }
            }
          }
        },
        evaluations: {
          where: date ? {
            date: {
              gte: new Date(date + 'T00:00:00'),
              lt: new Date(date + 'T23:59:59')
            }
          } : undefined
        }
      },
      orderBy: [{ date: 'desc' }, { employee: { name: 'asc' } }]
    })

    return NextResponse.json({ goals })
  } catch (error: any) {
    console.error('[DAILY_GOALS_GET] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar metas', details: error.message },
      { status: 500 }
    )
  }
}

// POST /api/hr/daily-goals - Criar meta diária
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const {
      employeeId,
      date,
      description,
      targetQuantity,
      category,
      isRecurring,
      recurringDays,
      bonusAmount,
      notes
    } = body

    if (!employeeId || !date || !description) {
      return NextResponse.json(
        { error: 'Funcionário, data e descrição são obrigatórios' },
        { status: 400 }
      )
    }

    // Verificar se funcionário existe
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId }
    })

    if (!employee) {
      return NextResponse.json(
        { error: 'Funcionário não encontrado' },
        { status: 404 }
      )
    }

    // Verificar permissão: ADMIN ou encarregado do funcionário
    if (session.user.userType !== 'ADMIN') {
      // Buscar funcionário logado pelo email
      const loggedEmployee = await prisma.employee.findFirst({
        where: { email: session.user.email }
      })
      
      if (!loggedEmployee?.isSupervisor || employee.supervisorId !== loggedEmployee.id) {
        return NextResponse.json(
          { error: 'Você não tem permissão para definir metas para este funcionário' },
          { status: 403 }
        )
      }
    }

    const goal = await prisma.dailyGoal.create({
      data: {
        employeeId,
        date: new Date(date + 'T12:00:00'),
        description,
        targetQuantity: targetQuantity ? parseInt(targetQuantity) : null,
        category: category || 'PRODUCTION',
        isRecurring: isRecurring || false,
        recurringDays: recurringDays || null,
        bonusAmount: bonusAmount ? parseFloat(bonusAmount) : null,
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
        }
      }
    })

    console.log('[DAILY_GOALS_POST] ✅ Meta criada:', goal.id)

    return NextResponse.json({ goal }, { status: 201 })
  } catch (error: any) {
    console.error('[DAILY_GOALS_POST] ❌ Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao criar meta', details: error.message },
      { status: 500 }
    )
  }
}
