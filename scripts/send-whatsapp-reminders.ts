/**
 * Script para envio automático de lembretes via WhatsApp
 * Executa diariamente às 09:00 (horário de Brasília)
 * 
 * Envia:
 * 1. Lembretes de boletos que vencem no dia (somente no dia do vencimento)
 * 2. Lembretes de boletos vencidos há até 7 dias
 * 3. Lembretes PERSONALIZADOS baseados no padrão de compra de cada cliente
 */

import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import {
  sendBoletoReminder,
  sendOverdueBoletoNotification,
  sendWhatsAppMessage,
  isTwilioConfigured
} from '../lib/whatsapp';

const prisma = new PrismaClient();

/**
 * Envia lembretes de boletos - SOMENTE NO DIA DO VENCIMENTO
 */
async function sendBoletoReminders() {
  console.log('\n💰 [BOLETOS] Verificando boletos...');

  const now = new Date();
  // Define o início e fim do dia de hoje
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(now.getDate() - 7);

  // Boletos que vencem HOJE (no dia do vencimento)
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

  console.log(`⏳ Encontrados ${todayBoletos.length} boletos vencendo HOJE`);

  let sent = 0;
  for (const boleto of todayBoletos) {
    if (!boleto.Customer.phone) continue;

    const result = await sendBoletoReminder(
      boleto.Customer.name,
      boleto.Customer.phone,
      boleto.amount,
      boleto.dueDate
    );

    if (result.success) {
      sent++;
      console.log(`  ✅ ${boleto.Customer.name} - R$ ${boleto.amount}`);
    } else {
      console.error(`  ❌ ${boleto.Customer.name} - Erro: ${result.error}`);
    }

    // Pequeno delay para não sobrecarregar a API
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Boletos vencidos
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

  console.log(`\n⚠️  Encontrados ${overdueBoletos.length} boletos vencidos`);

  let sentOverdue = 0;
  for (const boleto of overdueBoletos) {
    if (!boleto.Customer.phone) continue;

    const result = await sendOverdueBoletoNotification(
      boleto.Customer.name,
      boleto.Customer.phone,
      boleto.amount,
      boleto.dueDate
    );

    if (result.success) {
      sentOverdue++;
      console.log(`  ✅ ${boleto.Customer.name} - R$ ${boleto.amount}`);
    } else {
      console.error(`  ❌ ${boleto.Customer.name} - Erro: ${result.error}`);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return { today: sent, overdue: sentOverdue };
}

/**
 * Envia lembretes PERSONALIZADOS baseados no padrão de compra de cada cliente
 * 
 * Análise inteligente:
 * - Calcula a média de dias entre pedidos de cada cliente
 * - Identifica o padrão: diário, semanal, quinzenal, mensal
 * - Envia lembrete quando atinge 90% do intervalo médio
 * - Mensagem personalizada de acordo com a frequência
 * - ATUALIZA o banco de dados com a data de envio
 */
async function sendSmartOrderReminders() {
  console.log('\n📦 [PEDIDOS INTELIGENTES] Analisando padrões de compra...');

  // Busca clientes ativos com telefone e pedidos OU com configuração personalizada
  const customers = await prisma.customer.findMany({
    where: {
      phone: { not: '' },
      isActive: true,
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
        take: 10 // Analisa os últimos 10 pedidos
      },
      whatsappConfig: true
    }
  });

  console.log(`📊 Total de clientes analisados: ${customers.length}`);

  let sent = 0;
  const patterns: Record<string, number> = {
    diario: 0,
    semanal: 0,
    quinzenal: 0,
    mensal: 0,
    inativo: 0,
    personalizado: 0
  };

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

      // Determina o padrão
      let frequency: keyof typeof patterns;
      if (avgInterval <= 2) {
        frequency = 'diario';
      } else if (avgInterval <= 9) {
        frequency = 'semanal';
      } else if (avgInterval <= 18) {
        frequency = 'quinzenal';
      } else if (avgInterval <= 35) {
        frequency = 'mensal';
      } else {
        frequency = 'inativo';
      }

      patterns[frequency]++;

      // Envia lembrete quando atinge 90% do intervalo
      const threshold = avgInterval * 0.9;
      
      if (daysSinceLastOrder >= threshold) {
        // Usa mensagem personalizada ou gera automaticamente
        let message = '';

        if (config.customMessage) {
          // Substitui variáveis na mensagem personalizada
          message = config.customMessage
            .replace('{nome}', customer.name)
            .replace('{dias}', daysSinceLastOrder.toString());
        } else {
          // Gera mensagem baseada na frequência
          if (avgInterval <= 2) {
            message = `👋 Olá ${customer.name}!\n\n` +
              `Percebemos que você costuma fazer seus pedidos *diariamente* e já faz ${daysSinceLastOrder} dias desde o último! 😊\n\n` +
              `Que tal garantir seus produtos fresquinhos hoje? 🍖\n\n` +
              `Estamos à disposição! 📱`;
          } else if (avgInterval <= 4) {
            message = `👋 Olá ${customer.name}!\n\n` +
              `Você costuma fazer pedidos a cada *${Math.round(avgInterval)} dias* e já faz ${daysSinceLastOrder} dias! 😊\n\n` +
              `Hora de renovar o estoque? Temos tudo fresquinho esperando por você! 🍖\n\n` +
              `Qualquer dúvida, é só chamar! 📱`;
          } else if (avgInterval <= 9) {
            message = `👋 Olá ${customer.name}!\n\n` +
              `Já é hora do seu pedido *semanal*! 📅\n\n` +
              `Faz ${daysSinceLastOrder} dias desde o último pedido. Que tal garantir produtos frescos para a semana? 🍖\n\n` +
              `Estamos aqui para atender você! 😊`;
          } else if (avgInterval <= 18) {
            message = `👋 Olá ${customer.name}!\n\n` +
              `Já passou o período do seu pedido *quinzenal*! 📅\n\n` +
              `Faz ${daysSinceLastOrder} dias desde o último. Vamos repor o estoque? 🍖\n\n` +
              `Qualquer dúvida, estamos à disposição! 📱`;
          } else if (avgInterval <= 35) {
            message = `👋 Olá ${customer.name}!\n\n` +
              `Está na hora do seu pedido *mensal*! 📅\n\n` +
              `Já faz ${daysSinceLastOrder} dias desde o último. Que tal fazer um novo pedido? 🍖\n\n` +
              `Temos produtos fresquinhos esperando! 😊`;
          } else {
            message = `👋 Olá ${customer.name}!\n\n` +
              `Sentimos sua falta! Já faz *${daysSinceLastOrder} dias* desde seu último pedido. 😊\n\n` +
              `Que tal voltar e conhecer nossos produtos fresquinhos? 🍖\n\n` +
              `Estamos aqui para atender! 📱`;
          }
        }

        const result = await sendWhatsAppMessage(customer.phone!, message);

        if (result.success) {
          sent++;
          console.log(
            `  ✅ ${customer.name} - Padrão: ${frequency.toUpperCase()} ` +
            `(${Math.round(avgInterval)} dias) - ${daysSinceLastOrder} dias sem pedir [CONFIG PERSONALIZADA]`
          );

          // ATUALIZA O BANCO DE DADOS com a data de envio
          await prisma.whatsAppConfig.update({
            where: { id: config.id },
            data: {
              lastReminderSent: new Date(),
              totalRemindersSent: config.totalRemindersSent + 1
            }
          });
        } else {
          console.error(`  ❌ ${customer.name} - Erro: ${result.error}`);
        }

        // Delay entre envios
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      continue;
    }

    // Sem configuração personalizada - usa lógica padrão
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
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    
    const lastOrder = orders[0];
    const daysSinceLastOrder = Math.floor(
      (Date.now() - lastOrder.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Determina o padrão de compra
    let frequency: keyof typeof patterns;
    if (avgInterval <= 2) {
      frequency = 'diario';
    } else if (avgInterval <= 9) {
      frequency = 'semanal';
    } else if (avgInterval <= 18) {
      frequency = 'quinzenal';
    } else if (avgInterval <= 35) {
      frequency = 'mensal';
    } else {
      frequency = 'inativo';
    }

    patterns[frequency]++;

    // Envia lembrete quando atinge 90% do intervalo médio
    const threshold = avgInterval * 0.9;
    
    if (daysSinceLastOrder >= threshold) {
      // Mensagem personalizada baseada na frequência
      let message = '';

      if (avgInterval <= 2) {
        // Cliente compra diariamente
        message = `👋 Olá ${customer.name}!\n\n` +
          `Percebemos que você costuma fazer seus pedidos *diariamente* e já faz ${daysSinceLastOrder} dias desde o último! 😊\n\n` +
          `Que tal garantir seus produtos fresquinhos hoje? 🍖\n\n` +
          `Estamos à disposição! 📱`;
      } else if (avgInterval <= 4) {
        // Cliente compra de 3 em 3 dias
        message = `👋 Olá ${customer.name}!\n\n` +
          `Você costuma fazer pedidos a cada *${Math.round(avgInterval)} dias* e já faz ${daysSinceLastOrder} dias! 😊\n\n` +
          `Hora de renovar o estoque? Temos tudo fresquinho esperando por você! 🍖\n\n` +
          `Qualquer dúvida, é só chamar! 📱`;
      } else if (avgInterval <= 9) {
        // Cliente compra semanalmente
        message = `👋 Olá ${customer.name}!\n\n` +
          `Já é hora do seu pedido *semanal*! 📅\n\n` +
          `Faz ${daysSinceLastOrder} dias desde o último pedido. Que tal garantir produtos frescos para a semana? 🍖\n\n` +
          `Estamos aqui para atender você! 😊`;
      } else if (avgInterval <= 18) {
        // Cliente compra quinzenalmente
        message = `👋 Olá ${customer.name}!\n\n` +
          `Já passou o período do seu pedido *quinzenal*! 📅\n\n` +
          `Faz ${daysSinceLastOrder} dias desde o último. Vamos repor o estoque? 🍖\n\n` +
          `Qualquer dúvida, estamos à disposição! 📱`;
      } else if (avgInterval <= 35) {
        // Cliente compra mensalmente
        message = `👋 Olá ${customer.name}!\n\n` +
          `Está na hora do seu pedido *mensal*! 📅\n\n` +
          `Já faz ${daysSinceLastOrder} dias desde o último. Que tal fazer um novo pedido? 🍖\n\n` +
          `Temos produtos fresquinhos esperando! 😊`;
      } else {
        // Cliente inativo
        message = `👋 Olá ${customer.name}!\n\n` +
          `Sentimos sua falta! Já faz *${daysSinceLastOrder} dias* desde seu último pedido. 😊\n\n` +
          `Que tal voltar e conhecer nossos produtos fresquinhos? 🍖\n\n` +
          `Estamos aqui para atender! 📱`;
      }

      const result = await sendWhatsAppMessage(customer.phone!, message);

      if (result.success) {
        sent++;
        console.log(
          `  ✅ ${customer.name} - Padrão: ${frequency.toUpperCase()} ` +
          `(${Math.round(avgInterval)} dias) - ${daysSinceLastOrder} dias sem pedir`
        );
      } else {
        console.error(`  ❌ ${customer.name} - Erro: ${result.error}`);
      }

      // Delay entre envios
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log('\n📊 Distribuição de Padrões:');
  console.log(`   🟢 Diário: ${patterns.diario} clientes`);
  console.log(`   🔵 Semanal: ${patterns.semanal} clientes`);
  console.log(`   🟡 Quinzenal: ${patterns.quinzenal} clientes`);
  console.log(`   🟠 Mensal: ${patterns.mensal} clientes`);
  console.log(`   ⚫ Inativo: ${patterns.inativo} clientes`);
  console.log(`   🟣 Personalizado: ${patterns.personalizado} clientes`);
  console.log(`\n📤 Total de lembretes enviados: ${sent}`);
  
  return { sent, patterns };
}

/**
 * Função principal
 */
async function main() {
  console.log('\n='.repeat(60));
  console.log('📱 ENVIO AUTOMÁTICO DE LEMBRETES VIA WHATSAPP');
  console.log('='.repeat(60));
  console.log(`🕒 Início: ${new Date().toLocaleString('pt-BR')}`);

  // Verifica se o Twilio está configurado
  if (!isTwilioConfigured()) {
    console.error('\n❌ Erro: Twilio não configurado!');
    console.error('Configure as credenciais do Twilio em /home/ubuntu/.config/abacusai_auth_secrets.json');
    process.exit(1);
  }

  try {
    // 1. Envia lembretes de boletos (SOMENTE no dia do vencimento)
    const boletoResults = await sendBoletoReminders();

    // 2. Envia lembretes INTELIGENTES baseados no padrão de compra
    const smartReminders = await sendSmartOrderReminders();

    // Sumário final
    console.log('\n' + '='.repeat(60));
    console.log('🎉 RESUMO FINAL');
    console.log('='.repeat(60));
    console.log(`💰 Boletos vencendo HOJE: ${boletoResults.today} enviados`);
    console.log(`⚠️  Boletos vencidos: ${boletoResults.overdue} enviados`);
    console.log(`📦 Lembretes de pedidos (inteligentes): ${smartReminders.sent} enviados`);
    console.log(`\n📊 Distribuição de Padrões:`);
    console.log(`   🟢 Diário: ${smartReminders.patterns.diario}`);
    console.log(`   🔵 Semanal: ${smartReminders.patterns.semanal}`);
    console.log(`   🟡 Quinzenal: ${smartReminders.patterns.quinzenal}`);
    console.log(`   🟠 Mensal: ${smartReminders.patterns.mensal}`);
    console.log(`   ⚫ Inativo: ${smartReminders.patterns.inativo}`);
    console.log(`   🟣 Personalizado: ${smartReminders.patterns.personalizado}`);
    console.log(`\n🕒 Término: ${new Date().toLocaleString('pt-BR')}`);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Erro ao executar script:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executa o script
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { main as sendWhatsAppReminders };
