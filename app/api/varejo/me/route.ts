import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth-options'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const user = session.user as any

    // Buscar informações do cliente
    const customer = await prisma.customer.findUnique({
      where: { id: user.customerId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        customerType: true,
        pointsBalance: true,
        pointsMultiplier: true,
        totalPointsEarned: true,
        totalPointsRedeemed: true,
        createdAt: true
      }
    })

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Cliente não encontrado' },
        { status: 404 }
      )
    }

    // Buscar estatísticas de pedidos
    const orders = await prisma.order.findMany({
      where: { customerId: user.customerId },
      select: {
        id: true,
        orderNumber: true,
        total: true,
        orderType: true,
        status: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    })

    const totalOrders = await prisma.order.count({
      where: { customerId: user.customerId }
    })

    const totalSpent = await prisma.order.aggregate({
      where: {
        customerId: user.customerId,
        status: { in: ['CONFIRMED', 'PREPARING', 'READY', 'DELIVERING', 'DELIVERED'] }
      },
      _sum: { total: true }
    })

    return NextResponse.json({
      success: true,
      customer,
      stats: {
        totalOrders,
        totalSpent: totalSpent._sum.total || 0,
        recentOrders: orders
      }
    })
  } catch (error) {
    console.error('Erro ao buscar dados do cliente varejo:', error)
    return NextResponse.json(
      { success: false, error: 'Erro ao carregar dados' },
      { status: 500 }
    )
  }
}
