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

    if (!isTwilioConfigured()) {
      return NextResponse.json(
        { error: 'Twilio não está configurado' },
        { status: 400 }
      );
    }

    console.log('\n' + '='.repeat(60));
    console.log('[PREVIEW] Gerando prévia de lembretes');
    console.log('='.repeat(60));

    const boletosToday = [];
    const boletosOverdue = [];
    const orderReminders = [];

    // 1. Boletos vencendo HOJE
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const todayBoletos = await prisma.boleto.findMany({
      where: {
        status: 'PENDING',
        dueDate: {
          gte: startOfDay,
          lte: endOfDay
        },
        Customer: {
          phone: { not: '' }
        }
      },
      include: { Customer: true }
    });

    for (const boleto of todayBoletos) {
      if (!boleto.Customer.phone) continue;

      const dueDateStr = boleto.dueDate.toLocaleDateString('pt-BR');
      const amountStr = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(Number(boleto.amount));

      const message = `🔔 *Lembrete de Pagamento*\n\n` +
        `Olá ${boleto.Customer.name}! \n\n` +
        `Seu boleto no valor de *${amountStr}* vence em *${dueDateStr}*.\n\n` +
        `Por favor, realize o pagamento para evitar atrasos.\n\n` +
        `Qualquer dúvida, estamos à disposição! 😊`;

      boletosToday.push({
        customer: boleto.Customer.name,
        phone: boleto.Customer.phone,
        amount: amountStr,
        dueDate: dueDateStr,
        message
      });
    }

    // 2. Boletos vencidos (últimos 7 dias)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);

    const overdueBoletos = await prisma.boleto.findMany({
      where: {
        status: 'OVERDUE',
        dueDate: {
          gte: sevenDaysAgo,
          lt: startOfDay
        },
        Customer: {
          phone: { not: '' }
        }
      },
      include: { Customer: true }
    });

    for (const boleto of overdueBoletos) {
      if (!boleto.Customer.phone) continue;

      const dueDateStr = boleto.dueDate.toLocaleDateString('pt-BR');
      const amountStr = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(Number(boleto.amount));

      const message = `⚠️ *Boleto Vencido*\n\n` +
        `Olá ${boleto.Customer.name}! \n\n` +
        `Identificamos que seu boleto no valor de *${amountStr}* com vencimento em *${dueDateStr}* está em atraso.\n\n` +
        `Por favor, regularize o pagamento o quanto antes para evitar bloqueios.\n\n` +
        `Estamos à disposição para qualquer esclarecimento! 📞`;

      boletosOverdue.push({
        customer: boleto.Customer.name,
        phone: boleto.Customer.phone,
        amount: amountStr,
        dueDate: dueDateStr,
        message
      });
    }

    // 3. Lembretes de Pedidos (baseados no padrão)
    const customers = await prisma.customer.findMany({
      where: {
        isActive: true,
        phone: { not: '' },
        OR: [
          {
            Order: {
              some: {
                status: 'DELIVERED'
              }
            }
          },
          {
            whatsappConfig: {
              isNot: null
            }
          }
        ]
      },
      include: {
        Order: {
          where: { status: 'DELIVERED' },
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        whatsappConfig: true
      }
    });

    for (const customer of customers) {
      const orders = customer.Order;
      const config = customer.whatsappConfig;

      // Se tem configuração personalizada
      if (config && config.isActive) {
        let avgInterval = config.customIntervalDays || 7;
        let daysSinceLastOrder = 0;

        if (config.lastReminderSent) {
          daysSinceLastOrder = Math.floor(
            (Date.now() - config.lastReminderSent.getTime()) / (1000 * 60 * 60 * 24)
          );
        } else if (orders.length > 0) {
          daysSinceLastOrder = Math.floor(
            (Date.now() - orders[0].createdAt.getTime()) / (1000 * 60 * 60 * 24)
          );
        }

        // Se não tem customIntervalDays, tenta calcular baseado no histórico
        if (!config.customIntervalDays && orders.length >= 2) {
          const intervals = [];
          for (let i = 0; i < orders.length - 1; i++) {
            const daysBetween = Math.floor(
              (orders[i].createdAt.getTime() - orders[i + 1].createdAt.getTime()) /
              (1000 * 60 * 60 * 24)
            );
            if (daysBetween > 0) intervals.push(daysBetween);
          }
          if (intervals.length > 0) {
            avgInterval = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);
          }
        }

        // Determina a frequência
        let frequency: string;
        if (avgInterval <= 2) {
          frequency = 'DIÁRIO';
        } else if (avgInterval <= 9) {
          frequency = 'SEMANAL';
        } else if (avgInterval <= 18) {
          frequency = 'QUINZENAL';
        } else if (avgInterval <= 35) {
          frequency = 'MENSAL';
        } else {
          frequency = 'INATIVO';
        }

        // Envia lembrete quando atinge 90% do intervalo
        if (daysSinceLastOrder >= avgInterval * 0.9) {
          let message = `👋 *Olá ${customer.name}!*\n\n`;
          if (orders.length > 0) {
            message += `Já faz ${daysSinceLastOrder} dias desde seu último pedido! 😊\n\n`;
          }
          message += `Que tal fazer um novo pedido hoje? \n` +
            `Estamos com produtos fresquinhos esperando por você! 🍖\n\n` +
            `Qualquer dúvida, é só chamar! 📱`;

          if (config.customMessage) {
            message = config.customMessage;
          }

          orderReminders.push({
            customer: customer.name,
            phone: customer.phone,
            frequency,
            days: daysSinceLastOrder,
            interval: Math.round(avgInterval),
            message
          });
        }
        continue;
      }

      // Sem configuração personalizada - usa a lógica padrão
      if (orders.length < 2) continue;

      const intervals = [];
      for (let i = 0; i < orders.length - 1; i++) {
        const daysBetween = Math.floor(
          (orders[i].createdAt.getTime() - orders[i + 1].createdAt.getTime()) /
          (1000 * 60 * 60 * 24)
        );
        if (daysBetween > 0) intervals.push(daysBetween);
      }

      if (intervals.length === 0) continue;

      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const lastOrder = orders[0];
      const daysSinceLastOrder = Math.floor(
        (Date.now() - lastOrder.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Determina o padrão de compra
      let frequency: string;
      if (avgInterval <= 2) {
        frequency = 'DIÁRIO';
      } else if (avgInterval <= 9) {
        frequency = 'SEMANAL';
      } else if (avgInterval <= 18) {
        frequency = 'QUINZENAL';
      } else if (avgInterval <= 35) {
        frequency = 'MENSAL';
      } else {
        frequency = 'INATIVO';
      }

      // Envia lembrete quando atinge 90% do intervalo médio
      if (daysSinceLastOrder >= avgInterval * 0.9) {
        let message = `👋 *Olá ${customer.name}!*\n\n`;
        message += `Já faz ${daysSinceLastOrder} dias desde seu último pedido! 😊\n\n`;
        message += `Que tal fazer um novo pedido hoje? \n` +
          `Estamos com produtos fresquinhos esperando por você! 🍖\n\n` +
          `Qualquer dúvida, é só chamar! 📱`;

        orderReminders.push({
          customer: customer.name,
          phone: customer.phone,
          frequency,
          days: daysSinceLastOrder,
          interval: Math.round(avgInterval),
          message
        });
      }
    }

    console.log('[PREVIEW] 💰 Boletos vencendo HOJE:', boletosToday.length);
    console.log('[PREVIEW] ⚠️  Boletos vencidos:', boletosOverdue.length);
    console.log('[PREVIEW] 📦 Lembretes de pedidos:', orderReminders.length);
    console.log('='.repeat(60) + '\n');

    return NextResponse.json({
      boletosToday,
      boletosOverdue,
      orderReminders,
      total: boletosToday.length + boletosOverdue.length + orderReminders.length
    });
  } catch (error) {
    console.error('[PREVIEW] Erro ao gerar prévia:', error);
    return NextResponse.json(
      { error: 'Erro ao gerar prévia' },
      { status: 500 }
    );
  }
}
