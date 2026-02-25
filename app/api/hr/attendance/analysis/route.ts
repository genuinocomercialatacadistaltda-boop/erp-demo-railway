
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

/**
 * GET /api/hr/attendance/analysis
 * 
 * Gera análise completa de jornada de trabalho:
 * - Horas trabalhadas vs. Jornada esperada
 * - Horas extras
 * - Horas falta
 * - Faltas (dias sem registro)
 * - Atestados e feriados
 */

interface DayAnalysis {
  date: string;
  dayOfWeek: string;
  records: any[];
  entryTime?: string;          // 1️⃣ Entrada (primeira marcação)
  snackBreakStart?: string;    // 2️⃣ Saída Lanche (segunda marcação)
  snackBreakEnd?: string;      // 3️⃣ Volta Lanche (terceira marcação)
  lunchStart?: string;         // 4️⃣ Saída Almoço (quarta marcação)
  lunchEnd?: string;           // 5️⃣ Volta Almoço (quinta marcação)
  exitTime?: string;           // 6️⃣ Saída Final (sexta marcação)
  totalMinutes: number;
  expectedMinutes: number;
  overtime: number;
  overtimeHoliday: number;     // 🆕 Horas extras em feriado (100%)
  overtimeBirthday: number;    // 🎂 Horas extras em aniversário (100%)
  overtimeNormal: number;      // 🆕 Horas extras normais (50%)
  undertime: number;
  status: 'NORMAL' | 'OVERTIME' | 'UNDERTIME' | 'ABSENT' | 'TIME_OFF' | 'HOLIDAY' | 'BIRTHDAY';
  timeOffType?: string;
  timeOffReason?: string;
  isBirthday?: boolean;        // 🎂 Indica se é aniversário do funcionário
}

