
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Home, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingCart, 
  Package, 
  Users, 
  Table, 
  CreditCard,
  BarChart3,
  Wallet,
  Receipt,
  FileText,
  Target,
  ArrowLeft,
  ShoppingBag,
  Coins,
  TrendingUpDown,
  HandCoins,
  Banknote,
  Calculator,
  Store,
  Gift,
  Award
} from "lucide-react";
import toast from "react-hot-toast";

interface DashboardData {
  summary: {
    totalRevenue: number;
    totalPurchases: number;
    totalPurchaseItems: number;
    totalExpenses: number;
    pendingExpenses: number;
    overdueExpenses: number;
    grossProfit: number;
    investments: number;
    proLabore: number;
    netProfit: number;
    profitMargin: number;
    totalBalance: number;
    totalSales: number;
    totalUnitsSold: number;
    revenueGrowth: number;
  };
  goals: {
    monthlyRevenueGoal: number;
    monthlyUnitsSoldGoal: number;
    revenueProgress: number;
    unitsProgress: number;
  };
  topProducts: Array<{
    id: string;
    name: string;
    quantity: number;
    revenue: number;
  }>;
  dailySales: Record<string, number>;
  bankAccounts: Array<{
    id: string;
    name: string;
    balance: number;
    color?: string;
  }>;
}

