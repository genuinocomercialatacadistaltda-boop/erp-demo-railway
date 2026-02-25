export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

/**
 * PUT /api/hr/attendance/day-edit
 * 
 * Edita ou cria registros de ponto para um dia específico de um funcionário
 */

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { employeeId, date, entryTime, snackBreakStart, snackBreakEnd, lunchStart, lunchEnd, exitTime, notes } = body;

    if (!employeeId || !date) {
      return NextResponse.json(
        { error: 'employeeId e date são obrigatórios' },
        { status: 400 }
      );
    }

    console.log('📝 Editando ponto do dia:', {
      employeeId,
      date,
      entryTime,
      snackBreakStart,
      snackBreakEnd,
      lunchStart,
      lunchEnd,
      exitTime,
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

    // Remove todos os registros do dia (para recriar)
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);

    await prisma.timeRecord.deleteMany({
      where: {
        employeeId,
        dateTime: {
          gte: dateStart,
          lte: dateEnd,
        },
      },
    });

    // 🔥 CORREÇÃO: Remove também qualquer registro de TimeOff (falta) para este dia
    // Isso permite que o administrador sobrescreva uma falta registrada
    // ao adicionar horários manualmente
    console.log('🗑️ Verificando e removendo TimeOff para permitir edição manual...');
    
    const existingTimeOff = await prisma.timeOff.findMany({
      where: {
        employeeId,
        OR: [
          {
            AND: [
              { startDate: { lte: dateStart } },
              { endDate: { gte: dateStart } },
            ],
          },
          {
            AND: [
              { startDate: { lte: dateEnd } },
              { endDate: { gte: dateEnd } },
            ],
          },
          {
            AND: [
              { startDate: { gte: dateStart } },
              { endDate: { lte: dateEnd } },
            ],
          },
        ],
      },
    });

    if (existingTimeOff.length > 0) {
      console.log(`📌 Encontrado ${existingTimeOff.length} registro(s) de falta/afastamento para este dia`);
      
      // Se o TimeOff é exatamente este dia, remove completamente
      // Se o TimeOff abrange vários dias, ajusta as datas
      for (const timeOff of existingTimeOff) {
        const timeOffStart = new Date(timeOff.startDate);
        timeOffStart.setHours(0, 0, 0, 0);
        const timeOffEnd = new Date(timeOff.endDate);
        timeOffEnd.setHours(0, 0, 0, 0);
        const editDate = new Date(date);
        editDate.setHours(0, 0, 0, 0);

        // Se o TimeOff é exatamente este dia único
        if (timeOffStart.getTime() === editDate.getTime() && timeOffEnd.getTime() === editDate.getTime()) {
          await prisma.timeOff.delete({
            where: { id: timeOff.id },
          });
          console.log(`✅ TimeOff removido (era apenas este dia)`);
        }
        // Se o TimeOff começa neste dia mas vai além
        else if (timeOffStart.getTime() === editDate.getTime() && timeOffEnd > editDate) {
          const newStart = new Date(editDate);
          newStart.setDate(newStart.getDate() + 1);
          await prisma.timeOff.update({
            where: { id: timeOff.id },
            data: { startDate: newStart },
          });
          console.log(`✅ TimeOff ajustado (removido o dia inicial)`);
        }
        // Se o TimeOff termina neste dia mas começou antes
        else if (timeOffEnd.getTime() === editDate.getTime() && timeOffStart < editDate) {
          const newEnd = new Date(editDate);
          newEnd.setDate(newEnd.getDate() - 1);
          await prisma.timeOff.update({
            where: { id: timeOff.id },
            data: { endDate: newEnd },
          });
          console.log(`✅ TimeOff ajustado (removido o dia final)`);
        }
        // Se o TimeOff abrange este dia no meio de um período maior
        else if (timeOffStart < editDate && timeOffEnd > editDate) {
          // Divide o TimeOff em dois: antes e depois do dia editado
          const dayBefore = new Date(editDate);
          dayBefore.setDate(dayBefore.getDate() - 1);
          const dayAfter = new Date(editDate);
          dayAfter.setDate(dayAfter.getDate() + 1);

          // Atualiza o registro original para terminar no dia anterior
          await prisma.timeOff.update({
            where: { id: timeOff.id },
            data: { endDate: dayBefore },
          });

          // Cria um novo registro começando no dia posterior
          await prisma.timeOff.create({
            data: {
              employeeId: timeOff.employeeId,
              type: timeOff.type,
              startDate: dayAfter,
              endDate: timeOff.endDate,
              reason: timeOff.reason,
              notes: `${timeOff.notes || ''} [Dividido devido à edição manual do dia ${date}]`.trim(),
              documentUrl: timeOff.documentUrl,
            },
          });
          console.log(`✅ TimeOff dividido (dia no meio do período foi removido)`);
        }
      }
    } else {
      console.log('✅ Nenhum TimeOff encontrado para este dia');
    }

    // Cria os novos registros
    const recordsToCreate: any[] = [];

    // 1️⃣ Entrada
    if (entryTime) {
      // 🔥 CORREÇÃO: Cria Date com timezone BRT explícito na string ISO
      const [hours, minutes] = entryTime.split(':');
      const isoString = `${date}T${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00-03:00`;
      const localDate = new Date(isoString);
      
      console.log(`📍 Entrada - Input: ${entryTime}, ISO: ${isoString}, Date: ${localDate.toISOString()}`);
      
      recordsToCreate.push({
        employeeId,
        employeeNumber: employee.employeeNumber,
        dateTime: localDate,
        isManual: true,
        notes: notes || 'Editado pelo administrador',
      });
    }

    // 2️⃣ Saída para Lanche
    if (snackBreakStart) {
      const [hours, minutes] = snackBreakStart.split(':');
      const isoString = `${date}T${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00-03:00`;
      const localDate = new Date(isoString);
      
      recordsToCreate.push({
        employeeId,
        employeeNumber: employee.employeeNumber,
        dateTime: localDate,
        isManual: true,
        notes: notes || 'Editado pelo administrador',
      });
    }

    // 3️⃣ Volta do Lanche
    if (snackBreakEnd) {
      const [hours, minutes] = snackBreakEnd.split(':');
      const isoString = `${date}T${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00-03:00`;
      const localDate = new Date(isoString);
      
      recordsToCreate.push({
        employeeId,
        employeeNumber: employee.employeeNumber,
        dateTime: localDate,
        isManual: true,
        notes: notes || 'Editado pelo administrador',
      });
    }

    // 4️⃣ Saída para Almoço
    if (lunchStart) {
      const [hours, minutes] = lunchStart.split(':');
      const isoString = `${date}T${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00-03:00`;
      const localDate = new Date(isoString);
      
      recordsToCreate.push({
        employeeId,
        employeeNumber: employee.employeeNumber,
        dateTime: localDate,
        isManual: true,
        notes: notes || 'Editado pelo administrador',
      });
    }

    // 5️⃣ Volta do Almoço
    if (lunchEnd) {
      const [hours, minutes] = lunchEnd.split(':');
      const isoString = `${date}T${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00-03:00`;
      const localDate = new Date(isoString);
      
      recordsToCreate.push({
        employeeId,
        employeeNumber: employee.employeeNumber,
        dateTime: localDate,
        isManual: true,
        notes: notes || 'Editado pelo administrador',
      });
    }

    // 6️⃣ Saída Final
    if (exitTime) {
      const [hours, minutes] = exitTime.split(':');
      const isoString = `${date}T${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00-03:00`;
      const localDate = new Date(isoString);
      
      recordsToCreate.push({
        employeeId,
        employeeNumber: employee.employeeNumber,
        dateTime: localDate,
        isManual: true,
        notes: notes || 'Editado pelo administrador',
      });
    }

    // Cria todos os registros de uma vez
    if (recordsToCreate.length > 0) {
      console.log(`📝 Criando ${recordsToCreate.length} registros:`, recordsToCreate.map(r => ({
        time: new Date(r.dateTime).toISOString(),
        isManual: r.isManual
      })));
      
      const result = await prisma.timeRecord.createMany({
        data: recordsToCreate,
      });
      
      console.log(`✅ ${result.count} registro(s) efetivamente criado(s) no banco`);
      
      // Verifica se foram realmente criados
      const verifyRecords = await prisma.timeRecord.findMany({
        where: {
          employeeId,
          dateTime: {
            gte: dateStart,
            lte: dateEnd,
          },
        },
      });
      
      console.log(`🔍 Verificação: ${verifyRecords.length} registro(s) encontrado(s) no banco para este dia`);
    } else {
      console.log(`⚠️ Nenhum registro para criar (todos os campos de horário estão vazios)`);
    }

    console.log(`✅ ${recordsToCreate.length} registro(s) preparado(s) para ${date}`);

    return NextResponse.json({
      message: 'Registros atualizados com sucesso',
      recordsCreated: recordsToCreate.length,
    });
  } catch (error: any) {
    console.error('❌ Erro ao editar ponto:', error);
    return NextResponse.json(
      { error: 'Erro ao editar ponto', details: error.message },
      { status: 500 }
    );
  }
}
