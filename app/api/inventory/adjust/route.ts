export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { authOptions } from '@/lib/auth-options'

const ADJUST_PASSWORD = '95112641'

// POST /api/inventory/adjust - Ajustar estoque individual de um produto/matéria-prima/insumo
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { password, itemId, itemType, newStock, reason } = body

    // Validar senha
    if (password !== ADJUST_PASSWORD) {
      return NextResponse.json(
        { error: 'Senha incorreta' },
        { status: 403 }
      )
    }

    // Validar campos obrigatórios
    if (!itemId || !itemType || newStock === undefined || newStock === null) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: itemId, itemType, newStock' },
        { status: 400 }
      )
    }

    if (!['product', 'raw_material', 'supply'].includes(itemType)) {
      return NextResponse.json(
        { error: 'itemType inválido. Use: product, raw_material ou supply' },
        { status: 400 }
      )
    }

    const newStockValue = parseFloat(newStock)
    if (isNaN(newStockValue) || newStockValue < 0) {
      return NextResponse.json(
        { error: 'newStock deve ser um número >= 0' },
        { status: 400 }
      )
    }

    console.log(`[INVENTORY_ADJUST] 🔧 Ajustando estoque: ${itemType} ${itemId} → ${newStockValue}`)

    let result: any = null
    let itemName = ''
    let previousStock = 0

    // Processar de acordo com o tipo
    if (itemType === 'product') {
      const product = await prisma.product.findUnique({
        where: { id: itemId }
      })
      
      if (!product) {
        return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
      }

      previousStock = product.currentStock
      itemName = product.name

      // Atualizar estoque
      await prisma.product.update({
        where: { id: itemId },
        data: { currentStock: newStockValue }
      })

      // Registrar movimentação
      await prisma.inventoryMovement.create({
        data: {
          productId: itemId,
          type: 'ADJUSTMENT',
          quantity: newStockValue - previousStock,
          previousStock,
          newStock: newStockValue,
          reason: reason || `Ajuste manual de estoque`,
          notes: `Ajustado por ${session.user.name || session.user.email}: ${previousStock} → ${newStockValue}`,
          performedBy: session.user.name || session.user.email,
          performedById: session.user.id
        }
      })

      result = { type: 'product', name: product.name }

    } else if (itemType === 'raw_material') {
      const rawMaterial = await prisma.rawMaterial.findUnique({
        where: { id: itemId }
      })
      
      if (!rawMaterial) {
        return NextResponse.json({ error: 'Matéria-prima não encontrada' }, { status: 404 })
      }

      previousStock = rawMaterial.currentStock
      itemName = rawMaterial.name

      // Atualizar estoque
      await prisma.rawMaterial.update({
        where: { id: itemId },
        data: { currentStock: newStockValue }
      })

      // Registrar movimentação
      await prisma.inventoryMovement.create({
        data: {
          rawMaterialId: itemId,
          type: 'ADJUSTMENT',
          quantity: newStockValue - previousStock,
          previousStock,
          newStock: newStockValue,
          reason: reason || `Ajuste manual de estoque`,
          notes: `Ajustado por ${session.user.name || session.user.email}: ${previousStock} → ${newStockValue}`,
          performedBy: session.user.name || session.user.email,
          performedById: session.user.id
        }
      })

      result = { type: 'raw_material', name: rawMaterial.name }

    } else if (itemType === 'supply') {
      const supply = await prisma.productionSupplyGlobal.findUnique({
        where: { id: itemId }
      })
      
      if (!supply) {
        return NextResponse.json({ error: 'Insumo não encontrado' }, { status: 404 })
      }

      previousStock = supply.currentStock
      itemName = supply.name

      // Atualizar estoque
      await prisma.productionSupplyGlobal.update({
        where: { id: itemId },
        data: { currentStock: newStockValue }
      })

      // Registrar movimentação de insumo
      await prisma.supplyMovement.create({
        data: {
          supplyId: itemId,
          type: 'ADJUSTMENT',
          quantity: newStockValue - previousStock,
          reason: 'ADJUSTMENT',
          notes: `Ajustado por ${session.user.name || session.user.email}: ${previousStock} → ${newStockValue}`,
          createdBy: session.user.id
        }
      })

      result = { type: 'supply', name: supply.name }
    }

    console.log(`[INVENTORY_ADJUST] ✅ Estoque ajustado: ${itemName}: ${previousStock} → ${newStockValue}`)

    return NextResponse.json({
      success: true,
      message: `Estoque de "${itemName}" ajustado de ${previousStock} para ${newStockValue}`,
      details: {
        ...result,
        previousStock,
        newStock: newStockValue,
        difference: newStockValue - previousStock
      }
    })
  } catch (error: any) {
    console.error('[INVENTORY_ADJUST] ❌ Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao ajustar estoque', details: error.message },
      { status: 500 }
    )
  }
}
