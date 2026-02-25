export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// PUT - Atualizar status do resgate (aprovar/rejeitar/entregar)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params
    const body = await request.json()
    const { status, adminNotes, rejectionReason } = body

    // Verificar se o resgate pertence ao cliente
    const existingRedemption = await prisma.clientRedemption.findUnique({
      where: { id },
      include: {
        ClientCustomer: true,
        Prize: true
      }
    })

    if (!existingRedemption || existingRedemption.customerId !== user.Customer.id) {
      return NextResponse.json({ error: 'Resgate não encontrado' }, { status: 404 })
    }

    // Se for rejeitar, devolver os pontos ao cliente
    if (status === 'REJECTED' && existingRedemption.status !== 'REJECTED') {
      await prisma.$transaction(async (tx) => {
        // Atualizar o resgate
        await tx.clientRedemption.update({
          where: { id },
          data: {
            status: 'REJECTED',
            processedAt: new Date(),
            processedBy: user.id,
            adminNotes,
            rejectionReason: rejectionReason || null
          }
        })

        // Devolver pontos ao cliente
        const newBalance = existingRedemption.ClientCustomer.pointsBalance + existingRedemption.pointsUsed
        await tx.clientCustomer.update({
          where: { id: existingRedemption.clientCustomerId },
          data: {
            pointsBalance: newBalance
          }
        })

        // Registrar transação de pontos
        await tx.clientCustomerPointTransaction.create({
          data: {
            clientCustomerId: existingRedemption.clientCustomerId,
            customerId: user.Customer.id,
            type: 'ADJUSTMENT',
            amount: existingRedemption.pointsUsed,
            balance: newBalance,
            description: `Estorno: ${existingRedemption.Prize.name} (resgate rejeitado)`
          }
        })

        // Devolver ao estoque se houver
        if (existingRedemption.Prize.stockQuantity !== null) {
          await tx.clientPrize.update({
            where: { id: existingRedemption.prizeId },
            data: {
              stockQuantity: existingRedemption.Prize.stockQuantity + 1
            }
          })
        }
      })
    } else {
      // Atualizar apenas o status e dados administrativos
      await prisma.clientRedemption.update({
        where: { id },
        data: {
          status,
          processedAt: status !== 'PENDING' ? new Date() : existingRedemption.processedAt,
          processedBy: status !== 'PENDING' ? user.id : existingRedemption.processedBy,
          deliveredAt: status === 'DELIVERED' ? new Date() : existingRedemption.deliveredAt,
          adminNotes: adminNotes || existingRedemption.adminNotes,
          rejectionReason: rejectionReason !== undefined ? rejectionReason : existingRedemption.rejectionReason
        }
      })
    }

    const redemption = await prisma.clientRedemption.findUnique({
      where: { id },
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
      }
    })

    return NextResponse.json({ redemption })

  } catch (error) {
    console.error('Erro ao atualizar resgate:', error)
    return NextResponse.json({ error: 'Erro ao atualizar resgate' }, { status: 500 })
  }
}
