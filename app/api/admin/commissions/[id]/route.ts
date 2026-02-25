
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

// PUT - Editar valor da comissão
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const { amount, description, status } = body

    const commission = await prisma.commission.update({
      where: { id: params.id },
      data: {
        ...(amount !== undefined && { amount: parseFloat(amount) }),
        ...(description && { description }),
        ...(status && { 
          status,
          releaseDate: status === 'RELEASED' ? new Date() : undefined,
          releasedBy: status === 'RELEASED' ? (session.user as any).id : undefined
        })
      },
      include: {
        Seller: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        }
      }
    })

    return NextResponse.json({
      message: 'Comissão atualizada com sucesso',
      commission
    })
  } catch (error) {
    console.error('Error updating commission:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar comissão' },
      { status: 500 }
    )
  }
}

// DELETE - Excluir comissão
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    await prisma.commission.delete({
      where: { id: params.id }
    })

    return NextResponse.json({
      message: 'Comissão excluída com sucesso'
    })
  } catch (error) {
    console.error('Error deleting commission:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir comissão' },
      { status: 500 }
    )
  }
}
