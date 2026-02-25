
import { prisma } from '@/lib/db';

/**
 * Processa bônus de indicação quando um cliente faz sua primeira compra
 * 
 * Sistema Novo:
 * - Indicador ganha 10.000 pontos
 * - Indicado ganha 5.000 pontos
 * - Só na PRIMEIRA compra do indicado
 */
export async function processReferralBonus(customerId: string, orderId: string, orderAmount: number) {
  try {
    console.log(`\n🎁 [REFERRAL] Verificando bônus de indicação para cliente ${customerId}...`);
    
    // Buscar o cliente indicado
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        ReferredByCustomer: true
      }
    });

    if (!customer) {
      console.log(`❌ [REFERRAL] Cliente não encontrado`);
      return null;
    }

    // Verificar se tem indicador
    if (!customer.referredBy) {
      console.log(`ℹ️ [REFERRAL] Cliente não foi indicado por ninguém`);
      return null;
    }

    // Verificar se já recebeu o bônus
    if (customer.referralBonusReceived) {
      console.log(`ℹ️ [REFERRAL] Cliente já recebeu o bônus de primeira compra`);
      return null;
    }

    // Verificar se esta é realmente a primeira compra ENTREGUE
    const previousOrders = await prisma.order.findMany({
      where: {
        customerId,
        status: 'DELIVERED',
        id: {
          not: orderId,
        },
      },
    });

    if (previousOrders.length > 0) {
      console.log(`ℹ️ [REFERRAL] Cliente já tem ${previousOrders.length} pedido(s) anteriores entregues`);
      return null;
    }

    console.log(`✅ [REFERRAL] Esta é a PRIMEIRA compra do cliente!`);
    console.log(`👤 [REFERRAL] Indicador: ${customer.ReferredByCustomer?.name} (ID: ${customer.referredBy})`);

    // Pontos fixos: 10 mil para indicador, 5 mil para indicado
    const BONUS_INDICADOR = 10000;
    const BONUS_INDICADO = 5000;

    // Executar em transação
    await prisma.$transaction(async (tx) => {
      // 1. Dar pontos ao INDICADOR (quem indicou)
      await tx.pointTransaction.create({
        data: {
          customerId: customer.referredBy!,
          type: 'REFERRAL_BONUS',
          points: BONUS_INDICADOR,
          orderId,
          orderAmount,
          description: `Bônus por indicação - ${customer.name} fez primeira compra`,
          reason: `${customer.ReferredByCustomer?.name} indicou ${customer.name} que completou sua primeira compra`
        }
      });

      await tx.customer.update({
        where: { id: customer.referredBy! },
        data: {
          pointsBalance: {
            increment: BONUS_INDICADOR
          },
          totalPointsEarned: {
            increment: BONUS_INDICADOR
          }
        }
      });

      // 2. Dar pontos ao INDICADO (quem foi indicado)
      await tx.pointTransaction.create({
        data: {
          customerId: customer.id,
          type: 'REFERRAL_BONUS',
          points: BONUS_INDICADO,
          orderId,
          orderAmount,
          description: 'Bônus de boas-vindas por ter sido indicado',
          reason: `Primeira compra completada - Você foi indicado por ${customer.ReferredByCustomer?.name}`
        }
      });

      await tx.customer.update({
        where: { id: customer.id },
        data: {
          pointsBalance: {
            increment: BONUS_INDICADO
          },
          totalPointsEarned: {
            increment: BONUS_INDICADO
          },
          referralBonusReceived: true  // Marcar como já recebido
        }
      });

      console.log(`✅ [REFERRAL] ${customer.ReferredByCustomer?.name} ganhou ${BONUS_INDICADOR.toLocaleString()} pontos`);
      console.log(`✅ [REFERRAL] ${customer.name} ganhou ${BONUS_INDICADO.toLocaleString()} pontos`);
    });

    return {
      success: true,
      referrerId: customer.referredBy,
      referrerName: customer.ReferredByCustomer?.name,
      referredName: customer.name,
      bonusReferrer: BONUS_INDICADOR,
      bonusReferred: BONUS_INDICADO
    };
  } catch (error) {
    console.error('❌ [REFERRAL ERROR] Erro ao processar bônus de indicação:', error);
    return null;
  }
}
