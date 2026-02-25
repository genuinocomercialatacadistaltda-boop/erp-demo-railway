
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET - Obter saldo e histórico de pontos do cliente
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).customerId) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: (session.user as any).customerId },
      select: {
        pointsBalance: true,
        pointsMultiplier: true,
        totalPointsEarned: true,
        totalPointsRedeemed: true
      }
    });

    if (!customer) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    // Obter configuração atual de pontos
    const config = await prisma.rewardConfig.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      ...customer,
      pointsPerReal: config?.pointsPerReal || 1.0
    });
  } catch (error) {
    console.error('Erro ao buscar saldo de pontos:', error);
    return NextResponse.json({ error: 'Erro ao buscar saldo' }, { status: 500 });
  }
}
