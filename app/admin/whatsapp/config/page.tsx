'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  MessageSquare,
  QrCode,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Power,
  Phone,
  AlertCircle,
  ArrowLeft,
  Home
} from 'lucide-react';

interface ConnectionStatus {
  configured: boolean;
  connected: boolean;
  state?: string;
  phone?: string;
  message?: string;
}

export default function WhatsAppConfigPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession() || {};
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [showQrCode, setShowQrCode] = useState(false);

  // Verifica permissão de admin
  useEffect(() => {
    if (sessionStatus === 'loading') return;
    
    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      router.push('/auth/login');
      return;
    }
  }, [session, sessionStatus, router]);

  // Carrega status inicial
  useEffect(() => {
    if (session && (session.user as any)?.userType === 'ADMIN') {
      fetchStatus();
      
      // Atualiza status a cada 10 segundos
      const interval = setInterval(fetchStatus, 10000);
      return () => clearInterval(interval);
    }
  }, [session]);

  // Função para buscar status
  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/admin/whatsapp/evolution/status');
      
      if (!response.ok) {
        console.error('Erro ao buscar status:', response.status);
        return;
      }

      const data = await response.json();
      setStatus(data);
      
      // Se estava esperando QR Code e agora conectou, limpa o QR Code
      if (data.connected && showQrCode) {
        setQrCode(null);
        setShowQrCode(false);
        toast.success('✅ WhatsApp conectado com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao buscar status:', error);
    }
  };

  // Função para conectar/gerar QR Code
  const handleConnect = async () => {
    setLoading(true);
    setQrCode(null);
    setShowQrCode(false);

    try {
      const response = await fetch('/api/admin/whatsapp/evolution/connect', {
        method: 'POST'
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Erro ao conectar');
        return;
      }

      if (data.alreadyConnected) {
        toast.success(data.message);
        await fetchStatus();
        return;
      }

      if (data.qrcode) {
        setQrCode(data.qrcode);
        setShowQrCode(true);
        toast.success('QR Code gerado! Escaneie no seu WhatsApp.');
      } else {
        toast.info(data.message);
        // Tenta novamente após 3 segundos
        setTimeout(() => {
          handleConnect();
        }, 3000);
      }
    } catch (error: any) {
      console.error('Erro ao conectar:', error);
      toast.error('Erro ao conectar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Função para desconectar
  const handleDisconnect = async () => {
    if (!confirm('Tem certeza que deseja desconectar o WhatsApp?')) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/admin/whatsapp/evolution/disconnect', {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Erro ao desconectar');
        return;
      }

      toast.success(data.message);
      setQrCode(null);
      setShowQrCode(false);
      await fetchStatus();
    } catch (error: any) {
      console.error('Erro ao desconectar:', error);
      toast.error('Erro ao desconectar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (sessionStatus === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/admin')}
          >
            <Home className="h-4 w-4 mr-2" />
            Página Inicial
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/admin/whatsapp')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>
        
        <div className="flex items-center gap-3">
          <MessageSquare className="h-8 w-8 text-green-600" />
          <div>
            <h1 className="text-3xl font-bold">Configuração do WhatsApp</h1>
            <p className="text-muted-foreground">Evolution API - Sistema Self-Hosted</p>
          </div>
        </div>
      </div>

      {/* Alert de Instruções */}
      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Importante:</strong> A Evolution API precisa estar rodando para funcionar. 
          Se você ainda não instalou, veja as instruções abaixo.
        </AlertDescription>
      </Alert>

      {/* Card de Status */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {status?.connected ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            Status da Conexão
          </CardTitle>
          <CardDescription>
            Status atual do WhatsApp conectado via Evolution API
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Evolution API:</span>
            <Badge variant={status?.configured ? 'default' : 'destructive'}>
              {status?.configured ? '✅ Configurada' : '❌ Não Configurada'}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">WhatsApp:</span>
            <Badge variant={status?.connected ? 'default' : 'secondary'}>
              {status?.connected ? '✅ Conectado' : '⚠️ Desconectado'}
            </Badge>
          </div>

          {status?.phone && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Número:</span>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-mono">{status.phone}</span>
              </div>
            </div>
          )}

          {status?.state && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Estado:</span>
              <Badge variant="outline">{status.state}</Badge>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={fetchStatus}
              disabled={loading}
              variant="outline"
              className="flex-1"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar Status
            </Button>

            {status?.connected ? (
              <Button
                onClick={handleDisconnect}
                disabled={loading}
                variant="destructive"
                className="flex-1"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Power className="h-4 w-4 mr-2" />
                )}
                Desconectar
              </Button>
            ) : (
              <Button
                onClick={handleConnect}
                disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <QrCode className="h-4 w-4 mr-2" />
                )}
                Conectar WhatsApp
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Card do QR Code */}
      {showQrCode && qrCode && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Escaneie o QR Code
            </CardTitle>
            <CardDescription>
              Abra o WhatsApp no celular e escaneie o código abaixo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-white p-8 rounded-lg flex items-center justify-center">
              <img 
                src={qrCode} 
                alt="QR Code" 
                className="max-w-sm w-full h-auto"
              />
            </div>
            
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <p className="font-medium">Como escanear:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Abra o WhatsApp no celular</li>
                <li>Toque em "Mais opções" (3 pontinhos) ou "Configurações"</li>
                <li>Toque em "Aparelhos conectados"</li>
                <li>Toque em "Conectar um aparelho"</li>
                <li>Aponte a câmera para o QR Code acima</li>
              </ol>
            </div>

            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                O QR Code expira em poucos minutos. Se não conseguir escanear, 
                clique em "Conectar WhatsApp" novamente para gerar um novo.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Card de Instruções de Instalação */}
      {!status?.configured && (
        <Card>
          <CardHeader>
            <CardTitle>Como Instalar a Evolution API</CardTitle>
            <CardDescription>
              Siga os passos abaixo para instalar e configurar a Evolution API
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-semibold">Opção 1: Testar no Seu Computador (Desenvolvimento)</h3>
              <p className="text-sm text-muted-foreground">
                Para testar localmente antes de comprar um servidor:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-sm ml-2">
                <li>Baixe e instale o Docker Desktop: <a href="https://www.docker.com/products/docker-desktop" className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">docker.com/products/docker-desktop</a></li>
                <li>Abra o terminal/prompt de comando</li>
                <li>Execute o comando:</li>
              </ol>
              <pre className="bg-gray-100 p-3 rounded-lg text-xs overflow-x-auto mt-2">
docker run -d \\
  --name evolution-api \\
  -p 8080:8080 \\
  -e AUTHENTICATION_API_KEY=SUA_CHAVE_AQUI \\
  atendai/evolution-api:latest
              </pre>
              <p className="text-sm text-muted-foreground mt-2">
                Substitua <code className="bg-gray-100 px-1 rounded">SUA_CHAVE_AQUI</code> por uma senha forte (ex: <code className="bg-gray-100 px-1 rounded">espetos2024!@#</code>)
              </p>
            </div>

            <div className="space-y-2 pt-4 border-t">
              <h3 className="font-semibold">Opção 2: Servidor em Produção (Recomendado)</h3>
              <p className="text-sm text-muted-foreground">
                Para uso permanente, instale em um servidor VPS (Vultr, Contabo, etc.)
              </p>
              <ol className="list-decimal list-inside space-y-1 text-sm ml-2">
                <li>Compre um VPS (recomendo: Vultr R$30/mês ou Contabo R$25/mês)</li>
                <li>Conecte ao servidor via SSH</li>
                <li>Instale Docker no servidor</li>
                <li>Execute o mesmo comando acima</li>
                <li>Configure as variáveis de ambiente no sistema</li>
              </ol>
            </div>

            <div className="space-y-2 pt-4 border-t">
              <h3 className="font-semibold">Variáveis de Ambiente</h3>
              <p className="text-sm text-muted-foreground">
                Adicione no arquivo <code className="bg-gray-100 px-1 rounded">.env</code>:
              </p>
              <pre className="bg-gray-100 p-3 rounded-lg text-xs overflow-x-auto mt-2">
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_INSTANCE_NAME=sua_empresa
EVOLUTION_API_KEY=SUA_CHAVE_AQUI
              </pre>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Precisa de ajuda?</strong> Entre em contato com o suporte 
                e nós te ajudamos a instalar tudo passo a passo!
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
