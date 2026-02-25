"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { FileText, TrendingUp, TrendingDown, DollarSign, Calendar } from "lucide-react";
import { format } from "date-fns";

interface DREData {
  period: {
    startDate: string;
    endDate: string;
  };
  revenue: {
    gross: number;
    discounts: number;
    net: number;
  };
  costs: {
    total: number;
    expenses: number;
    creditCardExpenses: number;
    purchases: number;
    byCategory: Array<{ name: string; amount: number }>;
  };
  operatingIncome: number;
  financialResult: {
    cardFees: number;
    transactionFees: number;
    total: number;
  };
  netIncome: number;
  metrics: {
    profitMargin: number;
    operatingMargin: number;
  };
}

interface CashFlowData {
  period: {
    startDate: string;
    endDate: string;
  };
  initialBalance: number;
  finalBalance: number;
  totalInflows: number;
  totalOutflows: number;
  netCashFlow: number;
  daily: Array<{
    date: string;
    inflows: number;
    outflows: number;
    balance: number;
  }>;
}

export default function Relatorios() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Inicializa datas após montagem do componente para evitar erro de hidratação
  useEffect(() => {
    try {
      const now = new Date();
      setStartDate(format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd"));
      setEndDate(format(now, "yyyy-MM-dd"));
    } catch (error) {
      console.error('Erro ao inicializar datas:', error);
      setStartDate('2025-11-01');
      setEndDate('2025-11-26');
    }
  }, []);
  const [dreData, setDreData] = useState<DREData | null>(null);
  const [cashFlowData, setCashFlowData] = useState<CashFlowData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchDRE = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ startDate, endDate });
      const response = await fetch(`/api/financial/reports/dre?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        setDreData(data);
      } else {
        toast.error("Erro ao gerar DRE");
      }
    } catch (error) {
      toast.error("Erro ao gerar DRE");
    } finally {
      setLoading(false);
    }
  };

  const fetchCashFlow = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ startDate, endDate });
      const response = await fetch(`/api/financial/reports/cashflow?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        setCashFlowData(data);
      } else {
        toast.error("Erro ao gerar Fluxo de Caixa");
      }
    } catch (error) {
      toast.error("Erro ao gerar Fluxo de Caixa");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Relatórios Financeiros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <Label htmlFor="startDate">Data Início</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="endDate">Data Fim</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={fetchDRE} disabled={loading} className="flex-1">
                Gerar DRE
              </Button>
              <Button onClick={fetchCashFlow} disabled={loading} className="flex-1">
                Gerar Fluxo
              </Button>
            </div>
          </div>

          <Tabs defaultValue="dre" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="dre">DRE</TabsTrigger>
              <TabsTrigger value="cashflow">Fluxo de Caixa</TabsTrigger>
            </TabsList>

            <TabsContent value="dre">
              {dreData ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Receita Bruta</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                          R$ {dreData.revenue.gross.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Receita Líquida</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                          R$ {dreData.revenue.net.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Descontos: R$ {dreData.revenue.discounts.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Despesas Totais</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                          R$ {dreData.costs.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </div>
                        <div className="space-y-1 mt-2 text-xs text-muted-foreground border-t pt-2">
                          <div className="flex justify-between">
                            <span>Despesas Normais:</span>
                            <span className="font-semibold">R$ {dreData.costs.expenses.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Cartão de Crédito:</span>
                            <span className="font-semibold">R$ {dreData.costs.creditCardExpenses.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Compras:</span>
                            <span className="font-semibold">R$ {dreData.costs.purchases.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Lucro Líquido</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className={`text-2xl font-bold ${dreData.netIncome >= 0 ? "text-green-600" : "text-red-600"}`}>
                          R$ {dreData.netIncome.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Margem: {dreData.metrics.profitMargin.toFixed(2)}%
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Despesas por Categoria</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {dreData.costs.byCategory.map((cat, index) => (
                          <div key={index} className="flex justify-between items-center">
                            <span className="text-sm">{cat.name}</span>
                            <span className="font-semibold">
                              R$ {cat.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Resultado Financeiro</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Taxas de Cartão</span>
                          <span className="text-red-600">
                            -R$ {dreData.financialResult.cardFees.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Outras Taxas</span>
                          <span className="text-red-600">
                            -R$ {dreData.financialResult.transactionFees.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between font-semibold border-t pt-2">
                          <span>Total</span>
                          <span className="text-red-600">
                            R$ {dreData.financialResult.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Selecione o período e clique em "Gerar DRE" para visualizar o relatório
                </div>
              )}
            </TabsContent>

            <TabsContent value="cashflow">
              {cashFlowData ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Saldo Inicial</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          R$ {cashFlowData.initialBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Entradas Projetadas</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                          +R$ {cashFlowData.totalInflows.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Saídas Projetadas</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                          -R$ {cashFlowData.totalOutflows.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Saldo Final Projetado</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className={`text-2xl font-bold ${cashFlowData.finalBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
                          R$ {cashFlowData.finalBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Fluxo Líquido</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className={`text-2xl font-bold ${cashFlowData.netCashFlow >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {cashFlowData.netCashFlow >= 0 ? "+" : ""}R$ {cashFlowData.netCashFlow.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Fluxo Diário Projetado</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {cashFlowData.daily.map((day, index) => (
                          <div key={index} className="flex justify-between items-center border-b pb-2">
                            <span className="text-sm font-medium">
                              {format(new Date(day.date), "dd/MM/yyyy")}
                            </span>
                            <div className="flex gap-4 text-sm">
                              <span className="text-green-600">
                                +R$ {day.inflows.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </span>
                              <span className="text-red-600">
                                -R$ {day.outflows.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </span>
                              <span className={`font-semibold ${day.balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                                = R$ {day.balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Selecione o período e clique em "Gerar Fluxo" para visualizar o relatório
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
