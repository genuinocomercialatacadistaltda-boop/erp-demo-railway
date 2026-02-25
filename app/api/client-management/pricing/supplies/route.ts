import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET - Listar insumos globais do cliente
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
    const category = searchParams.get('category');

    const where: any = {
      customerId,
    };

    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }

    if (category) {
      where.category = category;
    }

    const supplies = await prisma.clientProductionSupplyGlobal.findMany({
      where,
      include: {
        _count: {
          select: { ProductionSupplies: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(supplies);
  } catch (error) {
    console.error('[CLIENT_SUPPLIES_GET] Error:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar insumos', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// POST - Criar novo insumo global
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
    const { name, category, costPerUnit, unit, description, notes } = body;

    // Validações
    if (!name || !category || costPerUnit === undefined) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: name, category, costPerUnit' },
        { status: 400 }
      );
    }

    if (costPerUnit < 0) {
      return NextResponse.json(
        { error: 'Custo não pode ser negativo' },
        { status: 400 }
      );
    }

    const supply = await prisma.clientProductionSupplyGlobal.create({
      data: {
        customerId,
        name,
        category,
        costPerUnit,
        unit: unit || 'un',
        description,
        notes,
      },
    });

    console.log('[CLIENT_SUPPLIES_POST] Created:', supply.id);
    return NextResponse.json(supply, { status: 201 });
  } catch (error) {
    console.error('[CLIENT_SUPPLIES_POST] Error:', error);
    return NextResponse.json(
      { error: 'Erro ao criar insumo', details: (error as Error).message },
      { status: 500 }
    );
  }
}
