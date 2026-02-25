
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

/**
 * API para gerenciar receita específica
 * GET: Busca receita por ID
 * PUT: Atualiza receita
 * DELETE: Exclui receita
 */

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).userType !== "ADMIN") {
      return NextResponse.json(
        { error: "Acesso negado" },
        { status: 401 }
      );
    }

    const recipe = await prisma.recipe.findUnique({
      where: { id: params.id },
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

    if (!recipe) {
      return NextResponse.json(
        { error: "Receita não encontrada" },
        { status: 404 }
      );
    }

    // Calcular custo
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
      
      const costPerGram = baseCostPerUnit / 1000;
      const cost = adjustedQuantity * costPerGram;
      
      return sum + cost;
    }, 0);

    // LÓGICA CORRIGIDA: divide o custo pela quantidade de unidades que o insumo produz
    // Exemplo: Embalagem R$ 0,11 produz 5 espetos → R$ 0,11 / 5 = R$ 0,022 por espeto
    const suppliesCost = recipe.Supplies.reduce((sum, supply) => {
      const costPerProducedUnit = supply.costPerUnit / supply.quantityPerUnit;
      return sum + costPerProducedUnit;
    }, 0);

    return NextResponse.json({
      ...recipe,
      calculatedCost: {
        ingredientsCost,
        suppliesCost,
        totalCost: ingredientsCost + suppliesCost,
      },
    });
  } catch (error) {
    console.error("[RECIPE_GET] Error:", error);
    return NextResponse.json(
      { error: "Erro ao carregar receita" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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
      name,
      description,
      yieldQuantity,
      isActive,
      ingredients,
      supplies,
      notes,
    } = body;

    console.log("[RECIPE_PUT] Atualizando receita:", params.id);

    // Verificar se receita existe
    const existingRecipe = await prisma.recipe.findUnique({
      where: { id: params.id },
    });

    if (!existingRecipe) {
      return NextResponse.json(
        { error: "Receita não encontrada" },
        { status: 404 }
      );
    }

    // Atualizar receita
    const recipe = await prisma.recipe.update({
      where: { id: params.id },
      data: {
        name: name || existingRecipe.name,
        description: description !== undefined ? description : existingRecipe.description,
        yieldQuantity: yieldQuantity || existingRecipe.yieldQuantity,
        isActive: isActive !== undefined ? isActive : existingRecipe.isActive,
        notes: notes !== undefined ? notes : existingRecipe.notes,
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

    // Se houver ingredientes para atualizar
    if (ingredients && Array.isArray(ingredients)) {
      // Deletar ingredientes antigos
      await prisma.recipeIngredient.deleteMany({
        where: { recipeId: params.id },
      });

      // Criar novos ingredientes
      await prisma.recipeIngredient.createMany({
        data: ingredients.map((ing: any) => ({
          recipeId: params.id,
          rawMaterialId: ing.rawMaterialId,
          quantityGrams: parseFloat(ing.quantityGrams),
          invisibleWastePercent: parseFloat(ing.invisibleWastePercent || 0),
          visibleWastePercent: parseFloat(ing.visibleWastePercent || 0),
          hasIcms: ing.hasIcms || false,
          notes: ing.notes || null,
        })),
      });
    }

    // Se houver insumos para atualizar
    if (supplies && Array.isArray(supplies)) {
      // Deletar insumos antigos
      await prisma.productionSupply.deleteMany({
        where: { recipeId: params.id },
      });

      // Criar novos insumos
      await prisma.productionSupply.createMany({
        data: supplies.map((sup: any) => ({
          recipeId: params.id,
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
      });
    }

    console.log("[RECIPE_PUT] Receita atualizada:", recipe.id);

    return NextResponse.json(recipe);
  } catch (error) {
    console.error("[RECIPE_PUT] Error:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar receita" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).userType !== "ADMIN") {
      return NextResponse.json(
        { error: "Acesso negado" },
        { status: 401 }
      );
    }

    console.log("[RECIPE_DELETE] Excluindo receita:", params.id);

    // Verificar se receita existe
    const existingRecipe = await prisma.recipe.findUnique({
      where: { id: params.id },
    });

    if (!existingRecipe) {
      return NextResponse.json(
        { error: "Receita não encontrada" },
        { status: 404 }
      );
    }

    // Deletar receita (cascade deleta ingredientes e insumos)
    await prisma.recipe.delete({
      where: { id: params.id },
    });

    console.log("[RECIPE_DELETE] Receita excluída:", params.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[RECIPE_DELETE] Error:", error);
    return NextResponse.json(
      { error: "Erro ao excluir receita" },
      { status: 500 }
    );
  }
}
