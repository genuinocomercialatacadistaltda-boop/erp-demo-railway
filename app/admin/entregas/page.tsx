'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Home,
  ArrowLeft,
  Truck,
  Package,
  MapPin,
  Phone,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  User,
  DollarSign,
  Calendar,
  Edit
} from 'lucide-react';

interface OrderItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  casualCustomerName?: string | null; // 🆕 Nome do cliente avulso
  customerPhone?: string;
  address?: string;
  city?: string;
  deliveryTime?: string;
  status: string;
  deliveryOrder?: number;
  total: number;
  items: OrderItem[];
  notes?: string;
}

interface DeliveryData {
  date: string;
  summary: {
    total: number;
    delivery: number;
    pickup: number;
    byStatus: {
      confirmed: number;
      ready: number;
      delivering: number;
    };
  };
  delivery: Order[];
  pickup: Order[];
}

export default function AdminEntregasPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [deliveryData, setDeliveryData] = useState<DeliveryData | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTab, setSelectedTab] = useState<'delivery' | 'pickup'>('delivery');
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [newDeliveryType, setNewDeliveryType] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  const [newDeliveryDate, setNewDeliveryDate] = useState(''); // 🆕 Para editar data de entrega
  const [updatingType, setUpdatingType] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null); // ID do pedido sendo atualizado

  // Autenticação
  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session) {
      router.push('/auth/login');
      return;
    }

    const userType = (session.user as any)?.userType;
    if (userType !== 'ADMIN') {
      router.push('/admin');
      toast.error('Acesso negado');
      return;
    }
  }, [session, status, router]);

  // Inicializa data (hoje)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const today = new Date().toISOString().split('T')[0];
      setSelectedDate(today);
    }
  }, []);

  // Carrega dados quando data muda
  useEffect(() => {
    if (selectedDate) {
      loadDeliveryData();
    }
  }, [selectedDate]);

  const loadDeliveryData = async () => {
    try {
      setLoading(true);
      console.log('[ADMIN_ENTREGAS] Carregando dados de entregas para:', selectedDate);

      const response = await fetch(`/api/delivery/orders?date=${selectedDate}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao carregar entregas');
      }

      const data = await response.json();
      console.log('[ADMIN_ENTREGAS] Dados carregados:', data);
      setDeliveryData(data);

    } catch (error) {
      console.error('[ADMIN_ENTREGAS] Erro ao carregar entregas:', error);
      toast.error('Erro ao carregar dados de entregas');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: any; icon: any }> = {
      CONFIRMED: { 
        label: 'Confirmado', 
        variant: 'default' as const,
        icon: AlertCircle 
      },
      READY: { 
        label: 'Pronto', 
        variant: 'secondary' as const,
        icon: Package 
      },
      DELIVERING: { 
        label: 'Saiu para Entrega', 
        variant: 'default' as const,
        icon: Truck 
      },
      DELIVERED: { 
        label: 'Entregue', 
        variant: 'default' as const,
        icon: CheckCircle2 
      }
    };

    const config = statusConfig[status] || { label: status, variant: 'default' as const, icon: AlertCircle };
    const Icon = config.icon;

    return (
      <Badge 
        variant={config.variant}
        className={
          status === 'DELIVERED' ? 'bg-green-100 text-green-800 hover:bg-green-200' :
          status === 'DELIVERING' ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' :
          status === 'READY' ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' :
          'bg-gray-100 text-gray-800 hover:bg-gray-200'
        }
      >
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // ✅ Função para atualizar status do pedido (ADMIN com autonomia total)
  const handleUpdateStatus = async (orderId: string, newStatus: string, orderNumber: string) => {
    try {
      setUpdatingStatus(orderId);
      
      console.log('[ADMIN_ENTREGAS] Atualizando status:', { orderId, newStatus });
      
      const response = await fetch(`/api/delivery/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao atualizar status');
      }

      const data = await response.json();
      toast.success(`Pedido #${orderNumber} marcado como ${getStatusLabel(newStatus)}`);
      
      // Recarrega os dados
      await loadDeliveryData();

    } catch (error) {
      console.error('[ADMIN_ENTREGAS] Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status do pedido');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'CONFIRMED': 'Confirmado',
      'READY': 'Pronto',
      'DELIVERING': 'Saiu para Entrega',
      'DELIVERED': 'Entregue'
    };
    return labels[status] || status;
  };

  const handleEditDeliveryType = (order: Order) => {
    setEditingOrder(order);
    // Determina o tipo atual baseado em qual aba o pedido está
    const currentType = selectedTab === 'delivery' ? 'DELIVERY' : 'PICKUP';
    setNewDeliveryType(currentType);
    // 🆕 Inicializa com a data selecionada (que é a data de entrega do pedido)
    setNewDeliveryDate(selectedDate);
    setShowEditDialog(true);
  };

  const handleUpdateDeliveryType = async () => {
    if (!editingOrder) return;

    try {
      setUpdatingType(true);
      
      // 🆕 Verificar se mudou a data ou o tipo
      const dateChanged = newDeliveryDate !== selectedDate;
      const typeChanged = (selectedTab === 'delivery' ? 'DELIVERY' : 'PICKUP') !== newDeliveryType;
      
      console.log('[ADMIN_ENTREGAS] Atualizando pedido:', {
        orderId: editingOrder.id,
        orderNumber: editingOrder.orderNumber,
        newType: newDeliveryType,
        newDate: newDeliveryDate,
        dateChanged,
        typeChanged
      });

      // 🆕 Se a data mudou, usar a API de pedidos
      if (dateChanged) {
        const response = await fetch(`/api/orders/${editingOrder.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            deliveryDate: newDeliveryDate,
            deliveryType: newDeliveryType
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erro ao atualizar pedido');
        }
        
        toast.success(`Data de entrega alterada para ${new Date(newDeliveryDate + 'T12:00:00').toLocaleDateString('pt-BR')}`);
      } else if (typeChanged) {
        // Se só mudou o tipo, usar a API específica
        const response = await fetch(`/api/delivery/orders/${editingOrder.id}/delivery-type`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deliveryType: newDeliveryType })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erro ao atualizar tipo de entrega');
        }

        const data = await response.json();
        toast.success(data.message);
      } else {
        toast.info('Nenhuma alteração detectada');
      }
      
      setShowEditDialog(false);
      
      // Recarrega os dados para refletir a mudança
      await loadDeliveryData();

    } catch (error) {
      console.error('[ADMIN_ENTREGAS] Erro ao atualizar pedido:', error);
      toast.error('Erro ao atualizar pedido');
    } finally {
      setUpdatingType(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-orange-600" />
          <p className="text-gray-600">Carregando entregas...</p>
        </div>
      </div>
    );
  }

  const currentOrders = selectedTab === 'delivery' 
    ? (deliveryData?.delivery || [])
    : (deliveryData?.pickup || []);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Truck className="w-8 h-8 text-orange-600" />
              Gerenciamento de Entregas
            </h1>
            <p className="text-gray-600 mt-1">
              Visualize e acompanhe todos os pedidos de entrega e retirada
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

        {/* Filtro de Data */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <Label htmlFor="date">Data</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Button 
                onClick={loadDeliveryData}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {deliveryData && (
        <>
          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Total de Pedidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  {deliveryData.summary.total}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {formatDate(selectedDate)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Falta Entregar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {deliveryData.delivery.filter(o => o.status !== 'DELIVERED').length}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  de {deliveryData.summary.delivery} delivery
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Falta Retirar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {deliveryData.pickup.filter(o => o.status !== 'DELIVERED').length}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  de {deliveryData.summary.pickup} retirada
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Confirmados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-600">
                  {deliveryData.summary.byStatus.confirmed}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Aguardando preparo
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Prontos/Em Rota
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {deliveryData.summary.byStatus.ready + deliveryData.summary.byStatus.delivering}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Pronto + Saindo
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <div className="mb-6">
            <div className="flex gap-2 border-b">
              <button
                onClick={() => setSelectedTab('delivery')}
                className={`px-4 py-2 font-medium transition-colors ${
                  selectedTab === 'delivery'
                    ? 'text-orange-600 border-b-2 border-orange-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Truck className="w-4 h-4 inline mr-2" />
                Entregas ({deliveryData.summary.delivery})
              </button>
              <button
                onClick={() => setSelectedTab('pickup')}
                className={`px-4 py-2 font-medium transition-colors ${
                  selectedTab === 'pickup'
                    ? 'text-orange-600 border-b-2 border-orange-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Package className="w-4 h-4 inline mr-2" />
                Retiradas ({deliveryData.summary.pickup})
              </button>
            </div>
          </div>

          {/* Lista de Pedidos */}
          {currentOrders.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium mb-2">
                    Nenhum pedido encontrado
                  </p>
                  <p className="text-sm">
                    Não há {selectedTab === 'delivery' ? 'entregas' : 'retiradas'} para esta data
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {currentOrders.map((order) => (
                <Card key={order.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">
                          #{order.orderNumber}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <User className="w-4 h-4" />
                          {order.casualCustomerName || order.customerName}
                        </CardDescription>
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        {getStatusBadge(order.status)}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditDeliveryType(order)}
                          className="text-xs"
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Alterar Tipo
                        </Button>
                        {/* ✅ Botões de Status - Autonomia Admin */}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {order.status === 'CONFIRMED' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUpdateStatus(order.id, 'READY', order.orderNumber)}
                              disabled={updatingStatus === order.id}
                              className="text-xs bg-yellow-50 border-yellow-300 hover:bg-yellow-100"
                            >
                              {updatingStatus === order.id ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <>
                                  <Package className="w-3 h-3 mr-1" />
                                  Pronto
                                </>
                              )}
                            </Button>
                          )}
                          {(order.status === 'CONFIRMED' || order.status === 'READY') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUpdateStatus(order.id, 'DELIVERING', order.orderNumber)}
                              disabled={updatingStatus === order.id}
                              className="text-xs bg-blue-50 border-blue-300 hover:bg-blue-100"
                            >
                              {updatingStatus === order.id ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <>
                                  <Truck className="w-3 h-3 mr-1" />
                                  Saiu
                                </>
                              )}
                            </Button>
                          )}
                          {order.status !== 'DELIVERED' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUpdateStatus(order.id, 'DELIVERED', order.orderNumber)}
                              disabled={updatingStatus === order.id}
                              className="text-xs bg-green-50 border-green-300 hover:bg-green-100"
                            >
                              {updatingStatus === order.id ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Entregue
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {/* Informações de Contato e Entrega */}
                      <div className="space-y-2 text-sm">
                        {order.customerPhone && (
                          <div className="flex items-center gap-2 text-gray-700">
                            <Phone className="w-4 h-4 text-gray-400" />
                            <span>{order.customerPhone}</span>
                          </div>
                        )}
                        
                        {selectedTab === 'delivery' && order.address && (
                          <div className="flex items-start gap-2 text-gray-700">
                            <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                            <span>{order.address}{order.city ? ` - ${order.city}` : ''}</span>
                          </div>
                        )}

                        {order.deliveryTime && (
                          <div className="flex items-center gap-2 text-gray-700">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span>Horário: {order.deliveryTime}</span>
                          </div>
                        )}

                        {order.deliveryOrder && (
                          <div className="flex items-center gap-2 text-gray-700">
                            <AlertCircle className="w-4 h-4 text-gray-400" />
                            <span>Ordem de entrega: #{order.deliveryOrder}</span>
                          </div>
                        )}
                      </div>

                      {/* Itens do Pedido */}
                      <div className="border-t pt-3">
                        <p className="text-sm font-medium text-gray-700 mb-2">Itens:</p>
                        <div className="space-y-1">
                          {order.items.map((item, index) => (
                            <div key={index} className="flex justify-between text-sm text-gray-600">
                              <span>{item.quantity}x {item.productName}</span>
                              <span className="font-medium">{formatCurrency(item.total)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Total */}
                      <div className="border-t pt-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-700">
                            <DollarSign className="w-4 h-4 inline mr-1" />
                            Total:
                          </span>
                          <span className="text-lg font-bold text-gray-900">
                            {formatCurrency(order.total)}
                          </span>
                        </div>
                      </div>

                      {/* Observações */}
                      {order.notes && (
                        <div className="border-t pt-3">
                          <p className="text-sm font-medium text-gray-700 mb-1">Observações:</p>
                          <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                            {order.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Di\u00e1logo de Edi\u00e7\u00e3o de Tipo de Entrega */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Tipo de Entrega</DialogTitle>
            <DialogDescription>
              Pedido #{editingOrder?.orderNumber} - {editingOrder?.casualCustomerName || editingOrder?.customerName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* 🆕 Campo para editar data de entrega */}
            <div className="space-y-2">
              <Label htmlFor="newDeliveryDate">Data de Entrega/Retirada:</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="newDeliveryDate"
                  type="date"
                  value={newDeliveryDate}
                  onChange={(e) => setNewDeliveryDate(e.target.value)}
                  className="pl-10"
                />
              </div>
              {newDeliveryDate !== selectedDate && (
                <p className="text-sm text-blue-600 font-medium">
                  ⚠️ A data será alterada de {formatDate(selectedDate)} para {formatDate(newDeliveryDate)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Tipo de Entrega:</Label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setNewDeliveryType('DELIVERY')}
                  className={`p-4 border-2 rounded-lg transition-all ${
                    newDeliveryType === 'DELIVERY'
                      ? 'border-orange-600 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Truck className={`w-8 h-8 mx-auto mb-2 ${
                    newDeliveryType === 'DELIVERY' ? 'text-orange-600' : 'text-gray-400'
                  }`} />
                  <p className={`font-medium ${
                    newDeliveryType === 'DELIVERY' ? 'text-orange-600' : 'text-gray-700'
                  }`}>
                    Entrega
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    O pedido será entregue no endereço
                  </p>
                </button>

                <button
                  onClick={() => setNewDeliveryType('PICKUP')}
                  className={`p-4 border-2 rounded-lg transition-all ${
                    newDeliveryType === 'PICKUP'
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Package className={`w-8 h-8 mx-auto mb-2 ${
                    newDeliveryType === 'PICKUP' ? 'text-purple-600' : 'text-gray-400'
                  }`} />
                  <p className={`font-medium ${
                    newDeliveryType === 'PICKUP' ? 'text-purple-600' : 'text-gray-700'
                  }`}>
                    Retirada
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    O cliente vai buscar o pedido
                  </p>
                </button>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium mb-1">Atenção!</p>
                  <p>
                    Esta alteração pode afetar a organização da rota do entregador.
                    Certifique-se de que o cliente foi informado sobre a mudança.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              disabled={updatingType}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpdateDeliveryType}
              disabled={updatingType}
            >
              {updatingType ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Atualizando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Confirmar Altera\u00e7\u00e3o
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
