export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// POST - Resgatar prêmio
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params
    const body = await request.json()
    const { clientCustomerId, prizeId, notes } = body

    if (!clientCustomerId || !prizeId) {
      return NextResponse.json({ 
        error: 'Dados incompletos' 
      }, { status: 400 })
    }

    // Buscar o assador (dono da loja)
    const customer = await prisma.customer.findUnique({
      where: { storeSlug: slug },
      select: { id: true }
    })

    if (!customer) {
      return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 })
    }

    // Buscar o cliente final
    const clientCustomer = await prisma.clientCustomer.findUnique({
      where: { id: clientCustomerId },
      select: {
        id: true,
        name: true,
        pointsBalance: true,
        customerId: true
      }
    })

    if (!clientCustomer || clientCustomer.customerId !== customer.id) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    }

    // Buscar o prêmio
    const prize = await prisma.clientPrize.findUnique({
      where: { id: prizeId },
      select: {
        id: true,
        name: true,
        pointsCost: true,
        stockQuantity: true,
        isActive: true,
        customerId: true
      }
    })

    if (!prize || prize.customerId !== customer.id) {
      return NextResponse.json({ error: 'Prêmio não encontrado' }, { status: 404 })
    }

    if (!prize.isActive) {
      return NextResponse.json({ error: 'Prêmio não disponível' }, { status: 400 })
    }

    // Verificar se o cliente tem pontos suficientes
    if (clientCustomer.pointsBalance < prize.pointsCost) {
      return NextResponse.json({ 
        error: 'Pontos insuficientes',
        required: prize.pointsCost,
        available: clientCustomer.pointsBalance
      }, { status: 400 })
    }

    // Verificar estoque
    if (prize.stockQuantity !== null && prize.stockQuantity <= 0) {
      return NextResponse.json({ error: 'Prêmio esgotado' }, { status: 400 })
    }

    // Criar a transação
    const result = await prisma.$transaction(async (tx) => {
      // Criar o resgate
      const redemption = await tx.clientRedemption.create({
        data: {
          clientCustomerId: clientCustomer.id,
          customerId: customer.id,
          prizeId: prize.id,
          pointsUsed: prize.pointsCost,
          status: 'PENDING',
          notes: notes || null
        }
      })

      // Atualizar pontos do cliente
      const newBalance = clientCustomer.pointsBalance - prize.pointsCost
      await tx.clientCustomer.update({
        where: { id: clientCustomer.id },
        data: {
          pointsBalance: newBalance
        }
      })

      // Registrar transação de pontos
      await tx.clientCustomerPointTransaction.create({
        data: {
          clientCustomerId: clientCustomer.id,
          customerId: customer.id,
          type: 'REDEEMED',
          amount: -prize.pointsCost,
          balance: newBalance,
          description: `Resgate: ${prize.name}`
        }
      })

      // Atualizar estoque se houver
      if (prize.stockQuantity !== null) {
        await tx.clientPrize.update({
          where: { id: prize.id },
          data: {
            stockQuantity: prize.stockQuantity - 1
          }
        })
      }

      return redemption
    })

    return NextResponse.json({ 
      redemption: result,
      message: 'Prêmio resgatado com sucesso!',
      newBalance: clientCustomer.pointsBalance - prize.pointsCost
    }, { status: 201 })

  } catch (error) {
    console.error('Erro ao resgatar prêmio:', error)
    return NextResponse.json({ error: 'Erro ao resgatar prêmio' }, { status: 500 })
  }
}
