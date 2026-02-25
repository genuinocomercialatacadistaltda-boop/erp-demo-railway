export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// POST - Simular preço com diferentes margens
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { recipeId, marginPercentages } = body;

    if (!recipeId || !marginPercentages || !Array.isArray(marginPercentages)) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: recipeId, marginPercentages (array)' },
        { status: 400 }
      );
    }

    // Buscar receita
    const recipe = await prisma.clientRecipe.findUnique({
      where: { id: recipeId },
      include: {
        Ingredients: true,
        Supplies: {
          where: { isActive: true },
        },
      },
    });

    if (!recipe) {
      return NextResponse.json(
        { error: 'Receita não encontrada' },
        { status: 404 }
      );
    }

    if (recipe.customerId !== customerId) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 403 }
      );
    }

    // Calcular custos
    const ingredientsCost = recipe.Ingredients.reduce((sum, ing) => {
      // Aplicar quebras de forma multiplicativa (correto)
      let realQuantity = ing.quantityGrams;
      
      // Aplicar quebra invisível (ex: 135g × 1.05 = 141.75g)
      if (ing.invisibleWastePercent > 0) {
        realQuantity = realQuantity * (1 + ing.invisibleWastePercent / 100);
      }
      
      // Aplicar quebra visível (ex: 141.75g × 1.05 = 148.84g)
      if (ing.visibleWastePercent > 0) {
        realQuantity = realQuantity * (1 + ing.visibleWastePercent / 100);
      }
      
      return sum + (ing.costPerGram * realQuantity);
    }, 0);

    const suppliesCost = recipe.Supplies.reduce((sum, supply) => {
      return sum + (supply.costPerUnit * supply.quantityPerUnit);
    }, 0);

    const totalCostPerUnit = (ingredientsCost + suppliesCost) / recipe.yieldQuantity;

    // Simular preços com diferentes margens
    const simulations = marginPercentages.map((margin: number) => {
      const salePrice = totalCostPerUnit / (1 - margin / 100);
      const profit = salePrice - totalCostPerUnit;

      return {
        margin,
        cost: totalCostPerUnit,
        salePrice: parseFloat(salePrice.toFixed(2)),
        profit: parseFloat(profit.toFixed(2)),
      };
    });

    return NextResponse.json({
      recipe: {
        id: recipe.id,
        name: recipe.name,
        yieldQuantity: recipe.yieldQuantity,
      },
      costs: {
        ingredients: ingredientsCost,
        supplies: suppliesCost,
        total: ingredientsCost + suppliesCost,
        perUnit: totalCostPerUnit,
      },
      simulations,
    });
  } catch (error) {
    console.error('[CLIENT_PRICE_SIMULATOR_POST] Error:', error);
    return NextResponse.json(
      { error: 'Erro ao simular preço', details: (error as Error).message },
      { status: 500 }
    );
  }
}
