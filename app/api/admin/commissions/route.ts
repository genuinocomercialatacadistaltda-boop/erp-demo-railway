
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

// GET - Listar comissões (Admin only)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const sellerId = searchParams.get('sellerId')
    const status = searchParams.get('status')

    const where: any = {}
    if (sellerId) where.sellerId = sellerId
    if (status) where.status = status

    const commissions = await prisma.commission.findMany({
      where,
      include: {
        Seller: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({ commissions })
  } catch (error) {
    console.error('Error fetching commissions:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar comissões' },
      { status: 500 }
    )
  }
}

// PUT - Liberar/atualizar comissão (Admin only)
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const { commissionId, status } = body

    const commission = await prisma.commission.update({
      where: { id: commissionId },
      data: {
        status,
        releaseDate: status === 'RELEASED' ? new Date() : undefined,
        releasedBy: status === 'RELEASED' ? (session.user as any).id : undefined
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
