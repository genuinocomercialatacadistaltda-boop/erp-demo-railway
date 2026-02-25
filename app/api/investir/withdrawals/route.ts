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
        console.log('[WITHDRAWALS_GET] customerId encontrado no banco:', customerId)
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
      console.log('[WITHDRAWALS_GET] Perfil de investidor não encontrado, criando automaticamente para customerId:', customerId)
      
      investorProfile = await prisma.investorProfile.create({
        data: {
          customerId,
          balance: 0
        }
      })
      
      console.log('[WITHDRAWALS_GET] Perfil de investidor criado:', investorProfile.id)
    }

    const withdrawals = await prisma.investorWithdrawal.findMany({
      where: { investorId: investorProfile.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(withdrawals)
  } catch (error) {
    console.error('Erro ao buscar saques:', error)
    return NextResponse.json({ error: 'Erro ao buscar saques' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
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
        console.log('[WITHDRAWALS_POST] customerId encontrado no banco:', customerId)
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
      console.log('[WITHDRAWALS_POST] Criando perfil de investidor para customerId:', customerId)
      
      investorProfile = await prisma.investorProfile.create({
        data: {
          customerId,
          balance: 0
        }
      })
    
      console.log('[WITHDRAWALS_POST] Perfil criado:', investorProfile.id)
    }

    const { amount, pixKey, pixKeyType } = await req.json()

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
    }

    if (!pixKey || !pixKeyType) {
      return NextResponse.json({ error: 'Chave PIX inválida' }, { status: 400 })
    }

    if (investorProfile.balance < amount) {
      return NextResponse.json({ error: 'Saldo insuficiente' }, { status: 400 })
    }

    // Criar solicitação de saque
    const withdrawal = await prisma.investorWithdrawal.create({
      data: {
        investorId: investorProfile.id,
        amount: parseFloat(amount),
        pixKey,
        pixKeyType,
        status: 'PENDING',
      },
    })

    // Deduzir saldo do investidor imediatamente (saldo ficará bloqueado até aprovação)
    await prisma.investorProfile.update({
      where: { id: investorProfile.id },
      data: { balance: investorProfile.balance - parseFloat(amount) },
    })

    return NextResponse.json({
      success: true,
      withdrawal,
      message: 'Solicitação de saque criada com sucesso. Aguarde aprovação do administrador.',
    })
  } catch (error) {
    console.error('Erro ao criar saque:', error)
    return NextResponse.json({ error: 'Erro ao criar saque' }, { status: 500 })
  }
}
