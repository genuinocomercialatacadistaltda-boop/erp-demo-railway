
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

/**
 * GET /api/hr/work-schedule
 * Lista jornadas de trabalho
 * 
 * POST /api/hr/work-schedule
 * Cria ou atualiza jornada de trabalho de um funcionário
 */

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');

    if (employeeId) {
      // Busca jornada de um funcionário específico
      const schedule = await prisma.workSchedule.findUnique({
        where: { employeeId },
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              employeeNumber: true,
              position: true,
            },
          },
        },
      });

      return NextResponse.json(schedule || null);
    }

    // Lista todas as jornadas
    const schedules = await prisma.workSchedule.findMany({
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeNumber: true,
            position: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(schedules);
  } catch (error: any) {
    console.error('❌ Erro ao buscar jornadas:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar jornadas', details: error.message },
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
    const {
      employeeId,
      monday = true,
      tuesday = true,
      wednesday = true,
      thursday = true,
      friday = true,
      saturday = false,
      sunday = false,
      dailyMinutes = 528, // 8h48min padrão CLT
      weeklyMinutes = 2640, // 44h semanais
      mondayMinutes,
      tuesdayMinutes,
      wednesdayMinutes,
      thursdayMinutes,
      fridayMinutes,
      saturdayMinutes,
      sundayMinutes,
      hasFlexibleSchedule = false,
      startTime,
      endTime,
      lunchBreakMinutes = 60,
      notes,
    } = body;

    console.log('📋 Criando/atualizando jornada:', {
      employeeId,
      dailyMinutes,
      weeklyMinutes,
      mondayMinutes,
      tuesdayMinutes,
      wednesdayMinutes,
      thursdayMinutes,
      fridayMinutes,
      saturdayMinutes,
      sundayMinutes,
    });

    // Verifica se o funcionário existe
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Funcionário não encontrado' },
        { status: 404 }
      );
    }

    // Cria ou atualiza a jornada (upsert)
    const schedule = await prisma.workSchedule.upsert({
      where: { employeeId },
      create: {
        employeeId,
        monday,
        tuesday,
        wednesday,
        thursday,
        friday,
        saturday,
        sunday,
        dailyMinutes,
        weeklyMinutes,
        mondayMinutes,
        tuesdayMinutes,
        wednesdayMinutes,
        thursdayMinutes,
        fridayMinutes,
        saturdayMinutes,
        sundayMinutes,
        hasFlexibleSchedule,
        startTime,
        endTime,
        lunchBreakMinutes,
        notes,
      },
      update: {
        monday,
        tuesday,
        wednesday,
        thursday,
        friday,
        saturday,
        sunday,
        dailyMinutes,
        weeklyMinutes,
        mondayMinutes,
        tuesdayMinutes,
        wednesdayMinutes,
        thursdayMinutes,
        fridayMinutes,
        saturdayMinutes,
        sundayMinutes,
        hasFlexibleSchedule,
        startTime,
        endTime,
        lunchBreakMinutes,
        notes,
        updatedAt: new Date(),
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

    console.log('✅ Jornada salva:', schedule.id);

    return NextResponse.json(schedule);
  } catch (error: any) {
    console.error('❌ Erro ao salvar jornada:', error);
    return NextResponse.json(
      { error: 'Erro ao salvar jornada', details: error.message },
      { status: 500 }
    );
  }
}
