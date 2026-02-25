export const dynamic = 'force-dynamic';


import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

/**
 * API: Gerenciar Extratos Bancários
 * GET /api/financial/bank-statements - Lista extratos
 * POST /api/financial/bank-statements - Cria extrato manual
 */

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    const user = session?.user as any;

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const bankAccountId = searchParams.get('bankAccountId');
    const isReconciled = searchParams.get('isReconciled');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: any = {};

    if (bankAccountId) {
      where.bankAccountId = bankAccountId;
    }

    if (isReconciled !== null) {
      where.isReconciled = isReconciled === 'true';
    }

    if (startDate || endDate) {
      where.referenceDate = {};
      if (startDate) {
        where.referenceDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.referenceDate.lte = new Date(endDate);
      }
    }

    const [statements, total] = await Promise.all([
      prisma.bankStatement.findMany({
        where,
        include: {
          BankAccount: {
            select: {
              id: true,
              name: true,
              bankName: true,
            },
          },
        },
        orderBy: {
          referenceDate: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.bankStatement.count({ where }),
    ]);

    return NextResponse.json({
      statements,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Erro ao buscar extratos:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar extratos: ' + error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    const user = session?.user as any;

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      bankAccountId,
      referenceDate,
      description,
      type,
      amount,
      balance,
      category,
    } = body;

    if (!bankAccountId || !referenceDate || !description || !type || !amount) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios: bankAccountId, referenceDate, description, type, amount' },
        { status: 400 }
      );
    }

    const statement = await prisma.bankStatement.create({
      data: {
        bankAccountId,
        referenceDate: new Date(referenceDate),
        description,
        type,
        amount,
        balance: balance || 0,
        category,
        isReconciled: false,
      },
      include: {
        BankAccount: true,
      },
    });

    return NextResponse.json(statement);
  } catch (error: any) {
    console.error('Erro ao criar extrato:', error);
    return NextResponse.json(
      { error: 'Erro ao criar extrato: ' + error.message },
      { status: 500 }
    );
  }
}
