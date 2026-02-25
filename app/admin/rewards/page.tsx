
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Gift, Award, Settings, TrendingUp, Users } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface RewardConfig {
  id: string;
  pointsPerReal: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface RewardStats {
  totalCustomersWithPoints: number;
  totalPointsInCirculation: number;
  totalPointsRedeemed: number;
  averagePointsPerCustomer: number;
  pendingRedemptions: number;
}

export default function RewardsPage() {
  const [config, setConfig] = useState<RewardConfig | null>(null);
  const [stats, setStats] = useState<RewardStats>({
    totalCustomersWithPoints: 0,
    totalPointsInCirculation: 0,
    totalPointsRedeemed: 0,
    averagePointsPerCustomer: 0,
    pendingRedemptions: 0
  });
  const [pointsPerReal, setPointsPerReal] = useState<string>('1.0');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchConfig();
    fetchStats();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/admin/rewards/config');
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
        setPointsPerReal(data.pointsPerReal.toString());
      }
    } catch (error) {
      console.error('Erro ao buscar configuração:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/rewards/customers');
      if (response.ok) {
        const customers = await response.json();
        
        const totalPointsInCirculation = customers.reduce((sum: number, c: any) => sum + c.pointsBalance, 0);
        const totalPointsRedeemed = customers.reduce((sum: number, c: any) => sum + c.totalPointsRedeemed, 0);
        const customersWithPoints = customers.filter((c: any) => c.pointsBalance > 0).length;
        
        setStats({
          totalCustomersWithPoints: customersWithPoints,
          totalPointsInCirculation: Math.round(totalPointsInCirculation),
          totalPointsRedeemed: Math.round(totalPointsRedeemed),
          averagePointsPerCustomer: customersWithPoints > 0 ? Math.round(totalPointsInCirculation / customersWithPoints) : 0,
          pendingRedemptions: 0 // Will update from redemptions API
        });
      }
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
    }
  };

  const handleUpdateConfig = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/rewards/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pointsPerReal: parseFloat(pointsPerReal) })
      });

      if (response.ok) {
        toast.success('Configuração atualizada com sucesso!');
        fetchConfig();
      } else {
        toast.error('Erro ao atualizar configuração');
      }
    } catch (error) {
      console.error('Erro ao atualizar configuração:', error);
      toast.error('Erro ao atualizar configuração');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">🎁 Sistema de Pontos e Recompensas</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie pontos, brindes e resgates dos clientes
          </p>
        </div>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pontos em Circulação</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPointsInCirculation.toLocaleString('pt-BR')}</div>
            <p className="text-xs text-muted-foreground">
              Total de pontos disponíveis
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pontos Resgatados</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPointsRedeemed.toLocaleString('pt-BR')}</div>
            <p className="text-xs text-muted-foreground">
              Total já trocado por brindes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCustomersWithPoints}</div>
            <p className="text-xs text-muted-foreground">
              Com saldo de pontos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Média por Cliente</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averagePointsPerCustomer.toLocaleString('pt-BR')}</div>
            <p className="text-xs text-muted-foreground">
              Pontos em média
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Configurações e Navegação */}
      <Tabs defaultValue="config" className="space-y-4">
        <TabsList>
          <TabsTrigger value="config">
            <Settings className="h-4 w-4 mr-2" />
            Configurações
          </TabsTrigger>
          <TabsTrigger value="navigation">
            <Award className="h-4 w-4 mr-2" />
            Gerenciar Sistema
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuração Global de Pontos</CardTitle>
              <CardDescription>
                Defina quantos pontos os clientes ganham por real gasto
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pointsPerReal">Pontos por R$ 1,00</Label>
                <div className="flex gap-2">
                  <Input
                    id="pointsPerReal"
                    type="number"
                    step="0.1"
                    min="0"
                    value={pointsPerReal}
                    onChange={(e) => setPointsPerReal(e.target.value)}
                    className="max-w-xs"
                  />
                  <Button 
                    onClick={handleUpdateConfig}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Salvando...' : 'Salvar'}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Exemplo: Se definir 1.0, o cliente ganha 1 ponto por cada R$ 1,00 gasto
                </p>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">ℹ️ Como funciona</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Cada cliente tem um <strong>multiplicador individual</strong> (padrão: 1.0x)</li>
                  <li>• <strong>Apenas pedidos criados pelo próprio cliente</strong> geram pontos</li>
                  <li>• Pedidos criados por admin ou vendedor NÃO geram pontos</li>
                  <li>• Clientes com desconto fixo podem ter multiplicador menor (ex: 0.7x)</li>
                  <li>• Clientes premium podem ter multiplicador maior (ex: 1.2x)</li>
                  <li>• Os pontos podem ser trocados por brindes no catálogo</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="navigation" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Link href="/admin/rewards/prizes">
              <Card className="cursor-pointer hover:bg-accent transition-colors">
                <CardHeader>
                  <Gift className="h-8 w-8 text-primary mb-2" />
                  <CardTitle>Gerenciar Brindes</CardTitle>
                  <CardDescription>
                    Adicionar, editar e remover brindes disponíveis para resgate
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/admin/rewards/customers">
              <Card className="cursor-pointer hover:bg-accent transition-colors">
                <CardHeader>
                  <Users className="h-8 w-8 text-primary mb-2" />
                  <CardTitle>Pontos dos Clientes</CardTitle>
                  <CardDescription>
                    Ver saldo, histórico e ajustar multiplicador de pontos
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/admin/rewards/redemptions">
              <Card className="cursor-pointer hover:bg-accent transition-colors">
                <CardHeader>
                  <Award className="h-8 w-8 text-primary mb-2" />
                  <CardTitle>Resgates Pendentes</CardTitle>
                  <CardDescription>
                    Aprovar, rejeitar e gerenciar solicitações de resgate
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/admin/rewards/ranking">
              <Card className="cursor-pointer hover:bg-accent transition-colors">
                <CardHeader>
                  <TrendingUp className="h-8 w-8 text-primary mb-2" />
                  <CardTitle>Ranking de Clientes</CardTitle>
                  <CardDescription>
                    Ver os clientes com mais pontos acumulados
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
