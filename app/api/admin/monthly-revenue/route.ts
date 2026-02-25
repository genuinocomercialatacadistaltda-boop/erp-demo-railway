
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    console.log('📊 [MONTHLY REVENUE] Buscando faturamento mensal detalhado')

    // Calcular início e fim do mês atual
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    // Buscar todos os pedidos do mês atual (não cancelados)
    const orders = await prisma.order.findMany({
      where: {
        status: { not: 'CANCELLED' },
        createdAt: {
          gte: firstDay,
          lte: lastDay
        }
      },
      include: {
        Customer: {
          select: {
            name: true,
            email: true,
            phone: true
          }
        },
        OrderItem: {
          include: {
            Product: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    console.log('✅ [MONTHLY REVENUE] Encontrados', orders.length, 'pedidos no mês atual')

    return NextResponse.json({ orders })
  } catch (error) {
    console.error('❌ [MONTHLY REVENUE] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar faturamento mensal' },
      { status: 500 }
    )
  }
}
