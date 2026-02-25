export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { getImageUrl } from '@/lib/s3'

/**
 * API de Prêmio Específico do Cliente
 * GET: Busca um prêmio específico
 * PUT: Atualiza um prêmio
 * DELETE: Exclui um prêmio
 */

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const prizeId = params.id
    console.log(`[CLIENT_PRIZE_GET] Buscando prêmio: ${prizeId}`)

    const prize = await prisma.clientPrize.findUnique({
      where: { id: prizeId },
      include: {
        _count: {
          select: { Redemptions: true },
        },
      },
    })

    if (!prize) {
      return NextResponse.json({ error: 'Prêmio não encontrado' }, { status: 404 })
    }

    // Verificar se o prêmio pertence ao cliente
    if (prize.customerId !== customerId) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    // Processar URL da imagem
    let imageUrl = prize.imageUrl
    if (imageUrl) {
      try {
        imageUrl = await getImageUrl(imageUrl)
      } catch (error) {
        console.error(`[CLIENT_PRIZE_GET] Erro ao processar imagem:`, error)
        imageUrl = '/placeholder-product.jpg'
      }
    }

    return NextResponse.json({
      ...prize,
      imageUrl,
      redemptionsCount: prize._count.Redemptions,
    })
  } catch (error) {
    console.error('[CLIENT_PRIZE_GET_ERROR]', error)
    return NextResponse.json(
      { error: 'Erro ao buscar prêmio', details: (error as Error).message },
      { status: 500 }
    )
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const prizeId = params.id
    const body = await req.json()

    console.log(`[CLIENT_PRIZE_PUT] Atualizando prêmio: ${prizeId}`, body)

    // Verificar se o prêmio existe e pertence ao cliente
    const existingPrize = await prisma.clientPrize.findUnique({
      where: { id: prizeId },
    })

    if (!existingPrize) {
      return NextResponse.json({ error: 'Prêmio não encontrado' }, { status: 404 })
    }

    if (existingPrize.customerId !== customerId) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    // Validações
    if (body.pointsCost !== undefined && body.pointsCost < 0) {
      return NextResponse.json(
        { error: 'Custo em pontos deve ser positivo' },
        { status: 400 }
      )
    }

    if (body.stockQuantity !== null && body.stockQuantity !== undefined && body.stockQuantity < 0) {
      return NextResponse.json(
        { error: 'Quantidade em estoque deve ser positiva ou nula (ilimitado)' },
        { status: 400 }
      )
    }

    // Preparar dados para atualização
    const updateData: any = {}

    if (body.name !== undefined) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description || null
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl || null
    if (body.pointsCost !== undefined) updateData.pointsCost = parseInt(body.pointsCost)
    if (body.stockQuantity !== undefined) {
      updateData.stockQuantity = body.stockQuantity !== null && body.stockQuantity !== '' 
        ? parseInt(body.stockQuantity) 
        : null
    }
    if (body.isActive !== undefined) updateData.isActive = Boolean(body.isActive)
    if (body.category !== undefined) updateData.category = body.category || null
    if (body.displayOrder !== undefined) updateData.displayOrder = parseInt(body.displayOrder) || 0

    // Atualizar prêmio
    const prize = await prisma.clientPrize.update({
      where: { id: prizeId },
      data: updateData,
    })

    console.log(`[CLIENT_PRIZE_PUT] Prêmio atualizado: ${prize.id}`)

    return NextResponse.json(prize)
  } catch (error) {
    console.error('[CLIENT_PRIZE_PUT_ERROR]', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar prêmio', details: (error as Error).message },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const prizeId = params.id
    console.log(`[CLIENT_PRIZE_DELETE] Excluindo prêmio: ${prizeId}`)

    // Verificar se o prêmio existe e pertence ao cliente
    const prize = await prisma.clientPrize.findUnique({
      where: { id: prizeId },
      include: {
        _count: {
          select: {
            Redemptions: {
              where: {
                status: { in: ['PENDING', 'APPROVED'] },
              },
            },
          },
        },
      },
    })

    if (!prize) {
      return NextResponse.json({ error: 'Prêmio não encontrado' }, { status: 404 })
    }

    if (prize.customerId !== customerId) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    // Verificar se há resgates pendentes ou aprovados
    if (prize._count.Redemptions > 0) {
      return NextResponse.json(
        {
          error: 'Não é possível excluir prêmio com resgates pendentes ou aprovados',
          details: `Existem ${prize._count.Redemptions} resgates pendentes/aprovados`,
        },
        { status: 400 }
      )
    }

    // Excluir prêmio
    await prisma.clientPrize.delete({
      where: { id: prizeId },
    })

    console.log(`[CLIENT_PRIZE_DELETE] Prêmio excluído: ${prizeId}`)

    return NextResponse.json({ message: 'Prêmio excluído com sucesso' })
  } catch (error) {
    console.error('[CLIENT_PRIZE_DELETE_ERROR]', error)
    return NextResponse.json(
      { error: 'Erro ao excluir prêmio', details: (error as Error).message },
      { status: 500 }
    )
  }
}
