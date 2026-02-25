
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET - Listar todos os resgates
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const redemptions = await prisma.redemption.findMany({
      where: status ? { status: status as any } : undefined,
      include: {
        Customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            city: true
          }
        },
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
