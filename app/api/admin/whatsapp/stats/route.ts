export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { isTwilioConfigured } from '@/lib/whatsapp';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Verifica se Twilio está configurado
    const twilioConfigured = isTwilioConfigured();

    // Total de clientes ativos com telefone
    const totalCustomers = await prisma.customer.count({
      where: {
        isActive: true,
        phone: { not: '' }
      }
    });

    // Clientes que têm pelo menos 2 pedidos (para identificar padrão)
    const customersWithPattern = await prisma.customer.count({
      where: {
        isActive: true,
        phone: { not: '' },
        Order: {
          some: {}
        }
      }
    });

    // Contagem de mensagens pendentes (boletos + clientes inativos)
    const now = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(now.getDate() + 3);

    const pendingBoletos = await prisma.boleto.count({
      where: {
        status: 'PENDING',
        dueDate: {
          gte: now,
          lte: threeDaysFromNow
        },
        Customer: {
          phone: { not: '' }
        }
      }
    });

    // Clientes que precisam de lembrete baseado no padrão
    const customersNeedingReminder = await getCustomersNeedingReminder();

    const pendingReminders = pendingBoletos + customersNeedingReminder.length;

    // TODO: Implementar contagem de mensagens enviadas
    // Por enquanto, retorna 0
    const sentToday = 0;
    const sentThisWeek = 0;

    return NextResponse.json({
      twilioConfigured,
      totalCustomers,
      customersWithPattern,
      pendingReminders,
      sentToday,
      sentThisWeek
    });
  } catch (error) {
    console.error('[WHATSAPP_STATS] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar estatísticas' },
      { status: 500 }
    );
  }
}

/**
 * Identifica clientes que precisam receber lembrete baseado no padrão de compras
 */
async function getCustomersNeedingReminder() {
  const customers = await prisma.customer.findMany({
    where: {
      isActive: true,
      phone: { not: '' }
    },
    include: {
      Order: {
        where: { status: 'DELIVERED' },
        orderBy: { createdAt: 'desc' },
        take: 10
      }
    }
  });

  const customersNeedingReminder = [];

  for (const customer of customers) {
    if (customer.Order.length < 2) continue;

    const orders = customer.Order;
    const intervals = [];

    for (let i = 0; i < orders.length - 1; i++) {
      const daysBetween = Math.floor(
        (orders[i].createdAt.getTime() - orders[i + 1].createdAt.getTime()) /
        (1000 * 60 * 60 * 24)
      );
      intervals.push(daysBetween);
    }

    if (intervals.length === 0) continue;

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const lastOrder = orders[0];
    const daysSinceLastOrder = Math.floor(
      (Date.now() - lastOrder.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Cliente deve receber lembrete se está próximo ou passou do intervalo médio
    if (daysSinceLastOrder >= avgInterval * 0.9) {
      customersNeedingReminder.push(customer.id);
    }
  }

  return customersNeedingReminder;
}
