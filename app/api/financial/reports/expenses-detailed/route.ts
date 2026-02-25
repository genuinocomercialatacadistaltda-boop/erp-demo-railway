
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

    // Buscar todas as despesas no período
    const expenses = await prisma.expense.findMany({
      where: {
        dueDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        Category: true,
        Supplier: true,
      },
      orderBy: {
        dueDate: "asc",
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

    // Agrupar despesas por dia
    const expensesByDay: Record<
      string,
      {
        date: string;
        dayOfWeek: string;
        totalExpenses: number;
        expensesCount: number;
        expensesByStatus: {
          paid: number;
          pending: number;
          overdue: number;
        };
        expensesByType: Record<string, number>;
      }
    > = {};

    // Agrupar despesas por dia da semana
    const expensesByWeekDay: Record<
      string,
      {
        dayName: string;
        totalExpenses: number;
        expensesCount: number;
        expensesByStatus: {
          paid: number;
          pending: number;
          overdue: number;
        };
      }
    > = {};

    let totalExpenses = 0;
    let totalCount = 0;

    expenses.forEach((expense: any) => {
      const dateKey = expense.dueDate.toISOString().split("T")[0];
      const dayOfWeek = expense.dueDate.getDay();
      const dayName = weekDayNames[dayOfWeek];
      const amount = expense.amount;

      totalExpenses += amount;
      totalCount++;

      // Agregar por dia
      if (!expensesByDay[dateKey]) {
        expensesByDay[dateKey] = {
          date: dateKey,
          dayOfWeek: dayName,
          totalExpenses: 0,
          expensesCount: 0,
          expensesByStatus: {
            paid: 0,
            pending: 0,
            overdue: 0,
          },
          expensesByType: {},
        };
      }
      expensesByDay[dateKey].totalExpenses += amount;
      expensesByDay[dateKey].expensesCount++;

      // Status
      if (expense.status === "PAID") {
        expensesByDay[dateKey].expensesByStatus.paid += amount;
      } else if (expense.dueDate < new Date() && expense.status !== "PAID") {
        expensesByDay[dateKey].expensesByStatus.overdue += amount;
      } else {
        expensesByDay[dateKey].expensesByStatus.pending += amount;
      }

      // Tipo
      const expenseType = expense.expenseType || "OUTROS";
      if (!expensesByDay[dateKey].expensesByType[expenseType]) {
        expensesByDay[dateKey].expensesByType[expenseType] = 0;
      }
      expensesByDay[dateKey].expensesByType[expenseType] += amount;

      // Agregar por dia da semana
      if (!expensesByWeekDay[dayName]) {
        expensesByWeekDay[dayName] = {
          dayName,
          totalExpenses: 0,
          expensesCount: 0,
          expensesByStatus: {
            paid: 0,
            pending: 0,
            overdue: 0,
          },
        };
      }
      expensesByWeekDay[dayName].totalExpenses += amount;
      expensesByWeekDay[dayName].expensesCount++;

      // Status por dia da semana
      if (expense.status === "PAID") {
        expensesByWeekDay[dayName].expensesByStatus.paid += amount;
      } else if (expense.dueDate < new Date() && expense.status !== "PAID") {
        expensesByWeekDay[dayName].expensesByStatus.overdue += amount;
      } else {
        expensesByWeekDay[dayName].expensesByStatus.pending += amount;
      }
    });

    // Converter para arrays e ordenar
    const dailyExpenses = Object.values(expensesByDay);
    const weekDayExpenses = Object.values(expensesByWeekDay).sort((a, b) => {
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

    // Encontrar dia com mais e menos despesas
    const highestDay = dailyExpenses.reduce(
      (max, day) => (day.totalExpenses > max.totalExpenses ? day : max),
      dailyExpenses[0] || {
        date: "",
        dayOfWeek: "",
        totalExpenses: 0,
        expensesCount: 0,
        expensesByStatus: { paid: 0, pending: 0, overdue: 0 },
        expensesByType: {},
      }
    );

    const lowestDay = dailyExpenses.reduce(
      (min, day) => (day.totalExpenses < min.totalExpenses ? day : min),
      dailyExpenses[0] || {
        date: "",
        dayOfWeek: "",
        totalExpenses: 0,
        expensesCount: 0,
        expensesByStatus: { paid: 0, pending: 0, overdue: 0 },
        expensesByType: {},
      }
    );

    // Encontrar dia da semana com mais despesas
    const highestWeekDay = weekDayExpenses.reduce(
      (max, day) => (day.totalExpenses > max.totalExpenses ? day : max),
      weekDayExpenses[0] || {
        dayName: "",
        totalExpenses: 0,
        expensesCount: 0,
        expensesByStatus: { paid: 0, pending: 0, overdue: 0 },
      }
    );

    const lowestWeekDay = weekDayExpenses.reduce(
      (min, day) => (day.totalExpenses < min.totalExpenses ? day : min),
      weekDayExpenses[0] || {
        dayName: "",
        totalExpenses: 0,
        expensesCount: 0,
        expensesByStatus: { paid: 0, pending: 0, overdue: 0 },
      }
    );

    return NextResponse.json({
      summary: {
        totalExpenses,
        totalCount,
        averagePerDay:
          dailyExpenses.length > 0 ? totalExpenses / dailyExpenses.length : 0,
        daysWithExpenses: dailyExpenses.length,
      },
      dailyExpenses,
      weekDayExpenses,
      highlights: {
        highestDay,
        lowestDay,
        highestWeekDay,
        lowestWeekDay,
      },
    });
  } catch (error) {
    console.error("[EXPENSES_DETAILED_REPORT] Erro:", error);
    return NextResponse.json(
      { error: "Erro ao gerar relatório de despesas" },
      { status: 500 }
    );
  }
}
