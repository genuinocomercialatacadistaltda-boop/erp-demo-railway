'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Award, Gift, History, TrendingUp, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';

interface Balance {
  pointsBalance: number;
  pointsMultiplier: number;
  totalPointsEarned: number;
  totalPointsRedeemed: number;
  pointsPerReal: number;
}

interface Prize {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  pointsCost: number;
  stockQuantity: number | null;
  isActive: boolean;
  category: string | null;
  canRedeem: boolean;
  pointsNeeded: number;
}

interface Transaction {
  id: string;
  type: string;
  points: number;
  multiplierApplied: number;
  orderAmount: number | null;
  description: string | null;
  createdAt: string;
}

interface Redemption {
  id: string;
  pointsUsed: number;
  status: string;
  requestedAt: string;
  processedAt: string | null;
  notes: string | null;
  rejectionReason: string | null;
  Prize: {
    name: string;
    description: string | null;
    imageUrl: string | null;
  };
}

export default function CustomerRewardsPage() {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [selectedPrize, setSelectedPrize] = useState<Prize | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchBalance();
    fetchPrizes();
    fetchTransactions();
    fetchRedemptions();
  }, []);

  const fetchBalance = async () => {
    try {
      const response = await fetch('/api/customers/rewards/balance');
      if (response.ok) {
        const data = await response.json();
        setBalance(data);
      }
    } catch (error) {
      console.error('Erro ao buscar saldo:', error);
    }
  };

  const fetchPrizes = async () => {
    try {
      const response = await fetch('/api/customers/rewards/prizes');
      if (response.ok) {
        const data = await response.json();
        setPrizes(data.prizes || []);
      }
    } catch (error) {
      console.error('Erro ao buscar brindes:', error);
    }
  };

  const fetchTransactions = async () => {
    try {
      const response = await fetch('/api/customers/rewards/history?limit=20');
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
      }
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
    }
  };

  const fetchRedemptions = async () => {
    try {
      const response = await fetch('/api/customers/rewards/redemptions');
      if (response.ok) {
        const data = await response.json();
        setRedemptions(data);
      }
    } catch (error) {
      console.error('Erro ao buscar resgates:', error);
    }
  };

  const handleRedeem = async () => {
    if (!selectedPrize) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/customers/rewards/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prizeId: selectedPrize.id })
      });

      if (response.ok) {
        toast.success('Resgate solicitado com sucesso! Aguarde a aprovação.');
        setIsDialogOpen(false);
        setSelectedPrize(null);
        fetchBalance();
        fetchPrizes();
        fetchRedemptions();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Erro ao solicitar resgate');
      }
    } catch (error) {
      console.error('Erro ao resgatar:', error);
      toast.error('Erro ao solicitar resgate');
    } finally {
      setIsLoading(false);
    }
  };

  const getTransactionTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      EARNED_FROM_ORDER: '🛍️ Ganho em Compra',
      REDEEMED_FOR_PRIZE: '🎁 Resgate de Brinde',
      MANUAL_ADJUSTMENT: '⚙️ Ajuste Manual',
      BONUS: '🎉 Bônus',
      EXPIRED: '⏰ Expirado'
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const variants: { [key: string]: { variant: any; label: string } } = {
      PENDING: { variant: 'secondary', label: '⏳ Pendente' },
      APPROVED: { variant: 'default', label: '✅ Aprovado' },
      REJECTED: { variant: 'destructive', label: '❌ Rejeitado' },
      DELIVERED: { variant: 'outline', label: '📦 Entregue' },
      CANCELLED: { variant: 'secondary', label: '🚫 Cancelado' }
    };
    const config = variants[status] || variants.PENDING;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (!balance) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">🎁 Meus Pontos e Recompensas</h1>
        <p className="text-muted-foreground mt-1">
          Acumule pontos e troque por brindes exclusivos!
        </p>
      </div>

      {/* Card de Saldo */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Seu Saldo de Pontos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center p-4 bg-white rounded-lg">
              <Award className="h-8 w-8 mx-auto text-primary mb-2" />
              <p className="text-3xl font-bold text-primary">{Math.round(balance.pointsBalance)}</p>
              <p className="text-sm text-muted-foreground">Pontos Disponíveis</p>
            </div>
            
            <div className="text-center p-4 bg-white rounded-lg">
              <TrendingUp className="h-8 w-8 mx-auto text-green-500 mb-2" />
              <p className="text-2xl font-bold">{Math.round(balance.totalPointsEarned)}</p>
              <p className="text-sm text-muted-foreground">Total Ganho</p>
            </div>
            
            <div className="text-center p-4 bg-white rounded-lg">
              <Gift className="h-8 w-8 mx-auto text-blue-500 mb-2" />
              <p className="text-2xl font-bold">{Math.round(balance.totalPointsRedeemed)}</p>
              <p className="text-sm text-muted-foreground">Total Resgatado</p>
            </div>
            
            <div className="text-center p-4 bg-white rounded-lg">
              <Sparkles className="h-8 w-8 mx-auto text-yellow-500 mb-2" />
              <p className="text-2xl font-bold">{balance.pointsMultiplier}x</p>
              <p className="text-sm text-muted-foreground">Multiplicador</p>
            </div>
          </div>

          <div className="mt-4 p-3 bg-white/50 rounded-lg">
            <p className="text-sm text-muted-foreground text-center">
              💡 Você ganha <strong>{balance.pointsPerReal.toFixed(1)} ponto(s)</strong> a cada R$ 1,00 gasto 
              × seu multiplicador de <strong>{balance.pointsMultiplier}x</strong>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="prizes" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="prizes">
            <Gift className="h-4 w-4 mr-2" />
            Brindes
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-2" />
            Histórico
          </TabsTrigger>
          <TabsTrigger value="redemptions">
            <Award className="h-4 w-4 mr-2" />
            Meus Resgates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="prizes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Catálogo de Brindes</CardTitle>
              <CardDescription>
                Escolha seus brindes e solicite o resgate
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {prizes.length === 0 ? (
                  <p className="col-span-full text-center text-muted-foreground py-8">
                    Nenhum brinde disponível no momento
                  </p>
                ) : (
                  prizes.map((prize) => (
                    <Card key={prize.id} className={prize.canRedeem ? 'border-primary/50' : 'opacity-60'}>
                      <CardContent className="pt-6">
                        <div className="space-y-3">
                          {prize.imageUrl && (
                            <div className="relative w-full aspect-square bg-gray-100 rounded-lg overflow-hidden">
                              <Image
                                src={prize.imageUrl}
                                alt={prize.name}
                                fill
                                className="object-cover"
                              />
                            </div>
                          )}
                          
                          <div>
                            <h3 className="font-bold text-lg">{prize.name}</h3>
                            {prize.description && (
                              <p className="text-sm text-muted-foreground mt-1">{prize.description}</p>
                            )}
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <Badge variant="secondary" className="text-lg px-3 py-1">
                              {prize.pointsCost} pts
                            </Badge>
                            {prize.stockQuantity !== null && (
                              <span className="text-xs text-muted-foreground">
                                {prize.stockQuantity} disponível(is)
                              </span>
                            )}
                          </div>

                          {!prize.canRedeem && prize.pointsNeeded > 0 && (
                            <p className="text-sm text-muted-foreground">
                              Faltam <strong>{prize.pointsNeeded} pontos</strong>
                            </p>
                          )}

                          <Button
                            className="w-full"
                            disabled={!prize.canRedeem}
                            onClick={() => {
                              setSelectedPrize(prize);
                              setIsDialogOpen(true);
                            }}
                          >
                            {prize.canRedeem ? 'Resgatar Agora' : 'Pontos Insuficientes'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Pontos</CardTitle>
              <CardDescription>
                Todas as suas transações de pontos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {transactions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma transação ainda
                  </p>
                ) : (
                  transactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{getTransactionTypeLabel(transaction.type)}</p>
                        {transaction.description && (
                          <p className="text-sm text-muted-foreground">{transaction.description}</p>
                        )}
                        {transaction.orderAmount && (
                          <p className="text-xs text-muted-foreground">
                            Compra de R$ {transaction.orderAmount.toFixed(2)}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(transaction.createdAt).toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <Badge variant={transaction.points > 0 ? 'default' : 'secondary'} className="ml-2">
                        {transaction.points > 0 ? '+' : ''}{transaction.points.toFixed(2)}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="redemptions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Meus Resgates</CardTitle>
              <CardDescription>
                Acompanhe o status dos seus resgates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {redemptions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum resgate solicitado ainda
                  </p>
                ) : (
                  redemptions.map((redemption) => (
                    <div key={redemption.id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-medium">{redemption.Prize.name}</p>
                          {redemption.Prize.description && (
                            <p className="text-sm text-muted-foreground">{redemption.Prize.description}</p>
                          )}
                        </div>
                        {getStatusBadge(redemption.status)}
                      </div>
                      
                      <div className="flex items-center justify-between text-sm text-muted-foreground mt-3">
                        <span>{redemption.pointsUsed} pontos</span>
                        <span>{new Date(redemption.requestedAt).toLocaleDateString('pt-BR')}</span>
                      </div>

                      {redemption.rejectionReason && (
                        <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-600">
                          <strong>Motivo da rejeição:</strong> {redemption.rejectionReason}
                        </div>
                      )}

                      {redemption.notes && (
                        <div className="mt-2 p-2 bg-blue-50 rounded text-sm text-blue-600">
                          <strong>Obs:</strong> {redemption.notes}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de Confirmação de Resgate */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Resgate</DialogTitle>
            <DialogDescription>
              Você tem certeza que deseja resgatar este brinde?
            </DialogDescription>
          </DialogHeader>

          {selectedPrize && (
            <div className="space-y-4">
              {selectedPrize.imageUrl && (
                <div className="relative w-full aspect-square bg-gray-100 rounded-lg overflow-hidden">
                  <Image
                    src={selectedPrize.imageUrl}
                    alt={selectedPrize.name}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              
              <div>
                <h3 className="font-bold text-lg">{selectedPrize.name}</h3>
                {selectedPrize.description && (
                  <p className="text-sm text-muted-foreground mt-1">{selectedPrize.description}</p>
                )}
              </div>

              <div className="p-4 bg-primary/10 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Custo:</span>
                  <strong>{selectedPrize.pointsCost} pontos</strong>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Seu saldo atual:</span>
                  <strong>{Math.round(balance.pointsBalance)} pontos</strong>
                </div>
                <div className="flex justify-between text-sm border-t pt-2">
                  <span>Saldo após resgate:</span>
                  <strong>{Math.round(balance.pointsBalance - selectedPrize.pointsCost)} pontos</strong>
                </div>
              </div>

              <div className="bg-blue-50 p-3 rounded text-sm text-blue-700">
                ℹ️ Após confirmar, seu resgate será enviado para análise do administrador.
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button onClick={handleRedeem} disabled={isLoading} className="flex-1">
                  {isLoading ? 'Processando...' : 'Confirmar Resgate'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
