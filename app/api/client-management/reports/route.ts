export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { startOfMonth, endOfMonth, format, parseISO, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const customerId = (session.user as any).customerId;
    if (!customerId) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    // Parâmetros de período
    const { searchParams } = new URL(req.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    const startDate = startDateParam 
      ? parseISO(startDateParam) 
      : startOfMonth(new Date());
    const endDate = endDateParam 
      ? parseISO(endDateParam) 
      : endOfMonth(new Date());

    // Período anterior (mês anterior) para comparação
    const previousStartDate = subMonths(startDate, 1);
    const previousEndDate = subMonths(endDate, 1);

    // ======================================
    // RELATÓRIO DE VENDAS
    // ======================================
    const sales = await prisma.clientSale.findMany({
      where: {
        customerId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Calcular métricas de vendas
    const totalRevenue = sales.reduce((sum: number, sale: any) => sum + sale.total, 0);
    const totalOrders = sales.length;
    const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Agrupar vendas por dia
    const salesByDay = sales.reduce((acc: any, sale: any) => {
      const dateKey = format(sale.createdAt, "yyyy-MM-dd");
      const weekday = format(sale.createdAt, "EEEE", { locale: ptBR });
      
      if (!acc[dateKey]) {
        acc[dateKey] = {
          date: dateKey,
          weekday,
          total: 0,
          orders: 0,
        };
      }
      
      acc[dateKey].total += sale.total;
      acc[dateKey].orders += 1;
      
      return acc;
    }, {});

    const dailySalesArray = Object.values(salesByDay).sort((a: any, b: any) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Encontrar melhor e pior dia
    let bestDay = null;
    let worstDay = null;
    
    if (dailySalesArray.length > 0) {
      bestDay = dailySalesArray.reduce((max: any, current: any) => 
        current.total > max.total ? current : max
      );
      
      worstDay = dailySalesArray.reduce((min: any, current: any) => 
        current.total < min.total ? current : min
      );
    }

    // Agrupar vendas por dia da semana
    const salesByWeekday = sales.reduce((acc: any, sale: any) => {
      const weekday = format(sale.createdAt, "EEEE", { locale: ptBR });
      
      if (!acc[weekday]) {
        acc[weekday] = {
          weekday,
          total: 0,
          orders: 0,
        };
      }
      
      acc[weekday].total += sale.total;
      acc[weekday].orders += 1;
      
      return acc;
    }, {});

    const weekdaySalesArray = Object.values(salesByWeekday);

    // Encontrar melhor e pior dia da semana
    let bestWeekday = null;
    let worstWeekday = null;
    
    if (weekdaySalesArray.length > 0) {
      bestWeekday = weekdaySalesArray.reduce((max: any, current: any) => 
        current.total > max.total ? current : max
      );
      
      worstWeekday = weekdaySalesArray.reduce((min: any, current: any) => 
        current.total < min.total ? current : min
      );
    }

    // Dias com vendas (distintos)
    const daysWithSales = Object.keys(salesByDay).length;

    // ======================================
    // COMPARAÇÃO COM MÊS ANTERIOR
    // ======================================
    const previousSales = await prisma.clientSale.findMany({
      where: {
        customerId,
        createdAt: {
          gte: previousStartDate,
          lte: previousEndDate,
        },
      },
    });

    const previousRevenue = previousSales.reduce((sum: number, sale: any) => sum + sale.total, 0);
    const previousOrders = previousSales.length;
    
    // Calcular variação percentual
    const revenueChange = previousRevenue > 0 
      ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 
      : 0;
    const ordersChange = previousOrders > 0 
      ? ((totalOrders - previousOrders) / previousOrders) * 100 
      : 0;

    // ======================================
    // RELATÓRIO DE DESPERDÍCIO (Temporariamente desabilitado)
    // ======================================
    const totalWaste = 0;
    const totalWasteOccurrences = 0;
    const wasteByReason: Record<string, any> = {};
    
    /*
    const wasteRecords = await prisma.wasteRecord.findMany({
      where: {
        customerId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        Product: true,
      },
    });
    
    const totalWaste = wasteRecords.reduce(
      (sum: number, record: any) => sum + record.quantity, 
      0
    );
    
    const totalWasteOccurrences = wasteRecords.length;
    
    // Agrupar desperdício por motivo
    const wasteByReason = wasteRecords.reduce((acc: any, record: any) => {
      const reason = record.reason || "Sem motivo informado";
      
      if (!acc[reason]) {
        acc[reason] = {
          reason,
          quantity: 0,
          occurrences: 0,
        };
      }
      
      acc[reason].quantity += record.quantity;
      acc[reason].occurrences += 1;
      
      return acc;
    }, {});
    
    const wasteByReasonArray = Object.values(wasteByReason).map((item: any) => ({
      ...item,
      percentage: totalWaste > 0 ? (item.quantity / totalWaste) * 100 : 0,
    }));
    
    // Calcular taxa de desperdício (desperdício / dias com vendas)
    const wasteRate = daysWithSales > 0 ? totalWaste / daysWithSales : 0;
    */
    
    const wasteByReasonArray: any[] = [];
    const wasteRate = 0;
    
    // ======================================
    // PRODUTOS MAIS VENDIDOS
    // ======================================
    const salesWithItems = await prisma.clientSale.findMany({
      where: {
        customerId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        Items: true,
      },
    });

    // Agrupar itens por produto
    const productSales: Record<string, { name: string; quantity: number; revenue: number }> = {};
    
    salesWithItems.forEach((sale: any) => {
      sale.Items.forEach((item: any) => {
        const productKey = item.productName;
        
        if (!productSales[productKey]) {
          productSales[productKey] = {
            name: item.productName,
            quantity: 0,
            revenue: 0,
          };
        }
        
        productSales[productKey].quantity += item.quantity;
        productSales[productKey].revenue += item.totalPrice;
      });
    });

    // Ordenar por faturamento (maior para menor)
    const topProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10) // Top 10
      .map((product: any) => ({
        ...product,
        percentage: totalRevenue > 0 ? (product.revenue / totalRevenue) * 100 : 0,
      }));

    // ======================================
    // RELATÓRIO DE DESPESAS
    // ======================================
    const expenses = await prisma.clientExpense.findMany({
      where: {
        customerId,
        dueDate: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Agrupar despesas por categoria
    const expensesByCategory = expenses.reduce((acc: any, expense: any) => {
      const category = expense.category || "Sem Categoria";
      
      if (!acc[category]) {
        acc[category] = {
          category,
          total: 0,
          count: 0,
        };
      }
      
      acc[category].total += expense.amount;
      acc[category].count += 1;
      
      return acc;
    }, {});

    const totalExpenses = expenses.reduce((sum: number, expense: any) => sum + expense.amount, 0);

    // Calcular porcentagens
    const expensesCategoryArray = Object.values(expensesByCategory).map((item: any) => ({
      ...item,
      percentage: totalExpenses > 0 ? (item.total / totalExpenses) * 100 : 0,
    }));

    // ======================================
    // RETORNAR DADOS
    // ======================================
    return NextResponse.json({
      period: {
        startDate: format(startDate, "yyyy-MM-dd"),
        endDate: format(endDate, "yyyy-MM-dd"),
      },
      sales: {
        totalRevenue,
        totalOrders,
        averageTicket,
        daysWithSales,
        bestDay,
        worstDay,
        bestWeekday,
        worstWeekday,
        dailySales: dailySalesArray,
        weekdaySales: weekdaySalesArray,
        comparison: {
          previousRevenue,
          previousOrders,
          revenueChange,
          ordersChange,
        },
      },
      topProducts,
      waste: {
        totalWaste,
        totalOccurrences: totalWasteOccurrences,
        wasteRate, // Média de desperdício por dia
        byReason: wasteByReasonArray,
      },
      expenses: {
        totalExpenses,
        byCategory: expensesCategoryArray,
      },
    });
  } catch (error: any) {
    console.error("❌ Erro ao buscar relatórios:", error);
    return NextResponse.json(
      { error: "Erro ao buscar relatórios", details: error.message },
      { status: 500 }
    );
  }
}
