export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth, startOfDay, endOfDay, subMonths } from "date-fns";

export async function GET(req: NextRequest) {
  try {
    console.log(`🔍 [DASHBOARD] Iniciando carregamento...`);
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).userType !== "CUSTOMER") {
      console.error(`❌ [DASHBOARD] Acesso negado`);
      return NextResponse.json(
        { error: "Acesso negado" },
        { status: 401 }
      );
    }

    const customerId = (session.user as any).customerId;
    if (!customerId) {
      console.error(`❌ [DASHBOARD] Cliente não identificado`);
      return NextResponse.json(
        { error: "Cliente não identificado" },
        { status: 400 }
      );
    }

    console.log(`✅ [DASHBOARD] Cliente ID: ${customerId}`);

    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") || new Date().toISOString().slice(0, 7);
    
    const startDate = startOfMonth(new Date(month));
    const endDate = endOfMonth(new Date(month));
    
    console.log(`📅 [DASHBOARD] Período: ${startDate.toISOString()} até ${endDate.toISOString()}`);

    // Métricas do mês
    let sales = [];
    try {
      sales = await prisma.clientSale.findMany({
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
      console.log(`✅ [DASHBOARD] ${sales.length} vendas encontradas`);
    } catch (salesError) {
      console.error(`❌ [DASHBOARD] Erro ao buscar vendas:`, salesError);
      throw salesError;
    }

    let expenses = [];
    try {
      expenses = await prisma.clientExpense.findMany({
        where: {
          customerId,
          dueDate: {
            gte: startDate,
            lte: endDate,
          },
        },
      });
      console.log(`✅ [DASHBOARD] ${expenses.length} despesas encontradas`);
    } catch (expensesError) {
      console.error(`❌ [DASHBOARD] Erro ao buscar despesas:`, expensesError);
      throw expensesError;
    }

    let incomes = [];
    try {
      incomes = await prisma.clientIncome.findMany({
        where: {
          customerId,
          dueDate: {
            gte: startDate,
            lte: endDate,
          },
        },
      });
      console.log(`✅ [DASHBOARD] ${incomes.length} receitas encontradas`);
    } catch (incomesError) {
      console.error(`❌ [DASHBOARD] Erro ao buscar receitas:`, incomesError);
      throw incomesError;
    }

    let bankAccounts = [];
    try {
      bankAccounts = await prisma.clientBankAccount.findMany({
        where: {
          customerId,
          isActive: true,
        },
      });
      console.log(`✅ [DASHBOARD] ${bankAccounts.length} contas bancárias encontradas`);
    } catch (accountsError) {
      console.error(`❌ [DASHBOARD] Erro ao buscar contas bancárias:`, accountsError);
      throw accountsError;
    }

    // Buscar compras do cliente no período
    let allPurchases = [];
    try {
      allPurchases = await prisma.purchase.findMany({
        where: {
          customerId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          PurchaseItem: true,
        },
      });
      console.log(`✅ [DASHBOARD] ${allPurchases.length} compras encontradas`);
    } catch (purchasesError) {
      console.error(`❌ [DASHBOARD] Erro ao buscar compras:`, purchasesError);
      throw purchasesError;
    }

    // 🔒 FILTRAR apenas compras de pedidos ENTREGUES
    // (Purchase só deve aparecer no módulo de gestão se o pedido foi DELIVERED)
    console.log(`\n📦 [DASHBOARD] Filtrando compras...`)
    console.log(`   Total de compras encontradas: ${allPurchases.length}`)
    
    // 🚀 OTIMIZAÇÃO: Buscar TODOS os pedidos de uma vez só
    let relatedOrders: Array<{ orderNumber: string; status: string }> = [];
    try {
      const invoiceNumbers = allPurchases
        .filter((p: any) => p.invoiceNumber)
        .map((p: any) => p.invoiceNumber as string);
      
      if (invoiceNumbers.length > 0) {
        relatedOrders = await prisma.order.findMany({
          where: {
            orderNumber: { in: invoiceNumbers },
            customerId
          },
          select: {
            orderNumber: true,
            status: true
          }
        });
        console.log(`   ✅ ${relatedOrders.length} pedidos relacionados encontrados`);
      }
    } catch (ordersError) {
      console.error(`   ❌ Erro ao buscar pedidos relacionados:`, ordersError);
      relatedOrders = [];
    }

    // Criar mapa de pedidos para acesso rápido
    const ordersMap = new Map(
      relatedOrders.map((o: any) => [o.orderNumber, o.status])
    );
    
    // Filtrar compras
    const purchases = allPurchases.filter((purchase: any) => {
      // Se não tem invoiceNumber, é compra manual (inclui)
      if (!purchase.invoiceNumber) {
        console.log(`   ✅ Compra ${purchase.purchaseNumber} - Compra manual (sem pedido)`);
        return true;
      }
      
      // Se tem invoiceNumber, verificar status do pedido
      const orderStatus = ordersMap.get(purchase.invoiceNumber);
      
      if (!orderStatus) {
        console.log(`   ⚠️ Compra ${purchase.purchaseNumber} - Pedido não encontrado`);
        return false;
      }
      
      if (orderStatus === 'DELIVERED') {
        console.log(`   ✅ Compra ${purchase.purchaseNumber} - Pedido ENTREGUE`);
        return true;
      }
      
      console.log(`   ⏳ Compra ${purchase.purchaseNumber} - Pedido ${orderStatus}`);
      return false;
    });
    
    console.log(`   📊 Total de compras filtradas: ${purchases.length}`);

    // Cálculos
    const totalRevenue = sales.reduce((sum: number, sale: any) => sum + sale.total, 0);
    
    // Despesas
    const totalExpenses = expenses.reduce((sum: number, exp: any) => sum + exp.amount, 0);
    const paidExpenses = expenses
      .filter((exp: any) => exp.status === "PAID")
      .reduce((sum: number, exp: any) => sum + exp.amount, 0);
    const pendingExpenses = expenses
      .filter((exp: any) => exp.status === "PENDING")
      .reduce((sum: number, exp: any) => sum + exp.amount, 0);
    const overdueExpenses = expenses
      .filter((exp: any) => exp.status === "OVERDUE")
      .reduce((sum: number, exp: any) => sum + exp.amount, 0);

    // Separar investimentos e pró-labore das despesas
    const investments = expenses
      .filter((exp: any) => exp.category && exp.category.toLowerCase().includes("investimento"))
      .reduce((sum: number, exp: any) => sum + exp.amount, 0);
    
    const proLabore = expenses
      .filter((exp: any) => exp.category && (
        exp.category.toLowerCase().includes("pró-labore") || 
        exp.category.toLowerCase().includes("prolabore")
      ))
      .reduce((sum: number, exp: any) => sum + exp.amount, 0);

    const totalIncome = incomes.reduce((sum: number, inc: any) => sum + inc.amount, 0);
    const receivedIncome = incomes
      .filter((inc: any) => inc.status === "RECEIVED")
      .reduce((sum: number, inc: any) => sum + inc.amount, 0);

    // Cálculo de compras (pedidos feitos ao fornecedor)
    const totalPurchases = purchases.reduce((sum: number, purchase: any) => sum + purchase.totalAmount, 0);
    const totalPurchaseItems = purchases.reduce((sum: number, purchase: any) => {
      return sum + purchase.PurchaseItem.reduce((itemSum: number, item: any) => itemSum + item.quantity, 0);
    }, 0);

    // Lucro Bruto = Faturamento - Compras
    const grossProfit = totalRevenue - totalPurchases;
    
    // Lucro Líquido = Lucro Bruto - Despesas - Investimentos - Pró-labore
    const netProfit = grossProfit - paidExpenses - investments - proLabore;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    const totalBalance = bankAccounts.reduce((sum: number, acc: any) => sum + acc.balance, 0);

    // Produtos mais vendidos
    const productSales: Record<string, { name: string; quantity: number; revenue: number }> = {};
    
    sales.forEach((sale: any) => {
      sale.Items.forEach((item: any) => {
        if (!productSales[item.productId]) {
          productSales[item.productId] = {
            name: item.productName,
            quantity: 0,
            revenue: 0,
          };
        }
        productSales[item.productId].quantity += item.quantity;
        productSales[item.productId].revenue += item.totalPrice;
      });
    });

    const topProducts = Object.entries(productSales)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Vendas diárias
    const dailySales: Record<string, number> = {};
    sales.forEach((sale: any) => {
      const day = sale.createdAt.toISOString().split("T")[0];
      dailySales[day] = (dailySales[day] || 0) + sale.total;
    });

    // Metas (com tratamento de erro)
    let config = null;
    try {
      config = await prisma.clientManagementConfig.findUnique({
        where: { customerId },
      });
    } catch (configError) {
      console.warn(`⚠️ [DASHBOARD] Erro ao buscar config (pode não existir ainda):`, configError);
    }

    const monthlyRevenueGoal = config?.monthlyRevenueGoal || 0;
    const monthlyUnitsSoldGoal = config?.monthlyUnitsSoldGoal || 0;
    const totalUnitsSold = sales.reduce((sum: number, sale: any) => sum + sale.Items.reduce((s: number, i: any) => s + i.quantity, 0), 0);
    
    console.log(`✅ [DASHBOARD] Dados carregados com sucesso!`);

    // Comparativo com mês anterior
    let lastMonthSales = [];
    let revenueGrowth = 0;
    try {
      const lastMonthStart = startOfMonth(subMonths(startDate, 1));
      const lastMonthEnd = endOfMonth(subMonths(startDate, 1));
      
      lastMonthSales = await prisma.clientSale.findMany({
        where: {
          customerId,
          createdAt: {
            gte: lastMonthStart,
            lte: lastMonthEnd,
          },
        },
      });
      console.log(`✅ [DASHBOARD] ${lastMonthSales.length} vendas do mês anterior encontradas`);

      const lastMonthRevenue = lastMonthSales.reduce((sum: number, sale: any) => sum + sale.total, 0);
      revenueGrowth = lastMonthRevenue > 0 
        ? ((totalRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
        : 0;
    } catch (lastMonthError) {
      console.error(`❌ [DASHBOARD] Erro ao buscar vendas do mês anterior:`, lastMonthError);
      // Continua sem o crescimento de receita
      revenueGrowth = 0;
    }

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalRevenue,
          totalPurchases,
          totalPurchaseItems,
          totalExpenses: paidExpenses,
          pendingExpenses,
          overdueExpenses,
          grossProfit,
          investments,
          proLabore,
          netProfit: netProfit,
          profitMargin,
          totalBalance,
          totalSales: sales.length,
          totalUnitsSold,
          revenueGrowth,
        },
        goals: {
          monthlyRevenueGoal,
          monthlyUnitsSoldGoal,
          revenueProgress: monthlyRevenueGoal > 0 ? (totalRevenue / monthlyRevenueGoal) * 100 : 0,
          unitsProgress: monthlyUnitsSoldGoal > 0 ? (totalUnitsSold / monthlyUnitsSoldGoal) * 100 : 0,
        },
        topProducts,
        dailySales,
        bankAccounts: bankAccounts.map((acc: any) => ({
          id: acc.id,
          name: acc.name,
          balance: acc.balance,
          color: acc.color,
        })),
      },
    });
  } catch (error) {
    console.error("❌ [DASHBOARD] Erro fatal:", error);
    console.error("❌ [DASHBOARD] Stack:", (error as Error)?.stack);
    return NextResponse.json(
      { 
        success: false,
        error: "Erro ao carregar dashboard",
        details: (error as Error)?.message 
      },
      { status: 500 }
    );
  }
}
