
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

// GET - Buscar insumo específico
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = params

    const supply = await prisma.productionSupplyGlobal.findUnique({
      where: { id },
      include: {
        _count: {
          select: { ProductionSupplies: true }
        }
      }
    })

    if (!supply) {
      return NextResponse.json(
        { error: 'Insumo não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(supply)
  } catch (error: any) {
    console.error('❌ [API SUPPLIES] Erro ao buscar insumo:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar insumo', details: error.message },
      { status: 500 }
    )
  }
}

// PUT - Atualizar insumo
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = params
    const body = await req.json()
    const { name, category, costPerUnit, unit, description, notes, isActive } = body

    console.log(`📝 [API SUPPLIES] Atualizando insumo ${id}`)

    // Verificar se existe
    const existingSupply = await prisma.productionSupplyGlobal.findUnique({
      where: { id }
    })

    if (!existingSupply) {
      return NextResponse.json(
        { error: 'Insumo não encontrado' },
        { status: 404 }
      )
    }

    // Validações
    if (costPerUnit !== undefined && costPerUnit < 0) {
      return NextResponse.json(
        { error: 'Custo por unidade não pode ser negativo' },
        { status: 400 }
      )
    }

    const supply = await prisma.productionSupplyGlobal.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(category && { category }),
        ...(costPerUnit !== undefined && { costPerUnit: parseFloat(costPerUnit) }),
        ...(unit && { unit }),
        ...(description !== undefined && { description }),
        ...(notes !== undefined && { notes }),
        ...(isActive !== undefined && { isActive })
      }
    })

    console.log(`✅ [API SUPPLIES] Insumo atualizado: ${supply.id} - ${supply.name}`)

    return NextResponse.json(supply)
  } catch (error: any) {
    console.error('❌ [API SUPPLIES] Erro ao atualizar insumo:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar insumo', details: error.message },
      { status: 500 }
    )
  }
}

// DELETE - Excluir insumo
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = params

    // Verificar se existe
    const existingSupply = await prisma.productionSupplyGlobal.findUnique({
      where: { id },
      include: {
        _count: {
          select: { ProductionSupplies: true }
        }
      }
    })

    if (!existingSupply) {
      return NextResponse.json(
        { error: 'Insumo não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se está sendo usado em alguma receita
    if (existingSupply._count.ProductionSupplies > 0) {
      return NextResponse.json(
        {
          error: 'Não é possível excluir este insumo',
          details: `Este insumo está sendo usado em ${existingSupply._count.ProductionSupplies} receita(s). Remova das receitas antes de excluir.`
        },
        { status: 400 }
      )
    }

    await prisma.productionSupplyGlobal.delete({
      where: { id }
    })

    console.log(`✅ [API SUPPLIES] Insumo excluído: ${id}`)

    return NextResponse.json({ success: true, message: 'Insumo excluído com sucesso' })
  } catch (error: any) {
    console.error('❌ [API SUPPLIES] Erro ao excluir insumo:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir insumo', details: error.message },
      { status: 500 }
    )
  }
}
