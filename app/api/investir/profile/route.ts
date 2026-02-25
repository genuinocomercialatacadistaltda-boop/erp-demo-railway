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
      console.log('[INVESTIR_PROFILE] customerId não encontrado no token, buscando no banco para userId:', session.user.id)
      
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { customerId: true }
      })
      
      if (user?.customerId) {
        customerId = user.customerId
        console.log('[INVESTIR_PROFILE] customerId encontrado no banco:', customerId)
      } else {
        console.error('[INVESTIR_PROFILE] Usuário não tem customerId associado')
      }
    }
    
    if (!customerId) {
      console.error('[INVESTIR_PROFILE] Erro: customerId não encontrado', {
        userId: session.user.id,
        hasCustomerId: !!(session.user as any).customerId
      })
      return NextResponse.json({ 
        error: 'Customer ID não encontrado. Este usuário não tem um perfil de cliente associado.' 
      }, { status: 400 })
    }
    
    console.log('[INVESTIR_PROFILE] Buscando perfil para customerId:', customerId)

    // Buscar ou criar perfil de investidor
    let investorProfile = await prisma.investorProfile.findUnique({
      where: { customerId },
      include: {
        Customer: {
          select: {
            name: true,
            email: true,
            phone: true
          }
        }
      }
    })

    if (!investorProfile) {
      // Criar perfil automaticamente
      investorProfile = await prisma.investorProfile.create({
        data: {
          customerId,
          balance: 0
        },
        include: {
          Customer: {
            select: {
              name: true,
              email: true,
              phone: true
            }
          }
        }
      })
    }

    return NextResponse.json(investorProfile)
  } catch (error) {
    console.error('Erro ao buscar perfil de investidor:', error)
    return NextResponse.json({ error: 'Erro ao buscar perfil' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const customerId = (session.user as any).customerId
    
    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID não encontrado na sessão' }, { status: 400 })
    }
    
    const data = await req.json()

    // Buscar perfil
    const investorProfile = await prisma.investorProfile.findUnique({
      where: { customerId }
    })

    if (!investorProfile) {
      return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })
    }

    // Atualizar dados bancários
    const updated = await prisma.investorProfile.update({
      where: { id: investorProfile.id },
      data: {
        bankName: data.bankName,
        accountType: data.accountType,
        accountNumber: data.accountNumber,
        accountAgency: data.accountAgency,
        accountHolder: data.accountHolder,
        pixKey: data.pixKey,
        pixKeyType: data.pixKeyType
      }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error)
    return NextResponse.json({ error: 'Erro ao atualizar perfil' }, { status: 500 })
  }
}
