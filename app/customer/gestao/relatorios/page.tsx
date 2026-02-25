
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Home, TrendingUp, TrendingDown, Calendar, DollarSign, PieChart as PieChartIcon, AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DayData {
  date: string;
  weekday: string;
  total: number;
  orders: number;
}

interface WeekdayData {
  weekday: string;
  total: number;
  orders: number;
}

interface CategoryData {
  category: string;
  total: number;
  count: number;
  percentage: number;
}

interface WasteReasonData {
  reason: string;
  quantity: number;
  occurrences: number;
  percentage: number;
}

interface ProductData {
  name: string;
  quantity: number;
  revenue: number;
  percentage: number;
}

interface ReportData {
  period: {
    startDate: string;
    endDate: string;
  };
  sales: {
    totalRevenue: number;
    totalOrders: number;
    averageTicket: number;
    daysWithSales: number;
    bestDay: DayData | null;
    worstDay: DayData | null;
    bestWeekday: WeekdayData | null;
    worstWeekday: WeekdayData | null;
    comparison: {
      previousRevenue: number;
      previousOrders: number;
      revenueChange: number;
      ordersChange: number;
    };
  };
  topProducts: ProductData[];
  waste: {
    totalWaste: number;
    totalOccurrences: number;
    wasteRate: number;
    byReason: WasteReasonData[];
  };
  expenses: {
    totalExpenses: number;
    byCategory: CategoryData[];
  };
}

export default function RelatoriosPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [showWasteDetails, setShowWasteDetails] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    } else if (status === "authenticated") {
      loadReports();
    }
  }, [status, startDate, endDate]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/client-management/reports?startDate=${startDate}&endDate=${endDate}`
      );

      if (!response.ok) {
        throw new Error("Erro ao carregar relatórios");
      }

      const data = await response.json();
      setReportData(data);
    } catch (error: any) {
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

  const formatPercentage = (value: number) => {
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(1)}%`;
  };

  const getCategoryColors = () => {
    const colors = [
      "bg-blue-500",
      "bg-green-500",
      "bg-yellow-500",
      "bg-red-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-indigo-500",
      "bg-orange-500",
      "bg-teal-500",
      "bg-cyan-500",
    ];
    return colors;
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando relatórios...</p>
        </div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-gray-600">Nenhum dado disponível</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const colors = getCategoryColors();

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-gray-900">Relatórios</h1>
            <p className="text-gray-600">Análise de desempenho do seu negócio</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/customer/gestao")}
            >
              <Home className="h-4 w-4 mr-2" />
              Início
            </Button>
          </div>
        </div>

        {/* Cards Principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card de Faturamento */}
          <Card className="bg-green-50 border-green-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                Faturamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-3xl font-bold text-green-900">
                  {formatCurrency(reportData.sales.totalRevenue)}
                </p>
                <p className="text-sm text-green-700">
                  {reportData.sales.totalOrders} pedidos no período
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Card de Desperdício (Clicável) */}
          <Card 
            className="bg-orange-50 border-orange-200 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => setShowWasteDetails(true)}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                Desperdício
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-3xl font-bold text-orange-900">
                  {reportData.waste.totalWaste}
                </p>
                <p className="text-sm text-orange-700">
                  espetinhos no período • Clique para detalhes
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Modal de Detalhes de Desperdício */}
        <Dialog open={showWasteDetails} onOpenChange={setShowWasteDetails}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                Detalhes do Desperdício
              </DialogTitle>
              <DialogDescription>
                Análise completa do desperdício no período
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 mt-4">
              {/* Cards de Resumo */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-orange-50 border-orange-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Total Desperdiçado</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-orange-900">
                      {reportData?.waste.totalWaste || 0}
                    </p>
                    <p className="text-xs text-orange-700">espetinhos</p>
                  </CardContent>
                </Card>

                <Card className="bg-red-50 border-red-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Ocorrências</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-red-900">
                      {reportData?.waste.totalOccurrences || 0}
                    </p>
                    <p className="text-xs text-red-700">dias</p>
                  </CardContent>
                </Card>

                <Card className="bg-yellow-50 border-yellow-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Média Diária</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-yellow-900">
                      {reportData?.waste.wasteRate.toFixed(1) || 0}
                    </p>
                    <p className="text-xs text-yellow-700">espetinhos/dia</p>
                  </CardContent>
                </Card>
              </div>

              {/* Lista de Desperdício por Motivo */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Desperdício por Motivo</h3>
                
                {reportData?.waste.byReason && reportData.waste.byReason.length > 0 ? (
                  <div className="space-y-2">
                    {reportData.waste.byReason.map((reason, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div
                            className="h-8 w-8 rounded flex items-center justify-center text-white font-bold"
                            style={{
                              backgroundColor: getCategoryColors()[index % getCategoryColors().length]
                            }}
                          >
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium">{reason.reason}</p>
                            <p className="text-sm text-gray-600">
                              {reason.occurrences} {reason.occurrences === 1 ? 'ocorrência' : 'ocorrências'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-orange-600">
                            {reason.quantity} espetinhos
                          </p>
                          <p className="text-sm text-gray-600">
                            {reason.percentage.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>🎉 Nenhum desperdício registrado no período!</p>
                    <p className="text-sm mt-1">Parabéns! Continue com esse ótimo trabalho.</p>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Despesas por Categoria */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-amber-600" />
              Despesas por Categoria
            </CardTitle>
            <CardDescription>
              Total de despesas: {formatCurrency(reportData.expenses.totalExpenses)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {reportData.expenses.byCategory.length > 0 ? (
              <div className="space-y-4">
                {/* Gráfico de Pizza Visual */}
                <div className="flex justify-center">
                  <div className="w-64 h-64 relative">
                    <svg viewBox="0 0 200 200" className="w-full h-full">
                      {reportData.expenses.byCategory.map((item, index) => {
                        const startAngle = reportData.expenses.byCategory
                          .slice(0, index)
                          .reduce((sum, cat) => sum + (cat.percentage * 3.6), 0);
                        
                        const endAngle = startAngle + (item.percentage * 3.6);
                        
                        const x1 = 100 + 80 * Math.cos((startAngle - 90) * Math.PI / 180);
                        const y1 = 100 + 80 * Math.sin((startAngle - 90) * Math.PI / 180);
                        const x2 = 100 + 80 * Math.cos((endAngle - 90) * Math.PI / 180);
                        const y2 = 100 + 80 * Math.sin((endAngle - 90) * Math.PI / 180);
                        
                        const largeArcFlag = item.percentage > 50 ? 1 : 0;
                        
                        return (
                          <path
                            key={index}
                            d={`M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
                            fill={`hsl(${index * 360 / reportData.expenses.byCategory.length}, 70%, 60%)`}
                            stroke="white"
                            strokeWidth="2"
                          />
                        );
                      })}
                    </svg>
                  </div>
                </div>

                {/* Legenda */}
                <div className="space-y-2">
                  {reportData.expenses.byCategory.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded"
                          style={{
                            backgroundColor: `hsl(${index * 360 / reportData.expenses.byCategory.length}, 70%, 60%)`
                          }}
                        />
                        <div>
                          <p className="font-medium text-gray-900">{item.category}</p>
                          <p className="text-sm text-gray-600">{item.count} despesas</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{formatCurrency(item.total)}</p>
                        <p className="text-sm text-gray-600">{item.percentage.toFixed(1)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <PieChartIcon className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>Nenhuma despesa registrada no período</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
