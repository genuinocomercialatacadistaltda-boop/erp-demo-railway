export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { authOptions } from '@/lib/auth-options'
import { productSelect } from '@/lib/product-select'

// GET /api/production/records - Listar registros de produção
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const productId = searchParams.get('productId')
    const shift = searchParams.get('shift')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const limit = parseInt(searchParams.get('limit') || '100')

    console.log('[PRODUCTION_RECORDS_GET] Buscando registros com filtros:', {
      employeeId,
      productId,
      shift,
      startDate,
      endDate,
      limit
    })

    const where: any = {}
    
    if (employeeId) where.employeeId = employeeId
    if (productId) where.productId = productId
    if (shift) where.shift = shift
    
    if (startDate || endDate) {
      where.date = {}
      if (startDate) where.date.gte = new Date(startDate)
      if (endDate) where.date.lte = new Date(endDate)
    }

    const records = await prisma.productionRecord.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeNumber: true,
            position: true
          }
        },
        product: {
          select: {
            id: true,
            name: true,
            category: true,
            imageUrl: true
          }
        }
      },
      orderBy: {
        date: 'desc'
      },
      take: limit
    })

    console.log(`[PRODUCTION_RECORDS_GET] ✅ ${records.length} registros encontrados`)

    return NextResponse.json({ records }, { status: 200 })
  } catch (error: any) {
    console.error('[PRODUCTION_RECORDS_GET] ❌ Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar registros de produção', details: error.message },
      { status: 500 }
    )
  }
}

