export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET - Sugestões de otimização de custos
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any).userType !== 'CUSTOMER') {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const customerId = (session.user as any).customerId;
    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID não encontrado' },
        { status: 400 }
      );
    }

    const suggestions: any[] = [];

    // 1. Receitas sem insumos cadastrados
    const recipesWithoutSupplies = await prisma.clientRecipe.findMany({
      where: {
        customerId,
        isActive: true,
        Supplies: {
          none: {},
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (recipesWithoutSupplies.length > 0) {
      suggestions.push({
        type: 'warning',
        category: 'incomplete_recipe',
        title: 'Receitas sem Insumos',
        description: `${recipesWithoutSupplies.length} receita(s) não possuem insumos cadastrados (palitos, embalagens, etc.)`,
        items: recipesWithoutSupplies,
        action: 'Adicionar insumos às receitas',
      });
    }

    // 2. Receitas sem ingredientes cadastrados
    const recipesWithoutIngredients = await prisma.clientRecipe.findMany({
      where: {
        customerId,
        isActive: true,
        Ingredients: {
          none: {},
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (recipesWithoutIngredients.length > 0) {
      suggestions.push({
        type: 'warning',
        category: 'incomplete_recipe',
        title: 'Receitas sem Ingredientes',
        description: `${recipesWithoutIngredients.length} receita(s) não possuem ingredientes cadastrados`,
        items: recipesWithoutIngredients,
        action: 'Adicionar ingredientes às receitas',
      });
    }

    // 3. Insumos não utilizados
    const unusedSupplies = await prisma.clientProductionSupplyGlobal.findMany({
      where: {
        customerId,
        isActive: true,
        ProductionSupplies: {
          none: {},
        },
      },
      select: {
        id: true,
        name: true,
        costPerUnit: true,
      },
    });

    if (unusedSupplies.length > 0) {
      suggestions.push({
        type: 'info',
        category: 'unused_supply',
        title: 'Insumos Não Utilizados',
        description: `${unusedSupplies.length} insumo(s) estão cadastrados mas não são usados em nenhuma receita`,
        items: unusedSupplies,
        action: 'Revisar insumos ou desativar os não utilizados',
      });
    }

    // 4. Receitas com alto percentual de quebra
    const recipesWithHighWaste = await prisma.clientRecipe.findMany({
      where: {
        customerId,
        isActive: true,
      },
      include: {
        Ingredients: true,
      },
    });

    const highWasteRecipes = recipesWithHighWaste
      .map(recipe => {
        const avgWaste =
          recipe.Ingredients.length > 0
            ? recipe.Ingredients.reduce(
                (sum, ing) => sum + ing.invisibleWastePercent + ing.visibleWastePercent,
                0
              ) / recipe.Ingredients.length
            : 0;

        return {
          id: recipe.id,
          name: recipe.name,
          avgWaste,
        };
      })
      .filter(r => r.avgWaste > 20);

    if (highWasteRecipes.length > 0) {
      suggestions.push({
        type: 'warning',
        category: 'high_waste',
        title: 'Receitas com Alto Percentual de Quebra',
        description: `${highWasteRecipes.length} receita(s) possuem média de quebra acima de 20%`,
        items: highWasteRecipes,
        action: 'Revisar processos de produção para reduzir quebras',
      });
    }

    // 5. Insumos duplicados (mesmo nome/categoria)
    const allSupplies = await prisma.clientProductionSupplyGlobal.findMany({
      where: {
        customerId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        category: true,
        costPerUnit: true,
      },
    });

    const duplicates = new Map<string, any[]>();
    allSupplies.forEach(supply => {
      const key = `${supply.name.toLowerCase()}_${supply.category}`;
      if (!duplicates.has(key)) {
        duplicates.set(key, []);
      }
      duplicates.get(key)?.push(supply);
    });

    const duplicateSupplies = Array.from(duplicates.values())
      .filter(group => group.length > 1)
      .flat();

    if (duplicateSupplies.length > 0) {
      suggestions.push({
        type: 'info',
        category: 'duplicate_supply',
        title: 'Possíveis Insumos Duplicados',
        description: `Encontrados ${duplicateSupplies.length} insumos com nomes/categorias similares`,
        items: duplicateSupplies,
        action: 'Revisar e unificar insumos duplicados',
      });
    }

    return NextResponse.json({
      totalSuggestions: suggestions.length,
      suggestions,
    });
  } catch (error) {
    console.error('[CLIENT_SUGGESTIONS_GET] Error:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar sugestões', details: (error as Error).message },
      { status: 500 }
    );
  }
}
