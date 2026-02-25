import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { authOptions } from '@/lib/auth-options'

// GET /api/production/teams - Listar equipes
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const isActive = searchParams.get('isActive')

    console.log('[PRODUCTION_TEAMS_GET] Buscando equipes')

    const where: any = {}
    if (isActive !== null) where.isActive = isActive === 'true'

    const teams = await prisma.productionTeam.findMany({
      where,
      include: {
        leader: {
          select: {
            id: true,
            name: true,
            employeeNumber: true,
            position: true
          }
        },
        members: {
          where: { isActive: true },
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
        },
        _count: {
          select: {
            members: {
              where: { isActive: true }
            },
            goals: {
              where: { isActive: true }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    console.log(`[PRODUCTION_TEAMS_GET] ✅ ${teams.length} equipes encontradas`)

    return NextResponse.json({ teams }, { status: 200 })
  } catch (error: any) {
    console.error('[PRODUCTION_TEAMS_GET] ❌ Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar equipes', details: error.message },
      { status: 500 }
    )
  }
}

// POST /api/production/teams - Criar equipe
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, leaderId, memberIds } = body

    console.log('[PRODUCTION_TEAMS_POST] Criando equipe:', { name, leaderId, memberIds })

    // Validações
    if (!name || name.trim() === '') {
      return NextResponse.json(
        { error: 'Nome da equipe é obrigatório' },
        { status: 400 }
      )
    }

    // Verificar se líder existe (se fornecido)
    if (leaderId) {
      const leader = await prisma.employee.findUnique({
        where: { id: leaderId }
      })

      if (!leader) {
        return NextResponse.json(
          { error: 'Líder não encontrado' },
          { status: 404 }
        )
      }
    }

    // Criar equipe
    const team = await prisma.productionTeam.create({
      data: {
        name,
        description: description || null,
        leaderId: leaderId || null
      }
    })

    // Adicionar membros (se fornecidos)
    if (memberIds && Array.isArray(memberIds) && memberIds.length > 0) {
      await prisma.teamMember.createMany({
        data: memberIds.map((employeeId: string) => ({
          teamId: team.id,
          employeeId
        }))
      })
    }

    // Buscar equipe completa com relações
    const teamComplete = await prisma.productionTeam.findUnique({
      where: { id: team.id },
      include: {
        leader: {
          select: {
            id: true,
            name: true,
            employeeNumber: true,
            position: true
          }
        },
        members: {
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
        }
      }
    })

    console.log('[PRODUCTION_TEAMS_POST] ✅ Equipe criada:', team.id)

    return NextResponse.json({ team: teamComplete }, { status: 201 })
  } catch (error: any) {
    console.error('[PRODUCTION_TEAMS_POST] ❌ Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao criar equipe', details: error.message },
      { status: 500 }
    )
  }
}
