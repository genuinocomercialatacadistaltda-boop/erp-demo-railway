export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

// GET - Listar todos os insumos
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const isActive = searchParams.get('isActive');

    const where: any = {};
    if (category) where.category = category;
    if (isActive !== null) where.isActive = isActive === 'true';

    const supplies = await prisma.productionSupplyGlobal.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ],
      include: {
        ProductionSupplies: {
          include: {
            Recipe: {
              include: {
                Product: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        },
        _count: {
          select: {
            PurchaseSupplyItems: true,
            SupplyMovements: true
          }
        }
      }
    });

    console.log(`[SUPPLIES_GET] Encontrados ${supplies.length} insumos`);
    return NextResponse.json(supplies);
  } catch (error: any) {
    console.error('[SUPPLIES_GET] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar insumos', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Criar novo insumo
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    console.log('[SUPPLIES_POST] Dados recebidos:', body);

    const {
      name,
      category,
      costPerUnit,
      unit,
      description,
      notes,
      currentStock,
      minStock,
      maxStock,
      sku
    } = body;

    // Validações
    if (!name || !category || costPerUnit === undefined || costPerUnit === null) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: nome, categoria e custo unitário' },
        { status: 400 }
      );
    }

    // Verificar SKU duplicado
    if (sku) {
      const existingSku = await prisma.productionSupplyGlobal.findUnique({
        where: { sku }
      });
      if (existingSku) {
        return NextResponse.json(
          { error: 'SKU já cadastrado' },
          { status: 400 }
        );
      }
    }

    const supply = await prisma.productionSupplyGlobal.create({
      data: {
        name,
        category,
        costPerUnit: parseFloat(costPerUnit),
        unit: unit || 'un',
        description: description || null,
        notes: notes || null,
        currentStock: currentStock ? parseFloat(currentStock) : 0,
        minStock: minStock ? parseFloat(minStock) : 0,
        maxStock: maxStock ? parseFloat(maxStock) : null,
        sku: sku || null,
        isActive: true
      }
    });

    console.log('[SUPPLIES_POST] Insumo criado:', supply.id);
    return NextResponse.json(supply, { status: 201 });
  } catch (error: any) {
    console.error('[SUPPLIES_POST] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao criar insumo', details: error.message },
      { status: 500 }
    );
  }
}
