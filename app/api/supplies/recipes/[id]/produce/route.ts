export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

// ✅ POST - Produzir insumo composto
// Baixa os ingredientes do estoque e adiciona o produto final
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    console.log('[SUPPLY_PRODUCE] Dados recebidos:', body);

    const { multiplier, notes } = body;

    // multiplier: quantas vezes a receita será produzida (padrão: 1)
    const productionMultiplier = multiplier ? parseFloat(multiplier) : 1;

    if (productionMultiplier <= 0) {
      return NextResponse.json(
        { error: 'Multiplicador deve ser maior que zero' },
        { status: 400 }
      );
    }

    console.log(`[SUPPLY_PRODUCE] Produzindo ${productionMultiplier}x a receita ${params.id}...`);

    // Buscar receita completa
    const recipe = await prisma.supplyRecipe.findUnique({
      where: { id: params.id },
      include: {
        Supply: true,
        Items: {
          include: {
            Ingredient: true,
          },
        },
      },
    });

    if (!recipe) {
      return NextResponse.json({ error: 'Receita não encontrada' }, { status: 404 });
    }

    if (!recipe.isActive) {
      return NextResponse.json(
        { error: 'Esta receita está inativa e não pode ser produzida' },
        { status: 400 }
      );
    }

    console.log(`[SUPPLY_PRODUCE] Receita: ${recipe.name}`);
    console.log(`[SUPPLY_PRODUCE] Rendimento: ${recipe.yieldAmount} ${recipe.yieldUnit}`);
    console.log(`[SUPPLY_PRODUCE] Multiplicador: ${productionMultiplier}x`);

    // Verificar estoque dos ingredientes
    const insufficientStock: string[] = [];
    for (const item of recipe.Items) {
      const requiredQuantity = item.quantity * productionMultiplier;
      if (item.Ingredient.currentStock < requiredQuantity) {
        insufficientStock.push(
          `${item.Ingredient.name}: necessário ${requiredQuantity} ${item.unit}, disponível ${item.Ingredient.currentStock} ${item.Ingredient.unit}`
        );
      }
    }

    if (insufficientStock.length > 0) {
      console.log('[SUPPLY_PRODUCE] ❌ Estoque insuficiente:', insufficientStock);
      return NextResponse.json(
        {
          error: 'Estoque insuficiente para produção',
          details: insufficientStock,
        },
        { status: 400 }
      );
    }

    console.log('[SUPPLY_PRODUCE] ✅ Estoque suficiente. Iniciando produção...');

    // Executar produção em transação
    const production = await prisma.$transaction(async (tx) => {
      // 1. Calcular quantidade produzida e custo total
      const quantityProduced = recipe.yieldAmount * productionMultiplier;
      const productionCost = recipe.estimatedCost * productionMultiplier;

      console.log(`[SUPPLY_PRODUCE] Quantidade a produzir: ${quantityProduced} ${recipe.yieldUnit}`);
      console.log(`[SUPPLY_PRODUCE] Custo total: R$ ${productionCost.toFixed(2)}`);

      // 2. Baixar ingredientes do estoque
      for (const item of recipe.Items) {
        const requiredQuantity = item.quantity * productionMultiplier;

        console.log(
          `[SUPPLY_PRODUCE] Baixando ${requiredQuantity} ${item.unit} de ${item.Ingredient.name}...`
        );

        // Atualizar estoque do ingrediente
        await tx.productionSupplyGlobal.update({
          where: { id: item.ingredientId },
          data: {
            currentStock: {
              decrement: requiredQuantity,
            },
          },
        });

        // Registrar movimentação de saída
        await tx.supplyMovement.create({
          data: {
            supplyId: item.ingredientId,
            type: 'OUT',
            quantity: requiredQuantity,
            reason: 'PRODUCTION',
            notes: `Usado na produção de ${quantityProduced} ${recipe.yieldUnit} de ${recipe.Supply.name}`,
          },
        });
      }

      // 3. Adicionar insumo produzido ao estoque
      console.log(
        `[SUPPLY_PRODUCE] Adicionando ${quantityProduced} ${recipe.yieldUnit} de ${recipe.Supply.name} ao estoque...`
      );

      const newStock = await tx.productionSupplyGlobal.update({
        where: { id: recipe.supplyId },
        data: {
          currentStock: {
            increment: quantityProduced,
          },
          // Atualizar custo unitário baseado no custo de produção
          costPerUnit: productionCost / quantityProduced,
        },
      });

      // Registrar movimentação de entrada
      await tx.supplyMovement.create({
        data: {
          supplyId: recipe.supplyId,
          type: 'IN',
          quantity: quantityProduced,
          reason: 'PRODUCTION',
          notes: notes || `Produção de ${recipe.name}`,
        },
      });

      // 4. Registrar produção no histórico
      const newProduction = await tx.supplyProduction.create({
        data: {
          recipeId: recipe.id,
          supplyId: recipe.supplyId,
          quantityProduced,
          unit: recipe.yieldUnit,
          productionCost,
          productionDate: new Date(),
          notes: notes || null,
          producedBy: (session.user as any)?.id || null,
        },
      });

      console.log('[SUPPLY_PRODUCE] ✅ Produção registrada:', newProduction.id);
      console.log(`[SUPPLY_PRODUCE] Estoque atualizado: ${newStock.currentStock} ${newStock.unit}`);

      return {
        production: newProduction,
        newStock: newStock.currentStock,
        costPerUnit: newStock.costPerUnit,
      };
    });

    return NextResponse.json(
      {
        message: 'Produção realizada com sucesso',
        production: production.production,
        newStock: production.newStock,
        costPerUnit: production.costPerUnit,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[SUPPLY_PRODUCE] ❌ Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao produzir insumo', details: error.message },
      { status: 500 }
    );
  }
}
