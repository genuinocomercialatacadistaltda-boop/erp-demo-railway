export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET - Obter detalhes de pontos de um cliente específico
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { id } = await context.params;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        PointTransaction: {
          orderBy: { createdAt: 'desc' },
          take: 50
        },
        Redemption: {
          include: {
            Prize: true
          },
          orderBy: { requestedAt: 'desc' }
        },
        _count: {
          select: {
            Order: true,
            PointTransaction: true,
            Redemption: true
          }
        }
      }
    });

    if (!customer) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    return NextResponse.json(customer);
  } catch (error) {
    console.error('Erro ao buscar dados do cliente:', error);
    return NextResponse.json({ error: 'Erro ao buscar dados do cliente' }, { status: 500 });
  }
}

// PUT - Atualizar multiplicador de pontos do cliente
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { pointsMultiplier } = body;

    if (typeof pointsMultiplier !== 'number' || pointsMultiplier < 0) {
      return NextResponse.json({ error: 'Multiplicador inválido' }, { status: 400 });
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: { pointsMultiplier }
    });

    return NextResponse.json(customer);
  } catch (error) {
    console.error('Erro ao atualizar multiplicador:', error);
    return NextResponse.json({ error: 'Erro ao atualizar multiplicador' }, { status: 500 });
  }
}

// POST - Ajuste manual de pontos
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { points, description, reason } = body;

    if (typeof points !== 'number' || points === 0) {
      return NextResponse.json({ error: 'Valor de pontos inválido' }, { status: 400 });
    }

    // Criar transação de ajuste manual
    const transaction = await prisma.pointTransaction.create({
      data: {
        customerId: id,
        type: 'MANUAL_ADJUSTMENT',
        points,
        multiplierApplied: 1.0,
        description: description || 'Ajuste manual pelo administrador',
        reason: reason || null  // Pode ser "Presente de Aniversário", "Bônus", etc.
      }
    });

    // Atualizar saldo do cliente
    const customer = await prisma.customer.update({
      where: { id },
      data: {
        pointsBalance: { increment: points },
        totalPointsEarned: points > 0 ? { increment: points } : undefined,
        totalPointsRedeemed: points < 0 ? { increment: Math.abs(points) } : undefined
      }
    });

    return NextResponse.json({ transaction, customer });
  } catch (error) {
    console.error('Erro ao ajustar pontos:', error);
    return NextResponse.json({ error: 'Erro ao ajustar pontos' }, { status: 500 });
  }
}
