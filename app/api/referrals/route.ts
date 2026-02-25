export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET - Listar indicações (Admin ou Cliente)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const user = session.user as any;
    const { customerId, userType } = user;

    let referrals;

    if (userType === 'ADMIN') {
      // Admin vê todas as indicações
      referrals = await prisma.referral.findMany({
        include: {
          Referrer: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
            },
          },
          Referred: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              createdAt: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } else if (customerId) {
      // Cliente vê apenas suas indicações
      referrals = await prisma.referral.findMany({
        where: {
          referrerId: customerId,
        },
        include: {
          Referred: {
            select: {
              id: true,
              name: true,
              phone: true,
              createdAt: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } else {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 400 });
    }

    return NextResponse.json({ referrals });
  } catch (error) {
    console.error('Erro ao listar indicações:', error);
    return NextResponse.json({ error: 'Erro ao listar indicações' }, { status: 500 });
  }
}

// POST - Criar nova indicação (usado durante cadastro)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { referralCode, referredId } = body;

    if (!referralCode || !referredId) {
      return NextResponse.json(
        { error: 'Código de indicação e ID do indicado são obrigatórios' },
        { status: 400 }
      );
    }

    // Sistema de código de indicação desabilitado
    return NextResponse.json(
      { error: 'Sistema de código de indicação não é mais suportado. Use o novo sistema de indicação direta.' },
      { status: 400 }
    );

    /*
    // Buscar o indicador pelo código
    const referrer = await prisma.customer.findUnique({
      where: { referralCode: referralCode.toUpperCase() },
    });
    */

    /*
    if (!referrer) {
      return NextResponse.json({ error: 'Código de indicação inválido' }, { status: 404 });
    }

    // Verificar se o indicado já foi indicado por alguém
    const existingReferral = await prisma.referral.findFirst({
      where: { referredId },
    });

    if (existingReferral) {
      return NextResponse.json(
        { error: 'Este cliente já foi indicado por outra pessoa' },
        { status: 400 }
      );
    }

    // Verificar se o cliente está tentando se auto-indicar
    if (referrer.id === referredId) {
      return NextResponse.json(
        { error: 'Você não pode se auto-indicar' },
        { status: 400 }
      );
    }

    // Criar a indicação
    const referral = await prisma.referral.create({
      data: {
        referrerId: referrer.id,
        referredId,
        referralCode: referralCode.toUpperCase(),
        status: 'PENDING',
      },
      include: {
        Referrer: {
          select: {
            id: true,
            name: true,
          },
        },
        Referred: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Atualizar o campo referredBy do cliente indicado
    await prisma.customer.update({
      where: { id: referredId },
      data: { referredBy: referrer.id },
    });
    */

    /*
    // Buscar configuração de bônus
    const config = await prisma.referralConfig.findFirst();

    // Se não requer primeira compra, dar bônus imediatamente
    if (config && !config.requireFirstOrder) {
      await awardReferralBonus(referral.id, referrer.id, referredId, config);
    }

    // Dar bônus de boas-vindas ao indicado se configurado
    if (config && config.bonusForReferred > 0) {
      await prisma.pointTransaction.create({
        data: {
          customerId: referredId,
          type: 'BONUS',
          points: config.bonusForReferred,
          description: 'Bônus de boas-vindas por indicação',
          reason: `Indicado por ${referrer.name}`,
        },
      });

      await prisma.customer.update({
        where: { id: referredId },
        data: {
          pointsBalance: {
            increment: config.bonusForReferred,
          },
          totalPointsEarned: {
            increment: config.bonusForReferred,
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      referral,
    });
    */
  } catch (error) {
    console.error('Erro ao criar indicação:', error);
    return NextResponse.json({ error: 'Erro ao criar indicação' }, { status: 500 });
  }
}

// Função auxiliar para conceder bônus de indicação
async function awardReferralBonus(
  referralId: string,
  referrerId: string,
  referredId: string,
  config: any
) {
  try {
    // Criar transação de pontos para o indicador
    await prisma.pointTransaction.create({
      data: {
        customerId: referrerId,
        type: 'REFERRAL_BONUS',
        points: config.bonusPointsPerReferral,
        description: 'Bônus por indicação de cliente',
        reason: `Cliente indicado completou os requisitos`,
      },
    });

    // Atualizar saldo de pontos do indicador
    await prisma.customer.update({
      where: { id: referrerId },
      data: {
        pointsBalance: {
          increment: config.bonusPointsPerReferral,
        },
        totalPointsEarned: {
          increment: config.bonusPointsPerReferral,
        },
      },
    });

    // Atualizar status da indicação
    await prisma.referral.update({
      where: { id: referralId },
      data: {
        status: 'BONUS_AWARDED',
        bonusPoints: config.bonusPointsPerReferral,
        bonusAwarded: true,
        bonusAwardedAt: new Date(),
      },
    });

    return true;
  } catch (error) {
    console.error('Erro ao conceder bônus de indicação:', error);
    return false;
  }
}
