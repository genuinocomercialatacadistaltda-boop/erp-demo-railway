
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Users,
  Gift,
  Settings,
  TrendingUp,
  Award,
  ArrowLeft,
  Check,
  X,
  Clock,
  DollarSign,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Referral {
  id: string;
  status: string;
  bonusPoints: number;
  bonusAwarded: boolean;
  bonusAwardedAt: string | null;
  createdAt: string;
  Referrer: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
  };
  Referred: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    createdAt: string;
  };
}

interface Config {
  id: string;
  isActive: boolean;
  bonusPointsPerReferral: number;
  requireFirstOrder: boolean;
  minimumOrderAmount?: number;
  bonusForReferred: number;
  maxReferralsPerCustomer?: number;
  expirationDays?: number;
}

export default function IndicacoesAdminPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // Estados do formulário de configuração
  const [configForm, setConfigForm] = useState({
    isActive: true,
    bonusPointsPerReferral: 100,
    requireFirstOrder: true,
    minimumOrderAmount: '',
    bonusForReferred: 50,
    maxReferralsPerCustomer: '',
    expirationDays: '',
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }

    const user = session?.user as any;
    if (user?.userType !== 'ADMIN') {
      router.push('/dashboard');
      return;
    }

    if (session) {
      loadData();
    }
  }, [session, status]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Buscar indicações
      const referralsResponse = await fetch('/api/referrals');
      if (referralsResponse.ok) {
        const data = await referralsResponse.json();
        setReferrals(data.referrals || []);
      }

      // Buscar configuração
      const configResponse = await fetch('/api/referrals/config');
      if (configResponse.ok) {
        const configData = await configResponse.json();
        setConfig(configData);
        setConfigForm({
          isActive: configData.isActive,
          bonusPointsPerReferral: configData.bonusPointsPerReferral,
          requireFirstOrder: configData.requireFirstOrder,
          minimumOrderAmount: configData.minimumOrderAmount?.toString() || '',
          bonusForReferred: configData.bonusForReferred,
          maxReferralsPerCustomer: configData.maxReferralsPerCustomer?.toString() || '',
          expirationDays: configData.expirationDays?.toString() || '',
        });
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados de indicações');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      setSavingConfig(true);

      const payload = {
        isActive: configForm.isActive,
        bonusPointsPerReferral: configForm.bonusPointsPerReferral,
        requireFirstOrder: configForm.requireFirstOrder,
        minimumOrderAmount: configForm.minimumOrderAmount
          ? parseFloat(configForm.minimumOrderAmount)
          : null,
        bonusForReferred: configForm.bonusForReferred,
        maxReferralsPerCustomer: configForm.maxReferralsPerCustomer
          ? parseInt(configForm.maxReferralsPerCustomer)
          : null,
        expirationDays: configForm.expirationDays
          ? parseInt(configForm.expirationDays)
          : null,
      };

      const response = await fetch('/api/referrals/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success('Configuração salva com sucesso!');
        setShowConfigDialog(false);
        loadData();
      } else {
        toast.error('Erro ao salvar configuração');
      }
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      toast.error('Erro ao salvar configuração');
    } finally {
      setSavingConfig(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      PENDING: { label: 'Aguardando', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      ACTIVE: { label: 'Ativo', color: 'bg-blue-100 text-blue-800', icon: Check },
      BONUS_AWARDED: { label: 'Bônus Concedido', color: 'bg-green-100 text-green-800', icon: Gift },
      EXPIRED: { label: 'Expirado', color: 'bg-gray-100 text-gray-800', icon: X },
      CANCELLED: { label: 'Cancelado', color: 'bg-red-100 text-red-800', icon: X },
    };

    const statusInfo = statusConfig[status as keyof typeof statusConfig] || statusConfig.PENDING;
    const Icon = statusInfo.icon;

    return (
      <Badge className={statusInfo.color} variant="outline">
        <Icon className="h-3 w-3 mr-1" />
        {statusInfo.label}
      </Badge>
    );
  };

  const stats = {
    total: referrals.length,
    pending: referrals.filter((r) => r.status === 'PENDING').length,
    active: referrals.filter((r) => r.status === 'ACTIVE' || r.status === 'BONUS_AWARDED').length,
    totalBonusAwarded: referrals
      .filter((r) => r.bonusAwarded)
      .reduce((sum, r) => sum + r.bonusPoints, 0),
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="sm" onClick={() => router.push('/admin/rewards')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold">Gestão de Indicações</h1>
        </div>
        <div className="text-center py-12">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.push('/admin/rewards')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold">Gestão de Indicações</h1>
        </div>

        <Button onClick={() => setShowConfigDialog(true)} className="bg-blue-600 hover:bg-blue-700">
          <Settings className="h-4 w-4 mr-2" />
          Configurações
        </Button>
      </div>

      {/* Status do Sistema */}
      <Card className={config?.isActive ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${config?.isActive ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
              <span className="font-medium">
                Sistema de Indicações: {config?.isActive ? 'ATIVO' : 'DESATIVADO'}
              </span>
            </div>
            {config && (
              <div className="text-sm text-gray-600">
                Bônus: {config.bonusPointsPerReferral} pontos por indicação
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total de Indicações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
              <Users className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Aguardando
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-yellow-600">{stats.pending}</div>
              <Clock className="h-8 w-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Completadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-green-600">{stats.active}</div>
              <Check className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Pontos Distribuídos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-purple-600">
                {stats.totalBonusAwarded}
              </div>
              <Award className="h-8 w-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Indicações */}
      <Card>
        <CardHeader>
          <CardTitle>Todas as Indicações</CardTitle>
        </CardHeader>
        <CardContent>
          {referrals.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">Nenhuma indicação ainda</p>
            </div>
          ) : (
            <div className="space-y-3">
              {referrals.map((referral) => (
                <div
                  key={referral.id}
                  className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors gap-4"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="font-medium text-gray-900">
                          {referral.Referrer.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          Indicador • {referral.Referrer.phone}
                        </div>
                      </div>
                      <TrendingUp className="h-5 w-5 text-gray-400" />
                      <div>
                        <div className="font-medium text-gray-900">
                          {referral.Referred.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          Indicado • {referral.Referred.phone}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span>
                        Cadastro: {new Date(referral.Referred.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                      {referral.bonusAwardedAt && (
                        <span>
                          Bônus em: {new Date(referral.bonusAwardedAt).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {getStatusBadge(referral.status)}
                    {referral.bonusAwarded && (
                      <div className="text-sm font-medium text-green-600 flex items-center gap-1">
                        <Award className="h-4 w-4" />
                        +{referral.bonusPoints} pontos
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Configuração */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configurações do Sistema de Indicações</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Ativar/Desativar Sistema */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <Label className="text-base font-medium">Sistema Ativo</Label>
                <p className="text-sm text-gray-500">
                  Habilitar ou desabilitar o sistema de indicações
                </p>
              </div>
              <Switch
                checked={configForm.isActive}
                onCheckedChange={(checked) =>
                  setConfigForm({ ...configForm, isActive: checked })
                }
              />
            </div>

            {/* Bônus por Indicação */}
            <div>
              <Label>Pontos por Indicação Completa</Label>
              <Input
                type="number"
                value={configForm.bonusPointsPerReferral}
                onChange={(e) =>
                  setConfigForm({
                    ...configForm,
                    bonusPointsPerReferral: parseInt(e.target.value) || 0,
                  })
                }
              />
              <p className="text-xs text-gray-500 mt-1">
                Pontos que o indicador recebe quando a indicação é completada
              </p>
            </div>

            {/* Bônus para o Indicado */}
            <div>
              <Label>Pontos de Boas-Vindas (Indicado)</Label>
              <Input
                type="number"
                value={configForm.bonusForReferred}
                onChange={(e) =>
                  setConfigForm({
                    ...configForm,
                    bonusForReferred: parseInt(e.target.value) || 0,
                  })
                }
              />
              <p className="text-xs text-gray-500 mt-1">
                Pontos que o cliente indicado recebe ao se cadastrar
              </p>
            </div>

            {/* Requer Primeira Compra */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <Label className="text-base font-medium">Requer Primeira Compra</Label>
                <p className="text-sm text-gray-500">
                  O indicado precisa fazer uma compra para o bônus ser liberado
                </p>
              </div>
              <Switch
                checked={configForm.requireFirstOrder}
                onCheckedChange={(checked) =>
                  setConfigForm({ ...configForm, requireFirstOrder: checked })
                }
              />
            </div>

            {/* Valor Mínimo do Pedido */}
            {configForm.requireFirstOrder && (
              <div>
                <Label>Valor Mínimo do Pedido (opcional)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={configForm.minimumOrderAmount}
                  onChange={(e) =>
                    setConfigForm({ ...configForm, minimumOrderAmount: e.target.value })
                  }
                  placeholder="Ex: 50.00"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Valor mínimo que o pedido deve ter para liberar o bônus
                </p>
              </div>
            )}

            {/* Limite de Indicações */}
            <div>
              <Label>Limite de Indicações por Cliente (opcional)</Label>
              <Input
                type="number"
                value={configForm.maxReferralsPerCustomer}
                onChange={(e) =>
                  setConfigForm({ ...configForm, maxReferralsPerCustomer: e.target.value })
                }
                placeholder="Deixe vazio para ilimitado"
              />
              <p className="text-xs text-gray-500 mt-1">
                Quantidade máxima de indicações que cada cliente pode fazer
              </p>
            </div>

            {/* Prazo de Expiração */}
            <div>
              <Label>Prazo para Primeira Compra (dias, opcional)</Label>
              <Input
                type="number"
                value={configForm.expirationDays}
                onChange={(e) =>
                  setConfigForm({ ...configForm, expirationDays: e.target.value })
                }
                placeholder="Ex: 30"
              />
              <p className="text-xs text-gray-500 mt-1">
                Dias que o indicado tem para fazer a primeira compra
              </p>
            </div>

            {/* Botões */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowConfigDialog(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveConfig}
                disabled={savingConfig}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {savingConfig ? 'Salvando...' : 'Salvar Configuração'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
