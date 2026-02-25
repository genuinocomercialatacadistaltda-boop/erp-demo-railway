
'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  CheckCircle,
  RefreshCw,
  Home,
  ArrowLeft,
  TrendingDown,
  Package,
  FileWarning,
  CreditCard,
  DollarSign,
  Users,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useToast } from '@/components/ui/use-toast'

interface AlertItem {
  type: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  title: string
  description: string
  action: string
}

interface AlertStats {
  critical: number
  high: number
  medium: number
  low: number
}

interface AlertsData {
  alerts: AlertItem[]
  total: number
  stats: AlertStats
  lastCheck: string
}

export default function AlertasPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [alertsData, setAlertsData] = useState<AlertsData | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    } else if (session?.user && (session.user as any).userType !== 'ADMIN') {
      router.push('/')
    } else if (session?.user) {
      loadAlerts()
    }
  }, [session, status, router])

  const loadAlerts = async () => {
    try {
      const response = await fetch('/api/financial/alerts/check')
      if (!response.ok) throw new Error('Erro ao carregar alertas')
      
      const data = await response.json()
      setAlertsData(data)
    } catch (error) {
      console.error('Erro ao carregar alertas:', error)
      toast({
        title: 'Erro ao carregar alertas',
        description: 'Não foi possível carregar os alertas do sistema.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    loadAlerts()
  }

  const handleAlertClick = (action: string) => {
    router.push(action)
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="h-5 w-5 text-red-500" />
      case 'high':
        return <AlertTriangle className="h-5 w-5 text-orange-500" />
      case 'medium':
        return <Info className="h-5 w-5 text-yellow-500" />
      case 'low':
        return <Info className="h-5 w-5 text-blue-500" />
      default:
        return <Info className="h-5 w-5" />
    }
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive">Crítico</Badge>
      case 'high':
        return <Badge className="bg-orange-500 hover:bg-orange-600">Alto</Badge>
      case 'medium':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Médio</Badge>
      case 'low':
        return <Badge variant="secondary">Baixo</Badge>
      default:
        return <Badge variant="outline">Info</Badge>
    }
  }

  const getAlertTypeIcon = (type: string) => {
    switch (type) {
      case 'NEGATIVE_STOCK':
        return <Package className="h-5 w-5" />
      case 'ORPHAN_RECEIVABLES':
        return <FileWarning className="h-5 w-5" />
      case 'STUCK_BOLETO':
        return <DollarSign className="h-5 w-5" />
      case 'STUCK_CARD_TRANSACTIONS':
        return <CreditCard className="h-5 w-5" />
      case 'PAYMENTS_NO_ACKNOWLEDGMENT':
        return <Users className="h-5 w-5" />
      case 'LOW_BALANCE':
        return <TrendingDown className="h-5 w-5" />
      default:
        return <AlertTriangle className="h-5 w-5" />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard de Monitoramento</h1>
            <p className="text-gray-600 mt-1">Alertas e inconsistências do sistema</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/admin')}>
              <Home className="mr-2 h-4 w-4" />
              Página Inicial
            </Button>
            <Button variant="outline" onClick={() => window.history.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <Button onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-red-200 bg-red-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-red-700">Críticos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                {alertsData?.stats.critical || 0}
              </div>
            </CardContent>
          </Card>

          <Card className="border-orange-200 bg-orange-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-orange-700">Altos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">
                {alertsData?.stats.high || 0}
              </div>
            </CardContent>
          </Card>

          <Card className="border-yellow-200 bg-yellow-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-yellow-700">Médios</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">
                {alertsData?.stats.medium || 0}
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-blue-700">Baixos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {alertsData?.stats.low || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alertas Summary */}
        {alertsData && alertsData.total === 0 ? (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Sistema Saudável!</AlertTitle>
            <AlertDescription className="text-green-700">
              Nenhum alerta ou inconsistência detectada no momento.
              <br />
              <span className="text-sm text-green-600">
                Última verificação: {alertsData.lastCheck ? new Date(alertsData.lastCheck).toLocaleString('pt-BR') : 'Agora'}
              </span>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-blue-200 bg-blue-50">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800">
              {alertsData?.total || 0} Alerta{(alertsData?.total || 0) !== 1 ? 's' : ''} Detectado{(alertsData?.total || 0) !== 1 ? 's' : ''}
            </AlertTitle>
            <AlertDescription className="text-blue-700">
              Alguns itens requerem sua atenção. Clique em um alerta para ir diretamente à página correspondente.
              <br />
              <span className="text-sm text-blue-600">
                Última verificação: {alertsData?.lastCheck ? new Date(alertsData.lastCheck).toLocaleString('pt-BR') : 'Agora'}
              </span>
            </AlertDescription>
          </Alert>
        )}

        {/* Lista de Alertas */}
        <div className="space-y-3">
          {alertsData?.alerts.map((alert, index) => (
            <Card
              key={index}
              className={`cursor-pointer transition-all hover:shadow-md ${
                alert.severity === 'critical'
                  ? 'border-red-200 hover:border-red-300'
                  : alert.severity === 'high'
                  ? 'border-orange-200 hover:border-orange-300'
                  : alert.severity === 'medium'
                  ? 'border-yellow-200 hover:border-yellow-300'
                  : 'border-blue-200 hover:border-blue-300'
              }`}
              onClick={() => handleAlertClick(alert.action)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getSeverityIcon(alert.severity)}
                    {getAlertTypeIcon(alert.type)}
                    <CardTitle className="text-base">{alert.title}</CardTitle>
                  </div>
                  {getSeverityBadge(alert.severity)}
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm">
                  {alert.description}
                </CardDescription>
                <div className="mt-2 text-xs text-gray-500">
                  Clique para ir para: {alert.action}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Informações Adicionais */}
        <Card>
          <CardHeader>
            <CardTitle>Sobre o Monitoramento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-600">
            <p>
              <strong>Verificações realizadas:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Despesas próximas ao vencimento (3 dias)</li>
              <li>Despesas e receivables atrasados</li>
              <li>Saldo bancário baixo (menos de R$ 5.000)</li>
              <li>Estoque negativo no BiStock</li>
              <li>Receivables órfãos (sem pedido ou boleto)</li>
              <li>Boletos pendentes há mais de 30 dias</li>
              <li>Transações de cartão pendentes há mais de 60 dias</li>
              <li>Despesas sem categoria</li>
              <li>Pagamentos sem aceite digital</li>
            </ul>
            <p className="mt-4">
              <strong>Recomendação:</strong> Verifique este dashboard diariamente para garantir a
              integridade dos dados e evitar problemas financeiros.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
