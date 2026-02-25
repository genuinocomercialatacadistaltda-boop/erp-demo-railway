export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET - Obter configuração de indicações
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Buscar ou criar configuração padrão
    let config = await prisma.referralConfig.findFirst();

    if (!config) {
      config = await prisma.referralConfig.create({
        data: {
          isActive: true,
          bonusPointsPerReferral: 100,
          requireFirstOrder: true,
          bonusForReferred: 50,
        },
      });
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error('Erro ao obter configuração de indicações:', error);
    return NextResponse.json(
      { error: 'Erro ao obter configuração de indicações' },
      { status: 500 }
    );
  }
}

// PUT - Atualizar configuração de indicações (Admin only)
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    const user = session?.user as any;
    if (!session?.user || user?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const {
      isActive,
      bonusPointsPerReferral,
      requireFirstOrder,
      minimumOrderAmount,
      bonusForReferred,
      maxReferralsPerCustomer,
      expirationDays,
    } = body;

    // Buscar ou criar configuração
    let config = await prisma.referralConfig.findFirst();

    if (!config) {
      config = await prisma.referralConfig.create({
        data: {
          isActive: isActive ?? true,
          bonusPointsPerReferral: bonusPointsPerReferral ?? 100,
          requireFirstOrder: requireFirstOrder ?? true,
          minimumOrderAmount,
          bonusForReferred: bonusForReferred ?? 50,
          maxReferralsPerCustomer,
          expirationDays,
        },
      });
    } else {
      config = await prisma.referralConfig.update({
        where: { id: config.id },
        data: {
          isActive,
          bonusPointsPerReferral,
          requireFirstOrder,
          minimumOrderAmount,
          bonusForReferred,
          maxReferralsPerCustomer,
          expirationDays,
        },
      });
    }

    return NextResponse.json({
      success: true,
      config,
    });
  } catch (error) {
    console.error('Erro ao atualizar configuração de indicações:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar configuração de indicações' },
      { status: 500 }
    );
  }
}
