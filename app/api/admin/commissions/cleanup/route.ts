
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

// POST - Limpar comissões órfãs (sem pedido associado)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Buscar todas as comissões com orderId
    const commissionsWithOrders = await prisma.commission.findMany({
      where: {
        orderId: { not: null }
      },
      select: {
        id: true,
        orderId: true
      }
    })

    // Verificar quais pedidos existem
    const orderIds = commissionsWithOrders.map((c: any) => c.orderId).filter(Boolean) as string[]
    const existingOrders = await prisma.order.findMany({
      where: {
        id: { in: orderIds }
      },
      select: {
        id: true
      }
    })

    const existingOrderIds = new Set(existingOrders.map((o: any) => o.id))

    // Encontrar comissões órfãs
    const orphanCommissionIds = commissionsWithOrders
      .filter((c: any) => c.orderId && !existingOrderIds.has(c.orderId))
      .map((c: any) => c.id)

    if (orphanCommissionIds.length === 0) {
      return NextResponse.json({
        message: 'Nenhuma comissão órfã encontrada',
        deletedCount: 0
      })
    }

    // Excluir comissões órfãs
    const result = await prisma.commission.deleteMany({
      where: {
        id: { in: orphanCommissionIds }
      }
    })

    return NextResponse.json({
      message: `${result.count} comissão(ões) órfã(s) excluída(s) com sucesso`,
      deletedCount: result.count
    })
  } catch (error) {
    console.error('Error cleaning up orphan commissions:', error)
    return NextResponse.json(
      { error: 'Erro ao limpar comissões órfãs' },
      { status: 500 }
    )
  }
}
