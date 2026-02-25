export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

// GET - Lista registros de ponto
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = {};
    
    if (employeeId) {
      where.employeeId = employeeId;
    }

    if (startDate || endDate) {
      where.dateTime = {};
      if (startDate) {
        where.dateTime.gte = new Date(startDate);
      }
      if (endDate) {
        where.dateTime.lte = new Date(endDate);
      }
    }

    const timeRecords = await prisma.timeRecord.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeNumber: true,
            department: true,
          },
        },
      },
      orderBy: { dateTime: 'desc' },
      take: 1000, // Limita a 1000 registros
    });

    return NextResponse.json(timeRecords);
  } catch (error) {
    console.error('Erro ao buscar registros de ponto:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar registros de ponto' },
      { status: 500 }
    );
  }
}

// POST - Cria registro de ponto manual
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { employeeId, dateTime, notes } = body;

    if (!employeeId || !dateTime) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: employeeId, dateTime' },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Funcionário não encontrado' },
        { status: 404 }
      );
    }

    const timeRecord = await prisma.timeRecord.create({
      data: {
        employeeId,
        employeeNumber: employee.employeeNumber,
        dateTime: new Date(dateTime),
        isManual: true,
        notes: notes || null,
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeNumber: true,
            department: true,
          },
        },
      },
    });

    return NextResponse.json(timeRecord, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar registro de ponto:', error);
    return NextResponse.json(
      { error: 'Erro ao criar registro de ponto', details: error.message },
      { status: 500 }
    );
  }
}
