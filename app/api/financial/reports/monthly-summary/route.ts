
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth-options";

// GET - Resumo Mensal de Faturamento e Despesas
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = Number(searchParams.get("year")) || new Date().getFullYear();

    console.log(`📊 Calculando resumo mensal para o ano ${year}`);

    // Meses em português
    const monthNames = [
      "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
      "Jul", "Ago", "Set", "Out", "Nov", "Dez"
    ];

    const monthlyData = [];

    for (let month = 0; month < 12; month++) {
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

      console.log(`\n📅 Processando ${monthNames[month]}/${year}`);
      console.log(`   Período: ${startDate.toISOString()} até ${endDate.toISOString()}`);

      // 1. FATURAMENTO (Pedidos entregues no período)
      const orders = await prisma.order.findMany({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          status: "DELIVERED",
        },
        select: {
          total: true,
        },
      });

      const revenue = orders.reduce((sum: number, order: any) => sum + order.total, 0);
      console.log(`   💰 Faturamento: R$ ${revenue.toFixed(2)}`);

      // 2. DESPESAS OPERACIONAIS (Despesas normais pagas no período)
      const operationalExpenses = await prisma.expense.findMany({
        where: {
          dueDate: { gte: startDate, lte: endDate },
          expenseType: 'OPERATIONAL',
        },
        select: {
          amount: true,
        },
      });

      const operationalTotal = operationalExpenses.reduce((sum: number, exp: any) => sum + exp.amount, 0);
      console.log(`   🔧 Despesas Operacionais: R$ ${operationalTotal.toFixed(2)}`);

      // 3. DESPESAS COM PRODUTOS (Despesas do tipo PRODUCTS)
      const productExpenses = await prisma.expense.findMany({
        where: {
          dueDate: { gte: startDate, lte: endDate },
          expenseType: 'PRODUCTS',
        },
        select: {
          amount: true,
        },
      });

      const productTotal = productExpenses.reduce((sum: number, exp: any) => sum + exp.amount, 0);
      console.log(`   📦 Despesas com Produtos: R$ ${productTotal.toFixed(2)}`);

      // 4. DESPESAS COM COMPRAS (Purchase da fábrica)
      // IMPORTANTE: Buscar APENAS compras da fábrica (customerId = null)
      const purchases = await prisma.purchase.findMany({
        where: {
          customerId: null, // 🔑 Apenas compras da fábrica
          dueDate: { gte: startDate, lte: endDate },
        },
        select: {
          totalAmount: true,
        },
      });

      const purchaseTotal = purchases.reduce((sum: number, purchase: any) => sum + purchase.totalAmount, 0);
      console.log(`   🛒 Despesas com Compras (${purchases.length} compras): R$ ${purchaseTotal.toFixed(2)}`);

      // 5. INVESTIMENTOS (Despesas do tipo INVESTMENT)
      const investments = await prisma.expense.findMany({
        where: {
          dueDate: { gte: startDate, lte: endDate },
          expenseType: 'INVESTMENT',
        },
        select: {
          amount: true,
        },
      });

      const investmentTotal = investments.reduce((sum, inv) => sum + inv.amount, 0);
      console.log(`   💼 Investimentos: R$ ${investmentTotal.toFixed(2)}`);

      // 6. PRÓ-LABORE (Despesas do tipo PROLABORE)
      const proLabore = await prisma.expense.findMany({
        where: {
          dueDate: { gte: startDate, lte: endDate },
          expenseType: 'PROLABORE',
        },
        select: {
          amount: true,
        },
      });

      const proLaboreTotal = proLabore.reduce((sum, pl) => sum + pl.amount, 0);
      console.log(`   👔 Pró-labore: R$ ${proLaboreTotal.toFixed(2)}`);

      // 7. CALCULAR LUCRO/PREJUÍZO
      const totalOperationalExpenses = operationalTotal + productTotal + purchaseTotal;
      const operationalProfit = revenue - totalOperationalExpenses; // Lucro Bruto (Operacional)
      const netProfit = operationalProfit - investmentTotal - proLaboreTotal; // Lucro Líquido

      console.log(`   📊 Total Despesas Operacionais: R$ ${totalOperationalExpenses.toFixed(2)}`);
      console.log(`   💰 Lucro Operacional (Bruto): R$ ${operationalProfit.toFixed(2)}`);
      console.log(`   💼 Investimentos: R$ ${investmentTotal.toFixed(2)}`);
      console.log(`   👔 Pró-labore: R$ ${proLaboreTotal.toFixed(2)}`);
      console.log(`   💵 Lucro Líquido: R$ ${netProfit.toFixed(2)}`);

      monthlyData.push({
        month: monthNames[month],
        revenue,
        operationalExpenses: operationalTotal,
        productExpenses: productTotal,
        purchaseExpenses: purchaseTotal,
        investmentExpenses: investmentTotal,
        proLaboreExpenses: proLaboreTotal,
        operationalProfit, // Lucro Bruto
        netProfit, // Lucro Líquido
      });
    }

    // Calcular totais anuais
    const yearlyTotals = {
      revenue: monthlyData.reduce((sum, m) => sum + m.revenue, 0),
      operationalExpenses: monthlyData.reduce((sum, m) => sum + m.operationalExpenses, 0),
      productExpenses: monthlyData.reduce((sum, m) => sum + m.productExpenses, 0),
      purchaseExpenses: monthlyData.reduce((sum, m) => sum + m.purchaseExpenses, 0),
      investmentExpenses: monthlyData.reduce((sum, m) => sum + m.investmentExpenses, 0),
      proLaboreExpenses: monthlyData.reduce((sum, m) => sum + m.proLaboreExpenses, 0),
      operationalProfit: monthlyData.reduce((sum, m) => sum + m.operationalProfit, 0),
      netProfit: monthlyData.reduce((sum, m) => sum + m.netProfit, 0),
    };

    console.log(`\n📊 RESUMO ANUAL ${year}:`);
    console.log(`   💰 Faturamento Total: R$ ${yearlyTotals.revenue.toFixed(2)}`);
    console.log(`   🔧 Despesas Operacionais: R$ ${yearlyTotals.operationalExpenses.toFixed(2)}`);
    console.log(`   📦 Despesas com Produtos: R$ ${yearlyTotals.productExpenses.toFixed(2)}`);
    console.log(`   🛒 Despesas com Compras: R$ ${yearlyTotals.purchaseExpenses.toFixed(2)}`);
    console.log(`   💼 Investimentos: R$ ${yearlyTotals.investmentExpenses.toFixed(2)}`);
    console.log(`   👔 Pró-labore: R$ ${yearlyTotals.proLaboreExpenses.toFixed(2)}`);
    console.log(`   💰 Lucro Operacional (Bruto): R$ ${yearlyTotals.operationalProfit.toFixed(2)}`);
    console.log(`   💵 Lucro Líquido: R$ ${yearlyTotals.netProfit.toFixed(2)}`);

    return NextResponse.json({
      year,
      monthlyData,
      yearlyTotals,
    });
  } catch (error) {
    console.error("❌ Erro ao gerar resumo mensal:", error);
    return NextResponse.json({ error: "Erro ao gerar resumo mensal" }, { status: 500 });
  }
}
