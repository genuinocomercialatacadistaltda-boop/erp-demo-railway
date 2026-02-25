export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import {
  sendBoletoReminder,
  sendOverdueBoletoNotification,
  sendOrderReminder,
  isTwilioConfigured
} from '@/lib/whatsapp';

export async function POST() {
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
    console.log('[WHATSAPP] Iniciando envio de lembretes');
    console.log('='.repeat(60));

    let boletosSent = 0;
    let orderRemindersSent = 0;
    const results = {
      boletosToday: [] as string[],
      boletosOverdue: [] as string[],
      orders: [] as string[]
    };

    // 1. Lembretes de Boletos vencendo HOJE (somente no dia do vencimento)
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

    console.log(`[BOLETOS HOJE] Encontrados ${todayBoletos.length} boletos vencendo HOJE`);

    for (const boleto of todayBoletos) {
      if (!boleto.Customer.phone) continue;

      const result = await sendBoletoReminder(
        boleto.Customer.name,
        boleto.Customer.phone,
        Number(boleto.amount),
        boleto.dueDate
      );

      if (result.success) {
        boletosSent++;
        results.boletosToday.push(boleto.Customer.name);
        console.log(`  ✅ ${boleto.Customer.name} - R$ ${boleto.amount}`);
      } else {
        console.log(`  ❌ ${boleto.Customer.name} - Erro: ${result.error}`);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 2. Lembretes de Boletos vencidos (últimos 7 dias)
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

    console.log(`[BOLETOS VENCIDOS] Encontrados ${overdueBoletos.length} boletos vencidos`);

    for (const boleto of overdueBoletos) {
      if (!boleto.Customer.phone) continue;

      const result = await sendOverdueBoletoNotification(
        boleto.Customer.name,
        boleto.Customer.phone,
        Number(boleto.amount),
        boleto.dueDate
      );

      if (result.success) {
        boletosSent++;
        results.boletosOverdue.push(boleto.Customer.name);
        console.log(`  ✅ ${boleto.Customer.name} - R$ ${boleto.amount}`);
      } else {
        console.log(`  ❌ ${boleto.Customer.name} - Erro: ${result.error}`);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 3. Lembretes INTELIGENTES de Pedidos (baseados no padrão de compras)
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

    console.log(`[PEDIDOS INTELIGENTES] Analisando ${customers.length} clientes...`);

    for (const customer of customers) {
      const orders = customer.Order;
      const config = customer.whatsappConfig;

      // Se tem configuração personalizada, use ela
      if (config && config.isActive) {
        let avgInterval = config.customIntervalDays || 7;
        let daysSinceLastOrder = 0;

        // Calcula dias desde a última mensagem enviada ou último pedido
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
          // Usa mensagem personalizada se existir
          let result;
          if (config.customMessage) {
            result = await sendOrderReminder(
              customer.name,
              customer.phone!,
              orders.length > 0 ? orders[0].createdAt : undefined
            );
          } else {
            result = await sendOrderReminder(
              customer.name,
              customer.phone!,
              orders.length > 0 ? orders[0].createdAt : undefined
            );
          }

          if (result.success) {
            orderRemindersSent++;
            results.orders.push(`${customer.name} (${frequency} - Personalizado)`);
            console.log(`  ✅ ${customer.name} - ${frequency} (${Math.round(avgInterval)} dias) [Config Personalizada]`);

            // ATUALIZA O BANCO DE DADOS com a data de envio
            await prisma.whatsAppConfig.update({
              where: { id: config.id },
              data: {
                lastReminderSent: new Date(),
                totalRemindersSent: config.totalRemindersSent + 1
              }
            });
          } else {
            console.log(`  ❌ ${customer.name} - Erro: ${result.error}`);
          }

          await new Promise(resolve => setTimeout(resolve, 1000));
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
        const result = await sendOrderReminder(
          customer.name,
          customer.phone!,
          lastOrder.createdAt
        );

        if (result.success) {
          orderRemindersSent++;
          results.orders.push(`${customer.name} (${frequency})`);
          console.log(`  ✅ ${customer.name} - ${frequency} (${Math.round(avgInterval)} dias)`);
        } else {
          console.log(`  ❌ ${customer.name} - Erro: ${result.error}`);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('[WHATSAPP] Resumo Final');
    console.log('='.repeat(60));
    console.log(`💰 Boletos vencendo HOJE: ${results.boletosToday.length}`);
    console.log(`⚠️  Boletos vencidos: ${results.boletosOverdue.length}`);
    console.log(`📦 Lembretes de pedidos: ${results.orders.length}`);
    console.log(`📊 Total: ${boletosSent + orderRemindersSent} mensagens enviadas`);
    console.log('='.repeat(60) + '\n');

    return NextResponse.json({
      success: true,
      boletosSent,
      orderRemindersSent,
      total: boletosSent + orderRemindersSent,
      details: results
    });
  } catch (error) {
    console.error('[WHATSAPP] Erro ao enviar lembretes:', error);
    return NextResponse.json(
      { error: 'Erro ao enviar lembretes' },
      { status: 500 }
    );
  }
}
