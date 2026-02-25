import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { getImageUrl } from '@/lib/s3'

/**
 * API de Prêmios do Cliente
 * GET: Lista todos os prêmios do cliente autenticado
 * POST: Cria um novo prêmio
 */

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const userType = (session.user as any)?.userType
    const customerId = (session.user as any)?.customerId

    if (userType !== 'CUSTOMER' || !customerId) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    console.log(`[CLIENT_PRIZES_GET] Listando prêmios do cliente: ${customerId}`)

    // Buscar prêmios do cliente
    const prizes = await prisma.clientPrize.findMany({
      where: { customerId },
      include: {
        _count: {
          select: { Redemptions: true },
        },
      },
      orderBy: [
        { displayOrder: 'asc' },
        { name: 'asc' },
      ],
    })

    // Processar URLs das imagens (S3 -> URL assinada)
    const prizesWithImages = await Promise.all(
      prizes.map(async (prize) => {
        let imageUrl = prize.imageUrl
        if (imageUrl) {
          try {
            imageUrl = await getImageUrl(imageUrl)
          } catch (error) {
            console.error(`[CLIENT_PRIZES_GET] Erro ao processar imagem do prêmio ${prize.id}:`, error)
            imageUrl = '/placeholder-product.jpg'
          }
        }

        return {
          ...prize,
          imageUrl,
          redemptionsCount: prize._count.Redemptions,
        }
      })
    )

    console.log(`[CLIENT_PRIZES_GET] ${prizesWithImages.length} prêmios encontrados`)

    return NextResponse.json(prizesWithImages)
  } catch (error) {
    console.error('[CLIENT_PRIZES_GET_ERROR]', error)
    return NextResponse.json(
      { error: 'Erro ao buscar prêmios', details: (error as Error).message },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const userType = (session.user as any)?.userType
    const customerId = (session.user as any)?.customerId

    if (userType !== 'CUSTOMER' || !customerId) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await req.json()
    const {
      name,
      description,
      imageUrl,
      pointsCost,
      stockQuantity,
      isActive,
      category,
      displayOrder,
    } = body

    console.log('[CLIENT_PRIZES_POST] Criando prêmio:', { name, pointsCost, category })

    // Validações
    if (!name || !pointsCost) {
      return NextResponse.json(
        { error: 'Nome e custo em pontos são obrigatórios' },
        { status: 400 }
      )
    }

    if (pointsCost < 0) {
      return NextResponse.json(
        { error: 'Custo em pontos deve ser positivo' },
        { status: 400 }
      )
    }

    if (stockQuantity !== null && stockQuantity !== undefined && stockQuantity < 0) {
      return NextResponse.json(
        { error: 'Quantidade em estoque deve ser positiva ou nula (ilimitado)' },
        { status: 400 }
      )
    }

    // Criar prêmio
    const prize = await prisma.clientPrize.create({
      data: {
        customerId,
        name,
        description: description || null,
        imageUrl: imageUrl || null,
        pointsCost: parseInt(pointsCost),
        stockQuantity: stockQuantity !== null && stockQuantity !== undefined ? parseInt(stockQuantity) : null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        category: category || null,
        displayOrder: displayOrder !== null && displayOrder !== undefined ? parseInt(displayOrder) : 0,
      },
    })

    console.log(`[CLIENT_PRIZES_POST] Prêmio criado: ${prize.id}`)

    return NextResponse.json(prize, { status: 201 })
  } catch (error) {
    console.error('[CLIENT_PRIZES_POST_ERROR]', error)
    return NextResponse.json(
      { error: 'Erro ao criar prêmio', details: (error as Error).message },
      { status: 500 }
    )
  }
}
