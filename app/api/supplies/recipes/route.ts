import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

// ✅ GET - Listar todas as receitas de insumos
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    console.log('[SUPPLY_RECIPES_GET] Buscando todas as receitas de insumos...');

    const recipes = await prisma.supplyRecipe.findMany({
      include: {
        Supply: {
          select: {
            id: true,
            name: true,
            unit: true,
            category: true,
            costPerUnit: true,
            currentStock: true,
          },
        },
        Items: {
          include: {
            Ingredient: {
              select: {
                id: true,
                name: true,
                unit: true,
                costPerUnit: true,
                currentStock: true,
              },
            },
          },
        },
        Productions: {
          select: {
            id: true,
            quantityProduced: true,
            productionCost: true,
            productionDate: true,
          },
          orderBy: {
            productionDate: 'desc',
          },
          take: 5, // Últimas 5 produções
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`[SUPPLY_RECIPES_GET] ✅ Encontradas ${recipes.length} receitas`);

    return NextResponse.json(recipes);
  } catch (error: any) {
    console.error('[SUPPLY_RECIPES_GET] ❌ Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar receitas de insumos', details: error.message },
      { status: 500 }
    );
  }
}

// ✅ POST - Criar nova receita de insumo
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    console.log('[SUPPLY_RECIPES_POST] Dados recebidos:', body);

    const {
      supplyId,
      name,
      description,
      yieldAmount,
      yieldUnit,
      notes,
      items, // Array de ingredientes: [{ ingredientId, quantity, unit, notes }]
    } = body;

    // Validações
    if (!supplyId || !name || !yieldAmount || !yieldUnit || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: supplyId, name, yieldAmount, yieldUnit, items' },
        { status: 400 }
      );
    }

    // Verificar se o insumo existe
    const supply = await prisma.productionSupplyGlobal.findUnique({
      where: { id: supplyId },
    });

    if (!supply) {
      return NextResponse.json({ error: 'Insumo não encontrado' }, { status: 404 });
    }

    // Verificar se já existe receita para este insumo
    const existingRecipe = await prisma.supplyRecipe.findUnique({
      where: { supplyId },
    });

    if (existingRecipe) {
      return NextResponse.json(
        { error: 'Já existe uma receita para este insumo. Use PUT para atualizar.' },
        { status: 409 }
      );
    }

    console.log('[SUPPLY_RECIPES_POST] Calculando custo estimado...');

    // Calcular custo estimado da receita
    let estimatedCost = 0;
    for (const item of items) {
      const ingredient = await prisma.productionSupplyGlobal.findUnique({
        where: { id: item.ingredientId },
        select: { costPerUnit: true, unit: true },
      });

      if (ingredient) {
        // Custo do ingrediente na receita
        const itemCost = ingredient.costPerUnit * parseFloat(item.quantity);
        estimatedCost += itemCost;
        console.log(
          `[SUPPLY_RECIPES_POST]   ${item.ingredientId}: ${item.quantity} ${item.unit} x R$ ${ingredient.costPerUnit.toFixed(2)} = R$ ${itemCost.toFixed(2)}`
        );
      }
    }

    console.log(`[SUPPLY_RECIPES_POST] Custo total estimado: R$ ${estimatedCost.toFixed(2)}`);

    // Criar receita e seus itens em uma transação
    const recipe = await prisma.$transaction(async (tx) => {
      // 1. Criar a receita
      const newRecipe = await tx.supplyRecipe.create({
        data: {
          supplyId,
          name,
          description: description || null,
          yieldAmount: parseFloat(yieldAmount),
          yieldUnit,
          estimatedCost,
          notes: notes || null,
          createdBy: (session.user as any)?.id || null,
          isActive: true,
        },
      });

      // 2. Criar os itens da receita
      const recipeItems = items.map((item: any) => ({
        recipeId: newRecipe.id,
        ingredientId: item.ingredientId,
        quantity: parseFloat(item.quantity),
        unit: item.unit,
        notes: item.notes || null,
      }));

      await tx.supplyRecipeItem.createMany({
        data: recipeItems,
      });

      // 3. Marcar o insumo como tendo receita
      await tx.productionSupplyGlobal.update({
        where: { id: supplyId },
        data: { hasRecipe: true },
      });

      console.log('[SUPPLY_RECIPES_POST] ✅ Receita criada:', newRecipe.id);

      return newRecipe;
    });

    // Buscar receita completa para retornar
    const fullRecipe = await prisma.supplyRecipe.findUnique({
      where: { id: recipe.id },
      include: {
        Supply: true,
        Items: {
          include: {
            Ingredient: true,
          },
        },
      },
    });

    return NextResponse.json(fullRecipe, { status: 201 });
  } catch (error: any) {
    console.error('[SUPPLY_RECIPES_POST] ❌ Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao criar receita de insumo', details: error.message },
      { status: 500 }
    );
  }
}
