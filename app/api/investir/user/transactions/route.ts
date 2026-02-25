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
        console.log('[TRANSACTIONS] customerId encontrado no banco:', customerId)
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
      console.log('[TRANSACTIONS] Perfil de investidor não encontrado, criando automaticamente para customerId:', customerId)
      
      // Criar perfil automaticamente para o cliente
      investorProfile = await prisma.investorProfile.create({
        data: {
          customerId,
          balance: 0
        }
      })
      
      console.log('[TRANSACTIONS] Perfil de investidor criado com sucesso:', investorProfile.id)
    }

    // Buscar transações (compras e vendas)
    const transactions = await prisma.shareTransaction.findMany({
      where: { investorId: investorProfile.id },
      include: {
        company: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Buscar doações de ações
    const giftedShares = await prisma.investorGiftedShares.findMany({
      where: { investorId: investorProfile.id },
      include: {
        company: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        grantDate: 'desc'
      }
    })

    // Combinar e formatar os dados
    const history = [
      ...transactions.map(t => ({
        id: `transaction-${t.id}`,
        type: t.type,
        shares: Number(t.shares),
        price: t.price,
        totalValue: t.totalValue,
        createdAt: t.createdAt.toISOString(),
        company: t.company
      })),
      ...giftedShares.map(g => ({
        id: `gifted-${g.id}`,
        type: 'GIFTED' as const,
        shares: Number(g.shares),
        price: 0,
        totalValue: 0,
        vestingDate: g.vestingDate.toISOString(),
        description: g.description,
        createdAt: g.grantDate.toISOString(),
        company: g.company
      }))
    ]

    // Ordenar por data (mais recente primeiro)
    history.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    console.log(`[Transaction History] Investor ${investorProfile.id} - ${transactions.length} transactions, ${giftedShares.length} gifted shares, ${history.length} total items`)

    return NextResponse.json(history)
  } catch (error) {
    console.error('Erro ao buscar histórico:', error)
    return NextResponse.json({ error: 'Erro ao buscar histórico' }, { status: 500 })
  }
}
