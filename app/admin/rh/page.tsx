
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users,
  Clock,
  DollarSign,
  FileText,
  Home,
  ArrowLeft,
  UserPlus,
  Upload,
  Crown,
  Star,
} from 'lucide-react';

export default function RHDashboard() {
  const router = useRouter();
  const { data: session, status } = useSession() || {};
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    pendingPayments: 0,
    timeRecordsThisMonth: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }

    if ((session?.user as any)?.userType !== 'ADMIN') {
      router.push('/');
      return;
    }

    loadStats();
  }, [session, status]);

  const loadStats = async () => {
    try {
      setLoading(true);

      // Busca funcionários
      console.log('[RH_PAGE] Buscando funcionários...');
      const employeesRes = await fetch('/api/hr/employees', {
        credentials: 'include',
      });
      console.log('[RH_PAGE] Resposta da API de funcionários:', employeesRes.status);
      
      let employees = [];
      if (!employeesRes.ok) {
        const errorText = await employeesRes.text();
        console.error('[RH_PAGE] ❌ Erro ao buscar funcionários:', employeesRes.status, errorText);
        console.error('[RH_PAGE] URL:', employeesRes.url);
      } else {
        const employeesData = await employeesRes.json();
        console.log('[RH_PAGE] Dados de funcionários:', typeof employeesData, Array.isArray(employeesData));
        employees = Array.isArray(employeesData) ? employeesData : [];
      }

      // Busca pagamentos pendentes (opcional - pode não existir ainda)
      let payments = [];
      try {
        console.log('[RH_PAGE] Buscando pagamentos pendentes...');
        const paymentsRes = await fetch('/api/hr/payments?isPaid=false', {
          credentials: 'include',
        });
        console.log('[RH_PAGE] Resposta da API de pagamentos:', paymentsRes.status);
        
        if (paymentsRes.ok) {
          const paymentsData = await paymentsRes.json();
          console.log('[RH_PAGE] Dados de pagamentos:', typeof paymentsData, Array.isArray(paymentsData));
          payments = Array.isArray(paymentsData) ? paymentsData : [];
        } else {
          const errorText = await paymentsRes.text();
          console.log('[RH_PAGE] ❌ API de pagamentos retornou erro:', paymentsRes.status, errorText);
        }
      } catch (err: any) {
        console.log('[RH_PAGE] ❌ Erro ao buscar pagamentos:', err?.message);
      }

      // Busca registros de ponto do mês atual
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      console.log('[RH_PAGE] Buscando registros de ponto...');
      const timeRecordsRes = await fetch(
        `/api/hr/attendance?startDate=${startOfMonth.toISOString()}&endDate=${endOfMonth.toISOString()}`,
        {
          credentials: 'include',
        }
      );
      console.log('[RH_PAGE] Resposta da API de ponto:', timeRecordsRes.status);
      
      let timeRecords = [];
      if (!timeRecordsRes.ok) {
        const errorText = await timeRecordsRes.text();
        console.error('[RH_PAGE] ❌ Erro ao buscar ponto:', timeRecordsRes.status, errorText);
      } else {
        const timeRecordsData = await timeRecordsRes.json();
        timeRecords = Array.isArray(timeRecordsData) ? timeRecordsData : [];
      }

      console.log('[RH_PAGE] Estatísticas calculadas:', {
        totalEmployees: employees.length,
        activeEmployees: employees.filter((e: any) => e.status === 'ACTIVE').length,
        pendingPayments: payments.length,
        timeRecordsThisMonth: timeRecords.length,
      });

      setStats({
        totalEmployees: employees.length,
        activeEmployees: employees.filter((e: any) => e.status === 'ACTIVE').length,
        pendingPayments: payments.length,
        timeRecordsThisMonth: timeRecords.length,
      });
    } catch (error) {
      console.error('[RH_PAGE] Erro geral ao carregar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Recursos Humanos
          </h1>
          <p className="text-gray-500 mt-1">
            Gestão de funcionários, ponto e departamentos
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => window.location.href = '/admin'}
          >
            <Home className="w-4 h-4 mr-2" />
            Página Inicial
          </Button>
          <Button
            variant="outline"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </div>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Funcionários
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEmployees}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.activeEmployees} ativos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pagamentos Pendentes
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingPayments}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Aguardando pagamento
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Registros Este Mês
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.timeRecordsThisMonth}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Marcações de ponto
            </p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => router.push('/admin/rh/documentos')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Documentos
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">Gerenciar</div>
            <p className="text-xs text-muted-foreground mt-1">
              Clique para gerenciar
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ações Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer"
          onClick={() => router.push('/admin/rh/funcionarios')}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Gerenciar Funcionários
            </CardTitle>
            <CardDescription>
              Cadastre, edite e visualize funcionários
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full">
              <UserPlus className="w-4 h-4 mr-2" />
              Acessar
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer"
          onClick={() => router.push('/admin/rh/ponto')}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-green-600" />
              Controle de Ponto
            </CardTitle>
            <CardDescription>
              Importe e gerencie registros de ponto
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full">
              <Upload className="w-4 h-4 mr-2" />
              Acessar
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer"
          onClick={() => router.push('/admin/rh/pagamentos')}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-purple-600" />
              Pagamentos
            </CardTitle>
            <CardDescription>
              Gerencie folhas de pagamento e pagamentos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full">
              <DollarSign className="w-4 h-4 mr-2" />
              Acessar
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-amber-200 bg-amber-50"
          onClick={() => router.push('/admin/rh/lideranca')}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-600" />
              Gestão de Liderança
            </CardTitle>
            <CardDescription>
              Avaliações 360° e metas qualitativas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full bg-amber-600 hover:bg-amber-700">
              <Crown className="w-4 h-4 mr-2" />
              Acessar
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-purple-200 bg-purple-50"
          onClick={() => router.push('/admin/rh/documentos')}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-600" />
              Gerenciar Documentos
            </CardTitle>
            <CardDescription>
              Controle documentos e folhas de ponto para assinatura
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full bg-purple-600 hover:bg-purple-700">
              <FileText className="w-4 h-4 mr-2" />
              Acessar
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-yellow-200 bg-yellow-50"
          onClick={() => router.push('/admin/avaliacoes')}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-600" />
              Avaliações de Desempenho
            </CardTitle>
            <CardDescription>
              Acompanhe avaliações diárias e mensais da equipe
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full bg-yellow-600 hover:bg-yellow-700 text-white">
              <Star className="w-4 h-4 mr-2" />
              Acessar
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
