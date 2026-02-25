import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

interface Params {
  params: {
    id: string;
  };
}

// GET - Buscar um insumo específico
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const supply = await prisma.productionSupplyGlobal.findUnique({
      where: { id: params.id },
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
        SupplyMovements: {
          orderBy: { createdAt: 'desc' },
          take: 20
        },
        PurchaseSupplyItems: {
          include: {
            Purchase: {
              select: {
                purchaseNumber: true,
                purchaseDate: true,
                Supplier: {
                  select: {
                    name: true
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!supply) {
      return NextResponse.json({ error: 'Insumo não encontrado' }, { status: 404 });
    }

    return NextResponse.json(supply);
  } catch (error: any) {
    console.error('[SUPPLY_GET] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar insumo', details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Atualizar um insumo
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession();
    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    console.log('[SUPPLY_PUT] Atualizando insumo:', params.id, body);

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
      sku,
      isActive
    } = body;

    // Verificar SKU duplicado (exceto o próprio insumo)
    if (sku) {
      const existingSku = await prisma.productionSupplyGlobal.findFirst({
        where: {
          sku,
          NOT: { id: params.id }
        }
      });
      if (existingSku) {
        return NextResponse.json(
          { error: 'SKU já cadastrado em outro insumo' },
          { status: 400 }
        );
      }
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (category !== undefined) updateData.category = category;
    if (costPerUnit !== undefined) updateData.costPerUnit = parseFloat(costPerUnit);
    if (unit !== undefined) updateData.unit = unit;
    if (description !== undefined) updateData.description = description || null;
    if (notes !== undefined) updateData.notes = notes || null;
    if (currentStock !== undefined) updateData.currentStock = parseFloat(currentStock);
    if (minStock !== undefined) updateData.minStock = parseFloat(minStock);
    if (maxStock !== undefined) updateData.maxStock = maxStock ? parseFloat(maxStock) : null;
    if (sku !== undefined) updateData.sku = sku || null;
    if (isActive !== undefined) updateData.isActive = isActive;

    const supply = await prisma.productionSupplyGlobal.update({
      where: { id: params.id },
      data: updateData
    });

    console.log('[SUPPLY_PUT] Insumo atualizado:', supply.id);
    return NextResponse.json(supply);
  } catch (error: any) {
    console.error('[SUPPLY_PUT] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar insumo', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Deletar um insumo
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession();
    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Verificar se há receitas usando este insumo
    const usageCount = await prisma.productionSupply.count({
      where: { globalSupplyId: params.id }
    });

    if (usageCount > 0) {
      return NextResponse.json(
        { error: `Este insumo está sendo usado em ${usageCount} receita(s)` },
        { status: 400 }
      );
    }

    await prisma.productionSupplyGlobal.delete({
      where: { id: params.id }
    });

    console.log('[SUPPLY_DELETE] Insumo deletado:', params.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[SUPPLY_DELETE] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao deletar insumo', details: error.message },
      { status: 500 }
    );
  }
}
