export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET - Obter histórico de transações de pontos
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).customerId) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const transactions = await prisma.pointTransaction.findMany({
      where: { customerId: (session.user as any).customerId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    const total = await prisma.pointTransaction.count({
      where: { customerId: (session.user as any).customerId }
    });

    return NextResponse.json({
      transactions,
      total,
      limit,
      offset
    });
  } catch (error) {
    console.error('Erro ao buscar histórico de pontos:', error);
    return NextResponse.json({ error: 'Erro ao buscar histórico' }, { status: 500 });
  }
}
