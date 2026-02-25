export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { startOfMonth, endOfMonth, startOfYear, endOfYear, eachMonthOfInterval, format } from "date-fns";
import { ptBR } from "date-fns/locale";

// =====================================================================
// 🔧 AGORA USA expenseType DIRETAMENTE (mais confiável que mapeamento manual)
// Alinhado com Dashboard Financeiro e DRE
// =====================================================================

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());

    console.log("🔍 [MONTHLY_SUMMARY_API] Buscando dados para o ano:", year);

    const yearStart = startOfYear(new Date(year, 0, 1));
    const yearEnd = endOfYear(new Date(year, 0, 1));
    const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });

    // Buscar todos os dados do ano
    const [orders, expensesRaw, creditCardExpenses, purchasesRaw] = await Promise.all([
      // Pedidos (faturamento)
      prisma.order.findMany({
        where: {
          createdAt: { gte: yearStart, lte: yearEnd },
          status: { not: "CANCELLED" }
        }
      }),

      // 🔑 TODAS as despesas COM Purchase vinculada para determinar competência
      prisma.expense.findMany({
        include: {
          Purchase: {
            select: { purchaseDate: true }
          }
        }
      }),

      // Despesas de cartão de crédito
      prisma.creditCardExpense.findMany({
        where: {
          purchaseDate: { gte: yearStart, lte: yearEnd }
        }
      }),

      // Compras da fábrica SEM Expense vinculada E SEM cartão de crédito (para não duplicar!)
      // Compras com cartão já geram CreditCardExpense, então não devem ser somadas aqui
      prisma.purchase.findMany({
        where: {
          customerId: null,
          purchaseDate: { gte: yearStart, lte: yearEnd },
          expenseId: null, // 🔑 APENAS compras SEM expense
          // 🆕 Excluir compras de cartão de crédito - já estão em CreditCardExpenses!
          NOT: {
            paymentMethod: { in: ['CARTAO_CREDITO', 'CREDIT_CARD', 'CARD', 'Cartão de Crédito'] }
          }
        }
      })
    ]);

    // 🔑 Filtrar despesas por DATA DE COMPETÊNCIA (não vencimento!)
    const expenses = expensesRaw.filter((exp: any) => {
      // Determinar data de competência
      let competenceDate: Date | null = null;
      
      if (exp.competenceDate) {
        competenceDate = new Date(exp.competenceDate);
      } else if (exp.Purchase?.purchaseDate) {
        competenceDate = new Date(exp.Purchase.purchaseDate);
      } else if (exp.status === 'PAID' && exp.paymentDate) {
        competenceDate = new Date(exp.paymentDate);
      } else if (exp.dueDate) {
        competenceDate = new Date(exp.dueDate);
      }

      // Verificar se está no ano
      return competenceDate && competenceDate >= yearStart && competenceDate <= yearEnd;
    });

    // Adicionar campo calculado _competenceDate para usar no filtro por mês
    const expensesWithCompetence = expenses.map((exp: any) => {
      let _competenceDate: Date;
      if (exp.competenceDate) {
        _competenceDate = new Date(exp.competenceDate);
      } else if (exp.Purchase?.purchaseDate) {
        _competenceDate = new Date(exp.Purchase.purchaseDate);
      } else if (exp.status === 'PAID' && exp.paymentDate) {
        _competenceDate = new Date(exp.paymentDate);
      } else {
        _competenceDate = new Date(exp.dueDate);
      }
      return { ...exp, _competenceDate };
    });

    const purchases = purchasesRaw;

    console.log("🔍 [MONTHLY_SUMMARY_API] Dados encontrados:", {
      orders: orders.length,
      expensesNoAno: expensesWithCompetence.length,
      creditCardExpenses: creditCardExpenses.length,
      purchasesWithoutExpense: purchases.length
    });

    // Processar dados por mês usando categoryId
    const monthlyData = months.map((month) => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);

      // 🔑 Função para filtrar expenses por COMPETÊNCIA (não vencimento!)
      const filterExpenseByMonth = (exp: any) => {
        const expDate = exp._competenceDate;
        return expDate >= monthStart && expDate <= monthEnd;
      };

      // Função para filtrar creditCardExpenses por período
      const filterCCByMonth = (exp: any) => {
        const expDate = new Date(exp.purchaseDate);
        return expDate >= monthStart && expDate <= monthEnd;
      };

      // Faturamento mensal (pedidos)
      const faturamentoMensal = orders
        .filter((order: any) => {
          const orderDate = new Date(order.createdAt);
          return orderDate >= monthStart && orderDate <= monthEnd;
        })
        .reduce((sum: number, order: any) => sum + Number(order.total || 0), 0);

      // ===== DESPESAS OPERACIONAIS (por expenseType) =====
      const despesasOperacionais = expensesWithCompetence
        .filter((exp: any) => filterExpenseByMonth(exp) && exp.expenseType === 'OPERATIONAL')
        .reduce((sum: number, exp: any) => sum + exp.amount + (exp.feeAmount || 0), 0);
      
      const despesasOperacionaisCartao = creditCardExpenses
        .filter((exp: any) => filterCCByMonth(exp) && exp.expenseType === 'OPERATIONAL')
        .reduce((sum: number, exp: any) => sum + exp.amount, 0);

      // ===== DESPESAS COM PRODUTOS (por expenseType) =====
      const despesasProdutos = expensesWithCompetence
        .filter((exp: any) => filterExpenseByMonth(exp) && exp.expenseType === 'PRODUCTS')
        .reduce((sum: number, exp: any) => sum + exp.amount + (exp.feeAmount || 0), 0);
      
      const despesasProdutosCartao = creditCardExpenses
        .filter((exp: any) => filterCCByMonth(exp) && exp.expenseType === 'PRODUCTS')
        .reduce((sum: number, exp: any) => sum + exp.amount, 0);

      // ===== COMPRAS DE MERCADORIA (por expenseType + Purchase sem Expense) =====
      const comprasExpenses = expensesWithCompetence
        .filter((exp: any) => filterExpenseByMonth(exp) && exp.expenseType === 'RAW_MATERIALS')
        .reduce((sum: number, exp: any) => sum + exp.amount + (exp.feeAmount || 0), 0);
      
      const comprasCartao = creditCardExpenses
        .filter((exp: any) => filterCCByMonth(exp) && exp.expenseType === 'RAW_MATERIALS')
        .reduce((sum: number, exp: any) => sum + exp.amount, 0);
      
      // Compras SEM Expense (para não duplicar!)
      const comprasPurchases = purchases
        .filter((p: any) => {
          const pDate = new Date(p.purchaseDate);
          return pDate >= monthStart && pDate <= monthEnd;
        })
        .reduce((sum: number, p: any) => sum + p.totalAmount, 0);

      // ===== INVESTIMENTOS (por expenseType) =====
      const investimentos = expensesWithCompetence
        .filter((exp: any) => filterExpenseByMonth(exp) && exp.expenseType === 'INVESTMENT')
        .reduce((sum: number, exp: any) => sum + exp.amount + (exp.feeAmount || 0), 0);
      
      const investimentosCartao = creditCardExpenses
        .filter((exp: any) => filterCCByMonth(exp) && exp.expenseType === 'INVESTMENT')
        .reduce((sum: number, exp: any) => sum + exp.amount, 0);

      // ===== PRÓ-LABORE (por expenseType) =====
      const prolabore = expensesWithCompetence
        .filter((exp: any) => filterExpenseByMonth(exp) && exp.expenseType === 'PROLABORE')
        .reduce((sum: number, exp: any) => sum + exp.amount + (exp.feeAmount || 0), 0);
      
      const prolaboreCartao = creditCardExpenses
        .filter((exp: any) => filterCCByMonth(exp) && exp.expenseType === 'PROLABORE')
        .reduce((sum: number, exp: any) => sum + exp.amount, 0);

      // Totais
      const totalDespesasOperacionais = despesasOperacionais + despesasOperacionaisCartao;
      const totalDespesasProdutos = despesasProdutos + despesasProdutosCartao;
      const totalCompras = comprasExpenses + comprasCartao + comprasPurchases;
      const totalInvestimentos = investimentos + investimentosCartao;
      const totalProlabore = prolabore + prolaboreCartao;
      
      // Cálculos
      const lucroBruto = faturamentoMensal - totalDespesasOperacionais - totalDespesasProdutos - totalCompras;
      const lucroLiquido = lucroBruto - totalInvestimentos - totalProlabore;

      return {
        month: format(month, "MMM", { locale: ptBR }),
        fullMonth: format(month, "MMMM", { locale: ptBR }),
        year: format(month, "yyyy"),
        faturamentoMensal,
        despesasProdutos: totalDespesasProdutos,
        comprasMateriasPrimas: totalCompras,
        despesasOperacionais: totalDespesasOperacionais,
        lucroBruto,
        investimentos: totalInvestimentos,
        prolabore: totalProlabore,
        lucroLiquido
      };
    });

    // Totais anuais
    const yearlyTotals = {
      faturamentoMensal: monthlyData.reduce((sum, m) => sum + m.faturamentoMensal, 0),
      despesasProdutos: monthlyData.reduce((sum, m) => sum + m.despesasProdutos, 0),
      comprasMateriasPrimas: monthlyData.reduce((sum, m) => sum + m.comprasMateriasPrimas, 0),
      despesasOperacionais: monthlyData.reduce((sum, m) => sum + m.despesasOperacionais, 0),
      lucroBruto: monthlyData.reduce((sum, m) => sum + m.lucroBruto, 0),
      investimentos: monthlyData.reduce((sum, m) => sum + m.investimentos, 0),
      prolabore: monthlyData.reduce((sum, m) => sum + m.prolabore, 0),
      lucroLiquido: monthlyData.reduce((sum, m) => sum + m.lucroLiquido, 0)
    };

    console.log("✅ [MONTHLY_SUMMARY_API] Janeiro calculado:", monthlyData[0]);
    console.log("✅ [MONTHLY_SUMMARY_API] Totais anuais:", yearlyTotals);

    return NextResponse.json({
      year,
      monthlyData,
      yearlyTotals
    });

  } catch (error: any) {
    console.error("Erro ao calcular resumo mensal:", error);
    return NextResponse.json({ error: "Erro ao calcular resumo mensal" }, { status: 500 });
  }
}
