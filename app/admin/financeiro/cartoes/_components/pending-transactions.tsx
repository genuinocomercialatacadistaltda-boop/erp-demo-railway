'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { CheckCircle, CreditCard, Calendar, DollarSign, Loader2, TrendingDown } from 'lucide-react';
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
  cardType: 'DEBIT' | 'CREDIT';
  grossAmount: number;
  feePercentage: number;
  feeAmount: number;
  netAmount: number;
  saleDate: string;
  expectedDate: string;
}

export function PendingTransactions() {
  const [transactions, setTransactions] = useState<CardTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
  const [receivedDate, setReceivedDate] = useState('');

  // Inicializa data após montagem do componente para evitar erro de hidratação
  useEffect(() => {
    try {
      setReceivedDate(format(new Date(), 'yyyy-MM-dd'));
    } catch (error) {
      console.error('Erro ao inicializar data:', error);
      setReceivedDate('2025-11-26');
    }
  }, []);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/financial/card-transactions?status=PENDING');
      if (!response.ok) throw new Error('Erro ao carregar transações');
      
      const data = await response.json();
      setTransactions(data);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar transações pendentes');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTransaction = (id: string) => {
    setSelectedTransactions(prev => 
      prev.includes(id) 
        ? prev.filter(t => t !== id)
        : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedTransactions.length === transactions.length) {
      setSelectedTransactions([]);
    } else {
      setSelectedTransactions(transactions.map(t => t.id));
    }
  };

  const handleConfirmReceipts = async () => {
    if (selectedTransactions.length === 0) {
      toast.error('Selecione pelo menos uma transação');
      return;
    }

    try {
      setConfirming(true);
      const response = await fetch('/api/financial/card-transactions/confirm-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionIds: selectedTransactions,
          receivedDate,
        }),
      });

      if (!response.ok) throw new Error('Erro ao confirmar recebimentos');

      const result = await response.json();
      toast.success(`${result.count} transação(ões) confirmada(s) com sucesso!`);
      
      setSelectedTransactions([]);
      setShowConfirmDialog(false);
      loadTransactions();
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao confirmar recebimentos');
    } finally {
      setConfirming(false);
    }
  };

  const totalSelected = transactions
    .filter(t => selectedTransactions.includes(t.id))
    .reduce((sum, t) => sum + t.grossAmount, 0);

  const totalNetSelected = transactions
    .filter(t => selectedTransactions.includes(t.id))
    .reduce((sum, t) => sum + t.netAmount, 0);

  const totalFeesSelected = transactions
    .filter(t => selectedTransactions.includes(t.id))
    .reduce((sum, t) => sum + t.feeAmount, 0);

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
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {transactions.length}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Aguardando confirmação
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
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                transactions.reduce((sum, t) => sum + t.grossAmount, 0)
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Total em vendas
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
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                transactions.reduce((sum, t) => sum + t.netAmount, 0)
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              A receber (após taxas)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Transactions List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Transações Pendentes</CardTitle>
            {selectedTransactions.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  {selectedTransactions.length} selecionada(s)
                </span>
                <Button
                  onClick={() => setShowConfirmDialog(true)}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Confirmar Recebimentos
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CreditCard className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Nenhuma transação pendente</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Select All */}
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  checked={selectedTransactions.length === transactions.length}
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm font-medium">
                  Selecionar todas
                </span>
              </div>

              {/* Transaction Items */}
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className={`border rounded-lg p-4 transition-all ${
                    selectedTransactions.includes(transaction.id)
                      ? 'border-orange-400 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={selectedTransactions.includes(transaction.id)}
                      onChange={() => handleSelectTransaction(transaction.id)}
                      className="w-5 h-5 rounded border-gray-300 mt-1"
                    />
                    
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4">
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
                      <div>
                        <Badge variant={transaction.cardType === 'DEBIT' ? 'default' : 'secondary'}>
                          {transaction.cardType === 'DEBIT' ? 'Débito' : 'Crédito'}
                        </Badge>
                      </div>

                      {/* Amounts */}
                      <div className="space-y-1">
                        <div className="text-sm">
                          <span className="text-gray-600">Bruto:</span>{' '}
                          <span className="font-semibold text-gray-900">
                            {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL'
                            }).format(transaction.grossAmount)}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          Taxa {transaction.feePercentage}%: -{new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL'
                          }).format(transaction.feeAmount)}
                        </div>
                        <div className="text-sm">
                          <span className="text-gray-600">Líquido:</span>{' '}
                          <span className="font-semibold text-blue-600">
                            {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL'
                            }).format(transaction.netAmount)}
                          </span>
                        </div>
                      </div>

                      {/* Dates */}
                      <div className="text-sm">
                        <div className="text-gray-600">
                          <Calendar className="w-3 h-3 inline mr-1" />
                          Venda: {format(new Date(transaction.saleDate), 'dd/MM/yyyy', { locale: ptBR })}
                        </div>
                        <div className="text-orange-600 font-medium mt-1">
                          Previsto: {format(new Date(transaction.expectedDate), 'dd/MM/yyyy', { locale: ptBR })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Recebimentos</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-orange-50 p-4 rounded-lg space-y-2">
              <div className="text-sm">
                <span className="text-gray-600">Transações selecionadas:</span>{' '}
                <span className="font-semibold">{selectedTransactions.length}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-600">Valor bruto total:</span>{' '}
                <span className="font-semibold text-green-600">
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                  }).format(totalSelected)}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-gray-600">Total de taxas:</span>{' '}
                <span className="font-semibold text-red-600">
                  -{new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                  }).format(totalFeesSelected)}
                </span>
              </div>
              <div className="text-sm pt-2 border-t">
                <span className="text-gray-600">Valor líquido a receber:</span>{' '}
                <span className="font-bold text-blue-600 text-lg">
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                  }).format(totalNetSelected)}
                </span>
              </div>
            </div>

            <div>
              <Label htmlFor="receivedDate">Data de Recebimento</Label>
              <Input
                id="receivedDate"
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                className="mt-1"
              />
            </div>

            <p className="text-sm text-gray-600">
              As taxas serão registradas automaticamente como despesas operacionais
              e o valor líquido será creditado na conta Itaú.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={confirming}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmReceipts}
              disabled={confirming}
              className="bg-green-600 hover:bg-green-700"
            >
              {confirming ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Confirmando...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Confirmar Recebimentos
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
