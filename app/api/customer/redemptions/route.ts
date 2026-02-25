import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET - Listar todos os resgates do assador
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

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const redemptions = await prisma.clientRedemption.findMany({
      where: {
        customerId: user.Customer.id,
        ...(status && { status })
      },
      include: {
        ClientCustomer: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true
          }
        },
        Prize: {
          select: {
            name: true,
            description: true,
            imageUrl: true,
            pointsCost: true
          }
        }
      },
      orderBy: {
        requestedAt: 'desc'
      }
    })

    return NextResponse.json({ redemptions })

  } catch (error) {
    console.error('Erro ao buscar resgates:', error)
    return NextResponse.json({ error: 'Erro ao buscar resgates' }, { status: 500 })
  }
}
