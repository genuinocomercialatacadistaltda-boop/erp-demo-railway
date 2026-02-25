
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  AlertCircle,
  DollarSign,
  Receipt,
  Clock,
  Building2,
  Package,
  ShoppingCart,
  ArrowRight
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import HistoricoDetalhado from "./historico-detalhado";
import ProximasDespesasDia from "./proximas-despesas-dia";
import ProximosRecebimentosDia from "./proximos-recebimentos-dia";
import RelatorioDetalhadoCategoria from "./relatorio-detalhado-categoria";
import { PixOrfaos } from "./pix-orfaos";

// Tipo para categoria dentro de um tipo de despesa
interface CategoryInType {
  name: string;
  color: string;
  amount: number;
}

// Tipo para cada tipo de despesa com suas categorias
interface ExpenseTypeWithCategories {
  total: number;
  categories: CategoryInType[];
}

interface DashboardData {
  summary: {
    totalBalance: number;
    totalIncome: number;
    totalReceivedIncome: number;
    totalExpensesPaid: number;
    totalPurchasesPaid: number;
    totalPendingExpenses: number;
    totalReceivable: number;
    projectedBalance: number;
    overdueExpensesCount: number;
  };
  expensesByType: {
    OPERATIONAL: number;
    PRODUCTS: number;
    RAW_MATERIALS: number;
    INVESTMENT: number;
    PROLABORE: number;
    OTHER: number;
  };
  // 🆕 NOVO: Despesas agrupadas por tipo COM categorias
  expensesByTypeWithCategories: {
    OPERATIONAL: ExpenseTypeWithCategories;
    PRODUCTS: ExpenseTypeWithCategories;
    RAW_MATERIALS: ExpenseTypeWithCategories;
    INVESTMENT: ExpenseTypeWithCategories;
    PROLABORE: ExpenseTypeWithCategories;
    OTHER: ExpenseTypeWithCategories;
  };
  bankAccounts: Array<{
    id: string;
    name: string;
    balance: number;
    color?: string;
  }>;
  expensesByCategory: Array<{
    categoryName: string;
    categoryColor: string;
    amount: number;
  }>;
  purchasesByCategory: Array<{
    categoryName: string;
    categoryColor: string;
    amount: number;
  }>;
  pendingExpenses: Array<{
    id: string;
    description: string;
    amount: number;
    dueDate: string;
    Category: {
      name: string;
      color: string;
    };
  }>;
  pendingReceivables: Array<{
    id: string;
    description: string;
    amount: number;
    dueDate: string;
    Customer: {
      name: string;
      phone: string;
    } | null;
  }>;
}

// Configuração dos tipos de despesa com nomes e cores
const EXPENSE_TYPE_CONFIG = {
  PRODUCTS: { name: 'Despesas com Produtos', color: '#EF4444', icon: Package },
  RAW_MATERIALS: { name: 'Compras de Matéria-Prima', color: '#F59E0B', icon: ShoppingCart },
  OPERATIONAL: { name: 'Despesas Operacionais', color: '#3B82F6', icon: Building2 },
  INVESTMENT: { name: 'Investimentos', color: '#10B981', icon: TrendingUp },
  PROLABORE: { name: 'Pró-Labore', color: '#8B5CF6', icon: Wallet },
  OTHER: { name: 'Outras Despesas', color: '#6B7280', icon: Receipt }
};

