'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Package, MapPin, CreditCard } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  subtotal: number;
  discount: number;
  total: number;
  deliveryAddress: string;
  deliveryNotes: string | null;
  pointsEarned: number;
  pointsUsed: number;
  createdAt: string;
  Items: Array<{
    id: string;
    productName: string;
    productImage: string | null;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    notes: string | null;
  }>;
}

export default function ClientCustomerOrderDetail({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrder();
  }, [params.id]);

  const loadOrder = async () => {
    try {
      const res = await fetch(`/api/client-customer/orders/${params.id}`);
      const data = await res.json();

      if (data.success) {
        setOrder(data.order);
      } else {
        router.push('/client-customer/orders');
      }
    } catch (error) {
      console.error('Error loading order:', error);
      router.push('/client-customer/orders');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      PENDING: { label: 'Pendente', variant: 'secondary' },
      CONFIRMED: { label: 'Confirmado', variant: 'default' },
      PREPARING: { label: 'Preparando', variant: 'default' },
      READY: { label: 'Pronto', variant: 'default' },
      DELIVERED: { label: 'Entregue', variant: 'outline' },
      CANCELLED: { label: 'Cancelado', variant: 'destructive' },
    };

    const config = statusConfig[status] || { label: status, variant: 'outline' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
      </div>
    );
  }

  if (!order) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">{order.orderNumber}</h1>
          <p className="text-gray-600 mt-1">
            Pedido realizado em {format(new Date(order.createdAt), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
        {getStatusBadge(order.status)}
      </div>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Itens do Pedido
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {order.Items.map((item) => (
            <div key={item.id} className="flex items-center justify-between pb-4 border-b last:border-0 last:pb-0">
              <div className="flex-1">
                <p className="font-medium">{item.productName}</p>
                <p className="text-sm text-gray-600">
                  {item.quantity} x R$ {item.unitPrice.toFixed(2)}
                </p>
                {item.notes && (
                  <p className="text-sm text-gray-500 mt-1">Obs: {item.notes}</p>
                )}
              </div>
              <p className="font-semibold">R$ {item.subtotal.toFixed(2)}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Delivery */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Endereço de Entrega
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-900">{order.deliveryAddress}</p>
          {order.deliveryNotes && (
            <p className="text-sm text-gray-600 mt-2">
              Observações: {order.deliveryNotes}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Payment & Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Pagamento e Resumo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-600">Forma de pagamento:</span>
            <span className="font-medium">{order.paymentMethod}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Status do pagamento:</span>
            <Badge variant={order.paymentStatus === 'PAID' ? 'default' : 'secondary'}>
              {order.paymentStatus === 'PAID' ? 'Pago' : 'Pendente'}
            </Badge>
          </div>
          <div className="border-t pt-3 space-y-2">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>R$ {order.subtotal.toFixed(2)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Desconto (pontos)</span>
                <span>- R$ {order.discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Total</span>
              <span className="text-green-600">R$ {order.total.toFixed(2)}</span>
            </div>
          </div>
          {(order.pointsEarned > 0 || order.pointsUsed > 0) && (
            <div className="border-t pt-3 space-y-1">
              {order.pointsUsed > 0 && (
                <p className="text-sm text-gray-600">
                  Pontos usados: {Math.floor(order.pointsUsed)}
                </p>
              )}
              {order.pointsEarned > 0 && (
                <p className="text-sm text-gray-600">
                  Pontos ganhos: {Math.floor(order.pointsEarned)}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
