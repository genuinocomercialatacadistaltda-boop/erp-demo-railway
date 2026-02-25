'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Users,
  UserPlus,
  Star,
  ShoppingBag,
  TrendingUp,
  Edit,
  Plus,
  Minus,
  Eye,
  Search,
  Loader2,
  Calendar,
  Phone,
  Mail,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface RetailCustomer {
  id: string
  name: string
  phone: string
  email: string | null
  document: string | null
  address: string | null
  pointsBalance: number
  totalPointsEarned: number
  pointsMultiplier: number
  creditLimit: number
  currentDebt: number
  isActive: boolean
  createdAt: string
  lastLoginAt: string | null
  totalOrders: number
  totalSpent: number
  lastOrderDate: string | null
  recentTransactions: any[]
}

export default function RetailCustomersPage() {
  const [customers, setCustomers] = useState<RetailCustomer[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<RetailCustomer[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<RetailCustomer | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showPointsDialog, setShowPointsDialog] = useState(false)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)

  // Form states
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    email: '',
    document: '',
    address: '',
    creditLimit: 0,
    pointsMultiplier: 1.0,
  })

  const [pointsAdjustment, setPointsAdjustment] = useState({
    amount: 0,
    type: 'ADD',
    description: '',
  })

  useEffect(() => {
    fetchCustomers()
  }, [])

  useEffect(() => {
    if (searchTerm) {
      const filtered = customers.filter(
        (c) =>
          c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.phone.includes(searchTerm)
      )
      setFilteredCustomers(filtered)
    } else {
      setFilteredCustomers(customers)
    }
  }, [searchTerm, customers])

  const fetchCustomers = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/customer/retail-customers')
      if (!response.ok) throw new Error('Erro ao buscar clientes')
      const data = await response.json()
      setCustomers(data.customers)
      setFilteredCustomers(data.customers)
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao carregar clientes')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateCustomer = async () => {
    if (!newCustomer.name || !newCustomer.phone) {
      toast.error('Nome e telefone são obrigatórios')
      return
    }

    try {
      setIsCreating(true)
      const response = await fetch('/api/customer/retail-customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCustomer),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erro ao criar cliente')
      }

      toast.success('Cliente criado com sucesso')
      setShowCreateDialog(false)
      setNewCustomer({
        name: '',
        phone: '',
        email: '',
        document: '',
        address: '',
        creditLimit: 0,
        pointsMultiplier: 1.0,
      })
      fetchCustomers()
    } catch (error: any) {
      console.error('Erro:', error)
      toast.error(error.message || 'Erro ao criar cliente')
    } finally {
      setIsCreating(false)
    }
  }

  const handleAdjustPoints = async () => {
    if (!selectedCustomer) return

    if (!pointsAdjustment.amount || !pointsAdjustment.description) {
      toast.error('Preencha todos os campos')
      return
    }

    try {
      const response = await fetch(
        `/api/customer/retail-customers/${selectedCustomer.id}/points`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pointsAdjustment),
        }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erro ao ajustar pontos')
      }

      toast.success('Pontos ajustados com sucesso')
      setShowPointsDialog(false)
      setPointsAdjustment({ amount: 0, type: 'ADD', description: '' })
      fetchCustomers()
    } catch (error: any) {
      console.error('Erro:', error)
      toast.error(error.message || 'Erro ao ajustar pontos')
    }
  }

  const calculateStats = () => {
    return {
      totalCustomers: customers.length,
      activeCustomers: customers.filter((c) => c.isActive).length,
      totalPointsDistributed: customers.reduce(
        (sum, c) => sum + c.totalPointsEarned,
        0
      ),
      totalRevenue: customers.reduce((sum, c) => sum + c.totalSpent, 0),
    }
  }

  const stats = calculateStats()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Clientes Finais</h1>
          <p className="text-gray-600">Gerencie seus clientes e programa de fidelidade</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-orange-600 hover:bg-orange-700">
              <UserPlus className="w-4 h-4 mr-2" />
              Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Novo Cliente</DialogTitle>
              <DialogDescription>
                Cadastre um novo cliente no sistema
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome *</Label>
                <Input
                  value={newCustomer.name}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, name: e.target.value })
                  }
                  placeholder="Nome completo"
                />
              </div>
              <div>
                <Label>Telefone *</Label>
                <Input
                  value={newCustomer.phone}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, phone: e.target.value })
                  }
                  placeholder="(XX) XXXXX-XXXX"
                />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, email: e.target.value })
                  }
                  placeholder="email@exemplo.com"
                />
              </div>
              <div>
                <Label>CPF/CNPJ</Label>
                <Input
                  value={newCustomer.document}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, document: e.target.value })
                  }
                  placeholder="000.000.000-00"
                />
              </div>
              <div>
                <Label>Endereço</Label>
                <Input
                  value={newCustomer.address}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, address: e.target.value })
                  }
                  placeholder="Endereço completo"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Limite de Crédito (R$)</Label>
                  <Input
                    type="number"
                    value={newCustomer.creditLimit}
                    onChange={(e) =>
                      setNewCustomer({
                        ...newCustomer,
                        creditLimit: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Multiplicador de Pontos</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={newCustomer.pointsMultiplier}
                    onChange={(e) =>
                      setNewCustomer({
                        ...newCustomer,
                        pointsMultiplier: parseFloat(e.target.value) || 1.0,
                      })
                    }
                    placeholder="1.0"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreateCustomer}
                disabled={isCreating}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {isCreating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4 mr-2" />
                )}
                Criar Cliente
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCustomers}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeCustomers} ativos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pontos Distribuídos</CardTitle>
            <Star className="w-4 h-4 text-orange-600 fill-current" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalPointsDistributed.toLocaleString('pt-BR')}
            </div>
            <p className="text-xs text-muted-foreground">Total acumulado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <TrendingUp className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {stats.totalRevenue.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">De clientes finais</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <ShoppingBag className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R${' '}
              {stats.totalCustomers > 0
                ? (stats.totalRevenue / stats.totalCustomers).toFixed(2)
                : '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">Por cliente</p>
          </CardContent>
        </Card>
      </div>

      {/* Busca */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            type="text"
            placeholder="Buscar por nome ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Tabela de Clientes */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Clientes</CardTitle>
          <CardDescription>
            {filteredCustomers.length} cliente(s) encontrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead className="text-center">Pedidos</TableHead>
                <TableHead className="text-center">Total Gasto</TableHead>
                <TableHead className="text-center">Pontos</TableHead>
                <TableHead className="text-center">Multiplicador</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    Nenhum cliente encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{customer.name}</p>
                        <p className="text-xs text-gray-500">
                          Cliente há{' '}
                          {formatDistanceToNow(new Date(customer.createdAt), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="w-3 h-3 text-gray-400" />
                          <span>{customer.phone}</span>
                        </div>
                        {customer.email && (
                          <div className="flex items-center gap-1 text-sm text-gray-500">
                            <Mail className="w-3 h-3" />
                            <span>{customer.email}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{customer.totalOrders}</Badge>
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      R$ {customer.totalSpent.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Star className="w-4 h-4 text-orange-600 fill-current" />
                        <span className="font-bold">{customer.pointsBalance}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">
                        {customer.pointsMultiplier}x
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={customer.isActive ? 'default' : 'secondary'}
                        className={
                          customer.isActive
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : ''
                        }
                      >
                        {customer.isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedCustomer(customer)
                            setShowDetailsDialog(true)
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedCustomer(customer)
                            setShowPointsDialog(true)
                          }}
                        >
                          <Star className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog de Ajuste de Pontos */}
      <Dialog open={showPointsDialog} onOpenChange={setShowPointsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar Pontos</DialogTitle>
            <DialogDescription>
              Adicione ou remova pontos de {selectedCustomer?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-orange-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Saldo atual</p>
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-orange-600 fill-current" />
                <span className="text-2xl font-bold">
                  {selectedCustomer?.pointsBalance || 0} pontos
                </span>
              </div>
            </div>

            <div>
              <Label>Tipo de Ajuste</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Button
                  variant={pointsAdjustment.type === 'ADD' ? 'default' : 'outline'}
                  onClick={() =>
                    setPointsAdjustment({ ...pointsAdjustment, type: 'ADD' })
                  }
                  className={
                    pointsAdjustment.type === 'ADD'
                      ? 'bg-green-600 hover:bg-green-700'
                      : ''
                  }
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar
                </Button>
                <Button
                  variant={
                    pointsAdjustment.type === 'REMOVE' ? 'default' : 'outline'
                  }
                  onClick={() =>
                    setPointsAdjustment({ ...pointsAdjustment, type: 'REMOVE' })
                  }
                  className={
                    pointsAdjustment.type === 'REMOVE'
                      ? 'bg-red-600 hover:bg-red-700'
                      : ''
                  }
                >
                  <Minus className="w-4 h-4 mr-2" />
                  Remover
                </Button>
              </div>
            </div>

            <div>
              <Label>Quantidade de Pontos</Label>
              <Input
                type="number"
                value={pointsAdjustment.amount}
                onChange={(e) =>
                  setPointsAdjustment({
                    ...pointsAdjustment,
                    amount: parseInt(e.target.value) || 0,
                  })
                }
                placeholder="0"
              />
            </div>

            <div>
              <Label>Descrição/Motivo</Label>
              <Input
                value={pointsAdjustment.description}
                onChange={(e) =>
                  setPointsAdjustment({
                    ...pointsAdjustment,
                    description: e.target.value,
                  })
                }
                placeholder="Ex: Bônus de aniversário, Ajuste de sistema, etc."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPointsDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAdjustPoints} className="bg-orange-600 hover:bg-orange-700">
              Confirmar Ajuste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Detalhes */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Cliente</DialogTitle>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nome</Label>
                  <p className="font-medium">{selectedCustomer.name}</p>
                </div>
                <div>
                  <Label>Telefone</Label>
                  <p className="font-medium">{selectedCustomer.phone}</p>
                </div>
                {selectedCustomer.email && (
                  <div>
                    <Label>E-mail</Label>
                    <p className="font-medium">{selectedCustomer.email}</p>
                  </div>
                )}
                {selectedCustomer.document && (
                  <div>
                    <Label>CPF/CNPJ</Label>
                    <p className="font-medium">{selectedCustomer.document}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                      <p className="text-2xl font-bold">
                        {selectedCustomer.totalOrders}
                      </p>
                      <p className="text-sm text-gray-600">Pedidos</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <Star className="w-8 h-8 mx-auto mb-2 text-orange-600 fill-current" />
                      <p className="text-2xl font-bold">
                        {selectedCustomer.pointsBalance}
                      </p>
                      <p className="text-sm text-gray-600">Pontos</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <TrendingUp className="w-8 h-8 mx-auto mb-2 text-green-600" />
                      <p className="text-2xl font-bold">
                        R$ {selectedCustomer.totalSpent.toFixed(2)}
                      </p>
                      <p className="text-sm text-gray-600">Total Gasto</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div>
                <Label className="mb-2 block">Transações Recentes</Label>
                {selectedCustomer.recentTransactions.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedCustomer.recentTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium">{tx.description}</p>
                          <p className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(tx.createdAt), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p
                            className={
                              tx.amount >= 0
                                ? 'text-green-600 font-bold'
                                : 'text-red-600 font-bold'
                            }
                          >
                            {tx.amount >= 0 ? '+' : ''}
                            {tx.amount}
                          </p>
                          <p className="text-xs text-gray-500">
                            Saldo: {tx.balance}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Nenhuma transação ainda</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
