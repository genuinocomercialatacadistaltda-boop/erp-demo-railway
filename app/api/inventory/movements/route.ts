export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { authOptions } from '@/lib/auth-options'

// GET /api/inventory/movements - Listar movimentações de estoque (matérias-primas E produtos)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const rawMaterialId = searchParams.get('rawMaterialId')
    const productId = searchParams.get('productId')
    const type = searchParams.get('type') // ENTRY, EXIT, ADJUSTMENT, LOSS
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const limit = parseInt(searchParams.get('limit') || '50')

    console.log('[INVENTORY_MOVEMENTS_GET] Buscando movimentações:', {
      rawMaterialId,
      productId,
      type,
      startDate,
      endDate,
      limit
    })

    const where: any = {}
    
    if (rawMaterialId) where.rawMaterialId = rawMaterialId
    if (productId) where.productId = productId
    if (type) where.type = type
    
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate)
      if (endDate) where.createdAt.lte = new Date(endDate)
    }

    const movements = await prisma.inventoryMovement.findMany({
      where,
      include: {
        RawMaterial: {
          select: {
            id: true,
            name: true,
            sku: true,
            measurementUnit: true,
            currentStock: true
          }
        },
        Product: {
          select: {
            id: true,
            name: true,
            category: true,
            imageUrl: true,
            currentStock: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    console.log(`[INVENTORY_MOVEMENTS_GET] ${movements.length} movimentações encontradas (${movements.filter(m => m.rawMaterialId).length} matérias-primas, ${movements.filter(m => m.productId).length} produtos)`)

    return NextResponse.json({ movements })
  } catch (error: any) {
    console.error('[INVENTORY_MOVEMENTS_GET] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar movimentações', details: error.message },
      { status: 500 }
    )
  }
}

// POST /api/inventory/movements - Criar movimentação de estoque (matérias-primas E produtos)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { rawMaterialId, productId, type, quantity, reason, notes, referenceId } = body

    console.log('[INVENTORY_MOVEMENTS_POST] Criando movimentação:', {
      rawMaterialId,
      productId,
      type,
      quantity,
      reason
    })

    // Validações
    if (!rawMaterialId && !productId) {
      return NextResponse.json(
        { error: 'É necessário informar rawMaterialId OU productId' },
        { status: 400 }
      )
    }

    if (rawMaterialId && productId) {
      return NextResponse.json(
        { error: 'Informe apenas rawMaterialId OU productId, não ambos' },
        { status: 400 }
      )
    }

    if (!type || !quantity) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: type, quantity' },
        { status: 400 }
      )
    }

    if (!['ENTRY', 'EXIT', 'ADJUSTMENT', 'LOSS'].includes(type)) {
      return NextResponse.json(
        { error: 'Tipo inválido. Use: ENTRY, EXIT, ADJUSTMENT ou LOSS' },
        { status: 400 }
      )
    }

    let currentStock = 0
    let itemName = ''
    let itemType = ''

    // Buscar matéria-prima OU produto
    if (rawMaterialId) {
      const rawMaterial = await prisma.rawMaterial.findUnique({
        where: { id: rawMaterialId }
      })

      if (!rawMaterial) {
        return NextResponse.json(
          { error: 'Matéria-prima não encontrada' },
          { status: 404 }
        )
      }

      currentStock = rawMaterial.currentStock
      itemName = rawMaterial.name
      itemType = 'matéria-prima'
    } else {
      const product = await prisma.product.findUnique({
        where: { id: productId }
      })

      if (!product) {
        return NextResponse.json(
          { error: 'Produto não encontrado' },
          { status: 404 }
        )
      }

      currentStock = product.currentStock
      itemName = product.name
      itemType = 'produto'
    }

    // Calcular nova quantidade
    let stockChange = 0
    switch (type) {
      case 'ENTRY':
        stockChange = Math.abs(quantity)
        break
      case 'EXIT':
      case 'LOSS':
        stockChange = -Math.abs(quantity)
        break
      case 'ADJUSTMENT':
        // Para ajuste, a quantidade pode ser positiva ou negativa
        stockChange = quantity
        break
    }

    const newStock = currentStock + stockChange

    if (newStock < 0) {
      return NextResponse.json(
        { error: `Estoque insuficiente de ${itemName}. Atual: ${currentStock.toFixed(2)}, Tentando remover: ${Math.abs(stockChange).toFixed(2)}` },
        { status: 400 }
      )
    }

    console.log(`[INVENTORY_MOVEMENTS_POST] Atualizando estoque de ${itemType}:`, {
      item: itemName,
      oldStock: currentStock,
      change: stockChange,
      newStock
    })

    // Criar movimentação e atualizar estoque em transação
    const movement = await prisma.$transaction(async (tx) => {
      // Criar movimentação
      const includeConfig: any = {}
      if (rawMaterialId) {
        includeConfig.RawMaterial = {
          select: {
            id: true,
            name: true,
            sku: true,
            measurementUnit: true
          }
        }
      }
      if (productId) {
        includeConfig.Product = {
          select: {
            id: true,
            name: true,
            category: true,
            imageUrl: true
          }
        }
      }

      const newMovement = await tx.inventoryMovement.create({
        data: {
          rawMaterialId: rawMaterialId || undefined,
          productId: productId || undefined,
          type,
          quantity: stockChange, // Salva com sinal correto
          previousStock: currentStock,
          newStock,
          reason: reason || type,
          notes,
          referenceId,
          performedBy: session.user.name || session.user.email,
          performedById: session.user.id
        },
        include: includeConfig
      })

      // Atualizar estoque da matéria-prima OU produto
      if (rawMaterialId) {
        await tx.rawMaterial.update({
          where: { id: rawMaterialId },
          data: { currentStock: newStock }
        })
      } else {
        await tx.product.update({
          where: { id: productId },
          data: { currentStock: newStock }
        })
      }

      return newMovement
    })

    console.log(`[INVENTORY_MOVEMENTS_POST] ✅ Movimentação de ${itemType} criada:`, movement.id)

    return NextResponse.json({ movement }, { status: 201 })
  } catch (error: any) {
    console.error('[INVENTORY_MOVEMENTS_POST] ❌ Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao criar movimentação', details: error.message },
      { status: 500 }
    )
  }
}
