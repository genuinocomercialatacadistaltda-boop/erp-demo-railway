export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { productSelect } from '@/lib/product-select'

/**
 * API para gerenciar receitas de produtos
 * GET: Lista todas as receitas
 * POST: Cria uma nova receita com ingredientes e insumos
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
    const isActive = searchParams.get("isActive");

    console.log("[RECIPES_GET] Buscando receitas:", {
      productId,
      isActive,
    });

    // Filtros
    const whereFilter: any = {};
    
    if (productId) {
      whereFilter.productId = productId;
    }
    
    if (isActive !== null) {
      whereFilter.isActive = isActive === "true";
    }

    const recipes = await prisma.recipe.findMany({
      where: whereFilter,
      include: {
        Product: {
          select: {
            id: true,
            name: true,
            priceWholesale: true,
            canBeUsedAsIngredient: true,
            linkedRawMaterialId: true,
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

    console.log("[RECIPES_GET] Receitas encontradas:", recipes.length);

    // Calcular custo de cada receita
    const recipesWithCost = recipes.map((recipe) => {
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

      return {
        ...recipe,
        calculatedCost: {
          ingredientsCost,
          suppliesCost,
          totalCost,
        },
      };
    });

    return NextResponse.json(recipesWithCost);
  } catch (error) {
    console.error("[RECIPES_GET] Error:", error);
    return NextResponse.json(
      { error: "Erro ao carregar receitas" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).userType !== "ADMIN") {
      return NextResponse.json(
        { error: "Acesso negado" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      productId,
      name,
      description,
      yieldQuantity,
      ingredients,
      supplies,
      notes,
    } = body;

    console.log("[RECIPES_POST] Criando receita:", {
      productId,
      name,
      ingredientsCount: ingredients?.length || 0,
      suppliesCount: supplies?.length || 0,
    });

    // Validações
    if (!productId || !name) {
      return NextResponse.json(
        { error: "Produto e nome são obrigatórios" },
        { status: 400 }
      );
    }

    // Verificar se produto existe
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return NextResponse.json(
        { error: "Produto não encontrado" },
        { status: 404 }
      );
    }

    // Criar receita com ingredientes e insumos
    // NOTA: Permitido múltiplas receitas para o mesmo produto (ex: diferentes variantes)
    const recipe = await prisma.recipe.create({
      data: {
        productId,
        name,
        description: description || null,
        yieldQuantity: yieldQuantity || 1,
        notes: notes || null,
        Ingredients: {
          create: (ingredients || []).map((ing: any) => ({
            rawMaterialId: ing.rawMaterialId,
            quantityGrams: parseFloat(ing.quantityGrams),
            invisibleWastePercent: parseFloat(ing.invisibleWastePercent || 0),
            visibleWastePercent: parseFloat(ing.visibleWastePercent || 0),
            hasIcms: ing.hasIcms || false,
            notes: ing.notes || null,
          })),
        },
        Supplies: {
          create: (supplies || []).map((sup: any) => ({
            globalSupplyId: sup.globalSupplyId || null,  // Incluir referência ao catálogo global
            name: sup.name,
            category: sup.category,
            costPerUnit: parseFloat(sup.costPerUnit),
            quantityPerUnit: parseFloat(sup.quantityPerUnit || 1),
            unit: sup.unit || "un",
            notes: sup.notes || null,
            // 🧂 Campos especiais para temperos
            gramsPerKgMeat: sup.gramsPerKgMeat ? parseFloat(sup.gramsPerKgMeat) : null,
            skewerGrams: sup.skewerGrams ? parseFloat(sup.skewerGrams) : null,
          })),
        },
      },
      include: {
        Product: true,
        Ingredients: {
          include: {
            RawMaterial: true,
          },
        },
        Supplies: true,
      },
    });

    console.log("[RECIPES_POST] Receita criada:", recipe.id);

    return NextResponse.json(recipe, { status: 201 });
  } catch (error) {
    console.error("[RECIPES_POST] Error:", error);
    return NextResponse.json(
      { error: "Erro ao criar receita" },
      { status: 500 }
    );
  }
}
