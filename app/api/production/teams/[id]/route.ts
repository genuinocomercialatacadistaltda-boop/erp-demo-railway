export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { authOptions } from '@/lib/auth-options'

// PUT /api/production/teams/[id] - Editar equipe
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = params
    const body = await request.json()
    const { name, description, leaderId, memberIds, isActive } = body

    console.log('[PRODUCTION_TEAMS_PUT] Editando equipe:', id, body)

    // Verificar se equipe existe
    const existing = await prisma.productionTeam.findUnique({
      where: { id }
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Equipe não encontrada' },
        { status: 404 }
      )
    }

    // Atualizar dados básicos
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description || null
    if (leaderId !== undefined) updateData.leaderId = leaderId || null
    if (isActive !== undefined) updateData.isActive = isActive

    await prisma.productionTeam.update({
      where: { id },
      data: updateData
    })

    // Atualizar membros (se fornecido)
    if (memberIds !== undefined && Array.isArray(memberIds)) {
      // Remover todos os membros atuais
      await prisma.teamMember.deleteMany({
        where: { teamId: id }
      })

      // Adicionar novos membros
      if (memberIds.length > 0) {
        await prisma.teamMember.createMany({
          data: memberIds.map((employeeId: string) => ({
            teamId: id,
            employeeId
          }))
        })
      }
    }

    // Buscar equipe completa com relações
    const team = await prisma.productionTeam.findUnique({
      where: { id },
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

    console.log('[PRODUCTION_TEAMS_PUT] ✅ Equipe atualizada:', id)

    return NextResponse.json({ team }, { status: 200 })
  } catch (error: any) {
    console.error('[PRODUCTION_TEAMS_PUT] ❌ Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao editar equipe', details: error.message },
      { status: 500 }
    )
  }
}

// DELETE /api/production/teams/[id] - Excluir equipe
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = params

    console.log('[PRODUCTION_TEAMS_DELETE] Excluindo equipe:', id)

    // Verificar se equipe existe
    const existing = await prisma.productionTeam.findUnique({
      where: { id }
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Equipe não encontrada' },
        { status: 404 }
      )
    }

    // Excluir (cascade irá remover membros e metas)
    await prisma.productionTeam.delete({
      where: { id }
    })

    console.log('[PRODUCTION_TEAMS_DELETE] ✅ Equipe excluída:', id)

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error('[PRODUCTION_TEAMS_DELETE] ❌ Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir equipe', details: error.message },
      { status: 500 }
    )
  }
}
