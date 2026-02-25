export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

// GET - Buscar vendedor específico
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const seller = await prisma.seller.findUnique({
      where: { id: params.id },
      include: {
        User: {
          select: {
            id: true,
            email: true,
            name: true
          }
        },
        Customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            city: true
          }
        },
        Order: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            Customer: {
              select: {
                name: true
              }
            }
          }
        },
        Commission: {
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!seller) {
      return NextResponse.json({ error: 'Vendedor não encontrado' }, { status: 404 })
    }

    return NextResponse.json(seller)
  } catch (error) {
    console.error('Error fetching seller:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar vendedor' },
      { status: 500 }
    )
  }
}

// PUT - Atualizar vendedor
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const { name, email, phone, cpf, password, isActive, commissionRate, maxDiscountRate } = body

    // Verificar se o email já está em uso por outro vendedor
    if (email) {
      const existingSellerWithEmail = await prisma.seller.findFirst({
        where: {
          email,
          id: { not: params.id }
        }
      })

      if (existingSellerWithEmail) {
        return NextResponse.json(
          { error: 'Este email já está em uso por outro vendedor' },
          { status: 400 }
        )
      }
    }

    // Verificar se o CPF já está em uso por outro vendedor
    if (cpf) {
      const existingSellerWithCpf = await prisma.seller.findFirst({
        where: {
          cpf,
          id: { not: params.id }
        }
      })

      if (existingSellerWithCpf) {
        return NextResponse.json(
          { error: 'Este CPF já está em uso por outro vendedor' },
          { status: 400 }
        )
      }
    }

    // Atualizar vendedor
    const seller = await prisma.seller.update({
      where: { id: params.id },
      data: {
        name,
        email,
        phone,
        cpf,
        isActive,
        commissionRate,
        maxDiscountRate
      }
    })

    // Atualizar o usuário associado
    const userUpdateData: any = {}
    if (name) userUpdateData.name = name
    if (email) userUpdateData.email = email
    
    // Se uma nova senha foi fornecida, fazer hash e atualizar
    if (password) {
      const bcrypt = require('bcryptjs')
      const hashedPassword = await bcrypt.hash(password, 10)
      userUpdateData.password = hashedPassword
    }

    // Atualizar usuário se houver dados para atualizar
    if (Object.keys(userUpdateData).length > 0) {
      await prisma.user.updateMany({
        where: { sellerId: seller.id },
        data: userUpdateData
      })
    }

    return NextResponse.json({
      message: 'Vendedor atualizado com sucesso',
      seller
    })
  } catch (error) {
    console.error('Error updating seller:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar vendedor' },
      { status: 500 }
    )
  }
}

// DELETE - Excluir vendedor permanentemente
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Buscar vendedor com relacionamentos
    const seller = await prisma.seller.findUnique({
      where: { id: params.id },
      include: {
        Customer: true,
        Order: true,
        Commission: true,
        User: true
      }
    })

    if (!seller) {
      return NextResponse.json({ error: 'Vendedor não encontrado' }, { status: 404 })
    }

    // Desassociar clientes (eles continuam existindo, mas sem vendedor)
    if (seller.Customer.length > 0) {
      await prisma.customer.updateMany({
        where: { sellerId: params.id },
        data: { sellerId: null }
      })
    }

    // Desassociar pedidos (eles continuam existindo, mas sem vendedor)
    if (seller.Order.length > 0) {
      await prisma.order.updateMany({
        where: { sellerId: params.id },
        data: { sellerId: null }
      })
    }

    // Excluir comissões associadas
    if (seller.Commission.length > 0) {
      await prisma.commission.deleteMany({
        where: { sellerId: params.id }
      })
    }

    // Excluir usuário associado (se existir)
    if (seller.User) {
      await prisma.user.delete({
        where: { id: seller.User.id }
      })
    }

    // Excluir o vendedor
    await prisma.seller.delete({
      where: { id: params.id }
    })

    return NextResponse.json({
      success: true,
      message: 'Vendedor excluído com sucesso'
    })
  } catch (error) {
    console.error('Error deleting seller:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir vendedor' },
      { status: 500 }
    )
  }
}
