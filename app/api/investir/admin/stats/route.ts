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

    console.log('[ADMIN_STATS] Buscando estatísticas gerais...')

    // Estatísticas gerais
    const [totalInvestors, totalCompanies, totalTransactions, totalCapital] = await Promise.all([
      // Total de investidores
      prisma.investorProfile.count(),
      
      // Total de empresas
      prisma.investmentCompany.count(),
      
      // Total de transações
      prisma.shareTransaction.count(),
      
      // Capital total depositado
      prisma.investorProfile.aggregate({
        _sum: {
          balance: true
        }
      })
    ])

    // Transações recentes
    const recentTransactions = await prisma.shareTransaction.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        investor: {
          include: {
            Customer: {
              select: { name: true }
            }
          }
        },
        company: {
          select: { name: true }
        }
      }
    })

    // Empresas com mais transações
    const topCompanies = await prisma.shareTransaction.groupBy({
      by: ['companyId'],
      _count: { id: true },
      _sum: { shares: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5
    })

    const topCompaniesDetails = await Promise.all(
      topCompanies.map(async (tc) => {
        const company = await prisma.investmentCompany.findUnique({
          where: { id: tc.companyId }
        })
        return {
          ...tc,
          company
        }
      })
    )

    // Investidores com maior portfolio
    const topInvestors = await prisma.investorPortfolio.groupBy({
      by: ['investorId'],
      _sum: { shares: true },
      orderBy: { _sum: { shares: 'desc' } },
      take: 5
    })

    const topInvestorsDetails = await Promise.all(
      topInvestors.map(async (ti) => {
        const investor = await prisma.investorProfile.findUnique({
          where: { id: ti.investorId },
          include: {
            Customer: {
              select: { name: true, email: true }
            }
          }
        })
        return {
          ...ti,
          shares: ti._sum.shares?.toString() || '0',
          investor
        }
      })
    )

    console.log('[ADMIN_STATS] Estatísticas carregadas com sucesso')

    return NextResponse.json({
      totalInvestors,
      totalCompanies,
      totalTransactions,
      totalCapital: totalCapital._sum.balance || 0,
      recentTransactions: recentTransactions.map(t => ({
        ...t,
        shares: t.shares.toString()
      })),
      topCompanies: topCompaniesDetails.map(tc => ({
        ...tc,
        _sum: {
          shares: tc._sum.shares?.toString() || '0'
        },
        company: tc.company ? {
          ...tc.company,
          totalShares: tc.company.totalShares.toString()
        } : null
      })),
      topInvestors: topInvestorsDetails
    })
  } catch (error) {
    console.error('[ADMIN_STATS] Erro ao buscar estatísticas:', error)
    return NextResponse.json({ error: 'Erro ao buscar estatísticas' }, { status: 500 })
  }
}
