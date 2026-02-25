
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Calendar,
  TrendingDown,
  DollarSign,
  FileText,
  BarChart3,
  Table as TableIcon,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, eachMonthOfInterval, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ExpenseDetail {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  paymentDate?: string;
  status: string;
  Category: {
    name: string;
    color: string;
  };
  expenseType: string;
  type: "EXPENSE" | "CREDIT_CARD" | "PURCHASE";
}

interface Props {
  expenseType: "OPERATIONAL" | "PRODUCTS" | "RAW_MATERIALS";
  onBack: () => void;
}

const EXPENSE_TYPE_LABELS = {
  OPERATIONAL: "Despesas Operacionais",
  PRODUCTS: "Despesas com Produtos",
  RAW_MATERIALS: "Compras de Matérias-Primas"
};

const EXPENSE_TYPE_COLORS = {
  OPERATIONAL: "#EF4444",
  PRODUCTS: "#8B5CF6",
  RAW_MATERIALS: "#F59E0B"
};

export default function HistoricoDetalhado({ expenseType, onBack }: Props) {
  const [expenses, setExpenses] = useState<ExpenseDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"daily" | "monthly" | "yearly">("monthly");
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(null);

  // Inicializa data após montagem do componente para evitar erro de hidratação
  useEffect(() => {
    try {
      setSelectedMonth(new Date());
    } catch (error) {
      console.error('Erro ao inicializar data:', error);
      setSelectedMonth(new Date(2025, 10, 26)); // 26/11/2025
    }
  }, []);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const startDate = startOfYear(selectedMonth).toISOString();
      const endDate = endOfYear(selectedMonth).toISOString();

      console.log("📊 Buscando despesas detalhadas:", {
        expenseType,
        startDate,
        endDate
      });

      const res = await fetch(
        `/api/financial/expenses/detailed?expenseType=${expenseType}&startDate=${startDate}&endDate=${endDate}`
      );
      
      if (!res.ok) {
        console.error("❌ Erro na requisição:", res.status, res.statusText);
        throw new Error("Erro ao carregar despesas");
      }
      const data = await res.json();
      console.log("✅ Despesas carregadas:", data.expenses?.length || 0);
      setExpenses(data.expenses || []);
    } catch (err: any) {
      console.error("❌ Erro ao buscar despesas:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log("🔄 HistoricoDetalhado montado/atualizado para tipo:", expenseType);
    fetchExpenses();
  }, [expenseType, selectedMonth]);

  // Agrupar despesas por dia, mês ou ano
  const groupedData = () => {
    if (period === "daily") {
      const monthStart = startOfMonth(selectedMonth);
      const monthEnd = endOfMonth(selectedMonth);
      const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

      return days.map((day) => {
        const dayExpenses = expenses.filter((exp) => {
          const expDate = new Date(exp.paymentDate || exp.dueDate);
          return format(expDate, "yyyy-MM-dd") === format(day, "yyyy-MM-dd");
        });

        const total = dayExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        
        return {
          date: format(day, "dd/MM", { locale: ptBR }),
          fullDate: format(day, "dd 'de' MMMM", { locale: ptBR }),
          total,
          count: dayExpenses.length
        };
      });
    } else if (period === "monthly") {
      const yearStart = startOfYear(selectedMonth);
      const yearEnd = endOfYear(selectedMonth);
      const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });

      return months.map((month) => {
        const monthExpenses = expenses.filter((exp) => {
          const expDate = new Date(exp.paymentDate || exp.dueDate);
          return format(expDate, "yyyy-MM") === format(month, "yyyy-MM");
        });

        const total = monthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        
        return {
          date: format(month, "MMM", { locale: ptBR }),
          fullDate: format(month, "MMMM 'de' yyyy", { locale: ptBR }),
          total,
          count: monthExpenses.length
        };
      });
    } else {
      // yearly - agrupar por ano (últimos 3 anos)
      const currentYear = selectedMonth.getFullYear();
      const years = [currentYear - 2, currentYear - 1, currentYear];

      return years.map((year) => {
        const yearExpenses = expenses.filter((exp) => {
          const expDate = new Date(exp.paymentDate || exp.dueDate);
          return expDate.getFullYear() === year;
        });

        const total = yearExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        
        return {
          date: year.toString(),
          fullDate: year.toString(),
          total,
          count: yearExpenses.length
        };
      });
    }
  };

  const chartData = groupedData();
  const totalAmount = chartData.reduce((sum, item) => sum + item.total, 0);
  const totalCount = expenses.length;
  const averageAmount = totalCount > 0 ? totalAmount / totalCount : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h2 className="text-2xl font-bold" style={{ color: EXPENSE_TYPE_COLORS[expenseType] }}>
              {EXPENSE_TYPE_LABELS[expenseType]}
            </h2>
            <p className="text-sm text-gray-500">
              Histórico detalhado • {format(selectedMonth, "yyyy", { locale: ptBR })}
            </p>
          </div>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-900 dark:text-blue-100 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total do Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              R$ {totalAmount.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-900 dark:text-purple-100 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Total de Lançamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              {totalCount}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-900 dark:text-green-100 flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Média por Despesa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
              R$ {averageAmount.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs de Visualização */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Análise Temporal
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant={period === "daily" ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriod("daily")}
              >
                Diário
              </Button>
              <Button
                variant={period === "monthly" ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriod("monthly")}
              >
                Mensal
              </Button>
              <Button
                variant={period === "yearly" ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriod("yearly")}
              >
                Anual
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="bar">
            <TabsList>
              <TabsTrigger value="bar">Barras</TabsTrigger>
              <TabsTrigger value="line">Linha</TabsTrigger>
              <TabsTrigger value="table">Tabela</TabsTrigger>
            </TabsList>

            <TabsContent value="bar" className="mt-4">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Total"]}
                    labelFormatter={(label) => {
                      const item = chartData.find((d) => d.date === label);
                      return item?.fullDate || label;
                    }}
                  />
                  <Legend />
                  <Bar dataKey="total" fill={EXPENSE_TYPE_COLORS[expenseType]} name="Total" />
                </BarChart>
              </ResponsiveContainer>
            </TabsContent>

            <TabsContent value="line" className="mt-4">
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Total"]}
                    labelFormatter={(label) => {
                      const item = chartData.find((d) => d.date === label);
                      return item?.fullDate || label;
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="total" stroke={EXPENSE_TYPE_COLORS[expenseType]} name="Total" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </TabsContent>

            <TabsContent value="table" className="mt-4">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                        Período
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                        Quantidade
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                        Total
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                        Média
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {chartData.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          {item.fullDate}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">
                          {item.count}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-gray-100">
                          R$ {item.total.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400">
                          R$ {item.count > 0 ? (item.total / item.count).toFixed(2) : "0.00"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-100 dark:bg-gray-900">
                    <tr>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-gray-100">
                        TOTAL
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-gray-900 dark:text-gray-100">
                        {totalCount}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-gray-900 dark:text-gray-100">
                        R$ {totalAmount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-gray-900 dark:text-gray-100">
                        R$ {averageAmount.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Lista Detalhada de Despesas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TableIcon className="h-5 w-5" />
            Todas as Despesas ({totalCount})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {expenses.length > 0 ? (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {expenses.map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: expense.Category.color }}
                    />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{expense.description}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(expense.paymentDate || expense.dueDate), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                        <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">
                          {expense.Category.name}
                        </span>
                        <span className={`px-2 py-0.5 rounded ${
                          expense.status === "PAID"
                            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                            : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                        }`}>
                          {expense.status === "PAID" ? "Pago" : "Pendente"}
                        </span>
                        {expense.type === "CREDIT_CARD" && (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 rounded">
                            Cartão
                          </span>
                        )}
                        {expense.type === "PURCHASE" && (
                          <span className="px-2 py-0.5 bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 rounded">
                            Compra
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="font-bold text-lg" style={{ color: EXPENSE_TYPE_COLORS[expenseType] }}>
                    R$ {expense.amount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Alert>
              <AlertDescription>
                Nenhuma despesa encontrada para este tipo no período selecionado.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
