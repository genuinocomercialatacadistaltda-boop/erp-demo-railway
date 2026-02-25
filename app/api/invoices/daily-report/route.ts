export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db';
import { startOfDay, endOfDay } from 'date-fns';

// GET - Relatório diário de vendas para consumidor final
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get('date');

    // Se não foi fornecida uma data, usar hoje
    const targetDate = dateParam ? new Date(dateParam) : new Date();
    const startDate = startOfDay(targetDate);
    const endDate = endOfDay(targetDate);

    console.log('Buscando vendas entre:', startDate, 'e', endDate);

    // Buscar todos os pedidos do dia que não tem NF-e emitida
    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        status: {
          notIn: ['CANCELLED'],
        },
        // Não incluir pedidos que já tem nota fiscal
        FiscalInvoice: {
          none: {},
        },
      },
      include: {
        OrderItem: {
          include: {
            Product: true,
          },
        },
        Customer: true,
        FiscalInvoice: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    console.log(`Encontrados ${orders.length} pedidos sem nota fiscal`);

    // Separar pedidos por tipo
    const retailOrders = orders.filter(
      (order) => order.orderType === 'RETAIL' || !order.Customer?.cpfCnpj
    );
    
    const registeredOrders = orders.filter(
      (order) => order.orderType === 'WHOLESALE' && order.Customer?.cpfCnpj
    );

    // Calcular totais
    const retailTotal = retailOrders.reduce((sum: number, order: any) => sum + order.total, 0);
    const registeredTotal = registeredOrders.reduce((sum: number, order: any) => sum + order.total, 0);
    const grandTotal = retailTotal + registeredTotal;

    // Agrupar produtos dos pedidos retail (para nota consolidada)
    const retailProductsMap = new Map<string, {
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }>();

    retailOrders.forEach((order) => {
      order.OrderItem.forEach((item: any) => {
        const existing = retailProductsMap.get(item.productId);
        if (existing) {
          existing.quantity += item.quantity;
          existing.total += item.total;
        } else {
          retailProductsMap.set(item.productId, {
            productId: item.productId,
            productName: item.Product.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
          });
        }
      });
    });

    const retailConsolidatedProducts = Array.from(retailProductsMap.values());

    return NextResponse.json({
      date: targetDate,
      summary: {
        totalOrders: orders.length,
        retailOrders: retailOrders.length,
        registeredOrders: registeredOrders.length,
        retailTotal,
        registeredTotal,
        grandTotal,
      },
      retail: {
        orders: retailOrders.map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          total: order.total,
          createdAt: order.createdAt,
        })),
        consolidatedProducts: retailConsolidatedProducts,
        total: retailTotal,
      },
      registered: {
        orders: registeredOrders.map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          customerCpfCnpj: order.Customer?.cpfCnpj,
          total: order.total,
          items: order.OrderItem.map((item: any) => ({
            productName: item.Product.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
          })),
          createdAt: order.createdAt,
        })),
        total: registeredTotal,
      },
    });
  } catch (error: any) {
    console.error('Erro ao gerar relatório diário:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao gerar relatório diário' },
      { status: 500 }
    );
  }
}
