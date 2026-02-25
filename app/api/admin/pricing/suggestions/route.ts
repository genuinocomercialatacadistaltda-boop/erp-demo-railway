
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { productSelect } from '@/lib/product-select'

/**
 * API para sugestões inteligentes de precificação
 * GET: Retorna sugestões de preço baseadas em custo e margens desejadas
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

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");
    const targetMargin = parseFloat(searchParams.get("targetMargin") || "30");

    console.log("[PRICING_SUGGESTIONS_GET] Gerando sugestões:", {
      productId,
      targetMargin,
    });

    // Se productId específico, calcular apenas para ele
    if (productId) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          Recipe: {
            include: {
              Ingredients: {
                include: {
                  RawMaterial: true,
                },
              },
              Supplies: true,
            },
          },
        },
      });

      if (!product) {
        return NextResponse.json(
          { error: "Produto não encontrado" },
          { status: 404 }
        );
      }

      if (!product.Recipe || product.Recipe.length === 0) {
        return NextResponse.json(
          { error: "Produto não possui receita cadastrada" },
          { status: 400 }
        );
      }

      // Usar a primeira receita para cálculo (quando há múltiplas, usar a principal)
      const productWithFirstRecipe = { ...product, Recipe: product.Recipe[0] };
      const suggestion = calculatePriceSuggestion(productWithFirstRecipe, targetMargin);
      return NextResponse.json(suggestion);
    }

    // Calcular sugestões para todos os produtos com receita
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        Recipe: {
          some: {}, // Tem pelo menos uma receita
        },
      },
      include: {
        Recipe: {
          include: {
            Ingredients: {
              include: {
                RawMaterial: true,
              },
            },
            Supplies: true,
          },
        },
      },
    });

    // Mapear produtos para usar a primeira receita
    const suggestions = products
      .filter(product => product.Recipe && product.Recipe.length > 0)
      .map((product) => {
        const productWithFirstRecipe = { ...product, Recipe: product.Recipe[0] };
        return calculatePriceSuggestion(productWithFirstRecipe, targetMargin);
      });

    // Ordenar por prioridade (produtos com maior diferença entre preço atual e sugerido)
    suggestions.sort((a, b) => {
      const diffA = Math.abs(a.currentPrice - a.suggestedPrice);
      const diffB = Math.abs(b.currentPrice - b.suggestedPrice);
      return diffB - diffA;
    });

    console.log("[PRICING_SUGGESTIONS_GET] Sugestões geradas:", suggestions.length);

    return NextResponse.json(suggestions);
  } catch (error) {
    console.error("[PRICING_SUGGESTIONS_GET] Error:", error);
    return NextResponse.json(
      { error: "Erro ao gerar sugestões de preço" },
      { status: 500 }
    );
  }
}

function calculatePriceSuggestion(product: any, targetMargin: number) {
  // Calcular custo total da receita
  const ingredientsCost = product.Recipe.Ingredients.reduce((sum: number, ing: any) => {
    if (!ing.RawMaterial.costPerUnit) return sum;
    
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
    
    const costPerGram = ing.RawMaterial.costPerUnit / 1000;
    const cost = adjustedQuantity * costPerGram;
    
    return sum + cost;
  }, 0);

  // LÓGICA CORRIGIDA: divide o custo pela quantidade de unidades que o insumo produz
  // Exemplo: Embalagem R$ 0,11 produz 5 espetos → R$ 0,11 / 5 = R$ 0,022 por espeto
  const suppliesCost = product.Recipe.Supplies.reduce((sum: number, supply: any) => {
    const costPerProducedUnit = supply.costPerUnit / supply.quantityPerUnit;
    return sum + costPerProducedUnit;
  }, 0);

  const totalCost = ingredientsCost + suppliesCost;

  // Calcular preço sugerido baseado na margem desejada
  // Fórmula: Preço = Custo / (1 - Margem/100)
  const suggestedPrice = totalCost / (1 - targetMargin / 100);

  // Margem atual
  const currentMargin = product.priceWholesale > 0 
    ? ((product.priceWholesale - totalCost) / product.priceWholesale) * 100
    : 0;

  // Calcular diferentes cenários de margem
  const scenarios = [
    { margin: 20, price: totalCost / (1 - 20 / 100) },
    { margin: 25, price: totalCost / (1 - 25 / 100) },
    { margin: 30, price: totalCost / (1 - 30 / 100) },
    { margin: 35, price: totalCost / (1 - 35 / 100) },
    { margin: 40, price: totalCost / (1 - 40 / 100) },
  ];

  // Determinar status e prioridade
  let status: 'critical' | 'warning' | 'good' | 'excellent';
  let priority: 'high' | 'medium' | 'low';

  if (currentMargin < 0) {
    status = 'critical';
    priority = 'high';
  } else if (currentMargin < 10) {
    status = 'warning';
    priority = 'high';
  } else if (currentMargin < 20) {
    status = 'warning';
    priority = 'medium';
  } else if (currentMargin < 30) {
    status = 'good';
    priority = 'low';
  } else {
    status = 'excellent';
    priority = 'low';
  }

  return {
    productId: product.id,
    productName: product.name,
    currentPrice: product.priceWholesale,
    currentMargin,
    costs: {
      ingredients: ingredientsCost,
      supplies: suppliesCost,
      total: totalCost,
    },
    suggestedPrice,
    targetMargin,
    priceDifference: suggestedPrice - product.priceWholesale,
    priceDifferencePercent: product.priceWholesale > 0 
      ? ((suggestedPrice - product.priceWholesale) / product.priceWholesale) * 100
      : 0,
    scenarios,
    status,
    priority,
    recommendation: getRecommendation(currentMargin, targetMargin, suggestedPrice, product.priceWholesale),
  };
}

function getRecommendation(currentMargin: number, targetMargin: number, suggestedPrice: number, currentPrice: number): string {
  if (currentMargin < 0) {
    return `⚠️ URGENTE: Produto está sendo vendido com prejuízo! Aumente o preço para pelo menos R$ ${suggestedPrice.toFixed(2)} para ter ${targetMargin}% de margem.`;
  }
  
  if (currentMargin < 10) {
    return `⚠️ ATENÇÃO: Margem muito baixa (${currentMargin.toFixed(1)}%). Recomendamos ajustar para R$ ${suggestedPrice.toFixed(2)}.`;
  }
  
  if (currentMargin < targetMargin) {
    const increase = suggestedPrice - currentPrice;
    return `📊 Margem atual (${currentMargin.toFixed(1)}%) está abaixo da meta (${targetMargin}%). Considere aumentar R$ ${increase.toFixed(2)}.`;
  }
  
  if (currentMargin > targetMargin + 10) {
    return `✅ Margem excelente (${currentMargin.toFixed(1)}%)! O preço está competitivo e lucrativo.`;
  }
  
  return `✅ Preço adequado com ${currentMargin.toFixed(1)}% de margem.`;
}
