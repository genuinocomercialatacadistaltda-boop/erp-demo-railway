export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

// POST: Ajustar pontos de um cliente final
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string; customerId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.userType !== 'CUSTOMER') {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const { points, reason, type } = await req.json()

    if (!points || !reason || !type) {
      return NextResponse.json(
        { error: 'Dados incompletos' },
        { status: 400 }
      )
    }

    if (type !== 'ADD' && type !== 'SUBTRACT') {
      return NextResponse.json(
        { error: 'Tipo inválido. Use ADD ou SUBTRACT' },
        { status: 400 }
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
        { error: 'Você não tem permissão' },
        { status: 403 }
      )
    }

    // Buscar cliente final
    const finalCustomer = await prisma.clientCustomer.findFirst({
      where: {
        id: params.customerId,
        customerId: mainCustomer.id
      }
    })

    if (!finalCustomer) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      )
    }

    // Calcular novos pontos
    const pointsValue = parseInt(points)
    const currentPoints = finalCustomer.pointsBalance
    let newPoints = currentPoints

    if (type === 'ADD') {
      newPoints = currentPoints + pointsValue
    } else {
      newPoints = Math.max(0, currentPoints - pointsValue) // Não permitir pontos negativos
    }

    // Atualizar pontos e criar transação
    await prisma.$transaction([
      prisma.clientCustomer.update({
        where: { id: params.customerId },
        data: {
          pointsBalance: newPoints,
          totalPointsEarned: type === 'ADD' 
            ? finalCustomer.totalPointsEarned + pointsValue
            : finalCustomer.totalPointsEarned
        }
      }),
      prisma.clientCustomerPointTransaction.create({
        data: {
          clientCustomerId: params.customerId,
          customerId: mainCustomer.id,
          amount: type === 'ADD' ? pointsValue : -pointsValue,
          balance: newPoints,
          type: type === 'ADD' ? 'ADJUSTMENT' : 'ADJUSTMENT',
          description: reason
        }
      })
    ])

    console.log(`[POINTS_ADJUSTMENT] Cliente: ${finalCustomer.name}, Tipo: ${type}, Pontos: ${pointsValue}, Motivo: ${reason}`)

    return NextResponse.json({
      success: true,
      message: `Pontos ${type === 'ADD' ? 'adicionados' : 'removidos'} com sucesso`,
      newBalance: newPoints
    })
  } catch (error) {
    console.error('[POINTS_ADJUSTMENT] Error:', error)
    return NextResponse.json(
      { error: 'Erro ao ajustar pontos' },
      { status: 500 }
    )
  }
}

// GET: Buscar histórico de pontos
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string; customerId: string } }
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

    // Verificar permissão
    if (session.user.customerId !== mainCustomer.id) {
      return NextResponse.json(
        { error: 'Você não tem permissão' },
        { status: 403 }
      )
    }

    // Buscar transações de pontos
    const transactions = await prisma.clientCustomerPointTransaction.findMany({
      where: { clientCustomerId: params.customerId },
      orderBy: { createdAt: 'desc' },
      take: 50 // Últimas 50 transações
    })

    return NextResponse.json({
      transactions: transactions.map(t => ({
        ...t,
        createdAt: t.createdAt.toISOString()
      }))
    })
  } catch (error) {
    console.error('[POINTS_HISTORY] Error:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar histórico' },
      { status: 500 }
    )
  }
}
