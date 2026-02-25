import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Carregar credenciais do Mercado Pago
const MERCADO_PAGO_ACCESS_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN || ''

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
        console.log('[DEPOSITS_GET] customerId encontrado no banco:', customerId)
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
      console.log('[DEPOSITS_GET] Perfil de investidor não encontrado, criando automaticamente para customerId:', customerId)
      
      investorProfile = await prisma.investorProfile.create({
        data: {
          customerId,
          balance: 0
        }
      })
      
      console.log('[DEPOSITS_GET] Perfil de investidor criado:', investorProfile.id)
    }

    const deposits = await prisma.investorDeposit.findMany({
      where: { investorId: investorProfile.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(deposits)
  } catch (error) {
    console.error('Erro ao buscar depósitos:', error)
    return NextResponse.json({ error: 'Erro ao buscar depósitos' }, { status: 500 })
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
        console.log('[DEPOSITS_POST] customerId encontrado no banco:', customerId)
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
      console.log('[DEPOSITS_POST] Criando perfil de investidor para customerId:', customerId)
      
      investorProfile = await prisma.investorProfile.create({
        data: {
          customerId,
          balance: 0
        }
      })
    }

    const { amount } = await req.json()

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
    }

    // Criar depósito no banco de dados
    const deposit = await prisma.investorDeposit.create({
      data: {
        investorId: investorProfile.id,
        amount: parseFloat(amount),
        status: 'PENDING',
      },
    })

    // Criar preferência de pagamento no Mercado Pago
    const preference = {
      items: [
        {
          title: 'Depósito Bolsa de Investimentos',
          quantity: 1,
          unit_price: parseFloat(amount),
          currency_id: 'BRL',
        },
      ],
      back_urls: {
        success: `${process.env.NEXTAUTH_URL}/investir/dashboard?deposit_success=true`,
        failure: `${process.env.NEXTAUTH_URL}/investir/dashboard?deposit_failure=true`,
        pending: `${process.env.NEXTAUTH_URL}/investir/dashboard?deposit_pending=true`,
      },
      auto_return: 'approved',
      external_reference: deposit.id.toString(),
      notification_url: `${process.env.NEXTAUTH_URL}/api/investir/webhooks/mercadopago`,
    }

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preference),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Erro do Mercado Pago:', errorData)
      throw new Error('Erro ao criar preferência de pagamento')
    }

    const data = await response.json()

    // Atualizar depósito com ID do Mercado Pago
    await prisma.investorDeposit.update({
      where: { id: deposit.id },
      data: { mercadoPagoId: data.id },
    })

    // PRODUÇÃO REAL - Usar apenas init_point (não sandbox)
    return NextResponse.json({
      depositId: deposit.id,
      initPoint: data.init_point, // URL de produção real
    })
  } catch (error) {
    console.error('Erro ao criar depósito:', error)
    return NextResponse.json({ error: 'Erro ao criar depósito' }, { status: 500 })
  }
}
