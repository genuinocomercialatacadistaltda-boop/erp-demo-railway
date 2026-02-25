export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

// GET: Listar clientes finais do cliente principal
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.userType !== 'CUSTOMER') {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    // Buscar o cliente principal pelo slug
    const mainCustomer = await prisma.customer.findUnique({
      where: { storeSlug: params.slug },
      select: { id: true }
    })

    if (!mainCustomer) {
      return NextResponse.json(
        { error: 'Loja não encontrada' },
        { status: 404 }
      )
    }

    // Verificar se o usuário logado é o dono da loja
    if (session.user.customerId !== mainCustomer.id) {
      return NextResponse.json(
        { error: 'Você não tem permissão para acessar esta loja' },
        { status: 403 }
      )
    }

    // Buscar clientes finais vinculados a este cliente principal
    const finalCustomers = await prisma.clientCustomer.findMany({
      where: { customerId: mainCustomer.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        pointsBalance: true,
        totalPointsEarned: true,
        pointsMultiplier: true,
        createdAt: true,
        _count: {
          select: {
            ClientCustomerOrders: true,
            ClientCustomerPointTransactions: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({
      customers: finalCustomers.map(customer => ({
        ...customer,
        createdAt: customer.createdAt.toISOString()
      }))
    })
  } catch (error) {
    console.error('[PUBLIC_STORE_CUSTOMERS_GET] Error:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar clientes' },
      { status: 500 }
    )
  }
}
