
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

function getBrasiliaDate() {
  const now = new Date()
  const brasiliaOffset = -3 * 60
  const localOffset = now.getTimezoneOffset()
  const brasiliaTime = new Date(now.getTime() + (localOffset + brasiliaOffset) * 60 * 1000)
  return brasiliaTime
}

function getBrasiliaDayStart() {
  const brasilia = getBrasiliaDate()
  brasilia.setHours(0, 0, 0, 0)
  return brasilia
}

function getBrasiliaDayEnd() {
  const start = getBrasiliaDayStart()
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return end
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const today = getBrasiliaDayStart()
    const tomorrow = getBrasiliaDayEnd()

    console.log('📊 [DAILY ORDERS] Buscando vendas de hoje:', today.toISOString(), 'até', tomorrow.toISOString())

    const orders = await prisma.order.findMany({
      where: {
        status: { not: 'CANCELLED' },
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      },
      include: {
        Customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        OrderItem: {
          include: {
            Product: {
              select: {
                name: true,
                imageUrl: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    console.log('✅ [DAILY ORDERS] Encontradas', orders.length, 'vendas')

    return NextResponse.json({ orders })
  } catch (error) {
    console.error('❌ [DAILY ORDERS] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar vendas diárias' },
      { status: 500 }
    )
  }
}
