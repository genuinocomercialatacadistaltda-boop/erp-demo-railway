
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET - Listar resgates do cliente
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).customerId) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const redemptions = await prisma.redemption.findMany({
      where: { customerId: (session.user as any).customerId },
      include: {
        Prize: true
      },
      orderBy: { requestedAt: 'desc' }
    });

    return NextResponse.json(redemptions);
  } catch (error) {
    console.error('Erro ao buscar resgates:', error);
    return NextResponse.json({ error: 'Erro ao buscar resgates' }, { status: 500 });
  }
}
