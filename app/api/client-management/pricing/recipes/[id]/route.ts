export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET - Buscar receita específica
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const recipe = await prisma.clientRecipe.findUnique({
      where: { id: params.id },
      include: {
        Ingredients: {
          orderBy: { createdAt: 'asc' },
        },
        Supplies: {
          include: {
            GlobalSupply: true,
          },
          orderBy: { createdAt: 'asc' },
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

    return NextResponse.json({
      ...recipe,
      costs: {
        ingredients: ingredientsCost,
        supplies: suppliesCost,
        total: ingredientsCost + suppliesCost,
        perUnit: totalCostPerUnit,
      },
    });
  } catch (error) {
    console.error('[CLIENT_RECIPES_GET_ID] Error:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar receita', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// PUT - Atualizar receita
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const recipe = await prisma.clientRecipe.findUnique({
      where: { id: params.id },
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

    const body = await request.json();
    const {
      name,
      description,
      yieldQuantity,
      notes,
      isActive,
      ingredients,
      supplies,
    } = body;

    // Se ingredientes ou supplies foram fornecidos, atualizar
    if (ingredients !== undefined) {
      // Deletar ingredientes existentes
      await prisma.clientRecipeIngredient.deleteMany({
        where: { recipeId: params.id },
      });

      // Criar novos ingredientes
      if (ingredients.length > 0) {
        await prisma.clientRecipeIngredient.createMany({
          data: ingredients.map((ing: any) => ({
            recipeId: params.id,
            customerId,
            rawMaterialId: ing.rawMaterialId,
            rawMaterialName: ing.rawMaterialName,
            quantityGrams: ing.quantityGrams,
            invisibleWastePercent: ing.invisibleWastePercent || 0,
            visibleWastePercent: ing.visibleWastePercent || 0,
            costPerGram: ing.costPerGram,
            notes: ing.notes,
          })),
        });
      }
    }

    if (supplies !== undefined) {
      // Deletar insumos existentes
      await prisma.clientProductionSupply.deleteMany({
        where: { recipeId: params.id },
      });

      // Criar novos insumos
      if (supplies.length > 0) {
        await prisma.clientProductionSupply.createMany({
          data: supplies.map((sup: any) => ({
            recipeId: params.id,
            customerId,
            globalSupplyId: sup.globalSupplyId,
            name: sup.name,
            category: sup.category,
            costPerUnit: sup.costPerUnit,
            quantityPerUnit: sup.quantityPerUnit || 1,
            unit: sup.unit || 'un',
            notes: sup.notes,
          })),
        });
      }
    }

    // Atualizar receita
    const updated = await prisma.clientRecipe.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(yieldQuantity && { yieldQuantity }),
        ...(notes !== undefined && { notes }),
        ...(isActive !== undefined && { isActive }),
        lastCostUpdate: new Date(),
      },
      include: {
        Ingredients: true,
        Supplies: {
          include: {
            GlobalSupply: true,
          },
        },
      },
    });

    console.log('[CLIENT_RECIPES_PUT] Updated:', updated.id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[CLIENT_RECIPES_PUT] Error:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar receita', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// DELETE - Excluir receita
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const recipe = await prisma.clientRecipe.findUnique({
      where: { id: params.id },
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

    // Deletar receita (cascade deletará ingredientes e insumos)
    await prisma.clientRecipe.delete({
      where: { id: params.id },
    });

    console.log('[CLIENT_RECIPES_DELETE] Deleted:', params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[CLIENT_RECIPES_DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Erro ao excluir receita', details: (error as Error).message },
      { status: 500 }
    );
  }
}
