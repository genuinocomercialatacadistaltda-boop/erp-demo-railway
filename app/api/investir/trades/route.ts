import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
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
        console.log('[TRADES] customerId encontrado no banco:', customerId)
      }
    }
    
    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID não encontrado.' }, { status: 400 })
    }
    
    const { companyId, shares, type } = await request.json()

    if (!companyId || !shares || !type || shares <= 0) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    // Buscar ou criar perfil de investidor automaticamente
    let investorProfile = await prisma.investorProfile.findUnique({
      where: { customerId }
    })

    if (!investorProfile) {
      console.log('[TRADES] Perfil de investidor não encontrado, criando automaticamente para customerId:', customerId)
      
      investorProfile = await prisma.investorProfile.create({
        data: {
          customerId,
          balance: 0
        }
      })
      
      console.log('[TRADES] Perfil de investidor criado com sucesso:', investorProfile.id)
    }

    // Buscar empresa
    const company = await prisma.investmentCompany.findUnique({ 
      where: { id: companyId } 
    })

    if (!company) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })
    }

    const totalValue = shares * company.currentPrice

    if (type === 'BUY') {
      // Verificar saldo
      if (investorProfile.balance < totalValue) {
        return NextResponse.json({ error: 'Saldo insuficiente' }, { status: 400 })
      }

      // Algoritmo simples de oferta/demanda: aumentar preço em compras
      const totalSharesNum = Number(company.totalShares)
      const priceIncrease = (shares / totalSharesNum) * 0.01 // 1% de aumento baseado no volume
      const newPrice = company.currentPrice * (1 + priceIncrease)

      await prisma.$transaction(async (tx) => {
        // Debitar saldo
        await tx.investorProfile.update({
          where: { id: investorProfile.id },
          data: { balance: investorProfile.balance - totalValue }
        })

        // Atualizar ou criar portfolio
        const existingPortfolio = await tx.investorPortfolio.findUnique({
          where: { investorId_companyId: { investorId: investorProfile.id, companyId } }
        })

        if (existingPortfolio) {
          const totalShares = Number(existingPortfolio.shares) + shares
          const newAvgPrice = ((Number(existingPortfolio.shares) * existingPortfolio.avgPrice) + totalValue) / totalShares

          await tx.investorPortfolio.update({
            where: { id: existingPortfolio.id },
            data: {
              shares: totalShares,
              avgPrice: newAvgPrice
            }
          })
        } else {
          await tx.investorPortfolio.create({
            data: {
              investorId: investorProfile.id,
              companyId,
              shares,
              avgPrice: company.currentPrice
            }
          })
        }

        // Criar transação
        await tx.shareTransaction.create({
          data: {
            investorId: investorProfile.id,
            companyId,
            type: 'BUY',
            shares,
            price: company.currentPrice,
            totalValue
          }
        })

        // Atualizar preço da empresa
        await tx.investmentCompany.update({
          where: { id: companyId },
          data: { 
            currentPrice: newPrice,
            valuation: totalSharesNum * newPrice
          }
        })

        // Adicionar ao histórico de preços
        await tx.sharePriceHistory.create({
          data: {
            companyId,
            price: newPrice
          }
        })
      })

    } else if (type === 'SELL') {
      // Verificar se possui ações suficientes
      const portfolio = await prisma.investorPortfolio.findUnique({
        where: { investorId_companyId: { investorId: investorProfile.id, companyId } }
      })

      if (!portfolio || Number(portfolio.shares) < shares) {
        return NextResponse.json({ error: 'Ações insuficientes' }, { status: 400 })
      }

      // Verificar ações doadas e suas datas de vesting
      const giftedShares = await prisma.investorGiftedShares.findMany({
        where: {
          investorId: investorProfile.id,
          companyId,
        },
        orderBy: {
          vestingDate: 'asc',
        },
      })

      const now = new Date()
      
      // Calcular total de ações doadas
      const totalGiftedShares = giftedShares.reduce(
        (sum, gift) => sum + gift.shares,
        BigInt(0)
      )

      // Calcular ações compradas (que podem ser vendidas livremente)
      const purchasedShares = portfolio.shares - totalGiftedShares

      // Calcular ações doadas já liberadas (vested)
      const vestedShares = giftedShares
        .filter((gift) => new Date(gift.vestingDate) <= now)
        .reduce((sum, gift) => sum + gift.shares, BigInt(0))

      // Total de ações que podem ser vendidas
      const sellableShares = purchasedShares + vestedShares

      if (sellableShares < BigInt(shares)) {
        const unvestedShares = totalGiftedShares - vestedShares
        const nextVestingDate = giftedShares.find(
          (gift) => new Date(gift.vestingDate) > now
        )?.vestingDate

        let errorMessage = `Você possui ${Number(sellableShares)} ações disponíveis para venda.`
        if (unvestedShares > BigInt(0)) {
          errorMessage += ` ${Number(unvestedShares)} ações ainda estão bloqueadas`
          if (nextVestingDate) {
            errorMessage += ` até ${new Date(nextVestingDate).toLocaleDateString('pt-BR')}`
          }
          errorMessage += '.'
        }

        return NextResponse.json({ error: errorMessage }, { status: 400 })
      }

      // Algoritmo simples de oferta/demanda: diminuir preço em vendas
      const totalSharesNum = Number(company.totalShares)
      const priceDecrease = (shares / totalSharesNum) * 0.005 // 0.5% de diminuição baseado no volume
      const newPrice = Math.max(company.currentPrice * (1 - priceDecrease), company.currentPrice * 0.5) // Mínimo 50% do preço atual

      await prisma.$transaction(async (tx) => {
        // Creditar saldo
        await tx.investorProfile.update({
          where: { id: investorProfile.id },
          data: { balance: investorProfile.balance + totalValue }
        })

        // Atualizar portfolio
        const remainingShares = Number(portfolio.shares) - shares
        if (remainingShares === 0) {
          await tx.investorPortfolio.delete({
            where: { id: portfolio.id }
          })
        } else {
          await tx.investorPortfolio.update({
            where: { id: portfolio.id },
            data: { shares: remainingShares }
          })
        }

        // Criar transação
        await tx.shareTransaction.create({
          data: {
            investorId: investorProfile.id,
            companyId,
            type: 'SELL',
            shares,
            price: company.currentPrice,
            totalValue
          }
        })

        // Atualizar preço da empresa
        await tx.investmentCompany.update({
          where: { id: companyId },
          data: { 
            currentPrice: newPrice,
            valuation: totalSharesNum * newPrice
          }
        })

        // Adicionar ao histórico de preços
        await tx.sharePriceHistory.create({
          data: {
            companyId,
            price: newPrice
          }
        })
      })
    }

    return NextResponse.json({ message: 'Transação realizada com sucesso' })
  } catch (error) {
    console.error('Erro na transação:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
