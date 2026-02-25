export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    console.log('[CUSTOMER_PATTERNS] Analisando padrões de compra...');

    // Busca clientes ativos com telefone e pelo menos 2 pedidos entregues
    // OU clientes com configuração personalizada de WhatsApp
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
          where: {
            status: 'DELIVERED'
          },
          orderBy: {
            createdAt: 'desc'
          },
          select: {
            id: true,
            createdAt: true
          }
        },
        whatsappConfig: true
      }
    });

    console.log(`[CUSTOMER_PATTERNS] Encontrados ${customers.length} clientes com pedidos`);

    const patterns = [];

    for (const customer of customers) {
      const orders = customer.Order;
      const config = customer.whatsappConfig;

      // Se tem configuração personalizada, use ela
      if (config) {
        // Pula se configuração está desativada
        if (!config.isActive) continue;

        let avgDaysBetweenOrders = config.customIntervalDays || 7; // Padrão de 7 dias
        let lastOrder = orders.length > 0 ? orders[0] : null;
        let daysSinceLastOrder = 0;

        // Calcula dias desde o último pedido ou desde a última mensagem enviada
        if (config.lastReminderSent) {
          daysSinceLastOrder = Math.floor(
            (Date.now() - config.lastReminderSent.getTime()) / (1000 * 60 * 60 * 24)
          );
        } else if (lastOrder) {
          daysSinceLastOrder = Math.floor(
            (Date.now() - lastOrder.createdAt.getTime()) / (1000 * 60 * 60 * 24)
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
            if (daysBetween > 0) {
              intervals.push(daysBetween);
            }
          }
          if (intervals.length > 0) {
            avgDaysBetweenOrders = Math.round(
              intervals.reduce((a, b) => a + b, 0) / intervals.length
            );
          }
        }

        // Determina a frequência
        let frequency: 'diario' | 'semanal' | 'quinzenal' | 'mensal' | 'inativo' | 'personalizado' = 'personalizado';
        if (config.customIntervalDays) {
          if (config.customIntervalDays <= 2) frequency = 'diario';
          else if (config.customIntervalDays <= 9) frequency = 'semanal';
          else if (config.customIntervalDays <= 18) frequency = 'quinzenal';
          else if (config.customIntervalDays <= 35) frequency = 'mensal';
        } else if (avgDaysBetweenOrders <= 2) {
          frequency = 'diario';
        } else if (avgDaysBetweenOrders <= 9) {
          frequency = 'semanal';
        } else if (avgDaysBetweenOrders <= 18) {
          frequency = 'quinzenal';
        } else if (avgDaysBetweenOrders <= 35) {
          frequency = 'mensal';
        } else {
          frequency = 'inativo';
        }

        // Determina se deve receber lembrete (90% do intervalo)
        const shouldReceiveReminder = daysSinceLastOrder >= avgDaysBetweenOrders * 0.9;

        // Calcula a próxima data de lembrete
        let nextReminderDate = null;
        if (!shouldReceiveReminder) {
          const daysUntilReminder = Math.ceil(avgDaysBetweenOrders * 0.9 - daysSinceLastOrder);
          const nextDate = new Date();
          nextDate.setDate(nextDate.getDate() + daysUntilReminder);
          nextReminderDate = nextDate.toISOString();
        }

        patterns.push({
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          averageDaysBetweenOrders: avgDaysBetweenOrders,
          lastOrderDate: lastOrder?.createdAt.toISOString() || null,
          daysSinceLastOrder,
          totalOrders: orders.length,
          shouldReceiveReminder,
          nextReminderDate,
          frequency,
          hasCustomConfig: true,
          configId: config.id,
          customMessage: config.customMessage,
          totalRemindersSent: config.totalRemindersSent
        });
        continue;
      }

      // Sem configuração personalizada - usa a lógica antiga
      // Precisa de pelo menos 2 pedidos para identificar padrão
      if (orders.length < 2) continue;

      // Calcula os intervalos entre pedidos
      const intervals = [];
      for (let i = 0; i < orders.length - 1; i++) {
        const daysBetween = Math.floor(
          (orders[i].createdAt.getTime() - orders[i + 1].createdAt.getTime()) /
          (1000 * 60 * 60 * 24)
        );
        if (daysBetween > 0) {
          intervals.push(daysBetween);
        }
      }

      if (intervals.length === 0) continue;

      // Calcula a média de dias entre pedidos
      const avgDaysBetweenOrders = Math.round(
        intervals.reduce((a, b) => a + b, 0) / intervals.length
      );

      const lastOrder = orders[0];
      const daysSinceLastOrder = Math.floor(
        (Date.now() - lastOrder.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Determina a frequência
      let frequency: 'diario' | 'semanal' | 'quinzenal' | 'mensal' | 'inativo';
      if (avgDaysBetweenOrders <= 2) {
        frequency = 'diario';
      } else if (avgDaysBetweenOrders <= 9) {
        frequency = 'semanal';
      } else if (avgDaysBetweenOrders <= 18) {
        frequency = 'quinzenal';
      } else if (avgDaysBetweenOrders <= 35) {
        frequency = 'mensal';
      } else {
        frequency = 'inativo';
      }

      // Determina se deve receber lembrete
      // Envia quando passou 90% do intervalo médio
      const shouldReceiveReminder = daysSinceLastOrder >= avgDaysBetweenOrders * 0.9;

      // Calcula a próxima data de lembrete
      let nextReminderDate = null;
      if (!shouldReceiveReminder) {
        const daysUntilReminder = Math.ceil(avgDaysBetweenOrders * 0.9 - daysSinceLastOrder);
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + daysUntilReminder);
        nextReminderDate = nextDate.toISOString();
      }

      patterns.push({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        averageDaysBetweenOrders: avgDaysBetweenOrders,
        lastOrderDate: lastOrder.createdAt.toISOString(),
        daysSinceLastOrder,
        totalOrders: orders.length,
        shouldReceiveReminder,
        nextReminderDate,
        frequency,
        hasCustomConfig: false,
        configId: null,
        customMessage: null,
        totalRemindersSent: 0
      });
    }

    // Ordena por clientes que devem receber lembrete primeiro
    patterns.sort((a, b) => {
      if (a.shouldReceiveReminder && !b.shouldReceiveReminder) return -1;
      if (!a.shouldReceiveReminder && b.shouldReceiveReminder) return 1;
      return b.daysSinceLastOrder - a.daysSinceLastOrder;
    });

    console.log(`[CUSTOMER_PATTERNS] Identificados ${patterns.length} clientes com padrão`);
    console.log(`[CUSTOMER_PATTERNS] ${patterns.filter(p => p.shouldReceiveReminder).length} devem receber lembrete`);

    return NextResponse.json({
      customers: patterns,
      summary: {
        total: patterns.length,
        shouldReceiveReminder: patterns.filter(p => p.shouldReceiveReminder).length,
        byFrequency: {
          diario: patterns.filter(p => p.frequency === 'diario').length,
          semanal: patterns.filter(p => p.frequency === 'semanal').length,
          quinzenal: patterns.filter(p => p.frequency === 'quinzenal').length,
          mensal: patterns.filter(p => p.frequency === 'mensal').length,
          inativo: patterns.filter(p => p.frequency === 'inativo').length
        }
      }
    });
  } catch (error) {
    console.error('[CUSTOMER_PATTERNS] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao analisar padrões de compra' },
      { status: 500 }
    );
  }
}
