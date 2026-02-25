export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET - Listar prêmios disponíveis para o cliente final
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params

    // Buscar o assador (dono da loja)
    const customer = await prisma.customer.findUnique({
      where: { storeSlug: slug },
      select: { id: true }
    })

    if (!customer) {
      return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 })
    }

    // Buscar prêmios ativos do assador
    const prizes = await prisma.clientPrize.findMany({
      where: {
        customerId: customer.id,
        isActive: true
      },
      orderBy: [
        { displayOrder: 'asc' },
        { pointsCost: 'asc' }
      ],
      select: {
        id: true,
        name: true,
        description: true,
        imageUrl: true,
        pointsCost: true,
        stockQuantity: true,
        category: true
      }
    })

    return NextResponse.json({ prizes })

  } catch (error) {
    console.error('Erro ao buscar prêmios:', error)
    return NextResponse.json({ error: 'Erro ao buscar prêmios' }, { status: 500 })
  }
}
