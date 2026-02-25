'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, Loader2, CreditCard, Calendar } from 'lucide-react';

interface Summary {
  debit: {
    pending: { count: number; grossAmount: number; feeAmount: number; netAmount: number };
    received: { count: number; grossAmount: number; feeAmount: number; netAmount: number };
    total: { count: number; grossAmount: number; feeAmount: number; netAmount: number };
  };
  credit: {
    pending: { count: number; grossAmount: number; feeAmount: number; netAmount: number };
    received: { count: number; grossAmount: number; feeAmount: number; netAmount: number };
    total: { count: number; grossAmount: number; feeAmount: number; netAmount: number };
  };
  overall: {
    pending: { count: number; grossAmount: number; feeAmount: number; netAmount: number };
    received: { count: number; grossAmount: number; feeAmount: number; netAmount: number };
    total: { count: number; grossAmount: number; feeAmount: number; netAmount: number };
  };
}

export function CardReports() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async (filters?: { startDate?: string; endDate?: string }) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        ...(filters?.startDate && { startDate: filters.startDate }),
        ...(filters?.endDate && { endDate: filters.endDate }),
      });

      const response = await fetch(`/api/financial/card-transactions/summary?${params}`);
      if (!response.ok) throw new Error('Erro ao carregar resumo');
      
      const data = await response.json();
      setSummary(data);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar relatórios');
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    loadSummary({ startDate, endDate });
  };

  if (loading || !summary) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Filtrar Período
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="reportStartDate">Data Inicial</Label>
              <Input
                id="reportStartDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="reportEndDate">Data Final</Label>
              <Input
                id="reportEndDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleFilter} className="w-full md:w-auto">
                <BarChart3 className="w-4 h-4 mr-2" />
                Gerar Relatório
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overall Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-blue-700">
              Total de Transações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {summary.overall.total.count}
            </div>
            <p className="text-xs text-blue-600 mt-1">
              {summary.overall.pending.count} pendentes • {summary.overall.received.count} recebidas
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-green-700">
              Valor Bruto Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {formatCurrency(summary.overall.total.grossAmount)}
            </div>
            <p className="text-xs text-green-600 mt-1">
              Total em vendas
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-red-700">
              Total de Taxas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {formatCurrency(summary.overall.total.feeAmount)}
            </div>
            <p className="text-xs text-red-600 mt-1">
              {((summary.overall.total.feeAmount / summary.overall.total.grossAmount) * 100).toFixed(2)}% do bruto
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-purple-700">
              Valor Líquido Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">
              {formatCurrency(summary.overall.total.netAmount)}
            </div>
            <p className="text-xs text-purple-600 mt-1">
              {((summary.overall.total.netAmount / summary.overall.total.grossAmount) * 100).toFixed(2)}% do bruto
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Debit Cards Report */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            Cartões de Débito
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-2">Pendentes</div>
              <div className="space-y-1">
                <div className="text-sm">
                  <span className="text-gray-600">Transações:</span>{' '}
                  <span className="font-semibold">{summary.debit.pending.count}</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-600">Bruto:</span>{' '}
                  <span className="font-semibold text-green-600">
                    {formatCurrency(summary.debit.pending.grossAmount)}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-600">Taxas:</span>{' '}
                  <span className="font-semibold text-red-600">
                    {formatCurrency(summary.debit.pending.feeAmount)}
                  </span>
                </div>
                <div className="text-sm pt-1 border-t">
                  <span className="text-gray-600">Líquido:</span>{' '}
                  <span className="font-bold text-blue-600">
                    {formatCurrency(summary.debit.pending.netAmount)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-2">Recebidas</div>
              <div className="space-y-1">
                <div className="text-sm">
                  <span className="text-gray-600">Transações:</span>{' '}
                  <span className="font-semibold">{summary.debit.received.count}</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-600">Bruto:</span>{' '}
                  <span className="font-semibold text-green-600">
                    {formatCurrency(summary.debit.received.grossAmount)}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-600">Taxas:</span>{' '}
                  <span className="font-semibold text-red-600">
                    {formatCurrency(summary.debit.received.feeAmount)}
                  </span>
                </div>
                <div className="text-sm pt-1 border-t">
                  <span className="text-gray-600">Líquido:</span>{' '}
                  <span className="font-bold text-blue-600">
                    {formatCurrency(summary.debit.received.netAmount)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-2">Total</div>
              <div className="space-y-1">
                <div className="text-sm">
                  <span className="text-gray-600">Transações:</span>{' '}
                  <span className="font-semibold">{summary.debit.total.count}</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-600">Bruto:</span>{' '}
                  <span className="font-semibold text-green-600">
                    {formatCurrency(summary.debit.total.grossAmount)}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-600">Taxas:</span>{' '}
                  <span className="font-semibold text-red-600">
                    {formatCurrency(summary.debit.total.feeAmount)}
                  </span>
                </div>
                <div className="text-sm pt-1 border-t">
                  <span className="text-gray-600">Líquido:</span>{' '}
                  <span className="font-bold text-blue-600">
                    {formatCurrency(summary.debit.total.netAmount)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Credit Cards Report */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-purple-600" />
            Cartões de Crédito
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-2">Pendentes</div>
              <div className="space-y-1">
                <div className="text-sm">
                  <span className="text-gray-600">Transações:</span>{' '}
                  <span className="font-semibold">{summary.credit.pending.count}</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-600">Bruto:</span>{' '}
                  <span className="font-semibold text-green-600">
                    {formatCurrency(summary.credit.pending.grossAmount)}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-600">Taxas:</span>{' '}
                  <span className="font-semibold text-red-600">
                    {formatCurrency(summary.credit.pending.feeAmount)}
                  </span>
                </div>
                <div className="text-sm pt-1 border-t">
                  <span className="text-gray-600">Líquido:</span>{' '}
                  <span className="font-bold text-blue-600">
                    {formatCurrency(summary.credit.pending.netAmount)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-2">Recebidas</div>
              <div className="space-y-1">
                <div className="text-sm">
                  <span className="text-gray-600">Transações:</span>{' '}
                  <span className="font-semibold">{summary.credit.received.count}</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-600">Bruto:</span>{' '}
                  <span className="font-semibold text-green-600">
                    {formatCurrency(summary.credit.received.grossAmount)}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-600">Taxas:</span>{' '}
                  <span className="font-semibold text-red-600">
                    {formatCurrency(summary.credit.received.feeAmount)}
                  </span>
                </div>
                <div className="text-sm pt-1 border-t">
                  <span className="text-gray-600">Líquido:</span>{' '}
                  <span className="font-bold text-blue-600">
                    {formatCurrency(summary.credit.received.netAmount)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-2">Total</div>
              <div className="space-y-1">
                <div className="text-sm">
                  <span className="text-gray-600">Transações:</span>{' '}
                  <span className="font-semibold">{summary.credit.total.count}</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-600">Bruto:</span>{' '}
                  <span className="font-semibold text-green-600">
                    {formatCurrency(summary.credit.total.grossAmount)}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-600">Taxas:</span>{' '}
                  <span className="font-semibold text-red-600">
                    {formatCurrency(summary.credit.total.feeAmount)}
                  </span>
                </div>
                <div className="text-sm pt-1 border-t">
                  <span className="text-gray-600">Líquido:</span>{' '}
                  <span className="font-bold text-blue-600">
                    {formatCurrency(summary.credit.total.netAmount)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Comparativo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3">Débito vs Crédito</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span className="text-sm">Transações Débito</span>
                  <span className="font-semibold">{summary.debit.total.count}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span className="text-sm">Transações Crédito</span>
                  <span className="font-semibold">{summary.credit.total.count}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded">
                  <span className="text-sm font-medium">Percentual Débito</span>
                  <span className="font-bold text-blue-600">
                    {((summary.debit.total.count / summary.overall.total.count) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-purple-50 rounded">
                  <span className="text-sm font-medium">Percentual Crédito</span>
                  <span className="font-bold text-purple-600">
                    {((summary.credit.total.count / summary.overall.total.count) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-3">Impacto das Taxas</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span className="text-sm">Taxa Média Débito</span>
                  <span className="font-semibold text-red-600">
                    {summary.debit.total.grossAmount > 0
                      ? ((summary.debit.total.feeAmount / summary.debit.total.grossAmount) * 100).toFixed(2)
                      : 0}%
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span className="text-sm">Taxa Média Crédito</span>
                  <span className="font-semibold text-red-600">
                    {summary.credit.total.grossAmount > 0
                      ? ((summary.credit.total.feeAmount / summary.credit.total.grossAmount) * 100).toFixed(2)
                      : 0}%
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-red-50 rounded">
                  <span className="text-sm font-medium">Total de Taxas</span>
                  <span className="font-bold text-red-600">
                    {formatCurrency(summary.overall.total.feeAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded">
                  <span className="text-sm font-medium">Economia Potencial</span>
                  <span className="font-bold text-green-600">
                    {formatCurrency(summary.overall.total.feeAmount * 0.1)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
