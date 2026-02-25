'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Award, TrendingUp, TrendingDown, Info } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PointTransaction {
  id: string;
  type: string;
  amount: number;
  balance: number;
  description: string;
  createdAt: string;
}

export default function ClientCustomerPoints() {
  const [balance, setBalance] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPoints();
  }, []);

  const loadPoints = async () => {
    try {
      const res = await fetch('/api/client-customer/points');
      const data = await res.json();

      if (data.success) {
        setBalance(data.balance);
        setTotalEarned(data.totalEarned);
        setMultiplier(data.multiplier);
        setTransactions(data.transactions);
      }
    } catch (error) {
      console.error('Error loading points:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'EARNED':
        return <TrendingUp className="h-5 w-5 text-green-600" />;
      case 'REDEEMED':
        return <TrendingDown className="h-5 w-5 text-red-600" />;
      case 'ADJUSTMENT':
        return <Info className="h-5 w-5 text-blue-600" />;
      case 'EXPIRED':
        return <Info className="h-5 w-5 text-gray-600" />;
      default:
        return <Info className="h-5 w-5 text-gray-600" />;
    }
  };

  const getTransactionBadge = (type: string) => {
    const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      EARNED: { label: 'Ganhou', variant: 'default' },
      REDEEMED: { label: 'Resgatou', variant: 'destructive' },
      ADJUSTMENT: { label: 'Ajuste', variant: 'secondary' },
      EXPIRED: { label: 'Expirou', variant: 'outline' },
    };

    const item = config[type] || { label: type, variant: 'outline' };
    return <Badge variant={item.variant}>{item.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Meus Pontos</h1>
        <p className="text-gray-600 mt-2">
          Acumule pontos em suas compras e troque por descontos
        </p>
      </div>

      {/* Points Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">
              Saldo Atual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="bg-yellow-50 p-3 rounded-lg">
                <Award className="h-8 w-8 text-yellow-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-yellow-600">
                  {Math.floor(balance)}
                </p>
                <p className="text-sm text-gray-600">pontos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Acumulado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="bg-green-50 p-3 rounded-lg">
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-green-600">
                  {Math.floor(totalEarned)}
                </p>
                <p className="text-sm text-gray-600">pontos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">
              Multiplicador
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="bg-blue-50 p-3 rounded-lg">
                <span className="text-3xl">✨</span>
              </div>
              <div>
                <p className="text-3xl font-bold text-blue-600">{multiplier}x</p>
                <p className="text-sm text-gray-600">nas compras</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* How it works */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle>Como Funciona o Programa de Fidelidade?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-700">
          <p>
            • <strong>Ganhe pontos:</strong> A cada R$ 1,00 gasto, você ganha pontos automaticamente
          </p>
          <p>
            • <strong>Use seus pontos:</strong> 1 ponto = R$ 1,00 de desconto nos seus pedidos
          </p>
          <p>
            • <strong>Multiplicador especial:</strong> Seu multiplicador atual é {multiplier}x, ou seja, você ganha mais pontos que o normal!
          </p>
        </CardContent>
      </Card>

      {/* Transactions History */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Pontos</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Award className="h-12 w-12 text-gray-300 mx-auto mb-2" />
              <p>Nenhuma transação de pontos ainda</p>
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-start gap-4 pb-4 border-b last:border-0 last:pb-0"
                >
                  <div className="mt-1">{getTransactionIcon(transaction.type)}</div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium">{transaction.description}</p>
                        <p className="text-sm text-gray-500">
                          {format(new Date(transaction.createdAt), "dd/MM/yyyy 'às' HH:mm", {
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                      {getTransactionBadge(transaction.type)}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span
                        className={
                          transaction.amount >= 0
                            ? 'text-green-600 font-semibold'
                            : 'text-red-600 font-semibold'
                        }
                      >
                        {transaction.amount >= 0 ? '+' : ''}
                        {Math.floor(transaction.amount)} pontos
                      </span>
                      <span className="text-sm text-gray-500">
                        Saldo: {Math.floor(transaction.balance)} pontos
                      </span>
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