export default function DashboardFinanceiro() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedExpenseType, setSelectedExpenseType] = useState<"OPERATIONAL" | "PRODUCTS" | "RAW_MATERIALS" | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<{ name: string; color: string } | null>(null);
  
  // Estados para filtro de período
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [selectedYear, setSelectedYear] = useState(0);

  // Inicializa datas após montagem do componente para evitar erro de hidratação
  useEffect(() => {
    try {
      setSelectedMonth(new Date().getMonth());
      setSelectedYear(new Date().getFullYear());
    } catch (error) {
      console.error('Erro ao inicializar datas:', error);
      setSelectedMonth(10); // Novembro
      setSelectedYear(2025);
    }
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(""); // Limpar erro anterior
      
      // Calcular startDate e endDate baseado no mês/ano selecionado
      const startDate = new Date(selectedYear, selectedMonth, 1);
      const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);
      
      console.log("🔍 [DASHBOARD FRONTEND] Datas calculadas:", {
        selectedMonth,
        selectedYear,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });
      
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });
      
      console.log("🔍 [DASHBOARD FRONTEND] Chamando API:", `/api/financial/dashboard?${params.toString()}`);
      
      const res = await fetch(`/api/financial/dashboard?${params.toString()}`);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          `Erro na requisição: ${res.status}${errorData.error ? ` - ${errorData.error}` : ""}`
        );
      }
      
      const result = await res.json();
      console.log("✅ [DASHBOARD FRONTEND] Dados recebidos:", result);
      setData(result);
    } catch (err: any) {
      console.error("❌ [DASHBOARD FRONTEND] Erro no dashboard:", err);
      setError(err.message || "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Só buscar dados se o ano já foi inicializado (não é 0)
    if (selectedYear > 0) {
      console.log("🔍 [DASHBOARD FRONTEND] Buscando dados para:", { selectedMonth, selectedYear });
      fetchDashboard();
    } else {
      console.log("⏳ [DASHBOARD FRONTEND] Aguardando inicialização de datas...");
    }
  }, [selectedMonth, selectedYear]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error || "Erro ao carregar dados"}</AlertDescription>
      </Alert>
    );
  }

  const { summary, bankAccounts, expensesByCategory, purchasesByCategory, pendingExpenses, pendingReceivables, expensesByType } = data;

  // Nomes dos meses
  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  // Se um tipo foi selecionado, mostrar o histórico detalhado
  if (selectedExpenseType) {
    console.log("✅ Mostrando histórico detalhado para:", selectedExpenseType);
    return (
      <HistoricoDetalhado
        expenseType={selectedExpenseType}
        onBack={() => {
          console.log("⬅️ Voltando para o dashboard");
          setSelectedExpenseType(null);
        }}
      />
    );
  }

  // Se uma categoria foi selecionada, mostrar relatório detalhado
  if (selectedCategory) {
    // Calcular as datas do mês selecionado
    const startDate = new Date(selectedYear, selectedMonth, 1);
    const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);
    
    return (
      <RelatorioDetalhadoCategoria
        categoryName={selectedCategory.name}
        categoryColor={selectedCategory.color}
        startDate={startDate.toISOString()}
        endDate={endDate.toISOString()}
        onBack={() => setSelectedCategory(null)}
      />
    );
  }

  // Juntar DESPESAS + COMPRAS em um único array para o gráfico
  const allCategoriesMap = new Map<string, { name: string; amount: number; color: string }>();

  // Adicionar despesas
  expensesByCategory.forEach((cat) => {
    const existing = allCategoriesMap.get(cat.categoryName) || { name: cat.categoryName, amount: 0, color: cat.categoryColor };
    allCategoriesMap.set(cat.categoryName, {
      ...existing,
      amount: existing.amount + cat.amount
    });
  });

  // Adicionar compras
  purchasesByCategory.forEach((cat) => {
    const existing = allCategoriesMap.get(cat.categoryName) || { name: cat.categoryName, amount: 0, color: cat.categoryColor };
    allCategoriesMap.set(cat.categoryName, {
      ...existing,
      amount: existing.amount + cat.amount
    });
  });

  // Converter para array e calcular percentuais
  const allCategoriesData = Array.from(allCategoriesMap.values());
  const totalAll = allCategoriesData.reduce((sum, cat) => sum + cat.amount, 0);
  const categoryChartData = allCategoriesData.map((cat) => ({
    name: cat.name,
    value: cat.amount,
    percentage: totalAll > 0 ? ((cat.amount / totalAll) * 100).toFixed(1) : 0,
    color: cat.color
  }));

  return (
    <div className="space-y-6">
      {/* Alerta de PIX Órfãos */}
      <PixOrfaos />

      {/* Filtro de Período */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              Período de Análise
            </span>
            <div className="flex gap-3">
              {/* Seletor de Mês */}
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="px-4 py-2 border rounded-md text-sm font-normal"
              >
                {monthNames.map((month, index) => (
                  <option key={index} value={index}>
                    {month}
                  </option>
                ))}
              </select>
              
              {/* Seletor de Ano */}
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-4 py-2 border rounded-md text-sm font-normal"
              >
                {[2024, 2025, 2026].map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            📊 Visualizando dados de <strong>{monthNames[selectedMonth]} de {selectedYear}</strong>
            {selectedMonth === new Date().getMonth() && selectedYear === new Date().getFullYear() && (
              <span className="ml-2 text-green-600 font-semibold">(Mês Atual)</span>
            )}
          </p>
        </CardContent>
      </Card>

      {/* Saldo Projetado */}
      <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950 dark:to-indigo-950">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-purple-900 dark:text-purple-100">
            <DollarSign className="h-5 w-5" />
            Saldo Projetado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-purple-900 dark:text-purple-100">
            R$ {summary.projectedBalance.toFixed(2)}
          </div>
          <p className="text-sm text-purple-700 dark:text-purple-300 mt-2">
            = Saldo Atual (R$ {summary.totalBalance.toFixed(2)}) + A Receber (R$ {summary.totalReceivable.toFixed(2)}) - A Pagar (R$ {summary.totalPendingExpenses.toFixed(2)})
          </p>
        </CardContent>
      </Card>

      {/* Gráfico Unificado - Despesas por Tipo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-purple-600" />
            Despesas por Tipo
          </CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            💡 Despesas organizadas por tipo: Produtos, Matéria-Prima, Operacional, Investimentos e Pró-Labore.
          </p>
        </CardHeader>
        <CardContent>
          {categoryChartData.length > 0 ? (
            <>
              {/* Layout: Gráfico à esquerda, Legenda à direita */}
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Gráfico de Pizza - SEM labels para evitar sobreposição */}
                <div className="flex-shrink-0">
                  <ResponsiveContainer width={320} height={320}>
                    <PieChart>
                      <Pie
                        data={categoryChartData}
                        cx="50%"
                        cy="50%"
                        outerRadius={130}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {categoryChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legenda Organizada - Fora do gráfico */}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[320px] overflow-y-auto">
                  {categoryChartData
                    .sort((a, b) => b.value - a.value) // Ordenar por valor (maior primeiro)
                    .map((entry, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <div 
                          className="w-4 h-4 rounded-sm flex-shrink-0" 
                          style={{ backgroundColor: entry.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate" title={entry.name}>
                            {entry.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            <span className="font-semibold">{entry.percentage}%</span>
                            <span className="mx-1">•</span>
                            R$ {entry.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
              
              {/* 🆕 Valores Agrupados por TIPO DE DESPESA */}
              <div className="mt-6 border-t pt-4 space-y-6">
                {data?.expensesByTypeWithCategories && (
                  <>
                    {/* Ordem específica dos tipos */}
                    {(['PRODUCTS', 'RAW_MATERIALS', 'OPERATIONAL', 'INVESTMENT', 'PROLABORE', 'OTHER'] as const).map((typeKey) => {
                      const typeData = data.expensesByTypeWithCategories[typeKey];
                      const config = EXPENSE_TYPE_CONFIG[typeKey];
                      const IconComponent = config.icon;
                      
                      // Só mostrar se tiver valor
                      if (!typeData || typeData.total <= 0) return null;
                      
                      return (
                        <div key={typeKey} className="border rounded-lg p-4" style={{ borderColor: config.color + '40' }}>
                          {/* Cabeçalho do Tipo */}
                          <div className="flex items-center justify-between mb-3 pb-2 border-b" style={{ borderColor: config.color + '30' }}>
                            <div className="flex items-center gap-2">
                              <div className="p-2 rounded-lg" style={{ backgroundColor: config.color + '15' }}>
                                <IconComponent className="h-5 w-5" style={{ color: config.color }} />
                              </div>
                              <span className="font-semibold text-gray-800 dark:text-gray-200">{config.name}</span>
                            </div>
                            <span className="text-lg font-bold" style={{ color: config.color }}>
                              R$ {typeData.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          
                          {/* Categorias dentro do tipo */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {typeData.categories.map((cat, idx) => (
                              <button
                                key={idx}
                                onClick={() => setSelectedCategory({ name: cat.name, color: cat.color })}
                                className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer text-left w-full"
                              >
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: cat.color }}
                                  />
                                  <span className="text-sm">{cat.name}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-sm font-medium">
                                    R$ {cat.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </span>
                                  <ArrowRight className="h-3 w-3 text-gray-400" />
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
                
                {/* Total Geral */}
                <div className="mt-4 pt-3 border-t flex justify-between items-center">
                  <span className="font-bold text-gray-900 dark:text-gray-100">Total Geral:</span>
                  <span className="text-xl font-bold text-purple-600 dark:text-purple-400">
                    R$ {totalAll.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500">
              Nenhuma despesa ou compra registrada no período
            </div>
          )}
        </CardContent>
      </Card>

      {/* 🆕 NOVO GRÁFICO: % Despesas sobre Faturamento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-orange-600" />
            % Despesas sobre Faturamento
          </CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            💡 Quanto cada categoria representa do faturamento total do mês (R$ {summary.totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
          </p>
        </CardHeader>
        <CardContent>
          {categoryChartData.length > 0 && summary.totalIncome > 0 ? (
            <>
              {/* Layout: Gráfico à esquerda, Legenda à direita */}
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Gráfico de Pizza */}
                <div className="flex-shrink-0">
                  <ResponsiveContainer width={320} height={320}>
                    <PieChart>
                      <Pie
                        data={categoryChartData.map(cat => ({
                          ...cat,
                          percentOfRevenue: ((cat.value / summary.totalIncome) * 100).toFixed(1)
                        }))}
                        cx="50%"
                        cy="50%"
                        outerRadius={130}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {categoryChartData.map((entry, index) => (
                          <Cell key={`cell-rev-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => [
                          `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${((value / summary.totalIncome) * 100).toFixed(1)}% do faturamento)`,
                          'Valor'
                        ]} 
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legenda com % sobre Faturamento */}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[320px] overflow-y-auto">
                  {categoryChartData
                    .sort((a, b) => b.value - a.value)
                    .map((entry, index) => {
                      const percentOfRevenue = summary.totalIncome > 0 
                        ? ((entry.value / summary.totalIncome) * 100).toFixed(1) 
                        : '0.0';
                      return (
                        <div key={index} className="flex items-center gap-2 p-2 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors">
                          <div 
                            className="w-4 h-4 rounded-sm flex-shrink-0" 
                            style={{ backgroundColor: entry.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate" title={entry.name}>
                              {entry.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              <span className="font-semibold text-orange-600">{percentOfRevenue}%</span>
                              <span className="mx-1">do faturamento</span>
                            </p>
                            <p className="text-xs text-gray-400">
                              R$ {entry.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
              
              {/* Resumo Total */}
              <div className="mt-4 pt-3 border-t">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Faturamento</p>
                    <p className="text-xl font-bold text-green-600">R$ {summary.totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Despesas</p>
                    <p className="text-xl font-bold text-red-600">R$ {totalAll.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">% Total sobre Faturamento</p>
                    <p className="text-xl font-bold text-orange-600">
                      {summary.totalIncome > 0 ? ((totalAll / summary.totalIncome) * 100).toFixed(1) : '0.0'}%
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-gray-500">
              {summary.totalIncome === 0 
                ? 'Nenhum faturamento registrado no período' 
                : 'Nenhuma despesa registrada no período'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Saldo Total e Contas Bancárias */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-blue-600" />
            Saldos por Conta
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Saldo Total Destacado */}
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 rounded-lg border-2 border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Saldo Total de Todas as Contas</p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                    R$ {summary.totalBalance.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Contas Individuais */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {bankAccounts.map((account) => (
              <div key={account.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: account.color || "#3B82F6" }}
                  />
                  <span className="font-medium">{account.name}</span>
                </div>
                <span className="font-bold text-lg">
                  R$ {account.balance.toFixed(2)}
                </span>
              </div>
            ))}
            {bankAccounts.length === 0 && (
              <div className="text-center text-gray-500 py-8 col-span-full">
                Nenhuma conta cadastrada
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Próximas Despesas a Vencer - Agrupadas por Dia */}
      <ProximasDespesasDia expenses={pendingExpenses} />

      {/* Próximos Recebimentos a Vencer - Agrupados por Dia */}
      <ProximosRecebimentosDia receivables={pendingReceivables} />
    </div>
  );
}