interface DSRDiscount {
  weekStart: string;           // Data de início da semana (segunda-feira)
  weekEnd: string;             // Data de fim da semana (domingo)
  absenceDate: string;         // Data da falta
  absenceType: 'FULL_DAY' | 'HALF_DAY_MORNING' | 'HALF_DAY_AFTERNOON';  // Tipo de falta
  dsrDate: string;             // Data do DSR a descontar (domingo posterior)
  hoursLost: number;           // Horas perdidas na falta
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!employeeId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios: employeeId, startDate, endDate' },
        { status: 400 }
      );
    }

    console.log('📊 Gerando análise de jornada:', {
      employeeId,
      startDate,
      endDate,
    });

    // Busca o funcionário e sua jornada
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        workSchedule: true,
        department: true,
      },
    }) as any;  // Cast para acessar birthDate

    if (!employee) {
      return NextResponse.json(
        { error: 'Funcionário não encontrado' },
        { status: 404 }
      );
    }

    // Se não houver jornada configurada, usa padrão (8h48min seg-sex)
    const schedule = employee.workSchedule || {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
      dailyMinutes: 528,
      weeklyMinutes: 2640,
      lunchBreakMinutes: 60,
      mondayMinutes: null,
      tuesdayMinutes: null,
      wednesdayMinutes: null,
      thursdayMinutes: null,
      fridayMinutes: null,
      saturdayMinutes: null,
      sundayMinutes: null,
    };

    // Busca todos os registros de ponto no período
    // 🔥 CORREÇÃO: Usa timezone BRT explicitamente para garantir que encontre todos os registros
    const startDateTime = new Date(`${startDate}T00:00:00-03:00`);
    const endDateTime = new Date(`${endDate}T23:59:59-03:00`);
    
    console.log(`🔍 Buscando registros de ponto:`, {
      employeeId,
      startDate,
      endDate,
      startDateTime: startDateTime.toISOString(),
      endDateTime: endDateTime.toISOString()
    });
    
    const records = await prisma.timeRecord.findMany({
      where: {
        employeeId,
        dateTime: {
          gte: startDateTime,
          lte: endDateTime,
        },
      },
      orderBy: {
        dateTime: 'asc',
      },
    });
    
    console.log(`✅ Encontrados ${records.length} registros de ponto`);
    
    // Log detalhado dos registros encontrados
    if (records.length > 0) {
      const recordsByDateDebug = new Map<string, number>();
      for (const record of records) {
        const dateKey = new Date(record.dateTime).toISOString().split('T')[0];
        recordsByDateDebug.set(dateKey, (recordsByDateDebug.get(dateKey) || 0) + 1);
      }
      console.log(`📊 Registros por dia:`, Object.fromEntries(recordsByDateDebug));
    }

    // Busca afastamentos no período
    const timeOffs = await prisma.timeOff.findMany({
      where: {
        employeeId,
        OR: [
          {
            startDate: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          },
          {
            endDate: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          },
          {
            AND: [
              { startDate: { lte: new Date(startDate) } },
              { endDate: { gte: new Date(endDate) } },
            ],
          },
        ],
      },
    });

    // Busca feriados no período
    const holidays = await prisma.holiday.findMany({
      where: {
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
        isActive: true,
      },
    });

    // Mapa de dias da semana
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayNamesPortuguese = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

    // Agrupa registros por data
    const recordsByDate = new Map<string, any[]>();
    for (const record of records) {
      const dateKey = record.dateTime.toISOString().split('T')[0];
      if (!recordsByDate.has(dateKey)) {
        recordsByDate.set(dateKey, []);
      }
      recordsByDate.get(dateKey)!.push(record);
    }

    // Analisa cada dia do período
    const analysis: DayAnalysis[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    let totalWorkedMinutes = 0;
    let totalExpectedMinutes = 0;
    let totalOvertimeMinutes = 0;
    let totalOvertimeNormalMinutes = 0;      // 🆕 Horas extras normais (50%)
    let totalOvertimeHolidayMinutes = 0;     // 🆕 Horas extras em feriado (100%)
    let totalOvertimeBirthdayMinutes = 0;    // 🎂 Horas extras em aniversário (100%)
    let totalUndertimeMinutes = 0;
    let daysAbsent = 0;
    let daysWorked = 0;
    
    // 🎂 Extrai mês e dia do aniversário do funcionário
    const employeeBirthDate = employee.birthDate ? new Date(employee.birthDate) : null;
    const birthMonth = employeeBirthDate ? employeeBirthDate.getUTCMonth() : null;  // 0-11
    const birthDay = employeeBirthDate ? employeeBirthDate.getUTCDate() : null;

    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dateKey = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay();
      const dayName = dayNames[dayOfWeek] as keyof typeof schedule;
      const dayNamePt = dayNamesPortuguese[dayOfWeek];

      // Verifica se é dia de trabalho na jornada
      const isWorkDay = schedule[dayName] === true;

      // Verifica se é feriado
      const isHoliday = holidays.some((h) => {
        const holidayDate = new Date(h.date).toISOString().split('T')[0];
        return holidayDate === dateKey;
      });

      // 🎂 Verifica se é aniversário do funcionário
      const isBirthday = birthMonth !== null && birthDay !== null && 
        date.getUTCMonth() === birthMonth && 
        date.getUTCDate() === birthDay;
      
      if (isBirthday) {
        console.log(`🎂 Dia ${dateKey}: É ANIVERSÁRIO do funcionário!`);
      }

      // Verifica se há afastamento neste dia
      const timeOff = timeOffs.find((t) => {
        const startDateKey = new Date(t.startDate).toISOString().split('T')[0];
        const endDateKey = new Date(t.endDate).toISOString().split('T')[0];
        return dateKey >= startDateKey && dateKey <= endDateKey;
      });

      // Registros do dia
      const dayRecords = recordsByDate.get(dateKey) || [];
      
      // Log de debug para dias problemáticos
      if (isWorkDay && dayRecords.length === 0 && !timeOff && !isHoliday) {
        console.log(`⚠️ Dia ${dateKey} (${dayNamePt}): É dia de trabalho mas NÃO tem registros. Será marcado como FALTA.`);
      } else if (dayRecords.length > 0) {
        console.log(`✅ Dia ${dateKey} (${dayNamePt}): ${dayRecords.length} registros encontrados`);
      }

      let expectedMinutes = 0;
      let status: DayAnalysis['status'] = 'NORMAL';

      if (isHoliday) {
        status = 'HOLIDAY';
      } else if (timeOff) {
        status = 'TIME_OFF';
        console.log(`📋 Dia ${dateKey}: Marcado como TIME_OFF (${timeOff.type})`);
      } else if (isWorkDay) {
        // Usa minutos específicos do dia se configurado, senão usa dailyMinutes padrão
        const dayMinutesMap: Record<string, number | null> = {
          monday: schedule.mondayMinutes ?? null,
          tuesday: schedule.tuesdayMinutes ?? null,
          wednesday: schedule.wednesdayMinutes ?? null,
          thursday: schedule.thursdayMinutes ?? null,
          friday: schedule.fridayMinutes ?? null,
          saturday: schedule.saturdayMinutes ?? null,
          sunday: schedule.sundayMinutes ?? null,
        };
        
        expectedMinutes = dayMinutesMap[dayName as keyof typeof dayMinutesMap] ?? schedule.dailyMinutes;
        // ⚠️ NÃO soma totalExpectedMinutes aqui! Será somado só se houver trabalho (linha 354)
      }

      // Calcula horas trabalhadas no dia e extrai horários
      let workedMinutes = 0;
      let entryTime: string | undefined;
      let snackBreakStart: string | undefined;
      let snackBreakEnd: string | undefined;
      let lunchStart: string | undefined;
      let lunchEnd: string | undefined;
      let exitTime: string | undefined;
      
      if (dayRecords.length >= 2) {
        // Assume padrão com 6 marcações: Entrada → Lanche Saída → Lanche Volta → Almoço Saída → Almoço Volta → Saída Final
        const sorted = [...dayRecords].sort((a, b) => 
          new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
        );

        // 🔧 Extrai horários formatados usando horário local (BRT/BRST = UTC-3)
        const formatTime = (dateTimeString: string | Date) => {
          const date = new Date(dateTimeString);
          
          // Converte para horário de Brasília (UTC-3) usando toLocaleString
          const brTime = date.toLocaleString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
          
          return brTime; // Retorna no formato "HH:MM"
        };

        // 1️⃣ Entrada (primeira marcação)
        entryTime = formatTime(sorted[0].dateTime);
        
        // Se houver apenas 2 marcações (entrada + saída), pula os intervalos
        if (sorted.length === 2) {
          // Apenas entrada e saída final
          exitTime = formatTime(sorted[1].dateTime);
        } 
        // Se houver 4 marcações (entrada + intervalo + saída)
        else if (sorted.length === 4) {
          snackBreakStart = formatTime(sorted[1].dateTime);
          snackBreakEnd = formatTime(sorted[2].dateTime);
          exitTime = formatTime(sorted[3].dateTime);
        }
        // Se houver 6 marcações (entrada + lanche + almoço + saída)
        else if (sorted.length >= 6) {
          snackBreakStart = formatTime(sorted[1].dateTime);
          snackBreakEnd = formatTime(sorted[2].dateTime);
          lunchStart = formatTime(sorted[3].dateTime);
          lunchEnd = formatTime(sorted[4].dateTime);
          exitTime = formatTime(sorted[5].dateTime);
        }
        // Casos intermediários (3 ou 5 marcações)
        else if (sorted.length > 2) {
          // Preenche conforme disponível e a última é sempre saída
          if (sorted.length >= 3) snackBreakStart = formatTime(sorted[1].dateTime);
          if (sorted.length >= 4) snackBreakEnd = formatTime(sorted[2].dateTime);
          if (sorted.length >= 5) lunchStart = formatTime(sorted[3].dateTime);
          exitTime = formatTime(sorted[sorted.length - 1].dateTime);
        }

        // Calcula horas trabalhadas (entrada-saída excluindo intervalos)
        for (let i = 0; i < sorted.length - 1; i += 2) {
          const entry = new Date(sorted[i].dateTime);
          const exit = sorted[i + 1] ? new Date(sorted[i + 1].dateTime) : null;
          
          if (exit) {
            const diff = (exit.getTime() - entry.getTime()) / (1000 * 60);
            workedMinutes += diff;
          }
        }

        // Remove os intervalos de lanche e almoço (já descontados pelo padrão par/ímpar)
        // O cálculo acima já desconta automaticamente os intervalos

        totalWorkedMinutes += workedMinutes;
        daysWorked++;
        
        // ✅ SOMA expectedMinutes apenas quando houve trabalho (mesmo que com undertime)
        totalExpectedMinutes += expectedMinutes;
      } else if (isWorkDay && dayRecords.length === 0 && !timeOff && !isHoliday && !isBirthday) {
        // 🎂 Se for aniversário e não trabalhou, NÃO é falta (será tratado abaixo como BIRTHDAY)
        status = 'ABSENT';
        daysAbsent++;
        
        // 🔥 CORREÇÃO CRÍTICA: NÃO soma expectedMinutes para falta completa!
        // O desconto já está no contador de "dias ausentes" (daysAbsent)
        // Se somarmos expectedMinutes aqui, teremos desconto duplicado:
        // - 1 dia de falta (daysAbsent)
        // - 8h48min no saldo negativo (totalExpectedMinutes sem totalWorkedMinutes)
        console.log(`⚠️ Dia ${dateKey} é FALTA COMPLETA - NÃO somando ${expectedMinutes}min ao totalExpectedMinutes`);
      }

      // Calcula horas extras ou faltas
      let overtime = 0;
      let overtimeNormal = 0;     // 🆕 Horas extras normais (50%)
      let overtimeHoliday = 0;    // 🆕 Horas extras em feriado (100%)
      let overtimeBirthday = 0;   // 🎂 Horas extras em aniversário (100%)
      let undertime = 0;

      // 🆕 Se trabalhou em feriado, TODAS as horas trabalhadas são consideradas horas extras com 100%
      if (isHoliday && !timeOff && workedMinutes > 0) {
        overtimeHoliday = workedMinutes;
        overtime = workedMinutes;
        totalOvertimeHolidayMinutes += overtimeHoliday;
        totalOvertimeMinutes += overtime;
        status = 'OVERTIME';
      }
      // 🎂 Se é aniversário do funcionário - TRATA IGUAL A FERIADO (100%)
      else if (isBirthday && !timeOff) {
        if (workedMinutes > 0) {
          // Se trabalhou no aniversário, TODAS as horas são hora extra 100% (igual feriado!)
          overtimeBirthday = workedMinutes;
          overtimeHoliday = workedMinutes;  // 🔥 TAMBÉM soma em overtimeHoliday para aparecer junto com feriados
          overtime = workedMinutes;
          totalOvertimeBirthdayMinutes += overtimeBirthday;
          totalOvertimeHolidayMinutes += overtimeHoliday;  // 🔥 SOMA NAS HORAS EXTRAS 100% (FERIADO)
          totalOvertimeMinutes += overtime;
          status = 'BIRTHDAY';
          console.log(`🎂 Dia ${dateKey}: Funcionário trabalhou no aniversário - ${workedMinutes}min como hora extra 100% (somado em H.E. Feriado)`);
        } else {
          // Se não trabalhou no aniversário, NÃO DESCONTA (abono automático)
          status = 'BIRTHDAY';
          // Importante: NÃO incrementa daysAbsent nem undertime
          console.log(`🎂 Dia ${dateKey}: Funcionário folgou no aniversário - SEM DESCONTO`);
        }
      }
      // Horas extras normais em dias de trabalho
      else if (isWorkDay && !timeOff && !isHoliday && !isBirthday) {
        const diff = workedMinutes - expectedMinutes;
        if (diff > 15) {
          // Tolerância de 15 minutos
          overtimeNormal = diff;
          overtime = diff;
          totalOvertimeNormalMinutes += overtimeNormal;
          totalOvertimeMinutes += overtime;
          if (status === 'NORMAL') status = 'OVERTIME';
        } else if (diff < -15) {
          undertime = Math.abs(diff);
          
          // 🔥 CORREÇÃO: Só adiciona horas falta se NÃO for falta completa (ABSENT)
          // Se o status já é ABSENT, significa que já contamos como 1 dia de falta
          // então NÃO devemos somar as horas novamente (evita desconto duplicado)
          if (status !== 'ABSENT') {
            totalUndertimeMinutes += undertime;
            if (status === 'NORMAL') status = 'UNDERTIME';
          } else {
            console.log(`⚠️ Dia ${dateKey} é FALTA COMPLETA - não somando ${undertime}min ao total de horas falta`);
          }
        }
      }
      // Se trabalhou em dia não útil (sábado/domingo) e não é dia de trabalho na jornada, conta como hora extra normal
      else if (!isWorkDay && !timeOff && !isHoliday && !isBirthday && workedMinutes > 0) {
        overtimeNormal = workedMinutes;
        overtime = workedMinutes;
        totalOvertimeNormalMinutes += overtimeNormal;
        totalOvertimeMinutes += overtime;
        status = 'OVERTIME';
      }

      analysis.push({
        date: dateKey,
        dayOfWeek: dayNamePt,
        records: dayRecords,
        entryTime,
        snackBreakStart,
        snackBreakEnd,
        lunchStart,
        lunchEnd,
        exitTime,
        totalMinutes: Math.round(workedMinutes),
        expectedMinutes,
        overtime: Math.round(overtime),
        overtimeNormal: Math.round(overtimeNormal),      // 🆕 Horas extras normais (50%)
        overtimeHoliday: Math.round(overtimeHoliday),    // 🆕 Horas extras em feriado (100%)
        overtimeBirthday: Math.round(overtimeBirthday),  // 🎂 Horas extras em aniversário (100%)
        isBirthday,                                       // 🎂 Indica se é aniversário
        undertime: Math.round(undertime),
        status,
        timeOffType: timeOff?.type,
        timeOffReason: timeOff?.reason ?? undefined,
      });
    }

    // 🆕 Calcula DSR (Descanso Semanal Remunerado) - NOVA LÓGICA
    // Regras da contabilidade:
    // 1. Falta de dia inteiro → desconta domingo posterior
    // 2. Falta de meio período (3-4h manhã OU tarde) → desconta repouso
    
    const dsrDiscounts: DSRDiscount[] = [];
    let workableDays = 0;
    let sundaysAndHolidays = 0;
    
    // Primeiro passa: conta dias úteis e domingos/feriados
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dateKey = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay();
      const dayName = dayNames[dayOfWeek] as keyof typeof schedule;
      
      const isWorkDay = schedule[dayName] === true;
      const isHoliday = holidays.some((h) => {
        const holidayDate = new Date(h.date).toISOString().split('T')[0];
        return holidayDate === dateKey;
      });
      const isSunday = dayOfWeek === 0;
      
      if (isWorkDay) {
        workableDays++;
      }
      
      if (isSunday || isHoliday) {
        sundaysAndHolidays++;
      }
    }
    
    // Segunda passa: detecta faltas que geram desconto de DSR
    for (const day of analysis) {
      const dayDate = new Date(day.date);
      const dayOfWeek = dayDate.getDay();
      
      // Ignora domingos e feriados
      if (day.status === 'HOLIDAY' || dayOfWeek === 0) continue;
      
      // Verifica se houve falta (dia sem registro ou com horas insuficientes)
      const isAbsent = day.status === 'ABSENT';
      const hasSignificantUndertime = day.undertime >= 180; // 3 horas ou mais de falta
      
      if (isAbsent || hasSignificantUndertime) {
        // Determina o tipo de falta
        let absenceType: 'FULL_DAY' | 'HALF_DAY_MORNING' | 'HALF_DAY_AFTERNOON' = 'FULL_DAY';
        let hoursLost = 0;
        
        if (isAbsent) {
          // Falta de dia inteiro
          absenceType = 'FULL_DAY';
          hoursLost = day.expectedMinutes / 60;
        } else {
          // Falta de meio período (3-4 horas)
          hoursLost = day.undertime / 60;
          
          // Determina se foi manhã ou tarde (simplificado - assume que falta > 3h é meio período)
          if (day.totalMinutes < day.expectedMinutes / 2) {
            absenceType = 'HALF_DAY_MORNING';
          } else {
            absenceType = 'HALF_DAY_AFTERNOON';
          }
        }
        
        // Calcula o domingo posterior (próximo domingo após a falta)
        const nextSunday = new Date(dayDate);
        const daysUntilSunday = (7 - dayOfWeek) % 7 || 7;
        nextSunday.setDate(nextSunday.getDate() + daysUntilSunday);
        
        // Calcula início da semana (segunda-feira anterior)
        const weekStart = new Date(dayDate);
        const daysFromMonday = (dayOfWeek + 6) % 7;
        weekStart.setDate(weekStart.getDate() - daysFromMonday);
        
        dsrDiscounts.push({
          weekStart: weekStart.toISOString().split('T')[0],
          weekEnd: nextSunday.toISOString().split('T')[0],
          absenceDate: day.date,
          absenceType,
          dsrDate: nextSunday.toISOString().split('T')[0],
          hoursLost: parseFloat(hoursLost.toFixed(2)),
        });
      }
    }

    // Formata tempos para exibição
    const formatMinutes = (minutes: number) => {
      const hours = Math.floor(minutes / 60);
      const mins = Math.round(minutes % 60);
      return `${hours}h${mins.toString().padStart(2, '0')}min`;
    };

    const summary = {
      employee: {
        id: employee.id,
        name: employee.name,
        employeeNumber: employee.employeeNumber,
        position: employee.position,
        department: employee.department?.name,
      },
      schedule: {
        dailyMinutes: schedule.dailyMinutes,
        weeklyMinutes: schedule.weeklyMinutes,
        workDays: {
          monday: schedule.monday,
          tuesday: schedule.tuesday,
          wednesday: schedule.wednesday,
          thursday: schedule.thursday,
          friday: schedule.friday,
          saturday: schedule.saturday,
          sunday: schedule.sunday,
        },
      },
      period: {
        startDate,
        endDate,
      },
      totals: {
        daysWorked,
        daysAbsent,
        workableDays,                                                              // 🆕 Dias úteis no período
        sundaysAndHolidays,                                                        // 🆕 Domingos e feriados
        totalWorkedMinutes: Math.round(totalWorkedMinutes),
        totalWorkedFormatted: formatMinutes(totalWorkedMinutes),
        totalExpectedMinutes: Math.round(totalExpectedMinutes),
        totalExpectedFormatted: formatMinutes(totalExpectedMinutes),
        totalOvertimeMinutes: Math.round(totalOvertimeMinutes),
        totalOvertimeFormatted: formatMinutes(totalOvertimeMinutes),
        totalOvertimeNormalMinutes: Math.round(totalOvertimeNormalMinutes),        // 🆕 Horas extras normais (50%)
        totalOvertimeNormalFormatted: formatMinutes(totalOvertimeNormalMinutes),   // 🆕 Formatado
        totalOvertimeHolidayMinutes: Math.round(totalOvertimeHolidayMinutes),      // 🆕 Horas extras feriado (100%)
        totalOvertimeHolidayFormatted: formatMinutes(totalOvertimeHolidayMinutes), // 🆕 Formatado
        totalOvertimeBirthdayMinutes: Math.round(totalOvertimeBirthdayMinutes),    // 🎂 Horas extras aniversário (100%)
        totalOvertimeBirthdayFormatted: formatMinutes(totalOvertimeBirthdayMinutes), // 🎂 Formatado
        totalUndertimeMinutes: Math.round(totalUndertimeMinutes),
        totalUndertimeFormatted: formatMinutes(totalUndertimeMinutes),
        balance: Math.round(totalWorkedMinutes - totalExpectedMinutes),
        balanceFormatted: formatMinutes(Math.abs(totalWorkedMinutes - totalExpectedMinutes)),
        balanceStatus: totalWorkedMinutes > totalExpectedMinutes ? 'positive' : 'negative',
        dsrDiscounts: dsrDiscounts.length,                                         // 🆕 Quantidade de DSRs a descontar
        dsrDiscountsList: dsrDiscounts,                                            // 🆕 Lista detalhada de DSRs
      },
      days: analysis,
    };

    console.log('✅ Análise gerada:', {
      daysWorked,
      daysAbsent,
      workableDays,
      sundaysAndHolidays,
      overtime: formatMinutes(totalOvertimeMinutes),
      overtimeNormal: formatMinutes(totalOvertimeNormalMinutes),      // 🆕 50%
      overtimeHoliday: formatMinutes(totalOvertimeHolidayMinutes),    // 🆕 100%
      overtimeBirthday: formatMinutes(totalOvertimeBirthdayMinutes),  // 🎂 100%
      undertime: formatMinutes(totalUndertimeMinutes),
      dsrDiscounts: dsrDiscounts.length,                              // 🆕 DSRs a descontar
    });
    
    console.log('📋 DSRs a descontar:', dsrDiscounts);

    return NextResponse.json(summary);
  } catch (error: any) {
    console.error('❌ Erro ao gerar análise:', error);
    return NextResponse.json(
      { error: 'Erro ao gerar análise', details: error.message },
      { status: 500 }
    );
  }
}
