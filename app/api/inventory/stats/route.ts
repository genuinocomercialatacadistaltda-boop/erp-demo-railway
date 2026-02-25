export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { authOptions } from '@/lib/auth-options'

// GET /api/inventory/stats - Estatísticas de estoque
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    console.log('[INVENTORY_STATS_GET] 📊 Calculando estatísticas de estoque')

    // Total de matérias-primas ativas
    const totalMaterials = await prisma.rawMaterial.count({
      where: { isActive: true }
    })
    console.log('[INVENTORY_STATS_GET] Total de matérias-primas ativas:', totalMaterials)

    // Valor total em estoque
    const materials = await prisma.rawMaterial.findMany({
      where: { isActive: true },
      select: {
        currentStock: true,
        costPerUnit: true,
        minStock: true
      }
    })
    console.log('[INVENTORY_STATS_GET] Matérias-primas encontradas:', materials.length)

    const totalValue = materials.reduce((sum, m) => {
      return sum + (Number(m.currentStock) * (Number(m.costPerUnit) || 0))
    }, 0)
    console.log('[INVENTORY_STATS_GET] Valor total em estoque: R$', totalValue.toFixed(2))

    // Alertas de estoque
    const materialsWithMinStock = materials.filter(m => m.minStock !== null)
    const lowStock = materialsWithMinStock.filter(
      m => Number(m.currentStock) < (Number(m.minStock) || 0)
    ).length

    const outOfStock = materials.filter(m => Number(m.currentStock) === 0).length
    console.log('[INVENTORY_STATS_GET] Alertas - Estoque baixo:', lowStock, '| Sem estoque:', outOfStock)

    // Movimentações recentes (últimos 30 dias)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentMovements = await prisma.inventoryMovement.count({
      where: {
        createdAt: { gte: thirtyDaysAgo }
      }
    })
    console.log('[INVENTORY_STATS_GET] Movimentações recentes (30d):', recentMovements)

    // Movimentações por tipo
    const movementsByType = await prisma.inventoryMovement.groupBy({
      by: ['type'],
      where: {
        createdAt: { gte: thirtyDaysAgo }
      },
      _count: true
    })
    console.log('[INVENTORY_STATS_GET] Movimentações por tipo:', movementsByType.length, 'tipos')

    // Top 5 matérias-primas mais movimentadas
    const topMovedMaterials = await prisma.inventoryMovement.groupBy({
      by: ['rawMaterialId'],
      where: {
        createdAt: { gte: thirtyDaysAgo },
        rawMaterialId: { not: null }
      },
      _count: true,
      orderBy: {
        _count: { rawMaterialId: 'desc' }
      },
      take: 5
    })
    console.log('[INVENTORY_STATS_GET] Top matérias-primas movimentadas:', topMovedMaterials.length)

    // Buscar detalhes das top matérias-primas
    const topMaterialIds = topMovedMaterials
      .map(m => m.rawMaterialId)
      .filter(id => id !== null) as string[]
      
    const topMaterialsDetails = await prisma.rawMaterial.findMany({
      where: { id: { in: topMaterialIds } },
      select: {
        id: true,
        name: true,
        sku: true,
        currentStock: true,
        measurementUnit: true
      }
    })

    const topMaterials = topMovedMaterials
      .map(tm => {
        if (!tm.rawMaterialId) return null
        const details = topMaterialsDetails.find(d => d.id === tm.rawMaterialId)
        if (!details) return null
        return {
          ...details,
          currentStock: Number(details.currentStock),
          movementCount: tm._count
        }
      })
      .filter(m => m !== null)

    console.log('[INVENTORY_STATS_GET] ✅ Estatísticas calculadas com sucesso')

    const response = {
      summary: {
        totalMaterials,
        totalValue: Math.round(totalValue * 100) / 100,
        lowStock,
        outOfStock,
        recentMovements
      },
      movementsByType: movementsByType.map(m => ({
        type: m.type,
        count: m._count
      })),
      topMaterials
    }
    
    console.log('[INVENTORY_STATS_GET] 📤 Enviando resposta:', JSON.stringify(response, null, 2))

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('[INVENTORY_STATS_GET] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao calcular estatísticas', details: error.message },
      { status: 500 }
    )
  }
}
