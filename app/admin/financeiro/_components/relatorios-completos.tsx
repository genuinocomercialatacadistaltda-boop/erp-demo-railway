"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Package,
  Calendar,
  BarChart3,
  AlertCircle,
  ArrowDown,
  ArrowUp,
} from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

// Interfaces para os relatórios
interface MonthlySummary {
  revenue: number;
  operationalExpenses: number;
  productExpenses: number;
  purchaseExpenses: number;
  investments: number;
  proLabore: number;
  grossProfit: number;
  netProfit: number;
  totalExpenses: number;
}

interface CompleteReport {
  revenue: {
    gross: number;
    net: number;
    total: number;
    cardFees: number;
    discounts: number;
  };
  expenses: {
    total: number;
    fees: number;
    creditCard: number;
    byCategory: Record<string, number>;
  };
  purchases: {
    total: number;
    paid: number;
    pending: number;
  };
  topProducts: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
  topCustomers: Array<{
    name: string;
    orders: number;
    revenue: number;
  }>;
}

interface SalesReport {
  summary: {
    totalSales: number;
    totalOrders: number;
    averageTicket: number;
    daysWithSales: number;
  };
  dailySales: Array<{
    date: string;
    dayOfWeek: string;
    totalSales: number;
    ordersCount: number;
    averageTicket: number;
  }>;
  weekDaySales: Array<{
    dayName: string;
    totalSales: number;
    ordersCount: number;
    averageTicket: number;
  }>;
  highlights: {
    bestDay: any;
    worstDay: any;
    bestWeekDay: any;
    worstWeekDay: any;
  };
}

interface ExpensesReport {
  summary: {
    totalExpenses: number;
    totalCount: number;
    averagePerDay: number;
    daysWithExpenses: number;
  };
  dailyExpenses: Array<{
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
  }>;
  weekDayExpenses: Array<{
    dayName: string;
    totalExpenses: number;
    expensesCount: number;
    expensesByStatus: {
      paid: number;
      pending: number;
      overdue: number;
    };
  }>;
  highlights: {
    highestDay: any;
    lowestDay: any;
    highestWeekDay: any;
    lowestWeekDay: any;
  };
}

interface PurchasesReport {
  summary: {
    totalPurchases: number;
    totalCount: number;
    averagePerDay: number;
    daysWithPurchases: number;
  };
  dailyPurchases: Array<{
    date: string;
    dayOfWeek: string;
    totalPurchases: number;
    purchasesCount: number;
    purchasesBySupplier: Record<string, number>;
    averagePerPurchase: number;
  }>;
  weekDayPurchases: Array<{
    dayName: string;
    totalPurchases: number;
    purchasesCount: number;
    averagePerPurchase: number;
  }>;
  highlights: {
    highestDay: any;
    lowestDay: any;
    highestWeekDay: any;
    lowestWeekDay: any;
  };
}

