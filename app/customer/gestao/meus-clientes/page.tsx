'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Users, 
  TrendingUp, 
  Award, 
  Plus, 
  Minus, 
  History, 
  Search,
  Home,
  ArrowLeft,
  Star,
  ShoppingBag
} from 'lucide-react'
import toast from 'react-hot-toast'

interface ClientCustomer {
  id: string
  name: string
  email: string | null
  phone: string | null
  pointsBalance: number
  totalPointsEarned: number
  pointsMultiplier: number
  createdAt: string
  _count: {
    ClientCustomerOrders: number
    ClientCustomerPointTransactions: number
  }
}

interface PointTransaction {
  id: string
  amount: number
  balance: number
  type: string
  description: string
  createdAt: string
}

export default function MeusClientesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [customers, setCustomers] = useState<ClientCustomer[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<ClientCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<ClientCustomer | null>(null)
  const [showAdjustDialog, setShowAdjustDialog] = useState(false)
  const [showHistoryDialog, setShowHistoryDialog] = useState(false)
  const [pointHistory, setPointHistory] = useState<PointTransaction[]>([])
  const [adjustmentType, setAdjustmentType] = useState<'ADD' | 'SUBTRACT'>('ADD')
  const [pointsAmount, setPointsAmount] = useState('')
  const [reason, setReason] = useState('')
  const [processing, setProcessing] = useState(false)
  const [storeSlug, setStoreSlug] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }

    if (status === 'authenticated' && session?.user?.userType !== 'CUSTOMER') {
      router.push('/')
      return
    }

    if (session?.user?.userType === 'CUSTOMER') {
      loadCustomers()
    }
  }, [session, status, router])

  useEffect(() => {
    if (searchTerm) {
      const filtered = customers.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone?.includes(searchTerm)
      )
      setFilteredCustomers(filtered)
    } else {
      setFilteredCustomers(customers)
    }
  }, [searchTerm, customers])

  const loadCustomers = async () => {
    try {
      setLoading(true)
      
      // Primeiro, buscar o slug da loja do cliente
      const customerResponse = await fetch('/api/customer/profile')
      const customerData = await customerResponse.json()
      
      if (!customerData.storeSlug) {
        toast.error('Sua loja ainda não tem um link público configurado')
        return
      }

      setStoreSlug(customerData.storeSlug)

      // Buscar clientes finais
      const response = await fetch(`/api/public/store/${customerData.storeSlug}/customers`)
      const data = await response.json()

      if (response.ok) {
        setCustomers(data.customers)
        setFilteredCustomers(data.customers)
      } else {
        toast.error(data.error || 'Erro ao carregar clientes')
      }
    } catch (error) {
      console.error('Error loading customers:', error)
      toast.error('Erro ao carregar clientes')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenAdjustDialog = (customer: ClientCustomer) => {
    setSelectedCustomer(customer)
    setShowAdjustDialog(true)
    setPointsAmount('')
    setReason('')
    setAdjustmentType('ADD')
  }

  const handleAdjustPoints = async () => {
    if (!selectedCustomer || !pointsAmount || !reason) {
      toast.error('Preencha todos os campos')
      return
    }

    try {
      setProcessing(true)
      const response = await fetch(
        `/api/public/store/${storeSlug}/customers/${selectedCustomer.id}/points`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            points: parseInt(pointsAmount),
            reason,
            type: adjustmentType
          })
        }
      )

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message)
        setShowAdjustDialog(false)
        loadCustomers() // Recarregar lista
      } else {
        toast.error(data.error || 'Erro ao ajustar pontos')
      }
    } catch (error) {
      console.error('Error adjusting points:', error)
      toast.error('Erro ao ajustar pontos')
    } finally {
      setProcessing(false)
    }
  }

  const handleViewHistory = async (customer: ClientCustomer) => {
    try {
      setSelectedCustomer(customer)
      setShowHistoryDialog(true)
      setPointHistory([])

      const response = await fetch(
        `/api/public/store/${storeSlug}/customers/${customer.id}/points`
      )
      const data = await response.json()

      if (response.ok) {
        setPointHistory(data.transactions)
      } else {
        toast.error('Erro ao carregar histórico')
      }
    } catch (error) {
      console.error('Error loading history:', error)
      toast.error('Erro ao carregar histórico')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getTransactionTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      'PURCHASE': 'Compra',
      'MANUAL_ADD': 'Adicionado Manualmente',
      'MANUAL_SUBTRACT': 'Removido Manualmente',
      'REDEMPTION': 'Resgate',
      'BONUS': 'Bônus'
    }
    return types[type] || type
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando clientes...</p>
        </div>
      </div>
    )
  }

  const totalCustomers = customers.length
  const totalPoints = customers.reduce((sum, c) => sum + c.pointsBalance, 0)
  const avgPoints = totalCustomers > 0 ? Math.round(totalPoints / totalCustomers) : 0

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Meus Clientes</h1>
            <p className="text-gray-600">Gerencie seus clientes e seus pontos de fidelidade</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => window.location.href = '/customer/gestao'}
              variant="outline"
              size="sm"
            >
              <Home className="h-4 w-4 mr-2" />
              Página Inicial
            </Button>
            <Button
              onClick={() => window.history.back()}
              variant="outline"
              size="sm"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </div>
        </div>

        {/* Link da Loja Pública */}
        {storeSlug && (
          <Card className="mb-6 border-2 border-orange-500 bg-gradient-to-r from-orange-50 to-orange-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-900">
                <ShoppingBag className="h-5 w-5" />
                Link da Sua Loja Online
              </CardTitle>
              <CardDescription className="text-orange-800">
                Compartilhe este link com seus clientes para que eles possam fazer pedidos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 p-3 bg-white rounded-lg border border-orange-200">
                <input
                  type="text"
                  value={`${window.location.origin}/loja/${storeSlug}`}
                  readOnly
                  className="flex-1 bg-transparent border-none focus:outline-none text-gray-700 font-mono text-sm"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/loja/${storeSlug}`)
                    toast.success('Link copiado!')
                  }}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  Copiar Link
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCustomers}</div>
              <p className="text-xs text-muted-foreground">Clientes cadastrados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pontos Totais</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalPoints.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Em todas as contas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Média de Pontos</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgPoints.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Por cliente</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Buscar por nome, email ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Customer List */}
        {filteredCustomers.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">
                {searchTerm ? 'Nenhum cliente encontrado com esse filtro' : 'Você ainda não tem clientes cadastrados'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCustomers.map((customer) => (
              <Card key={customer.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{customer.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {customer.email || customer.phone || 'Sem contato'}
                      </CardDescription>
                    </div>
                    {customer.pointsMultiplier > 1 && (
                      <Badge variant="secondary" className="ml-2">
                        <Star className="h-3 w-3 mr-1" />
                        x{customer.pointsMultiplier}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Points Info */}
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between bg-orange-50 p-3 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Award className="h-5 w-5 text-orange-600" />
                        <span className="font-medium">Saldo</span>
                      </div>
                      <span className="text-lg font-bold text-orange-600">
                        {customer.pointsBalance.toLocaleString()} pts
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-gray-50 p-2 rounded">
                        <div className="text-gray-600">Total Ganho</div>
                        <div className="font-semibold">{customer.totalPointsEarned.toLocaleString()}</div>
                      </div>
                      <div className="bg-gray-50 p-2 rounded">
                        <div className="text-gray-600">Pedidos</div>
                        <div className="font-semibold flex items-center gap-1">
                          <ShoppingBag className="h-3 w-3" />
                          {customer._count.ClientCustomerOrders}
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-gray-500">
                      Cliente desde {formatDate(customer.createdAt).split(' ')[0]}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleOpenAdjustDialog(customer)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Ajustar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewHistory(customer)}
                    >
                      <History className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Adjust Points Dialog */}
      <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar Pontos</DialogTitle>
            <DialogDescription>
              Cliente: {selectedCustomer?.name}
              <br />
              Saldo Atual: <strong>{selectedCustomer?.pointsBalance.toLocaleString()} pontos</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Tipo de Ajuste</Label>
              <Select
                value={adjustmentType}
                onValueChange={(value) => setAdjustmentType(value as 'ADD' | 'SUBTRACT')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADD">
                    <span className="flex items-center gap-2">
                      <Plus className="h-4 w-4 text-green-600" />
                      Adicionar Pontos
                    </span>
                  </SelectItem>
                  <SelectItem value="SUBTRACT">
                    <span className="flex items-center gap-2">
                      <Minus className="h-4 w-4 text-red-600" />
                      Remover Pontos
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Quantidade de Pontos</Label>
              <Input
                type="number"
                placeholder="Ex: 1000"
                value={pointsAmount}
                onChange={(e) => setPointsAmount(e.target.value)}
                min="1"
              />
            </div>

            <div>
              <Label>Motivo</Label>
              <Input
                placeholder="Ex: Bônus especial, Ajuste de sistema, etc."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAdjustDialog(false)}
              disabled={processing}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAdjustPoints}
              disabled={processing || !pointsAmount || !reason}
              className={adjustmentType === 'ADD' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {processing ? 'Processando...' : adjustmentType === 'ADD' ? 'Adicionar' : 'Remover'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico de Pontos</DialogTitle>
            <DialogDescription>
              Cliente: {selectedCustomer?.name}
              <br />
              Saldo Atual: <strong>{selectedCustomer?.pointsBalance.toLocaleString()} pontos</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {pointHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <History className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                <p>Nenhuma transação encontrada</p>
              </div>
            ) : (
              pointHistory.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-start justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium">{getTransactionTypeLabel(transaction.type)}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      {transaction.description}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatDate(transaction.createdAt)}
                    </div>
                  </div>
                  <div className="ml-4">
                    <span
                      className={`text-lg font-bold ${
                        transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {transaction.amount > 0 ? '+' : ''}{transaction.amount.toLocaleString()}
                    </span>
                    <div className="text-xs text-gray-500 text-right">pts</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
