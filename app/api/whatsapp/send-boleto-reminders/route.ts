import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { sendBoletoReminder, sendOverdueBoletoNotification, isTwilioConfigured } from '@/lib/whatsapp';
import { prisma } from '@/lib/db';

/**
 * API para envio automático de lembretes de boletos
 * POST /api/whatsapp/send-boleto-reminders
 * 
 * Envia lembretes para:
 * 1. Boletos que vencem em X dias (padrão: 3 dias)
 * 2. Boletos vencidos há menos de Y dias (padrão: 7 dias)
 */
export async function POST(request: NextRequest) {
  try {
    // Verifica autenticação
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Verifica se o Twilio está configurado
    if (!isTwilioConfigured()) {
      return NextResponse.json(
        { error: 'Twilio não configurado' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      daysBeforeDue = 3,  // Dias antes do vencimento para enviar lembrete
      daysAfterDue = 7,   // Dias após vencimento para enviar lembrete
      testMode = false    // Modo teste (não envia mensagens)
    } = body;

    console.log('[BOLETO_REMINDERS] Iniciando envio de lembretes...');
    console.log('[BOLETO_REMINDERS] Dias antes vencimento:', daysBeforeDue);
    console.log('[BOLETO_REMINDERS] Dias após vencimento:', daysAfterDue);
    console.log('[BOLETO_REMINDERS] Modo teste:', testMode);

    const now = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(now.getDate() + daysBeforeDue);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - daysAfterDue);

    // 1. Busca boletos que vencem em X dias (PENDING)
    const upcomingBoletos = await prisma.boleto.findMany({
      where: {
        status: 'PENDING',
        dueDate: {
          gte: now,
          lte: threeDaysFromNow
        },
        Customer: {
          phone: {
            not: null
          }
        }
      },
      include: {
        Customer: true
      }
    });

    console.log(`[BOLETO_REMINDERS] Encontrados ${upcomingBoletos.length} boletos vencendo em ${daysBeforeDue} dias`);

    // 2. Busca boletos vencidos há menos de Y dias (OVERDUE)
    const overdueBoletos = await prisma.boleto.findMany({
      where: {
        status: 'OVERDUE',
        dueDate: {
          gte: sevenDaysAgo,
          lt: now
        },
        Customer: {
          phone: {
            not: null
          }
        }
      },
      include: {
        Customer: true
      }
    });

    console.log(`[BOLETO_REMINDERS] Encontrados ${overdueBoletos.length} boletos vencidos há até ${daysAfterDue} dias`);

    const results = {
      upcoming: { sent: 0, failed: 0, skipped: 0 },
      overdue: { sent: 0, failed: 0, skipped: 0 },
      details: [] as any[]
    };

    // Envia lembretes para boletos que vão vencer
    for (const boleto of upcomingBoletos) {
      if (!boleto.Customer.phone) {
        results.upcoming.skipped++;
        continue;
      }

      const boletoAmount = typeof boleto.amount === 'number' ? boleto.amount : Number(boleto.amount);
      
      const detail = {
        type: 'upcoming',
        boletoId: boleto.id,
        customerName: boleto.Customer.name,
        customerPhone: boleto.Customer.phone,
        amount: boletoAmount,
        dueDate: boleto.dueDate,
        status: 'pending'
      };

      if (!testMode) {
        const result = await sendBoletoReminder(
          boleto.Customer.name,
          boleto.Customer.phone,
          boletoAmount,
          boleto.dueDate
        );

        if (result.success) {
          results.upcoming.sent++;
          detail.status = 'sent';
          console.log(`[BOLETO_REMINDERS] ✅ Enviado para ${boleto.Customer.name}`);
        } else {
          results.upcoming.failed++;
          detail.status = 'failed';
          console.error(`[BOLETO_REMINDERS] ❌ Falha ao enviar para ${boleto.Customer.name}:`, result.error);
        }
      } else {
        detail.status = 'test_mode';
        console.log(`[BOLETO_REMINDERS] [TESTE] Seria enviado para ${boleto.Customer.name}`);
      }

      results.details.push(detail);
    }

    // Envia lembretes para boletos vencidos
    for (const boleto of overdueBoletos) {
      if (!boleto.Customer.phone) {
        results.overdue.skipped++;
        continue;
      }

      const boletoAmount = typeof boleto.amount === 'number' ? boleto.amount : Number(boleto.amount);
      
      const detail = {
        type: 'overdue',
        boletoId: boleto.id,
        customerName: boleto.Customer.name,
        customerPhone: boleto.Customer.phone,
        amount: boletoAmount,
        dueDate: boleto.dueDate,
        status: 'pending'
      };

      if (!testMode) {
        const result = await sendOverdueBoletoNotification(
          boleto.Customer.name,
          boleto.Customer.phone,
          boletoAmount,
          boleto.dueDate
        );

        if (result.success) {
          results.overdue.sent++;
          detail.status = 'sent';
          console.log(`[BOLETO_REMINDERS] ✅ Enviado notificação de vencido para ${boleto.Customer.name}`);
        } else {
          results.overdue.failed++;
          detail.status = 'failed';
          console.error(`[BOLETO_REMINDERS] ❌ Falha ao enviar para ${boleto.Customer.name}:`, result.error);
        }
      } else {
        detail.status = 'test_mode';
        console.log(`[BOLETO_REMINDERS] [TESTE] Seria enviado para ${boleto.Customer.name}`);
      }

      results.details.push(detail);
    }

    console.log('[BOLETO_REMINDERS] ✅ Processo concluído!');
    console.log('[BOLETO_REMINDERS] Boletos vencendo - Enviados:', results.upcoming.sent, 'Falhas:', results.upcoming.failed);
    console.log('[BOLETO_REMINDERS] Boletos vencidos - Enviados:', results.overdue.sent, 'Falhas:', results.overdue.failed);

    return NextResponse.json({
      success: true,
      testMode,
      summary: {
        totalUpcoming: upcomingBoletos.length,
        totalOverdue: overdueBoletos.length,
        sent: results.upcoming.sent + results.overdue.sent,
        failed: results.upcoming.failed + results.overdue.failed,
        skipped: results.upcoming.skipped + results.overdue.skipped
      },
      results
    });

  } catch (error) {
    console.error('[BOLETO_REMINDERS] Erro ao enviar lembretes:', error);
    return NextResponse.json(
      {
        error: 'Erro ao enviar lembretes',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}
