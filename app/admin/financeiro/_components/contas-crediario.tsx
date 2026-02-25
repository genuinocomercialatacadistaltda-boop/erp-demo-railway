
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  CreditCard, 
  User, 
  Phone, 
  Calendar, 
  DollarSign, 
  TrendingUp,
  Search,
  ExternalLink,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface CreditOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone?: string;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
  createdAt: string;
  deliveryDate?: string;
  Customer?: {
    id: string;
    name: string;
    phone: string;
    city: string;
  };
  Seller?: {
    id: string;
    name: string;
  };
  Payment: Array<{
    id: string;
    amount: number;
    paymentDate: string;
    paymentMethod: string;
  }>;
}

interface Summary {
  totalOrders: number;
  totalOwed: number;
  totalPaid: number;
  totalValue: number;
  unpaidCount: number;
  partialCount: number;
  paidCount: number;
}

export default function ContasCrediario() {
  const router = useRouter();
  const [orders, setOrders] = useState<CreditOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: "all", search: "" });
  const [summary, setSummary] = useState<Summary>({
    totalOrders: 0,
    totalOwed: 0,
    totalPaid: 0,
    totalValue: 0,
    unpaidCount: 0,
    partialCount: 0,
    paidCount: 0
  });

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/financial/credit-accounts?status=${filter.status}`
      );
      if (!res.ok) throw new Error("Erro ao carregar contas");
      const data = await res.json();
      setOrders(data.orders);
      setSummary(data.summary);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [filter.status]);

  // Filtrar por busca local
  const filteredOrders = orders.filter(order =>
    order.customerName.toLowerCase().includes(filter.search.toLowerCase()) ||
    order.orderNumber.includes(filter.search) ||
    order.customerPhone?.includes(filter.search)
  );

  const statusColors = {
    UNPAID: "bg-red-100 text-red-800",
    PARTIAL: "bg-yellow-100 text-yellow-800",
    PAID: "bg-green-100 text-green-800"
  };

  const statusLabels = {
    UNPAID: "Não Pago",
    PARTIAL: "Parcial",
    PAID: "Quitado"
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-blue-600" />
          Controle de Crediário
        </h2>
        <Button onClick={fetchOrders}>Atualizar</Button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total a Receber</p>
                <p className="text-2xl font-bold text-orange-600">
                  R$ {summary.totalOwed.toFixed(2)}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-orange-600" />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {summary.unpaidCount + summary.partialCount} clientes devendo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Pago</p>
                <p className="text-2xl font-bold text-green-600">
                  R$ {summary.totalPaid.toFixed(2)}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {summary.paidCount} pedidos quitados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-gray-600">Não Pagos</p>
              <p className="text-2xl font-bold text-red-600">
                {summary.unpaidCount}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-gray-600">Parcialmente Pagos</p>
              <p className="text-2xl font-bold text-yellow-600">
                {summary.partialCount}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar cliente, pedido ou telefone..."
                  value={filter.search}
                  onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filter.status} onValueChange={(v) => setFilter({ ...filter, status: v })}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="UNPAID">Não Pagos</SelectItem>
                <SelectItem value="PARTIAL">Parciais</SelectItem>
                <SelectItem value="PAID">Quitados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Alertas */}
      {summary.unpaidCount > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Atenção</AlertTitle>
          <AlertDescription>
            Você tem {summary.unpaidCount} pedido(s) sem nenhum pagamento registrado,
            totalizando R$ {orders.filter(o => o.paymentStatus === "UNPAID").reduce((sum, o) => sum + o.remainingAmount, 0).toFixed(2)}
          </AlertDescription>
        </Alert>
      )}

      {/* Tabela de Contas */}
      <Card>
        <CardHeader>
          <CardTitle>Contas de Crediário ({filteredOrders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CreditCard className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>Nenhuma conta de crediário encontrada</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Pago</TableHead>
                    <TableHead>Restante</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Último Pagamento</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        #{order.orderNumber}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{order.customerName}</p>
                          {order.customerPhone && (
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {order.customerPhone}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold">
                          R$ {order.total.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-green-600 font-semibold">
                          R$ {order.paidAmount.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-orange-600 font-semibold">
                          R$ {order.remainingAmount.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[order.paymentStatus]}>
                          {statusLabels[order.paymentStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          {new Date(order.createdAt).toLocaleDateString("pt-BR")}
                        </div>
                      </TableCell>
                      <TableCell>
                        {order.Payment.length > 0 ? (
                          <div className="text-xs">
                            R$ {order.Payment[0].amount.toFixed(2)}
                            <br />
                            <span className="text-gray-500">
                              {new Date(order.Payment[0].paymentDate).toLocaleDateString("pt-BR")}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/admin/orders/${order.id}`)}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
