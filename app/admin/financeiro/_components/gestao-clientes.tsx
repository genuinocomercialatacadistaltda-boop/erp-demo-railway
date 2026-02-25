
'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { 
  DollarSign, 
  AlertCircle, 
  CheckCircle, 
  Search,
  TrendingUp,
  TrendingDown,
  CreditCard,
  FileText,
  Users
} from 'lucide-react'
import { toast } from 'sonner'

interface CustomerFinancial {
  id: string
  name: string
  cpfCnpj: string
  phone: string
  city: string
  creditLimit: number
  availableCredit: number
  isActive: boolean
  totalDebt: number
  overdueBoletos: number
  openBoletos: number
  lastOrderDate: string | null
  boletos: Array<{
    id: string
    boletoNumber: string
    amount: number
    dueDate: string
    status: string
    installmentInfo?: string
  }>
  receivables: Array<{
    id: string
    description: string
    amount: number
    dueDate: string
    paymentDate: string | null
    status: string
    paymentMethod: string
    installmentInfo?: string
    boletoId?: string | null
  }>
  pendingOrders?: Array<{
    id: string
    orderNumber: string
    total: number
    createdAt: string
    status: string
  }>
}

export default function GestaoClientes() {
  const [customers, setCustomers] = useState<CustomerFinancial[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<CustomerFinancial[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'overdue' | 'blocked' | 'ok'>('all')
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerFinancial | null>(null)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)

  useEffect(() => {
    fetchFinancialData()
  }, [])

  useEffect(() => {
    filterCustomers()
  }, [searchTerm, filterStatus, customers])

  const fetchFinancialData = async () => {
    try {
      setLoading(true)
      console.log('[ADMIN_GESTAO_CLIENTES] 📡 Buscando dados da API /api/admin/financial/customers-health...')
      
      const response = await fetch('/api/admin/financial/customers-health', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })
      
      const apiVersion = response.headers.get('X-API-Version')
      const buildTime = response.headers.get('X-Build-Time')
      
      console.log('[FRONTEND] 📥 Resposta recebida:', {
        status: response.status,
        ok: response.ok,
        apiVersion,
        buildTime
      })
      
      if (!response.ok) {
        throw new Error('Erro ao carregar dados financeiros')
      }

      const data = await response.json()
      
      console.log('[FRONTEND] 🔍 METADATA DA API:', data._metadata)
      
      // 🔍 DEBUG: Buscar cliente "joao marcos" especificamente
      const joaoMarcos = data.customers?.find((c: any) => 
        c.name.toLowerCase().includes('joao marcos')
      )
      
      if (joaoMarcos) {
        console.log('[FRONTEND] 🎯 CLIENTE JOAO MARCOS:', {
          name: joaoMarcos.name,
          creditLimit: joaoMarcos.creditLimit,
          availableCredit: joaoMarcos.availableCredit,
          emUso: joaoMarcos.creditLimit - joaoMarcos.availableCredit
        })
      }
      
      console.log('[FRONTEND] 📊 Dados recebidos da API:', {
        hasCustomers: !!data.customers,
        customersLength: data.customers?.length || 0,
        hasSummary: !!data.summary,
        summary: data.summary,
        firstCustomer: data.customers?.[0] ? {
          id: data.customers[0].id,
          name: data.customers[0].name,
          city: data.customers[0].city
        } : null
      })
      
      setCustomers(data.customers || [])
      setFilteredCustomers(data.customers || [])
      
      console.log('[FRONTEND] ✅ Estado atualizado com', data.customers?.length || 0, 'clientes')
    } catch (error) {
      console.error('[FRONTEND] ❌ Erro ao buscar dados financeiros:', error)
      toast.error('Erro ao carregar dados financeiros')
    } finally {
      setLoading(false)
    }
  }

  const filterCustomers = () => {
    let filtered = [...customers]

    // Filtro por texto - 🔥 CORREÇÃO: Proteção contra valores null/undefined
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(customer =>
        (customer.name || '').toLowerCase().includes(searchLower) ||
        (customer.cpfCnpj || '').includes(searchTerm) ||
        (customer.phone || '').includes(searchTerm) ||
        (customer.city || '').toLowerCase().includes(searchLower)
      )
    }

    // Filtro por status
    switch (filterStatus) {
      case 'overdue':
        // Apenas clientes com boletos vencidos (independente de bloqueio manual)
        filtered = filtered.filter(customer => customer.overdueBoletos > 0)
        break
      case 'blocked':
        // Apenas clientes manualmente bloqueados
        filtered = filtered.filter(customer => !customer.isActive)
        break
      case 'ok':
        // Clientes sem atrasos E ativos
        filtered = filtered.filter(customer => customer.overdueBoletos === 0 && customer.isActive)
        break
    }

    setFilteredCustomers(filtered)
  }

  const getStatusBadge = (customer: CustomerFinancial) => {
    // 🔥 CORREÇÃO: Diferenciação clara entre bloqueado manualmente e atrasado
    // Prioridade 1: Cliente manualmente bloqueado (mais grave)
    if (!customer.isActive) {
      return <Badge variant="destructive" className="bg-red-600">🔒 Bloqueado</Badge>
    }
    // Prioridade 2: Cliente com boletos atrasados (mas não bloqueado)
    if (customer.overdueBoletos > 0) {
      return <Badge variant="destructive" className="bg-orange-500">⏰ Em Atraso</Badge>
    }
    // Prioridade 3: Cliente sem limite disponível
    if (customer.availableCredit <= 0) {
      return <Badge variant="outline" className="border-yellow-500 text-yellow-700">💰 Sem Limite</Badge>
    }
    // Tudo ok
    return <Badge variant="default" className="bg-green-500">✅ Em Dia</Badge>
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    // ⚠️ IMPORTANTE: Usar UTC para evitar problemas de timezone
    // Datas armazenadas como 00:00 UTC aparecem como dia anterior se convertidas para timezone local
    const date = new Date(dateString)
    const day = String(date.getUTCDate()).padStart(2, '0')
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const year = date.getUTCFullYear()
    return `${day}/${month}/${year}`
  }

  const viewCustomerDetails = (customer: CustomerFinancial) => {
    setSelectedCustomer(customer)
    setShowDetailsDialog(true)
  }

  // Estatísticas gerais
  // 🔥 CORREÇÃO: Separação clara entre clientes atrasados e bloqueados
  const stats = {
    totalCustomers: customers.length,
    // Clientes com boletos vencidos (independente de bloqueio)
    customersOverdue: customers.filter(c => c.overdueBoletos > 0).length,
    // Apenas clientes manualmente bloqueados pelo admin
    customersBlocked: customers.filter(c => !c.isActive).length,
    totalDebt: customers.reduce((sum, c) => sum + c.totalDebt, 0)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando dados financeiros...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="h-6 w-6 text-blue-600" />
          Saúde Financeira dos Clientes
        </h2>
        <p className="text-gray-600 mt-1">Acompanhe a situação financeira de todos os clientes do sistema</p>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCustomers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes em Atraso</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.customersOverdue}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Bloqueados</CardTitle>
            <TrendingDown className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{stats.customersBlocked}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total em Débito</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalDebt)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar por nome, CPF/CNPJ ou telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={filterStatus === 'all' ? 'default' : 'outline'}
                onClick={() => setFilterStatus('all')}
              >
                Todos
              </Button>
              <Button
                variant={filterStatus === 'overdue' ? 'destructive' : 'outline'}
                onClick={() => setFilterStatus('overdue')}
              >
                Em Atraso
              </Button>
              <Button
                variant={filterStatus === 'blocked' ? 'outline' : 'outline'}
                onClick={() => setFilterStatus('blocked')}
                className={filterStatus === 'blocked' ? 'bg-orange-500 text-white' : ''}
              >
                Bloqueados
              </Button>
              <Button
                variant={filterStatus === 'ok' ? 'default' : 'outline'}
                onClick={() => setFilterStatus('ok')}
                className={filterStatus === 'ok' ? 'bg-green-500' : ''}
              >
                Em Dia
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Clientes */}
      <Card>
        <CardHeader>
          <CardTitle>Clientes ({filteredCustomers.length})</CardTitle>
          <CardDescription>
            Lista detalhada da situação financeira dos clientes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Limite Total</TableHead>
                  <TableHead className="text-right">Disponível</TableHead>
                  <TableHead className="text-right">Utilizado</TableHead>
                  <TableHead className="text-center">Boletos em Aberto</TableHead>
                  <TableHead className="text-center">Em Atraso</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Nenhum cliente encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((customer) => {
                    const usedCredit = customer.creditLimit - customer.availableCredit
                    const usagePercentage = customer.creditLimit > 0 
                      ? (usedCredit / customer.creditLimit) * 100 
                      : 0

                    return (
                      <TableRow key={customer.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{customer.name}</p>
                            <p className="text-xs text-muted-foreground">{customer.cpfCnpj}</p>
                          </div>
                        </TableCell>
                        <TableCell>{customer.city}</TableCell>
                        <TableCell>{getStatusBadge(customer)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(customer.creditLimit)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={customer.availableCredit <= 0 ? 'text-red-500 font-medium' : 'text-green-600 font-medium'}>
                            {formatCurrency(customer.availableCredit)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div>
                            <p className={usagePercentage >= 80 ? 'text-orange-500 font-medium' : ''}>
                              {formatCurrency(usedCredit)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {usagePercentage.toFixed(0)}% usado
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">
                            {customer.openBoletos}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {customer.overdueBoletos > 0 ? (
                            <Badge variant="destructive">
                              {customer.overdueBoletos}
                            </Badge>
                          ) : (
                            <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => viewCustomerDetails(customer)}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            Detalhes
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Detalhes do Cliente */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes Financeiros - {selectedCustomer?.name}</DialogTitle>
            <DialogDescription>
              Informações completas sobre a situação financeira do cliente
            </DialogDescription>
          </DialogHeader>

          {selectedCustomer && (
            <div className="space-y-6">
              {/* Informações Gerais */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">CPF/CNPJ</p>
                  <p className="font-medium">{selectedCustomer.cpfCnpj}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Telefone</p>
                  <p className="font-medium">{selectedCustomer.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cidade</p>
                  <p className="font-medium">{selectedCustomer.city}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div className="mt-1">{getStatusBadge(selectedCustomer)}</div>
                </div>
              </div>

              {/* Informações de Crédito */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Situação de Crédito</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Limite Total</p>
                      <p className="text-xl font-bold">{formatCurrency(selectedCustomer.creditLimit)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Disponível</p>
                      <p className="text-xl font-bold text-green-600">
                        {formatCurrency(selectedCustomer.availableCredit)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Em Uso</p>
                      <p className="text-xl font-bold text-orange-600">
                        {formatCurrency(selectedCustomer.creditLimit - selectedCustomer.availableCredit)}
                      </p>
                    </div>
                  </div>

                  {/* Barra de Progresso de Crédito */}
                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Uso do Limite</span>
                      <span>
                        {((selectedCustomer.creditLimit - selectedCustomer.availableCredit) / selectedCustomer.creditLimit * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          selectedCustomer.availableCredit <= 0 
                            ? 'bg-red-500' 
                            : ((selectedCustomer.creditLimit - selectedCustomer.availableCredit) / selectedCustomer.creditLimit * 100) >= 80
                            ? 'bg-orange-500'
                            : 'bg-green-500'
                        }`}
                        style={{ 
                          width: `${Math.min(((selectedCustomer.creditLimit - selectedCustomer.availableCredit) / selectedCustomer.creditLimit * 100), 100)}%` 
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Boletos e Receivables */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Títulos Financeiros</CardTitle>
                  <CardDescription>
                    {selectedCustomer.openBoletos} títulos em aberto · {selectedCustomer.overdueBoletos} em atraso
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedCustomer.boletos.length === 0 && selectedCustomer.receivables.filter((r: any) => r.status === 'PENDENTE' || r.status === 'ATRASADO').length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">Nenhum título em aberto</p>
                  ) : (
                    <div className="space-y-3">
                      {/* Mostrar Boletos */}
                      {selectedCustomer.boletos.map((boleto) => {
                        // Status já vem traduzido da API com timezone de Brasília
                        const isOverdue = boleto.status === 'ATRASADO'
                        
                        return (
                          <div
                            key={boleto.id}
                            className={`p-4 border rounded-lg ${isOverdue ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium">{boleto.boletoNumber}</p>
                                {boleto.installmentInfo && (
                                  <p className="text-sm text-muted-foreground">{boleto.installmentInfo}</p>
                                )}
                                <p className="text-sm text-muted-foreground">
                                  Vencimento: {formatDate(boleto.dueDate)}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold">{formatCurrency(boleto.amount)}</p>
                                <Badge
                                  variant={isOverdue ? 'destructive' : boleto.status === 'PAGO' ? 'default' : 'outline'}
                                >
                                  {boleto.status}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      
                      {/* Mostrar Receivables em Aberto ou Atrasados (EXCETO os que já têm boleto) */}
                      {selectedCustomer.receivables
                        .filter((receivable: any) => 
                          (receivable.status === 'PENDENTE' || receivable.status === 'ATRASADO') && 
                          !receivable.boletoId
                        )
                        .map((receivable: any) => {
                          // Status já vem traduzido da API com timezone de Brasília
                          const isOverdue = receivable.status === 'ATRASADO'
                          
                          return (
                            <div
                              key={receivable.id}
                              className={`p-4 border rounded-lg ${isOverdue ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-medium">{receivable.description}</p>
                                  {receivable.installmentInfo && (
                                    <p className="text-sm text-muted-foreground">{receivable.installmentInfo}</p>
                                  )}
                                  <p className="text-sm text-muted-foreground">
                                    Vencimento: {formatDate(receivable.dueDate)}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Método: {receivable.paymentMethod || 'N/A'}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-lg font-bold">{formatCurrency(receivable.amount)}</p>
                                  <Badge
                                    variant={isOverdue ? 'destructive' : receivable.status === 'PAGO' ? 'default' : 'outline'}
                                  >
                                    {receivable.status}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Pedidos Pendentes */}
              {selectedCustomer.pendingOrders && selectedCustomer.pendingOrders.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Pedidos Pendentes (Não Pagos)</CardTitle>
                    <CardDescription>
                      {selectedCustomer.pendingOrders.length} pedido(s) aguardando pagamento
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {selectedCustomer.pendingOrders.map((order) => (
                        <div
                          key={order.id}
                          className="p-4 border border-yellow-200 bg-yellow-50 rounded-lg"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">Pedido #{order.orderNumber}</p>
                              <p className="text-sm text-muted-foreground">
                                Data: {formatDate(order.createdAt)}
                              </p>
                              <Badge variant="outline" className="mt-1">
                                {order.status}
                              </Badge>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold">{formatCurrency(order.total)}</p>
                              <Badge variant="secondary" className="bg-yellow-200 text-yellow-800">
                                Não Pago
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Alertas */}
              {(selectedCustomer.overdueBoletos > 0 || !selectedCustomer.isActive || selectedCustomer.availableCredit <= 0) && (
                <Card className="border-orange-300 bg-orange-50">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-orange-600" />
                      Alertas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {!selectedCustomer.isActive && (
                      <p className="text-sm text-red-600">⚠️ Cliente BLOQUEADO - não pode fazer novos pedidos</p>
                    )}
                    {selectedCustomer.overdueBoletos > 0 && (
                      <p className="text-sm text-red-600">
                        ⚠️ Cliente com {selectedCustomer.overdueBoletos} boleto(s) em atraso
                      </p>
                    )}
                    {selectedCustomer.availableCredit <= 0 && (
                      <p className="text-sm text-orange-600">
                        ⚠️ Cliente SEM LIMITE disponível para novos pedidos
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
