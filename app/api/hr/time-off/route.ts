export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

/**
 * GET /api/hr/time-off
 * Lista todos os afastamentos
 * 
 * POST /api/hr/time-off
 * Cria um novo afastamento
 */

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');

    const timeOffs = await prisma.timeOff.findMany({
      where: {
        ...(employeeId && { employeeId }),
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeNumber: true,
          },
        },
      },
      orderBy: {
        startDate: 'desc',
      },
    });

    return NextResponse.json(timeOffs);
  } catch (error: any) {
    console.error('❌ Erro ao listar afastamentos:', error);
    return NextResponse.json(
      { error: 'Erro ao listar afastamentos', details: error.message },
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
    const { employeeId, type, startDate, endDate, reason, notes, documentUrl, isApproved } = body;

    if (!employeeId || !type || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'employeeId, type, startDate e endDate são obrigatórios' },
        { status: 400 }
      );
    }

    console.log('📝 Criando afastamento:', { employeeId, type, startDate, endDate });

    const timeOff = await prisma.timeOff.create({
      data: {
        employeeId,
        type,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason,
        notes,
        documentUrl,
        isApproved: isApproved !== undefined ? isApproved : true,
        approvedBy: (session.user as any)?.id,
        approvedAt: isApproved ? new Date() : null,
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeNumber: true,
          },
        },
      },
    });

    console.log('✅ Afastamento criado:', timeOff.id);

    return NextResponse.json(timeOff, { status: 201 });
  } catch (error: any) {
    console.error('❌ Erro ao criar afastamento:', error);
    return NextResponse.json(
      { error: 'Erro ao criar afastamento', details: error.message },
      { status: 500 }
    );
  }
}
