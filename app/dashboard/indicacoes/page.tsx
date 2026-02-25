
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Gift,
  Share2,
  TrendingUp,
  Award,
  UserPlus,
  ArrowLeft,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';

interface ReferredCustomer {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
  referralBonusReceived: boolean;
}

interface ReferralData {
  customer: {
    id: string;
    name: string;
    phone: string;
  };
  referralsCount: number;
  referrals: ReferredCustomer[];
  whatsappLink: string;
  whatsappMessage: string;
}

export default function IndicacoesPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);

  // Valores fixos do novo sistema
  const BONUS_INDICADOR = 10000;
  const BONUS_INDICADO = 5000;

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }

    if (session) {
      loadData();
    }
  }, [session, status]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Buscar dados de indicação do novo sistema
      const referralResponse = await fetch('/api/customers/referral-code');
      if (referralResponse.ok) {
        const data = await referralResponse.json();
        console.log('📊 Dados de indicação:', data);
        setReferralData(data);
      } else {
        toast.error('Erro ao carregar dados de indicações');
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados de indicações');
    } finally {
      setLoading(false);
    }
  };

  const handleShareWhatsApp = () => {
    if (referralData?.whatsappLink) {
      window.open(referralData.whatsappLink, '_blank');
      toast.success('Abrindo WhatsApp...');
    } else {
      toast.error('Link do WhatsApp não disponível');
    }
  };

  const totalBonusEarned = referralData?.referrals.reduce(
    (sum, ref) => sum + (ref.referralBonusReceived ? BONUS_INDICADOR : 0),
    0
  ) || 0;

  const pendingReferrals =
    referralData?.referrals.filter((ref) => !ref.referralBonusReceived).length || 0;

  const completedReferrals =
    referralData?.referrals.filter((ref) => ref.referralBonusReceived).length || 0;

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold">Sistema de Indicações</h1>
        </div>
        <div className="text-center py-12">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/dashboard')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <h1 className="text-2xl md:text-3xl font-bold">Sistema de Indicações</h1>
      </div>

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
              <div className="text-3xl font-bold text-blue-600">
                {referralData?.referralsCount || 0}
              </div>
              <Users className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Aguardando 1ª Compra
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-yellow-600">
                {pendingReferrals}
              </div>
              <Clock className="h-8 w-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Bônus Recebidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-green-600">
                {completedReferrals}
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total de Pontos Ganhos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-purple-600">
                {totalBonusEarned.toLocaleString()}
              </div>
              <Award className="h-8 w-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compartilhar por WhatsApp */}
      <Card className="bg-gradient-to-r from-green-600 to-green-500 text-white">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Gift className="h-6 w-6" />
              <h2 className="text-xl font-bold">Indique e Ganhe!</h2>
            </div>

            <div className="space-y-3">
              <p className="text-white/90 text-lg">
                <span className="font-bold">Você ganha {BONUS_INDICADOR.toLocaleString()} pontos</span> quando seu amigo fizer a primeira compra!
              </p>
              <p className="text-white/90">
                E ele também ganha <span className="font-bold">{BONUS_INDICADO.toLocaleString()} pontos</span> de boas-vindas! 🎉
              </p>
            </div>

            <Button
              className="w-full bg-white text-green-600 hover:bg-white/90 text-lg py-6"
              onClick={handleShareWhatsApp}
            >
              <Share2 className="h-5 w-5 mr-2" />
              Compartilhar no WhatsApp
            </Button>

            <div className="bg-white/10 rounded-lg p-4 text-sm text-white/90">
              <p className="font-medium mb-2">📱 Mensagem que será enviada:</p>
              <p className="italic">"{referralData?.whatsappMessage || 'Carregando...'}"</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Indicações */}
      <Card>
        <CardHeader>
          <CardTitle>Suas Indicações</CardTitle>
        </CardHeader>
        <CardContent>
          {!referralData?.referrals || referralData.referrals.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">Nenhuma indicação ainda</p>
              <p className="text-sm mt-2">
                Compartilhe o link no WhatsApp e comece a ganhar pontos!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {referralData.referrals.map((referral) => (
                <div
                  key={referral.id}
                  className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
                    referral.referralBonusReceived 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-yellow-50 border-yellow-200'
                  }`}
                >
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 flex items-center gap-2">
                      {referral.name}
                      {referral.referralBonusReceived && (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {referral.phone}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Indicado em{' '}
                      {new Date(referral.createdAt).toLocaleDateString('pt-BR')}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {referral.referralBonusReceived ? (
                      <>
                        <Badge className="bg-green-100 text-green-800" variant="outline">
                          Bônus Concedido
                        </Badge>
                        <div className="text-sm font-medium text-green-600 flex items-center gap-1">
                          <Award className="h-4 w-4" />
                          +{BONUS_INDICADOR.toLocaleString()} pontos
                        </div>
                      </>
                    ) : (
                      <>
                        <Badge className="bg-yellow-100 text-yellow-800" variant="outline">
                          Aguardando 1ª Compra
                        </Badge>
                        <div className="text-xs text-gray-500">
                          Ganhará {BONUS_INDICADOR.toLocaleString()} pontos
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Informações */}
      <Card className="bg-blue-50">
        <CardContent className="p-6">
          <h3 className="font-bold text-lg mb-3 text-blue-900 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Como funciona o sistema de indicações?
          </h3>
          <div className="space-y-3 text-sm text-blue-800">
            <div className="flex gap-2">
              <span className="font-bold">1.</span>
              <p>Clique no botão "Compartilhar no WhatsApp" acima</p>
            </div>
            <div className="flex gap-2">
              <span className="font-bold">2.</span>
              <p>Envie a mensagem para seus amigos pelo WhatsApp</p>
            </div>
            <div className="flex gap-2">
              <span className="font-bold">3.</span>
              <p>Quando seu amigo entrar em contato e fizer o cadastro, informe ao vendedor que foi você quem indicou</p>
            </div>
            <div className="flex gap-2">
              <span className="font-bold">4.</span>
              <p>
                Quando ele fizer a <span className="font-bold">primeira compra</span>:
              </p>
            </div>
            <div className="ml-6 space-y-2 bg-white/50 rounded-lg p-4">
              <p className="flex items-center gap-2">
                <Gift className="h-4 w-4 text-purple-600" />
                <span className="font-bold text-purple-900">Você ganha: {BONUS_INDICADOR.toLocaleString()} pontos! 🎉</span>
              </p>
              <p className="flex items-center gap-2">
                <Gift className="h-4 w-4 text-green-600" />
                <span className="font-bold text-green-900">Seu amigo ganha: {BONUS_INDICADO.toLocaleString()} pontos! 🎁</span>
              </p>
            </div>
            <p className="pt-2 border-t border-blue-200">
              <span className="font-bold">💡 Dica:</span> Não há limite de indicações - quanto mais você indica, mais você ganha!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
