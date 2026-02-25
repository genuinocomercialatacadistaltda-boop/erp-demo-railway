
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow,
  TableFooter
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MonthlyData {
  month: string;
  fullMonth: string;
  year: string;
  faturamentoMensal: number;
  despesasProdutos: number;
  comprasMateriasPrimas: number;
  despesasOperacionais: number;
  lucroBruto: number;
  investimentos: number;
  prolabore: number;
  lucroLiquido: number;
}

interface YearlyTotals {
  faturamentoMensal: number;
  despesasProdutos: number;
  comprasMateriasPrimas: number;
  despesasOperacionais: number;
  lucroBruto: number;
  investimentos: number;
  prolabore: number;
  lucroLiquido: number;
}

export default function MonthlySummaryTable() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedYear, setSelectedYear] = useState(0);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [yearlyTotals, setYearlyTotals] = useState<YearlyTotals | null>(null);
  
  // Inicializa o ano após o componente montar (evita problemas de hidratação)
  useEffect(() => {
    try {
      setSelectedYear(new Date().getFullYear());
    } catch (error) {
      console.error('Erro ao obter ano atual:', error);
      setSelectedYear(2025); // Fallback
    }
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(""); // Limpar erro anterior
      
      console.log("🔍 [MONTHLY_SUMMARY_FRONTEND] Buscando dados para o ano:", selectedYear);
      
      const res = await fetch(`/api/admin/monthly-summary?year=${selectedYear}`);
      
      if (!res.ok) {
        throw new Error("Erro ao carregar dados");
      }

      const data = await res.json();
      
      console.log("✅ [MONTHLY_SUMMARY_FRONTEND] Dados recebidos:", {
        monthlyDataCount: data.monthlyData?.length,
        yearlyTotals: data.yearlyTotals,
        firstMonth: data.monthlyData?.[0]
      });
      
      setMonthlyData(data.monthlyData);
      setYearlyTotals(data.yearlyTotals);
      setError("");
    } catch (err: any) {
      console.error("❌ [MONTHLY_SUMMARY_FRONTEND] Erro ao buscar resumo mensal:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Só buscar dados se o ano já foi inicializado (não é 0)
    if (selectedYear > 0) {
      console.log("🔍 [MONTHLY_SUMMARY_FRONTEND] Ano inicializado, buscando dados:", selectedYear);
      fetchData();
    } else {
      console.log("⏳ [MONTHLY_SUMMARY_FRONTEND] Aguardando inicialização do ano...");
    }
  }, [selectedYear]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(value);
  };

  const getColorClass = (value: number) => {
    if (value > 0) return "text-green-600 dark:text-green-400";
    if (value < 0) return "text-red-600 dark:text-red-400";
    return "text-gray-600 dark:text-gray-400";
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            Resumo Financeiro Detalhado
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedYear(selectedYear - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-bold text-lg min-w-[80px] text-center">
              {selectedYear}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedYear(selectedYear + 1)}
              disabled={selectedYear >= new Date().getFullYear()}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="months" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="months">Meses</TabsTrigger>
            <TabsTrigger value="year">Ano</TabsTrigger>
          </TabsList>

          {/* Tab Meses */}
          <TabsContent value="months" className="mt-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Mês</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                    <TableHead className="text-right">Desp. Produtos</TableHead>
                    <TableHead className="text-right">Compras Mat. Prima</TableHead>
                    <TableHead className="text-right">Desp. Operacionais</TableHead>
                    <TableHead className="text-right">Lucro Bruto</TableHead>
                    <TableHead className="text-right">Investimentos</TableHead>
                    <TableHead className="text-right">Pró-labore</TableHead>
                    <TableHead className="text-right font-bold">Lucro Líquido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyData.map((month, index) => (
                    <TableRow key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <TableCell className="font-medium capitalize">
                        {month.fullMonth}
                      </TableCell>
                      <TableCell className="text-right text-green-600 dark:text-green-400">
                        {formatCurrency(month.faturamentoMensal)}
                      </TableCell>
                      <TableCell className="text-right text-red-600 dark:text-red-400">
                        -{formatCurrency(month.despesasProdutos)}
                      </TableCell>
                      <TableCell className="text-right text-red-600 dark:text-red-400">
                        -{formatCurrency(month.comprasMateriasPrimas)}
                      </TableCell>
                      <TableCell className="text-right text-red-600 dark:text-red-400">
                        -{formatCurrency(month.despesasOperacionais)}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${getColorClass(month.lucroBruto)}`}>
                        {formatCurrency(month.lucroBruto)}
                      </TableCell>
                      <TableCell className="text-right text-red-600 dark:text-red-400">
                        -{formatCurrency(month.investimentos)}
                      </TableCell>
                      <TableCell className="text-right text-red-600 dark:text-red-400">
                        -{formatCurrency(month.prolabore)}
                      </TableCell>
                      <TableCell className={`text-right font-bold ${getColorClass(month.lucroLiquido)}`}>
                        <div className="flex items-center justify-end gap-1">
                          {month.lucroLiquido > 0 ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : month.lucroLiquido < 0 ? (
                            <TrendingDown className="h-4 w-4" />
                          ) : null}
                          {formatCurrency(month.lucroLiquido)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Tab Ano */}
          <TabsContent value="year" className="mt-4">
            {yearlyTotals && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-green-900 dark:text-green-100">
                        Faturamento Total
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                        {formatCurrency(yearlyTotals.faturamentoMensal)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-red-900 dark:text-red-100">
                        Despesas com Produtos
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-900 dark:text-red-100">
                        {formatCurrency(yearlyTotals.despesasProdutos)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-orange-900 dark:text-orange-100">
                        Compras Matéria-Prima
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                        {formatCurrency(yearlyTotals.comprasMateriasPrimas)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-purple-900 dark:text-purple-100">
                        Despesas Operacionais
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                        {formatCurrency(yearlyTotals.despesasOperacionais)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-blue-900 dark:text-blue-100">
                        Lucro Bruto
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className={`text-2xl font-bold ${getColorClass(yearlyTotals.lucroBruto)}`}>
                        {formatCurrency(yearlyTotals.lucroBruto)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-yellow-900 dark:text-yellow-100">
                        Investimentos
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                        {formatCurrency(yearlyTotals.investimentos)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-900">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-indigo-900 dark:text-indigo-100">
                        Pró-labore
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-indigo-900 dark:text-indigo-100">
                        {formatCurrency(yearlyTotals.prolabore)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className={`bg-gradient-to-br ${
                    yearlyTotals.lucroLiquido > 0 
                      ? "from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900"
                      : "from-rose-50 to-rose-100 dark:from-rose-950 dark:to-rose-900"
                  }`}>
                    <CardHeader className="pb-2">
                      <CardTitle className={`text-sm ${
                        yearlyTotals.lucroLiquido > 0
                          ? "text-emerald-900 dark:text-emerald-100"
                          : "text-rose-900 dark:text-rose-100"
                      }`}>
                        Lucro Líquido
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className={`text-2xl font-bold flex items-center gap-2 ${
                        yearlyTotals.lucroLiquido > 0
                          ? "text-emerald-900 dark:text-emerald-100"
                          : "text-rose-900 dark:text-rose-100"
                      }`}>
                        {yearlyTotals.lucroLiquido > 0 ? (
                          <TrendingUp className="h-6 w-6" />
                        ) : (
                          <TrendingDown className="h-6 w-6" />
                        )}
                        {formatCurrency(yearlyTotals.lucroLiquido)}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Tabela de resumo anual */}
                <Table className="mt-6">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Valor Anual</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-bold">Faturamento Total</TableCell>
                      <TableCell className="text-right text-green-600 dark:text-green-400 font-bold">
                        {formatCurrency(yearlyTotals.faturamentoMensal)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Despesas com Produtos</TableCell>
                      <TableCell className="text-right text-red-600 dark:text-red-400">
                        -{formatCurrency(yearlyTotals.despesasProdutos)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Compras de Matéria-Prima</TableCell>
                      <TableCell className="text-right text-red-600 dark:text-red-400">
                        -{formatCurrency(yearlyTotals.comprasMateriasPrimas)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Despesas Operacionais</TableCell>
                      <TableCell className="text-right text-red-600 dark:text-red-400">
                        -{formatCurrency(yearlyTotals.despesasOperacionais)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="bg-blue-50 dark:bg-blue-950">
                      <TableCell className="font-bold">Lucro Bruto</TableCell>
                      <TableCell className={`text-right font-bold ${getColorClass(yearlyTotals.lucroBruto)}`}>
                        {formatCurrency(yearlyTotals.lucroBruto)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Investimentos</TableCell>
                      <TableCell className="text-right text-red-600 dark:text-red-400">
                        -{formatCurrency(yearlyTotals.investimentos)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Pró-labore</TableCell>
                      <TableCell className="text-right text-red-600 dark:text-red-400">
                        -{formatCurrency(yearlyTotals.prolabore)}
                      </TableCell>
                    </TableRow>
                    <TableRow className={`${
                      yearlyTotals.lucroLiquido > 0
                        ? "bg-green-50 dark:bg-green-950"
                        : "bg-red-50 dark:bg-red-950"
                    }`}>
                      <TableCell className="font-bold text-lg">Lucro Líquido</TableCell>
                      <TableCell className={`text-right font-bold text-lg ${getColorClass(yearlyTotals.lucroLiquido)}`}>
                        {formatCurrency(yearlyTotals.lucroLiquido)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
