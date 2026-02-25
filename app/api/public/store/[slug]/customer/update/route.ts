import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params
    const body = await req.json()
    const { customerId, name, phone, email, address } = body

    if (!customerId) {
      return NextResponse.json(
        { error: 'customerId é obrigatório' },
        { status: 400 }
      )
    }

    if (!name || !phone) {
      return NextResponse.json(
        { error: 'Nome e telefone são obrigatórios' },
        { status: 400 }
      )
    }

    // Buscar o vendedor (assador) pelo slug
    const seller = await prisma.customer.findUnique({
      where: { storeSlug: slug }
    })

    if (!seller) {
      return NextResponse.json(
        { error: 'Loja não encontrada' },
        { status: 404 }
      )
    }

    // Verificar se o cliente existe e pertence a este vendedor
    const existingCustomer = await prisma.clientCustomer.findFirst({
      where: {
        id: customerId,
        customerId: seller.id
      }
    })

    if (!existingCustomer) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      )
    }

    // Atualizar dados do cliente
    const updatedCustomer = await prisma.clientCustomer.update({
      where: {
        id: customerId
      },
      data: {
        name,
        phone,
        email: email || null,
        address: address || null
      }
    })

    // Retornar dados atualizados
    return NextResponse.json({
      customer: {
        id: updatedCustomer.id,
        name: updatedCustomer.name,
        phone: updatedCustomer.phone,
        email: updatedCustomer.email,
        address: updatedCustomer.address,
        pointsBalance: updatedCustomer.pointsBalance,
        pointsMultiplier: updatedCustomer.pointsMultiplier
      }
    })

  } catch (error) {
    console.error('Erro ao atualizar cliente:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar dados do cliente' },
      { status: 500 }
    )
  }
}
