export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET - Buscar insumo específico
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

    const supply = await prisma.clientProductionSupplyGlobal.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: { ProductionSupplies: true },
        },
      },
    });

    if (!supply) {
      return NextResponse.json(
        { error: 'Insumo não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se pertence ao cliente
    if (supply.customerId !== customerId) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 403 }
      );
    }

    return NextResponse.json(supply);
  } catch (error) {
    console.error('[CLIENT_SUPPLIES_GET_ID] Error:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar insumo', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// PUT - Atualizar insumo
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

    const supply = await prisma.clientProductionSupplyGlobal.findUnique({
      where: { id: params.id },
    });

    if (!supply) {
      return NextResponse.json(
        { error: 'Insumo não encontrado' },
        { status: 404 }
      );
    }

    if (supply.customerId !== customerId) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, category, costPerUnit, unit, description, notes, isActive } = body;

    // Validações
    if (costPerUnit !== undefined && costPerUnit < 0) {
      return NextResponse.json(
        { error: 'Custo não pode ser negativo' },
        { status: 400 }
      );
    }

    const updated = await prisma.clientProductionSupplyGlobal.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(category && { category }),
        ...(costPerUnit !== undefined && { costPerUnit }),
        ...(unit && { unit }),
        ...(description !== undefined && { description }),
        ...(notes !== undefined && { notes }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    console.log('[CLIENT_SUPPLIES_PUT] Updated:', updated.id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[CLIENT_SUPPLIES_PUT] Error:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar insumo', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// DELETE - Excluir insumo
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

    const supply = await prisma.clientProductionSupplyGlobal.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: { ProductionSupplies: true },
        },
      },
    });

    if (!supply) {
      return NextResponse.json(
        { error: 'Insumo não encontrado' },
        { status: 404 }
      );
    }

    if (supply.customerId !== customerId) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 403 }
      );
    }

    // Verificar se está sendo usado em alguma receita
    if (supply._count.ProductionSupplies > 0) {
      return NextResponse.json(
        {
          error: 'Este insumo está sendo usado em receitas',
          details: `${supply._count.ProductionSupplies} receita(s) usam este insumo`,
        },
        { status: 400 }
      );
    }

    await prisma.clientProductionSupplyGlobal.delete({
      where: { id: params.id },
    });

    console.log('[CLIENT_SUPPLIES_DELETE] Deleted:', params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[CLIENT_SUPPLIES_DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Erro ao excluir insumo', details: (error as Error).message },
      { status: 500 }
    );
  }
}
