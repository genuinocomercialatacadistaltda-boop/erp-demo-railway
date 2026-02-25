import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

// POST - Registrar movimentação de estoque de insumo
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    console.log('[SUPPLY_MOVEMENT_POST] Dados recebidos:', body);

    const {
      supplyId,
      type, // "IN" ou "OUT"
      quantity,
      reason, // "PURCHASE", "PRODUCTION", "ADJUSTMENT", "WASTE"
      reference,
      notes
    } = body;

    // Validações
    if (!supplyId || !type || !quantity || !reason) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: supplyId, type, quantity, reason' },
        { status: 400 }
      );
    }

    if (type !== 'IN' && type !== 'OUT') {
      return NextResponse.json(
        { error: 'Type deve ser "IN" ou "OUT"' },
        { status: 400 }
      );
    }

    const parsedQuantity = parseFloat(quantity);
    if (parsedQuantity <= 0) {
      return NextResponse.json(
        { error: 'Quantidade deve ser maior que zero' },
        { status: 400 }
      );
    }

    // Buscar insumo atual
    const supply = await prisma.productionSupplyGlobal.findUnique({
      where: { id: supplyId }
    });

    if (!supply) {
      return NextResponse.json(
        { error: 'Insumo não encontrado' },
        { status: 404 }
      );
    }

    // Calcular novo estoque
    const currentStock = supply.currentStock;
    const newStock = type === 'IN' 
      ? currentStock + parsedQuantity 
      : currentStock - parsedQuantity;

    if (newStock < 0) {
      return NextResponse.json(
        { error: `Estoque insuficiente. Atual: ${currentStock}, Tentando retirar: ${parsedQuantity}` },
        { status: 400 }
      );
    }

    // Registrar movimentação e atualizar estoque em transação
    const result = await prisma.$transaction(async (tx) => {
      // Criar movimentação
      const movement = await tx.supplyMovement.create({
        data: {
          supplyId,
          type,
          quantity: parsedQuantity,
          reason,
          reference: reference || null,
          notes: notes || null,
          createdBy: (session.user as any)?.id || null
        }
      });

      // Atualizar estoque
      const updatedSupply = await tx.productionSupplyGlobal.update({
        where: { id: supplyId },
        data: { currentStock: newStock }
      });

      return { movement, supply: updatedSupply };
    });

    console.log(`[SUPPLY_MOVEMENT_POST] Movimentação registrada:`, {
      type,
      quantity: parsedQuantity,
      oldStock: currentStock,
      newStock: result.supply.currentStock
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('[SUPPLY_MOVEMENT_POST] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao registrar movimentação', details: error.message },
      { status: 500 }
    );
  }
}

// GET - Listar movimentações de um insumo
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const supplyId = searchParams.get('supplyId');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: any = {};
    if (supplyId) where.supplyId = supplyId;

    const movements = await prisma.supplyMovement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        Supply: {
          select: {
            name: true,
            unit: true
          }
        }
      }
    });

    return NextResponse.json(movements);
  } catch (error: any) {
    console.error('[SUPPLY_MOVEMENTS_GET] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar movimentações', details: error.message },
      { status: 500 }
    );
  }
}
