import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// Token expira em 5 minutos
const TOKEN_EXPIRY_MS = 5 * 60 * 1000

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    console.log('[SSO_TOKEN] Gerando token para usuário:', session.user.email)

    // Buscar customerId
    let customerId = (session.user as any).customerId
    
    // Fallback para tokens antigos - buscar no banco
    if (!customerId && session.user.id) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { customerId: true }
      })
      if (user?.customerId) {
        customerId = user.customerId
        console.log('[SSO_TOKEN] customerId encontrado no banco:', customerId)
      }
    }
    
    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID não encontrado.' }, { status: 400 })
    }

    // Buscar dados completos do customer
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        User: {
          select: {
            id: true,
            email: true
          }
        }
      }
    })

    if (!customer) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    }

    // Gerar token único e seguro
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS)

    console.log('[SSO_TOKEN] Token gerado:', token.substring(0, 8) + '...')
    console.log('[SSO_TOKEN] Expira em:', expiresAt.toISOString())

    // Salvar token temporário no banco
    // Vamos criar uma tabela simples para tokens SSO
    // Como não temos a tabela ainda, vou usar uma abordagem diferente
    // Vou criar um JWT token que contém os dados do usuário
    
    const jwt = require('jsonwebtoken')
    const ssoToken = jwt.sign(
      {
        customerId: customer.id,
        userId: customer.User?.id,
        email: customer.email || customer.User?.email,
        name: customer.name,
        phone: customer.phone,
        exp: Math.floor(Date.now() / 1000) + (5 * 60) // 5 minutos
      },
      process.env.NEXTAUTH_SECRET || 'fallback-secret'
    )

    console.log('[SSO_TOKEN] Token JWT criado com sucesso')

    return NextResponse.json({ 
      token: ssoToken,
      expiresAt: expiresAt.toISOString()
    })
  } catch (error) {
    console.error('[SSO_TOKEN] Erro ao gerar token:', error)
    return NextResponse.json({ error: 'Erro ao gerar token SSO' }, { status: 500 })
  }
}
