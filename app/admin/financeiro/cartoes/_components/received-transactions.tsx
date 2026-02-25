'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Search, Calendar, Loader2, CreditCard } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CardTransaction {
  id: string;
  Order?: {
    orderNumber: string;
    customerName: string;
  };
  Receivable?: {
    id: string;
    description: string;
    amount: number;
    Customer?: {
      name: string;
    };
  };
  BankAccount: {
    name: string;
  } | null;
  cardType: 'DEBIT' | 'CREDIT';
  grossAmount: number;
  feePercentage: number;
  feeAmount: number;
  netAmount: number;
  saleDate: string;
  expectedDate: string;
  receivedDate: string;
}

export function ReceivedTransactions() {
  const [transactions, setTransactions] = useState<CardTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async (filters?: { startDate?: string; endDate?: string }) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        status: 'RECEIVED',
        ...(filters?.startDate && { startDate: filters.startDate }),
        ...(filters?.endDate && { endDate: filters.endDate }),
      });

      const response = await fetch(`/api/financial/card-transactions?${params}`);
      if (!response.ok) throw new Error('Erro ao carregar transações');
      
      const data = await response.json();
      setTransactions(data);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar histórico de transações');
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    loadTransactions({ startDate, endDate });
  };

  const totalGross = transactions.reduce((sum, t) => sum + t.grossAmount, 0);
  const totalFees = transactions.reduce((sum, t) => sum + t.feeAmount, 0);
  const totalNet = transactions.reduce((sum, t) => sum + t.netAmount, 0);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="startDate">Data Inicial</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="endDate">Data Final</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleFilter} className="w-full md:w-auto">
                <Search className="w-4 h-4 mr-2" />
                Filtrar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Transações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {transactions.length}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Recebidas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Valor Bruto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalGross)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Total em vendas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Taxas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalFees)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Total pago
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Valor Líquido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalNet)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Recebido
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Transactions List */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Transações</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CreditCard className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Nenhuma transação encontrada</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="border rounded-lg p-4 hover:border-gray-300 transition-colors"
                >
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                    {/* Order/Receivable Info */}
                    <div>
                      <div className="text-sm font-semibold text-gray-900">
                        {transaction.Order?.orderNumber || transaction.Receivable?.description || 'N/A'}
                      </div>
                      <div className="text-sm text-gray-600">
                        {transaction.Order?.customerName || transaction.Receivable?.Customer?.name || 'Cliente não identificado'}
                      </div>
                    </div>

                    {/* Card Type */}
                    <div className="flex items-center">
                      <Badge variant={transaction.cardType === 'DEBIT' ? 'default' : 'secondary'}>
                        {transaction.cardType === 'DEBIT' ? 'Débito' : 'Crédito'}
                      </Badge>
                    </div>

                    {/* Amounts */}
                    <div className="space-y-1">
                      <div className="text-sm text-gray-600">
                        Bruto: <span className="font-semibold text-gray-900">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(transaction.grossAmount)}
                        </span>
                      </div>
                      <div className="text-xs text-red-600">
                        Taxa: -{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(transaction.feeAmount)}
                      </div>
                      <div className="text-sm font-semibold text-blue-600">
                        Líquido: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(transaction.netAmount)}
                      </div>
                    </div>

                    {/* Dates */}
                    <div className="text-sm space-y-1">
                      <div className="text-gray-600">
                        Venda: {format(new Date(transaction.saleDate), 'dd/MM/yyyy', { locale: ptBR })}
                      </div>
                      <div className="text-orange-600">
                        Previsto: {format(new Date(transaction.expectedDate), 'dd/MM/yyyy', { locale: ptBR })}
                      </div>
                    </div>

                    {/* Received Info */}
                    <div className="text-sm space-y-1">
                      <div className="text-green-600 font-medium">
                        Recebido: {format(new Date(transaction.receivedDate), 'dd/MM/yyyy', { locale: ptBR })}
                      </div>
                      <div className="text-gray-500 text-xs">
                        {transaction.BankAccount?.name || 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
