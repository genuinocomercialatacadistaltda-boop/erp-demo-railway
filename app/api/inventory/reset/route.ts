import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { authOptions } from '@/lib/auth-options'

const RESET_PASSWORD = '95112641'

// POST /api/inventory/reset - Zerar TODO o estoque (produtos, matérias-primas, insumos)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { password } = body

    // Validar senha
    if (password !== RESET_PASSWORD) {
      return NextResponse.json(
        { error: 'Senha incorreta' },
        { status: 403 }
      )
    }

    console.log('[INVENTORY_RESET] 🔴 Iniciando reset completo do estoque...')
    console.log(`[INVENTORY_RESET] Executado por: ${session.user.name || session.user.email}`)

    // Usar transação para garantir consistência
    const result = await prisma.$transaction(async (tx) => {
      // 1. Zerar estoque de PRODUTOS
      const productsUpdate = await tx.product.updateMany({
        data: { currentStock: 0 }
      })
      console.log(`[INVENTORY_RESET] ✅ Produtos zerados: ${productsUpdate.count}`)

      // 2. Zerar estoque de MATÉRIAS-PRIMAS
      const rawMaterialsUpdate = await tx.rawMaterial.updateMany({
        data: { currentStock: 0 }
      })
      console.log(`[INVENTORY_RESET] ✅ Matérias-primas zeradas: ${rawMaterialsUpdate.count}`)

      // 3. Zerar estoque de INSUMOS
      const suppliesUpdate = await tx.productionSupplyGlobal.updateMany({
        data: { currentStock: 0 }
      })
      console.log(`[INVENTORY_RESET] ✅ Insumos zerados: ${suppliesUpdate.count}`)

      // 4. Limpar histórico de movimentações de PRODUTOS/MATÉRIAS-PRIMAS
      const movementsDeleted = await tx.inventoryMovement.deleteMany({})
      console.log(`[INVENTORY_RESET] ✅ Movimentações de inventário deletadas: ${movementsDeleted.count}`)

      // 5. Limpar histórico de movimentações de INSUMOS
      const supplyMovementsDeleted = await tx.supplyMovement.deleteMany({})
      console.log(`[INVENTORY_RESET] ✅ Movimentações de insumos deletadas: ${supplyMovementsDeleted.count}`)

      return {
        productsZerados: productsUpdate.count,
        materiasZeradas: rawMaterialsUpdate.count,
        insumosZerados: suppliesUpdate.count,
        movimentacoesDeleted: movementsDeleted.count,
        movimentacoesInsumosDeleted: supplyMovementsDeleted.count
      }
    })

    console.log('[INVENTORY_RESET] 🎉 Reset completo finalizado!')

    return NextResponse.json({
      success: true,
      message: 'Estoque zerado com sucesso!',
      details: result
    })
  } catch (error: any) {
    console.error('[INVENTORY_RESET] ❌ Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao zerar estoque', details: error.message },
      { status: 500 }
    )
  }
}
