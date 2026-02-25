import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Buscar customerId (suporta tokens antigos e novos)
    let customerId = (session.user as any).customerId
    
    // Fallback para tokens antigos - buscar no banco
    if (!customerId && session.user.id) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { customerId: true }
      })
      if (user?.customerId) {
        customerId = user.customerId
        console.log('[PORTFOLIO] customerId encontrado no banco:', customerId)
      }
    }
    
    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID não encontrado.' }, { status: 400 })
    }

    // Buscar ou criar perfil de investidor automaticamente
    let investorProfile = await prisma.investorProfile.findUnique({
      where: { customerId },
    })

    if (!investorProfile) {
      console.log('[PORTFOLIO] Perfil de investidor não encontrado, criando automaticamente para customerId:', customerId)
      
      // Criar perfil automaticamente para o cliente
      investorProfile = await prisma.investorProfile.create({
        data: {
          customerId,
          balance: 0
        }
      })
      
      console.log('[PORTFOLIO] Perfil de investidor criado com sucesso:', investorProfile.id)
    }

    // Buscar portfolio completo com detalhes de ações doadas
    const portfolios = await prisma.investorPortfolio.findMany({
      where: { investorId: investorProfile.id },
      include: {
        company: true,
      },
    })

    // Buscar empresas com ações doadas mas sem portfolio
    const giftedSharesOnly = await prisma.investorGiftedShares.findMany({
      where: {
        investorId: investorProfile.id,
        companyId: {
          notIn: portfolios.map(p => p.companyId)
        }
      },
      include: {
        company: true
      }
    })

    // Adicionar portfolios virtuais para empresas com apenas ações doadas
    const virtualPortfolios = giftedSharesOnly.reduce((acc: any[], giftedShare) => {
      const existingCompany = acc.find(p => p.companyId === giftedShare.companyId)
      if (!existingCompany) {
        acc.push({
          id: `virtual-${giftedShare.companyId}`,
          investorId: investorProfile.id,
          companyId: giftedShare.companyId,
          shares: BigInt(0),
          avgPrice: 0,
          company: giftedShare.company
        })
      }
      return acc
    }, [])

    const allPortfolios = [...portfolios, ...virtualPortfolios]

    const detailedPortfolios = await Promise.all(
      allPortfolios.map(async (portfolio) => {
        // Buscar ações doadas para esta empresa
        const giftedShares = await prisma.investorGiftedShares.findMany({
          where: {
            investorId: investorProfile.id,
            companyId: portfolio.companyId,
          },
          orderBy: {
            vestingDate: 'asc',
          },
        })

        const totalGiftedShares = giftedShares.reduce(
          (sum, gift) => sum + Number(gift.shares),
          0
        )

        // Calcular ações compradas corretamente
        const portfolioShares = Number(portfolio.shares) || 0
        const purchasedShares = portfolioShares - totalGiftedShares

        // Separar ações liberadas e bloqueadas
        const now = new Date()
        const vestedShares = giftedShares
          .filter((gift) => new Date(gift.vestingDate) <= now)
          .reduce((sum, gift) => sum + Number(gift.shares), 0)

        const unvestedShares = giftedShares
          .filter((gift) => new Date(gift.vestingDate) > now)
          .reduce((sum, gift) => sum + Number(gift.shares), 0)

        const totalShares = portfolioShares

        return {
          ...portfolio,
          shares: totalShares,
          purchasedShares: purchasedShares >= 0 ? purchasedShares : 0,
          giftedShares: totalGiftedShares,
          vestedShares: vestedShares,
          unvestedShares: unvestedShares,
          sellableShares: purchasedShares >= 0 ? purchasedShares + vestedShares : vestedShares,
          avgPrice: Number(portfolio.avgPrice) || 0,
          giftedSharesDetails: giftedShares.map((gift) => ({
            id: gift.id,
            shares: Number(gift.shares),
            vestingDate: gift.vestingDate,
            grantDate: gift.grantDate,
            description: gift.description,
            isVested: new Date(gift.vestingDate) <= now,
          })),
        }
      })
    )

    // Filtrar portfolios com ações > 0
    const filteredPortfolios = detailedPortfolios.filter(p => p.shares > 0)

    console.log(`[Portfolio Details] Investor ${investorProfile.id} - ${filteredPortfolios.length} portfolios found`)

    return NextResponse.json(filteredPortfolios)
  } catch (error) {
    console.error('Erro ao buscar detalhes do portfolio:', error)
    return NextResponse.json({ error: 'Erro ao buscar detalhes do portfolio' }, { status: 500 })
  }
}
