export const dynamic = 'force-dynamic';


import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { productSelect } from '@/lib/product-select'

/**
 * API: Análise de Rentabilidade por Produto
 * GET /api/financial/profitability/products - Lista análises
 * POST /api/financial/profitability/products/calculate - Calcula rentabilidade
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
    const productId = searchParams.get('productId');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: any = {};

    if (referenceMonth) {
      where.referenceMonth = new Date(referenceMonth);
    }

    if (productId) {
      where.productId = productId;
    }

    const profitability = await prisma.productProfitability.findMany({
      where,
      include: {
        Product: true,
      },
      orderBy: [
        { referenceMonth: 'desc' },
        { profitMargin: 'desc' },
      ],
      take: limit,
    });

    return NextResponse.json(profitability);
  } catch (error: any) {
    console.error('Erro ao buscar rentabilidade de produtos:', error);
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

    // Busca todos os produtos
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
      },
    });

    const calculations = [];

    for (const product of products) {
      // Busca itens vendidos no período
      const orderItems = await prisma.orderItem.findMany({
        where: {
          productId: product.id,
          Order: {
            status: {
              not: 'CANCELLED',
            },
            createdAt: {
              gte: monthStart,
              lte: monthEnd,
            },
          },
        },
        include: {
          Order: true,
        },
      });

      if (orderItems.length === 0) continue;

      // Calcula métricas
      const unitsSold = orderItems.reduce((sum: number, item: any) => sum + item.quantity, 0);
      const grossRevenue = orderItems.reduce((sum: number, item: any) => sum + item.total, 0);

      // Calcula receita líquida (descontando taxas de cartão, etc)
      let totalFees = 0;
      for (const item of orderItems) {
        if (item.Order.cardFee) {
          totalFees += (item.total / item.Order.total) * item.Order.cardFee;
        }
      }
      
      const netRevenue = grossRevenue - totalFees;

      // Custo dos produtos (preço atacado * quantidade)
      const costOfGoods = unitsSold * product.priceWholesale;

      // Lucro bruto
      const grossProfit = netRevenue - costOfGoods;

      // Margem de lucro
      const profitMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

      // Margem de contribuição
      const contributionMargin = grossRevenue > 0 ? (grossProfit / grossRevenue) * 100 : 0;

      // Cria ou atualiza registro
      const profitability = await prisma.productProfitability.upsert({
        where: {
          productId_referenceMonth: {
            productId: product.id,
            referenceMonth: monthStart,
          },
        },
        create: {
          productId: product.id,
          productName: product.name,
          referenceMonth: monthStart,
          unitsSold,
          grossRevenue,
          netRevenue,
          costOfGoods,
          grossProfit,
          profitMargin,
          contributionMargin,
        },
        update: {
          unitsSold,
          grossRevenue,
          netRevenue,
          costOfGoods,
          grossProfit,
          profitMargin,
          contributionMargin,
        },
        include: {
          Product: true,
        },
      });

      calculations.push(profitability);
    }

    return NextResponse.json({
      success: true,
      referenceMonth: monthStart,
      productsAnalyzed: products.length,
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
