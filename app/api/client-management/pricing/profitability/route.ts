import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET - Dashboard de rentabilidade do cliente
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

    // Buscar todas as receitas ativas do cliente
    const recipes = await prisma.clientRecipe.findMany({
      where: {
        customerId,
        isActive: true,
      },
      include: {
        Ingredients: true,
        Supplies: {
          where: { isActive: true },
        },
      },
    });

    // Buscar produtos do cliente para pegar preço de venda
    const productsMap = new Map();
    const productIds = [...new Set(recipes.map(r => r.productId))];
    
    if (productIds.length > 0) {
      const products = await prisma.clientProduct.findMany({
        where: {
          customerId,
          id: { in: productIds },
        },
      });

      products.forEach(p => {
        productsMap.set(p.id, p.unitPrice || 0);
      });
    }

    // Calcular rentabilidade de cada receita
    const profitabilityData = recipes.map(recipe => {
      // Custo de ingredientes
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

      // Custo de insumos
      const suppliesCost = recipe.Supplies.reduce((sum, supply) => {
        return sum + (supply.costPerUnit * supply.quantityPerUnit);
      }, 0);

      const totalCostPerUnit = (ingredientsCost + suppliesCost) / recipe.yieldQuantity;
      const salePrice = productsMap.get(recipe.productId) || 0;
      const profitPerUnit = salePrice - totalCostPerUnit;
      const profitMargin = salePrice > 0 ? (profitPerUnit / salePrice) * 100 : 0;

      return {
        recipeId: recipe.id,
        recipeName: recipe.name,
        productId: recipe.productId,
        yieldQuantity: recipe.yieldQuantity,
        costs: {
          ingredients: ingredientsCost,
          supplies: suppliesCost,
          total: ingredientsCost + suppliesCost,
          perUnit: totalCostPerUnit,
        },
        salePrice,
        profitPerUnit,
        profitMargin,
        status: profitMargin < 20 ? 'low' : profitMargin < 40 ? 'medium' : 'high',
      };
    });

    // Estatísticas gerais
    const stats = {
      totalRecipes: recipes.length,
      averageMargin:
        profitabilityData.length > 0
          ? profitabilityData.reduce((sum, r) => sum + r.profitMargin, 0) / profitabilityData.length
          : 0,
      lowMarginCount: profitabilityData.filter(r => r.status === 'low').length,
      mediumMarginCount: profitabilityData.filter(r => r.status === 'medium').length,
      highMarginCount: profitabilityData.filter(r => r.status === 'high').length,
    };

    return NextResponse.json({
      recipes: profitabilityData,
      stats,
    });
  } catch (error) {
    console.error('[CLIENT_PROFITABILITY_GET] Error:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar rentabilidade', details: (error as Error).message },
      { status: 500 }
    );
  }
}
