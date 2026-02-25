export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

// POST /api/products/[id]/toggle-ingredient
// Ativa/desativa o uso do produto como matéria-prima
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = params
    const { enable } = await request.json()

    // Buscar o produto
    const product = await prisma.product.findUnique({
      where: { id }
    })

    if (!product) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
    }

    if (enable) {
      // ATIVAR: Criar ou reativar matéria-prima correspondente
      
      // Verificar se já existe uma matéria-prima vinculada
      let rawMaterial = await prisma.rawMaterial.findFirst({
        where: { linkedProductId: id }
      })

      if (rawMaterial) {
        // Reativar matéria-prima existente
        rawMaterial = await prisma.rawMaterial.update({
          where: { id: rawMaterial.id },
          data: {
            isActive: true,
            name: `${product.name} (Produto)`,
            costPerUnit: product.unitCost || 0,
            imageUrl: product.imageUrl,
            notes: `Matéria-prima criada automaticamente a partir do produto: ${product.name}`
          }
        })
        console.log(`[TOGGLE_INGREDIENT] Matéria-prima reativada: ${rawMaterial.id}`)
      } else {
        // Criar nova matéria-prima
        rawMaterial = await prisma.rawMaterial.create({
          data: {
            name: `${product.name} (Produto)`,
            description: product.description,
            measurementUnit: 'KG', // Padrão para produtos de produção
            costPerUnit: product.unitCost || 0,
            imageUrl: product.imageUrl,
            isActive: true,
            linkedProductId: id,
            notes: `Matéria-prima criada automaticamente a partir do produto: ${product.name}`
          }
        })
        console.log(`[TOGGLE_INGREDIENT] Nova matéria-prima criada: ${rawMaterial.id}`)
      }

      // Atualizar produto com referência à matéria-prima
      await prisma.product.update({
        where: { id },
        data: {
          canBeUsedAsIngredient: true,
          linkedRawMaterialId: rawMaterial.id
        }
      })

      return NextResponse.json({
        success: true,
        message: `Produto "${product.name}" agora pode ser usado como matéria-prima em receitas`,
        rawMaterialId: rawMaterial.id,
        rawMaterialName: rawMaterial.name
      })

    } else {
      // DESATIVAR: Desativar matéria-prima vinculada (não deletar para preservar histórico)
      
      if (product.linkedRawMaterialId) {
        // Verificar se a matéria-prima está sendo usada em alguma receita
        const usageCount = await prisma.recipeIngredient.count({
          where: { rawMaterialId: product.linkedRawMaterialId }
        })

        if (usageCount > 0) {
          return NextResponse.json({
            error: `Não é possível desativar. Esta matéria-prima está sendo usada em ${usageCount} receita(s). Remova os ingredientes das receitas primeiro.`
          }, { status: 400 })
        }

        await prisma.rawMaterial.update({
          where: { id: product.linkedRawMaterialId },
          data: { isActive: false }
        })
        console.log(`[TOGGLE_INGREDIENT] Matéria-prima desativada: ${product.linkedRawMaterialId}`)
      }

      // Atualizar produto
      await prisma.product.update({
        where: { id },
        data: {
          canBeUsedAsIngredient: false
        }
      })

      return NextResponse.json({
        success: true,
        message: `Produto "${product.name}" não será mais usado como matéria-prima`
      })
    }

  } catch (error: any) {
    console.error('[TOGGLE_INGREDIENT] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao processar requisição', details: error.message },
      { status: 500 }
    )
  }
}
