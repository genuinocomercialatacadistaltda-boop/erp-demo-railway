export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

// ✅ GET - Buscar receita específica
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const recipe = await prisma.supplyRecipe.findUnique({
      where: { id: params.id },
      include: {
        Supply: true,
        Items: {
          include: {
            Ingredient: true,
          },
        },
        Productions: {
          orderBy: {
            productionDate: 'desc',
          },
        },
      },
    });

    if (!recipe) {
      return NextResponse.json({ error: 'Receita não encontrada' }, { status: 404 });
    }

    return NextResponse.json(recipe);
  } catch (error: any) {
    console.error('[SUPPLY_RECIPE_GET] ❌ Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar receita', details: error.message },
      { status: 500 }
    );
  }
}

// ✅ PUT - Atualizar receita
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    console.log('[SUPPLY_RECIPE_PUT] Dados recebidos:', body);

    const { name, description, yieldAmount, yieldUnit, notes, items, isActive } = body;

    // Buscar receita existente
    const existingRecipe = await prisma.supplyRecipe.findUnique({
      where: { id: params.id },
    });

    if (!existingRecipe) {
      return NextResponse.json({ error: 'Receita não encontrada' }, { status: 404 });
    }

    console.log('[SUPPLY_RECIPE_PUT] Recalculando custo estimado...');

    // Recalcular custo estimado se items foi fornecido
    let estimatedCost = existingRecipe.estimatedCost;
    if (items && items.length > 0) {
      estimatedCost = 0;
      for (const item of items) {
        const ingredient = await prisma.productionSupplyGlobal.findUnique({
          where: { id: item.ingredientId },
          select: { costPerUnit: true },
        });

        if (ingredient) {
          const itemCost = ingredient.costPerUnit * parseFloat(item.quantity);
          estimatedCost += itemCost;
        }
      }
      console.log(`[SUPPLY_RECIPE_PUT] Novo custo estimado: R$ ${estimatedCost.toFixed(2)}`);
    }

    // Atualizar receita e seus itens em uma transação
    const updatedRecipe = await prisma.$transaction(async (tx) => {
      // 1. Atualizar dados da receita
      const updated = await tx.supplyRecipe.update({
        where: { id: params.id },
        data: {
          name: name || existingRecipe.name,
          description: description !== undefined ? description : existingRecipe.description,
          yieldAmount: yieldAmount ? parseFloat(yieldAmount) : existingRecipe.yieldAmount,
          yieldUnit: yieldUnit || existingRecipe.yieldUnit,
          estimatedCost,
          notes: notes !== undefined ? notes : existingRecipe.notes,
          isActive: isActive !== undefined ? isActive : existingRecipe.isActive,
        },
      });

      // 2. Se items foi fornecido, atualizar os itens da receita
      if (items && items.length > 0) {
        // Deletar itens existentes
        await tx.supplyRecipeItem.deleteMany({
          where: { recipeId: params.id },
        });

        // Criar novos itens
        const recipeItems = items.map((item: any) => ({
          recipeId: params.id,
          ingredientId: item.ingredientId,
          quantity: parseFloat(item.quantity),
          unit: item.unit,
          notes: item.notes || null,
        }));

        await tx.supplyRecipeItem.createMany({
          data: recipeItems,
        });

        console.log(`[SUPPLY_RECIPE_PUT] ${recipeItems.length} itens atualizados`);
      }

      return updated;
    });

    // Buscar receita completa para retornar
    const fullRecipe = await prisma.supplyRecipe.findUnique({
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

    console.log('[SUPPLY_RECIPE_PUT] ✅ Receita atualizada');

    return NextResponse.json(fullRecipe);
  } catch (error: any) {
    console.error('[SUPPLY_RECIPE_PUT] ❌ Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar receita', details: error.message },
      { status: 500 }
    );
  }
}

// ✅ DELETE - Excluir receita
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    console.log('[SUPPLY_RECIPE_DELETE] Excluindo receita:', params.id);

    // Buscar receita para obter supplyId
    const recipe = await prisma.supplyRecipe.findUnique({
      where: { id: params.id },
      select: { supplyId: true },
    });

    if (!recipe) {
      return NextResponse.json({ error: 'Receita não encontrada' }, { status: 404 });
    }

    // Excluir receita e atualizar insumo em uma transação
    await prisma.$transaction(async (tx) => {
      // 1. Excluir receita (os itens e produções são excluídos em cascata)
      await tx.supplyRecipe.delete({
        where: { id: params.id },
      });

      // 2. Atualizar flag hasRecipe do insumo
      await tx.productionSupplyGlobal.update({
        where: { id: recipe.supplyId },
        data: { hasRecipe: false },
      });

      console.log('[SUPPLY_RECIPE_DELETE] ✅ Receita excluída');
    });

    return NextResponse.json({ message: 'Receita excluída com sucesso' });
  } catch (error: any) {
    console.error('[SUPPLY_RECIPE_DELETE] ❌ Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao excluir receita', details: error.message },
      { status: 500 }
    );
  }
}
