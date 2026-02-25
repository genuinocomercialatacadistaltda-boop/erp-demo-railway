
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || (session.user as any).userType !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    if (!startDateParam || !endDateParam) {
      return NextResponse.json(
        { error: "Período é obrigatório" },
        { status: 400 }
      );
    }

    const startDate = new Date(startDateParam);
    const endDate = new Date(endDateParam);

    // Buscar todas as vendas (pedidos entregues) no período
    const orders = await prisma.order.findMany({
      where: {
        status: "DELIVERED",
        deliveryDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        Customer: true,
        OrderItem: {
          include: {
            Product: true,
          },
        },
      },
      orderBy: {
        deliveryDate: "asc",
      },
    });

    // Mapear nomes dos dias da semana em português
    const weekDayNames = [
      "Domingo",
      "Segunda",
      "Terça",
      "Quarta",
      "Quinta",
      "Sexta",
      "Sábado",
    ];

    // Agrupar vendas por dia
    const salesByDay: Record<
      string,
      {
        date: string;
        dayOfWeek: string;
        totalSales: number;
        ordersCount: number;
        averageTicket: number;
      }
    > = {};

    // Agrupar vendas por dia da semana
    const salesByWeekDay: Record<
      string,
      {
        dayName: string;
        totalSales: number;
        ordersCount: number;
        averageTicket: number;
      }
    > = {};

    let totalSales = 0;
    let totalOrders = 0;

    orders.forEach((order: any) => {
      const dateKey = order.deliveryDate?.toISOString().split("T")[0] || "";
      const dayOfWeek = order.deliveryDate?.getDay() || 0;
      const dayName = weekDayNames[dayOfWeek];
      const orderTotal = order.total;

      totalSales += orderTotal;
      totalOrders++;

      // Agregar por dia
      if (!salesByDay[dateKey]) {
        salesByDay[dateKey] = {
          date: dateKey,
          dayOfWeek: dayName,
          totalSales: 0,
          ordersCount: 0,
          averageTicket: 0,
        };
      }
      salesByDay[dateKey].totalSales += orderTotal;
      salesByDay[dateKey].ordersCount++;

      // Agregar por dia da semana
      if (!salesByWeekDay[dayName]) {
        salesByWeekDay[dayName] = {
          dayName,
          totalSales: 0,
          ordersCount: 0,
          averageTicket: 0,
        };
      }
      salesByWeekDay[dayName].totalSales += orderTotal;
      salesByWeekDay[dayName].ordersCount++;
    });

    // Calcular ticket médio por dia
    Object.values(salesByDay).forEach((day) => {
      day.averageTicket = day.ordersCount > 0 ? day.totalSales / day.ordersCount : 0;
    });

    // Calcular ticket médio por dia da semana
    Object.values(salesByWeekDay).forEach((day) => {
      day.averageTicket = day.ordersCount > 0 ? day.totalSales / day.ordersCount : 0;
    });

    // Converter para arrays e ordenar
    const dailySales = Object.values(salesByDay);
    const weekDaySales = Object.values(salesByWeekDay).sort((a, b) => {
      const order = [
        "Domingo",
        "Segunda",
        "Terça",
        "Quarta",
        "Quinta",
        "Sexta",
        "Sábado",
      ];
      return order.indexOf(a.dayName) - order.indexOf(b.dayName);
    });

    // Encontrar dia com mais e menos vendas
    const bestDay = dailySales.reduce(
      (max, day) => (day.totalSales > max.totalSales ? day : max),
      dailySales[0] || { date: "", dayOfWeek: "", totalSales: 0, ordersCount: 0, averageTicket: 0 }
    );

    const worstDay = dailySales.reduce(
      (min, day) => (day.totalSales < min.totalSales ? day : min),
      dailySales[0] || { date: "", dayOfWeek: "", totalSales: 0, ordersCount: 0, averageTicket: 0 }
    );

    // Encontrar dia da semana com mais vendas
    const bestWeekDay = weekDaySales.reduce(
      (max, day) => (day.totalSales > max.totalSales ? day : max),
      weekDaySales[0] || { dayName: "", totalSales: 0, ordersCount: 0, averageTicket: 0 }
    );

    const worstWeekDay = weekDaySales.reduce(
      (min, day) => (day.totalSales < min.totalSales ? day : min),
      weekDaySales[0] || { dayName: "", totalSales: 0, ordersCount: 0, averageTicket: 0 }
    );

    return NextResponse.json({
      summary: {
        totalSales,
        totalOrders,
        averageTicket: totalOrders > 0 ? totalSales / totalOrders : 0,
        daysWithSales: dailySales.length,
      },
      dailySales,
      weekDaySales,
      highlights: {
        bestDay,
        worstDay,
        bestWeekDay,
        worstWeekDay,
      },
    });
  } catch (error) {
    console.error("[SALES_DETAILED_REPORT] Erro:", error);
    return NextResponse.json(
      { error: "Erro ao gerar relatório de vendas" },
      { status: 500 }
    );
  }
}
