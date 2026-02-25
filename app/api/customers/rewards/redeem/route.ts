export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// POST - Solicitar resgate de brinde
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).customerId) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { prizeId } = body;

    if (!prizeId) {
      return NextResponse.json({ error: 'ID do brinde é obrigatório' }, { status: 400 });
    }

    // Buscar cliente e brinde
    const [customer, prize] = await Promise.all([
      prisma.customer.findUnique({
        where: { id: (session.user as any).customerId }
      }),
      prisma.prize.findUnique({
        where: { id: prizeId }
      })
    ]);

    if (!customer) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    if (!prize) {
      return NextResponse.json({ error: 'Brinde não encontrado' }, { status: 404 });
    }

    if (!prize.isActive) {
      return NextResponse.json({ error: 'Brinde não está mais disponível' }, { status: 400 });
    }

    // Verificar estoque
    if (prize.stockQuantity !== null && prize.stockQuantity < 1) {
      return NextResponse.json({ error: 'Brinde sem estoque' }, { status: 400 });
    }

    // Verificar se cliente tem pontos suficientes
    if (customer.pointsBalance < prize.pointsCost) {
      return NextResponse.json({ 
        error: 'Pontos insuficientes',
        pointsNeeded: prize.pointsCost - customer.pointsBalance
      }, { status: 400 });
    }

    // Criar resgate e deduzir pontos em transação
    const result = await prisma.$transaction(async (tx: any) => {
      // Criar resgate
      const redemption = await tx.redemption.create({
        data: {
          customerId: customer.id,
          prizeId: prize.id,
          pointsUsed: prize.pointsCost,
          status: 'PENDING'
        },
        include: {
          Prize: true
        }
      });

      // Deduzir pontos do cliente
      await tx.customer.update({
        where: { id: customer.id },
        data: {
          pointsBalance: { decrement: prize.pointsCost },
          totalPointsRedeemed: { increment: prize.pointsCost }
        }
      });

      // Criar transação de pontos
      await tx.pointTransaction.create({
        data: {
          customerId: customer.id,
          type: 'REDEEMED_FOR_PRIZE',
          points: -prize.pointsCost,
          multiplierApplied: 1.0,
          description: `Resgate: ${prize.name}`
        }
      });

      // Criar notificação para admin
      await tx.notification.create({
        data: {
          id: crypto.randomUUID(),
          title: '🎁 Nova Solicitação de Resgate',
          message: `${customer.name} solicitou o resgate de: ${prize.name} (${prize.pointsCost} pontos)`,
          type: 'COMMUNICATION',
          category: 'GENERAL',
          targetRole: null,
          targetUserId: null,
          deliveryMode: 'AUTOMATIC'
        }
      });

      return redemption;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Erro ao solicitar resgate:', error);
    return NextResponse.json({ error: 'Erro ao solicitar resgate' }, { status: 500 });
  }
}
