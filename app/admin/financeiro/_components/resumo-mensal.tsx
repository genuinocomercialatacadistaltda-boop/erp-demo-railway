
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface MonthlyData {
  month: string;
  revenue: number;
  operationalExpenses: number;
  productExpenses: number;
  purchaseExpenses: number;
  investmentExpenses: number;
  proLaboreExpenses: number;
  operationalProfit: number;
  netProfit: number;
}

interface SummaryData {
  year: number;
  monthlyData: MonthlyData[];
  yearlyTotals: {
    revenue: number;
    operationalExpenses: number;
    productExpenses: number;
    purchaseExpenses: number;
    investmentExpenses: number;
    proLaboreExpenses: number;
    operationalProfit: number;
    netProfit: number;
  };
}

export default function ResumoMensal() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(0);

  // Inicializa ano após montagem do componente para evitar erro de hidratação
  useEffect(() => {
    try {
      setSelectedYear(new Date().getFullYear());
    } catch (error) {
      console.error('Erro ao inicializar ano:', error);
      setSelectedYear(2025);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedYear]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/financial/reports/monthly-summary?year=${selectedYear}`);
      
      if (!response.ok) {
        throw new Error('Erro ao carregar dados');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Erro ao buscar dados:', err);
      setError('Erro ao carregar resumo mensal');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getCellColor = (value: number, isProfit: boolean = false) => {
    if (isProfit) {
      return value >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700';
    }
    return value < 0 ? 'bg-red-50 text-red-700' : '';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Resumo Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Resumo Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error || 'Erro ao carregar dados'}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Resumo Mensal - {selectedYear}</span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 border rounded-md text-sm"
          >
            {[2024, 2025, 2026].map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="meses" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-4">
            <TabsTrigger value="meses">Meses</TabsTrigger>
            <TabsTrigger value="ano">Ano</TabsTrigger>
          </TabsList>

          {/* Aba Meses */}
          <TabsContent value="meses">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-2 text-left font-semibold sticky left-0 bg-gray-100 z-10">
                      Valores referentes a data de competência
                    </th>
                    {data.monthlyData.map((month) => (
                      <th key={month.month} className="border p-2 text-center font-semibold min-w-[120px]">
                        {month.month} {selectedYear}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Faturamento Total */}
                  <tr className="hover:bg-gray-50">
                    <td className="border p-2 font-medium sticky left-0 bg-white z-10">
                      ✅ Faturamento Total
                    </td>
                    {data.monthlyData.map((month) => (
                      <td key={month.month} className={`border p-2 text-center ${getCellColor(month.revenue)}`}>
                        {formatCurrency(month.revenue)}
                      </td>
                    ))}
                  </tr>

                  {/* Despesas Operacionais */}
                  <tr className="hover:bg-gray-50">
                    <td className="border p-2 font-medium sticky left-0 bg-white z-10">
                      ➖ Despesas Operacionais
                    </td>
                    {data.monthlyData.map((month) => (
                      <td key={month.month} className={`border p-2 text-center ${getCellColor(-month.operationalExpenses)}`}>
                        {formatCurrency(-month.operationalExpenses)}
                      </td>
                    ))}
                  </tr>

                  {/* Despesas com Produto */}
                  <tr className="hover:bg-gray-50">
                    <td className="border p-2 font-medium sticky left-0 bg-white z-10">
                      ➖ Despesas com Produto
                    </td>
                    {data.monthlyData.map((month) => (
                      <td key={month.month} className={`border p-2 text-center ${getCellColor(-month.productExpenses)}`}>
                        {formatCurrency(-month.productExpenses)}
                      </td>
                    ))}
                  </tr>

                  {/* Despesas com Compras */}
                  <tr className="hover:bg-gray-50">
                    <td className="border p-2 font-medium sticky left-0 bg-white z-10">
                      ➖ Despesas com Compras
                    </td>
                    {data.monthlyData.map((month) => (
                      <td key={month.month} className={`border p-2 text-center ${getCellColor(-month.purchaseExpenses)}`}>
                        {formatCurrency(-month.purchaseExpenses)}
                      </td>
                    ))}
                  </tr>

                  {/* Lucro Operacional (Bruto) */}
                  <tr className="hover:bg-gray-50 font-bold bg-blue-50">
                    <td className="border p-2 font-bold sticky left-0 bg-blue-50 z-10">
                      💰 Lucro Operacional (Bruto)
                    </td>
                    {data.monthlyData.map((month) => (
                      <td key={month.month} className={`border p-2 text-center font-bold ${getCellColor(month.operationalProfit, true)}`}>
                        {formatCurrency(month.operationalProfit)}
                      </td>
                    ))}
                  </tr>

                  {/* Investimentos */}
                  <tr className="hover:bg-gray-50">
                    <td className="border p-2 font-medium sticky left-0 bg-white z-10">
                      ➖ Investimentos
                    </td>
                    {data.monthlyData.map((month) => (
                      <td key={month.month} className={`border p-2 text-center ${getCellColor(-month.investmentExpenses)}`}>
                        {formatCurrency(-month.investmentExpenses)}
                      </td>
                    ))}
                  </tr>

                  {/* Pró-labore */}
                  <tr className="hover:bg-gray-50">
                    <td className="border p-2 font-medium sticky left-0 bg-white z-10">
                      ➖ Pró-labore
                    </td>
                    {data.monthlyData.map((month) => (
                      <td key={month.month} className={`border p-2 text-center ${getCellColor(-month.proLaboreExpenses)}`}>
                        {formatCurrency(-month.proLaboreExpenses)}
                      </td>
                    ))}
                  </tr>

                  {/* Lucro Líquido */}
                  <tr className="hover:bg-gray-50 font-bold bg-green-50">
                    <td className="border p-2 font-bold sticky left-0 bg-green-50 z-10">
                      💵 Lucro Líquido
                    </td>
                    {data.monthlyData.map((month) => (
                      <td key={month.month} className={`border p-2 text-center font-bold ${getCellColor(month.netProfit, true)}`}>
                        {formatCurrency(month.netProfit)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Aba Ano */}
          <TabsContent value="ano">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-2 text-left font-semibold">
                      Valores referentes a data de competência
                    </th>
                    <th className="border p-2 text-center font-semibold min-w-[200px]">
                      Total {selectedYear}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Faturamento Total */}
                  <tr className="hover:bg-gray-50">
                    <td className="border p-2 font-medium">
                      ✅ Faturamento Total
                    </td>
                    <td className={`border p-2 text-center ${getCellColor(data.yearlyTotals.revenue)}`}>
                      {formatCurrency(data.yearlyTotals.revenue)}
                    </td>
                  </tr>

                  {/* Despesas Operacionais */}
                  <tr className="hover:bg-gray-50">
                    <td className="border p-2 font-medium">
                      ➖ Despesas Operacionais
                    </td>
                    <td className={`border p-2 text-center ${getCellColor(-data.yearlyTotals.operationalExpenses)}`}>
                      {formatCurrency(-data.yearlyTotals.operationalExpenses)}
                    </td>
                  </tr>

                  {/* Despesas com Produto */}
                  <tr className="hover:bg-gray-50">
                    <td className="border p-2 font-medium">
                      ➖ Despesas com Produto
                    </td>
                    <td className={`border p-2 text-center ${getCellColor(-data.yearlyTotals.productExpenses)}`}>
                      {formatCurrency(-data.yearlyTotals.productExpenses)}
                    </td>
                  </tr>

                  {/* Despesas com Compras */}
                  <tr className="hover:bg-gray-50">
                    <td className="border p-2 font-medium">
                      ➖ Despesas com Compras
                    </td>
                    <td className={`border p-2 text-center ${getCellColor(-data.yearlyTotals.purchaseExpenses)}`}>
                      {formatCurrency(-data.yearlyTotals.purchaseExpenses)}
                    </td>
                  </tr>

                  {/* Lucro Operacional (Bruto) */}
                  <tr className="hover:bg-gray-50 font-bold bg-blue-50">
                    <td className="border p-2 font-bold">
                      💰 Lucro Operacional (Bruto)
                    </td>
                    <td className={`border p-2 text-center font-bold ${getCellColor(data.yearlyTotals.operationalProfit, true)}`}>
                      {formatCurrency(data.yearlyTotals.operationalProfit)}
                    </td>
                  </tr>

                  {/* Investimentos */}
                  <tr className="hover:bg-gray-50">
                    <td className="border p-2 font-medium">
                      ➖ Investimentos
                    </td>
                    <td className={`border p-2 text-center ${getCellColor(-data.yearlyTotals.investmentExpenses)}`}>
                      {formatCurrency(-data.yearlyTotals.investmentExpenses)}
                    </td>
                  </tr>

                  {/* Pró-labore */}
                  <tr className="hover:bg-gray-50">
                    <td className="border p-2 font-medium">
                      ➖ Pró-labore
                    </td>
                    <td className={`border p-2 text-center ${getCellColor(-data.yearlyTotals.proLaboreExpenses)}`}>
                      {formatCurrency(-data.yearlyTotals.proLaboreExpenses)}
                    </td>
                  </tr>

                  {/* Lucro Líquido */}
                  <tr className="hover:bg-gray-50 font-bold bg-green-50">
                    <td className="border p-2 font-bold">
                      💵 Lucro Líquido
                    </td>
                    <td className={`border p-2 text-center font-bold ${getCellColor(data.yearlyTotals.netProfit, true)}`}>
                      {formatCurrency(data.yearlyTotals.netProfit)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