// POST /api/production/records - Criar registro de produção COM BAIXA AUTOMÁTICA
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const {
      employeeId,
      productId,
      quantity,
      date,
      shift,
      notes,
      qualityScore,
      rejectedQty
    } = body

    console.log('[PRODUCTION_RECORDS_POST] 📦 Criando registro de produção:', {
      employeeId,
      productId,
      quantity,
      date,
      shift
    })

    // Validações
    if (!employeeId || !productId || !quantity) {
      return NextResponse.json(
        { error: 'Funcionário, produto e quantidade são obrigatórios' },
        { status: 400 }
      )
    }

    if (quantity <= 0) {
      return NextResponse.json(
        { error: 'Quantidade deve ser maior que zero' },
        { status: 400 }
      )
    }

    // Verificar se funcionário existe
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId }
    })

    if (!employee) {
      return NextResponse.json(
        { error: 'Funcionário não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se produto existe e buscar receita
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        Recipe: {
          include: {
            Ingredients: {
              include: {
                RawMaterial: true
              }
            },
            Supplies: {
              include: {
                GlobalSupply: true
              }
            }
          }
        }
      }
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Produto não encontrado' },
        { status: 404 }
      )
    }

    console.log('[PRODUCTION_RECORDS_POST] 🔍 Produto encontrado:', product.name)

    // Verificar se produto tem receita cadastrada (agora é um array)
    const recipe = product.Recipe && product.Recipe.length > 0 ? product.Recipe[0] : null;
    
    if (!recipe || !recipe.Ingredients || recipe.Ingredients.length === 0) {
      return NextResponse.json(
        { 
          error: 'Receita não cadastrada', 
          details: `O produto "${product.name}" não possui receita cadastrada com ingredientes. Cadastre a receita primeiro em Precificação > Receitas.` 
        },
        { status: 400 }
      )
    }

    console.log(`[PRODUCTION_RECORDS_POST] 📋 Receita encontrada com ${recipe.Ingredients.length} ingredientes`)

    // Calcular consumo de matérias-primas
    const materialsToConsume = recipe.Ingredients.map(ingredient => {
      // Quantidade em gramas por unidade * quantidade produzida
      const quantityKg = (ingredient.quantityGrams * parseFloat(quantity)) / 1000 // Converter para KG
      
      return {
        rawMaterialId: ingredient.rawMaterialId,
        rawMaterialName: ingredient.RawMaterial.name,
        currentStock: ingredient.RawMaterial.currentStock,
        quantityNeeded: quantityKg,
        quantityGramsPerUnit: ingredient.quantityGrams
      }
    })

    console.log('[PRODUCTION_RECORDS_POST] 📊 Consumo de matérias-primas calculado:', materialsToConsume)

    // 🆕 Calcular consumo de insumos (palitos, embalagens, etc.)
    const suppliesToConsume = (recipe.Supplies || []).map(supply => {
      // Verificar se tem globalSupplyId (novo sistema)
      if (supply.globalSupplyId && supply.GlobalSupply) {
        const quantityNeeded = supply.quantityPerUnit * parseFloat(quantity)
        return {
          supplyId: supply.globalSupplyId,
          supplyName: supply.GlobalSupply.name,
          currentStock: supply.GlobalSupply.currentStock,
          quantityNeeded,
          unit: supply.GlobalSupply.unit
        }
      }
      return null
    }).filter((s): s is NonNullable<typeof s> => s !== null)

    console.log('[PRODUCTION_RECORDS_POST] 📦 Consumo de insumos calculado:', suppliesToConsume)

    // 🧪 2.6. Verificar estoque de ingredientes de insumos compostos
    const compoundIngredientConsumption: Array<{
      ingredientId: string
      ingredientName: string
      currentStock: number
      quantityNeeded: number
      unit: string
      usedBySupply: string
    }> = []

    for (const supply of suppliesToConsume) {
      // Buscar receita do insumo se for composto
      const supplyRecipe = await prisma.supplyRecipe.findUnique({
        where: { supplyId: supply.supplyId },
        include: {
          Items: {
            include: {
              Ingredient: true
            }
          }
        }
      })

      if (supplyRecipe) {
        const proportionFactor = supply.quantityNeeded / supplyRecipe.yieldAmount
        
        for (const recipeItem of supplyRecipe.Items) {
          const ingredientQtyNeeded = recipeItem.quantity * proportionFactor
          
          compoundIngredientConsumption.push({
            ingredientId: recipeItem.ingredientId,
            ingredientName: recipeItem.Ingredient.name,
            currentStock: recipeItem.Ingredient.currentStock,
            quantityNeeded: ingredientQtyNeeded,
            unit: recipeItem.unit,
            usedBySupply: supply.supplyName
          })
        }
      }
    }

    if (compoundIngredientConsumption.length > 0) {
      console.log('[PRODUCTION_RECORDS_POST] 🧪 Consumo de ingredientes de insumos compostos:', compoundIngredientConsumption)
    }

    // ⚠️ PERMITIR ESTOQUE NEGATIVO - Não bloquear produção por falta de estoque
    // Apenas registrar avisos no console para controle
    const insufficientStock = materialsToConsume.filter(
      mat => mat.currentStock < mat.quantityNeeded
    )

    const insufficientSupplies = suppliesToConsume.filter(
      sup => sup.currentStock < sup.quantityNeeded
    )

    const insufficientCompoundIngredients = compoundIngredientConsumption.filter(
      ing => ing.currentStock < ing.quantityNeeded
    )

    // Avisos de estoque insuficiente (não bloqueia mais)
    if (insufficientStock.length > 0) {
      const details = insufficientStock.map(mat => 
        `${mat.rawMaterialName}: disponível ${mat.currentStock.toFixed(3)} kg, necessário ${mat.quantityNeeded.toFixed(3)} kg (NEGATIVO: ${(mat.currentStock - mat.quantityNeeded).toFixed(3)} kg)`
      ).join('; ')
      
      console.warn('[PRODUCTION_RECORDS_POST] ⚠️ ESTOQUE NEGATIVO - Matérias-primas:', details)
    }

    if (insufficientSupplies.length > 0) {
      const details = insufficientSupplies.map(sup => 
        `${sup.supplyName}: disponível ${sup.currentStock.toFixed(2)} ${sup.unit}, necessário ${sup.quantityNeeded.toFixed(2)} ${sup.unit} (NEGATIVO: ${(sup.currentStock - sup.quantityNeeded).toFixed(2)} ${sup.unit})`
      ).join('; ')
      
      console.warn('[PRODUCTION_RECORDS_POST] ⚠️ ESTOQUE NEGATIVO - Insumos:', details)
    }

    if (insufficientCompoundIngredients.length > 0) {
      const details = insufficientCompoundIngredients.map(ing => 
        `${ing.ingredientName} (usado por "${ing.usedBySupply}"): disponível ${ing.currentStock.toFixed(3)} ${ing.unit}, necessário ${ing.quantityNeeded.toFixed(3)} ${ing.unit} (NEGATIVO: ${(ing.currentStock - ing.quantityNeeded).toFixed(3)} ${ing.unit})`
      ).join('; ')
      
      console.warn('[PRODUCTION_RECORDS_POST] ⚠️ ESTOQUE NEGATIVO - Ingredientes de insumos compostos:', details)
    }

    // TUDO OK! Executar em transação:
    // 1. Criar registro de produção
    // 2. Dar baixa nas matérias-primas
    // 3. Dar entrada no produto final
    const result = await prisma.$transaction(async (tx) => {
      // 1. Criar registro de produção
      const record = await tx.productionRecord.create({
        data: {
          employeeId,
          productId,
          quantity: parseFloat(quantity),
          date: date ? new Date(date) : new Date(),
          shift: shift || 'FULL_DAY',
          notes: notes || null,
          qualityScore: qualityScore ? parseFloat(qualityScore) : null,
          rejectedQty: rejectedQty ? parseFloat(rejectedQty) : null,
          registeredBy: session.user.id
        },
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              employeeNumber: true,
              position: true
            }
          },
          product: {
            select: {
              id: true,
              name: true,
              category: true,
              imageUrl: true,
              currentStock: true
            }
          }
        }
      })

      console.log('[PRODUCTION_RECORDS_POST] ✅ Registro criado:', record.id)

      // 2. Dar baixa nas matérias-primas e criar movimentações
      const inventoryMovements = []
      for (const material of materialsToConsume) {
        const previousStock = material.currentStock
        const newStock = previousStock - material.quantityNeeded

        // Atualizar estoque da matéria-prima
        await tx.rawMaterial.update({
          where: { id: material.rawMaterialId },
          data: { currentStock: newStock }
        })

        // Criar movimentação de estoque
        const movement = await tx.inventoryMovement.create({
          data: {
            rawMaterialId: material.rawMaterialId,
            type: 'EXIT',
            quantity: -material.quantityNeeded, // Negativo para saída
            previousStock,
            newStock,
            reason: `Produção de ${quantity} ${product.name}`,
            notes: `Funcionário: ${employee.name} | Registro: ${record.id}`,
            referenceId: record.id,
            performedBy: session.user.name || session.user.email,
            performedById: session.user.id
          }
        })

        inventoryMovements.push(movement)

        console.log(`[PRODUCTION_RECORDS_POST] 📉 Baixa: ${material.rawMaterialName}: ${previousStock.toFixed(3)} kg → ${newStock.toFixed(3)} kg (-${material.quantityNeeded.toFixed(3)} kg)`)
      }

      // 🆕 2.5. Dar baixa nos insumos e criar movimentações
      for (const supply of suppliesToConsume) {
        const previousStock = supply.currentStock
        const newStock = previousStock - supply.quantityNeeded

        // Atualizar estoque do insumo
        await tx.productionSupplyGlobal.update({
          where: { id: supply.supplyId },
          data: { currentStock: newStock }
        })

        // Criar movimentação de insumo
        await tx.supplyMovement.create({
          data: {
            supplyId: supply.supplyId,
            type: 'OUT',
            quantity: supply.quantityNeeded,
            reason: 'PRODUCTION',
            reference: record.id,
            notes: `Produção de ${quantity} ${product.name} - Funcionário: ${employee.name}`,
            createdBy: session.user.id
          }
        })

        console.log(`[PRODUCTION_RECORDS_POST] 📦 Baixa de insumo: ${supply.supplyName}: ${previousStock.toFixed(2)} ${supply.unit} → ${newStock.toFixed(2)} ${supply.unit} (-${supply.quantityNeeded.toFixed(2)} ${supply.unit})`)

        // 🧪 2.6. Se o insumo for composto (tem receita), dar baixa proporcional nos ingredientes
        const compoundSupplyRecipe = await tx.supplyRecipe.findUnique({
          where: { supplyId: supply.supplyId },
          include: {
            Items: {
              include: {
                Ingredient: true
              }
            }
          }
        })

        if (compoundSupplyRecipe) {
          console.log(`[PRODUCTION_RECORDS_POST] 🧪 Insumo composto detectado: ${supply.supplyName} - Dando baixa proporcional nos ${compoundSupplyRecipe.Items.length} ingredientes`)

          // Calcular proporção: quantityNeeded / yieldAmount
          const proportionFactor = supply.quantityNeeded / compoundSupplyRecipe.yieldAmount

          for (const recipeItem of compoundSupplyRecipe.Items) {
            // Calcular quantidade proporcional do ingrediente
            const ingredientQtyNeeded = recipeItem.quantity * proportionFactor

            // Atualizar estoque do ingrediente
            const ingredientPrevStock = recipeItem.Ingredient.currentStock
            const ingredientNewStock = ingredientPrevStock - ingredientQtyNeeded

            await tx.productionSupplyGlobal.update({
              where: { id: recipeItem.ingredientId },
              data: { currentStock: ingredientNewStock }
            })

            // Criar movimentação do ingrediente
            await tx.supplyMovement.create({
              data: {
                supplyId: recipeItem.ingredientId,
                type: 'OUT',
                quantity: ingredientQtyNeeded,
                reason: 'PRODUCTION',
                reference: record.id,
                notes: `Consumo por insumo composto "${supply.supplyName}" na produção de ${quantity} ${product.name}`,
                createdBy: session.user.id
              }
            })

            console.log(`[PRODUCTION_RECORDS_POST]   └─ Ingrediente: ${recipeItem.Ingredient.name}: ${ingredientPrevStock.toFixed(3)} ${recipeItem.unit} → ${ingredientNewStock.toFixed(3)} ${recipeItem.unit} (-${ingredientQtyNeeded.toFixed(3)} ${recipeItem.unit})`)
          }
        }
      }

      // 3. Dar entrada no produto final
      const previousProductStock = product.currentStock || 0
      const newProductStock = previousProductStock + parseFloat(quantity)

      await tx.product.update({
        where: { id: productId },
        data: { currentStock: newProductStock }
      })

      // 📊 Registrar movimentação de ENTRADA do produto acabado
      const productMovement = await tx.inventoryMovement.create({
        data: {
          productId: productId,
          type: 'ENTRY',
          quantity: parseFloat(quantity), // Positivo para entrada
          previousStock: previousProductStock,
          newStock: newProductStock,
          reason: `Produção - ${product.name}`,
          notes: `Funcionário: ${employee.name} | Registro: ${record.id}`,
          referenceId: record.id,
          performedBy: session.user.name || session.user.email,
          performedById: session.user.id
        }
      })
      inventoryMovements.push(productMovement)

      console.log(`[PRODUCTION_RECORDS_POST] 📈 Entrada: ${product.name}: ${previousProductStock} un → ${newProductStock} un (+${quantity} un)`)

      return {
        record,
        inventoryMovements,
        stockUpdates: {
          rawMaterials: materialsToConsume.map(mat => ({
            name: mat.rawMaterialName,
            consumed: mat.quantityNeeded
          })),
          supplies: suppliesToConsume.map(sup => ({
            name: sup.supplyName,
            consumed: sup.quantityNeeded,
            unit: sup.unit
          })),
          product: {
            name: product.name,
            previousStock: previousProductStock,
            newStock: newProductStock,
            added: parseFloat(quantity)
          }
        }
      }
    })

    console.log('[PRODUCTION_RECORDS_POST] 🎉 Transação concluída com sucesso!')
    console.log('[PRODUCTION_RECORDS_POST] 📊 Resumo:')
    console.log(`   - Registro de produção: ${result.record.id}`)
    console.log(`   - Movimentações de estoque: ${result.inventoryMovements.length}`)
    console.log(`   - Produto final: +${quantity} ${product.name}`)

    const totalItemsConsumed = result.stockUpdates.rawMaterials.length + result.stockUpdates.supplies.length
    return NextResponse.json({ 
      record: result.record,
      stockUpdates: result.stockUpdates,
      message: `Produção registrada com sucesso! ${quantity} ${product.name} produzidos, ${result.stockUpdates.rawMaterials.length} matérias-primas e ${result.stockUpdates.supplies.length} insumos consumidos.`
    }, { status: 201 })
  } catch (error: any) {
    console.error('[PRODUCTION_RECORDS_POST] ❌ Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao criar registro de produção', details: error.message },
      { status: 500 }
    )
  }
}
