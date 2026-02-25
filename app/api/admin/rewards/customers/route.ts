export const dynamic = "force-dynamic"


import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET - Listar clientes com seus pontos
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'pointsBalance';
    const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc';

    const customers = await prisma.customer.findMany({
      where: {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        city: true,
        pointsBalance: true,
        pointsMultiplier: true,
        totalPointsEarned: true,
        totalPointsRedeemed: true,
        customDiscount: true,
        createdAt: true,
        _count: {
          select: {
            Order: true,
            PointTransaction: true,
            Redemption: true
          }
        }
      },
      orderBy: {
        [sortBy]: order
      }
    });

    return NextResponse.json(customers);
  } catch (error) {
    console.error('Erro ao buscar clientes:', error);
    return NextResponse.json({ error: 'Erro ao buscar clientes' }, { status: 500 });
  }
}
