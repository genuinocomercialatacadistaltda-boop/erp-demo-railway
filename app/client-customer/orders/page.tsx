'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronRight, Package } from 'lucide-react';
import Link from 'next/link';

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  total: number;
  pointsEarned: number;
  createdAt: string;
  Items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export default function ClientCustomerOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => {
    loadOrders();
  }, [filter]);

  const loadOrders = async () => {
    try {
      const url = filter
        ? `/api/client-customer/orders?status=${filter}`
        : '/api/client-customer/orders';
      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        setOrders(data.orders);
      }
    } catch (error) {
      console.error('Error loading orders:', error);
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

  const getPaymentBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      PENDING: { label: 'Pendente', variant: 'secondary' },
      PAID: { label: 'Pago', variant: 'default' },
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Meus Pedidos</h1>
        <p className="text-gray-600 mt-2">Acompanhe o status dos seus pedidos</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={filter === null ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter(null)}
        >
          Todos
        </Button>
        <Button
          variant={filter === 'PENDING' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('PENDING')}
        >
          Pendentes
        </Button>
        <Button
          variant={filter === 'CONFIRMED' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('CONFIRMED')}
        >
          Confirmados
        </Button>
        <Button
          variant={filter === 'DELIVERED' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('DELIVERED')}
        >
          Entregues
        </Button>
      </div>

      {/* Orders List */}
      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Nenhum pedido encontrado</p>
            <Link href="/client-customer/catalog">
              <Button className="mt-4">Fazer um Pedido</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{order.orderNumber}</CardTitle>
                    <p className="text-sm text-gray-500 mt-1">
                      {formatDistanceToNow(new Date(order.createdAt), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {getStatusBadge(order.status)}
                    {getPaymentBadge(order.paymentStatus)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Items */}
                  <div className="space-y-2">
                    {order.Items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-gray-600">
                          {item.quantity}x {item.productName}
                        </span>
                        <span className="text-gray-900 font-medium">
                          R$ {(item.quantity * item.unitPrice).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Total */}
                  <div className="border-t pt-3 flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-green-600">
                        R$ {order.total.toFixed(2)}
                      </p>
                      {order.pointsEarned > 0 && (
                        <p className="text-xs text-gray-500">
                          +{Math.floor(order.pointsEarned)} pontos ganhos
                        </p>
                      )}
                    </div>
                    <Link href={`/client-customer/orders/${order.id}`}>
                      <Button variant="outline" size="sm">
                        Ver Detalhes
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
