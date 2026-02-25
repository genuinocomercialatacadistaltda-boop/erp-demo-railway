
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Flame, ArrowLeft, ShoppingCart, Search, Eye, MapPin, Phone, Calendar, CreditCard, Edit2, Plus, Minus, Trash2, PlusCircle, Receipt, Home, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { HomeButton } from '@/components/home-button'

interface BankAccount {
  id: string
  name: string
  bankName: string | null
  isActive: boolean
}

interface Order {
  id: string
  orderNumber: string
  orderType: string
  deliveryType: string
  customerName: string
  casualCustomerName?: string | null // 🆕 Nome do cliente avulso
  customerPhone: string | null
  customerEmail: string | null
  address: string | null
  city: string | null
  deliveryDate: string | null
  deliveryTime: string | null
  paymentMethod: string
  status: string
  paymentStatus: string // 🆕 Status de pagamento
  subtotal: number
  discount: number
  couponDiscount?: number
  discountPercent?: number
  total: number
  createdAt: string
  sellerId: string | null
  userId: string | null
  createdByUserId?: string | null
  createdByRole?: string | null
  customer: any
  User: any
  Seller: { id: string; name: string } | null
  coupon?: {
    id: string
    code: string
    description: string | null
    discountType: string
    discountValue: number
  } | null
  orderItems: Array<{
    id: string
    quantity: number
    unitPrice: number
    total: number
    product: any
  }>
  boletos?: Array<{
    id: string
    boletoNumber: string
    amount: number
    dueDate: string
    status: string
    isInstallment: boolean
    installmentNumber: number | null
    totalInstallments: number | null
  }>
}

interface OrdersManagementProps {
  orders: Order[]
}

