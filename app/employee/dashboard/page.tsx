
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { 
  DollarSign, 
  FileText, 
  AlertTriangle, 
  Target, 
  BarChart3, 
  LogOut,
  Home,
  Clock,
  User,
  Calendar,
  ShoppingCart,
  ClipboardList,
  Users,
  TrendingUp,
  Plus,
  Truck,
  Package,
  MapPin,
  Phone,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Edit,
  Star,
  ThumbsUp,
  ThumbsDown,
  Award
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SupervisorEvaluations } from '../_components/supervisor-evaluations';
import { LeadershipEvaluation } from '../_components/leadership-evaluation';

// Helper functions
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

// Função segura para formatar datas, evita "Invalid time value"
const formatDateSafe = (dateValue: any, formatStr: string = 'dd/MM/yyyy'): string => {
  if (!dateValue) return 'Data não disponível';
  
  try {
    const date = new Date(dateValue);
    // Verifica se a data é válida
    if (isNaN(date.getTime())) {
      return 'Data inválida';
    }
    return format(date, formatStr, { locale: ptBR });
  } catch (error) {
    console.error('Erro ao formatar data:', dateValue, error);
    return 'Data inválida';
  }
};

// 🔧 Função para formatar mês de referência SEM problema de timezone
// Extrai ano e mês diretamente da string ISO para evitar conversão de timezone
const formatReferenceMonth = (dateValue: any): string => {
  if (!dateValue) return 'Data não disponível';
  
  try {
    // Se for string ISO (ex: "2026-01-01T00:00:00.000Z"), extrai ano e mês diretamente
    const dateStr = typeof dateValue === 'string' ? dateValue : dateValue.toISOString?.() || String(dateValue);
    
    // Regex para extrair ano e mês da string ISO
    const match = dateStr.match(/^(\d{4})-(\d{2})/);
    if (match) {
      const year = parseInt(match[1]);
      const month = parseInt(match[2]) - 1; // Mês é 0-indexed
      
      const monthNames = [
        'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
        'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
      ];
      
      return `${monthNames[month]}/${year}`;
    }
    
    // Fallback: usa formatDateSafe
    return formatDateSafe(dateValue, 'MMMM/yyyy');
  } catch (error) {
    console.error('Erro ao formatar mês de referência:', dateValue, error);
    return 'Data inválida';
  }
};

