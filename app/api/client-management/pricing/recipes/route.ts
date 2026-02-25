import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET - Listar receitas do cliente
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

    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get('isActive');

    const where: any = {
      customerId,
    };

    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }

    const recipes = await prisma.clientRecipe.findMany({
      where,
      include: {
        Ingredients: {
          orderBy: { createdAt: 'asc' },
        },
        Supplies: {
          where: { isActive: true },
          include: {
            GlobalSupply: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Calcular custos para cada receita
    const recipesWithCosts = recipes.map(recipe => {
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

      return {
        ...recipe,
        costs: {
          ingredients: ingredientsCost,
          supplies: suppliesCost,
          total: ingredientsCost + suppliesCost,
          perUnit: totalCostPerUnit,
        },
      };
    });

    return NextResponse.json(recipesWithCosts);
  } catch (error) {
    console.error('[CLIENT_RECIPES_GET] Error:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar receitas', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// POST - Criar nova receita
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
    const {
      productId,
      name,
      description,
      yieldQuantity,
      notes,
      ingredients,
      supplies,
    } = body;

    // Validações
    if (!productId || !name) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: productId, name' },
        { status: 400 }
      );
    }

    if (yieldQuantity && yieldQuantity < 1) {
      return NextResponse.json(
        { error: 'Rendimento deve ser maior ou igual a 1' },
        { status: 400 }
      );
    }

    // Criar receita com ingredientes e insumos
    const recipe = await prisma.clientRecipe.create({
      data: {
        customerId,
        productId,
        name,
        description,
        yieldQuantity: yieldQuantity || 1,
        notes,
        Ingredients: {
          create: (ingredients || []).map((ing: any) => ({
            customerId,
            rawMaterialId: ing.rawMaterialId,
            rawMaterialName: ing.rawMaterialName,
            quantityGrams: ing.quantityGrams,
            invisibleWastePercent: ing.invisibleWastePercent || 0,
            visibleWastePercent: ing.visibleWastePercent || 0,
            costPerGram: ing.costPerGram,
            notes: ing.notes,
          })),
        },
        Supplies: {
          create: (supplies || []).map((sup: any) => ({
            customerId,
            globalSupplyId: sup.globalSupplyId,
            name: sup.name,
            category: sup.category,
            costPerUnit: sup.costPerUnit,
            quantityPerUnit: sup.quantityPerUnit || 1,
            unit: sup.unit || 'un',
            notes: sup.notes,
          })),
        },
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

    console.log('[CLIENT_RECIPES_POST] Created:', recipe.id);
    return NextResponse.json(recipe, { status: 201 });
  } catch (error) {
    console.error('[CLIENT_RECIPES_POST] Error:', error);
    return NextResponse.json(
      { error: 'Erro ao criar receita', details: (error as Error).message },
      { status: 500 }
    );
  }
}
