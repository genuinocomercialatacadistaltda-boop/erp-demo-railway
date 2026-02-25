export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { authOptions } from '@/lib/auth-options'

// PUT /api/production/goals/[id] - Editar meta
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
    const {
      targetQuantity,
      period,
      startDate,
      endDate,
      bonusAmount,
      bonusType,
      notes,
      isActive
    } = body

    console.log('[PRODUCTION_GOALS_PUT] Editando meta:', id, body)

    // Verificar se meta existe
    const existing = await prisma.productionGoal.findUnique({
      where: { id }
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Meta não encontrada' },
        { status: 404 }
      )
    }

    // Atualizar
    const updateData: any = {}
    
    if (targetQuantity !== undefined) {
      if (targetQuantity <= 0) {
        return NextResponse.json(
          { error: 'Meta deve ser maior que zero' },
          { status: 400 }
        )
      }
      updateData.targetQuantity = parseFloat(targetQuantity)
    }
    
    if (period !== undefined) updateData.period = period
    if (startDate !== undefined) updateData.startDate = new Date(startDate)
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null
    if (bonusAmount !== undefined) updateData.bonusAmount = bonusAmount ? parseFloat(bonusAmount) : null
    if (bonusType !== undefined) updateData.bonusType = bonusType || null
    if (notes !== undefined) updateData.notes = notes || null
    if (isActive !== undefined) updateData.isActive = isActive

    const goal = await prisma.productionGoal.update({
      where: { id },
      data: updateData,
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

    console.log('[PRODUCTION_GOALS_PUT] ✅ Meta atualizada:', id)

    return NextResponse.json({ goal }, { status: 200 })
  } catch (error: any) {
    console.error('[PRODUCTION_GOALS_PUT] ❌ Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao editar meta', details: error.message },
      { status: 500 }
    )
  }
}

// DELETE /api/production/goals/[id] - Excluir meta
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

    console.log('[PRODUCTION_GOALS_DELETE] Excluindo meta:', id)

    // Verificar se meta existe
    const existing = await prisma.productionGoal.findUnique({
      where: { id }
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Meta não encontrada' },
        { status: 404 }
      )
    }

    // Excluir
    await prisma.productionGoal.delete({
      where: { id }
    })

    console.log('[PRODUCTION_GOALS_DELETE] ✅ Meta excluída:', id)

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error('[PRODUCTION_GOALS_DELETE] ❌ Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir meta', details: error.message },
      { status: 500 }
    )
  }
}
