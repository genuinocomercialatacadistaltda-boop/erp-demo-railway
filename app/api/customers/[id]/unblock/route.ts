export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

// POST - Liberar cliente manualmente
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const customerId = params.id

    // Verificar se o cliente existe
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, name: true }
    })

    if (!customer) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    }

    // Liberar cliente
    const updatedCustomer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        manuallyUnblocked: true,
        unblockedAt: new Date(),
        unblockedBy: user.id
      }
    })

    console.log(`[UNBLOCK_CUSTOMER] Cliente ${customer.name} liberado por ${user.name || user.email}`)

    return NextResponse.json({
      success: true,
      message: 'Cliente liberado com sucesso',
      customer: {
        id: updatedCustomer.id,
        name: updatedCustomer.name,
        manuallyUnblocked: updatedCustomer.manuallyUnblocked,
        unblockedAt: updatedCustomer.unblockedAt
      }
    })
  } catch (error) {
    console.error('[UNBLOCK_CUSTOMER_ERROR]', error)
    return NextResponse.json(
      { error: 'Erro ao liberar cliente' },
      { status: 500 }
    )
  }
}

// DELETE - Remover liberação manual (rebloquear)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const customerId = params.id

    // Verificar se o cliente existe
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, name: true }
    })

    if (!customer) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    }

    // Remover liberação manual
    const updatedCustomer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        manuallyUnblocked: false,
        unblockedAt: null,
        unblockedBy: null
      }
    })

    console.log(`[REBLOCK_CUSTOMER] Liberação manual removida do cliente ${customer.name} por ${user.name || user.email}`)

    return NextResponse.json({
      success: true,
      message: 'Liberação manual removida com sucesso',
      customer: {
        id: updatedCustomer.id,
        name: updatedCustomer.name,
        manuallyUnblocked: updatedCustomer.manuallyUnblocked
      }
    })
  } catch (error) {
    console.error('[REBLOCK_CUSTOMER_ERROR]', error)
    return NextResponse.json(
      { error: 'Erro ao remover liberação manual' },
      { status: 500 }
    )
  }
}
