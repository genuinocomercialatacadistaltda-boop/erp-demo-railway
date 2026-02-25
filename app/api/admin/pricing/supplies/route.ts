export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

// GET - Listar insumos globais
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const isActive = searchParams.get('isActive')
    const category = searchParams.get('category')

    const where: any = {}
    
    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }
    
    if (category) {
      where.category = category
    }

    const supplies = await prisma.productionSupplyGlobal.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ],
      include: {
        _count: {
          select: { ProductionSupplies: true }
        },
        SupplyRecipe: {
          select: {
            id: true,
            name: true,
            yieldAmount: true,
            yieldUnit: true,
            estimatedCost: true
          }
        }
      }
    })

    console.log(`✅ [API SUPPLIES] ${supplies.length} insumos encontrados`)

    return NextResponse.json(supplies)
  } catch (error: any) {
    console.error('❌ [API SUPPLIES] Erro ao listar insumos:', error)
    return NextResponse.json(
      { error: 'Erro ao listar insumos', details: error.message },
      { status: 500 }
    )
  }
}

// POST - Criar novo insumo global
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const { name, category, costPerUnit, unit, description, notes } = body

    console.log('📝 [API SUPPLIES] Criando novo insumo:', { name, category, costPerUnit, unit })

    // Validações
    if (!name || !category || costPerUnit === undefined || costPerUnit === null) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: name, category, costPerUnit' },
        { status: 400 }
      )
    }

    if (costPerUnit < 0) {
      return NextResponse.json(
        { error: 'Custo por unidade não pode ser negativo' },
        { status: 400 }
      )
    }

    const supply = await prisma.productionSupplyGlobal.create({
      data: {
        name,
        category,
        costPerUnit: parseFloat(costPerUnit),
        unit: unit || 'un',
        description: description || null,
        notes: notes || null,
        isActive: true
      }
    })

    console.log(`✅ [API SUPPLIES] Insumo criado: ${supply.id} - ${supply.name}`)

    return NextResponse.json(supply, { status: 201 })
  } catch (error: any) {
    console.error('❌ [API SUPPLIES] Erro ao criar insumo:', error)
    return NextResponse.json(
      { error: 'Erro ao criar insumo', details: error.message },
      { status: 500 }
    )
  }
}
