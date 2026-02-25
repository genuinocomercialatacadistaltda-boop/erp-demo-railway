
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

/**
 * API para análise de rentabilidade de produtos
 * GET: Retorna dados de custo, preço e margem de lucro de produtos com receitas
 */

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).userType !== "ADMIN") {
      return NextResponse.json(
        { error: "Acesso negado" },
        { status: 401 }
      );
    }

    console.log("[PROFITABILITY_GET] Buscando dados de rentabilidade...");

    // Buscar todas as receitas ativas com seus produtos
    const recipes = await prisma.recipe.findMany({
      where: {
        isActive: true,
      },
      include: {
        Product: {
          select: {
            id: true,
            name: true,
            priceWholesale: true,
            isActive: true,
          },
        },
        Ingredients: {
          include: {
            RawMaterial: {
              select: {
                id: true,
                name: true,
                costPerUnit: true,
                measurementUnit: true,
                icmsRate: true,
              },
            },
          },
        },
        Supplies: {
          where: {
            isActive: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    console.log("[PROFITABILITY_GET] Receitas encontradas:", recipes.length);

    // Calcular rentabilidade de cada produto
    const profitabilityData = recipes.map((recipe) => {
      // Custo de ingredientes (com quebras e ICMS)
      const ingredientsCost = recipe.Ingredients.reduce((sum, ing: any) => {
        // Usar o custo da matéria-prima como base
        let baseCostPerUnit = ing.RawMaterial.costPerUnit;
        
        // Aplicar ICMS fixo de 3.6% (se matéria-prima tiver ICMS habilitado)
        const hasIcms = (ing.RawMaterial.icmsRate || 0) > 0;
        if (hasIcms) {
          baseCostPerUnit = baseCostPerUnit * 1.036;
        }
        
        if (!baseCostPerUnit) return sum;
        
        // Aplicar quebras de forma multiplicativa (correto)
        let adjustedQuantity = ing.quantityGrams;
        
        // Aplicar quebra invisível (ex: 135g × 1.05 = 141.75g)
        if (ing.invisibleWastePercent > 0) {
          adjustedQuantity = adjustedQuantity * (1 + ing.invisibleWastePercent / 100);
        }
        
        // Aplicar quebra visível (ex: 141.75g × 1.05 = 148.84g)
        if (ing.visibleWastePercent > 0) {
          adjustedQuantity = adjustedQuantity * (1 + ing.visibleWastePercent / 100);
        }
        
        // Custo por grama (assumindo que a unidade base é KG)
        const costPerGram = baseCostPerUnit / 1000; // kg -> g
        const cost = adjustedQuantity * costPerGram;
        
        return sum + cost;
      }, 0);

      // Custo de insumos
      // LÓGICA CORRIGIDA: divide o custo pela quantidade de unidades que o insumo produz
      // Exemplo: Embalagem R$ 0,11 produz 5 espetos → R$ 0,11 / 5 = R$ 0,022 por espeto
      const suppliesCost = recipe.Supplies.reduce((sum, supply) => {
        const costPerProducedUnit = supply.costPerUnit / supply.quantityPerUnit;
        return sum + costPerProducedUnit;
      }, 0);

      const totalCost = ingredientsCost + suppliesCost;
      const sellingPrice = recipe.Product.priceWholesale || 0;
      
      // Calcular margem de lucro
      const profit = sellingPrice - totalCost;
      const profitMargin = sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;
      
      // Determinar status de rentabilidade
      let status: 'profitable' | 'lowMargin' | 'breakeven' | 'unprofitable';
      if (profitMargin >= 30) {
        status = 'profitable';
      } else if (profitMargin >= 10) {
        status = 'lowMargin';
      } else if (profitMargin >= 0) {
        status = 'breakeven';
      } else {
        status = 'unprofitable';
      }

      return {
        productId: recipe.Product.id,
        productName: recipe.Product.name,
        recipeId: recipe.id,
        recipeName: recipe.name,
        costs: {
          ingredients: ingredientsCost,
          supplies: suppliesCost,
          total: totalCost,
        },
        pricing: {
          cost: totalCost,
          sellingPrice: sellingPrice,
          profit: profit,
          profitMargin: profitMargin,
        },
        status,
        lastCostUpdate: recipe.lastCostUpdate,
        isProductActive: recipe.Product.isActive,
      };
    });

    // 🆕 Buscar matérias-primas que estão à venda no catálogo
    const rawMaterialsInCatalog = await prisma.rawMaterial.findMany({
      where: {
        showInCatalog: true,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        costPerUnit: true,
        priceWholesale: true,
        updatedAt: true,
      },
    });

    console.log("[PROFITABILITY_GET] Matérias-primas no catálogo:", rawMaterialsInCatalog.length);

    // 🆕 Calcular rentabilidade das matérias-primas
    const rawMaterialProfitability = rawMaterialsInCatalog.map((rm) => {
      const totalCost = rm.costPerUnit || 0;
      const sellingPrice = rm.priceWholesale || 0;
      const profit = sellingPrice - totalCost;
      const profitMargin = sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;

      let status: 'profitable' | 'lowMargin' | 'breakeven' | 'unprofitable';
      if (profitMargin >= 30) {
        status = 'profitable';
      } else if (profitMargin >= 10) {
        status = 'lowMargin';
      } else if (profitMargin >= 0) {
        status = 'breakeven';
      } else {
        status = 'unprofitable';
      }

      return {
        productId: `rm_${rm.id}`, // Prefixo para diferenciar de produtos
        productName: `${rm.name} (Matéria-Prima)`,
        recipeId: '',
        recipeName: 'Venda direta (sem receita)',
        costs: {
          ingredients: totalCost,
          supplies: 0,
          total: totalCost,
        },
        pricing: {
          cost: totalCost,
          sellingPrice: sellingPrice,
          profit: profit,
          profitMargin: profitMargin,
        },
        status,
        lastCostUpdate: rm.updatedAt?.toISOString() || null,
        isProductActive: true,
        isRawMaterial: true, // 🆕 Flag para identificar matérias-primas
      };
    });

    // 🆕 Combinar produtos com receitas + matérias-primas
    const allProfitabilityData = [...profitabilityData, ...rawMaterialProfitability];

    // Calcular resumo geral (inclui matérias-primas)
    const summary = {
      totalProducts: allProfitabilityData.length,
      averageCost: allProfitabilityData.length > 0 
        ? allProfitabilityData.reduce((sum, p) => sum + p.costs.total, 0) / allProfitabilityData.length
        : 0,
      averageMargin: allProfitabilityData.length > 0
        ? allProfitabilityData.reduce((sum, p) => sum + p.pricing.profitMargin, 0) / allProfitabilityData.length
        : 0,
      profitableCount: allProfitabilityData.filter(p => p.status === 'profitable').length,
      lowMarginCount: allProfitabilityData.filter(p => p.status === 'lowMargin').length,
      breakevenCount: allProfitabilityData.filter(p => p.status === 'breakeven').length,
      unprofitableCount: allProfitabilityData.filter(p => p.status === 'unprofitable').length,
      // 🆕 Estatísticas separadas
      productsWithRecipe: profitabilityData.length,
      rawMaterialsCount: rawMaterialProfitability.length,
    };

    // Identificar produtos mais/menos rentáveis (inclui matérias-primas)
    const sortedByMargin = [...allProfitabilityData].sort((a, b) => b.pricing.profitMargin - a.pricing.profitMargin);
    const mostProfitable = sortedByMargin.slice(0, 5);
    const leastProfitable = sortedByMargin.slice(-5).reverse();

    console.log("[PROFITABILITY_GET] Resumo:", summary);

    return NextResponse.json({
      summary,
      products: allProfitabilityData, // 🆕 Inclui matérias-primas
      insights: {
        mostProfitable,
        leastProfitable,
      },
    });
  } catch (error) {
    console.error("[PROFITABILITY_GET] Error:", error);
    return NextResponse.json(
      { error: "Erro ao calcular rentabilidade" },
      { status: 500 }
    );
  }
}
