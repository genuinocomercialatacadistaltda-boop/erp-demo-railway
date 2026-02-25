export const dynamic = 'force-dynamic';


import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';

/**
 * API: Análise de Rentabilidade por Vendedor
 * GET /api/financial/profitability/sellers - Lista análises
 * POST /api/financial/profitability/sellers/calculate - Calcula rentabilidade
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
    const referenceMonth = searchParams.get('referenceMonth');
    const sellerId = searchParams.get('sellerId');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: any = {};

    if (referenceMonth) {
      where.referenceMonth = new Date(referenceMonth);
    }

    if (sellerId) {
      where.sellerId = sellerId;
    }

    const profitability = await prisma.sellerProfitability.findMany({
      where,
      include: {
        Seller: true,
      },
      orderBy: [
        { referenceMonth: 'desc' },
        { profitMargin: 'desc' },
      ],
      take: limit,
    });

    return NextResponse.json(profitability);
  } catch (error: any) {
    console.error('Erro ao buscar rentabilidade de vendedores:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar rentabilidade: ' + error.message },
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
    const { referenceMonth } = body;

    const monthDate = referenceMonth ? new Date(referenceMonth) : subMonths(new Date(), 1);
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);

    // Busca todos os vendedores ativos
    const sellers = await prisma.seller.findMany({
      where: {
        isActive: true,
      },
    });

    const calculations = [];

    for (const seller of sellers) {
      // Busca pedidos do vendedor no período
      const orders = await prisma.order.findMany({
        where: {
          sellerId: seller.id,
          status: {
            not: 'CANCELLED',
          },
          createdAt: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
        include: {
          OrderItem: true,
        },
      });

      if (orders.length === 0) continue;

      // Calcula métricas
      const totalOrders = orders.length;
      const grossRevenue = orders.reduce((sum: number, order: any) => sum + order.total, 0);
      
      // Receita líquida (descontando taxas)
      const totalFees = orders.reduce((sum: number, order: any) => sum + (order.cardFee || 0), 0);
      const netRevenue = grossRevenue - totalFees;

      // Comissões do vendedor
      const commissions = await prisma.commission.findMany({
        where: {
          sellerId: seller.id,
          createdAt: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
      });

      const totalCommission = commissions.reduce((sum: number, c: any) => sum + c.amount, 0);

      // Ticket médio
      const averageTicket = totalOrders > 0 ? grossRevenue / totalOrders : 0;

      // Margem de lucro (receita líquida - comissões)
      const profit = netRevenue - totalCommission;
      const profitMargin = netRevenue > 0 ? (profit / netRevenue) * 100 : 0;

      // Clientes únicos
      const uniqueCustomers = new Set(orders.map((o: any) => o.customerId).filter(Boolean));
      const activeCustomers = uniqueCustomers.size;

      // Novos clientes (primeira compra no período)
      let newCustomers = 0;
      for (const customerId of uniqueCustomers) {
        if (!customerId) continue;
        const firstOrder = await prisma.order.findFirst({
          where: {
            customerId,
            sellerId: seller.id,
          },
          orderBy: {
            createdAt: 'asc',
          },
        });

        if (firstOrder && firstOrder.createdAt >= monthStart && firstOrder.createdAt <= monthEnd) {
          newCustomers++;
        }
      }

      // Cria ou atualiza registro
      const profitability = await prisma.sellerProfitability.upsert({
        where: {
          sellerId_referenceMonth: {
            sellerId: seller.id,
            referenceMonth: monthStart,
          },
        },
        create: {
          sellerId: seller.id,
          sellerName: seller.name,
          referenceMonth: monthStart,
          totalOrders,
          grossRevenue,
          netRevenue,
          totalCommission,
          averageTicket,
          profitMargin,
          activeCustomers,
          newCustomers,
        },
        update: {
          totalOrders,
          grossRevenue,
          netRevenue,
          totalCommission,
          averageTicket,
          profitMargin,
          activeCustomers,
          newCustomers,
        },
        include: {
          Seller: true,
        },
      });

      calculations.push(profitability);
    }

    return NextResponse.json({
      success: true,
      referenceMonth: monthStart,
      sellersAnalyzed: sellers.length,
      calculationsCreated: calculations.length,
      calculations,
    });
  } catch (error: any) {
    console.error('Erro ao calcular rentabilidade:', error);
    return NextResponse.json(
      { error: 'Erro ao calcular rentabilidade: ' + error.message },
      { status: 500 }
    );
  }
}
