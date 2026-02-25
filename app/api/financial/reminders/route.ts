export const dynamic = 'force-dynamic';


import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { addDays } from 'date-fns';

/**
 * API: Lembretes de Pagamentos
 * GET /api/financial/reminders - Lista lembretes
 * POST /api/financial/reminders/generate - Gera lembretes automáticos
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
    const isSent = searchParams.get('isSent');
    const isCompleted = searchParams.get('isCompleted');
    const referenceType = searchParams.get('referenceType');

    const where: any = {};

    if (isSent !== null) {
      where.isSent = isSent === 'true';
    }

    if (isCompleted !== null) {
      where.isCompleted = isCompleted === 'true';
    }

    if (referenceType) {
      where.referenceType = referenceType;
    }

    const reminders = await prisma.paymentReminder.findMany({
      where,
      orderBy: {
        reminderDate: 'asc',
      },
    });

    return NextResponse.json(reminders);
  } catch (error: any) {
    console.error('Erro ao buscar lembretes:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar lembretes: ' + error.message },
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
    const { daysBeforeDue = 3 } = body;

    const createdReminders = [];

    // 1. Lembretes para Despesas (Contas a Pagar)
    const upcomingExpenses = await prisma.expense.findMany({
      where: {
        status: 'PENDING',
        dueDate: {
          gte: new Date(),
          lte: addDays(new Date(), daysBeforeDue + 7), // Próximos 10 dias
        },
      },
    });

    for (const expense of upcomingExpenses) {
      const reminderDate = addDays(expense.dueDate, -daysBeforeDue);

      // Verifica se já existe lembrete
      const existing = await prisma.paymentReminder.findFirst({
        where: {
          referenceType: 'EXPENSE',
          referenceId: expense.id,
          isCompleted: false,
        },
      });

      if (!existing && reminderDate >= new Date()) {
        const reminder = await prisma.paymentReminder.create({
          data: {
            reminderType: 'PAYMENT_DUE',
            referenceType: 'EXPENSE',
            referenceId: expense.id,
            dueDate: expense.dueDate,
            amount: expense.amount,
            description: `Pagamento: ${expense.description}`,
            daysBeforeDue,
            reminderDate,
          },
        });
        createdReminders.push(reminder);
      }
    }

    // 2. Lembretes para Recebíveis (Contas a Receber)
    const upcomingReceivables = await prisma.receivable.findMany({
      where: {
        status: 'PENDING',
        dueDate: {
          gte: new Date(),
          lte: addDays(new Date(), daysBeforeDue + 7),
        },
      },
    });

    for (const receivable of upcomingReceivables) {
      const reminderDate = addDays(receivable.dueDate, -daysBeforeDue);

      const existing = await prisma.paymentReminder.findFirst({
        where: {
          referenceType: 'RECEIVABLE',
          referenceId: receivable.id,
          isCompleted: false,
        },
      });

      if (!existing && reminderDate >= new Date()) {
        const reminder = await prisma.paymentReminder.create({
          data: {
            reminderType: 'RECEIVABLE_DUE',
            referenceType: 'RECEIVABLE',
            referenceId: receivable.id,
            dueDate: receivable.dueDate,
            amount: receivable.amount,
            description: `Recebimento: ${receivable.description}`,
            daysBeforeDue,
            reminderDate,
          },
        });
        createdReminders.push(reminder);
      }
    }

    return NextResponse.json({
      success: true,
      remindersCreated: createdReminders.length,
      reminders: createdReminders,
    });
  } catch (error: any) {
    console.error('Erro ao gerar lembretes:', error);
    return NextResponse.json(
      { error: 'Erro ao gerar lembretes: ' + error.message },
      { status: 500 }
    );
  }
}