export default function RelatoriosCompletos() {
  // Inicializar com o mês atual (dia 1 ao último dia do mês)
  const currentDate = new Date();
  const firstDay = startOfMonth(currentDate);
  const lastDay = endOfMonth(currentDate);
  
  const [startDate, setStartDate] = useState(format(firstDay, 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(lastDay, 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  
  // Estados separados para os filtros dos rankings
  const [rankingPeriod, setRankingPeriod] = useState<'custom' | 'today' | 'yesterday' | 'week' | 'month' | 'lastMonth'>('month');
  const [rankingStartDate, setRankingStartDate] = useState(format(firstDay, 'yyyy-MM-dd'));
  const [rankingEndDate, setRankingEndDate] = useState(format(lastDay, 'yyyy-MM-dd'));
  
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(null);
  const [completeReport, setCompleteReport] = useState<CompleteReport | null>(null);
  const [salesReport, setSalesReport] = useState<SalesReport | null>(null);
  const [expensesReport, setExpensesReport] = useState<ExpensesReport | null>(null);
  const [purchasesReport, setPurchasesReport] = useState<PurchasesReport | null>(null);

  // Buscar relatórios automaticamente ao carregar a página
  useEffect(() => {
    fetchReports();
  }, []);

  // Função para aplicar filtro rápido de período nos rankings
  const applyRankingPeriod = (period: typeof rankingPeriod) => {
    const now = new Date();
    let start: Date, end: Date;

    switch (period) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'yesterday':
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0);
        end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
        break;
      case 'week':
        start = new Date(now);
        start.setDate(start.getDate() - 7);
        end = now;
        break;
      case 'month':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case 'lastMonth':
        const lastMonth = new Date(now);
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        start = startOfMonth(lastMonth);
        end = endOfMonth(lastMonth);
        break;
      default:
        return;
    }

    setRankingPeriod(period);
    setRankingStartDate(format(start, 'yyyy-MM-dd'));
    setRankingEndDate(format(end, 'yyyy-MM-dd'));
    
    // Buscar apenas os rankings com as novas datas
    fetchRankings(format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'));
  };

  // Função separada para buscar apenas os rankings (produtos e clientes)
  const fetchRankings = async (start: string, end: string) => {
    try {
      const params = new URLSearchParams({
        startDate: start,
        endDate: end,
      });

      console.log("🔍 Buscando rankings para período:", start, "até", end);
      const completeRes = await fetch(`/api/financial/reports/complete?${params}`);
      
      if (completeRes.ok) {
        const completeData = await completeRes.json();
        console.log("✅ Dados dos rankings recebidos:", completeData);
        
        // Atualizar apenas os rankings
        setCompleteReport(prev => prev ? {
          ...prev,
          topProducts: completeData.sales?.topProducts || [],
          topCustomers: completeData.sales?.topCustomers || [],
        } : null);
      }
    } catch (error) {
      console.error("Erro ao buscar rankings:", error);
      toast.error("Erro ao buscar rankings");
    }
  };

  const fetchReports = async () => {
    if (!startDate || !endDate) {
      toast.error("Por favor, selecione o período");
      return;
    }

    setLoading(true);

    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
      });

      // Buscar relatório completo (produtos e clientes)
      console.log("🔍 Buscando relatório completo...");
      const completeRes = await fetch(`/api/financial/reports/complete?${params}`);
      console.log("📊 Status do relatório completo:", completeRes.status);
      
      if (completeRes.ok) {
        const completeData = await completeRes.json();
        console.log("✅ Dados do relatório completo recebidos:", completeData);
        
        // Adaptar a estrutura da API para a estrutura esperada pelo componente
        const adaptedData: CompleteReport = {
          revenue: {
            gross: completeData.dre?.revenue?.gross || 0,
            net: completeData.dre?.revenue?.net || 0,
            total: completeData.sales?.total || 0,
            cardFees: completeData.dre?.financialResult?.cardFees || 0,
            discounts: completeData.dre?.revenue?.discounts || 0,
          },
          expenses: {
            total: completeData.dre?.costs?.total || 0,
            fees: completeData.dre?.financialResult?.transactionFees || 0,
            creditCard: completeData.dre?.costs?.creditCardExpenses || 0,
            byCategory: (completeData.dre?.costs?.byCategory || []).reduce((acc: Record<string, number>, item: any) => {
              acc[item.name] = item.amount;
              return acc;
            }, {}),
          },
          purchases: {
            total: completeData.purchases?.total || 0,
            paid: completeData.purchases?.paid || 0,
            pending: completeData.purchases?.pending || 0,
          },
          topProducts: completeData.sales?.topProducts || [],
          topCustomers: completeData.sales?.topCustomers || [],
        };
        
        console.log("📈 Dados adaptados:", adaptedData);
        setCompleteReport(adaptedData);

        // Calcular resumo mensal do relatório completo
        const summary: MonthlySummary = {
          revenue: adaptedData.revenue.total || 0,
          operationalExpenses: 0, // será calculado do relatório de despesas
          productExpenses: 0,
          purchaseExpenses: adaptedData.purchases.total || 0,
          investments: 0,
          proLabore: 0,
          grossProfit: 0,
          netProfit: 0,
          totalExpenses: adaptedData.expenses.total || 0,
        };
        setMonthlySummary(summary);
      }

      // Buscar relatório de vendas
      console.log("🔍 Buscando relatório de vendas...");
      const salesRes = await fetch(`/api/financial/reports/sales-detailed?${params}`);
      console.log("📊 Status do relatório de vendas:", salesRes.status);
      if (salesRes.ok) {
        const salesData = await salesRes.json();
        console.log("✅ Dados de vendas recebidos:", salesData);
        setSalesReport(salesData);
      } else {
        console.error("❌ Erro ao buscar relatório de vendas:", await salesRes.text());
      }

      // Buscar relatório de despesas
      console.log("🔍 Buscando relatório de despesas...");
      const expensesRes = await fetch(`/api/financial/reports/expenses-detailed?${params}`);
      console.log("📊 Status do relatório de despesas:", expensesRes.status);
      if (expensesRes.ok) {
        const expensesData = await expensesRes.json();
        console.log("✅ Dados de despesas recebidos:", expensesData);
        setExpensesReport(expensesData);
      } else {
        console.error("❌ Erro ao buscar relatório de despesas:", await expensesRes.text());
      }

      // Buscar relatório de compras
      console.log("🔍 Buscando relatório de compras...");
      const purchasesRes = await fetch(`/api/financial/reports/purchases-detailed?${params}`);
      console.log("📊 Status do relatório de compras:", purchasesRes.status);
      if (purchasesRes.ok) {
        const purchasesData = await purchasesRes.json();
        console.log("✅ Dados de compras recebidos:", purchasesData);
        setPurchasesReport(purchasesData);
      } else {
        console.error("❌ Erro ao buscar relatório de compras:", await purchasesRes.text());
      }

      console.log("🎯 Estado final dos relatórios:");
      console.log("- completeReport:", completeReport);
      console.log("- salesReport:", salesReport);
      console.log("- expensesReport:", expensesReport);
      console.log("- purchasesReport:", purchasesReport);
      console.log("- monthlySummary:", monthlySummary);

      toast.success("Relatórios carregados com sucesso!");
    } catch (error) {
      console.error("Erro ao carregar relatórios:", error);
      toast.error("Erro ao carregar relatórios");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "Data não disponível";
    try {
      const parsedDate = parseISO(dateStr);
      if (isNaN(parsedDate.getTime())) {
        return "Data inválida";
      }
      return format(parsedDate, "dd/MM/yyyy", { locale: ptBR });
    } catch (error) {
      console.error("Erro ao formatar data:", dateStr, error);
      return "Data inválida";
    }
  };

  return (
    <div className="space-y-6">
      {/* Filtros de Período */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            Selecione o Período para Análise
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="startDate">Data Inicial</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="endDate">Data Final</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <Button
              onClick={fetchReports}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? "Gerando..." : "Gerar Relatórios"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Abas de Relatórios */}
      {(monthlySummary || salesReport || expensesReport || purchasesReport || completeReport) && (
        <Tabs defaultValue="resumo" className="space-y-4">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="resumo">
              <BarChart3 className="h-4 w-4 mr-2" />
              Resumo
            </TabsTrigger>
            <TabsTrigger value="vendas">
              <DollarSign className="h-4 w-4 mr-2" />
              Vendas
            </TabsTrigger>
            <TabsTrigger value="produtos">
              <Package className="h-4 w-4 mr-2" />
              Produtos
            </TabsTrigger>
            <TabsTrigger value="clientes">
              <Calendar className="h-4 w-4 mr-2" />
              Clientes
            </TabsTrigger>
            <TabsTrigger value="despesas">
              <TrendingDown className="h-4 w-4 mr-2" />
              Despesas
            </TabsTrigger>
            <TabsTrigger value="compras">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Compras
            </TabsTrigger>
          </TabsList>

          {/* Resumo Mensal com Gráfico */}
          <TabsContent value="resumo" className="space-y-6">
            {completeReport && monthlySummary && (
              <>
                {/* Cards de Resumo */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600">
                        Faturamento Bruto
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">
                        {formatCurrency(completeReport.revenue.gross)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600">
                        Faturamento Líquido
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-blue-600">
                        {formatCurrency(completeReport.revenue.net)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600">
                        Despesas Totais
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-600">
                        {formatCurrency(monthlySummary.totalExpenses)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Operacionais + Produtos + Compras
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600">
                        Lucro Líquido
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className={`text-2xl font-bold ${
                        (completeReport.revenue.net - monthlySummary.totalExpenses) >= 0 
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }`}>
                        {formatCurrency(completeReport.revenue.net - monthlySummary.totalExpenses)}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Gráfico de Faturamento vs Retiradas - NOVO DESIGN */}
                <Card className="shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50">
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <BarChart3 className="h-6 w-6 text-blue-600" />
                      Visão Geral: Entradas vs Saídas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-8">
                    {/* Gráfico de Barras Verticais */}
                    <div className="flex items-end justify-center gap-8 h-96 mb-8">
                      {/* Barra de Faturamento Bruto */}
                      <div className="flex flex-col items-center flex-1 max-w-xs">
                        <div className="relative w-full h-full flex flex-col justify-end">
                          <div
                            className="w-full bg-gradient-to-t from-green-500 to-green-400 rounded-t-2xl shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col items-center justify-end pb-4"
                            style={{
                              height: `${Math.max((completeReport.revenue.gross / Math.max(completeReport.revenue.gross, monthlySummary.totalExpenses)) * 100, 10)}%`,
                            }}
                          >
                            <ArrowUp className="h-8 w-8 text-white mb-2 animate-bounce" />
                            <div className="text-center text-white">
                              <div className="text-3xl font-bold mb-1">
                                {formatCurrency(completeReport.revenue.gross)}
                              </div>
                              <div className="text-sm font-medium opacity-90">
                                {((completeReport.revenue.gross / Math.max(completeReport.revenue.gross, monthlySummary.totalExpenses)) * 100).toFixed(0)}%
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 text-center">
                          <div className="text-lg font-bold text-green-600 mb-1">
                            💰 Faturamento Bruto
                          </div>
                          <div className="text-sm text-gray-600">
                            Total de Entradas
                          </div>
                        </div>
                      </div>

                      {/* Barra de Total de Retiradas */}
                      <div className="flex flex-col items-center flex-1 max-w-xs">
                        <div className="relative w-full h-full flex flex-col justify-end">
                          <div
                            className="w-full bg-gradient-to-t from-red-500 to-red-400 rounded-t-2xl shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col items-center justify-end pb-4"
                            style={{
                              height: `${Math.max((monthlySummary.totalExpenses / Math.max(completeReport.revenue.gross, monthlySummary.totalExpenses)) * 100, 10)}%`,
                            }}
                          >
                            <ArrowDown className="h-8 w-8 text-white mb-2 animate-bounce" />
                            <div className="text-center text-white">
                              <div className="text-3xl font-bold mb-1">
                                {formatCurrency(monthlySummary.totalExpenses)}
                              </div>
                              <div className="text-sm font-medium opacity-90">
                                {((monthlySummary.totalExpenses / Math.max(completeReport.revenue.gross, monthlySummary.totalExpenses)) * 100).toFixed(0)}%
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 text-center">
                          <div className="text-lg font-bold text-red-600 mb-1">
                            📤 Total de Retiradas
                          </div>
                          <div className="text-sm text-gray-600">
                            Despesas + Compras
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Linha de Resultado */}
                    <div className="border-t-2 border-gray-200 pt-6">
                      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 text-center">
                        <div className="text-sm font-medium text-gray-600 mb-2">
                          Resultado do Período
                        </div>
                        <div className={`text-4xl font-bold mb-2 ${
                          (completeReport.revenue.gross - monthlySummary.totalExpenses) >= 0 
                            ? 'text-green-600' 
                            : 'text-red-600'
                        }`}>
                          {formatCurrency(completeReport.revenue.gross - monthlySummary.totalExpenses)}
                        </div>
                        <div className="text-sm text-gray-600">
                          {(completeReport.revenue.gross - monthlySummary.totalExpenses) >= 0 
                            ? '✅ Superávit no período' 
                            : '⚠️ Déficit no período'}
                        </div>
                      </div>
                    </div>

                    {/* Detalhamento das Retiradas */}
                    <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card className="bg-orange-50 border-orange-200">
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <div className="text-sm font-medium text-orange-700 mb-2">
                              Despesas Operacionais
                            </div>
                            <div className="text-2xl font-bold text-orange-600">
                              {formatCurrency(completeReport.expenses.total - completeReport.expenses.creditCard)}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card className="bg-purple-50 border-purple-200">
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <div className="text-sm font-medium text-purple-700 mb-2">
                              Cartão de Crédito
                            </div>
                            <div className="text-2xl font-bold text-purple-600">
                              {formatCurrency(completeReport.expenses.creditCard)}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card className="bg-blue-50 border-blue-200">
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <div className="text-sm font-medium text-blue-700 mb-2">
                              Compras de Mercadorias
                            </div>
                            <div className="text-2xl font-bold text-blue-600">
                              {formatCurrency(completeReport.purchases.total)}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Relatório de Vendas */}
          <TabsContent value="vendas" className="space-y-6">
            {salesReport && (
              <>
                {/* Cards de Resumo */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600">
                        Total em Vendas
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">
                        {formatCurrency(salesReport.summary.totalSales)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600">
                        Total de Pedidos
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-blue-600">
                        {salesReport.summary.totalOrders}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600">
                        Ticket Médio
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-purple-600">
                        {formatCurrency(salesReport.summary.averageTicket)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600">
                        Dias com Vendas
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-indigo-600">
                        {salesReport.summary.daysWithSales}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Destaques */}
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="border-green-200 bg-green-50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-green-700">
                        <TrendingUp className="h-5 w-5" />
                        Melhores Desempenhos
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {salesReport?.highlights?.bestDay ? (
                        <div>
                          <div className="text-sm font-medium text-gray-600">
                            📅 Melhor Dia
                          </div>
                          <div className="text-lg font-bold text-green-700">
                            {formatDate(salesReport.highlights.bestDay.date)} (
                            {salesReport.highlights.bestDay.dayOfWeek})
                          </div>
                          <div className="text-sm text-gray-600">
                            {formatCurrency(salesReport.highlights.bestDay.totalSales)} em{" "}
                            {salesReport.highlights.bestDay.ordersCount} pedidos
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">Dados não disponíveis</div>
                      )}

                      {salesReport?.highlights?.bestWeekDay ? (
                        <div>
                          <div className="text-sm font-medium text-gray-600">
                            📊 Melhor Dia da Semana
                          </div>
                          <div className="text-lg font-bold text-green-700">
                            {salesReport.highlights.bestWeekDay.dayName}
                          </div>
                          <div className="text-sm text-gray-600">
                            {formatCurrency(salesReport.highlights.bestWeekDay.totalSales)} em{" "}
                            {salesReport.highlights.bestWeekDay.ordersCount} pedidos
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">Dados não disponíveis</div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-red-200 bg-red-50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-red-700">
                        <TrendingDown className="h-5 w-5" />
                        Menores Desempenhos
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {salesReport?.highlights?.worstDay ? (
                        <div>
                          <div className="text-sm font-medium text-gray-600">
                            📅 Pior Dia
                          </div>
                          <div className="text-lg font-bold text-red-700">
                            {formatDate(salesReport.highlights.worstDay.date)} (
                            {salesReport.highlights.worstDay.dayOfWeek})
                          </div>
                          <div className="text-sm text-gray-600">
                            {formatCurrency(salesReport.highlights.worstDay.totalSales)} em{" "}
                            {salesReport.highlights.worstDay.ordersCount} pedidos
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">Dados não disponíveis</div>
                      )}

                      {salesReport?.highlights?.worstWeekDay ? (
                        <div>
                          <div className="text-sm font-medium text-gray-600">
                            📊 Pior Dia da Semana
                          </div>
                          <div className="text-lg font-bold text-red-700">
                            {salesReport.highlights.worstWeekDay.dayName}
                          </div>
                          <div className="text-sm text-gray-600">
                            {formatCurrency(salesReport.highlights.worstWeekDay.totalSales)} em{" "}
                            {salesReport.highlights.worstWeekDay.ordersCount} pedidos
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">Dados não disponíveis</div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Vendas por Dia da Semana */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-blue-600" />
                      Vendas por Dia da Semana
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {salesReport.weekDaySales.map((day, index) => (
                        <div key={index} className="flex items-center justify-between border-b pb-2">
                          <div>
                            <div className="font-semibold">{day.dayName}</div>
                            <div className="text-sm text-gray-600">
                              {day.ordersCount} pedidos • Ticket médio:{" "}
                              {formatCurrency(day.averageTicket)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-green-600">
                              {formatCurrency(day.totalSales)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Vendas Diárias */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-blue-600" />
                      Vendas Dia a Dia
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {salesReport.dailySales.map((day, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between border-b pb-2 hover:bg-gray-50 px-2 rounded"
                        >
                          <div>
                            <div className="font-semibold">
                              {formatDate(day.date)} ({day.dayOfWeek})
                            </div>
                            <div className="text-sm text-gray-600">
                              {day.ordersCount} pedidos • Ticket médio:{" "}
                              {formatCurrency(day.averageTicket)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-green-600">
                              {formatCurrency(day.totalSales)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Relatório de Produtos */}
          <TabsContent value="produtos" className="space-y-6">
            {/* Filtros de Período */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  Filtrar Período
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Botões de período rápido */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={rankingPeriod === 'today' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => applyRankingPeriod('today')}
                    >
                      Hoje
                    </Button>
                    <Button
                      variant={rankingPeriod === 'yesterday' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => applyRankingPeriod('yesterday')}
                    >
                      Ontem
                    </Button>
                    <Button
                      variant={rankingPeriod === 'week' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => applyRankingPeriod('week')}
                    >
                      Últimos 7 dias
                    </Button>
                    <Button
                      variant={rankingPeriod === 'month' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => applyRankingPeriod('month')}
                    >
                      Este mês
                    </Button>
                    <Button
                      variant={rankingPeriod === 'lastMonth' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => applyRankingPeriod('lastMonth')}
                    >
                      Mês passado
                    </Button>
                  </div>

                  {/* Filtro personalizado */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                    <div>
                      <Label>Data Início</Label>
                      <Input
                        type="date"
                        value={rankingStartDate}
                        onChange={(e) => {
                          setRankingStartDate(e.target.value);
                          setRankingPeriod('custom');
                        }}
                      />
                    </div>
                    <div>
                      <Label>Data Fim</Label>
                      <Input
                        type="date"
                        value={rankingEndDate}
                        onChange={(e) => {
                          setRankingEndDate(e.target.value);
                          setRankingPeriod('custom');
                        }}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        onClick={() => fetchRankings(rankingStartDate, rankingEndDate)}
                        className="w-full"
                      >
                        Buscar
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {completeReport && completeReport.topProducts && (
              <>
                {/* Card de Resumo */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-purple-600" />
                      Top 10 Produtos Mais Vendidos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {completeReport.topProducts.map((product, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center w-8 h-8 bg-purple-600 text-white rounded-full font-bold text-sm">
                              {index + 1}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">
                                {product.name}
                              </div>
                              <div className="text-sm text-gray-600">
                                Quantidade vendida: {product.quantity} un.
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-purple-600">
                              {formatCurrency(product.revenue)}
                            </div>
                            <div className="text-xs text-gray-500">
                              Receita total
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Gráfico Visual */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-purple-600" />
                      Comparação de Receita por Produto
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {completeReport.topProducts.map((product, index) => (
                        <div key={index} className="space-y-1">
                          <div className="flex justify-between items-center text-sm">
                            <span className="font-medium text-gray-700">
                              {index + 1}. {product.name}
                            </span>
                            <span className="font-bold text-purple-600">
                              {formatCurrency(product.revenue)}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-4">
                            <div
                              className="bg-purple-500 h-4 rounded-full"
                              style={{
                                width: `${(
                                  (product.revenue /
                                    Math.max(
                                      ...completeReport.topProducts.map((p) => p.revenue)
                                    )) *
                                  100
                                ).toFixed(0)}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Relatório de Clientes */}
          <TabsContent value="clientes" className="space-y-6">
            {/* Filtros de Período */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  Filtrar Período
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Botões de período rápido */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={rankingPeriod === 'today' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => applyRankingPeriod('today')}
                    >
                      Hoje
                    </Button>
                    <Button
                      variant={rankingPeriod === 'yesterday' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => applyRankingPeriod('yesterday')}
                    >
                      Ontem
                    </Button>
                    <Button
                      variant={rankingPeriod === 'week' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => applyRankingPeriod('week')}
                    >
                      Últimos 7 dias
                    </Button>
                    <Button
                      variant={rankingPeriod === 'month' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => applyRankingPeriod('month')}
                    >
                      Este mês
                    </Button>
                    <Button
                      variant={rankingPeriod === 'lastMonth' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => applyRankingPeriod('lastMonth')}
                    >
                      Mês passado
                    </Button>
                  </div>

                  {/* Filtro personalizado */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                    <div>
                      <Label>Data Início</Label>
                      <Input
                        type="date"
                        value={rankingStartDate}
                        onChange={(e) => {
                          setRankingStartDate(e.target.value);
                          setRankingPeriod('custom');
                        }}
                      />
                    </div>
                    <div>
                      <Label>Data Fim</Label>
                      <Input
                        type="date"
                        value={rankingEndDate}
                        onChange={(e) => {
                          setRankingEndDate(e.target.value);
                          setRankingPeriod('custom');
                        }}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        onClick={() => fetchRankings(rankingStartDate, rankingEndDate)}
                        className="w-full"
                      >
                        Buscar
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {completeReport && completeReport.topCustomers && (
              <>
                {/* Card de Resumo */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-orange-600" />
                      Top 10 Melhores Clientes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {completeReport.topCustomers.map((customer, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center w-8 h-8 bg-orange-600 text-white rounded-full font-bold text-sm">
                              {index + 1}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">
                                {customer.name}
                              </div>
                              <div className="text-sm text-gray-600">
                                Total de pedidos: {customer.orders}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-orange-600">
                              {formatCurrency(customer.revenue)}
                            </div>
                            <div className="text-xs text-gray-500">
                              Receita total
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Gráfico Visual */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-orange-600" />
                      Comparação de Receita por Cliente
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {completeReport.topCustomers.map((customer, index) => (
                        <div key={index} className="space-y-1">
                          <div className="flex justify-between items-center text-sm">
                            <span className="font-medium text-gray-700">
                              {index + 1}. {customer.name}
                            </span>
                            <span className="font-bold text-orange-600">
                              {formatCurrency(customer.revenue)}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-4">
                            <div
                              className="bg-orange-500 h-4 rounded-full"
                              style={{
                                width: `${(
                                  (customer.revenue /
                                    Math.max(
                                      ...completeReport.topCustomers.map((c) => c.revenue)
                                    )) *
                                  100
                                ).toFixed(0)}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Relatório de Despesas */}
          <TabsContent value="despesas" className="space-y-6">
            {expensesReport && (
              <>
                {/* Cards de Resumo */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600">
                        Total em Despesas
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-600">
                        {formatCurrency(expensesReport.summary.totalExpenses)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600">
                        Total de Despesas
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-orange-600">
                        {expensesReport.summary.totalCount}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600">
                        Média por Dia
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-purple-600">
                        {formatCurrency(expensesReport.summary.averagePerDay)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600">
                        Dias com Despesas
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-indigo-600">
                        {expensesReport.summary.daysWithExpenses}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Destaques */}
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="border-red-200 bg-red-50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-red-700">
                        <TrendingUp className="h-5 w-5" />
                        Maiores Despesas
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {expensesReport?.highlights?.highestDay ? (
                        <div>
                          <div className="text-sm font-medium text-gray-600">
                            📅 Dia com Mais Despesas
                          </div>
                          <div className="text-lg font-bold text-red-700">
                            {formatDate(expensesReport.highlights.highestDay.date)} (
                            {expensesReport.highlights.highestDay.dayOfWeek})
                          </div>
                          <div className="text-sm text-gray-600">
                            {formatCurrency(expensesReport.highlights.highestDay.totalExpenses)} em{" "}
                            {expensesReport.highlights.highestDay.expensesCount} despesas
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">Dados não disponíveis</div>
                      )}

                      {expensesReport?.highlights?.highestWeekDay ? (
                        <div>
                          <div className="text-sm font-medium text-gray-600">
                            📊 Dia da Semana com Mais Despesas
                          </div>
                          <div className="text-lg font-bold text-red-700">
                            {expensesReport.highlights.highestWeekDay.dayName}
                          </div>
                          <div className="text-sm text-gray-600">
                            {formatCurrency(expensesReport.highlights.highestWeekDay.totalExpenses)} em{" "}
                            {expensesReport.highlights.highestWeekDay.expensesCount} despesas
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">Dados não disponíveis</div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-green-200 bg-green-50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-green-700">
                        <TrendingDown className="h-5 w-5" />
                        Menores Despesas
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {expensesReport?.highlights?.lowestDay ? (
                        <div>
                          <div className="text-sm font-medium text-gray-600">
                            📅 Dia com Menos Despesas
                          </div>
                          <div className="text-lg font-bold text-green-700">
                            {formatDate(expensesReport.highlights.lowestDay.date)} (
                            {expensesReport.highlights.lowestDay.dayOfWeek})
                          </div>
                          <div className="text-sm text-gray-600">
                            {formatCurrency(expensesReport.highlights.lowestDay.totalExpenses)} em{" "}
                            {expensesReport.highlights.lowestDay.expensesCount} despesas
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">Dados não disponíveis</div>
                      )}

                      {expensesReport?.highlights?.lowestWeekDay ? (
                        <div>
                          <div className="text-sm font-medium text-gray-600">
                            📊 Dia da Semana com Menos Despesas
                          </div>
                          <div className="text-lg font-bold text-green-700">
                            {expensesReport.highlights.lowestWeekDay.dayName}
                          </div>
                          <div className="text-sm text-gray-600">
                            {formatCurrency(expensesReport.highlights.lowestWeekDay.totalExpenses)} em{" "}
                            {expensesReport.highlights.lowestWeekDay.expensesCount} despesas
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">Dados não disponíveis</div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Despesas por Dia da Semana */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-red-600" />
                      Despesas por Dia da Semana
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {expensesReport.weekDayExpenses.map((day, index) => (
                        <div key={index} className="flex items-center justify-between border-b pb-2">
                          <div>
                            <div className="font-semibold">{day.dayName}</div>
                            <div className="text-sm text-gray-600">
                              {day.expensesCount} despesas •{" "}
                              <span className="text-green-600">
                                Pagas: {formatCurrency(day.expensesByStatus.paid)}
                              </span>{" "}
                              •{" "}
                              <span className="text-yellow-600">
                                Pendentes: {formatCurrency(day.expensesByStatus.pending)}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-red-600">
                              {formatCurrency(day.totalExpenses)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Despesas Diárias */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-red-600" />
                      Despesas Dia a Dia
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {expensesReport.dailyExpenses.map((day, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between border-b pb-2 hover:bg-gray-50 px-2 rounded"
                        >
                          <div>
                            <div className="font-semibold">
                              {formatDate(day.date)} ({day.dayOfWeek})
                            </div>
                            <div className="text-sm text-gray-600">
                              {day.expensesCount} despesas •{" "}
                              <span className="text-green-600">
                                Pagas: {formatCurrency(day.expensesByStatus.paid)}
                              </span>{" "}
                              •{" "}
                              <span className="text-yellow-600">
                                Pendentes: {formatCurrency(day.expensesByStatus.pending)}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-red-600">
                              {formatCurrency(day.totalExpenses)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Relatório de Compras */}
          <TabsContent value="compras" className="space-y-6">
            {purchasesReport && (
              <>
                {/* Cards de Resumo */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600">
                        Total em Compras
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-blue-600">
                        {formatCurrency(purchasesReport.summary.totalPurchases)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600">
                        Total de Compras
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-indigo-600">
                        {purchasesReport.summary.totalCount}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600">
                        Média por Dia
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-purple-600">
                        {formatCurrency(purchasesReport.summary.averagePerDay)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600">
                        Dias com Compras
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-cyan-600">
                        {purchasesReport.summary.daysWithPurchases}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Destaques */}
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="border-blue-200 bg-blue-50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-blue-700">
                        <TrendingUp className="h-5 w-5" />
                        Maiores Compras
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {purchasesReport?.highlights?.highestDay ? (
                        <div>
                          <div className="text-sm font-medium text-gray-600">
                            📅 Dia com Mais Compras
                          </div>
                          <div className="text-lg font-bold text-blue-700">
                            {formatDate(purchasesReport.highlights.highestDay.date)} (
                            {purchasesReport.highlights.highestDay.dayOfWeek})
                          </div>
                          <div className="text-sm text-gray-600">
                            {formatCurrency(purchasesReport.highlights.highestDay.totalPurchases)} em{" "}
                            {purchasesReport.highlights.highestDay.purchasesCount} compras
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">Dados não disponíveis</div>
                      )}

                      {purchasesReport?.highlights?.highestWeekDay ? (
                        <div>
                          <div className="text-sm font-medium text-gray-600">
                            📊 Dia da Semana com Mais Compras
                          </div>
                          <div className="text-lg font-bold text-blue-700">
                            {purchasesReport.highlights.highestWeekDay.dayName}
                          </div>
                          <div className="text-sm text-gray-600">
                            {formatCurrency(purchasesReport.highlights.highestWeekDay.totalPurchases)}{" "}
                            em {purchasesReport.highlights.highestWeekDay.purchasesCount} compras
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">Dados não disponíveis</div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-green-200 bg-green-50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-green-700">
                        <TrendingDown className="h-5 w-5" />
                        Menores Compras
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {purchasesReport?.highlights?.lowestDay ? (
                        <div>
                          <div className="text-sm font-medium text-gray-600">
                            📅 Dia com Menos Compras
                          </div>
                          <div className="text-lg font-bold text-green-700">
                            {formatDate(purchasesReport.highlights.lowestDay.date)} (
                            {purchasesReport.highlights.lowestDay.dayOfWeek})
                          </div>
                          <div className="text-sm text-gray-600">
                            {formatCurrency(purchasesReport.highlights.lowestDay.totalPurchases)} em{" "}
                            {purchasesReport.highlights.lowestDay.purchasesCount} compras
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">Dados não disponíveis</div>
                      )}

                      {purchasesReport?.highlights?.lowestWeekDay ? (
                        <div>
                          <div className="text-sm font-medium text-gray-600">
                            📊 Dia da Semana com Menos Compras
                          </div>
                          <div className="text-lg font-bold text-green-700">
                            {purchasesReport.highlights.lowestWeekDay.dayName}
                          </div>
                          <div className="text-sm text-gray-600">
                            {formatCurrency(purchasesReport.highlights.lowestWeekDay.totalPurchases)}{" "}
                            em {purchasesReport.highlights.lowestWeekDay.purchasesCount} compras
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">Dados não disponíveis</div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Compras por Dia da Semana */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-blue-600" />
                      Compras por Dia da Semana
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {purchasesReport.weekDayPurchases.map((day, index) => (
                        <div key={index} className="flex items-center justify-between border-b pb-2">
                          <div>
                            <div className="font-semibold">{day.dayName}</div>
                            <div className="text-sm text-gray-600">
                              {day.purchasesCount} compras • Média por compra:{" "}
                              {formatCurrency(day.averagePerPurchase)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-blue-600">
                              {formatCurrency(day.totalPurchases)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Compras Diárias */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-blue-600" />
                      Compras Dia a Dia
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {purchasesReport.dailyPurchases.map((day, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between border-b pb-2 hover:bg-gray-50 px-2 rounded"
                        >
                          <div className="flex-1">
                            <div className="font-semibold">
                              {formatDate(day.date)} ({day.dayOfWeek})
                            </div>
                            <div className="text-sm text-gray-600">
                              {day.purchasesCount} compras • Média por compra:{" "}
                              {formatCurrency(day.averagePerPurchase)}
                            </div>
                            {Object.keys(day.purchasesBySupplier).length > 0 && (
                              <div className="text-xs text-gray-500 mt-1">
                                Fornecedores:{" "}
                                {Object.entries(day.purchasesBySupplier)
                                  .map(
                                    ([supplier, amount]) =>
                                      `${supplier} (${formatCurrency(amount as number)})`
                                  )
                                  .join(", ")}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-blue-600">
                              {formatCurrency(day.totalPurchases)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Mensagem quando não há dados */}
      {!salesReport && !expensesReport && !purchasesReport && !loading && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Selecione um período e clique em "Gerar Relatórios" para visualizar as análises
            detalhadas.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
