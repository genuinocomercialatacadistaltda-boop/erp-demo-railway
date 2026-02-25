import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    console.log('[ADMIN_INVESTORS] Buscando investidores...')

    const investors = await prisma.investorProfile.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        Customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        portfolios: {
          include: {
            company: {
              select: {
                name: true,
                currentPrice: true
              }
            }
          }
        },
        _count: {
          select: {
            transactions: true,
            deposits: true,
            withdrawals: true
          }
        }
      }
    })

    // Calcular valor total do portfolio para cada investidor
    const investorsWithValue = investors.map(investor => {
      const portfolioValue = investor.portfolios.reduce((sum, p) => {
        return sum + (Number(p.shares) * p.company.currentPrice)
      }, 0)

      return {
        ...investor,
        portfolioValue,
        portfolios: investor.portfolios.map(p => ({
          ...p,
          shares: p.shares.toString()
        }))
      }
    })

    console.log('[ADMIN_INVESTORS] Encontrados', investors.length, 'investidores')

    return NextResponse.json(investorsWithValue)
  } catch (error) {
    console.error('[ADMIN_INVESTORS] Erro ao buscar investidores:', error)
    return NextResponse.json({ error: 'Erro ao buscar investidores' }, { status: 500 })
  }
}