export function OrdersManagement({ orders: initialOrders }: OrdersManagementProps) {
  const router = useRouter()
  const [orders, setOrders] = useState(initialOrders)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editItems, setEditItems] = useState<any[]>([])
  const [orderDate, setOrderDate] = useState<string>('') // 🆕 Data do pedido para edição
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // 🆕 Estados para seleção de conta bancária
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [showBankAccountDialog, setShowBankAccountDialog] = useState(false)
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('')
  const [orderIdForPayment, setOrderIdForPayment] = useState<string>('')
  
  // 🔥 Paginação no Frontend - Exibe 50 por vez, mas permite carregar mais
  const [displayLimit, setDisplayLimit] = useState(50)

  // 🔥 Reset do limite quando a busca ou filtro muda
  useEffect(() => {
    setDisplayLimit(50)
  }, [searchTerm, statusFilter])

  // 🔥 Função para refazer fetch dos pedidos (SEM LIMITE - histórico completo)
  const refetchOrders = async () => {
    try {
      console.log('🔄 Refazendo fetch dos pedidos (histórico completo)...')
      const response = await fetch('/api/orders') // 🔥 SEM limit, carrega TODOS os pedidos
      if (response.ok) {
        const data = await response.json()
        // 🆕 A resposta agora tem { orders, pagination }
        const ordersData = data.orders || data
        setOrders(ordersData)
        console.log(`✅ ${ordersData.length} pedidos atualizados do histórico completo`)
        if (data.pagination) {
          console.log(`📊 Total de pedidos: ${data.pagination.total}`)
        }
      }
    } catch (error) {
      console.error('❌ Erro ao refazer fetch dos pedidos:', error)
      toast.error('Erro ao carregar pedidos')
    }
  }

  // Carregar contas bancárias
  useEffect(() => {
    const loadBankAccounts = async () => {
      try {
        console.log('🔍 Carregando contas bancárias...')
        const response = await fetch('/api/financial/bank-accounts')
        if (response.ok) {
          const data = await response.json()
          console.log('📦 Dados recebidos da API:', data)
          // A API retorna { accounts: [...] }
          const accountsList = data.accounts || []
          console.log('✅ Contas bancárias carregadas:', accountsList.length)
          setBankAccounts(accountsList.filter((acc: BankAccount) => acc.isActive))
        } else {
          console.error('❌ Erro na resposta da API:', response.status)
        }
      } catch (error) {
        console.error('❌ Erro ao carregar contas bancárias:', error)
      }
    }
    
    loadBankAccounts()
  }, [])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      CONFIRMED: 'bg-blue-100 text-blue-800',
      PREPARING: 'bg-orange-100 text-orange-800',
      READY: 'bg-green-100 text-green-800',
      DELIVERING: 'bg-purple-100 text-purple-800',
      DELIVERED: 'bg-emerald-100 text-emerald-800',
      CANCELLED: 'bg-red-100 text-red-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getStatusText = (status: string) => {
    const text: Record<string, string> = {
      PENDING: 'Pendente',
      CONFIRMED: 'Confirmado',
      PREPARING: 'Preparando',
      READY: 'Pronto',
      DELIVERING: 'Entregando',
      DELIVERED: 'Entregue',
      CANCELLED: 'Cancelado'
    }
    return text[status] || status
  }

  const getPaymentMethodText = (method: string) => {
    const text: Record<string, string> = {
      CASH: 'Dinheiro',
      CARD: 'Cartão',
      PIX: 'PIX',
      BOLETO: 'Boleto'
    }
    return text[method] || method
  }

  const getPaymentStatusText = (status: string) => {
    const text: Record<string, string> = {
      UNPAID: 'Não Pago',
      PARTIAL: 'Parcial',
      PAID: 'Pago'
    }
    return text[status] || status
  }

  const getPaymentStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      UNPAID: 'bg-red-100 text-red-800',
      PARTIAL: 'bg-yellow-100 text-yellow-800',
      PAID: 'bg-green-100 text-green-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getOrderCreatorInfo = (order: Order) => {
    // Usa o novo campo createdByRole para identificar quem criou
    if (order.createdByRole === 'ADMIN' && order.User) {
      return {
        type: `Admin ${order.User.name}`,
        color: 'bg-purple-100 text-purple-800'
      }
    }
    if (order.createdByRole === 'SELLER' && order.Seller) {
      return {
        type: `Vendedor ${order.Seller.name}`,
        color: 'bg-blue-100 text-blue-800'
      }
    }
    if (order.createdByRole === 'RETAIL') {
      return {
        type: 'Cliente Varejo',
        color: 'bg-orange-100 text-orange-800'
      }
    }
    if (order.createdByRole === 'CUSTOMER') {
      return {
        type: 'Cliente Cadastrado',
        color: 'bg-green-100 text-green-800'
      }
    }
    
    // Fallback para pedidos antigos sem o novo campo
    if (order.sellerId && order.Seller) {
      return {
        type: `Vendedor ${order.Seller.name}`,
        color: 'bg-blue-100 text-blue-800'
      }
    }
    if (order.userId && order.User) {
      return {
        type: `Admin ${order.User.name}`,
        color: 'bg-purple-100 text-purple-800'
      }
    }
    
    return {
      type: 'Cliente',
      color: 'bg-green-100 text-green-800'
    }
  }

  // 🔥 Filtrar pedidos com busca e status
  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.casualCustomerName && order.casualCustomerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.customerPhone && order.customerPhone.includes(searchTerm))
    
    const matchesStatus = statusFilter === 'ALL' || order.status === statusFilter

    return matchesSearch && matchesStatus
  })

  // 🔥 Aplicar limite de exibição (paginação no frontend)
  const displayedOrders = filteredOrders.slice(0, displayLimit)
  const hasMoreOrders = filteredOrders.length > displayLimit

  const handleStatusChange = async (orderId: string, newStatus: string, paymentStatus?: string) => {
    console.log(`🔄 [STATUS CHANGE] Atualizando pedido ${orderId}:`, { status: newStatus, paymentStatus })
    
    // Atualização otimista da UI
    const previousOrders = [...orders]
    const updateData: any = { status: newStatus }
    if (paymentStatus) {
      updateData.paymentStatus = paymentStatus
    }
    
    setOrders(orders.map(o => 
      o.id === orderId ? { ...o, ...updateData } : o
    ))

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('❌ [STATUS CHANGE] Erro na resposta:', errorData)
        throw new Error(errorData.error || 'Erro ao atualizar status')
      }

      const updatedOrder = await response.json()
      console.log('✅ [STATUS CHANGE] Pedido atualizado com sucesso:', updatedOrder)

      // Atualizar o pedido específico com os dados completos da API
      setOrders(orders.map(o => 
        o.id === orderId ? { ...o, ...updatedOrder } : o
      ))

      const message = paymentStatus 
        ? `Status: "${getStatusText(newStatus)}" | Pagamento: "${getPaymentStatusText(paymentStatus)}"`
        : `Status atualizado para "${getStatusText(newStatus)}"!`
      
      toast.success(message)
      
      // ✅ Não é necessário router.refresh() - o estado já foi atualizado otimisticamente e depois confirmado pela API
      // router.refresh() pode causar erros de client-side durante a re-renderização
    } catch (error: any) {
      console.error('❌ [STATUS CHANGE] Erro ao atualizar status:', error)
      
      // Reverter para o estado anterior em caso de erro
      setOrders(previousOrders)
      
      toast.error(error.message || 'Erro ao atualizar status. Tente novamente.')
    }
  }

  const handlePaymentStatusChange = async (orderId: string, newPaymentStatus: string) => {
    console.log(`💰 [PAYMENT STATUS CHANGE] Atualizando pagamento do pedido ${orderId} para ${newPaymentStatus}`)
    
    // Se marcou como PAGO, abrir modal de seleção de conta bancária
    if (newPaymentStatus === 'PAID') {
      setOrderIdForPayment(orderId)
      setSelectedBankAccountId('')
      setShowBankAccountDialog(true)
      return
    }
    
    // Se marcou como NÃO PAGO, atualizar diretamente
    const previousOrders = [...orders]
    setOrders(orders.map(o => 
      o.id === orderId ? { ...o, paymentStatus: newPaymentStatus } : o
    ))

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus: newPaymentStatus, status: 'DELIVERED' })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('❌ [PAYMENT STATUS] Erro na resposta:', errorData)
        throw new Error(errorData.error || 'Erro ao atualizar pagamento')
      }

      const updatedOrder = await response.json()
      console.log('✅ [PAYMENT STATUS] Pagamento atualizado com sucesso:', updatedOrder)

      toast.success('Pagamento marcado como não pago')
      
      // Refetch completo dos pedidos para garantir sincronização
      await refetchOrders()
    } catch (error: any) {
      console.error('❌ [PAYMENT STATUS] Erro:', error)
      setOrders(previousOrders)
      toast.error(error.message || 'Erro ao atualizar pagamento.')
    }
  }

  // 🆕 Confirmar pagamento com conta bancária selecionada
  const handleConfirmPayment = async () => {
    if (!selectedBankAccountId) {
      toast.error('Por favor, selecione uma conta bancária')
      return
    }

    const previousOrders = [...orders]
    setOrders(orders.map(o => 
      o.id === orderIdForPayment ? { ...o, paymentStatus: 'PAID' } : o
    ))

    try {
      const response = await fetch(`/api/orders/${orderIdForPayment}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          paymentStatus: 'PAID', 
          status: 'DELIVERED',
          bankAccountId: selectedBankAccountId 
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('❌ [PAYMENT] Erro na resposta:', errorData)
        throw new Error(errorData.error || 'Erro ao confirmar pagamento')
      }

      const updatedOrder = await response.json()
      console.log('✅ [PAYMENT] Pagamento confirmado com sucesso:', updatedOrder)

      const bankAccount = bankAccounts.find(acc => acc.id === selectedBankAccountId)
      toast.success(`Pagamento confirmado! Conta: ${bankAccount?.name || 'N/A'}`)
      
      setShowBankAccountDialog(false)
      setSelectedBankAccountId('')
      setOrderIdForPayment('')
      
      // Refetch completo dos pedidos para garantir sincronização
      await refetchOrders()
    } catch (error: any) {
      console.error('❌ [PAYMENT] Erro ao confirmar pagamento:', error)
      setOrders(previousOrders)
      toast.error(error.message || 'Erro ao confirmar pagamento')
    }
  }

  const handleViewDetails = (order: Order) => {
    setSelectedOrder(order)
    setIsDialogOpen(true)
  }

  const handleEditOrder = (order: Order) => {
    setSelectedOrder(order)
    setEditItems(JSON.parse(JSON.stringify(order.orderItems))) // Deep copy
    // 🆕 Setar a data do pedido no formato YYYY-MM-DD para o input de data
    const orderDateStr = new Date(order.createdAt).toISOString().split('T')[0]
    setOrderDate(orderDateStr)
    setIsEditDialogOpen(true)
  }

  const updateEditItemQuantity = (index: number, quantity: number) => {
    if (quantity < 1) return
    const newItems = [...editItems]
    newItems[index].quantity = quantity
    newItems[index].total = quantity * newItems[index].unitPrice
    setEditItems(newItems)
  }

  const updateEditItemPrice = (index: number, price: number) => {
    if (price < 0) return
    const newItems = [...editItems]
    newItems[index].unitPrice = price
    newItems[index].total = price * newItems[index].quantity
    setEditItems(newItems)
  }

  const removeEditItem = (index: number) => {
    if (editItems.length <= 1) {
      toast.error('O pedido precisa ter pelo menos um item')
      return
    }
    setEditItems(editItems.filter((_, i) => i !== index))
  }

  const handleSaveEdit = async () => {
    if (!selectedOrder) return

    if (editItems.length === 0) {
      toast.error('O pedido precisa ter pelo menos um item')
      return
    }

    // 🆕 Validar se a data foi preenchida
    if (!orderDate) {
      toast.error('Por favor, selecione a data do pedido')
      return
    }

    setIsSubmitting(true)

    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}/items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: editItems.map(item => ({
            productId: item.ProductId,
            quantity: item.quantity,
            unitPrice: item.unitPrice
          })),
          orderDate: orderDate // 🆕 Incluir a data do pedido
        })
      })

      if (!res.ok) {
        throw new Error('Erro ao atualizar pedido')
      }

      toast.success('Pedido atualizado com sucesso!')
      setIsEditDialogOpen(false)
      
      // ✅ Re-fetch orders para atualizar a lista com os dados mais recentes
      refetchOrders()
    } catch (error) {
      console.error('Error updating order:', error)
      toast.error('Erro ao atualizar pedido')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteOrder = async (orderId: string, orderNumber: string) => {
    if (!confirm(`Tem certeza que deseja EXCLUIR PERMANENTEMENTE o pedido ${orderNumber}?\n\nEsta ação não pode ser desfeita!`)) {
      return
    }

    setIsSubmitting(true)

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Erro ao excluir pedido')
      }

      toast.success('Pedido excluído com sucesso!')
      
      // Remove from state
      setOrders(orders.filter(o => o.id !== orderId))
      
      // Notifica outras páginas sobre a exclusão crítica (para atualização de estoque)
      localStorage.setItem('stock_critical_update', Date.now().toString())
      
      // ✅ Não é necessário router.refresh() - o estado já foi atualizado com setOrders()
    } catch (error: any) {
      console.error('Error deleting order:', error)
      toast.error(error.message || 'Erro ao excluir pedido')
    } finally {
      setIsSubmitting(false)
    }
  }

  const calculateEditTotal = () => {
    return editItems.reduce((sum, item) => sum + item.total, 0)
  }

  const handlePrintReceipt = (orderId: string) => {
    // Open receipt in new window for printing
    window.open(`/api/orders/${orderId}/receipt`, '_blank')
  }

  const handlePrintBoleto = (orderId: string) => {
    // Open boleto in new window for printing
    window.open(`/api/orders/${orderId}/boleto`, '_blank')
  }

  const handlePrintBoletoById = (boletoId: string) => {
    // Open specific boleto by ID
    window.open(`/api/boletos/${boletoId}/view`, '_blank')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-amber-50">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto max-w-7xl flex h-16 items-center justify-between px-4">
          <Link href="/admin" className="flex items-center space-x-3">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-white">
              <Image 
                src="/logo.jpg" 
                alt="[SUA EMPRESA]" 
                fill 
                className="object-contain"
              />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Visualizar Pedidos</h1>
              <p className="text-xs text-gray-600">[SUA EMPRESA]</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <HomeButton />
            <Link href="/admin/orders/new">
              <Button>
                <PlusCircle className="h-4 w-4 mr-2" />
                Criar Pedido
              </Button>
            </Link>
            <Badge variant="secondary">
              {displayedOrders.length} de {filteredOrders.length} pedidos
              {filteredOrders.length !== orders.length && ` (${orders.length} no total)`}
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto max-w-7xl px-4 py-8">
        {/* Filters */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="Buscar por número, cliente ou telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os Status</SelectItem>
                  <SelectItem value="PENDING">Pendente</SelectItem>
                  <SelectItem value="CONFIRMED">Confirmado</SelectItem>
                  <SelectItem value="PREPARING">Preparando</SelectItem>
                  <SelectItem value="READY">Pronto</SelectItem>
                  <SelectItem value="DELIVERING">Entregando</SelectItem>
                  <SelectItem value="DELIVERED">Entregue</SelectItem>
                  <SelectItem value="CANCELLED">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>

        {/* Orders List */}
        <div className="space-y-4">
          {displayedOrders.map((order) => (
            <Card key={order.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Order Info */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">
                          Pedido #{order.orderNumber}
                        </h3>
                        <p className="text-sm text-gray-600">{order.casualCustomerName || order.customerName}</p>
                        <p className="text-sm text-gray-600">{order.customerPhone}</p>
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        <Badge className={getStatusColor(order.status)}>
                          {getStatusText(order.status)}
                        </Badge>
                        <Badge className={getOrderCreatorInfo(order).color}>
                          Pedido por {getOrderCreatorInfo(order).type}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Data e Hora do Pedido</p>
                        <p className="text-sm font-medium">
                          {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                        </p>
                        <p className="text-xs text-gray-600">
                          {new Date(order.createdAt).toLocaleTimeString('pt-BR', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Tipo</p>
                        <p className="text-sm font-medium">
                          {order.orderType === 'WHOLESALE' ? 'Atacado' : 'Varejo'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Entrega</p>
                        <p className="text-sm font-medium">
                          {order.deliveryType === 'DELIVERY' ? 'Delivery' : 'Retirada'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Pagamento</p>
                        <p className="text-sm font-medium">
                          {getPaymentMethodText(order.paymentMethod)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Order Actions */}
                  <div className="flex flex-col gap-3 lg:min-w-[300px]">
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <span className="text-sm text-gray-600">Total</span>
                      <span className="font-bold text-green-600 text-lg">
                        {formatCurrency(order.total)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <span className="text-sm text-gray-600">Itens</span>
                      <span className="font-medium text-blue-600">
                        {order.orderItems.length} produtos
                      </span>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-gray-500">Status de Entrega</Label>
                      <Select
                        value={order.status}
                        onValueChange={(value) => handleStatusChange(order.id, value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PENDING">Pendente</SelectItem>
                          <SelectItem value="CONFIRMED">Confirmado</SelectItem>
                          <SelectItem value="PREPARING">Preparando</SelectItem>
                          <SelectItem value="READY">Pronto</SelectItem>
                          <SelectItem value="DELIVERING">Entregando</SelectItem>
                          <SelectItem value="DELIVERED">Entregue</SelectItem>
                          <SelectItem value="CANCELLED">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 🆕 Select de Status de Pagamento (só mostra se entregue) */}
                    {order.status === 'DELIVERED' && (
                      <div className="space-y-2">
                        <Label className="text-xs text-gray-500">Status de Pagamento</Label>
                        
                        {/* Aviso para boletos: atualização automática */}
                        {order.paymentMethod === 'BOLETO' && (
                          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <svg className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="text-xs text-blue-700">
                              <strong>Boleto - Atualização Automática</strong>
                              <p className="mt-1">O status de pagamento é atualizado automaticamente quando o boleto é pago na Cora.</p>
                            </div>
                          </div>
                        )}
                        
                        {/* Select manual (desabilitado para boletos) */}
                        <Select
                          value={order.paymentStatus || 'UNPAID'}
                          onValueChange={(value) => handlePaymentStatusChange(order.id, value)}
                          disabled={order.paymentMethod === 'BOLETO'} // 🔒 Desabilita para boletos
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="UNPAID">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                Não Pago
                              </div>
                            </SelectItem>
                            <SelectItem value="PAID">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                Pago
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        
                        {/* Badge de status de pagamento */}
                        <div className="flex items-center justify-center p-2 rounded-lg border" 
                             style={{
                               backgroundColor: order.paymentStatus === 'PAID' ? '#dcfce7' : '#fee2e2',
                               borderColor: order.paymentStatus === 'PAID' ? '#86efac' : '#fca5a5'
                             }}>
                          <span className={`text-sm font-medium ${
                            order.paymentStatus === 'PAID' ? 'text-green-700' : 'text-red-700'
                          }`}>
                            {order.paymentStatus === 'PAID' ? '✅ Pago' : '❌ Não Pago'}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(order)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Ver
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditOrder(order)}
                        >
                          <Edit2 className="w-4 h-4 mr-1" />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => handleDeleteOrder(order.id, order.orderNumber)}
                          disabled={isSubmitting}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Excluir
                        </Button>
                      </div>
                      
                      <div className="space-y-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full bg-green-50 hover:bg-green-100 text-green-700"
                          onClick={() => handlePrintReceipt(order.id)}
                        >
                          <Receipt className="w-4 h-4 mr-1" />
                          Cupom
                        </Button>
                        
                        {/* Exibir boletos */}
                        {order.boletos && order.boletos.length > 0 ? (
                          order.boletos.length === 1 ? (
                            // Se houver apenas 1 boleto, exibir botão simples
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700"
                              onClick={() => handlePrintBoletoById(order.boletos![0].id)}
                            >
                              <Receipt className="w-4 h-4 mr-1" />
                              Boleto
                            </Button>
                          ) : (
                            // Se houver múltiplos boletos, exibir um botão para cada parcela
                            <div className="grid grid-cols-2 gap-2">
                              {order.boletos.map((boleto) => (
                                <Button
                                  key={boleto.id}
                                  variant="outline"
                                  size="sm"
                                  className="bg-blue-50 hover:bg-blue-100 text-blue-700"
                                  onClick={() => handlePrintBoletoById(boleto.id)}
                                >
                                  <Receipt className="w-4 h-4 mr-1" />
                                  {boleto.isInstallment && boleto.installmentNumber
                                    ? `${boleto.installmentNumber}/${boleto.totalInstallments}`
                                    : 'Boleto'}
                                </Button>
                              ))}
                            </div>
                          )
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 🔥 Botão "Carregar Mais" - Paginação no Frontend */}
        {hasMoreOrders && (
          <div className="flex justify-center mt-6">
            <Button
              onClick={() => {
                const newLimit = displayLimit + 50
                setDisplayLimit(newLimit)
                console.log(`📊 Carregando mais pedidos... Novo limite: ${newLimit}`)
              }}
              variant="outline"
              size="lg"
              className="w-full max-w-md"
            >
              <PlusCircle className="h-5 w-5 mr-2" />
              Carregar Mais Pedidos ({filteredOrders.length - displayLimit} restantes)
            </Button>
          </div>
        )}

        {/* 🔥 Botão "Ver Todos" - Mostra todos de uma vez */}
        {hasMoreOrders && filteredOrders.length > displayLimit + 50 && (
          <div className="flex justify-center mt-3">
            <Button
              onClick={() => {
                setDisplayLimit(filteredOrders.length)
                console.log(`📊 Exibindo TODOS os ${filteredOrders.length} pedidos`)
              }}
              variant="ghost"
              size="sm"
            >
              Mostrar Todos os {filteredOrders.length} Pedidos
            </Button>
          </div>
        )}

        {filteredOrders.length === 0 && (
          <Card className="p-12">
            <div className="text-center">
              <ShoppingCart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhum pedido encontrado
              </h3>
              <p className="text-gray-600">
                {searchTerm || statusFilter !== 'ALL'
                  ? 'Tente ajustar os filtros de busca'
                  : 'Aguardando novos pedidos'}
              </p>
            </div>
          </Card>
        )}
      </main>

      {/* Order Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Pedido #{selectedOrder?.orderNumber}</DialogTitle>
            <DialogDescription>
              Informações completas do pedido
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-6">
              {/* Customer Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Informações do Cliente</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{selectedOrder.casualCustomerName || selectedOrder.customerName}</span>
                  </div>
                  {selectedOrder.customerPhone && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone className="w-4 h-4" />
                      {selectedOrder.customerPhone}
                    </div>
                  )}
                  {selectedOrder.deliveryType === 'DELIVERY' && selectedOrder.address && (
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <MapPin className="w-4 h-4 mt-0.5" />
                      <span>{selectedOrder.address}</span>
                    </div>
                  )}
                  {selectedOrder.deliveryDate && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      {new Date(selectedOrder.deliveryDate).toLocaleDateString('pt-BR')}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CreditCard className="w-4 h-4" />
                    {getPaymentMethodText(selectedOrder.paymentMethod)}
                  </div>
                </CardContent>
              </Card>

              {/* Order Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Itens do Pedido</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {selectedOrder.orderItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="flex-1">
                          <p className="font-medium">{item.product.name}</p>
                          <p className="text-sm text-gray-600">
                            {item.quantity}x {formatCurrency(item.unitPrice)}
                          </p>
                        </div>
                        <p className="font-bold">{formatCurrency(item.total)}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-4 border-t space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal:</span>
                      <span>{formatCurrency(selectedOrder.subtotal)}</span>
                    </div>
                    {selectedOrder.discount > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Desconto {selectedOrder.discountPercent ? `(${selectedOrder.discountPercent}%)` : ''}:</span>
                        <span>- {formatCurrency(selectedOrder.discount)}</span>
                      </div>
                    )}
                    {selectedOrder.couponDiscount && selectedOrder.couponDiscount > 0 && (
                      <div className="flex justify-between text-sm text-orange-600">
                        <span>Desconto Cupom:</span>
                        <span>- {formatCurrency(selectedOrder.couponDiscount)}</span>
                      </div>
                    )}
                    {selectedOrder.coupon && (
                      <div className="flex flex-col space-y-1 text-sm bg-blue-50 p-2 rounded">
                        <div className="flex justify-between items-center">
                          <span className="text-blue-700 font-medium">🎟️ Cupom Aplicado:</span>
                          <span className="font-bold text-blue-700">#{selectedOrder.coupon.code}</span>
                        </div>
                        {selectedOrder.coupon.description && (
                          <p className="text-xs text-blue-600">{selectedOrder.coupon.description}</p>
                        )}
                        <div className="flex justify-between text-xs text-blue-600">
                          <span>Tipo:</span>
                          <span>{selectedOrder.coupon.discountType === 'FIXED' ? 'Valor Fixo' : 'Porcentagem'}</span>
                        </div>
                        <div className="flex justify-between text-xs text-blue-600">
                          <span>Valor do Cupom:</span>
                          <span>{selectedOrder.coupon.discountType === 'FIXED' ? formatCurrency(selectedOrder.coupon.discountValue) : `${selectedOrder.coupon.discountValue}%`}</span>
                        </div>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total:</span>
                      <span className="text-green-600">{formatCurrency(selectedOrder.total)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Order Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Pedido #{selectedOrder?.orderNumber}</DialogTitle>
            <DialogDescription>
              Altere a data, quantidades e valores dos itens
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* 🆕 Campo de Data do Pedido */}
            <Card>
              <CardContent className="pt-6">
                <div>
                  <Label htmlFor="order-date">📅 Data do Pedido *</Label>
                  <Input
                    id="order-date"
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="mt-2"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    ⚠️ Use este campo para corrigir a data caso o pedido tenha sido feito em outro dia
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              {editItems.map((item, index) => (
                <Card key={index}>
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">{item.product.name}</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEditItem(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Quantidade</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateEditItemQuantity(index, item.quantity - 1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateEditItemQuantity(index, parseInt(e.target.value) || 1)}
                              className="text-center"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateEditItemQuantity(index, item.quantity + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div>
                          <Label>Preço Unitário</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e) => updateEditItemPrice(index, parseFloat(e.target.value) || 0)}
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t">
                        <span className="text-sm text-muted-foreground">Subtotal do item:</span>
                        <span className="font-bold">{formatCurrency(item.total)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>Total do Pedido:</span>
                  <span className="text-green-600">{formatCurrency(calculateEditTotal())}</span>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                className="flex-1"
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveEdit}
                className="flex-1"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 🆕 Modal de Seleção de Conta Bancária */}
      <Dialog open={showBankAccountDialog} onOpenChange={setShowBankAccountDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Selecionar Conta Bancária
            </DialogTitle>
            <DialogDescription>
              Em qual conta bancária este pagamento foi depositado?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bankAccount">Conta Bancária *</Label>
              <Select
                value={selectedBankAccountId}
                onValueChange={setSelectedBankAccountId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta..." />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.length === 0 ? (
                    <SelectItem value="none" disabled>
                      Nenhuma conta ativa encontrada
                    </SelectItem>
                  ) : (
                    bankAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          <span>{account.name}{account.bankName ? ` - ${account.bankName}` : ''}</span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                💡 Dica: Você pode configurar contas padrão para clientes específicos no futuro
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowBankAccountDialog(false)
                  setSelectedBankAccountId('')
                  setOrderIdForPayment('')
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmPayment}
                className="flex-1 bg-green-600 hover:bg-green-700"
                disabled={!selectedBankAccountId}
              >
                Confirmar Pagamento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
