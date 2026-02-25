export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getCustomerRanking } from '@/lib/rewards';

// GET - Obter ranking de clientes
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');

    const ranking = await getCustomerRanking(limit);

    return NextResponse.json(ranking);
  } catch (error) {
    console.error('Erro ao buscar ranking:', error);
    return NextResponse.json({ error: 'Erro ao buscar ranking' }, { status: 500 });
  }
}
