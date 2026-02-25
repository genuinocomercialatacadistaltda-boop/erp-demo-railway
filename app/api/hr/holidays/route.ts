
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

/**
 * GET /api/hr/holidays
 * Lista todos os feriados
 * 
 * POST /api/hr/holidays
 * Cria um novo feriado
 */

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    let where: any = {};

    if (year) {
      const startDate = new Date(`${year}-01-01`);
      const endDate = new Date(`${year}-12-31`);
      where.date = {
        gte: startDate,
        lte: endDate,
      };
    }

    if (month && year) {
      const monthNum = parseInt(month);
      const startDate = new Date(parseInt(year), monthNum - 1, 1);
      const endDate = new Date(parseInt(year), monthNum, 0, 23, 59, 59);
      where.date = {
        gte: startDate,
        lte: endDate,
      };
    }

    const holidays = await prisma.holiday.findMany({
      where,
      orderBy: {
        date: 'asc',
      },
    });

    return NextResponse.json(holidays);
  } catch (error: any) {
    console.error('❌ Erro ao listar feriados:', error);
    return NextResponse.json(
      { error: 'Erro ao listar feriados', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { date, name, isRecurring, notes } = body;

    if (!date || !name) {
      return NextResponse.json(
        { error: 'date e name são obrigatórios' },
        { status: 400 }
      );
    }

    console.log('📅 Criando feriado:', { date, name, isRecurring });

    // Verifica se já existe um feriado nesta data
    const existing = await prisma.holiday.findFirst({
      where: {
        date: new Date(date),
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Já existe um feriado cadastrado nesta data' },
        { status: 400 }
      );
    }

    const holiday = await prisma.holiday.create({
      data: {
        date: new Date(date),
        name,
        isRecurring: isRecurring || false,
        isActive: true,
        notes,
      },
    });

    console.log('✅ Feriado criado:', holiday.id);

    return NextResponse.json(holiday, { status: 201 });
  } catch (error: any) {
    console.error('❌ Erro ao criar feriado:', error);
    return NextResponse.json(
      { error: 'Erro ao criar feriado', details: error.message },
      { status: 500 }
    );
  }
}
