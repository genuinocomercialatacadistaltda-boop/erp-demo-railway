import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Listar ações doadas
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const giftedShares = await prisma.investorGiftedShares.findMany({
      orderBy: { grantDate: 'desc' },
      include: {
        investor: {
          include: {
            Customer: {
              select: { name: true, email: true }
            }
          }
        },
        company: {
          select: { name: true, currentPrice: true }
        }
      }
    })

    return NextResponse.json(
      giftedShares.map(gs => ({
        ...gs,
        shares: gs.shares.toString()
      }))
    )
  } catch (error) {
    console.error('[ADMIN_GIFTED] Erro ao buscar ações doadas:', error)
    return NextResponse.json({ error: 'Erro ao buscar ações doadas' }, { status: 500 })
  }
}

// Doar ações para investidor
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { investorId, companyId, shares, vestingDate, description } = await req.json()

    if (!investorId || !companyId || !shares || !vestingDate) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
    }

    console.log('[ADMIN_GIFTED] Doando', shares, 'ações para investidor:', investorId)

    await prisma.$transaction(async (tx) => {
      // Criar registro de ações doadas
      const giftedShare = await tx.investorGiftedShares.create({
        data: {
          investorId,
          companyId,
          shares,
          grantDate: new Date(),
          vestingDate: new Date(vestingDate),
          description: description || 'Ações doadas pelo admin'
        }
      })

      // Atualizar ou criar portfolio
      const existingPortfolio = await tx.investorPortfolio.findUnique({
        where: { investorId_companyId: { investorId, companyId } }
      })

      if (existingPortfolio) {
        await tx.investorPortfolio.update({
          where: { id: existingPortfolio.id },
          data: {
            shares: existingPortfolio.shares + BigInt(shares)
          }
        })
      } else {
        await tx.investorPortfolio.create({
          data: {
            investorId,
            companyId,
            shares,
            avgPrice: 0 // Ações doadas não têm preço médio
          }
        })
      }

      console.log('[ADMIN_GIFTED] Ações doadas com sucesso:', giftedShare.id)
    })

    return NextResponse.json({ message: 'Ações doadas com sucesso' })
  } catch (error) {
    console.error('[ADMIN_GIFTED] Erro ao doar ações:', error)
    return NextResponse.json({ error: 'Erro ao doar ações' }, { status: 500 })
  }
}
