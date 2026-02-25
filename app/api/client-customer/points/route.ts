import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyClientCustomerToken } from '@/lib/client-customer-auth';

const prisma = new PrismaClient();

// Buscar saldo e histórico de pontos
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('client-customer-token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Não autenticado' },
        { status: 401 }
      );
    }

    const { valid, session } = await verifyClientCustomerToken(token);

    if (!valid || !session) {
      return NextResponse.json(
        { success: false, message: 'Sessão inválida' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const type = searchParams.get('type');

    const skip = (page - 1) * limit;

    // Buscar cliente
    const clientCustomer = await prisma.clientCustomer.findUnique({
      where: { id: session.id },
      select: {
        pointsBalance: true,
        totalPointsEarned: true,
        pointsMultiplier: true,
      },
    });

    if (!clientCustomer) {
      return NextResponse.json(
        { success: false, message: 'Cliente não encontrado' },
        { status: 404 }
      );
    }

    // Buscar transações
    const where: any = {
      clientCustomerId: session.id,
    };

    if (type) {
      where.type = type;
    }

    const [transactions, total] = await Promise.all([
      prisma.clientCustomerPointTransaction.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.clientCustomerPointTransaction.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      balance: clientCustomer.pointsBalance,
      totalEarned: clientCustomer.totalPointsEarned,
      multiplier: clientCustomer.pointsMultiplier,
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get points error:', error);
    return NextResponse.json(
      { success: false, message: 'Erro ao buscar pontos' },
      { status: 500 }
    );
  }
}
