
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

// GET - Listar todos os vendedores (Admin only)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const sellers = await prisma.seller.findMany({
      include: {
        User: {
          select: {
            id: true,
            email: true,
            name: true
          }
        },
        _count: {
          select: {
            Customer: true,
            Order: true,
            Commission: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Calcular comissões totais e pendentes para cada vendedor
    const sellersWithStats = await Promise.all(
      sellers.map(async (seller) => {
        const commissions = await prisma.commission.aggregate({
          where: { sellerId: seller.id },
          _sum: { amount: true }
        })
        
        const pendingCommissions = await prisma.commission.aggregate({
          where: { 
            sellerId: seller.id,
            status: 'PENDING'
          },
          _sum: { amount: true }
        })

        return {
          ...seller,
          totalCommissions: commissions._sum.amount || 0,
          pendingCommissions: pendingCommissions._sum.amount || 0
        }
      })
    )

    return NextResponse.json(sellersWithStats)
  } catch (error) {
    console.error('Error fetching sellers:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar vendedores' },
      { status: 500 }
    )
  }
}

// POST - Criar novo vendedor (Admin only)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const { name, email, phone, cpf, password, commissionRate, maxDiscountRate } = body

    console.log('[SELLERS_API] Tentando criar vendedor:', { name, email, phone, cpf, commissionRate, maxDiscountRate })

    // Validações básicas
    if (!name || !email || !phone || !cpf || !password) {
      console.log('[SELLERS_API] ❌ Campos obrigatórios faltando:', { name: !!name, email: !!email, phone: !!phone, cpf: !!cpf, password: !!password })
      return NextResponse.json(
        { error: 'Todos os campos obrigatórios devem ser preenchidos (nome, email, telefone, CPF, senha)' },
        { status: 400 }
      )
    }

    // Verificar se já existe usuário com este email
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      console.log('[SELLERS_API] ❌ Email já cadastrado:', email)
      return NextResponse.json(
        { error: 'Email já cadastrado' },
        { status: 400 }
      )
    }

    // Verificar se já existe vendedor com este CPF
    const existingSeller = await prisma.seller.findUnique({
      where: { cpf }
    })

    if (existingSeller) {
      console.log('[SELLERS_API] ❌ CPF já cadastrado:', cpf)
      return NextResponse.json(
        { error: 'CPF já cadastrado' },
        { status: 400 }
      )
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10)

    // Criar vendedor e usuário em uma transação
    const result = await prisma.$transaction(async (tx: any) => {
      // Criar vendedor
      const seller = await tx.seller.create({
        data: {
          id: crypto.randomUUID(),
          name,
          email,
          phone,
          cpf,
          commissionRate: commissionRate || 1.0,
          maxDiscountRate: maxDiscountRate || 10.0,
          updatedAt: new Date()
        }
      })

      // Criar usuário vinculado ao vendedor
      const user = await tx.user.create({
        data: {
          id: crypto.randomUUID(),
          name,
          email,
          password: hashedPassword,
          userType: 'SELLER',
          sellerId: seller.id,
          updatedAt: new Date()
        }
      })

      return { seller, user }
    })

    console.log('[SELLERS_API] ✅ Vendedor criado com sucesso:', result.seller.id)
    return NextResponse.json({
      message: 'Vendedor criado com sucesso',
      seller: result.seller
    })
  } catch (error: any) {
    console.error('[SELLERS_API] ❌ Erro ao criar vendedor:', error)
    console.error('[SELLERS_API] Error message:', error?.message)
    console.error('[SELLERS_API] Error code:', error?.code)
    return NextResponse.json(
      { error: error?.message || 'Erro ao criar vendedor' },
      { status: 500 }
    )
  }
}
