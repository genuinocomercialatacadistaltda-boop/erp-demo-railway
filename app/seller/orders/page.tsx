
'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Search, Eye, Plus, Edit2, Minus, Trash2, Home } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { HomeButton } from '@/components/home-button'

interface OrderItem {
  id: string
  productId: string
  quantity: number
  unitPrice: number
  total: number
  product: {
    id: string
    name: string
    description: string
  }
}

interface Order {
  id: string
  orderNumber: string
  customerName: string
  total: number
  status: string
  createdAt: string
  sellerId: string | null
  userId: string | null
  customer: any
  orderItems: OrderItem[]
}

export default function SellerOrdersPage() {
  const { data: session, status } = useSession() || {}
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState<'all' | 'my_orders' | 'customer_orders'>('all')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editItems, setEditItems] = useState<OrderItem[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    } else if (session && (session.user as any)?.userType !== 'SELLER') {
      router.push('/dashboard')
    } else if (session && (session.user as any)?.userType === 'SELLER') {
      fetchOrders()
    }
  }, [session, status, router])

  useEffect(() => {
    applyFilters()
  }, [searchTerm, filter, orders])

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/sellers/orders')
      const data = await res.json()
      setOrders(data)
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = orders

    // Filtro por tipo de pedido
    const sellerId = (session?.user as any)?.sellerId
    if (filter === 'my_orders') {
      filtered = filtered.filter(order => order.sellerId === sellerId)
    } else if (filter === 'customer_orders') {
      filtered = filtered.filter(order => order.sellerId !== sellerId && order.customer?.sellerId === sellerId)
    }

    // Filtro por busca
    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    setFilteredOrders(filtered)
  }

  const handleViewDetails = (order: Order) => {
    setSelectedOrder(order)
    setIsViewDialogOpen(true)
  }

  const handleEditOrder = (order: Order) => {
    setSelectedOrder(order)
    setEditItems(JSON.parse(JSON.stringify(order.orderItems))) // Deep copy
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

    setIsSubmitting(true)

    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}/items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: editItems.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice
          }))
        })
      })

      if (!res.ok) {
        throw new Error('Erro ao atualizar pedido')
      }

      toast.success('Pedido atualizado com sucesso!')
      setIsEditDialogOpen(false)
      fetchOrders()
    } catch (error) {
      console.error('Error updating order:', error)
      toast.error('Erro ao atualizar pedido')
    } finally {
      setIsSubmitting(false)
    }
  }

  const calculateEditTotal = () => {
    return editItems.reduce((sum, item) => sum + item.total, 0)
  }

  const handleDeleteOrder = (order: Order) => {
    setOrderToDelete(order)
    setIsDeleteDialogOpen(true)
  }

  const confirmDeleteOrder = async () => {
    if (!orderToDelete) return

    setIsDeleting(true)

    try {
      const res = await fetch(`/api/orders/${orderToDelete.id}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        throw new Error('Erro ao excluir pedido')
      }

      toast.success('Pedido excluído com sucesso!')
      setIsDeleteDialogOpen(false)
      setOrderToDelete(null)
      fetchOrders()
    } catch (error) {
      console.error('Error deleting order:', error)
      toast.error('Erro ao excluir pedido')
    } finally {
      setIsDeleting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } } = {
      PENDING: { label: 'Pendente', variant: 'secondary' },
      CONFIRMED: { label: 'Confirmado', variant: 'default' },
      PREPARING: { label: 'Preparando', variant: 'default' },
      READY: { label: 'Pronto', variant: 'default' },
      DELIVERING: { label: 'Entregando', variant: 'default' },
      DELIVERED: { label: 'Entregue', variant: 'default' },
      CANCELLED: { label: 'Cancelado', variant: 'destructive' }
    }
    const { label, variant } = statusMap[status] || { label: status, variant: 'outline' }
    return <Badge variant={variant}>{label}</Badge>
  }

  const getOrderCreatorBadge = (order: Order) => {
    const sellerId = (session?.user as any)?.sellerId
    
    // Se o pedido tem sellerId e é igual ao meu
    if (order.sellerId && order.sellerId === sellerId) {
      return <Badge className="bg-blue-100 text-blue-800">Você tirou</Badge>
    }
    // Se tem sellerId mas não é meu
    if (order.sellerId) {
      return <Badge className="bg-purple-100 text-purple-800">Outro vendedor</Badge>
    }
    // Se tem userId, foi admin
    if (order.userId) {
      return <Badge className="bg-orange-100 text-orange-800">Admin</Badge>
    }
    // Caso contrário, foi o cliente
    return <Badge className="bg-green-100 text-green-800">Cliente</Badge>
  }

  const stats = {
    all: orders.length,
    myOrders: orders.filter(o => o.sellerId === (session?.user as any)?.sellerId).length,
    customerOrders: orders.filter(o => o.sellerId !== (session?.user as any)?.sellerId && o.customer?.sellerId === (session?.user as any)?.sellerId).length
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

  if (!session || (session.user as any)?.userType !== 'SELLER') {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Gerenciar Pedidos
            </h1>
            <p className="text-gray-600">
              Visualize todos os pedidos relacionados aos seus clientes
            </p>
          </div>
          <div className="flex items-center gap-2">
            <HomeButton />
            <Link href="/seller/orders/new">
              <Button size="lg">
                <Plus className="h-5 w-5 mr-2" />
                Tirar Pedido
              </Button>
            </Link>
          </div>
        </div>

        {/* Estatísticas rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card 
            className={`cursor-pointer transition-all ${filter === 'all' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setFilter('all')}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Todos os Pedidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.all}</div>
            </CardContent>
          </Card>
          
          <Card 
            className={`cursor-pointer transition-all ${filter === 'my_orders' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setFilter('my_orders')}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pedidos que Tirei
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.myOrders}</div>
            </CardContent>
          </Card>
          
          <Card 
            className={`cursor-pointer transition-all ${filter === 'customer_orders' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setFilter('customer_orders')}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pedidos dos Meus Clientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.customerOrders}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Pedidos</CardTitle>
            <CardDescription>
              {filter === 'all' && 'Todos os pedidos relacionados aos seus clientes'}
              {filter === 'my_orders' && 'Pedidos que você tirou diretamente'}
              {filter === 'customer_orders' && 'Pedidos feitos pelos seus clientes'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por número do pedido ou nome do cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {searchTerm ? 'Nenhum pedido encontrado' : 'Nenhum pedido ainda'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Quem Tirou</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => {
                      return (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">{order.orderNumber}</TableCell>
                          <TableCell>{order.customer?.name || order.customerName}</TableCell>
                          <TableCell>
                            {format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            R$ {order.total.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            {getOrderCreatorBadge(order)}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(order.status)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewDetails(order)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditOrder(order)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteOrder(order)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Visualização */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Pedido #{selectedOrder?.orderNumber}</DialogTitle>
            <DialogDescription>
              Informações completas do pedido
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Itens do Pedido</h4>
                <div className="space-y-2">
                  {selectedOrder.orderItems.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-2 bg-muted rounded">
                      <div>
                        <p className="font-medium">{item.product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.quantity}x R$ {item.unitPrice.toFixed(2)}
                        </p>
                      </div>
                      <p className="font-bold">R$ {item.total.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>R$ {selectedOrder.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Edição */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Pedido #{selectedOrder?.orderNumber}</DialogTitle>
            <DialogDescription>
              Altere as quantidades e valores dos itens
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
                        <span className="font-bold">R$ {item.total.toFixed(2)}</span>
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
                  <span className="text-green-600">R$ {calculateEditTotal().toFixed(2)}</span>
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

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir permanentemente o pedido <strong>#{orderToDelete?.orderNumber}</strong>?
              <br /><br />
              <span className="text-red-600 font-semibold">
                Esta ação não pode ser desfeita. Todos os boletos associados e dados do pedido serão removidos permanentemente.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteOrder}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Excluindo...' : 'Sim, excluir permanentemente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
