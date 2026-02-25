/**
 * Script automático para atualizar status de boletos vencidos
 * Deve ser executado diariamente às 00:00 (horário de Brasília)
 * 
 * Funcionalidades:
 * - Atualiza boletos PENDING → OVERDUE quando dueDate < hoje
 * - Registra logs detalhados de cada atualização
 * - Envia notificações para clientes (opcional)
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Calcula o início do dia atual em horário de Brasília (UTC-3)
 * Retorna a data em UTC equivalente a 00:00 de Brasília
 */
function getBrasiliaToday(): Date {
  const now = new Date();
  // Brasília está em UTC-3
  const brasiliaTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
  
  // Obtém ano, mês e dia em horário de Brasília
  const year = brasiliaTime.getUTCFullYear();
  const month = brasiliaTime.getUTCMonth();
  const day = brasiliaTime.getUTCDate();
  
  // Retorna 00:00 do dia atual em Brasília (convertido para UTC)
  return new Date(Date.UTC(year, month, day, 3, 0, 0, 0));
}

async function updateOverdueBoletos() {
  console.log('🔄 [UPDATE_OVERDUE_BOLETOS] Iniciando atualização de boletos vencidos...');
  console.log(`📅 Data/hora de execução: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);

  try {
    const brasiliaToday = getBrasiliaToday();
    console.log(`📍 [UPDATE_OVERDUE_BOLETOS] Referência (00:00 Brasília em UTC): ${brasiliaToday.toISOString()}`);

    // Buscar todos os boletos pendentes com vencimento anterior a hoje
    const overdueBoletos = await prisma.boleto.findMany({
      where: {
        status: 'PENDING',
        dueDate: {
          lt: brasiliaToday // Vencimento ANTERIOR ao início de hoje
        }
      },
      include: {
        Customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        Order: {
          select: {
            id: true,
            orderNumber: true,
            total: true
          }
        }
      }
    });

    console.log(`📊 [UPDATE_OVERDUE_BOLETOS] Boletos encontrados para atualizar: ${overdueBoletos.length}`);

    if (overdueBoletos.length === 0) {
      console.log('✅ [UPDATE_OVERDUE_BOLETOS] Nenhum boleto vencido encontrado. Sistema está em dia!');
      return {
        success: true,
        updated: 0,
        message: 'Nenhum boleto vencido encontrado'
      };
    }

    // Atualizar status de cada boleto
    const updatePromises = overdueBoletos.map(async (boleto) => {
      const diasAtraso = Math.floor(
        (brasiliaToday.getTime() - boleto.dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      console.log(`⚠️ [UPDATE_OVERDUE_BOLETOS] Atualizando boleto:`);
      console.log(`   ID: ${boleto.id}`);
      console.log(`   Cliente: ${boleto.Customer?.name || 'N/A'}`);
      console.log(`   Pedido: ${boleto.Order?.orderNumber || 'N/A'}`);
      console.log(`   Valor: R$ ${boleto.amount}`);
      console.log(`   Vencimento: ${boleto.dueDate.toLocaleDateString('pt-BR')}`);
      console.log(`   Dias de atraso: ${diasAtraso}`);

      try {
        await prisma.boleto.update({
          where: { id: boleto.id },
          data: {
            status: 'OVERDUE',
            updatedAt: new Date()
          }
        });

        console.log(`   ✅ Status atualizado para OVERDUE`);

        // TODO: Enviar notificação para o cliente
        // await sendOverdueNotification(boleto);

        return {
          success: true,
          boletoId: boleto.id,
          customerName: boleto.Customer?.name,
          orderNumber: boleto.Order?.orderNumber,
          diasAtraso
        };
      } catch (error) {
        console.error(`   ❌ Erro ao atualizar boleto ${boleto.id}:`, error);
        return {
          success: false,
          boletoId: boleto.id,
          error: (error as Error).message
        };
      }
    });

    const results = await Promise.all(updatePromises);
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log('\n📈 [UPDATE_OVERDUE_BOLETOS] Resumo da execução:');
    console.log(`   ✅ Atualizados com sucesso: ${successCount}`);
    console.log(`   ❌ Falhas: ${failureCount}`);
    console.log(`   📊 Total processado: ${overdueBoletos.length}`);

    if (failureCount > 0) {
      console.log('\n⚠️ [UPDATE_OVERDUE_BOLETOS] Boletos com falha:');
      results
        .filter(r => !r.success)
        .forEach(r => console.log(`   - Boleto ${r.boletoId}: ${r.error}`));
    }

    return {
      success: true,
      updated: successCount,
      failed: failureCount,
      total: overdueBoletos.length,
      details: results
    };

  } catch (error) {
    console.error('❌ [UPDATE_OVERDUE_BOLETOS] Erro crítico na execução:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Execução direta (quando rodado como script standalone)
if (require.main === module) {
  updateOverdueBoletos()
    .then((result) => {
      console.log('\n✅ [UPDATE_OVERDUE_BOLETOS] Execução concluída com sucesso!');
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ [UPDATE_OVERDUE_BOLETOS] Execução falhou:', error);
      process.exit(1);
    });
}

export { updateOverdueBoletos };
