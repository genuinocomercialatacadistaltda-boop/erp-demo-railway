
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth-options";

// GET - Relatórios Completos
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

    // ============= RECEITAS =============
    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: "DELIVERED",
      },
      include: {
        Customer: true,
        Seller: true,
        OrderItem: {
          include: {
            Product: true,
          },
        },
      },
    });

    const totalRevenue = orders.reduce((sum: number, order: any) => sum + order.total, 0);
    const totalCardFees = orders.reduce((sum: number, order: any) => sum + order.cardFee, 0);
    const totalDiscounts = orders.reduce((sum: number, order: any) => sum + order.discount, 0);
    const grossRevenue = orders.reduce((sum: number, order: any) => sum + order.subtotal, 0);
    const netRevenue = totalRevenue - totalDiscounts;

    // ============= DESPESAS =============
    // Buscar despesas sem duplicação: pendentes por vencimento, pagas por pagamento
    const expenses = await prisma.expense.findMany({
      where: {
        OR: [
          // Despesas PENDENTES que vencem no período
          { 
            status: "PENDING",
            dueDate: { gte: start, lte: end } 
          },
          // Despesas PAGAS no período (independente da data de vencimento)
          { 
            status: "PAID",
            paymentDate: { gte: start, lte: end }
          }
        ]
      },
      include: {
        Category: true,
      },
    });

    const totalExpenses = expenses.reduce((sum: number, exp: any) => sum + exp.amount, 0);
    const totalFees = expenses.reduce((sum: number, exp: any) => sum + (exp.feeAmount || 0), 0);

    // Despesas de cartão (filtra pela data de compra para evitar duplicação)
    const creditCardExpenses = await prisma.creditCardExpense.findMany({
      where: {
        purchaseDate: { gte: start, lte: end },
      },
      include: {
        Category: true,
        Invoice: true,
      },
    });

    const totalCreditCardExpenses = creditCardExpenses.reduce((sum: number, exp: any) => sum + exp.amount, 0);

    // ============= COMPRAS DA FÁBRICA =============
    // IMPORTANTE: As compras já estão incluídas nas despesas através do Expense vinculado.
    // Aqui apenas agregamos para estatísticas de fornecedores, mas NÃO somamos ao total de custos.
    const purchases = await prisma.purchase.findMany({
      where: {
        customerId: null, // 🔑 Apenas compras da fábrica (admin)
        dueDate: { gte: start, lte: end },
      },
      include: {
        Supplier: true,
        Expense: {
          include: {
            Category: true,
          },
        },
      },
    });

    const totalPurchases = purchases.reduce((sum, p) => sum + p.totalAmount, 0);
    const paidPurchases = purchases.filter((p: any) => p.status === "PAID");
    const pendingPurchases = purchases.filter((p: any) => p.status === "PENDING");
    const totalPaidPurchases = paidPurchases.reduce((sum, p) => sum + p.totalAmount, 0);
    const totalPendingPurchases = pendingPurchases.reduce((sum, p) => sum + p.totalAmount, 0);

    // ============= DESPESAS POR CATEGORIA =============
    const expensesByCategory: Record<string, number> = {};

    // Somar despesas normais
    expenses.forEach((exp: any) => {
      const categoryName = exp.Category?.name || "Sem Categoria";
      expensesByCategory[categoryName] = (expensesByCategory[categoryName] || 0) + exp.amount;
    });

    // Somar despesas de cartão
    creditCardExpenses.forEach((exp: any) => {
      const categoryName = exp.Category?.name || "Cartão de Crédito";
      expensesByCategory[categoryName] = (expensesByCategory[categoryName] || 0) + exp.amount;
    });

    // NÃO somar purchases aqui pois já estão incluídas nas despesas normais via Expense vinculado

    // ============= TOP PRODUTOS =============
    const productSales: Record<string, { name: string; quantity: number; revenue: number }> = {};

    orders.forEach((order) => {
      order.OrderItem.forEach((item: any) => {
        const productName = item.Product?.name || "Produto Removido";
        if (!productSales[productName]) {
          productSales[productName] = { name: productName, quantity: 0, revenue: 0 };
        }
        productSales[productName].quantity += item.quantity;
        productSales[productName].revenue += item.quantity * item.unitPrice;
      });
    });

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    // ============= TOP CLIENTES =============
    const customerSales: Record<string, { name: string; orders: number; revenue: number }> = {};

    orders.forEach((order) => {
      if (order.Customer?.name) {
        const customerName = order.Customer.name;
        if (!customerSales[customerName]) {
          customerSales[customerName] = { name: customerName, orders: 0, revenue: 0 };
        }
        customerSales[customerName].orders += 1;
        customerSales[customerName].revenue += order.total;
      }
    });

    const topCustomers = Object.values(customerSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // ============= DRE =============
    // Separar despesas por tipo para cálculo correto do Lucro Bruto
    const expensesByType: Record<string, number> = {
      OPERATIONAL: 0,
      PRODUCTS: 0,
      RAW_MATERIALS: 0,
      INVESTMENT: 0,
      PROLABORE: 0,
      OTHER: 0
    };

    // Somar despesas normais por tipo
    expenses.forEach((exp: any) => {
      const expenseType = exp.expenseType || 'OTHER';
      expensesByType[expenseType] += exp.amount;
    });

    // Somar despesas de cartão por tipo
    creditCardExpenses.forEach((exp: any) => {
      const expenseType = exp.expenseType || 'OTHER';
      expensesByType[expenseType] += exp.amount;
    });

    // NÃO somar purchases no expensesByType porque já estão incluídas nas despesas normais

    // Lucro Bruto = Faturamento - Despesas Operacionais - Despesas com Produtos - Matérias-Primas
    const grossProfit = netRevenue - expensesByType.OPERATIONAL - expensesByType.PRODUCTS - expensesByType.RAW_MATERIALS;
    
    // Lucro Líquido = Lucro Bruto - Investimentos - Pró-labore
    const netIncome = grossProfit - expensesByType.INVESTMENT - expensesByType.PROLABORE;
    
    // Total de despesas (SEM duplicar as compras que já estão em expenses)
    const totalAllExpenses = totalExpenses + totalCreditCardExpenses;
    const operatingIncome = netRevenue - totalAllExpenses;
    const financialResult = -(totalCardFees + totalFees);

    // ============= EBITDA =============
    // EBITDA = Lucro Operacional + Depreciação + Amortização
    // Como não temos depreciação/amortização, EBITDA ≈ Lucro Operacional
    const ebitda = operatingIncome;
    const ebitdaMargin = netRevenue > 0 ? (ebitda / netRevenue) * 100 : 0;

    // ============= COMPRAS POR FORNECEDOR =============
    const purchasesBySupplier: Record<string, { name: string; total: number; count: number }> = {};

    purchases.forEach((purchase: any) => {
      // 🔧 CORREÇÃO: Verificar se Supplier existe antes de acessar name
      if (!purchase.Supplier) {
        console.warn(`⚠️ Compra ${purchase.id} não tem fornecedor vinculado`);
        return; // Pular esta compra
      }
      
      const supplierName = purchase.Supplier.name;
      if (!purchasesBySupplier[supplierName]) {
        purchasesBySupplier[supplierName] = { name: supplierName, total: 0, count: 0 };
      }
      purchasesBySupplier[supplierName].total += purchase.totalAmount;
      purchasesBySupplier[supplierName].count += 1;
    });

    const topSuppliers = Object.values(purchasesBySupplier)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // ============= VENDAS POR DIA =============
    const salesByDay: Record<string, { date: string; orders: number; revenue: number }> = {};

    orders.forEach((order) => {
      const dateStr = order.createdAt.toISOString().split('T')[0];
      if (!salesByDay[dateStr]) {
        salesByDay[dateStr] = { date: dateStr, orders: 0, revenue: 0 };
      }
      salesByDay[dateStr].orders += 1;
      salesByDay[dateStr].revenue += order.total;
    });

    const dailySales = Object.values(salesByDay).sort((a, b) => a.date.localeCompare(b.date));

    // ============= VENDAS POR VENDEDOR =============
    const salesBySeller: Record<string, { name: string; orders: number; revenue: number }> = {};

    orders.forEach((order) => {
      if (order.Seller?.name) {
        const sellerName = order.Seller.name;
        if (!salesBySeller[sellerName]) {
          salesBySeller[sellerName] = { name: sellerName, orders: 0, revenue: 0 };
        }
        salesBySeller[sellerName].orders += 1;
        salesBySeller[sellerName].revenue += order.total;
      }
    });

    const topSellers = Object.values(salesBySeller)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // ============= RESPOSTA COMPLETA =============
    return NextResponse.json({
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
      dre: {
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
          byCategory: Object.entries(expensesByCategory)
            .map(([name, amount]) => ({ name, amount }))
            .sort((a, b) => b.amount - a.amount),
        },
        operatingIncome,
        financialResult: {
          cardFees: totalCardFees,
          transactionFees: totalFees,
          total: financialResult,
        },
        netIncome,
        metrics: {
          profitMargin: netRevenue > 0 ? (netIncome / netRevenue) * 100 : 0,
          operatingMargin: netRevenue > 0 ? (operatingIncome / netRevenue) * 100 : 0,
        },
      },
      ebitda: {
        value: ebitda,
        margin: ebitdaMargin,
      },
      sales: {
        total: totalRevenue,
        count: orders.length,
        average: orders.length > 0 ? totalRevenue / orders.length : 0,
        byDay: dailySales,
        topProducts,
        topCustomers,
        topSellers,
      },
      purchases: {
        total: totalPurchases,
        paid: totalPaidPurchases,
        pending: totalPendingPurchases,
        count: purchases.length,
        topSuppliers,
      },
    });
  } catch (error: any) {
    console.error("Erro ao gerar relatórios:", error);
    console.error("Stack trace:", error?.stack);
    console.error("Error message:", error?.message);
    return NextResponse.json({ 
      error: "Erro ao gerar relatórios",
      details: error?.message || "Erro desconhecido"
    }, { status: 500 });
  }
}
