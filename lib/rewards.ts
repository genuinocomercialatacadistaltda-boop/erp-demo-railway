
import { prisma } from './db';

/**
 * Calcula e adiciona pontos para um pedido
 * REGRA IMPORTANTE: Apenas pedidos criados pelo próprio cliente geram pontos
 * Pedidos criados por admin ou vendedor NÃO geram pontos
 */
export async function addPointsForOrder(
  orderId: string,
  customerId: string,
  orderAmount: number,
  createdByRole?: string | null
) {
  try {
    // REGRA CRUCIAL: Só gerar pontos se o pedido foi feito pelo próprio cliente
    if (createdByRole !== 'CUSTOMER') {
      console.log(`⚠️ Pedido ${orderId} não gera pontos - criado por ${createdByRole || 'não-cliente'}`);
      return null;
    }

    // Buscar cliente e configuração
    const [customer, config] = await Promise.all([
      prisma.customer.findUnique({
        where: { id: customerId },
        select: {
          pointsMultiplier: true
        }
      }),
      prisma.rewardConfig.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    if (!customer || !config) {
      console.log('Cliente ou configuração não encontrada');
      return null;
    }

    // Calcular pontos: (valor do pedido * pontos por real * multiplicador do cliente)
    const basePoints = orderAmount * config.pointsPerReal;
    const finalPoints = basePoints * customer.pointsMultiplier;
    const roundedPoints = Math.floor(finalPoints * 100) / 100; // 2 casas decimais

    if (roundedPoints <= 0) {
      console.log('Nenhum ponto a adicionar');
      return null;
    }

    // Adicionar pontos em transação
    const result = await prisma.$transaction(async (tx) => {
      // Criar transação de pontos
      const transaction = await tx.pointTransaction.create({
        data: {
          customerId,
          orderId,
          type: 'EARNED_FROM_ORDER',
          points: roundedPoints,
          multiplierApplied: customer.pointsMultiplier,
          orderAmount,
          description: `Compra #${orderId.substring(0, 8)}`
        }
      });

      // Atualizar saldo do cliente
      const updatedCustomer = await tx.customer.update({
        where: { id: customerId },
        data: {
          pointsBalance: { increment: roundedPoints },
          totalPointsEarned: { increment: roundedPoints }
        }
      });

      // Criar notificação para o cliente
      await tx.notification.create({
        data: {
          id: crypto.randomUUID(),
          title: '🎉 Você ganhou pontos!',
          message: `Parabéns! Você ganhou ${roundedPoints.toFixed(2)} pontos com sua compra de R$ ${orderAmount.toFixed(2)}`,
          type: 'COMMUNICATION',
          category: 'GENERAL',
          deliveryMode: 'AUTOMATIC',
          targetRole: 'CUSTOMER',
          targetUserId: customerId
        }
      });

      return { transaction, updatedCustomer };
    });

    console.log(`✅ Adicionados ${roundedPoints} pontos para o cliente ${customerId}`);
    return result;
  } catch (error) {
    console.error('Erro ao adicionar pontos:', error);
    return null;
  }
}

/**
 * Obter ranking de clientes com mais pontos
 */
export async function getCustomerRanking(limit: number = 10) {
  try {
    const ranking = await prisma.customer.findMany({
      where: {
        isActive: true
      },
      select: {
        id: true,
        name: true,
        city: true,
        pointsBalance: true,
        totalPointsEarned: true,
        totalPointsRedeemed: true,
        _count: {
          select: {
            Order: true
          }
        }
      },
      orderBy: {
        pointsBalance: 'desc'
      },
      take: limit
    });

    return ranking.map((customer, index) => ({
      rank: index + 1,
      ...customer
    }));
  } catch (error) {
    console.error('Erro ao obter ranking:', error);
    return [];
  }
}
