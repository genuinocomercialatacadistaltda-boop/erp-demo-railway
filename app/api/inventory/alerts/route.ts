import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { authOptions } from '@/lib/auth-options'

// GET /api/inventory/alerts - Listar alertas de estoque baixo
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const severity = searchParams.get('severity') // LOW, CRITICAL, OUT_OF_STOCK

    console.log('[INVENTORY_ALERTS_GET] Buscando alertas de estoque')

    // Buscar todas as matérias-primas ativas com estoque mínimo definido
    const rawMaterials = await prisma.rawMaterial.findMany({
      where: {
        isActive: true,
        minStock: { not: null }
      },
      select: {
        id: true,
        name: true,
        sku: true,
        currentStock: true,
        minStock: true,
        maxStock: true,
        measurementUnit: true,
        imageUrl: true,
        Supplier: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true
          }
        }
      },
      orderBy: { name: 'asc' }
    })

    // Classificar alertas
    const alerts = rawMaterials
      .map((material) => {
        const minStock = material.minStock || 0
        const currentStock = material.currentStock
        const stockPercentage = minStock > 0 ? (currentStock / minStock) * 100 : 100

        let alertSeverity: 'OUT_OF_STOCK' | 'CRITICAL' | 'LOW' | null = null

        if (currentStock === 0) {
          alertSeverity = 'OUT_OF_STOCK'
        } else if (currentStock < minStock * 0.5) {
          alertSeverity = 'CRITICAL'
        } else if (currentStock < minStock) {
          alertSeverity = 'LOW'
        }

        return {
          ...material,
          alertSeverity,
          stockPercentage: Math.round(stockPercentage),
          deficit: Math.max(0, minStock - currentStock)
        }
      })
      .filter((alert) => alert.alertSeverity !== null) // Apenas com alertas
      .filter((alert) => !severity || alert.alertSeverity === severity) // Filtrar por severidade se especificado

    // Ordenar por severidade (OUT_OF_STOCK > CRITICAL > LOW)
    const severityOrder = { OUT_OF_STOCK: 0, CRITICAL: 1, LOW: 2 }
    alerts.sort((a, b) => {
      return severityOrder[a.alertSeverity!] - severityOrder[b.alertSeverity!]
    })

    console.log(`[INVENTORY_ALERTS_GET] ${alerts.length} alertas encontrados`)

    return NextResponse.json({ 
      alerts,
      summary: {
        total: alerts.length,
        outOfStock: alerts.filter(a => a.alertSeverity === 'OUT_OF_STOCK').length,
        critical: alerts.filter(a => a.alertSeverity === 'CRITICAL').length,
        low: alerts.filter(a => a.alertSeverity === 'LOW').length
      }
    })
  } catch (error: any) {
    console.error('[INVENTORY_ALERTS_GET] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar alertas', details: error.message },
      { status: 500 }
    )
  }
}
