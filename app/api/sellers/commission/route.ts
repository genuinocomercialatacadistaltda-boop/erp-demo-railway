
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

// GET - Buscar comissões do vendedor
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || (session.user as any).userType !== 'SELLER') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const sellerId = (session.user as any).sellerId

    // Buscar todas as comissões
    const commissions = await prisma.commission.findMany({
      where: { sellerId },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Calcular totais
    const totalCommissions = commissions.reduce((sum, c) => sum + c.amount, 0)
    const pendingCommissions = commissions
      .filter(c => c.status === 'PENDING')
      .reduce((sum, c) => sum + c.amount, 0)
    const releasedCommissions = commissions
      .filter(c => c.status === 'RELEASED' || c.status === 'PAID')
      .reduce((sum, c) => sum + c.amount, 0)

    return NextResponse.json({
      commissions,
      summary: {
        total: totalCommissions,
        pending: pendingCommissions,
        released: releasedCommissions
      }
    })
  } catch (error) {
    console.error('Error fetching commissions:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar comissões' },
      { status: 500 }
    )
  }
}
