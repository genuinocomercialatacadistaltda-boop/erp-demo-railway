
'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { 
  Users, 
  ShoppingCart, 
  TrendingUp, 
  DollarSign,
  Package,
  Plus,
  Bell,
  LogOut,
  Briefcase,
  FileText,
  Clock,
  Wallet,
  CreditCard
} from 'lucide-react'
import Link from 'next/link'
import { HomeButton } from '@/components/home-button'
import { SupervisorEvaluations } from '@/app/employee/_components/supervisor-evaluations'
import Image from 'next/image'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function SellerDashboard() {
  const { data: session, status } = useSession() || {}
  const router = useRouter()
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalOrders: 0,
    pendingCommissions: 0,
    totalCommissions: 0
  })
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // 🔥 DADOS DO FUNCIONÁRIO (quando vinculado)
  const [hasEmployeeAccess, setHasEmployeeAccess] = useState(false)
  const [employeeData, setEmployeeData] = useState<any>(null)
  const [employeePayments, setEmployeePayments] = useState<any[]>([])
  const [employeeDocuments, setEmployeeDocuments] = useState<any[]>([])
  const [timeRecords, setTimeRecords] = useState<any[]>([])
  
  // 🖊️ ACEITE DIGITAL DE CONTRACHEQUES
  const [showAcknowledgeDialog, setShowAcknowledgeDialog] = useState(false)
  const [selectedPaymentForAck, setSelectedPaymentForAck] = useState<any>(null)
  const [termsText, setTermsText] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [acknowledgingPayment, setAcknowledgingPayment] = useState(false)
  const [paymentAcknowledgments, setPaymentAcknowledgments] = useState<Record<string, boolean>>({})
  
  // 🖊️ ACEITE DIGITAL DE FOLHA DE PONTO
  const [showTimesheetAckDialog, setShowTimesheetAckDialog] = useState(false)
  const [selectedTimesheetForAck, setSelectedTimesheetForAck] = useState<any>(null)
  const [timesheetTermsText, setTimesheetTermsText] = useState('')
  const [timesheetTermsAccepted, setTimesheetTermsAccepted] = useState(false)
  const [acknowledgingTimesheet, setAcknowledgingTimesheet] = useState(false)
  const [timesheetAcknowledgments, setTimesheetAcknowledgments] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const userType = (session?.user as any)?.userType
    const employeeId = (session?.user as any)?.employeeId
    
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    } else if (session && userType !== 'SELLER' && userType !== 'EMPLOYEE') {
      // 🔧 Permitir SELLER e EMPLOYEE (CEO, gerentes, supervisores sem vendedor vinculado)
      router.push('/dashboard')
    } else if (session && (userType === 'SELLER' || (userType === 'EMPLOYEE' && employeeId))) {
      // 🔧 SELLER normal ou EMPLOYEE com employeeId (CEO, gerentes, supervisores)
      fetchDashboardData()
      if (userType === 'SELLER') {
        checkOverdueClients()
      }
    }
  }, [session, status, router])

  const checkOverdueClients = async () => {
    try {
      const response = await fetch('/api/sellers/check-overdue-clients', {
        method: 'POST'
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.overdueClients && data.overdueClients.length > 0) {
          console.log(`${data.overdueClients.length} cliente(s) em atraso detectado(s)`)
        }
      }
    } catch (error) {
      console.error('Error checking overdue clients:', error)
    }
  }

  const fetchDashboardData = async () => {
    try {
      // Buscar clientes
      const customersRes = await fetch('/api/sellers/customers')
      const customers = await customersRes.json()

      // Buscar pedidos
      const ordersRes = await fetch('/api/sellers/orders')
      const orders = await ordersRes.json()

      // Buscar comissões
      const commissionsRes = await fetch('/api/sellers/commission')
      const commissionsData = await commissionsRes.json()

      setStats({
        totalCustomers: customers.length,
        totalOrders: orders.length,
        pendingCommissions: commissionsData.summary.pending,
        totalCommissions: commissionsData.summary.total
      })

      setRecentOrders(orders.slice(0, 5))
      
      // 🔥 BUSCAR DADOS DO FUNCIONÁRIO (se tiver employeeId)
      const employeeId = (session?.user as any)?.employeeId
      
      if (employeeId) {
        console.log('✅ [SELLER DASHBOARD] Usuário tem employeeId, buscando dados de funcionário...')
        setHasEmployeeAccess(true)
        
        try {
          // Buscar perfil do funcionário
          const profileRes = await fetch('/api/employee/profile')
          if (profileRes.ok) {
            const profile = await profileRes.json()
            setEmployeeData(profile)
            console.log('✅ Perfil de funcionário carregado:', profile.name)
          }
          
          // Buscar pagamentos
          const paymentsRes = await fetch('/api/employee/payments')
          if (paymentsRes.ok) {
            const payments = await paymentsRes.json()
            setEmployeePayments(payments.slice(0, 5))
            console.log('✅ Pagamentos carregados:', payments.length)
          }
          
          // Buscar documentos
          const docsRes = await fetch('/api/employee/documents')
          if (docsRes.ok) {
            const docs = await docsRes.json()
            setEmployeeDocuments(docs)
            console.log('✅ Documentos carregados:', docs.length)
          }
        } catch (empError) {
          console.error('❌ Erro ao carregar dados do funcionário:', empError)
        }
      } else {
        console.log('ℹ️ [SELLER DASHBOARD] Usuário não tem employeeId vinculado')
        setHasEmployeeAccess(false)
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  // 🖊️ Função para abrir modal de aceite
  const handleOpenAcknowledgeDialog = async (payment: any) => {
    console.log('🖊️ [ACKNOWLEDGE] Abrindo modal de aceite para pagamento:', payment.id)
    
    // Buscar termos e condições
    try {
      const res = await fetch(`/api/employee/payments/${payment.id}/acknowledge`, {
        method: 'OPTIONS'
      })
      const data = await res.json()
      setTermsText(data.terms)
    } catch (error) {
      console.error('Erro ao carregar termos:', error)
      setTermsText('Erro ao carregar termos e condições')
    }
    
    setSelectedPaymentForAck(payment)
    setTermsAccepted(false)
    setShowAcknowledgeDialog(true)
  }

  // 🖊️ Função para aceitar contracheque
  const handleAcknowledgePayment = async () => {
    if (!selectedPaymentForAck || !termsAccepted) {
      toast.error('Você precisa aceitar os termos e condições')
      return
    }

    console.log('🖊️ [ACKNOWLEDGE] Processando aceite digital...')
    console.log('   Payment ID:', selectedPaymentForAck.id)
    console.log('   Terms Accepted:', termsAccepted)
    console.log('   Session User:', session?.user)
    console.log('   EmployeeId:', (session?.user as any)?.employeeId)
    
    setAcknowledgingPayment(true)

    try {
      console.log('📡 Enviando requisição POST para:', `/api/employee/payments/${selectedPaymentForAck.id}/acknowledge`)
      
      const res = await fetch(`/api/employee/payments/${selectedPaymentForAck.id}/acknowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      console.log('📥 Resposta recebida - Status:', res.status)
      
      const data = await res.json()
      console.log('📥 Dados da resposta:', data)

      if (!res.ok) {
        console.error('❌ Erro na resposta:', data)
        throw new Error(data.error || data.details || 'Erro ao aceitar contracheque')
      }

      console.log('✅ [ACKNOWLEDGE] Aceite registrado com sucesso!')
      toast.success('Contracheque aceito digitalmente! ✓')

      // Atualizar estado de aceites
      setPaymentAcknowledgments(prev => ({
        ...prev,
        [selectedPaymentForAck.id]: true
      }))

      // Fechar modal
      setShowAcknowledgeDialog(false)
      setSelectedPaymentForAck(null)
      setTermsAccepted(false)

    } catch (error: any) {
      console.error('❌ [ACKNOWLEDGE] Erro:', error)
      toast.error(error.message || 'Erro ao processar aceite digital')
    } finally {
      setAcknowledgingPayment(false)
    }
  }

  // 🖊️ Carregar aceites existentes de contracheque
  useEffect(() => {
    if (employeePayments.length > 0) {
      employeePayments.forEach(async (payment) => {
        try {
          const res = await fetch(`/api/employee/payments/${payment.id}/acknowledge`)
          const data = await res.json()
          if (data.acknowledged) {
            setPaymentAcknowledgments(prev => ({
              ...prev,
              [payment.id]: true
            }))
          }
        } catch (error) {
          console.error('Erro ao verificar aceite:', error)
        }
      })
    }
  }, [employeePayments])
  
  // 🖊️ Carregar aceites existentes de folha de ponto
  useEffect(() => {
    if (employeeDocuments.length > 0) {
      employeeDocuments.forEach(async (doc) => {
        if (doc.documentType !== 'FOLHA_PONTO') return;
        try {
          const res = await fetch(`/api/employee/documents/${doc.id}/acknowledge`)
          const data = await res.json()
          if (data.acknowledged) {
            setTimesheetAcknowledgments(prev => ({
              ...prev,
              [doc.id]: true
            }))
          }
        } catch (error) {
          console.error('Erro ao verificar aceite de folha de ponto:', error)
        }
      })
    }
  }, [employeeDocuments])

  // 🖊️ Função para abrir modal de aceite de folha de ponto
  const handleOpenTimesheetAckDialog = async (doc: any) => {
    console.log('🖊️ [TIMESHEET_ACK] Abrindo modal de aceite para folha de ponto:', doc.id)
    
    // Buscar termos e condições
    try {
      const res = await fetch(`/api/employee/documents/${doc.id}/acknowledge`, {
        method: 'OPTIONS'
      })
      const data = await res.json()
      setTimesheetTermsText(data.terms)
    } catch (error) {
      console.error('Erro ao carregar termos:', error)
      setTimesheetTermsText('Declaro que conferi todas as informações contidas nesta folha de ponto e confirmo que os registros de entrada, saída, intervalos e horas extras estão corretos e correspondem aos dias efetivamente trabalhados.')
    }
    
    setSelectedTimesheetForAck(doc)
    setTimesheetTermsAccepted(false)
    setShowTimesheetAckDialog(true)
  }

  // 🖊️ Função para aceitar folha de ponto
  const handleAcknowledgeTimesheet = async () => {
    if (!selectedTimesheetForAck || !timesheetTermsAccepted) {
      toast.error('Você precisa aceitar os termos e condições')
      return
    }

    console.log('🖊️ [TIMESHEET_ACK] Processando aceite digital...')
    setAcknowledgingTimesheet(true)

    try {
      const res = await fetch(`/api/employee/documents/${selectedTimesheetForAck.id}/acknowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          acceptanceText: timesheetTermsText || 'Declaro que conferi todos os registros de ponto e confirmo que estão corretos.'
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || data.details || 'Erro ao aceitar folha de ponto')
      }

      console.log('✅ [TIMESHEET_ACK] Aceite registrado com sucesso!')
      toast.success('Folha de ponto aceita digitalmente! ✓')

      // Atualizar estado de aceites
      setTimesheetAcknowledgments(prev => ({
        ...prev,
        [selectedTimesheetForAck.id]: true
      }))

      // Fechar modal
      setShowTimesheetAckDialog(false)
      setSelectedTimesheetForAck(null)
      setTimesheetTermsAccepted(false)

    } catch (error: any) {
      console.error('❌ [TIMESHEET_ACK] Erro:', error)
      toast.error(error.message || 'Erro ao processar aceite digital')
    } finally {
      setAcknowledgingTimesheet(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    )
  }

  // 🔧 Permitir SELLER e EMPLOYEE (CEO, gerentes, supervisores sem vendedor vinculado)
  const userType = (session?.user as any)?.userType
  const hasEmployeeAccess_ = (session?.user as any)?.employeeId
  if (!session || (userType !== 'SELLER' && !(userType === 'EMPLOYEE' && hasEmployeeAccess_))) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto max-w-7xl flex h-16 items-center justify-between px-4">
          <div className="flex items-center space-x-3">
            <div className="relative w-10 h-10 rounded-lg overflow-hidden">
              <Image 
                src="/logo.jpg" 
                alt="[SUA EMPRESA]" 
                fill 
                className="object-contain"
                priority
              />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Painel do Vendedor</h1>
              <p className="text-xs text-gray-600">{(session.user as any)?.seller?.name || session.user?.name}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <Link href="/seller/notifications">
              <Button variant="ghost" size="sm">
                <Bell className="w-5 h-5" />
              </Button>
            </Link>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => signOut({ callbackUrl: '/' })}
              className="flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">

        {/* 🔥 ALERTA: Funcionário com acesso de vendedor */}
        {hasEmployeeAccess && employeeData && (
          <div className="mb-6">
            <Card className="border-2 border-blue-500 bg-blue-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-900">
                  <Briefcase className="h-5 w-5" />
                  Portal do Funcionário + Vendedor Integrado
                </CardTitle>
                <CardDescription className="text-blue-700">
                  Você tem acesso tanto às funcionalidades de vendedor quanto de funcionário (RH)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <p className="text-sm font-medium text-blue-900">Cargo</p>
                    <p className="text-lg font-bold text-blue-700">
                      {employeeData?.position || 'Vendedor'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-900">Departamento</p>
                    <p className="text-lg font-bold text-blue-700">
                      {employeeData?.department?.name || 'Vendas'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-900">Limite Total</p>
                    <p className="text-lg font-bold text-blue-700">
                      R$ {((employeeData?.creditLimit || 0)).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-900">Disponível</p>
                    <p className={`text-lg font-bold ${(employeeData?.availableCredit || 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {(employeeData?.availableCredit || 0) < 0 ? '-' : ''}R$ {Math.abs(employeeData?.availableCredit || 0).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-900">Utilizado</p>
                    <p className={`text-lg font-bold ${(employeeData?.totalUsed || 0) > 0 ? 'text-orange-600' : 'text-blue-700'}`}>
                      R$ {((employeeData?.totalUsed || 0)).toFixed(2)}
                      {(employeeData?.usedPercentage || 0) > 0 && (
                        <span className="text-xs ml-1">({employeeData?.usedPercentage}%)</span>
                      )}
                    </p>
                  </div>
                </div>
                {/* Alertas de crédito */}
                {(employeeData?.availableCredit || 0) < 0 && (
                  <div className="mt-3 p-2 bg-red-100 border border-red-300 rounded-lg">
                    <p className="text-sm text-red-700 font-medium">
                      ⚠️ Seu limite de crédito está negativo. Regularize seus débitos para continuar comprando.
                    </p>
                  </div>
                )}
                {(employeeData?.overdueBoletosCount || 0) > 0 && (
                  <div className="mt-2 p-2 bg-orange-100 border border-orange-300 rounded-lg">
                    <p className="text-sm text-orange-700 font-medium">
                      ⏰ Você tem {employeeData?.overdueBoletosCount} conta(s) em atraso.
                    </p>
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="bg-white hover:bg-blue-50 cursor-pointer"
                    onClick={() => {
                      const section = document.getElementById('pagamentos-section');
                      if (section) {
                        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }}
                  >
                    <Wallet className="h-4 w-4 mr-2" />
                    {(employeePayments || []).length} Pagamentos
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="bg-white hover:bg-blue-50 cursor-pointer"
                    onClick={() => {
                      const section = document.getElementById('documentos-section');
                      if (section) {
                        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Folhas de Ponto
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Meus Clientes</CardTitle>
              <Users className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCustomers}</div>
              <p className="text-xs text-muted-foreground">
                Clientes cadastrados
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pedidos</CardTitle>
              <ShoppingCart className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalOrders}</div>
              <p className="text-xs text-muted-foreground">
                Total de pedidos
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Comissões Pendentes</CardTitle>
              <DollarSign className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {stats.pendingCommissions.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                Aguardando liberação
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Comissões Totais</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {stats.totalCommissions.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                Total acumulado
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Ações Rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
          <Link href="/seller/customers">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Meus Clientes
                </CardTitle>
                <CardDescription>
                  Visualizar e cadastrar novos clientes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar Cliente
                </Button>
              </CardContent>
            </Card>
          </Link>

          <Link href="/seller/orders/new">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Tirar Pedido
                </CardTitle>
                <CardDescription>
                  Criar pedido para cliente
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Fazer Pedido
                </Button>
              </CardContent>
            </Card>
          </Link>

          <Link href="/seller/orders">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Gerenciar Pedidos
                </CardTitle>
                <CardDescription>
                  Ver todos os pedidos dos seus clientes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  Ver Pedidos
                </Button>
              </CardContent>
            </Card>
          </Link>

          <Link href="/seller/commissions">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Minhas Comissões
                </CardTitle>
                <CardDescription>
                  Ver histórico de comissões
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  Ver Comissões
                </Button>
              </CardContent>
            </Card>
          </Link>

          <Link href="/seller/financial">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Gestão Financeira
                </CardTitle>
                <CardDescription>
                  Acompanhar situação financeira dos clientes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  Ver Financeiro
                </Button>
              </CardContent>
            </Card>
          </Link>

          <Link href="/seller/notifications">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notificações
                </CardTitle>
                <CardDescription>
                  Ver suas notificações e alertas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  Ver Notificações
                </Button>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Pedidos Recentes */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Pedidos Recentes</CardTitle>
            <CardDescription>
              Últimos pedidos realizados
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum pedido realizado ainda
              </div>
            ) : (
              <div className="space-y-4">
                {recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{order.orderNumber}</p>
                      <p className="text-sm text-muted-foreground">
                        {order.customer?.name || order.customerName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">
                        R$ {order.total.toFixed(2)}
                      </p>
                      <Badge
                        variant={
                          order.status === 'PENDING'
                            ? 'secondary'
                            : order.status === 'CONFIRMED'
                            ? 'default'
                            : 'outline'
                        }
                      >
                        {order.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 🔥 SEÇÕES DO FUNCIONÁRIO (quando vinculado) */}
        {hasEmployeeAccess && (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Briefcase className="h-6 w-6 text-blue-600" />
                Minhas Informações de RH
              </h2>
            </div>

            {/* Meus Pagamentos */}
            <Card className="mb-8" id="pagamentos-section">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Meus Pagamentos
                </CardTitle>
                <CardDescription>
                  Todos os seus pagamentos (pagos e pendentes)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {employeePayments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum pagamento registrado
                  </div>
                ) : (
                  <div className="space-y-4">
                    {employeePayments.map((payment: any) => {
                      // Mostra TODOS os componentes com valor > 0
                      const allComponents = [];
                      
                      // Extrair earningsItems do notes (Salário Família, DSR, Hora Extra, etc)
                      let earningsItems: Array<{description: string, amount: number}> = [];
                      try {
                        if (payment.notes) {
                          const notesObj = typeof payment.notes === 'string' ? JSON.parse(payment.notes) : payment.notes;
                          if (notesObj.earningsItems && Array.isArray(notesObj.earningsItems)) {
                            earningsItems = notesObj.earningsItems;
                          }
                        }
                      } catch (e) {
                        // Ignore parsing errors
                      }
                      
                      // Antecipação
                      if (payment.advanceAmount > 0) {
                        allComponents.push({ 
                          name: 'Antecipação Salarial', 
                          value: payment.advanceAmount,
                          dueDate: payment.advanceDueDate,
                          isPaid: !!payment.paidAt
                        });
                      }
                      
                      // Salário
                      if (payment.salaryAmount > 0) {
                        allComponents.push({ 
                          name: 'Salário', 
                          value: payment.salaryAmount,
                          dueDate: payment.salaryDueDate,
                          isPaid: !!payment.paidAt
                        });
                      }
                      
                      // Vencimentos Adicionais (Salário Família, DSR, Hora Extra, etc)
                      for (const earning of earningsItems) {
                        if (earning.amount > 0) {
                          allComponents.push({
                            name: earning.description,
                            value: earning.amount,
                            dueDate: payment.salaryDueDate, // Mesmo vencimento do salário
                            isPaid: !!payment.paidAt
                          });
                        }
                      }
                      
                      // Vale Alimentação
                      if (payment.foodVoucherAmount > 0) {
                        allComponents.push({ 
                          name: 'Vale Alimentação', 
                          value: payment.foodVoucherAmount,
                          dueDate: payment.foodVoucherDueDate,
                          isPaid: !!payment.paidAt
                        });
                      }
                      
                      // Bônus
                      if (payment.bonusAmount > 0) {
                        allComponents.push({ 
                          name: 'Bônus/Premiação', 
                          value: payment.bonusAmount,
                          dueDate: payment.bonusDueDate,
                          isPaid: !!payment.paidAt
                        });
                      }
                      
                      // Não mostra se não tiver nenhum componente
                      if (allComponents.length === 0) return null;
                      
                      const isPaid = !!payment.paidAt;
                      
                      return (
                        <div
                          key={payment.id}
                          className={`p-4 border rounded-lg space-y-3 ${isPaid ? 'bg-green-50' : 'bg-yellow-50'}`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">
                                Pagamento - {payment.month || '-'}/{payment.year || '-'}
                              </p>
                              {isPaid ? (
                                <p className="text-xs text-green-600 font-medium">
                                  ✓ Recebido em: {format(new Date(payment.paidAt), "dd/MM/yyyy", { locale: ptBR })}
                                </p>
                              ) : (
                                <p className="text-xs text-amber-600 font-medium">
                                  ⏳ Aguardando pagamento
                                </p>
                              )}
                            </div>
                            {isPaid ? (
                              <Badge variant="default" className="bg-green-600">
                                ✓ Pago
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-amber-500 text-white">
                                ⏳ Pendente
                              </Badge>
                            )}
                          </div>
                          
                          <div className="space-y-2 text-sm">
                            {allComponents.map((comp, idx) => (
                              <div key={idx} className={`flex justify-between items-center p-2 rounded ${isPaid ? 'bg-white' : 'bg-white border border-amber-200'}`}>
                                <div>
                                  <span className="font-medium">{comp.name}</span>
                                  {comp.dueDate && (
                                    <p className={`text-xs ${isPaid ? 'text-muted-foreground' : 'text-amber-700 font-medium'}`}>
                                      {isPaid ? 'Vencimento' : '🗓️ Vencimento'}: {format(new Date(comp.dueDate), "dd/MM/yyyy", { locale: ptBR })}
                                    </p>
                                  )}
                                </div>
                                <span className={`font-bold ${isPaid ? 'text-green-700' : 'text-amber-700'}`}>
                                  R$ {(comp.value || 0).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                          
                          <div className={`flex justify-between pt-2 border-t ${isPaid ? 'border-green-200' : 'border-amber-200'}`}>
                            <span className="font-bold">Total {isPaid ? 'Recebido' : 'a Receber'}:</span>
                            <span className={`font-bold text-lg ${isPaid ? 'text-green-700' : 'text-amber-700'}`}>
                              R$ {(payment.totalAmount || 0).toFixed(2)}
                            </span>
                          </div>

                          {/* Contracheque vinculado ao pagamento */}
                          {(() => {
                            // Buscar o contracheque do mesmo mês/ano
                            const contracheque = employeeDocuments.find((doc: any) => {
                              if (doc.documentType !== 'CONTRACHEQUE') return false;
                              // Verificar se o título ou referência contém o mês/ano
                              const titleMatch = doc.title?.includes(`${payment.month}/${payment.year}`);
                              const refMatch = doc.referenceDate && 
                                new Date(doc.referenceDate).getMonth() + 1 === payment.month &&
                                new Date(doc.referenceDate).getFullYear() === payment.year;
                              return titleMatch || refMatch;
                            });
                            
                            return contracheque ? (
                              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <FileText className="h-5 w-5 text-blue-600" />
                                    <span className="font-medium text-blue-800">Contracheque</span>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="bg-white hover:bg-blue-100"
                                    onClick={() => {
                                      const url = contracheque.documentUrl || contracheque.fileUrl;
                                      if (url) window.open(url, '_blank');
                                    }}
                                  >
                                    <FileText className="h-4 w-4 mr-2" />
                                    Ver Contracheque
                                  </Button>
                                </div>
                              </div>
                            ) : null;
                          })()}

                          {/* Botão de Aceite Digital */}
                          <div className="mt-4 pt-3 border-t border-gray-200">
                            {paymentAcknowledgments[payment.id] ? (
                              <div className="flex items-center justify-center gap-2 text-green-700 bg-green-50 p-3 rounded-lg">
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="font-medium text-sm">Contracheque Aceito Digitalmente ✓</span>
                              </div>
                            ) : (
                              <Button
                                onClick={() => handleOpenAcknowledgeDialog(payment)}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                size="sm"
                              >
                                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                                Assinar Contracheque
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Folhas de Ponto */}
            <Card className="mb-8" id="documentos-section">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Minhas Folhas de Ponto
                </CardTitle>
                <CardDescription>
                  Visualize e assine suas folhas de ponto
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  const folhasPonto = employeeDocuments.filter((doc: any) => doc.documentType === 'FOLHA_PONTO');
                  return folhasPonto.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhuma folha de ponto disponível
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {folhasPonto.map((doc: any) => (
                        <div
                          key={doc.id}
                          className={`p-4 border rounded-lg ${timesheetAcknowledgments[doc.id] ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <Clock className="h-8 w-8 text-gray-500" />
                              <div>
                                <p className="font-medium">Folha de Ponto</p>
                                <p className="text-sm text-muted-foreground">
                                  {doc.referenceDate ? format(new Date(new Date(doc.referenceDate).getTime() + 12 * 60 * 60 * 1000), 'MMMM/yyyy', { locale: ptBR }) : (doc.title || '-')}
                                </p>
                              </div>
                            </div>
                            {timesheetAcknowledgments[doc.id] ? (
                              <Badge variant="default" className="bg-green-600">
                                ✓ Assinada
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-amber-500 text-white">
                                ⏳ Pendente
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex flex-wrap gap-2">
                            {(doc.documentUrl || doc.fileUrl) && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="bg-white"
                                onClick={() => {
                                  const url = doc.documentUrl || doc.fileUrl;
                                  window.open(url, '_blank');
                                }}
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                Ver Folha de Ponto
                              </Button>
                            )}
                            
                            {timesheetAcknowledgments[doc.id] ? (
                              <div className="flex items-center gap-2 text-green-700 bg-green-100 px-3 py-1.5 rounded-lg text-sm">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="font-medium">Assinada Digitalmente</span>
                              </div>
                            ) : (
                              <Button
                                onClick={() => handleOpenTimesheetAckDialog(doc)}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                                size="sm"
                              >
                                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                                Assinar Folha de Ponto
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </>
        )}

        {/* 🟣 Seção de Equipe - Para Encarregados, Gerentes e CEO */}
        {hasEmployeeAccess && (employeeData?.isSupervisor || employeeData?.isManager || employeeData?.isCEO) && (
          <div className="mb-8" id="equipe-section">
            <SupervisorEvaluations 
              employeeId={employeeData.id} 
              employeeName={employeeData.name} 
            />
          </div>
        )}
      </div>

      {/* Modal de Aceite Digital */}
      <Dialog open={showAcknowledgeDialog} onOpenChange={setShowAcknowledgeDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">🖊️ Aceite Digital de Contracheque</DialogTitle>
            <DialogDescription>
              Assinatura eletrônica conforme <strong>Lei 14.063/2020</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Informações do Pagamento */}
            {selectedPaymentForAck && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-blue-900 mb-2">Detalhes do Pagamento</h3>
                <div className="space-y-1 text-sm">
                  <p><strong>Funcionário:</strong> {employeeData?.name}</p>
                  <p><strong>Mês/Ano:</strong> {selectedPaymentForAck.month}/{selectedPaymentForAck.year}</p>
                  <p><strong>Valor Total:</strong> R$ {(selectedPaymentForAck.totalAmount || 0).toFixed(2)}</p>
                </div>
              </div>
            )}

            {/* Termos e Condições */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-300 max-h-96 overflow-y-auto">
              <h3 className="font-semibold mb-3 text-gray-900">Termos e Condições</h3>
              <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed font-sans">
                {termsText}
              </pre>
            </div>

            {/* Aviso Legal */}
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-300">
              <p className="text-sm text-yellow-900">
                <strong>⚠️ IMPORTANTE:</strong> Ao aceitar digitalmente este contracheque, você declara que:
              </p>
              <ul className="text-sm text-yellow-900 mt-2 ml-5 list-disc space-y-1">
                <li>Leu e compreendeu todos os valores apresentados</li>
                <li>Concorda com os proventos e descontos discriminados</li>
                <li>Reconhece a validade jurídica desta assinatura eletrônica</li>
                <li>Autoriza o registro de data, hora, IP e dispositivo utilizados</li>
              </ul>
            </div>

            {/* Checkbox de Aceite */}
            <div className="flex items-start gap-3 p-4 bg-white border-2 border-blue-300 rounded-lg">
              <Checkbox
                id="terms"
                checked={termsAccepted}
                onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                className="mt-1"
              />
              <Label htmlFor="terms" className="text-sm leading-relaxed cursor-pointer">
                <strong>Eu aceito os termos e condições acima</strong> e declaro que li e compreendi
                todas as informações do meu contracheque. Reconheço que esta assinatura eletrônica
                tem a mesma validade jurídica de uma assinatura manuscrita.
              </Label>
            </div>

            {/* Botões de Ação */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowAcknowledgeDialog(false)}
                disabled={acknowledgingPayment}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleAcknowledgePayment}
                disabled={!termsAccepted || acknowledgingPayment}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                {acknowledgingPayment ? (
                  <>
                    <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processando...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Confirmar Aceite Digital
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Aceite Digital de Folha de Ponto */}
      <Dialog open={showTimesheetAckDialog} onOpenChange={setShowTimesheetAckDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">🖊️ Aceite Digital de Folha de Ponto</DialogTitle>
            <DialogDescription>
              Assinatura eletrônica conforme <strong>Lei 14.063/2020</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Informações da Folha de Ponto */}
            {selectedTimesheetForAck && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-blue-900 mb-2">Detalhes da Folha de Ponto</h3>
                <div className="space-y-1 text-sm">
                  <p><strong>Funcionário:</strong> {employeeData?.name}</p>
                  <p><strong>Período:</strong> {selectedTimesheetForAck.title || (selectedTimesheetForAck.referenceDate ? format(new Date(new Date(selectedTimesheetForAck.referenceDate).getTime() + 12 * 60 * 60 * 1000), 'MMMM/yyyy', { locale: ptBR }) : '-')}</p>
                </div>
              </div>
            )}

            {/* Termos e Condições */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-300 max-h-96 overflow-y-auto">
              <h3 className="font-semibold mb-3 text-gray-900">Termos e Condições</h3>
              <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed font-sans">
                {timesheetTermsText}
              </pre>
            </div>

            {/* Aviso Legal */}
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-300">
              <p className="text-sm text-yellow-900">
                <strong>⚠️ IMPORTANTE:</strong> Ao assinar digitalmente esta folha de ponto, você declara que:
              </p>
              <ul className="text-sm text-yellow-900 mt-2 ml-5 list-disc space-y-1">
                <li>Conferiu todas as informações de entrada, saída e intervalos</li>
                <li>Os registros de horas extras estão corretos</li>
                <li>Reconhece a validade jurídica desta assinatura eletrônica</li>
                <li>Autoriza o registro de data, hora, IP e dispositivo utilizados</li>
              </ul>
            </div>

            {/* Checkbox de Aceite */}
            <div className="flex items-start gap-3 p-4 bg-white border-2 border-blue-300 rounded-lg">
              <Checkbox
                id="timesheet-terms"
                checked={timesheetTermsAccepted}
                onCheckedChange={(checked) => setTimesheetTermsAccepted(checked as boolean)}
                className="mt-1"
              />
              <Label htmlFor="timesheet-terms" className="text-sm leading-relaxed cursor-pointer">
                <strong>Eu aceito os termos e condições acima</strong> e declaro que conferi todos os
                registros de ponto apresentados. Reconheço que esta assinatura eletrônica
                tem a mesma validade jurídica de uma assinatura manuscrita.
              </Label>
            </div>

            {/* Botões de Ação */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowTimesheetAckDialog(false)}
                disabled={acknowledgingTimesheet}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleAcknowledgeTimesheet}
                disabled={!timesheetTermsAccepted || acknowledgingTimesheet}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                {acknowledgingTimesheet ? (
                  <>
                    <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processando...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Confirmar Assinatura Digital
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
