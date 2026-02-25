import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'

interface SSOTokenPayload {
  customerId: string
  userId?: string
  email: string
  name: string
  phone?: string
  exp: number
}

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json()

    if (!token) {
      return NextResponse.json({ error: 'Token não fornecido' }, { status: 400 })
    }

    console.log('[SSO_VALIDATE] Validando token...')

    // Verificar e decodificar o token JWT
    let decoded: SSOTokenPayload
    try {
      decoded = jwt.verify(
        token,
        process.env.NEXTAUTH_SECRET || 'fallback-secret'
      ) as SSOTokenPayload
    } catch (error: any) {
      console.error('[SSO_VALIDATE] Token inválido:', error.message)
      return NextResponse.json({ error: 'Token inválido ou expirado' }, { status: 401 })
    }

    console.log('[SSO_VALIDATE] Token válido para:', decoded.email)
    console.log('[SSO_VALIDATE] CustomerId:', decoded.customerId)

    // Buscar o cliente
    const customer = await prisma.customer.findUnique({
      where: { id: decoded.customerId },
      include: {
        User: {
          select: {
            id: true,
            email: true
          }
        },
        InvestorProfile: true
      }
    })

    if (!customer) {
      console.error('[SSO_VALIDATE] Cliente não encontrado:', decoded.customerId)
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    }

    console.log('[SSO_VALIDATE] Cliente encontrado:', customer.name)

    // Criar InvestorProfile se não existir
    if (!customer.InvestorProfile) {
      console.log('[SSO_VALIDATE] InvestorProfile não existe, criando...')
      
      try {
        const investorProfile = await prisma.investorProfile.create({
          data: {
            customerId: customer.id,
            balance: 0
          }
        })
        console.log('[SSO_VALIDATE] InvestorProfile criado com sucesso:', investorProfile.id)
      } catch (error: any) {
        console.error('[SSO_VALIDATE] Erro ao criar InvestorProfile:', error.message)
        // Não bloquear o login se falhar a criação do perfil
        // O perfil pode ser criado depois
      }
    } else {
      console.log('[SSO_VALIDATE] InvestorProfile já existe:', customer.InvestorProfile.id)
    }

    // Retornar dados do usuário
    return NextResponse.json({
      userData: {
        customerId: customer.id,
        userId: customer.User?.id,
        email: customer.email || customer.User?.email,
        name: customer.name,
        phone: customer.phone
      }
    })
  } catch (error: any) {
    console.error('[SSO_VALIDATE] Erro ao validar token:', error)
    return NextResponse.json({ error: 'Erro ao validar token' }, { status: 500 })
  }
}
