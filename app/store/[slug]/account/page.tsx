'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { 
  User, 
  ArrowLeft, 
  Loader2,
  Phone,
  Mail,
  MapPin,
  Star,
  Package,
  Edit,
  LogOut,
  ShoppingBag,
  CheckCircle2,
  Clock,
  XCircle,
  Flame,
  Gift,
  Award,
  Image as ImageIcon
} from 'lucide-react'
import { toast } from 'sonner'

interface ClientCustomer {
  id: string
  name: string
  phone: string
  email: string | null
  address: string | null
  pointsBalance: number
  pointsMultiplier: number
}

interface Order {
  id: string
  orderNumber: string
  totalAmount: number
  status: string
  paymentMethod: string
  createdAt: string
  items: {
    id: string
    quantity: number
    unitPrice: number
    Product: {
      name: string
      measurementUnit: string
    }
  }[]
}

interface Prize {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  pointsCost: number
  stockQuantity: number | null
  category: string | null
}

interface Redemption {
  id: string
  pointsUsed: number
  status: string
  requestedAt: string
  processedAt: string | null
  notes: string | null
  adminNotes: string | null
  Prize: {
    name: string
    description: string | null
    imageUrl: string | null
  }
}

export default function AccountPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [customer, setCustomer] = useState<ClientCustomer | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [prizes, setPrizes] = useState<Prize[]>([])
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingOrders, setIsLoadingOrders] = useState(false)
  const [isLoadingPrizes, setIsLoadingPrizes] = useState(false)
  const [isLoadingRedemptions, setIsLoadingRedemptions] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [redeemDialogOpen, setRedeemDialogOpen] = useState(false)
  const [selectedPrize, setSelectedPrize] = useState<Prize | null>(null)
  const [redeemNotes, setRedeemNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isRedeeming, setIsRedeeming] = useState(false)
  const [activeTab, setActiveTab] = useState('profile')

  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: ''
  })

  useEffect(() => {
    loadData()
  }, [slug])

  useEffect(() => {
    if (activeTab === 'prizes' && prizes.length === 0) {
      loadPrizes()
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'redemptions' && customer) {
      loadRedemptions(customer.id)
    }
  }, [activeTab, customer])

  const loadData = async () => {
    try {
      setIsLoading(true)

      // Verificar autenticação
      const authData = localStorage.getItem(`publicAuth_${slug}`)
      if (!authData) {
        toast.error('Faça login para continuar')
        router.push(`/store/${slug}/auth`)
        return
      }

      const customerData = JSON.parse(authData)
      setCustomer(customerData)

      // Preencher formulário de edição
      setEditForm({
        name: customerData.name || '',
        phone: customerData.phone || '',
        email: customerData.email || '',
        address: customerData.address || ''
      })

      // Carregar pedidos
      await loadOrders(customerData.id)

    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      toast.error('Erro ao carregar suas informações')
    } finally {
      setIsLoading(false)
    }
  }

  const loadOrders = async (customerId: string) => {
    try {
      setIsLoadingOrders(true)

      const response = await fetch(`/api/public/store/${slug}/orders?customerId=${customerId}`)
      
      if (!response.ok) {
        throw new Error('Erro ao carregar pedidos')
      }

      const data = await response.json()
      setOrders(data.orders || [])

    } catch (error) {
      console.error('Erro ao carregar pedidos:', error)
    } finally {
      setIsLoadingOrders(false)
    }
  }

  const loadPrizes = async () => {
    try {
      setIsLoadingPrizes(true)

      const response = await fetch(`/api/public/store/${slug}/prizes`)
      
      if (!response.ok) {
        throw new Error('Erro ao carregar prêmios')
      }

      const data = await response.json()
      setPrizes(data.prizes || [])

    } catch (error) {
      console.error('Erro ao carregar prêmios:', error)
    } finally {
      setIsLoadingPrizes(false)
    }
  }

  const loadRedemptions = async (customerId: string) => {
    try {
      setIsLoadingRedemptions(true)

      const response = await fetch(`/api/public/store/${slug}/prizes/redemptions?clientCustomerId=${customerId}`)
      
      if (!response.ok) {
        throw new Error('Erro ao carregar resgates')
      }

      const data = await response.json()
      setRedemptions(data.redemptions || [])

    } catch (error) {
      console.error('Erro ao carregar resgates:', error)
    } finally {
      setIsLoadingRedemptions(false)
    }
  }

  const handleOpenRedeemDialog = (prize: Prize) => {
    setSelectedPrize(prize)
    setRedeemNotes('')
    setRedeemDialogOpen(true)
  }

  const handleRedeemPrize = async () => {
    try {
      if (!customer || !selectedPrize) return

      if (customer.pointsBalance < selectedPrize.pointsCost) {
        toast.error('Você não tem pontos suficientes para resgatar este prêmio')
        return
      }

      setIsRedeeming(true)

      const response = await fetch(`/api/public/store/${slug}/prizes/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientCustomerId: customer.id,
          prizeId: selectedPrize.id,
          notes: redeemNotes || null
        })
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || 'Erro ao resgatar prêmio')
        return
      }

      toast.success('Prêmio resgatado com sucesso!')
      
      // Atualizar saldo de pontos
      const updatedCustomer = { ...customer, pointsBalance: data.newBalance }
      setCustomer(updatedCustomer)
      localStorage.setItem(`publicAuth_${slug}`, JSON.stringify(updatedCustomer))

      // Recarregar dados
      loadRedemptions(customer.id)
      loadPrizes()
      
      setRedeemDialogOpen(false)
      setSelectedPrize(null)

    } catch (error) {
      console.error('Erro ao resgatar prêmio:', error)
      toast.error('Erro ao resgatar prêmio')
    } finally {
      setIsRedeeming(false)
    }
  }

  const handleSaveProfile = async () => {
    try {
      if (!customer) return

      if (!editForm.name || !editForm.phone) {
        toast.error('Nome e telefone são obrigatórios')
        return
      }

      setIsSaving(true)

      const response = await fetch(`/api/public/store/${slug}/customer/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
          ...editForm
        })
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || 'Erro ao atualizar perfil')
        return
      }

      // Atualizar dados no localStorage e estado
      const updatedCustomer = { ...customer, ...editForm }
      localStorage.setItem(`publicAuth_${slug}`, JSON.stringify(updatedCustomer))
      setCustomer(updatedCustomer)

      toast.success('Perfil atualizado com sucesso!')
      setEditDialogOpen(false)

    } catch (error) {
      console.error('Erro ao salvar perfil:', error)
      toast.error('Erro ao atualizar perfil')
    } finally {
      setIsSaving(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem(`publicAuth_${slug}`)
    localStorage.removeItem(`publicCart_${slug}`)
    toast.success('Logout realizado com sucesso')
    router.push(`/store/${slug}`)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return 'Data inválida'
    }
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
      PENDING: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800', icon: <Clock className="w-3 h-3" /> },
      CONFIRMED: { label: 'Confirmado', color: 'bg-blue-100 text-blue-800', icon: <CheckCircle2 className="w-3 h-3" /> },
      PREPARING: { label: 'Preparando', color: 'bg-purple-100 text-purple-800', icon: <Package className="w-3 h-3" /> },
      READY: { label: 'Pronto', color: 'bg-green-100 text-green-800', icon: <CheckCircle2 className="w-3 h-3" /> },
      DELIVERING: { label: 'Saiu para entrega', color: 'bg-indigo-100 text-indigo-800', icon: <Package className="w-3 h-3" /> },
      DELIVERED: { label: 'Entregue', color: 'bg-green-500 text-white', icon: <CheckCircle2 className="w-3 h-3" /> },
      CANCELLED: { label: 'Cancelado', color: 'bg-red-100 text-red-800', icon: <XCircle className="w-3 h-3" /> }
    }

    const statusInfo = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800', icon: null }

    return (
      <Badge className={`${statusInfo.color} flex items-center gap-1`}>
        {statusInfo.icon}
        {statusInfo.label}
      </Badge>
    )
  }

  const getPaymentMethodLabel = (method: string) => {
    const methods: Record<string, string> = {
      PIX: 'PIX',
      CASH: 'Dinheiro',
      DEBIT_CARD: 'Cartão de Débito',
      CREDIT_CARD: 'Cartão de Crédito'
    }
    return methods[method] || method
  }

  const getRedemptionStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
      PENDING: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800', icon: <Clock className="w-3 h-3" /> },
      APPROVED: { label: 'Aprovado', color: 'bg-blue-100 text-blue-800', icon: <CheckCircle2 className="w-3 h-3" /> },
      DELIVERED: { label: 'Entregue', color: 'bg-green-500 text-white', icon: <CheckCircle2 className="w-3 h-3" /> },
      REJECTED: { label: 'Rejeitado', color: 'bg-red-100 text-red-800', icon: <XCircle className="w-3 h-3" /> }
    }

    const statusInfo = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800', icon: null }

    return (
      <Badge className={`${statusInfo.color} flex items-center gap-1`}>
        {statusInfo.icon}
        {statusInfo.label}
      </Badge>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-orange-600 mx-auto" />
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!customer) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            onClick={() => router.push(`/store/${slug}`)}
            variant="ghost"
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para a loja
          </Button>

          <Button
            onClick={handleLogout}
            variant="outline"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>

        {/* Título */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="bg-gradient-to-br from-orange-600 to-red-600 p-4 rounded-full">
              <Flame className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Minha Conta</h1>
          <p className="text-gray-600">Gerencie suas informações e pedidos</p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Perfil
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              Pedidos
            </TabsTrigger>
            <TabsTrigger value="prizes" className="flex items-center gap-2">
              <Gift className="w-4 h-4" />
              Prêmios
            </TabsTrigger>
          </TabsList>

          {/* Tab: Perfil */}
          <TabsContent value="profile" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Coluna da esquerda - Informações do Cliente */}
              <div className="lg:col-span-1 space-y-6">
            {/* Card de Perfil */}
            <Card className="border-2 border-orange-100">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <User className="w-5 h-5 text-orange-600" />
                    Meu Perfil
                  </span>
                  <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Editar Perfil</DialogTitle>
                        <DialogDescription>
                          Atualize suas informações pessoais
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-4">
                        <div>
                          <Label>Nome Completo *</Label>
                          <Input
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            placeholder="Seu nome completo"
                          />
                        </div>

                        <div>
                          <Label>Telefone *</Label>
                          <Input
                            value={editForm.phone}
                            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                            placeholder="(XX) XXXXX-XXXX"
                          />
                        </div>

                        <div>
                          <Label>E-mail</Label>
                          <Input
                            type="email"
                            value={editForm.email}
                            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                            placeholder="seu@email.com"
                          />
                        </div>

                        <div>
                          <Label>Endereço</Label>
                          <Input
                            value={editForm.address}
                            onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                            placeholder="Rua, número, bairro, cidade"
                          />
                        </div>

                        <div className="flex gap-2 pt-4">
                          <Button
                            onClick={() => setEditDialogOpen(false)}
                            variant="outline"
                            className="flex-1"
                            disabled={isSaving}
                          >
                            Cancelar
                          </Button>
                          <Button
                            onClick={handleSaveProfile}
                            className="flex-1 bg-orange-600 hover:bg-orange-700"
                            disabled={isSaving}
                          >
                            {isSaving ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Salvando...
                              </>
                            ) : (
                              'Salvar'
                            )}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <User className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500">Nome</p>
                      <p className="font-medium text-gray-900">{customer.name}</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500">Telefone</p>
                      <p className="font-medium text-gray-900">{customer.phone}</p>
                    </div>
                  </div>

                  {customer.email && (
                    <>
                      <Separator />
                      <div className="flex items-start gap-3">
                        <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-500">E-mail</p>
                          <p className="font-medium text-gray-900">{customer.email}</p>
                        </div>
                      </div>
                    </>
                  )}

                  {customer.address && (
                    <>
                      <Separator />
                      <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-500">Endereço</p>
                          <p className="font-medium text-gray-900">{customer.address}</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Card de Pontos (se houver) */}
            {customer.pointsBalance > 0 && (
              <Card className="border-2 border-orange-100 bg-gradient-to-br from-orange-50 to-red-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-orange-700">
                    <Star className="w-5 h-5 fill-current" />
                    Meus Pontos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center space-y-2">
                    <div className="text-4xl font-bold text-orange-600">
                      {customer.pointsBalance.toLocaleString('pt-BR')}
                    </div>
                    <p className="text-sm text-gray-600">pontos disponíveis</p>
                    {customer.pointsMultiplier > 1 && (
                      <Badge className="bg-orange-600 text-white">
                        Multiplicador {customer.pointsMultiplier}x
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

              {/* Coluna da direita - Info Rápida */}
              <div className="lg:col-span-2">
                <Card className="border-2 border-orange-100">
                  <CardHeader>
                    <CardTitle>Bem-vindo de volta!</CardTitle>
                    <CardDescription>
                      Aqui você pode gerenciar suas informações, ver seus pedidos e resgatar prêmios
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-orange-50 rounded-lg">
                        <p className="text-sm text-gray-600">Pontos Disponíveis</p>
                        <p className="text-2xl font-bold text-orange-600">{customer.pointsBalance.toLocaleString('pt-BR')}</p>
                      </div>
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <p className="text-sm text-gray-600">Pedidos Realizados</p>
                        <p className="text-2xl font-bold text-blue-600">{orders.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Tab: Pedidos */}
          <TabsContent value="orders">
            <Card className="border-2 border-orange-100">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-orange-600" />
                  Meus Pedidos
                </CardTitle>
                <CardDescription>
                  Histórico de todos os seus pedidos
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingOrders ? (
                  <div className="text-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-orange-600 mx-auto mb-2" />
                    <p className="text-gray-600">Carregando pedidos...</p>
                  </div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-12 space-y-4">
                    <Package className="w-16 h-16 text-gray-300 mx-auto" />
                    <div>
                      <p className="text-gray-600 font-medium">Nenhum pedido ainda</p>
                      <p className="text-sm text-gray-500">Faça seu primeiro pedido agora!</p>
                    </div>
                    <Button
                      onClick={() => router.push(`/store/${slug}`)}
                      className="bg-orange-600 hover:bg-orange-700"
                    >
                      <ShoppingBag className="w-4 h-4 mr-2" />
                      Ver Produtos
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => (
                      <Card key={order.id} className="border-l-4 border-l-orange-500">
                        <CardContent className="p-4">
                          <div className="space-y-4">
                            {/* Cabeçalho do Pedido */}
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <p className="font-bold text-gray-900">#{order.orderNumber}</p>
                                <p className="text-xs text-gray-500">{formatDate(order.createdAt)}</p>
                              </div>
                              <div className="text-right space-y-2">
                                {getStatusBadge(order.status)}
                                <p className="text-sm text-gray-600">
                                  {getPaymentMethodLabel(order.paymentMethod)}
                                </p>
                              </div>
                            </div>

                            <Separator />

                            {/* Itens do Pedido */}
                            <div className="space-y-2">
                              {order.items.map((item) => (
                                <div key={item.id} className="flex items-center justify-between text-sm">
                                  <div className="flex-1">
                                    <p className="font-medium text-gray-900">{item.Product.name}</p>
                                    <p className="text-xs text-gray-500">
                                      {item.quantity} {item.Product.measurementUnit} × {formatCurrency(item.unitPrice)}
                                    </p>
                                  </div>
                                  <p className="font-medium text-gray-900">
                                    {formatCurrency(item.quantity * item.unitPrice)}
                                  </p>
                                </div>
                              ))}
                            </div>

                            <Separator />

                            {/* Total do Pedido */}
                            <div className="flex items-center justify-between">
                              <p className="font-bold text-gray-900">Total</p>
                              <p className="text-xl font-bold text-orange-600">
                                {formatCurrency(order.totalAmount)}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Prêmios */}
          <TabsContent value="prizes" className="space-y-6">
            {/* Card de Pontos */}
            <Card className="border-2 border-orange-100 bg-gradient-to-br from-orange-50 to-red-50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Seus Pontos</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Star className="w-6 h-6 text-orange-600 fill-current" />
                      <span className="text-4xl font-bold text-orange-600">
                        {customer.pointsBalance.toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>
                  <Award className="w-16 h-16 text-orange-300" />
                </div>
              </CardContent>
            </Card>

            {/* Prêmios Disponíveis */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">Prêmios Disponíveis</h2>

              {isLoadingPrizes ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-orange-600 mx-auto mb-2" />
                  <p className="text-gray-600">Carregando prêmios...</p>
                </div>
              ) : prizes.length === 0 ? (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center space-y-4">
                      <Gift className="w-16 h-16 text-gray-300 mx-auto" />
                      <div>
                        <p className="text-gray-600 font-medium">Nenhum prêmio disponível no momento</p>
                        <p className="text-sm text-gray-500">Continue acumulando pontos!</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {prizes.map((prize) => (
                    <Card key={prize.id} className="border-2 border-orange-100 hover:shadow-lg transition-shadow">
                      <CardContent className="p-4 space-y-4">
                        {/* Imagem */}
                        {prize.imageUrl ? (
                          <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
                            <Image
                              src={prize.imageUrl}
                              alt={prize.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="aspect-video bg-gradient-to-br from-orange-100 to-red-100 rounded-lg flex items-center justify-center">
                            <ImageIcon className="w-12 h-12 text-orange-400" />
                          </div>
                        )}

                        {/* Informações */}
                        <div className="space-y-2">
                          <h3 className="font-bold text-gray-900 line-clamp-2">{prize.name}</h3>

                          {prize.description && (
                            <p className="text-sm text-gray-600 line-clamp-2">{prize.description}</p>
                          )}

                          {prize.category && (
                            <Badge variant="outline" className="text-xs">{prize.category}</Badge>
                          )}

                          <div className="flex items-center justify-between pt-2 border-t">
                            <div className="flex items-center gap-1 text-orange-600">
                              <Star className="w-5 h-5 fill-current" />
                              <span className="font-bold text-lg">{prize.pointsCost}</span>
                              <span className="text-xs">pontos</span>
                            </div>
                            {prize.stockQuantity !== null && (
                              <div className="text-sm text-gray-600">
                                {prize.stockQuantity} disponíveis
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Botão de Resgate */}
                        <Button
                          onClick={() => handleOpenRedeemDialog(prize)}
                          className="w-full bg-orange-600 hover:bg-orange-700"
                          disabled={customer.pointsBalance < prize.pointsCost || (prize.stockQuantity !== null && prize.stockQuantity <= 0)}
                        >
                          {customer.pointsBalance < prize.pointsCost ? (
                            'Pontos Insuficientes'
                          ) : prize.stockQuantity !== null && prize.stockQuantity <= 0 ? (
                            'Esgotado'
                          ) : (
                            <>
                              <Gift className="w-4 h-4 mr-2" />
                              Resgatar
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Meus Resgates */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">Meus Resgates</h2>

              {isLoadingRedemptions ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-orange-600 mx-auto mb-2" />
                  <p className="text-gray-600">Carregando resgates...</p>
                </div>
              ) : redemptions.length === 0 ? (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center space-y-4">
                      <Package className="w-16 h-16 text-gray-300 mx-auto" />
                      <div>
                        <p className="text-gray-600 font-medium">Nenhum resgate ainda</p>
                        <p className="text-sm text-gray-500">Troque seus pontos por prêmios!</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {redemptions.map((redemption) => (
                    <Card key={redemption.id} className="border-l-4 border-l-orange-500">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          {/* Imagem */}
                          {redemption.Prize.imageUrl ? (
                            <div className="relative w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                              <Image
                                src={redemption.Prize.imageUrl}
                                alt={redemption.Prize.name}
                                fill
                                className="object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-20 h-20 bg-gradient-to-br from-orange-100 to-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                              <ImageIcon className="w-8 h-8 text-orange-400" />
                            </div>
                          )}

                          {/* Informações */}
                          <div className="flex-1 space-y-2">
                            <div>
                              <h3 className="font-bold text-gray-900">{redemption.Prize.name}</h3>
                              {redemption.Prize.description && (
                                <p className="text-sm text-gray-600 line-clamp-1">{redemption.Prize.description}</p>
                              )}
                            </div>

                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-1 text-sm text-gray-600">
                                <Star className="w-4 h-4 text-orange-600 fill-current" />
                                <span className="font-medium">{redemption.pointsUsed} pontos</span>
                              </div>
                              <div className="text-xs text-gray-500">
                                {formatDate(redemption.requestedAt)}
                              </div>
                            </div>

                            {redemption.notes && (
                              <p className="text-xs text-gray-600 italic">
                                Observação: {redemption.notes}
                              </p>
                            )}

                            {redemption.adminNotes && (
                              <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                                <p className="font-medium">Resposta do estabelecimento:</p>
                                <p>{redemption.adminNotes}</p>
                              </div>
                            )}
                          </div>

                          {/* Status */}
                          <div className="flex-shrink-0">
                            {getRedemptionStatusBadge(redemption.status)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Diálogo de Resgate */}
        <Dialog open={redeemDialogOpen} onOpenChange={setRedeemDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Resgatar Prêmio</DialogTitle>
              <DialogDescription>
                Confirme o resgate do prêmio abaixo
              </DialogDescription>
            </DialogHeader>

            {selectedPrize && (
              <div className="space-y-4">
                {/* Prêmio Selecionado */}
                <div className="p-4 bg-orange-50 rounded-lg space-y-2">
                  <h3 className="font-bold text-gray-900">{selectedPrize.name}</h3>
                  {selectedPrize.description && (
                    <p className="text-sm text-gray-600">{selectedPrize.description}</p>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-orange-200">
                    <span className="text-sm text-gray-600">Custo:</span>
                    <div className="flex items-center gap-1 text-orange-600">
                      <Star className="w-5 h-5 fill-current" />
                      <span className="font-bold text-lg">{selectedPrize.pointsCost}</span>
                      <span className="text-xs">pontos</span>
                    </div>
                  </div>
                </div>

                {/* Saldo Atual e Após Resgate */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">Saldo Atual</p>
                    <p className="text-xl font-bold text-gray-900">{customer.pointsBalance}</p>
                  </div>
                  <div className="p-3 bg-orange-50 rounded-lg">
                    <p className="text-xs text-gray-500">Saldo Após Resgate</p>
                    <p className="text-xl font-bold text-orange-600">
                      {customer.pointsBalance - selectedPrize.pointsCost}
                    </p>
                  </div>
                </div>

                {/* Observações */}
                <div>
                  <Label>Observações (opcional)</Label>
                  <Textarea
                    value={redeemNotes}
                    onChange={(e) => setRedeemNotes(e.target.value)}
                    placeholder="Alguma observação sobre o resgate?"
                    rows={3}
                  />
                </div>

                {/* Botões */}
                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={() => setRedeemDialogOpen(false)}
                    variant="outline"
                    className="flex-1"
                    disabled={isRedeeming}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleRedeemPrize}
                    className="flex-1 bg-orange-600 hover:bg-orange-700"
                    disabled={isRedeeming}
                  >
                    {isRedeeming ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Resgatando...
                      </>
                    ) : (
                      'Confirmar Resgate'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
