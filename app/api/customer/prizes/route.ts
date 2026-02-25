export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET - Listar todos os prêmios do assador
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { Customer: true }
    })

    if (!user?.Customer?.id || user.userType !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const prizes = await prisma.clientPrize.findMany({
      where: {
        customerId: user.Customer.id
      },
      orderBy: [
        { displayOrder: 'asc' },
        { createdAt: 'desc' }
      ]
    })

    return NextResponse.json({ prizes })

  } catch (error) {
    console.error('Erro ao buscar prêmios:', error)
    return NextResponse.json({ error: 'Erro ao buscar prêmios' }, { status: 500 })
  }
}

// POST - Criar novo prêmio
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { Customer: true }
    })

    if (!user?.Customer?.id || user.userType !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, imageUrl, pointsCost, stockQuantity, category, displayOrder } = body

    if (!name || !pointsCost || pointsCost <= 0) {
      return NextResponse.json({ 
        error: 'Nome e custo em pontos são obrigatórios' 
      }, { status: 400 })
    }

    const prize = await prisma.clientPrize.create({
      data: {
        customerId: user.Customer.id,
        name,
        description: description || null,
        imageUrl: imageUrl || null,
        pointsCost: parseInt(pointsCost),
        stockQuantity: stockQuantity ? parseInt(stockQuantity) : null,
        category: category || null,
        displayOrder: displayOrder || 0,
        isActive: true
      }
    })

    return NextResponse.json({ prize }, { status: 201 })

  } catch (error) {
    console.error('Erro ao criar prêmio:', error)
    return NextResponse.json({ error: 'Erro ao criar prêmio' }, { status: 500 })
  }
}