// Componente de Card Sortable para Drag and Drop
function SortableOrderCard({ 
  order, 
  onOrderClick, 
  formatCurrency, 
  getStatusBadge, 
  isReordering,
  isSelectMode,
  isSelected,
  onToggleSelect,
  onQuickDelivered
}: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: order.id, disabled: !isReordering });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Calcular progresso do checklist
  const checkedItems = order.items?.filter((i: any) => i.isChecked).length || 0;
  const totalItems = order.items?.length || 0;
  const progressPercent = totalItems > 0 ? (checkedItems / totalItems) * 100 : 0;

  // Mostrar botão de entregue rápido se o pedido está READY ou DELIVERING
  const canQuickDeliver = order.status === 'READY' || order.status === 'DELIVERING';

  return (
    <div ref={setNodeRef} style={style}>
      <Card 
        className={`hover:shadow-lg transition-all ${
          isReordering ? 'cursor-move' : isSelectMode ? '' : 'cursor-pointer'
        } ${isDragging ? 'shadow-2xl scale-105' : ''} ${
          isSelected ? 'ring-2 ring-orange-500 bg-orange-50' : ''
        }`}
        onClick={(e) => {
          if (isSelectMode) {
            e.stopPropagation();
            onToggleSelect(order.id);
          } else if (!isReordering) {
            onOrderClick(order);
          }
        }}
      >
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-1">
              {/* Checkbox para seleção múltipla */}
              {isSelectMode && !isReordering && (
                <div onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleSelect(order.id)}
                    className="h-5 w-5"
                  />
                </div>
              )}
              
              {/* Ícone de arrastar */}
              {isReordering && (
                <div 
                  {...attributes} 
                  {...listeners} 
                  className="cursor-grab active:cursor-grabbing p-2 hover:bg-gray-100 rounded"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex flex-col gap-1">
                    <div className="w-5 h-0.5 bg-gray-400 rounded"></div>
                    <div className="w-5 h-0.5 bg-gray-400 rounded"></div>
                    <div className="w-5 h-0.5 bg-gray-400 rounded"></div>
                  </div>
                </div>
              )}
              
              <div>
                <CardTitle className="text-lg">
                  #{order.orderNumber}
                </CardTitle>
                <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                  <User className="w-4 h-4" />
                  {order.customerName}
                </div>
              </div>
            </div>
            {getStatusBadge(order.status)}
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
              
              {order.address && (
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

              {order.volumes && order.volumes > 1 && (
                <div className="flex items-center gap-2 text-orange-600 font-medium">
                  <Package className="w-4 h-4" />
                  <span>{order.volumes} volumes</span>
                </div>
              )}
            </div>

            {/* Progresso do Checklist - Sempre visível */}
            {totalItems > 0 && (
              <div className="border-t pt-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-gray-600 flex items-center gap-1">
                    <ClipboardList className="w-3 h-3" />
                    Checklist
                  </span>
                  <span className="text-xs font-semibold text-gray-900">
                    {checkedItems}/{totalItems}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className="bg-green-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Itens do Pedido - Preview */}
            <div className="border-t pt-3">
              <p className="text-sm font-medium text-gray-700 mb-2">Itens:</p>
              <div className="space-y-1">
                {order.items.slice(0, 2).map((item: any, index: number) => (
                  <div key={index} className="flex justify-between text-sm text-gray-600">
                    <span className={item.isChecked ? 'line-through text-gray-400' : ''}>
                      {item.quantity}x {item.productName}
                    </span>
                    <span className={`font-medium ${item.isChecked ? 'line-through text-gray-400' : ''}`}>
                      {formatCurrency(item.total)}
                    </span>
                  </div>
                ))}
                {order.items.length > 2 && (
                  <p className="text-xs text-gray-500 mt-1">
                    +{order.items.length - 2} {order.items.length - 2 === 1 ? 'item' : 'itens'}
                  </p>
                )}
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

            {/* Botão Rápido de "Pedido Entregue" */}
            {canQuickDeliver && !isSelectMode && !isReordering && (
              <div className="border-t pt-3">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickDelivered(order.id);
                  }}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3"
                  size="lg"
                >
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  Marcar como Entregue
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function EmployeeDashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession() || {};
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [creditLimit, setCreditLimit] = useState(0);
  const [usedCredit, setUsedCredit] = useState(0);
  
  // Estados para Produção
  const [productionStats, setProductionStats] = useState<any>(null);
  const [productionRecords, setProductionRecords] = useState<any[]>([]);
  const [productionGoals, setProductionGoals] = useState<any[]>([]);
  
  // Estados para funcionalidades de vendedor
  const [hasSeller, setHasSeller] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [totalCommissions, setTotalCommissions] = useState(0);
  
  // Estados para funcionalidades de entregador
  const [isDeliveryPerson, setIsDeliveryPerson] = useState(false);
  const [deliveryData, setDeliveryData] = useState<any>(null);
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [selectedDeliveryDate, setSelectedDeliveryDate] = useState('');
  const [selectedDeliveryTab, setSelectedDeliveryTab] = useState<'delivery' | 'pickup'>('delivery');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [editingVolumes, setEditingVolumes] = useState(false);
  const [volumesValue, setVolumesValue] = useState<number>(1);
  const [reorderingRoute, setReorderingRoute] = useState(false);
  const [showEditTypeDialog, setShowEditTypeDialog] = useState(false);
  const [editingOrderType, setEditingOrderType] = useState<any>(null);
  const [newOrderType, setNewOrderType] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  const [updatingOrderType, setUpdatingOrderType] = useState(false);
  
  // Estados para seleção múltipla
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  
  // Estados para aceite digital de contracheques
  const [showAcknowledgeDialog, setShowAcknowledgeDialog] = useState(false);
  const [selectedPaymentForAck, setSelectedPaymentForAck] = useState<any>(null);
  const [termsText, setTermsText] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [acknowledgingPayment, setAcknowledgingPayment] = useState(false);
  const [paymentAcknowledgments, setPaymentAcknowledgments] = useState<Record<string, boolean>>({});

  // Estados para aceite digital de folhas de ponto
  const [showTimesheetAckDialog, setShowTimesheetAckDialog] = useState(false);
  const [selectedTimesheetForAck, setSelectedTimesheetForAck] = useState<any>(null);
  const [timesheetTermsText, setTimesheetTermsText] = useState('');
  const [timesheetTermsAccepted, setTimesheetTermsAccepted] = useState(false);
  const [acknowledgingTimesheet, setAcknowledgingTimesheet] = useState(false);
  const [timesheetAcknowledgments, setTimesheetAcknowledgments] = useState<Record<string, boolean>>({});

  // Estados para aceite digital de documentos (FOLHA_PONTO)
  const [showDocumentAckDialog, setShowDocumentAckDialog] = useState(false);
  const [selectedDocumentForAck, setSelectedDocumentForAck] = useState<any>(null);
  const [documentTermsText, setDocumentTermsText] = useState('');
  const [documentTermsAccepted, setDocumentTermsAccepted] = useState(false);
  const [acknowledgingDocument, setAcknowledgingDocument] = useState(false);
  const [documentAcknowledgments, setDocumentAcknowledgments] = useState<Record<string, boolean>>({});
  const [loadingPdfId, setLoadingPdfId] = useState<string | null>(null);

  // 🎯 ESTADOS PARA METAS E AVALIAÇÕES
  const [goalsData, setGoalsData] = useState<any>(null);
  const [goalsLoading, setGoalsLoading] = useState(false);
  const [selectedGoalsMonth, setSelectedGoalsMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/employee/login');
      return;
    }

    if (status === 'authenticated') {
      if ((session?.user as any)?.userType !== 'EMPLOYEE') {
        toast.error('Acesso negado');
        router.push('/');
        return;
      }
      loadData();
    }
  }, [session, status]);

  // 🖊️ Carregar aceites existentes
  useEffect(() => {
    if (payments.length > 0) {
      console.log('[ACKNOWLEDGE_CHECK] Verificando aceites existentes para', payments.length, 'pagamentos');
      
      const checkAcknowledgments = async () => {
        const acknowledgments: Record<string, boolean> = {};
        
        for (const payment of payments) {
          try {
            const res = await fetch(`/api/employee/payments/${payment.id}/acknowledge`);
            if (res.ok) {
              const data = await res.json();
              acknowledgments[payment.id] = data.acknowledged || false;
            }
          } catch (error) {
            console.error('[ACKNOWLEDGE_CHECK] Erro ao verificar aceite:', error);
          }
        }
        
        console.log('[ACKNOWLEDGE_CHECK] Aceites carregados:', acknowledgments);
        setPaymentAcknowledgments(acknowledgments);
      };
      
      checkAcknowledgments();
    }
  }, [payments]);

  // 🔏 Carregar aceites de documentos existentes (Folhas de Ponto E Contracheques)
  useEffect(() => {
    const documentosParaVerificar = documents.filter(d => 
      d.documentType === 'FOLHA_PONTO' || d.documentType === 'CONTRACHEQUE'
    );
    if (documentosParaVerificar.length > 0) {
      console.log('[DOC_ACKNOWLEDGE_CHECK] Verificando aceites existentes para', documentosParaVerificar.length, 'documentos');
      
      const checkDocumentAcknowledgments = async () => {
        const acknowledgments: Record<string, boolean> = {};
        
        for (const doc of documentosParaVerificar) {
          // Se já tem documentAck incluído, usar ele diretamente
          if (doc.documentAck) {
            acknowledgments[doc.id] = true;
            continue;
          }
          
          try {
            const res = await fetch(`/api/employee/documents/${doc.id}/acknowledge`);
            if (res.ok) {
              const data = await res.json();
              acknowledgments[doc.id] = data.acknowledged || false;
            }
          } catch (error) {
            console.error('[DOC_ACKNOWLEDGE_CHECK] Erro ao verificar aceite:', error);
          }
        }
        
        console.log('[DOC_ACKNOWLEDGE_CHECK] Aceites de documentos carregados:', acknowledgments);
        setDocumentAcknowledgments(acknowledgments);
      };
      
      checkDocumentAcknowledgments();
    }
  }, [documents]);

  // Carrega dados de entregas quando a data muda
  useEffect(() => {
    if (isDeliveryPerson && selectedDeliveryDate) {
      loadDeliveryData();
    }
  }, [selectedDeliveryDate, isDeliveryPerson]);

  // Inicializa volumes quando o modal abre
  useEffect(() => {
    if (selectedOrder && showOrderModal) {
      setVolumesValue(selectedOrder.volumes || 1);
      setEditingVolumes(false);
    }
  }, [selectedOrder, showOrderModal]);

  // Funções de seleção múltipla
  const toggleSelectMode = () => {
    setIsSelectMode(!isSelectMode);
    setSelectedOrders(new Set());
  };

  const toggleOrderSelection = (orderId: string) => {
    const newSelection = new Set(selectedOrders);
    if (newSelection.has(orderId)) {
      newSelection.delete(orderId);
    } else {
      newSelection.add(orderId);
    }
    setSelectedOrders(newSelection);
  };

  const selectAllOrders = (orders: any[]) => {
    const allOrderIds = new Set(orders.map((o: any) => o.id));
    setSelectedOrders(allOrderIds);
  };

  const clearSelection = () => {
    setSelectedOrders(new Set());
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedOrders.size === 0) {
      toast.error('Nenhum pedido selecionado');
      return;
    }

    try {
      setUpdatingStatus(true);
      console.log('[EMPLOYEE_ENTREGAS] Atualizando status em lote:', { orderIds: Array.from(selectedOrders), newStatus });

      const updatePromises = Array.from(selectedOrders).map(async (orderId) => {
        const response = await fetch(`/api/delivery/orders/${orderId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erro ao atualizar status');
        }

        return response.json();
      });

      await Promise.all(updatePromises);

      // Atualiza os dados locais
      if (deliveryData) {
        const updateOrderStatus = (orders: any[]) =>
          orders.map((order: any) =>
            selectedOrders.has(order.id) ? { ...order, status: newStatus } : order
          );

        setDeliveryData({
          ...deliveryData,
          delivery: updateOrderStatus(deliveryData.delivery),
          pickup: updateOrderStatus(deliveryData.pickup)
        });
      }

      toast.success(`${selectedOrders.size} pedido(s) atualizado(s) para ${getStatusLabel(newStatus)}`);
      clearSelection();
    } catch (error) {
      console.error('[EMPLOYEE_ENTREGAS] Erro ao atualizar status em lote:', error);
      toast.error((error as Error).message || 'Erro ao atualizar status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const loadDeliveryData = async () => {
    try {
      setDeliveryLoading(true);
      console.log('[EMPLOYEE_ENTREGAS] Carregando dados de entregas para:', selectedDeliveryDate);

      const response = await fetch(`/api/delivery/orders?date=${selectedDeliveryDate}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao carregar entregas');
      }

      const data = await response.json();
      console.log('[EMPLOYEE_ENTREGAS] Dados carregados:', data);
      setDeliveryData(data);

    } catch (error) {
      console.error('[EMPLOYEE_ENTREGAS] Erro ao carregar entregas:', error);
      toast.error('Erro ao carregar dados de entregas');
    } finally {
      setDeliveryLoading(false);
    }
  };

  const handleCheckItem = async (orderId: string, itemId: string, isChecked: boolean) => {
    try {
      const response = await fetch(`/api/delivery/orders/${orderId}/check-item`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, isChecked })
      });

      if (!response.ok) {
        throw new Error('Erro ao atualizar checklist');
      }

      // Atualiza o estado local
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({
          ...selectedOrder,
          items: selectedOrder.items.map((item: any) =>
            item.id === itemId ? { ...item, isChecked } : item
          )
        });
      }

      // Atualiza os dados de entrega
      if (deliveryData) {
        const updateOrderItems = (orders: any[]) =>
          orders.map((order: any) =>
            order.id === orderId
              ? {
                  ...order,
                  items: order.items.map((item: any) =>
                    item.id === itemId ? { ...item, isChecked } : item
                  )
                }
              : order
          );

        setDeliveryData({
          ...deliveryData,
          delivery: updateOrderItems(deliveryData.delivery),
          pickup: updateOrderItems(deliveryData.pickup)
        });
      }

      toast.success(isChecked ? 'Item marcado!' : 'Item desmarcado');
    } catch (error) {
      console.error('[EMPLOYEE_ENTREGAS] Erro ao atualizar checklist:', error);
      toast.error('Erro ao atualizar checklist');
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      setUpdatingStatus(true);
      console.log('[EMPLOYEE_ENTREGAS] Atualizando status:', { orderId, newStatus });

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
      console.log('[EMPLOYEE_ENTREGAS] Status atualizado:', data);

      // Atualiza o estado local
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({
          ...selectedOrder,
          status: newStatus
        });
      }

      // Atualiza os dados de entrega
      if (deliveryData) {
        const updateOrderStatus = (orders: any[]) =>
          orders.map((order: any) =>
            order.id === orderId ? { ...order, status: newStatus } : order
          );

        setDeliveryData({
          ...deliveryData,
          delivery: updateOrderStatus(deliveryData.delivery),
          pickup: updateOrderStatus(deliveryData.pickup)
        });
      }

      toast.success(`Status atualizado para ${getStatusLabel(newStatus)}`);
    } catch (error) {
      console.error('[EMPLOYEE_ENTREGAS] Erro ao atualizar status:', error);
      toast.error((error as Error).message || 'Erro ao atualizar status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleQuickDelivered = async (orderId: string) => {
    await handleStatusChange(orderId, 'DELIVERED');
  };

  const handleVolumesChange = async (orderId: string, volumes: number) => {
    try {
      console.log('[EMPLOYEE_ENTREGAS] Atualizando volumes:', { orderId, volumes });

      const response = await fetch(`/api/delivery/orders/${orderId}/volumes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volumes })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao atualizar volumes');
      }

      const data = await response.json();
      console.log('[EMPLOYEE_ENTREGAS] Volumes atualizado:', data);

      // Atualiza o estado local
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({
          ...selectedOrder,
          volumes
        });
      }

      // Atualiza os dados de entrega
      if (deliveryData) {
        const updateOrderVolumes = (orders: any[]) =>
          orders.map((order: any) =>
            order.id === orderId ? { ...order, volumes } : order
          );

        setDeliveryData({
          ...deliveryData,
          delivery: updateOrderVolumes(deliveryData.delivery),
          pickup: updateOrderVolumes(deliveryData.pickup)
        });
      }

      toast.success(`Volumes atualizado para ${volumes}`);
      setEditingVolumes(false);
    } catch (error) {
      console.error('[EMPLOYEE_ENTREGAS] Erro ao atualizar volumes:', error);
      toast.error((error as Error).message || 'Erro ao atualizar volumes');
    }
  };

  const handleEditOrderType = (order: any) => {
    setEditingOrderType(order);
    // Determina o tipo atual baseado em qual aba o pedido está
    const currentType = selectedDeliveryTab === 'delivery' ? 'DELIVERY' : 'PICKUP';
    setNewOrderType(currentType);
    setShowEditTypeDialog(true);
  };

  const handleUpdateOrderType = async () => {
    if (!editingOrderType) return;

    try {
      setUpdatingOrderType(true);
      console.log('[EMPLOYEE_ENTREGAS] Atualizando tipo de entrega:', {
        orderId: editingOrderType.id,
        orderNumber: editingOrderType.orderNumber,
        newType: newOrderType
      });

      const response = await fetch(`/api/delivery/orders/${editingOrderType.id}/delivery-type`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryType: newOrderType })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao atualizar tipo de entrega');
      }

      const data = await response.json();
      console.log('[EMPLOYEE_ENTREGAS] Tipo de entrega atualizado:', data);

      toast.success(data.message);
      setShowEditTypeDialog(false);
      
      // Recarrega os dados para refletir a mudança
      await loadDeliveryData();

      // Se o pedido atualmente selecionado foi editado, fecha o modal
      if (selectedOrder && selectedOrder.id === editingOrderType.id) {
        setShowOrderModal(false);
      }

    } catch (error) {
      console.error('[EMPLOYEE_ENTREGAS] Erro ao atualizar tipo de entrega:', error);
      toast.error('Erro ao atualizar tipo de entrega');
    } finally {
      setUpdatingOrderType(false);
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

  const getAvailableStatusTransitions = (currentStatus: string) => {
    const transitions: Record<string, string[]> = {
      'CONFIRMED': ['READY'],
      'READY': ['DELIVERING', 'DELIVERED'],
      'DELIVERING': ['DELIVERED']
    };
    return transitions[currentStatus] || [];
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    if (deliveryData && selectedDeliveryTab === 'delivery') {
      const oldIndex = deliveryData.delivery.findIndex((order: any) => order.id === active.id);
      const newIndex = deliveryData.delivery.findIndex((order: any) => order.id === over.id);

      const newDeliveryOrders = arrayMove(deliveryData.delivery, oldIndex, newIndex);

      // Atualiza o estado local imediatamente para feedback visual
      setDeliveryData({
        ...deliveryData,
        delivery: newDeliveryOrders
      });

      // Salva a nova ordem no servidor
      saveRouteOrder(newDeliveryOrders);
    }
  };

  const saveRouteOrder = async (orderedDeliveries: any[]) => {
    try {
      console.log('[EMPLOYEE_ENTREGAS] Salvando nova ordem de rota');

      // Cria array com id e nova ordem
      const updates = orderedDeliveries.map((order, index) => ({
        id: order.id,
        deliveryOrder: index + 1
      }));

      const response = await fetch('/api/delivery/orders/route-order', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: updates })
      });

      if (!response.ok) {
        throw new Error('Erro ao salvar ordem de rota');
      }

      toast.success('Ordem de rota atualizada!');
    } catch (error) {
      console.error('[EMPLOYEE_ENTREGAS] Erro ao salvar ordem de rota:', error);
      toast.error('Erro ao salvar ordem de rota');
      // Recarrega os dados em caso de erro
      loadDeliveryData();
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Busca dados do funcionário
      const empRes = await fetch(`/api/employee/profile`);
      if (!empRes.ok) throw new Error('Erro ao carregar perfil');
      const empData = await empRes.json();
      setEmployee(empData);
      
      // ✅ Define limite de crédito e crédito usado usando valores CALCULADOS pela API de profile
      // (mesma lógica usada na aba Clientes do financeiro)
      const limit = empData.creditLimit || 0;
      setCreditLimit(limit);
      setUsedCredit(empData.totalUsed || 0);
      
      console.log('[EMPLOYEE_DASHBOARD] Crédito calculado:', {
        limite: limit,
        utilizado: empData.totalUsed,
        disponivel: empData.availableCredit
      });

      // Busca pagamentos
      const payRes = await fetch('/api/employee/payments');
      if (payRes.ok) {
        const payData = await payRes.json();
        setPayments(payData);
      }

      // Busca documentos
      const docsRes = await fetch('/api/employee/documents');
      if (docsRes.ok) {
        const docsData = await docsRes.json();
        setDocuments(docsData);
      }

      // Busca pedidos do funcionário (apenas para listar pedidos, não para crédito)
      const ordersRes = await fetch('/api/employee/orders');
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setOrders(ordersData.orders || []);
        // ⚠️ NÃO usar ordersData.totalUsed - usar valor da API de profile
      }
      
      // Se o funcionário tem sellerId, carregar funcionalidades de vendedor
      if (empData.sellerId) {
        console.log('🛒 Funcionário tem perfil de vendedor - carregando funcionalidades');
        setHasSeller(true);
        
        // Buscar clientes do vendedor
        const custRes = await fetch('/api/sellers/customers');
        if (custRes.ok) {
          const custData = await custRes.json();
          setCustomers(custData || []);
          console.log(`📋 ${custData.length} clientes carregados`);
        }
        
        // Buscar comissões do vendedor
        const commRes = await fetch('/api/sellers/commission');
        if (commRes.ok) {
          const commData = await commRes.json();
          setCommissions(commData.commissions || []);
          setTotalCommissions(commData.totalCommissions || 0);
          console.log(`💰 Comissões totais: R$ ${commData.totalCommissions}`);
        }
      }
      
      // Se o funcionário é entregador, carregar funcionalidades de entrega
      if (empData.isDeliveryPerson) {
        console.log('🚚 Funcionário é entregador - carregando funcionalidades');
        setIsDeliveryPerson(true);
        
        // Define data inicial (hoje)
        if (typeof window !== 'undefined') {
          const today = new Date().toISOString().split('T')[0];
          setSelectedDeliveryDate(today);
        }
      }

      // Busca folhas de ponto geradas
      const timeRes = await fetch('/api/hr/timesheets');
      if (timeRes.ok) {
        const timeData = await timeRes.json();
        setTimesheets(timeData);

        // Mapear acknowledgments das folhas de ponto
        const tsAcknowledgments: Record<string, boolean> = {};
        timeData.forEach((ts: any) => {
          if (ts.acknowledgments && ts.acknowledgments.length > 0) {
            tsAcknowledgments[ts.id] = true;
          }
        });
        setTimesheetAcknowledgments(tsAcknowledgments);
      }

      // Busca dados de produção do funcionário
      if (employee?.id) {
        // Estatísticas de produção
        const statsRes = await fetch(`/api/production/stats?employeeId=${employee.id}`);
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setProductionStats(statsData);
        }

        // Registros recentes de produção
        const recordsRes = await fetch(`/api/production/records?employeeId=${employee.id}&limit=10`);
        if (recordsRes.ok) {
          const recordsData = await recordsRes.json();
          setProductionRecords(recordsData.records || []);
        }

        // Metas individuais
        const goalsRes = await fetch(`/api/production/goals?employeeId=${employee.id}&goalType=INDIVIDUAL&isActive=true`);
        if (goalsRes.ok) {
          const goalsData = await goalsRes.json();
          setProductionGoals(goalsData.goals || []);
        }
      }

    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  // 🎯 Função para carregar metas e avaliações
  const loadGoalsData = async (month?: string) => {
    try {
      setGoalsLoading(true);
      const monthParam = month || selectedGoalsMonth;
      const res = await fetch(`/api/employee/goals?month=${monthParam}`);
      
      if (res.ok) {
        const data = await res.json();
        setGoalsData(data);
        console.log('[EMPLOYEE_GOALS] Dados carregados:', data);
      } else {
        console.error('[EMPLOYEE_GOALS] Erro ao carregar:', await res.text());
      }
    } catch (error: any) {
      console.error('[EMPLOYEE_GOALS] Erro:', error);
      toast.error('Erro ao carregar metas');
    } finally {
      setGoalsLoading(false);
    }
  };

  // Carregar metas quando o mês mudar
  useEffect(() => {
    if (selectedGoalsMonth && employee) {
      loadGoalsData(selectedGoalsMonth);
    }
  }, [selectedGoalsMonth, employee]);

  // 🖊️ Função para abrir modal de aceite
  const handleOpenAcknowledgeDialog = async (payment: any) => {
    try {
      setSelectedPaymentForAck(payment);
      
      // Buscar termos e condições
      const termsRes = await fetch(`/api/employee/payments/${payment.id}/acknowledge`, {
        method: 'OPTIONS'
      });
      
      if (termsRes.ok) {
        const termsData = await termsRes.json();
        setTermsText(termsData.terms || '');
      }
      
      setShowAcknowledgeDialog(true);
    } catch (error: any) {
      console.error('Erro ao abrir modal de aceite:', error);
      toast.error('Erro ao carregar termos de aceite');
    }
  };

  // 🖊️ Função para aceitar contracheque
  const handleAcknowledgePayment = async () => {
    if (!selectedPaymentForAck || !termsAccepted) {
      toast.error('Você precisa aceitar os termos e condições');
      return;
    }

    console.log('🖊️ [ACKNOWLEDGE] Processando aceite digital...');
    console.log('   Payment ID:', selectedPaymentForAck.id);
    console.log('   Terms Accepted:', termsAccepted);
    console.log('   Session User:', session?.user);
    console.log('   EmployeeId:', (session?.user as any)?.employeeId);
    
    setAcknowledgingPayment(true);

    try {
      console.log('📡 Enviando requisição POST para:', `/api/employee/payments/${selectedPaymentForAck.id}/acknowledge`);
      
      const res = await fetch(`/api/employee/payments/${selectedPaymentForAck.id}/acknowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('📥 Resposta recebida - Status:', res.status);
      
      const data = await res.json();
      console.log('📥 Dados da resposta:', data);

      if (!res.ok) {
        console.error('❌ Erro na resposta:', data);
        throw new Error(data.error || data.details || 'Erro ao aceitar contracheque');
      }

      console.log('✅ [ACKNOWLEDGE] Aceite registrado com sucesso!');
      toast.success('Contracheque aceito digitalmente! ✓');

      // Atualizar estado de aceites
      setPaymentAcknowledgments(prev => ({
        ...prev,
        [selectedPaymentForAck.id]: true
      }));

      // Fechar modal
      setShowAcknowledgeDialog(false);
      setSelectedPaymentForAck(null);
      setTermsAccepted(false);

    } catch (error: any) {
      console.error('❌ [ACKNOWLEDGE] Erro:', error);
      toast.error(error.message || 'Erro ao processar aceite digital');
    } finally {
      setAcknowledgingPayment(false);
    }
  };

  // 🖊️ Função para abrir modal de aceite de timesheet
  const handleOpenTimesheetAckDialog = async (timesheet: any) => {
    try {
      setSelectedTimesheetForAck(timesheet);
      
      // Buscar termos e condições
      const termsRes = await fetch(`/api/hr/timesheets/${timesheet.id}/acknowledge`, {
        method: 'OPTIONS'
      });
      
      if (termsRes.ok) {
        const termsData = await termsRes.json();
        setTimesheetTermsText(termsData.termsText || '');
      }
      
      setShowTimesheetAckDialog(true);
    } catch (error: any) {
      console.error('Erro ao abrir modal de aceite:', error);
      toast.error('Erro ao carregar termos de aceite');
    }
  };

  // 🖊️ Função para aceitar folha de ponto
  const handleAcknowledgeTimesheet = async () => {
    if (!selectedTimesheetForAck || !timesheetTermsAccepted) {
      toast.error('Você precisa aceitar os termos e condições');
      return;
    }

    console.log('🖊️ [TIMESHEET_ACK] Processando aceite digital...');
    console.log('   Timesheet ID:', selectedTimesheetForAck.id);
    console.log('   Terms Accepted:', timesheetTermsAccepted);
    
    setAcknowledgingTimesheet(true);

    try {
      console.log('📡 Enviando requisição POST para:', `/api/hr/timesheets/${selectedTimesheetForAck.id}/acknowledge`);
      
      const res = await fetch(`/api/hr/timesheets/${selectedTimesheetForAck.id}/acknowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          acceptedTerms: true
        })
      });

      console.log('📥 Resposta recebida - Status:', res.status);
      
      const data = await res.json();
      console.log('📥 Dados da resposta:', data);

      if (!res.ok) {
        console.error('❌ Erro na resposta:', data);
        throw new Error(data.error || data.details || 'Erro ao aceitar folha de ponto');
      }

      console.log('✅ [TIMESHEET_ACK] Aceite registrado com sucesso!');
      toast.success('Folha de ponto assinada digitalmente! ✓');

      // Atualizar estado de aceites
      setTimesheetAcknowledgments(prev => ({
        ...prev,
        [selectedTimesheetForAck.id]: true
      }));

      // Fechar modal
      setShowTimesheetAckDialog(false);
      setSelectedTimesheetForAck(null);
      setTimesheetTermsAccepted(false);

    } catch (error: any) {
      console.error('❌ [TIMESHEET_ACK] Erro:', error);
      toast.error(error.message || 'Erro ao processar aceite digital');
    } finally {
      setAcknowledgingTimesheet(false);
    }
  };

  // 🔏 Função para abrir PDF de documento com URL assinada
  const handleViewDocumentPdf = async (doc: any) => {
    try {
      setLoadingPdfId(doc.id);
      
      // Gera URL assinada sob demanda
      const res = await fetch(`/api/employee/documents/${doc.id}/signed-url`);
      
      if (!res.ok) {
        throw new Error('Erro ao gerar URL do documento');
      }
      
      const data = await res.json();
      
      if (data.signedUrl) {
        window.open(data.signedUrl, '_blank');
      } else {
        toast.error('URL do documento não disponível');
      }
    } catch (error: any) {
      console.error('Erro ao abrir PDF:', error);
      toast.error('Erro ao abrir o documento');
    } finally {
      setLoadingPdfId(null);
    }
  };

  // 🔏 Função para abrir modal de aceite de documento
  const handleOpenDocumentAckDialog = (doc: any) => {
    setSelectedDocumentForAck(doc);
    setDocumentTermsText(`
Ao assinar digitalmente esta folha de ponto, você declara que:

1. Revisou todos os registros de entrada e saída apresentados
2. Concorda com as horas trabalhadas, horas extras e faltas registradas
3. As informações apresentadas correspondem fielmente à sua jornada de trabalho
4. Entende que esta assinatura digital tem validade jurídica

Documento: ${doc.title}
    `.trim());
    setShowDocumentAckDialog(true);
  };

  // 🔏 Função para aceitar/assinar documento digitalmente
  const handleAcknowledgeDocument = async () => {
    if (!selectedDocumentForAck || !documentTermsAccepted) {
      toast.error('Você precisa aceitar os termos e condições');
      return;
    }

    console.log('🔏 [DOC_ACK] Processando aceite digital...');
    console.log('   Document ID:', selectedDocumentForAck.id);
    
    setAcknowledgingDocument(true);

    try {
      const res = await fetch(`/api/employee/documents/${selectedDocumentForAck.id}/acknowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          acceptanceText: documentTermsText
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao assinar documento');
      }

      console.log('✅ [DOC_ACK] Documento assinado com sucesso!');
      toast.success('Documento assinado digitalmente! ✓');

      // Atualizar estado de aceites
      setDocumentAcknowledgments(prev => ({
        ...prev,
        [selectedDocumentForAck.id]: true
      }));

      // Fechar modal
      setShowDocumentAckDialog(false);
      setSelectedDocumentForAck(null);
      setDocumentTermsAccepted(false);

    } catch (error: any) {
      console.error('❌ [DOC_ACK] Erro:', error);
      toast.error(error.message || 'Erro ao processar assinatura digital');
    } finally {
      setAcknowledgingDocument(false);
    }
  };

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push('/employee/login');
    toast.success('Logout realizado');
  };

  const getDocumentTypeLabel = (type: string) => {
    const labels: any = {
      CONTRACHEQUE: 'Contracheque',
      FOLHA_PONTO: 'Folha de Ponto',
      ADVERTENCIA: 'Advertência',
      SUSPENSAO: 'Suspensão',
      PREMIACAO: 'Premiação',
      COMPROVANTE: 'Comprovante',
      OUTROS: 'Outros',
    };
    return labels[type] || type;
  };

  const getDocumentTypeBadge = (type: string) => {
    const colors: any = {
      ADVERTENCIA: 'bg-red-500',
      SUSPENSAO: 'bg-orange-500',
      PREMIACAO: 'bg-green-500',
      CONTRACHEQUE: 'bg-blue-500',
      FOLHA_PONTO: 'bg-cyan-500',
      COMPROVANTE: 'bg-gray-500',
      OUTROS: 'bg-purple-500',
    };
    return colors[type] || 'bg-gray-500';
  };

  if (loading || status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Erro ao carregar dados do funcionário</p>
      </div>
    );
  }

  // Filtra documentos por tipo
  const advertencias = documents.filter(d => d.documentType === 'ADVERTENCIA' || d.documentType === 'SUSPENSAO');
  const contracheques = documents.filter(d => d.documentType === 'CONTRACHEQUE');
  const folhasPonto = documents.filter(d => d.documentType === 'FOLHA_PONTO');
  const outros = documents.filter(d => !['ADVERTENCIA', 'SUSPENSAO', 'CONTRACHEQUE', 'FOLHA_PONTO'].includes(d.documentType));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <User className="w-10 h-10" />
              <div>
                <h1 className="text-2xl font-bold">{employee.name}</h1>
                <p className="text-orange-100">
                  {employee.position} • Nº {employee.employeeNumber}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="text-white border-white hover:bg-orange-700" onClick={() => router.push('/')}>
                <Home className="w-4 h-4 mr-2" />
                Início
              </Button>
              <Button variant="outline" className="text-white border-white hover:bg-orange-700" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Departamento</p>
                  <p className="text-xl font-bold">{employee.department?.name || 'N/A'}</p>
                </div>
                <User className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Salário</p>
                  <p className="text-xl font-bold">
                    {employee.salary ? formatCurrency(employee.salary) : 'N/A'}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Admissão</p>
                  <p className="text-xl font-bold">
                    {formatDateSafe(employee.admissionDate)}
                  </p>
                </div>
                <Calendar className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <Badge className={employee.status === 'ACTIVE' ? 'bg-green-500' : 'bg-red-500'}>
                    {employee.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
                <Clock className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="pedidos" className="space-y-4">
          {/* Tabs com scroll horizontal no mobile */}
          <div className="overflow-x-auto -mx-4 px-4 pb-2">
            <TabsList className="flex w-max min-w-full md:grid md:w-full md:grid-cols-6 lg:grid-cols-7 gap-1">
              <TabsTrigger value="pedidos" className="flex items-center gap-1 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
                <ShoppingCart className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">Pedidos</span>
              </TabsTrigger>
              <TabsTrigger value="pagamentos" className="flex items-center gap-1 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
                <DollarSign className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">Pagamentos</span>
              </TabsTrigger>
              <TabsTrigger value="contracheques" className="flex items-center gap-1 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
                <ClipboardList className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">Contracheques</span>
              </TabsTrigger>
              <TabsTrigger value="folhas-ponto" className="flex items-center gap-1 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
                <Calendar className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">Folhas de Ponto</span>
              </TabsTrigger>
              <TabsTrigger value="producao" className="flex items-center gap-1 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
                <Package className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">Produção</span>
              </TabsTrigger>
              <TabsTrigger value="advertencias" className="flex items-center gap-1 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">Advertências</span>
              </TabsTrigger>
              <TabsTrigger value="metas" className="flex items-center gap-1 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
                <Target className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">Metas</span>
              </TabsTrigger>
              
              {/* Tab de Entregador (somente se for entregador) */}
              {isDeliveryPerson && (
                <TabsTrigger value="entregas" className="flex items-center gap-1 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
                  <Truck className="w-4 h-4 flex-shrink-0" />
                  <span className="hidden sm:inline">Entregas</span>
                </TabsTrigger>
              )}
              
              {/* Tabs de Vendedor (somente se tiver perfil vinculado) */}
              {hasSeller && (
                <>
                  <TabsTrigger value="clientes" className="flex items-center gap-1 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
                    <Users className="w-4 h-4 flex-shrink-0" />
                    <span className="hidden sm:inline">Clientes</span>
                  </TabsTrigger>
                  <TabsTrigger value="comissoes" className="flex items-center gap-1 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
                    <TrendingUp className="w-4 h-4 flex-shrink-0" />
                    <span className="hidden sm:inline">Comissões</span>
                  </TabsTrigger>
                  <TabsTrigger value="novo-pedido" className="flex items-center gap-1 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
                    <Plus className="w-4 h-4 flex-shrink-0" />
                    <span className="hidden sm:inline">Novo Pedido</span>
                  </TabsTrigger>
                </>
              )}
              
              {/* Tab de Encarregado (somente se for supervisor) */}
              {employee?.isSupervisor && (
                <TabsTrigger value="equipe" className="flex items-center gap-1 px-3 py-2 text-xs sm:text-sm whitespace-nowrap bg-purple-100">
                  <Users className="w-4 h-4 flex-shrink-0 text-purple-600" />
                  <span className="hidden sm:inline text-purple-700">Minha Equipe</span>
                </TabsTrigger>
              )}
              
              {/* Tab Avaliar Liderança - para todos os funcionários */}
              <TabsTrigger value="avaliar-lideranca" className="flex items-center gap-1 px-3 py-2 text-xs sm:text-sm whitespace-nowrap bg-pink-100">
                <Award className="w-4 h-4 flex-shrink-0 text-pink-600" />
                <span className="hidden sm:inline text-pink-700">Avaliar Líder</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Aba Pedidos */}
          <TabsContent value="pedidos">
            <Card>
              <CardHeader>
                <CardTitle>Fazer Pedidos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Info de Crédito */}
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="text-center sm:text-left p-2 bg-white/50 rounded-lg">
                          <p className="text-xs sm:text-sm text-gray-600">Limite de Crédito</p>
                          <p className="text-xl sm:text-2xl font-bold text-blue-600">
                            {formatCurrency(creditLimit)}
                          </p>
                        </div>
                        <div className="text-center sm:text-left p-2 bg-white/50 rounded-lg">
                          <p className="text-xs sm:text-sm text-gray-600">Crédito Usado</p>
                          <p className={`text-xl sm:text-2xl font-bold ${usedCredit > 0 ? 'text-orange-600' : 'text-gray-500'}`}>
                            {formatCurrency(usedCredit)}
                            {creditLimit > 0 && usedCredit > 0 && (
                              <span className="text-xs ml-1">({Math.round((usedCredit / creditLimit) * 100)}%)</span>
                            )}
                          </p>
                        </div>
                        <div className="text-center sm:text-left p-2 bg-white/50 rounded-lg">
                          <p className="text-xs sm:text-sm text-gray-600">Crédito Disponível</p>
                          <p className={`text-xl sm:text-2xl font-bold ${(creditLimit - usedCredit) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {(creditLimit - usedCredit) < 0 ? '-' : ''}{formatCurrency(Math.abs(creditLimit - usedCredit))}
                          </p>
                        </div>
                      </div>
                      {/* Alertas de crédito */}
                      {(creditLimit - usedCredit) < 0 && (
                        <div className="mt-3 p-2 bg-red-100 border border-red-300 rounded-lg">
                          <p className="text-sm text-red-700 font-medium">
                            ⚠️ Seu limite de crédito está negativo. Regularize seus débitos para continuar comprando.
                          </p>
                        </div>
                      )}
                      {employee?.overdueBoletosCount > 0 && (
                        <div className="mt-2 p-2 bg-orange-100 border border-orange-300 rounded-lg">
                          <p className="text-sm text-orange-700 font-medium">
                            ⏰ Você tem {employee.overdueBoletosCount} conta(s) em atraso.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Botão para fazer novo pedido */}
                  <Button 
                    className="w-full bg-orange-500 hover:bg-orange-600"
                    onClick={() => router.push('/seller/orders/new/select')}
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Fazer Novo Pedido
                  </Button>

                  {/* Lista de Pedidos */}
                  <div className="space-y-3">
                    <h3 className="font-semibold">Meus Pedidos</h3>
                    {orders.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">
                        Nenhum pedido realizado ainda.
                      </p>
                    ) : (
                      orders.map((order: any) => (
                        <Card key={order.id} className="bg-gray-50">
                          <CardContent className="pt-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold">Pedido #{order.orderNumber}</p>
                                <p className="text-sm text-gray-600">
                                  {formatDateSafe(order.createdAt, 'dd/MM/yyyy HH:mm')}
                                </p>
                                <p className="text-sm font-bold mt-1">
                                  Total: {formatCurrency(order.total)}
                                </p>
                              </div>
                              <Badge className={
                                order.status === 'DELIVERED' ? 'bg-green-500' :
                                order.status === 'PENDING' ? 'bg-yellow-500' :
                                order.status === 'CANCELLED' ? 'bg-red-500' :
                                'bg-blue-500'
                              }>
                                {order.status === 'DELIVERED' ? 'Entregue' :
                                 order.status === 'PENDING' ? 'Pendente' :
                                 order.status === 'CANCELLED' ? 'Cancelado' :
                                 order.status}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Pagamentos */}
          <TabsContent value="pagamentos">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Pagamentos</CardTitle>
              </CardHeader>
              <CardContent>
                {payments.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    Nenhum pagamento registrado ainda.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {payments.map((payment: any) => (
                      <Card key={payment.id} className="bg-gray-50">
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold">
                                {payment.payrollSheet 
                                  ? `${payment.payrollSheet.month}/${payment.payrollSheet.year}`
                                  : 'Pagamento Avulso'
                                }
                              </p>
                              <p className="text-sm text-gray-600 mt-1">
                                Total: {formatCurrency(payment.totalAmount)}
                              </p>
                            </div>
                            <Badge className={payment.isPaid ? 'bg-green-500' : 'bg-yellow-500'}>
                              {payment.isPaid ? 'Pago' : 'Pendente'}
                            </Badge>
                          </div>

                          {/* Info: Assinatura é feita na aba Contracheques */}
                          <div className="mt-4 pt-3 border-t border-gray-200">
                            <p className="text-xs text-gray-500 text-center">
                              A assinatura digital é feita na aba <strong>Contracheques</strong>
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Contracheques */}
          <TabsContent value="contracheques">
            <Card>
              <CardHeader>
                <CardTitle>Contracheques e Holerites</CardTitle>
              </CardHeader>
              <CardContent>
                {contracheques.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    Nenhum contracheque disponível ainda.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {contracheques.map((doc: any) => {
                      // Determinar se é Adiantamento baseado no título
                      const isAdvance = doc.title?.toLowerCase().includes('adiantamento') || 
                                        (doc.title && doc.title.includes('/') && doc.referenceMonth === 2);
                      // Verificar se é adiantamento pelo salaryGrossAmount = 0 nos pagamentos
                      const isAdvanceByTitle = doc.title?.toLowerCase().includes('adiantamento');
                      
                      return (
                      <Card key={doc.id} className={isAdvanceByTitle ? "bg-purple-50 border-purple-200" : "bg-blue-50 border-blue-200"}>
                        <CardContent className="pt-4">
                          <div className="flex flex-col gap-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge className={isAdvanceByTitle ? "bg-purple-500" : "bg-blue-500"}>
                                    {isAdvanceByTitle ? 'Adiantamento' : 'Contracheque'}
                                  </Badge>
                                  <p className="text-sm text-gray-600">
                                    {formatReferenceMonth(doc.referenceDate)}
                                  </p>
                                </div>
                                <h4 className="font-semibold">{doc.title}</h4>
                                {doc.description && (
                                  <p className="text-sm text-gray-600 mt-1">{doc.description}</p>
                                )}
                              </div>
                              {doc.fileUrl && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleViewDocumentPdf(doc)}
                                  disabled={loadingPdfId === doc.id}
                                >
                                  {loadingPdfId === doc.id ? (
                                    <>
                                      <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                      </svg>
                                      Carregando...
                                    </>
                                  ) : (
                                    <>
                                      <FileText className="w-4 h-4 mr-2" />
                                      Ver PDF
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                            
                            {/* Botão de Assinatura Digital */}
                            <div className="pt-2 border-t border-blue-200">
                              {documentAcknowledgments[doc.id] ? (
                                <div className="flex items-center gap-2 bg-green-50 px-3 py-2 rounded-md border border-green-200">
                                  <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span className="font-medium text-sm text-green-700">Assinado Digitalmente ✓</span>
                                </div>
                              ) : (
                                <Button
                                  onClick={() => handleOpenDocumentAckDialog(doc)}
                                  className="bg-blue-600 hover:bg-blue-700 text-white"
                                  size="sm"
                                >
                                  <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                  Assinar Digitalmente
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )})}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Folhas de Ponto */}
          <TabsContent value="folhas-ponto">
            <Card>
              <CardHeader>
                <CardTitle>Folhas de Ponto</CardTitle>
              </CardHeader>
              <CardContent>
                {folhasPonto.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    Nenhuma folha de ponto disponível ainda.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {folhasPonto.map((doc: any) => (
                      <Card key={doc.id} className="bg-cyan-50 border-cyan-200">
                        <CardContent className="pt-4">
                          <div className="flex flex-col gap-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge className="bg-cyan-500">
                                    Folha de Ponto
                                  </Badge>
                                  <p className="text-sm text-gray-600">
                                    {formatReferenceMonth(doc.referenceDate)}
                                  </p>
                                </div>
                                <h4 className="font-semibold">{doc.title}</h4>
                                {doc.notes && (
                                  <p className="text-sm text-gray-600 mt-1">{doc.notes}</p>
                                )}
                                <p className="text-xs text-gray-500 mt-2">
                                  Gerado automaticamente em {formatDateSafe(doc.createdAt, "dd/MM/yyyy, HH:mm:ss")}
                                </p>
                              </div>
                              {doc.fileUrl && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleViewDocumentPdf(doc)}
                                  disabled={loadingPdfId === doc.id}
                                >
                                  {loadingPdfId === doc.id ? (
                                    <>
                                      <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                      </svg>
                                      Carregando...
                                    </>
                                  ) : (
                                    <>
                                      <FileText className="w-4 h-4 mr-2" />
                                      Ver PDF
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                            
                            {/* Botão de Assinatura Digital */}
                            <div className="pt-2 border-t border-cyan-200">
                              {documentAcknowledgments[doc.id] ? (
                                <div className="flex items-center gap-2 bg-green-50 px-3 py-2 rounded-md border border-green-200">
                                  <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span className="font-medium text-sm text-green-700">Assinada Digitalmente ✓</span>
                                </div>
                              ) : (
                                <Button
                                  onClick={() => handleOpenDocumentAckDialog(doc)}
                                  className="bg-blue-600 hover:bg-blue-700 text-white"
                                  size="sm"
                                >
                                  <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                  Assinar Digitalmente
                                </Button>
                              )}
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

          {/* Aba Produção */}
          <TabsContent value="producao">
            <div className="space-y-6">
              {/* Estatísticas de Produção */}
              {productionStats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Produzido</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <Package className="h-8 w-8 text-blue-600" />
                        <span className="text-3xl font-bold">{productionStats.totalProduced || 0}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Unidades totais</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Taxa de Qualidade</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-8 w-8 text-green-600" />
                        <span className="text-3xl font-bold">
                          {productionStats.averageQuality ? `${productionStats.averageQuality.toFixed(1)}%` : 'N/A'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Qualidade média</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Dias Trabalhados</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-8 w-8 text-purple-600" />
                        <span className="text-3xl font-bold">{productionStats.workDays || 0}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">No período</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Metas Atingidas</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <Target className="h-8 w-8 text-orange-600" />
                        <span className="text-3xl font-bold">{productionStats.goalsAchieved || 0}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        De {productionStats.totalGoals || 0} metas
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Metas Individuais */}
              {productionGoals.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Minhas Metas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {productionGoals.map((goal: any) => {
                        const progress = goal.targetQuantity > 0 
                          ? Math.min((goal.currentProgress / goal.targetQuantity) * 100, 100)
                          : 0;
                        const isAchieved = progress >= 100;
                        
                        return (
                          <div key={goal.id} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Target className={`h-5 w-5 ${isAchieved ? 'text-green-600' : 'text-orange-600'}`} />
                                <h3 className="font-semibold">
                                  {goal.Product?.name || 'Produto não especificado'}
                                </h3>
                              </div>
                              <Badge variant={isAchieved ? 'default' : 'secondary'}>
                                {goal.period === 'DAILY' && 'Diária'}
                                {goal.period === 'WEEKLY' && 'Semanal'}
                                {goal.period === 'MONTHLY' && 'Mensal'}
                              </Badge>
                            </div>
                            
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Progresso</span>
                                <span className="font-medium">
                                  {goal.currentProgress || 0} / {goal.targetQuantity} unidades
                                </span>
                              </div>
                              
                              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    isAchieved ? 'bg-green-600' : 'bg-orange-600'
                                  }`}
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                              
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">
                                  {formatDateSafe(goal.startDate)} - {formatDateSafe(goal.endDate)}
                                </span>
                                <span className={`font-semibold ${isAchieved ? 'text-green-600' : 'text-orange-600'}`}>
                                  {progress.toFixed(1)}%
                                </span>
                              </div>

                              {goal.bonusValue && (
                                <div className="mt-2 flex items-center gap-1 text-xs text-green-700 bg-green-50 p-2 rounded">
                                  <DollarSign className="h-4 w-4" />
                                  <span>Bônus: {formatCurrency(goal.bonusValue)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Histórico de Produção Recente */}
              <Card>
                <CardHeader>
                  <CardTitle>Registros de Produção Recentes</CardTitle>
                </CardHeader>
                <CardContent>
                  {productionRecords.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                      <p>Nenhum registro de produção encontrado</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {productionRecords.map((record: any) => (
                        <div key={record.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Package className="h-5 w-5 text-blue-600" />
                              <h3 className="font-semibold">{record.product?.name || 'Produto'}</h3>
                            </div>
                            <Badge>
                              {record.shift === 'MORNING' && 'Manhã'}
                              {record.shift === 'AFTERNOON' && 'Tarde'}
                              {record.shift === 'NIGHT' && 'Noite'}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                              <p className="text-muted-foreground">Data</p>
                              <p className="font-medium">{formatDateSafe(record.date)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Quantidade</p>
                              <p className="font-medium text-blue-700">{record.quantity} un</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Qualidade</p>
                              <p className="font-medium text-green-700">{record.qualityScore || 100}%</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Rejeitados</p>
                              <p className="font-medium text-red-700">{record.rejectedQuantity || 0} un</p>
                            </div>
                          </div>

                          {record.notes && (
                            <div className="mt-2 text-xs text-muted-foreground bg-gray-50 p-2 rounded">
                              <span className="font-semibold">Obs:</span> {record.notes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Aba Advertências */}
          <TabsContent value="advertencias">
            <Card>
              <CardHeader>
                <CardTitle>Advertências e Suspensões</CardTitle>
              </CardHeader>
              <CardContent>
                {advertencias.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    Nenhuma advertência ou suspensão registrada.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {advertencias.map((doc: any) => (
                      <Card key={doc.id} className="bg-red-50 border-red-200">
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge className={getDocumentTypeBadge(doc.documentType)}>
                                  {getDocumentTypeLabel(doc.documentType)}
                                </Badge>
                                <p className="text-sm text-gray-600">
                                  {formatDateSafe(doc.referenceDate)}
                                </p>
                              </div>
                              <h4 className="font-semibold">{doc.title}</h4>
                              {doc.description && (
                                <p className="text-sm text-gray-600 mt-1">{doc.description}</p>
                              )}
                            </div>
                            {doc.fileUrl && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => window.open(doc.fileUrl, '_blank')}
                              >
                                <FileText className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Metas */}
          <TabsContent value="metas">
            <div className="space-y-6">
              {/* Header com seletor de mês */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-orange-500" />
                    Metas e Desempenho
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Input
                      type="month"
                      value={selectedGoalsMonth}
                      onChange={(e) => setSelectedGoalsMonth(e.target.value)}
                      className="w-40"
                    />
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => loadGoalsData()}
                      disabled={goalsLoading}
                    >
                      <RefreshCw className={`w-4 h-4 ${goalsLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </CardHeader>
              </Card>

              {goalsLoading ? (
                <Card>
                  <CardContent className="py-8">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-orange-500" />
                      <span>Carregando metas...</span>
                    </div>
                  </CardContent>
                </Card>
              ) : goalsData ? (
                <>
                  {/* Estatísticas Resumidas */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="border-l-4 border-l-blue-500">
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <Target className="w-6 h-6 mx-auto mb-1 text-blue-500" />
                          <p className="text-xs text-gray-600">Metas Definidas</p>
                          <p className="text-2xl font-bold text-blue-600">{goalsData.stats?.totalGoals || 0}</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-green-500">
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-green-500" />
                          <p className="text-xs text-gray-600">Metas Atingidas</p>
                          <p className="text-2xl font-bold text-green-600">{goalsData.stats?.achievedGoals || 0}</p>
                          <p className="text-xs text-gray-500">{goalsData.stats?.achievementRate || 0}% de sucesso</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-yellow-500">
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <Star className="w-6 h-6 mx-auto mb-1 text-yellow-500" />
                          <p className="text-xs text-gray-600">Avaliação Média</p>
                          <p className="text-2xl font-bold text-yellow-600">{goalsData.stats?.avgRating || 0}</p>
                          <p className="text-xs text-gray-500">de 5 estrelas</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-purple-500">
                      <CardContent className="pt-4">
                        <div className="text-center">
                          <Award className="w-6 h-6 mx-auto mb-1 text-purple-500" />
                          <p className="text-xs text-gray-600">Bonificações</p>
                          <p className="text-2xl font-bold text-purple-600">{formatCurrency(goalsData.stats?.totalBonus || 0)}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Lista de Metas */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 text-blue-500" />
                        Minhas Metas do Mês
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {goalsData.goals?.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <Target className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                          <p>Nenhuma meta definida para este mês</p>
                          <p className="text-sm">Seu encarregado ainda não definiu metas para você.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {goalsData.goals?.map((goal: any) => {
                            const evaluation = goalsData.evaluations?.find((e: any) => e.goal?.description === goal.description);
                            return (
                              <div key={goal.id} className={`p-4 rounded-lg border ${evaluation?.achieved ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <p className="font-semibold">{goal.description}</p>
                                      {evaluation?.achieved && (
                                        <Badge className="bg-green-500">✓ Atingida</Badge>
                                      )}
                                      {evaluation && !evaluation.achieved && (
                                        <Badge variant="destructive">✗ Não atingida</Badge>
                                      )}
                                      {!evaluation && (
                                        <Badge variant="outline">Pendente</Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1">
                                      📅 {formatDateSafe(goal.date, 'dd/MM/yyyy')} • 
                                      {goal.targetQuantity && ` 🎯 Meta: ${goal.targetQuantity} unidades • `}
                                      {goal.bonusAmount && ` 💰 Bônus: ${formatCurrency(goal.bonusAmount)}`}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      Definida por: {goal.createdBy}
                                    </p>
                                  </div>
                                  {evaluation && (
                                    <div className="text-right">
                                      <div className="flex items-center gap-1">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                          <Star 
                                            key={star} 
                                            className={`w-4 h-4 ${star <= (evaluation.rating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} 
                                          />
                                        ))}
                                      </div>
                                      {evaluation.bonusEarned > 0 && (
                                        <p className="text-sm text-green-600 font-semibold mt-1">
                                          +{formatCurrency(evaluation.bonusEarned)}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Lista de Avaliações */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Star className="w-5 h-5 text-yellow-500" />
                        Avaliações do Encarregado
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {goalsData.evaluations?.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <Star className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                          <p>Nenhuma avaliação recebida este mês</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {goalsData.evaluations?.map((evaluation: any) => (
                            <div key={evaluation.id} className="p-4 rounded-lg border bg-white">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <p className="font-semibold">{formatDateSafe(evaluation.date, 'dd/MM/yyyy (EEEE)')}</p>
                                    {evaluation.achieved ? (
                                      <ThumbsUp className="w-4 h-4 text-green-500" />
                                    ) : (
                                      <ThumbsDown className="w-4 h-4 text-red-500" />
                                    )}
                                  </div>
                                  {evaluation.goal && (
                                    <p className="text-sm text-gray-600 mb-2">
                                      Meta: {evaluation.goal.description}
                                      {evaluation.achievedQuantity && ` (Produzido: ${evaluation.achievedQuantity})`}
                                    </p>
                                  )}
                                  <div className="flex flex-wrap gap-2 mb-2">
                                    {evaluation.punctuality !== null && (
                                      <Badge variant={evaluation.punctuality >= 4 ? 'default' : 'secondary'}>
                                        ⏰ Pontualidade: {evaluation.punctuality}/5
                                      </Badge>
                                    )}
                                    {evaluation.attitude !== null && (
                                      <Badge variant={['EXCELLENT', 'GOOD'].includes(evaluation.attitude) ? 'default' : 'secondary'}>
                                        😊 Atitude: {
                                          evaluation.attitude === 'EXCELLENT' ? 'Excelente' :
                                          evaluation.attitude === 'GOOD' ? 'Bom' :
                                          evaluation.attitude === 'REGULAR' ? 'Regular' :
                                          evaluation.attitude === 'NEEDS_IMPROVEMENT' ? 'Precisa Melhorar' :
                                          evaluation.attitude
                                        }
                                      </Badge>
                                    )}
                                    {evaluation.quality !== null && (
                                      <Badge variant={['EXCELLENT', 'GOOD'].includes(evaluation.quality) ? 'default' : 'secondary'}>
                                        ✨ Qualidade: {
                                          evaluation.quality === 'EXCELLENT' ? 'Excelente' :
                                          evaluation.quality === 'GOOD' ? 'Bom' :
                                          evaluation.quality === 'REGULAR' ? 'Regular' :
                                          evaluation.quality === 'NEEDS_IMPROVEMENT' ? 'Precisa Melhorar' :
                                          evaluation.quality
                                        }
                                      </Badge>
                                    )}
                                  </div>
                                  {evaluation.observations && (
                                    <p className="text-sm text-gray-700 italic bg-gray-50 p-2 rounded">
                                      "{evaluation.observations}"
                                    </p>
                                  )}
                                  <p className="text-xs text-gray-500 mt-2">
                                    Avaliado por: {evaluation.evaluator}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <div className="flex items-center gap-1">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <Star 
                                        key={star} 
                                        className={`w-5 h-5 ${star <= (evaluation.rating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} 
                                      />
                                    ))}
                                  </div>
                                  <p className="text-sm font-semibold mt-1">
                                    {evaluation.rating || 0}/5
                                  </p>
                                  {evaluation.bonusEarned > 0 && (
                                    <p className="text-sm text-green-600 font-bold mt-1">
                                      +{formatCurrency(evaluation.bonusEarned)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Produção Mensal */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-green-500" />
                        Produção Mensal
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
                        <p className="text-center">
                          <span className="text-3xl font-bold text-green-600">{goalsData.stats?.totalProduction || 0}</span>
                          <span className="text-gray-600 ml-2">unidades produzidas</span>
                        </p>
                      </div>

                      {goalsData.charts?.productionSummary?.length > 0 ? (
                        <div className="space-y-2">
                          <p className="font-semibold text-sm text-gray-600 mb-3">Produção por Produto:</p>
                          {goalsData.charts.productionSummary.map((item: any, index: number) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <span className="font-medium">{item.product}</span>
                              <Badge variant="outline">{item.quantity} unidades</Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center text-gray-500">Nenhum registro de produção este mês</p>
                      )}

                      {goalsData.charts?.dailyProduction?.length > 0 && (
                        <div className="mt-6">
                          <p className="font-semibold text-sm text-gray-600 mb-3">Produção Diária:</p>
                          <div className="grid grid-cols-7 gap-1">
                            {goalsData.charts.dailyProduction.slice(-14).map((day: any, index: number) => (
                              <div 
                                key={index} 
                                className="text-center p-2 rounded bg-green-100 hover:bg-green-200 transition-colors"
                                title={`${day.date}: ${day.quantity} unidades`}
                              >
                                <p className="text-xs text-gray-500">{day.date.split('-')[2]}</p>
                                <p className="text-sm font-bold text-green-700">{day.quantity}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardContent className="py-8">
                    <div className="text-center text-gray-500">
                      <Target className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>Selecione um mês para ver suas metas e avaliações</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Aba Clientes (VENDEDOR) */}
          {hasSeller && (
            <TabsContent value="clientes">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Meus Clientes</CardTitle>
                  <Button onClick={() => router.push('/seller/customers')}>
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Cliente
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {customers.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">Nenhum cliente cadastrado ainda</p>
                    ) : (
                      <div className="grid gap-4">
                        {customers.map((customer) => (
                          <Card key={customer.id} className="border-l-4 border-blue-500">
                            <CardContent className="pt-4">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h3 className="font-semibold text-lg">{customer.name}</h3>
                                  <p className="text-sm text-gray-600">{customer.phone}</p>
                                  <p className="text-sm text-gray-600">{customer.city}</p>
                                  {customer.paymentStatus && (
                                    <Badge className={customer.paymentStatus === 'overdue' ? 'bg-red-500' : 'bg-green-500'}>
                                      {customer.paymentStatus === 'overdue' ? 'Em Atraso' : 'Em Dia'}
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-right">
                                  <p className="text-sm text-gray-600">Limite de Crédito</p>
                                  <p className="text-lg font-bold">{formatCurrency(customer.creditLimit)}</p>
                                  <p className="text-xs text-gray-500">{customer._count?.Order || 0} pedidos</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Aba Comissões (VENDEDOR) */}
          {hasSeller && (
            <TabsContent value="comissoes">
              <Card>
                <CardHeader>
                  <CardTitle>Minhas Comissões</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-6 p-4 bg-green-50 rounded-lg border-2 border-green-500">
                    <p className="text-sm text-gray-600">Total em Comissões</p>
                    <p className="text-3xl font-bold text-green-600">{formatCurrency(totalCommissions)}</p>
                  </div>

                  <div className="space-y-4">
                    {commissions.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">Nenhuma comissão registrada ainda</p>
                    ) : (
                      <div className="space-y-3">
                        {commissions.map((commission: any) => (
                          <Card key={commission.id} className="border-l-4 border-green-500">
                            <CardContent className="pt-4">
                              <div className="flex justify-between items-center">
                                <div>
                                  <h4 className="font-semibold">
                                    {commission.Order?.Customer?.name || 'Cliente não identificado'}
                                  </h4>
                                  <p className="text-sm text-gray-600">
                                    Pedido #{commission.Order?.orderNumber}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {formatDateSafe(commission.createdAt)}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-lg font-bold text-green-600">
                                    {formatCurrency(commission.commissionAmount)}
                                  </p>
                                  <Badge className={commission.status === 'PAID' ? 'bg-green-500' : 'bg-yellow-500'}>
                                    {commission.status === 'PAID' ? 'Pago' : 'Pendente'}
                                  </Badge>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Aba Entregas (ENTREGADOR) */}
          {isDeliveryPerson && (
            <TabsContent value="entregas">
              <div className="space-y-4">
                {/* Filtro de Data */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-end gap-4">
                      <div className="flex-1">
                        <Label htmlFor="delivery-date">Data</Label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            id="delivery-date"
                            type="date"
                            value={selectedDeliveryDate}
                            onChange={(e) => setSelectedDeliveryDate(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                      </div>
                      <Button 
                        onClick={loadDeliveryData}
                        disabled={deliveryLoading}
                      >
                        <RefreshCw className={`w-4 h-4 mr-2 ${deliveryLoading ? 'animate-spin' : ''}`} />
                        Atualizar
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {deliveryData && (
                  <>
                    {/* Cards de Resumo */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
                            {formatDate(selectedDeliveryDate)}
                          </p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium text-gray-600">
                            Para Entrega
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-blue-600">
                            {deliveryData.summary.delivery}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Delivery
                          </p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium text-gray-600">
                            Para Retirada
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-purple-600">
                            {deliveryData.summary.pickup}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Pickup
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

                    {/* Tabs Delivery/Pickup */}
                    <div className="border-b">
                      <div className="flex justify-between items-center">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSelectedDeliveryTab('delivery')}
                            className={`px-4 py-2 font-medium transition-colors ${
                              selectedDeliveryTab === 'delivery'
                                ? 'text-orange-600 border-b-2 border-orange-600'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            <Truck className="w-4 h-4 inline mr-2" />
                            Entregas ({deliveryData.summary.delivery})
                          </button>
                          <button
                            onClick={() => setSelectedDeliveryTab('pickup')}
                            className={`px-4 py-2 font-medium transition-colors ${
                              selectedDeliveryTab === 'pickup'
                                ? 'text-orange-600 border-b-2 border-orange-600'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            <Package className="w-4 h-4 inline mr-2" />
                            Retiradas ({deliveryData.summary.pickup})
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={toggleSelectMode}
                            variant={isSelectMode ? 'default' : 'outline'}
                            size="sm"
                            className="mb-2"
                          >
                            {isSelectMode ? (
                              <>
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Modo Seleção
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Selecionar Múltiplos
                              </>
                            )}
                          </Button>
                          {selectedDeliveryTab === 'delivery' && !isSelectMode && (
                            <Button
                              onClick={() => setReorderingRoute(!reorderingRoute)}
                              variant={reorderingRoute ? 'default' : 'outline'}
                              size="sm"
                              className="mb-2"
                            >
                              {reorderingRoute ? (
                                <>
                                  <CheckCircle2 className="w-4 h-4 mr-2" />
                                  Finalizar Organização
                                </>
                              ) : (
                                <>
                                  <MapPin className="w-4 h-4 mr-2" />
                                  Organizar Rota
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Barra de Seleção Múltipla */}
                    {isSelectMode && (
                      <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-gray-700">
                              {selectedOrders.size} pedido(s) selecionado(s)
                            </span>
                            <Button
                              onClick={() => {
                                const currentOrders = selectedDeliveryTab === 'delivery' 
                                  ? deliveryData.delivery 
                                  : deliveryData.pickup;
                                selectAllOrders(currentOrders);
                              }}
                              variant="outline"
                              size="sm"
                            >
                              Selecionar Todos
                            </Button>
                            <Button
                              onClick={clearSelection}
                              variant="outline"
                              size="sm"
                            >
                              Limpar Seleção
                            </Button>
                          </div>
                          {selectedOrders.size > 0 && (
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handleBulkStatusChange('READY')}
                                disabled={updatingStatus}
                                variant="outline"
                                size="sm"
                                className="border-blue-500 text-blue-600 hover:bg-blue-50"
                              >
                                <Package className="w-4 h-4 mr-1" />
                                Marcar Pronto
                              </Button>
                              <Button
                                onClick={() => handleBulkStatusChange('DELIVERING')}
                                disabled={updatingStatus}
                                variant="outline"
                                size="sm"
                                className="border-orange-500 text-orange-600 hover:bg-orange-50"
                              >
                                <Truck className="w-4 h-4 mr-1" />
                                Saiu para Entrega
                              </Button>
                              <Button
                                onClick={() => handleBulkStatusChange('DELIVERED')}
                                disabled={updatingStatus}
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white"
                              >
                                <CheckCircle2 className="w-4 h-4 mr-1" />
                                Marcar Entregue
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Lista de Pedidos */}
                    {(() => {
                      const currentOrders = selectedDeliveryTab === 'delivery' 
                        ? deliveryData.delivery 
                        : deliveryData.pickup;

                      if (currentOrders.length === 0) {
                        return (
                          <Card>
                            <CardContent className="py-12">
                              <div className="text-center text-gray-500">
                                <Package className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                                <p className="text-lg font-medium mb-2">
                                  Nenhum pedido encontrado
                                </p>
                                <p className="text-sm">
                                  Não há {selectedDeliveryTab === 'delivery' ? 'entregas' : 'retiradas'} para esta data
                                </p>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      }

                      // Modo de reordenação para entregas
                      if (selectedDeliveryTab === 'delivery' && reorderingRoute) {
                        return (
                          <div>
                            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                              <p className="text-sm text-blue-800 flex items-center gap-2">
                                <MapPin className="w-4 h-4" />
                                <strong>Modo de Organização:</strong> Arraste os pedidos pela área cinza para reordená-los na sequência de entrega
                              </p>
                            </div>
                            <DndContext 
                              sensors={sensors}
                              collisionDetection={closestCenter}
                              onDragEnd={handleDragEnd}
                            >
                              <SortableContext 
                                items={currentOrders.map((o: any) => o.id)}
                                strategy={verticalListSortingStrategy}
                              >
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                  {currentOrders.map((order: any, index: number) => (
                                    <div key={order.id} className="relative">
                                      <div className="absolute -left-2 -top-2 w-8 h-8 bg-orange-600 text-white rounded-full flex items-center justify-center font-bold text-sm z-10 shadow-md">
                                        {index + 1}
                                      </div>
                                      <SortableOrderCard
                                        order={order}
                                        onOrderClick={(order: any) => {
                                          setSelectedOrder(order);
                                          setShowOrderModal(true);
                                        }}
                                        formatCurrency={formatCurrency}
                                        getStatusBadge={getStatusBadge}
                                        isReordering={true}
                                        isSelectMode={false}
                                        isSelected={false}
                                        onToggleSelect={() => {}}
                                        onQuickDelivered={handleQuickDelivered}
                                      />
                                    </div>
                                  ))}
                                </div>
                              </SortableContext>
                            </DndContext>
                          </div>
                        );
                      }

                      // Modo normal
                      return (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {currentOrders.map((order: any) => (
                            <SortableOrderCard
                              key={order.id}
                              order={order}
                              onOrderClick={(order: any) => {
                                setSelectedOrder(order);
                                setShowOrderModal(true);
                              }}
                              formatCurrency={formatCurrency}
                              getStatusBadge={getStatusBadge}
                              isReordering={false}
                              isSelectMode={isSelectMode}
                              isSelected={selectedOrders.has(order.id)}
                              onToggleSelect={toggleOrderSelection}
                              onQuickDelivered={handleQuickDelivered}
                            />
                          ))}
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            </TabsContent>
          )}

          {/* Aba Novo Pedido (VENDEDOR) */}
          {hasSeller && (
            <TabsContent value="novo-pedido">
              <Card>
                <CardHeader>
                  <CardTitle>Fazer Novo Pedido</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card className="border-2 border-blue-500 hover:border-blue-700 cursor-pointer transition-colors"
                            onClick={() => {
                              // Ir para página de novo pedido PARA SI MESMO (sem comissão)
                              localStorage.setItem('seller_order_is_own', 'true');
                              router.push('/seller/orders/new/select');
                            }}>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-blue-500" />
                            <h3 className="font-bold text-lg mb-2">Pedido Para Mim</h3>
                            <p className="text-sm text-gray-600">
                              Fazer um pedido pessoal
                            </p>
                            <p className="text-xs text-gray-500 mt-2">
                              ❌ Sem comissão
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-2 border-green-500 hover:border-green-700 cursor-pointer transition-colors"
                            onClick={() => {
                              // Ir para página de novo pedido PARA CLIENTE (com comissão)
                              localStorage.removeItem('seller_order_is_own');
                              router.push('/seller/orders/new/select');
                            }}>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <Users className="w-12 h-12 mx-auto mb-4 text-green-500" />
                            <h3 className="font-bold text-lg mb-2">Pedido Para Cliente</h3>
                            <p className="text-sm text-gray-600">
                              Fazer um pedido para cliente
                            </p>
                            <p className="text-xs text-green-600 mt-2 font-semibold">
                              ✅ Gera comissão
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <h4 className="font-semibold mb-2 flex items-center">
                        <Target className="w-4 h-4 mr-2" />
                        Como Funciona
                      </h4>
                      <ul className="space-y-2 text-sm text-gray-700">
                        <li>• <strong>Pedido Para Mim:</strong> Use seu crédito pessoal. Não gera comissão.</li>
                        <li>• <strong>Pedido Para Cliente:</strong> Selecione um cliente. Gera comissão sobre a venda.</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
          
          {/* Aba Minha Equipe - Somente para Encarregados */}
          {employee?.isSupervisor && (
            <TabsContent value="equipe">
              <SupervisorEvaluations 
                employeeId={employee.id} 
                employeeName={employee.name} 
              />
            </TabsContent>
          )}
          
          {/* Aba Avaliar Liderança - Para todos os funcionários */}
          <TabsContent value="avaliar-lideranca">
            <LeadershipEvaluation 
              employeeId={employee?.id || ''} 
              employeeName={employee?.name || ''} 
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal de Detalhes do Pedido com Checklist */}
      <Dialog open={showOrderModal} onOpenChange={setShowOrderModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-orange-600">
              <Package className="w-6 h-6 inline mr-2" />
              Detalhes do Pedido
            </DialogTitle>
            {selectedOrder && (
              <DialogDescription>
                Pedido #{selectedOrder.orderNumber} - {selectedOrder.customerName}
              </DialogDescription>
            )}
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4 mt-4">
              {/* Status e Informações */}
              <div className="flex items-center justify-between">
                {getStatusBadge(selectedOrder.status)}
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900">
                    {formatCurrency(selectedOrder.total)}
                  </div>
                </div>
              </div>

              {/* Informações do Cliente */}
              <div className="space-y-2 bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Informações do Cliente</h3>
                {selectedOrder.customerPhone && (
                  <div className="flex items-center gap-2 text-gray-700">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span>{selectedOrder.customerPhone}</span>
                  </div>
                )}
                {selectedOrder.address && (
                  <div className="flex items-start gap-2 text-gray-700">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <span>{selectedOrder.address}{selectedOrder.city ? ` - ${selectedOrder.city}` : ''}</span>
                  </div>
                )}
                {selectedOrder.deliveryTime && (
                  <div className="flex items-center gap-2 text-gray-700">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span>Horário: {selectedOrder.deliveryTime}</span>
                  </div>
                )}
                {selectedOrder.deliveryOrder && (
                  <div className="flex items-center gap-2 text-gray-700">
                    <AlertCircle className="w-4 h-4 text-gray-400" />
                    <span>Ordem de entrega: #{selectedOrder.deliveryOrder}</span>
                  </div>
                )}
              </div>

              {/* Mudar Status */}
              <div className="border rounded-lg p-4 bg-white">
                <h3 className="font-semibold text-gray-900 mb-3">
                  <CheckCircle2 className="w-5 h-5 inline mr-2" />
                  Mudar Status do Pedido
                </h3>
                <div className="flex flex-wrap gap-2">
                  {getAvailableStatusTransitions(selectedOrder.status).map((status) => (
                    <Button
                      key={status}
                      onClick={() => handleStatusChange(selectedOrder.id, status)}
                      disabled={updatingStatus}
                      variant={status === 'DELIVERED' ? 'default' : 'outline'}
                      className={`flex items-center gap-2 ${
                        status === 'READY' ? 'border-blue-500 text-blue-600 hover:bg-blue-50' :
                        status === 'DELIVERING' ? 'border-orange-500 text-orange-600 hover:bg-orange-50' :
                        status === 'DELIVERED' ? 'bg-green-600 hover:bg-green-700 text-white' :
                        ''
                      }`}
                    >
                      {status === 'READY' && <Package className="w-4 h-4" />}
                      {status === 'DELIVERING' && <Truck className="w-4 h-4" />}
                      {status === 'DELIVERED' && <CheckCircle2 className="w-4 h-4" />}
                      {updatingStatus ? 'Atualizando...' : getStatusLabel(status)}
                    </Button>
                  ))}
                </div>
                {getAvailableStatusTransitions(selectedOrder.status).length === 0 && (
                  <p className="text-sm text-gray-500">
                    Não há transições de status disponíveis para este pedido.
                  </p>
                )}
              </div>

              {/* Quantidade de Volumes */}
              <div className="border rounded-lg p-4 bg-white">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">
                    <Package className="w-5 h-5 inline mr-2" />
                    Quantidade de Volumes
                  </h3>
                  {!editingVolumes && (
                    <Button
                      onClick={() => setEditingVolumes(true)}
                      variant="outline"
                      size="sm"
                    >
                      Editar
                    </Button>
                  )}
                </div>
                
                {editingVolumes ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      max="99"
                      value={volumesValue}
                      onChange={(e) => setVolumesValue(parseInt(e.target.value) || 1)}
                      className="w-24"
                    />
                    <Button
                      onClick={() => handleVolumesChange(selectedOrder.id, volumesValue)}
                      size="sm"
                      variant="default"
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Salvar
                    </Button>
                    <Button
                      onClick={() => {
                        setEditingVolumes(false);
                        setVolumesValue(selectedOrder.volumes || 1);
                      }}
                      size="sm"
                      variant="outline"
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <div className="text-lg font-medium text-gray-900">
                    {selectedOrder.volumes || 1} {(selectedOrder.volumes || 1) === 1 ? 'volume' : 'volumes'}
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  Especifique quantas caixas/volumes este pedido contém
                </p>
              </div>

              {/* Tipo de Entrega */}
              <div className="border rounded-lg p-4 bg-white">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">
                    {selectedDeliveryTab === 'delivery' ? (
                      <><Truck className="w-5 h-5 inline mr-2" />Tipo: Entrega</>
                    ) : (
                      <><Package className="w-5 h-5 inline mr-2" />Tipo: Retirada</>
                    )}
                  </h3>
                  <Button
                    onClick={() => handleEditOrderType(selectedOrder)}
                    variant="outline"
                    size="sm"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Alterar
                  </Button>
                </div>
                <p className="text-sm text-gray-600">
                  {selectedDeliveryTab === 'delivery' 
                    ? 'Este pedido será entregue no endereço do cliente'
                    : 'O cliente virá buscar este pedido'
                  }
                </p>
              </div>

              {/* Checklist de Itens */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">
                  <ClipboardList className="w-5 h-5 inline mr-2" />
                  Checklist de Itens
                </h3>
                <div className="space-y-3">
                  {selectedOrder.items.map((item: any, index: number) => (
                    <div 
                      key={item.id || index}
                      className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <Checkbox
                        id={`item-${item.id}`}
                        checked={item.isChecked || false}
                        onCheckedChange={(checked) => 
                          handleCheckItem(selectedOrder.id, item.id, Boolean(checked))
                        }
                        className="mt-1"
                      />
                      <label
                        htmlFor={`item-${item.id}`}
                        className="flex-1 cursor-pointer"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className={`font-medium ${item.isChecked ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                              {item.quantity}x {item.productName}
                            </div>
                            <div className="text-sm text-gray-500">
                              {formatCurrency(item.unitPrice)} cada
                            </div>
                          </div>
                          <div className={`font-semibold ${item.isChecked ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                            {formatCurrency(item.total)}
                          </div>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>

                {/* Progresso */}
                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Progresso</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {selectedOrder.items.filter((i: any) => i.isChecked).length} de {selectedOrder.items.length} itens
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${(selectedOrder.items.filter((i: any) => i.isChecked).length / selectedOrder.items.length) * 100}%`
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Observações */}
              {selectedOrder.notes && (
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <h3 className="font-semibold text-gray-900 mb-2">Observações:</h3>
                  <p className="text-gray-700">{selectedOrder.notes}</p>
                </div>
              )}

              {/* Botão de Fechar */}
              <div className="flex justify-end pt-4 border-t">
                <Button
                  onClick={() => setShowOrderModal(false)}
                  variant="outline"
                >
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Aceite Digital */}
      <Dialog open={showAcknowledgeDialog} onOpenChange={setShowAcknowledgeDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-blue-700">
              🖊️ Aceite Digital de Contracheque
            </DialogTitle>
            <DialogDescription>
              Confirme o recebimento e aceite do seu contracheque
            </DialogDescription>
          </DialogHeader>

          {selectedPaymentForAck && (
            <div className="space-y-6">
              {/* Informações do Pagamento */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-lg mb-3 text-blue-900">📋 Dados do Pagamento</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-600">Período:</p>
                    <p className="font-semibold">
                      {selectedPaymentForAck.payrollSheet 
                        ? `${selectedPaymentForAck.payrollSheet.month}/${selectedPaymentForAck.payrollSheet.year}`
                        : 'Pagamento Avulso'
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Valor Total:</p>
                    <p className="font-semibold text-green-700">{formatCurrency(selectedPaymentForAck.totalAmount)}</p>
                  </div>
                </div>
              </div>

              {/* Termos e Condições */}
              <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 max-h-80 overflow-y-auto">
                <h3 className="font-semibold mb-3 text-gray-900">📜 Termos e Condições</h3>
                <pre className="text-xs whitespace-pre-wrap font-sans text-gray-700 leading-relaxed">
                  {termsText}
                </pre>
              </div>

              {/* Aviso Legal */}
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700 font-semibold">
                      IMPORTANTE: Ao aceitar digitalmente este contracheque, você declara que:
                    </p>
                    <ul className="mt-2 text-xs text-yellow-700 list-disc list-inside space-y-1">
                      <li>Leu e compreendeu todos os valores apresentados</li>
                      <li>Concorda com os proventos e descontos discriminados</li>
                      <li>Reconhece a validade jurídica desta assinatura eletrônica</li>
                      <li>Autoriza o registro de data, hora, IP e dispositivo utilizados</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Checkbox de Aceite */}
              <div className="flex items-center space-x-3 p-4 border-2 border-blue-300 rounded-lg bg-blue-50">
                <Checkbox
                  id="terms"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                />
                <Label 
                  htmlFor="terms" 
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Eu aceito os termos e condições acima e declaro que li e compreendi todas as informações do 
                  meu contracheque. Reconheço que esta assinatura eletrônica tem a mesma validade jurídica 
                  de uma assinatura manuscrita.
                </Label>
              </div>

              {/* Botões de Ação */}
              <div className="flex gap-3 justify-end pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAcknowledgeDialog(false);
                    setSelectedPaymentForAck(null);
                    setTermsAccepted(false);
                  }}
                  disabled={acknowledgingPayment}
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
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Aceite Digital de Folha de Ponto */}
      <Dialog open={showTimesheetAckDialog} onOpenChange={setShowTimesheetAckDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-blue-700">
              🖊️ Assinatura Digital de Folha de Ponto
            </DialogTitle>
            <DialogDescription>
              Confirme e assine digitalmente sua folha de ponto
            </DialogDescription>
          </DialogHeader>

          {selectedTimesheetForAck && (
            <div className="space-y-6">
              {/* Informações da Folha de Ponto */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-lg mb-3 text-blue-900">📋 Dados da Folha de Ponto</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-600">Período:</p>
                    <p className="font-semibold">
                      {formatDateSafe(selectedTimesheetForAck.startDate)} até{' '}
                      {formatDateSafe(selectedTimesheetForAck.endDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Dias Trabalhados:</p>
                    <p className="font-semibold text-blue-700">{selectedTimesheetForAck.workedDays} dias</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Saldo de Horas:</p>
                    <p className={`font-semibold ${
                      selectedTimesheetForAck.balanceMinutes >= 0 ? 'text-green-700' : 'text-orange-700'
                    }`}>
                      {selectedTimesheetForAck.balanceMinutes >= 0 ? '+' : ''}
                      {Math.floor(Math.abs(selectedTimesheetForAck.balanceMinutes) / 60)}h
                      {(Math.abs(selectedTimesheetForAck.balanceMinutes) % 60).toString().padStart(2, '0')}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Ausências:</p>
                    <p className="font-semibold text-red-700">{selectedTimesheetForAck.absentDays} dias</p>
                  </div>
                </div>
              </div>

              {/* Termos e Condições */}
              <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 max-h-80 overflow-y-auto">
                <h3 className="font-semibold mb-3 text-gray-900">📜 Termos e Condições</h3>
                <pre className="text-xs whitespace-pre-wrap font-sans text-gray-700 leading-relaxed">
                  {timesheetTermsText}
                </pre>
              </div>

              {/* Aviso Legal */}
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700 font-semibold">
                      IMPORTANTE: Ao assinar digitalmente esta folha de ponto, você declara que:
                    </p>
                    <ul className="mt-2 text-xs text-yellow-700 list-disc list-inside space-y-1">
                      <li>Reconhece que os dados de ponto apresentados são verdadeiros</li>
                      <li>Concorda com os dias trabalhados e ausências registradas</li>
                      <li>Está ciente do saldo de banco de horas apresentado</li>
                      <li>Reconhece a validade jurídica desta assinatura eletrônica</li>
                      <li>Autoriza o registro de data, hora, IP e dispositivo utilizados</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Checkbox de Aceite */}
              <div className="flex items-center space-x-3 p-4 border-2 border-blue-300 rounded-lg bg-blue-50">
                <Checkbox
                  id="timesheet-terms"
                  checked={timesheetTermsAccepted}
                  onCheckedChange={(checked) => setTimesheetTermsAccepted(checked as boolean)}
                />
                <Label 
                  htmlFor="timesheet-terms" 
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Eu aceito os termos e condições acima e declaro que li e compreendi todas as informações da 
                  minha folha de ponto. Reconheço que esta assinatura eletrônica tem a mesma validade jurídica 
                  de uma assinatura manuscrita.
                </Label>
              </div>

              {/* Botões de Ação */}
              <div className="flex gap-3 justify-end pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowTimesheetAckDialog(false);
                    setSelectedTimesheetForAck(null);
                    setTimesheetTermsAccepted(false);
                  }}
                  disabled={acknowledgingTimesheet}
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
          )}
        </DialogContent>
      </Dialog>

      {/* 🔏 Diálogo de Assinatura Digital de Documentos (Folha de Ponto) */}
      <Dialog open={showDocumentAckDialog} onOpenChange={setShowDocumentAckDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-cyan-700">
              🔏 Assinatura Digital de Folha de Ponto
            </DialogTitle>
            <DialogDescription>
              Confirme e assine digitalmente sua folha de ponto
            </DialogDescription>
          </DialogHeader>

          {selectedDocumentForAck && (
            <div className="space-y-6">
              {/* Informações do Documento */}
              <div className="bg-cyan-50 p-4 rounded-lg border border-cyan-200">
                <h3 className="font-semibold text-lg mb-3 text-cyan-900">📋 Dados do Documento</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <p className="text-gray-600">Documento:</p>
                    <p className="font-semibold">{selectedDocumentForAck.title}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Mês de Referência:</p>
                    <p className="font-semibold text-cyan-700">
                      {formatReferenceMonth(selectedDocumentForAck.referenceDate)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Termos e Condições */}
              <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 max-h-60 overflow-y-auto">
                <h3 className="font-semibold mb-3 text-gray-900">📜 Termos e Condições</h3>
                <pre className="text-xs whitespace-pre-wrap font-sans text-gray-700 leading-relaxed">
                  {documentTermsText}
                </pre>
              </div>

              {/* Aviso Legal */}
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700 font-semibold">
                      IMPORTANTE: Esta assinatura digital tem validade jurídica
                    </p>
                    <ul className="mt-2 text-xs text-yellow-700 list-disc list-inside space-y-1">
                      <li>Seus dados de acesso (IP, data/hora, dispositivo) serão registrados</li>
                      <li>Esta assinatura comprova sua ciência e concordância com o documento</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Checkbox de Aceite */}
              <div className="flex items-center space-x-3 p-4 border-2 border-cyan-300 rounded-lg bg-cyan-50">
                <Checkbox
                  id="document-terms"
                  checked={documentTermsAccepted}
                  onCheckedChange={(checked) => setDocumentTermsAccepted(checked as boolean)}
                />
                <Label 
                  htmlFor="document-terms" 
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Eu aceito os termos e condições acima e declaro que li e compreendi todas as informações. 
                  Reconheço que esta assinatura eletrônica tem a mesma validade jurídica de uma assinatura manuscrita.
                </Label>
              </div>

              {/* Botões de Ação */}
              <div className="flex gap-3 justify-end pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDocumentAckDialog(false);
                    setSelectedDocumentForAck(null);
                    setDocumentTermsAccepted(false);
                  }}
                  disabled={acknowledgingDocument}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleAcknowledgeDocument}
                  disabled={!documentTermsAccepted || acknowledgingDocument}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  {acknowledgingDocument ? (
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
          )}
        </DialogContent>
      </Dialog>

      {/* Diálogo de Edição de Tipo de Entrega */}
      <Dialog open={showEditTypeDialog} onOpenChange={setShowEditTypeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Tipo de Entrega</DialogTitle>
            <DialogDescription>
              Pedido #{editingOrderType?.orderNumber} - {editingOrderType?.customerName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Selecione o novo tipo de entrega:</Label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setNewOrderType('DELIVERY')}
                  className={`p-4 border-2 rounded-lg transition-all ${
                    newOrderType === 'DELIVERY'
                      ? 'border-orange-600 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Truck className={`w-8 h-8 mx-auto mb-2 ${
                    newOrderType === 'DELIVERY' ? 'text-orange-600' : 'text-gray-400'
                  }`} />
                  <p className={`font-medium ${
                    newOrderType === 'DELIVERY' ? 'text-orange-600' : 'text-gray-700'
                  }`}>
                    Entrega
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    O pedido será entregue no endereço
                  </p>
                </button>

                <button
                  onClick={() => setNewOrderType('PICKUP')}
                  className={`p-4 border-2 rounded-lg transition-all ${
                    newOrderType === 'PICKUP'
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Package className={`w-8 h-8 mx-auto mb-2 ${
                    newOrderType === 'PICKUP' ? 'text-purple-600' : 'text-gray-400'
                  }`} />
                  <p className={`font-medium ${
                    newOrderType === 'PICKUP' ? 'text-purple-600' : 'text-gray-700'
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
                    Esta alteração pode afetar a organização da rota.
                    Certifique-se de que o cliente foi informado sobre a mudança.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setShowEditTypeDialog(false)}
              disabled={updatingOrderType}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpdateOrderType}
              disabled={updatingOrderType}
            >
              {updatingOrderType ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Atualizando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Confirmar Alteração
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
