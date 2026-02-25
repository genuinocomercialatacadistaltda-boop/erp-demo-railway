export const dynamic = 'force-dynamic';


import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth-options";

// GET - DRE (Demonstrativo de Resultados do Exercício)
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Datas de início e fim são obrigatórias" },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Receitas (pedidos entregues no período)
    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: "DELIVERED",
      },
      select: {
        total: true,
        cardFee: true,
        subtotal: true,
        discount: true,
      },
    });

    const totalRevenue = orders.reduce((sum: number, order: any) => sum + order.total, 0);
    const totalCardFees = orders.reduce((sum: number, order: any) => sum + order.cardFee, 0);
    const totalDiscounts = orders.reduce((sum: number, order: any) => sum + order.discount, 0);
    const grossRevenue = orders.reduce((sum: number, order: any) => sum + order.subtotal, 0);

    // Contas a receber pagas no período
    const receivables = await prisma.receivable.findMany({
      where: {
        paymentDate: { gte: start, lte: end },
        status: "PAID",
      },
      select: {
        amount: true,
        feeAmount: true,
        netAmount: true,
      },
    });

    const receivedAmount = receivables.reduce(
      (sum, r) => sum + (r.netAmount || r.amount),
      0
    );
    const receivableFees = receivables.reduce(
      (sum, r) => sum + (r.feeAmount || 0),
      0
    );

    // 📊 Despesas no período - USANDO DATA DE COMPETÊNCIA (não pagamento)
    // Buscar TODAS as despesas e filtrar manualmente pela data de competência
    const allExpensesRaw = await prisma.expense.findMany({
      include: {
        Category: true,
        Purchase: {
          select: { purchaseDate: true }
        }
      },
    });

    // Filtrar por data de competência (igual ao Dashboard)
    const expenses = allExpensesRaw.filter((expense: any) => {
      // Determinar data de competência
      let competenceDate: Date | null = null;
      
      if (expense.competenceDate) {
        competenceDate = new Date(expense.competenceDate);
      } else if (expense.Purchase?.purchaseDate) {
        competenceDate = new Date(expense.Purchase.purchaseDate);
      } else if (expense.status === 'PAID' && expense.paymentDate) {
        competenceDate = new Date(expense.paymentDate);
      } else if (expense.dueDate) {
        competenceDate = new Date(expense.dueDate);
      }

      // Filtrar pelo período
      return competenceDate && competenceDate >= start && competenceDate <= end;
    });

    const totalExpenses = expenses.reduce((sum: number, exp: any) => sum + exp.amount, 0);
    const totalFees = expenses.reduce((sum: number, exp: any) => sum + (exp.feeAmount || 0), 0);
    
    console.log(`📊 [DRE] Total de despesas (competência): ${expenses.length} despesas, R$ ${totalExpenses.toFixed(2)}`);

    // Despesas de cartão de crédito (TODAS - pela data de compra no período)
    const creditCardExpenses = await prisma.creditCardExpense.findMany({
      where: {
        purchaseDate: { gte: start, lte: end },
      },
      include: {
        Category: true,
        CreditCard: true,
        Invoice: true,
      },
    });

    const totalCreditCardExpenses = creditCardExpenses.reduce((sum: number, exp: any) => sum + exp.amount, 0);

    // Agrupar despesas por categoria (incluindo cartões)
    const expensesByCategory: Record<string, { name: string; amount: number }> = {};
    
    expenses.forEach((exp: any) => {
      const categoryName = exp.Category?.name || "Sem Categoria";
      if (!expensesByCategory[categoryName]) {
        expensesByCategory[categoryName] = { name: categoryName, amount: 0 };
      }
      expensesByCategory[categoryName].amount += exp.amount;
    });

    creditCardExpenses.forEach((exp: any) => {
      const categoryName = exp.Category?.name || "Cartão de Crédito";
      if (!expensesByCategory[categoryName]) {
        expensesByCategory[categoryName] = { name: categoryName, amount: 0 };
      }
      expensesByCategory[categoryName].amount += exp.amount;
    });

    // Adicionar COMPRAS DA FÁBRICA ao agrupamento por categoria
    // 📊 Usando DATA DE COMPETÊNCIA (purchaseDate, não dueDate)
    const purchasesWithCategory = await prisma.purchase.findMany({
      where: {
        customerId: null, // 🔑 Apenas compras da fábrica (admin)
        purchaseDate: { gte: start, lte: end } // ✅ DATA DE COMPETÊNCIA
      },
      include: {
        Expense: {
          include: {
            Category: true
          }
        }
      }
    });
    
    console.log(`📊 [DRE] Total de compras (competência): ${purchasesWithCategory.length} compras`);

    purchasesWithCategory.forEach((purchase: any) => {
      const categoryName = purchase.Expense?.Category?.name || "Compras sem Categoria";
      if (!expensesByCategory[categoryName]) {
        expensesByCategory[categoryName] = { name: categoryName, amount: 0 };
      }
      expensesByCategory[categoryName].amount += purchase.totalAmount;
    });

    // Agrupar despesas por tipo (OPERATIONAL, PRODUCTS, RAW_MATERIALS, OTHER)
    const expensesByType: Record<string, number> = {
      OPERATIONAL: 0,
      PRODUCTS: 0,
      RAW_MATERIALS: 0,
      OTHER: 0,
    };

    expenses.forEach((exp: any) => {
      const expenseType = exp.expenseType || 'OTHER';
      expensesByType[expenseType] += exp.amount;
    });

    creditCardExpenses.forEach((exp: any) => {
      const expenseType = exp.expenseType || 'OTHER';
      expensesByType[expenseType] += exp.amount;
    });

    // Calcular total de compras e adicionar ao tipo correspondente
    const totalPurchases = purchasesWithCategory.reduce((sum, p) => sum + p.totalAmount, 0);
    
    purchasesWithCategory.forEach((p) => {
      const expenseType = p.expenseType || 'RAW_MATERIALS';
      expensesByType[expenseType] += p.totalAmount;
    });

    // Cálculos do DRE
    const netRevenue = totalRevenue - totalDiscounts;
    const totalAllExpenses = totalExpenses + totalCreditCardExpenses + totalPurchases;
    const operatingIncome = netRevenue - totalAllExpenses;
    const financialResult = -(totalCardFees + totalFees + receivableFees); // Custos financeiros
    const netIncome = operatingIncome + financialResult;

    const dre = {
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
      revenue: {
        gross: grossRevenue,
        discounts: totalDiscounts,
        net: netRevenue,
      },
      costs: {
        total: totalAllExpenses,
        expenses: totalExpenses,
        creditCardExpenses: totalCreditCardExpenses,
        purchases: totalPurchases,
        byCategory: Object.values(expensesByCategory).sort(
          (a, b) => b.amount - a.amount
        ),
        byType: {
          operational: expensesByType.OPERATIONAL,
          products: expensesByType.PRODUCTS,
          rawMaterials: expensesByType.RAW_MATERIALS,
          other: expensesByType.OTHER,
        },
      },
      operatingIncome,
      financialResult: {
        cardFees: totalCardFees,
        transactionFees: totalFees + receivableFees,
        total: financialResult,
      },
      netIncome,
      metrics: {
        profitMargin: netRevenue > 0 ? (netIncome / netRevenue) * 100 : 0,
        operatingMargin: netRevenue > 0 ? (operatingIncome / netRevenue) * 100 : 0,
      },
      receivables: {
        received: receivedAmount,
        fees: receivableFees,
      },
    };

    return NextResponse.json(dre);
  } catch (error) {
    console.error("Erro ao gerar DRE:", error);
    return NextResponse.json({ error: "Erro ao gerar DRE" }, { status: 500 });
  }
}
