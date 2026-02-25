export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET - Listar resgates do cliente final
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params
    const { searchParams } = new URL(request.url)
    const clientCustomerId = searchParams.get('clientCustomerId')

    if (!clientCustomerId) {
      return NextResponse.json({ error: 'ID do cliente não fornecido' }, { status: 400 })
    }

    // Buscar o assador (dono da loja)
    const customer = await prisma.customer.findUnique({
      where: { storeSlug: slug },
      select: { id: true }
    })

    if (!customer) {
      return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 })
    }

    // Buscar resgates do cliente
    const redemptions = await prisma.clientRedemption.findMany({
      where: {
        clientCustomerId,
        customerId: customer.id
      },
      include: {
        Prize: {
          select: {
            name: true,
            description: true,
            imageUrl: true
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
