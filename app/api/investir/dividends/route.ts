import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
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
        console.log('[DIVIDENDS_GET] customerId encontrado no banco:', customerId)
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
      console.log('[DIVIDENDS_GET] Perfil de investidor não encontrado, criando automaticamente para customerId:', customerId)
      
      investorProfile = await prisma.investorProfile.create({
        data: {
          customerId,
          balance: 0
        }
      })
      
      console.log('[DIVIDENDS_GET] Perfil de investidor criado:', investorProfile.id)
    }

    const dividendPayments = await prisma.investorDividendPayment.findMany({
      where: { investorId: investorProfile.id },
      include: {
        dividend: {
          include: {
            company: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(dividendPayments)
  } catch (error) {
    console.error('Erro ao buscar dividendos:', error)
    return NextResponse.json({ error: 'Erro ao buscar dividendos' }, { status: 500 })
  }
}
