'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Users, Edit, TrendingUp, Award, Plus, Minus } from 'lucide-react';
import { toast } from 'sonner';

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  city: string;
  pointsBalance: number;
  pointsMultiplier: number;
  totalPointsEarned: number;
  totalPointsRedeemed: number;
  customDiscount: number;
  createdAt: string;
  _count: {
    Order: number;
    PointTransaction: number;
    Redemption: number;
  };
}

interface PointTransaction {
  id: string;
  type: string;
  points: number;
  multiplierApplied: number;
  orderAmount: number | null;
  description: string | null;
  reason: string | null;
  createdAt: string;
}

export default function CustomersPointsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('pointsBalance');
  
  // Dialog states
  const [isMultiplierDialogOpen, setIsMultiplierDialogOpen] = useState(false);
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
  const [multiplier, setMultiplier] = useState('1.0');
  const [adjustPoints, setAdjustPoints] = useState('');
  const [adjustDescription, setAdjustDescription] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, [sortBy]);

  const fetchCustomers = async () => {
    try {
      const response = await fetch(`/api/admin/rewards/customers?sortBy=${sortBy}&order=desc`);
      if (response.ok) {
        const data = await response.json();
        setCustomers(data);
      }
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
    }
  };

  const fetchCustomerDetails = async (customerId: string) => {
    try {
      const response = await fetch(`/api/admin/rewards/customers/${customerId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedCustomer(data);
        setTransactions(data.PointTransaction || []);
      }
    } catch (error) {
      console.error('Erro ao buscar detalhes do cliente:', error);
    }
  };

  const handleUpdateMultiplier = async () => {
    if (!selectedCustomer) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/rewards/customers/${selectedCustomer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pointsMultiplier: parseFloat(multiplier) })
      });

      if (response.ok) {
        toast.success('Multiplicador atualizado!');
        setIsMultiplierDialogOpen(false);
        fetchCustomers();
        if (selectedCustomer) {
          fetchCustomerDetails(selectedCustomer.id);
        }
      } else {
        toast.error('Erro ao atualizar multiplicador');
      }
    } catch (error) {
      console.error('Erro ao atualizar multiplicador:', error);
      toast.error('Erro ao atualizar multiplicador');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdjustPoints = async () => {
    if (!selectedCustomer) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/rewards/customers/${selectedCustomer.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points: parseFloat(adjustPoints),
          description: adjustDescription,
          reason: adjustReason || null
        })
      });

      if (response.ok) {
        toast.success('Pontos ajustados!');
        setIsAdjustDialogOpen(false);
        setAdjustPoints('');
        setAdjustDescription('');
        setAdjustReason('');
        fetchCustomers();
        if (selectedCustomer) {
          fetchCustomerDetails(selectedCustomer.id);
        }
      } else {
        toast.error('Erro ao ajustar pontos');
      }
    } catch (error) {
      console.error('Erro ao ajustar pontos:', error);
      toast.error('Erro ao ajustar pontos');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  );

  const getTransactionTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      EARNED_FROM_ORDER: 'Ganho em Compra',
      REDEEMED_FOR_PRIZE: 'Resgate de Brinde',
      MANUAL_ADJUSTMENT: 'Ajuste Manual',
      BONUS: 'Bônus',
      EXPIRED: 'Expirado'
    };
    return labels[type] || type;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">👥 Pontos dos Clientes</h1>
        <p className="text-muted-foreground mt-1">
          Visualize e gerencie os pontos de cada cliente
        </p>
      </div>

      <div className="flex gap-4">
        <Input
          placeholder="Buscar cliente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        
        <select
          className="border rounded-md px-3 py-2"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="pointsBalance">Ordenar por: Saldo</option>
          <option value="totalPointsEarned">Ordenar por: Total Ganho</option>
          <option value="name">Ordenar por: Nome</option>
        </select>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Lista de Clientes */}
        <Card>
          <CardHeader>
            <CardTitle>Clientes ({filteredCustomers.length})</CardTitle>
            <CardDescription>
              Clique em um cliente para ver detalhes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className={`p-4 border rounded-lg cursor-pointer hover:bg-accent transition-colors ${
                    selectedCustomer?.id === customer.id ? 'bg-accent' : ''
                  }`}
                  onClick={() => {
                    setSelectedCustomer(customer);
                    fetchCustomerDetails(customer.id);
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium">{customer.name}</h4>
                      <p className="text-sm text-muted-foreground">{customer.city}</p>
                    </div>
                    <Badge variant="secondary" className="ml-2">
                      {Math.round(customer.pointsBalance)} pts
                    </Badge>
                  </div>
                  
                  <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                    <span>✓ {customer.totalPointsEarned.toFixed(0)} ganhos</span>
                    <span>↓ {customer.totalPointsRedeemed.toFixed(0)} resgatados</span>
                    <span>× {customer.pointsMultiplier}x</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Detalhes do Cliente Selecionado */}
        <div className="space-y-4">
          {selectedCustomer ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>{selectedCustomer.name}</CardTitle>
                  <CardDescription>
                    {selectedCustomer.email || selectedCustomer.phone}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Saldo Atual</p>
                      <p className="text-2xl font-bold">{Math.round(selectedCustomer.pointsBalance)} pts</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Multiplicador</p>
                      <p className="text-2xl font-bold">{selectedCustomer.pointsMultiplier}x</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Ganho</p>
                      <p className="text-lg font-medium">{Math.round(selectedCustomer.totalPointsEarned)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Resgatado</p>
                      <p className="text-lg font-medium">{Math.round(selectedCustomer.totalPointsRedeemed)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-2 border-t">
                    <div>
                      <p className="text-sm text-muted-foreground">Pedidos</p>
                      <p className="text-lg font-medium">{selectedCustomer._count.Order}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Transações</p>
                      <p className="text-lg font-medium">{selectedCustomer._count.PointTransaction}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Resgates</p>
                      <p className="text-lg font-medium">{selectedCustomer._count.Redemption}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Dialog open={isMultiplierDialogOpen} onOpenChange={setIsMultiplierDialogOpen}>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setMultiplier(selectedCustomer.pointsMultiplier.toString())}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Ajustar Multiplicador
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Ajustar Multiplicador de Pontos</DialogTitle>
                          <DialogDescription>
                            Defina o multiplicador de pontos para {selectedCustomer.name}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Multiplicador</Label>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              value={multiplier}
                              onChange={(e) => setMultiplier(e.target.value)}
                            />
                            <p className="text-sm text-muted-foreground">
                              Exemplo: 0.7 = 70% dos pontos | 1.0 = 100% (padrão) | 1.2 = 120% dos pontos
                            </p>
                          </div>
                          <Button onClick={handleUpdateMultiplier} disabled={isLoading} className="w-full">
                            {isLoading ? 'Salvando...' : 'Salvar'}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Dialog open={isAdjustDialogOpen} onOpenChange={setIsAdjustDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          Ajustar Pontos
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Ajuste Manual de Pontos</DialogTitle>
                          <DialogDescription>
                            Adicione ou remova pontos de {selectedCustomer.name}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Pontos</Label>
                            <Input
                              type="number"
                              step="1"
                              value={adjustPoints}
                              onChange={(e) => setAdjustPoints(e.target.value)}
                              placeholder="Digite um número positivo ou negativo"
                            />
                            <p className="text-sm text-muted-foreground">
                              Use valores positivos para adicionar e negativos para remover
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label>Motivo</Label>
                            <Input
                              value={adjustDescription}
                              onChange={(e) => setAdjustDescription(e.target.value)}
                              placeholder="Descreva o motivo do ajuste"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Tipo de Presente 🎁 (opcional)</Label>
                            <select
                              value={adjustReason}
                              onChange={(e) => setAdjustReason(e.target.value)}
                              className="w-full px-3 py-2 border rounded-md"
                            >
                              <option value="">Selecione (ou deixe em branco)</option>
                              <option value="Presente de Aniversário">🎂 Presente de Aniversário</option>
                              <option value="Bônus Especial">⭐ Bônus Especial</option>
                              <option value="Prêmio de Fidelidade">🏆 Prêmio de Fidelidade</option>
                              <option value="Promoção">🎉 Promoção</option>
                              <option value="Compensação">💝 Compensação</option>
                            </select>
                            <p className="text-xs text-gray-500">
                              Quando você escolhe um motivo, o cliente será notificado que recebeu pontos como presente!
                            </p>
                          </div>
                          <Button onClick={handleAdjustPoints} disabled={isLoading} className="w-full">
                            {isLoading ? 'Salvando...' : 'Confirmar Ajuste'}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Histórico de Transações</CardTitle>
                  <CardDescription>
                    Últimas {transactions.length} transações
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {transactions.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        Nenhuma transação ainda
                      </p>
                    ) : (
                      transactions.map((transaction) => (
                        <div key={transaction.id} className="flex items-center justify-between p-3 border rounded">
                          <div className="flex-1">
                            <p className="font-medium text-sm">
                              {getTransactionTypeLabel(transaction.type)}
                            </p>
                            {transaction.description && (
                              <p className="text-xs text-muted-foreground">{transaction.description}</p>
                            )}
                            {transaction.reason && (
                              <p className="text-xs font-semibold text-amber-600 mt-1">
                                🎁 {transaction.reason}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(transaction.createdAt).toLocaleString('pt-BR')}
                            </p>
                          </div>
                          <Badge variant={transaction.points > 0 ? 'default' : 'secondary'}>
                            {transaction.points > 0 ? '+' : ''}{transaction.points.toFixed(2)}
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Selecione um cliente para ver os detalhes</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
