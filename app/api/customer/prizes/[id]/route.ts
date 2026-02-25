export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// PUT - Atualizar prêmio
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
    const { name, description, imageUrl, pointsCost, stockQuantity, category, displayOrder, isActive } = body

    // Verificar se o prêmio pertence ao cliente
    const existingPrize = await prisma.clientPrize.findUnique({
      where: { id }
    })

    if (!existingPrize || existingPrize.customerId !== user.Customer.id) {
      return NextResponse.json({ error: 'Prêmio não encontrado' }, { status: 404 })
    }

    const prize = await prisma.clientPrize.update({
      where: { id },
      data: {
        name: name || existingPrize.name,
        description: description !== undefined ? description : existingPrize.description,
        imageUrl: imageUrl !== undefined ? imageUrl : existingPrize.imageUrl,
        pointsCost: pointsCost ? parseInt(pointsCost) : existingPrize.pointsCost,
        stockQuantity: stockQuantity !== undefined ? (stockQuantity ? parseInt(stockQuantity) : null) : existingPrize.stockQuantity,
        category: category !== undefined ? category : existingPrize.category,
        displayOrder: displayOrder !== undefined ? parseInt(displayOrder) : existingPrize.displayOrder,
        isActive: isActive !== undefined ? isActive : existingPrize.isActive
      }
    })

    return NextResponse.json({ prize })

  } catch (error) {
    console.error('Erro ao atualizar prêmio:', error)
    return NextResponse.json({ error: 'Erro ao atualizar prêmio' }, { status: 500 })
  }
}

// DELETE - Excluir prêmio
export async function DELETE(
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

    // Verificar se o prêmio pertence ao cliente
    const existingPrize = await prisma.clientPrize.findUnique({
      where: { id }
    })

    if (!existingPrize || existingPrize.customerId !== user.Customer.id) {
      return NextResponse.json({ error: 'Prêmio não encontrado' }, { status: 404 })
    }

    await prisma.clientPrize.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Prêmio excluído com sucesso' })

  } catch (error) {
    console.error('Erro ao excluir prêmio:', error)
    return NextResponse.json({ error: 'Erro ao excluir prêmio' }, { status: 500 })
  }
}