export default function ClientManagementPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
    
    if (status === "authenticated" && (session?.user as any)?.userType !== "CUSTOMER") {
      toast.error("Acesso negado");
      router.push("/");
    }
  }, [status, session, router]);

  useEffect(() => {
    if (status === "authenticated") {
      loadDashboard();
    }
  }, [status, selectedMonth]);

  // Listener para atualização automática após ações críticas (ex: exclusão de pedidos)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'stock_critical_update' && e.newValue) {
        console.log('🔄 Atualização crítica detectada! Recarregando dashboard...');
        loadDashboard();
        toast.success('Dashboard atualizado automaticamente!');
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Monitora mudanças na mesma aba via polling leve
    const checkInterval = setInterval(() => {
      const lastUpdate = localStorage.getItem('stock_critical_update');
      const lastChecked = sessionStorage.getItem('dashboard_last_checked') || '0';
      
      if (lastUpdate && lastUpdate !== lastChecked) {
        console.log('🔄 Atualização crítica detectada (mesma aba)! Recarregando dashboard...');
        sessionStorage.setItem('dashboard_last_checked', lastUpdate);
        loadDashboard();
        toast.success('Dashboard atualizado automaticamente!');
      }
    }, 2000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(checkInterval);
    };
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      console.log(`🔍 [DASHBOARD] Carregando dados para mês: ${selectedMonth}`);
      
      const res = await fetch(`/api/client-management/dashboard?month=${selectedMonth}`);
      console.log(`📡 [DASHBOARD] Status da resposta: ${res.status}`);
      
      const data = await res.json();
      console.log(`📦 [DASHBOARD] Dados recebidos:`, data);

      if (data.success) {
        console.log(`✅ [DASHBOARD] Dados carregados com sucesso!`, data.data);
        setDashboardData(data.data);
      } else {
        console.error(`❌ [DASHBOARD] Erro na resposta:`, data);
        toast.error(`Erro ao carregar dashboard: ${data.error || 'Desconhecido'}`);
      }
    } catch (error) {
      console.error("❌ [DASHBOARD] Error loading dashboard:", error);
      toast.error("Erro ao carregar dashboard");
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

  const handleModuleClick = (moduleName: string, route?: string) => {
    if (route) {
      router.push(route);
    } else {
      toast.success(`Módulo "${moduleName}" será disponibilizado em breve!`, {
        duration: 3000,
        icon: "🚀",
      });
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                Módulo de Gestão
              </h1>
              <p className="text-gray-600">Gerencie seu negócio completo</p>
            </div>
          </div>

          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2 border rounded-md"
          />
        </div>

        {/* Cards de Resumo */}
        {dashboardData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
            {/* 1. Faturamento Mensal */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Faturamento Mensal
                </CardTitle>
                <DollarSign className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(dashboardData.summary.totalRevenue)}
                </div>
                {dashboardData.summary.revenueGrowth !== 0 && (
                  <p className="text-xs text-gray-600 flex items-center gap-1 mt-1">
                    {dashboardData.summary.revenueGrowth > 0 ? (
                      <TrendingUp className="h-3 w-3 text-green-600" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-600" />
                    )}
                    {Math.abs(dashboardData.summary.revenueGrowth).toFixed(1)}% vs mês anterior
                  </p>
                )}
              </CardContent>
            </Card>

            {/* 2. Compras do Mês */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Compras do Mês
                </CardTitle>
                <ShoppingBag className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {formatCurrency(dashboardData.summary.totalPurchases)}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  {dashboardData.summary.totalPurchaseItems} item(ns)
                </p>
              </CardContent>
            </Card>

            {/* 3. Despesas */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Despesas
                </CardTitle>
                <Receipt className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(dashboardData.summary.totalExpenses)}
                </div>
                {dashboardData.summary.pendingExpenses > 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    {formatCurrency(dashboardData.summary.pendingExpenses)} pendente
                  </p>
                )}
              </CardContent>
            </Card>

            {/* 4. Lucro Bruto */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Lucro Bruto
                </CardTitle>
                <TrendingUpDown className="h-4 w-4 text-cyan-600" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${dashboardData.summary.grossProfit >= 0 ? 'text-cyan-600' : 'text-red-600'}`}>
                  {formatCurrency(dashboardData.summary.grossProfit)}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Faturamento - Compras
                </p>
              </CardContent>
            </Card>

            {/* 5. Investimentos */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Investimentos
                </CardTitle>
                <Coins className="h-4 w-4 text-indigo-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-indigo-600">
                  {formatCurrency(dashboardData.summary.investments)}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Categoria: Investimento
                </p>
              </CardContent>
            </Card>

            {/* 6. Pró-labore */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Pró-labore
                </CardTitle>
                <HandCoins className="h-4 w-4 text-amber-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">
                  {formatCurrency(dashboardData.summary.proLabore)}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Retirada do sócio
                </p>
              </CardContent>
            </Card>

            {/* 7. Lucro Líquido */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Lucro Líquido
                </CardTitle>
                <Banknote className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${dashboardData.summary.netProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  {formatCurrency(dashboardData.summary.netProfit)}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Margem: {dashboardData.summary.profitMargin.toFixed(1)}%
                </p>
              </CardContent>
            </Card>

            {/* Saldo Total */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Saldo Total
                </CardTitle>
                <Wallet className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {formatCurrency(dashboardData.summary.totalBalance)}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  {dashboardData.bankAccounts.length} conta(s)
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Metas */}
        {dashboardData && dashboardData.goals.monthlyRevenueGoal > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Meta de Faturamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progresso:</span>
                    <span className="font-semibold">
                      {dashboardData.goals.revenueProgress.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(dashboardData.goals.revenueProgress, 100)}%`,
                      }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>{formatCurrency(dashboardData.summary.totalRevenue)}</span>
                    <span>Meta: {formatCurrency(dashboardData.goals.monthlyRevenueGoal)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {dashboardData.goals.monthlyUnitsSoldGoal > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Meta de Unidades Vendidas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progresso:</span>
                      <span className="font-semibold">
                        {dashboardData.goals.unitsProgress.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.min(dashboardData.goals.unitsProgress, 100)}%`,
                        }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>{dashboardData.summary.totalUnitsSold} unidades</span>
                      <span>Meta: {dashboardData.goals.monthlyUnitsSoldGoal} unidades</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}



        {/* Menu de Módulos */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer" 
            onClick={() => handleModuleClick("PDV / Vendas", "/customer/gestao/pdv")}
          >
            <CardHeader className="text-center">
              <ShoppingCart className="h-8 w-8 mx-auto text-blue-600 mb-2" />
              <CardTitle className="text-base">PDV / Vendas</CardTitle>
              <CardDescription className="text-xs">Frente de caixa e comandas</CardDescription>
            </CardHeader>
          </Card>

          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer" 
            onClick={() => handleModuleClick("Histórico de Vendas", "/customer/gestao/vendas")}
          >
            <CardHeader className="text-center">
              <FileText className="h-8 w-8 mx-auto text-purple-600 mb-2" />
              <CardTitle className="text-base">Histórico de Vendas</CardTitle>
              <CardDescription className="text-xs">Gerenciar vendas realizadas</CardDescription>
            </CardHeader>
          </Card>

          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer" 
            onClick={() => handleModuleClick("Estoque", "/customer/gestao/estoque")}
          >
            <CardHeader className="text-center">
              <Package className="h-8 w-8 mx-auto text-green-600 mb-2" />
              <CardTitle className="text-base">Estoque</CardTitle>
              <CardDescription className="text-xs">Controle de matérias-primas</CardDescription>
            </CardHeader>
          </Card>

          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer" 
            onClick={() => handleModuleClick("Compras", "/customer/gestao/compras")}
          >
            <CardHeader className="text-center">
              <ShoppingBag className="h-8 w-8 mx-auto text-orange-600 mb-2" />
              <CardTitle className="text-base">Compras</CardTitle>
              <CardDescription className="text-xs">Registro e controle</CardDescription>
            </CardHeader>
          </Card>

          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer" 
            onClick={() => handleModuleClick("Contas em Aberto", "/customer/gestao/contas-aberto")}
          >
            <CardHeader className="text-center">
              <Receipt className="h-8 w-8 mx-auto text-red-600 mb-2" />
              <CardTitle className="text-base">Contas em Aberto</CardTitle>
              <CardDescription className="text-xs">Pedidos não pagos</CardDescription>
            </CardHeader>
          </Card>

          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer" 
            onClick={() => handleModuleClick("Financeiro", "/customer/gestao/financeiro")}
          >
            <CardHeader className="text-center">
              <DollarSign className="h-8 w-8 mx-auto text-amber-600 mb-2" />
              <CardTitle className="text-base">Financeiro</CardTitle>
              <CardDescription className="text-xs">Contas bancárias</CardDescription>
            </CardHeader>
          </Card>

          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer" 
            onClick={() => handleModuleClick("Relatórios", "/customer/gestao/relatorios")}
          >
            <CardHeader className="text-center">
              <FileText className="h-8 w-8 mx-auto text-indigo-600 mb-2" />
              <CardTitle className="text-base">Relatórios</CardTitle>
              <CardDescription className="text-xs">Análises e gráficos</CardDescription>
            </CardHeader>
          </Card>

          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer" 
            onClick={() => handleModuleClick("Meus Clientes", "/customer/gestao/meus-clientes")}
          >
            <CardHeader className="text-center">
              <Users className="h-8 w-8 mx-auto text-cyan-600 mb-2" />
              <CardTitle className="text-base">Meus Clientes</CardTitle>
              <CardDescription className="text-xs">Gerencie clientes e pontos</CardDescription>
            </CardHeader>
          </Card>


          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer" 
            onClick={() => handleModuleClick("Gestão de Cartões", "/customer/gestao/cartoes")}
          >
            <CardHeader className="text-center">
              <CreditCard className="h-8 w-8 mx-auto text-purple-600 mb-2" />
              <CardTitle className="text-base">Gestão de Cartões</CardTitle>
              <CardDescription className="text-xs">Controle de cartões</CardDescription>
            </CardHeader>
          </Card>

          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer" 
            onClick={() => handleModuleClick("Loja Pública", "/customer/gestao/loja-publica")}
          >
            <CardHeader className="text-center">
              <Store className="h-8 w-8 mx-auto text-green-600 mb-2" />
              <CardTitle className="text-base">Loja Pública</CardTitle>
              <CardDescription className="text-xs">Configure sua loja online</CardDescription>
            </CardHeader>
          </Card>

          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer" 
            onClick={() => handleModuleClick("Precificação", "/customer/gestao/precificação")}
          >
            <CardHeader className="text-center">
              <Calculator className="h-8 w-8 mx-auto text-amber-600 mb-2" />
              <CardTitle className="text-base">Precificação</CardTitle>
              <CardDescription className="text-xs">Custos e receitas</CardDescription>
            </CardHeader>
          </Card>

          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer" 
            onClick={() => handleModuleClick("Gestão de Prêmios", "/customer/gestao/premios")}
          >
            <CardHeader className="text-center">
              <Gift className="h-8 w-8 mx-auto text-pink-600 mb-2" />
              <CardTitle className="text-base">Gestão de Prêmios</CardTitle>
              <CardDescription className="text-xs">Criar e gerenciar prêmios</CardDescription>
            </CardHeader>
          </Card>

          <Card 
            className="hover:shadow-lg transition-shadow cursor-pointer" 
            onClick={() => handleModuleClick("Gestão de Resgates", "/customer/gestao/resgates")}
          >
            <CardHeader className="text-center">
              <Award className="h-8 w-8 mx-auto text-yellow-600 mb-2" />
              <CardTitle className="text-base">Gestão de Resgates</CardTitle>
              <CardDescription className="text-xs">Aprovar/rejeitar resgates</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
}