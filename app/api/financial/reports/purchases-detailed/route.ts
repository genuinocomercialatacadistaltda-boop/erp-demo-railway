
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

    // Buscar todas as compras da fábrica (customerId = null) no período
    const purchases = await prisma.purchase.findMany({
      where: {
        customerId: null, // Apenas compras da fábrica
        purchaseDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        Supplier: true,
        PurchaseItem: {
          include: {
            RawMaterial: true,
          },
        },
        Expense: true,
      },
      orderBy: {
        purchaseDate: "asc",
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

    // Agrupar compras por dia
    const purchasesByDay: Record<
      string,
      {
        date: string;
        dayOfWeek: string;
        totalPurchases: number;
        purchasesCount: number;
        purchasesBySupplier: Record<string, number>;
        averagePerPurchase: number;
      }
    > = {};

    // Agrupar compras por dia da semana
    const purchasesByWeekDay: Record<
      string,
      {
        dayName: string;
        totalPurchases: number;
        purchasesCount: number;
        averagePerPurchase: number;
      }
    > = {};

    let totalPurchases = 0;
    let totalCount = 0;

    purchases.forEach((purchase: any) => {
      const dateKey = purchase.purchaseDate.toISOString().split("T")[0];
      const dayOfWeek = purchase.purchaseDate.getDay();
      const dayName = weekDayNames[dayOfWeek];
      const amount = purchase.totalAmount;

      totalPurchases += amount;
      totalCount++;

      // Agregar por dia
      if (!purchasesByDay[dateKey]) {
        purchasesByDay[dateKey] = {
          date: dateKey,
          dayOfWeek: dayName,
          totalPurchases: 0,
          purchasesCount: 0,
          purchasesBySupplier: {},
          averagePerPurchase: 0,
        };
      }
      purchasesByDay[dateKey].totalPurchases += amount;
      purchasesByDay[dateKey].purchasesCount++;

      // Agrupar por fornecedor
      const supplierName = purchase.Supplier?.name || "Sem Fornecedor";
      if (!purchasesByDay[dateKey].purchasesBySupplier[supplierName]) {
        purchasesByDay[dateKey].purchasesBySupplier[supplierName] = 0;
      }
      purchasesByDay[dateKey].purchasesBySupplier[supplierName] += amount;

      // Agregar por dia da semana
      if (!purchasesByWeekDay[dayName]) {
        purchasesByWeekDay[dayName] = {
          dayName,
          totalPurchases: 0,
          purchasesCount: 0,
          averagePerPurchase: 0,
        };
      }
      purchasesByWeekDay[dayName].totalPurchases += amount;
      purchasesByWeekDay[dayName].purchasesCount++;
    });

    // Calcular média por compra por dia
    Object.values(purchasesByDay).forEach((day) => {
      day.averagePerPurchase =
        day.purchasesCount > 0 ? day.totalPurchases / day.purchasesCount : 0;
    });

    // Calcular média por compra por dia da semana
    Object.values(purchasesByWeekDay).forEach((day) => {
      day.averagePerPurchase =
        day.purchasesCount > 0 ? day.totalPurchases / day.purchasesCount : 0;
    });

    // Converter para arrays e ordenar
    const dailyPurchases = Object.values(purchasesByDay);
    const weekDayPurchases = Object.values(purchasesByWeekDay).sort((a, b) => {
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

    // Encontrar dia com mais e menos compras
    const highestDay = dailyPurchases.reduce(
      (max, day) => (day.totalPurchases > max.totalPurchases ? day : max),
      dailyPurchases[0] || {
        date: "",
        dayOfWeek: "",
        totalPurchases: 0,
        purchasesCount: 0,
        purchasesBySupplier: {},
        averagePerPurchase: 0,
      }
    );

    const lowestDay = dailyPurchases.reduce(
      (min, day) => (day.totalPurchases < min.totalPurchases ? day : min),
      dailyPurchases[0] || {
        date: "",
        dayOfWeek: "",
        totalPurchases: 0,
        purchasesCount: 0,
        purchasesBySupplier: {},
        averagePerPurchase: 0,
      }
    );

    // Encontrar dia da semana com mais compras
    const highestWeekDay = weekDayPurchases.reduce(
      (max, day) => (day.totalPurchases > max.totalPurchases ? day : max),
      weekDayPurchases[0] || {
        dayName: "",
        totalPurchases: 0,
        purchasesCount: 0,
        averagePerPurchase: 0,
      }
    );

    const lowestWeekDay = weekDayPurchases.reduce(
      (min, day) => (day.totalPurchases < min.totalPurchases ? day : min),
      weekDayPurchases[0] || {
        dayName: "",
        totalPurchases: 0,
        purchasesCount: 0,
        averagePerPurchase: 0,
      }
    );

    return NextResponse.json({
      summary: {
        totalPurchases,
        totalCount,
        averagePerDay:
          dailyPurchases.length > 0
            ? totalPurchases / dailyPurchases.length
            : 0,
        daysWithPurchases: dailyPurchases.length,
      },
      dailyPurchases,
      weekDayPurchases,
      highlights: {
        highestDay,
        lowestDay,
        highestWeekDay,
        lowestWeekDay,
      },
    });
  } catch (error) {
    console.error("[PURCHASES_DETAILED_REPORT] Erro:", error);
    return NextResponse.json(
      { error: "Erro ao gerar relatório de compras" },
      { status: 500 }
    );
  }
}
