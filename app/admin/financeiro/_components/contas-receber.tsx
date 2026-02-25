"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Receipt, User, Phone, Calendar, DollarSign, CreditCard } from "lucide-react";
import { toast } from "sonner";

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone?: string;
  total: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  deliveryDate?: string;
  Customer?: { name: string; phone: string };
  Seller?: { name: string };
}

export default function ContasReceber() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: "all", paymentMethod: "all" });
  const [stats, setStats] = useState({ totalPending: 0, totalReceived: 0, count: 0 });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethodModal, setPaymentMethodModal] = useState("CASH");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const fetchOrders = async () => {
    try {
      const res = await fetch(
        `/api/financial/receivables?status=${filter.status}&paymentMethod=${filter.paymentMethod}`
      );
      if (!res.ok) throw new Error("Erro ao carregar contas a receber");
      const data = await res.json();
      setOrders(data.orders);

      // Calcular estatísticas
      const pending = data.orders.filter((o: Order) => o.status === "PENDING");
      const received = data.orders.filter((o: Order) => o.status !== "PENDING" && o.status !== "CANCELLED");
      
      setStats({
        totalPending: pending.reduce((sum: number, o: Order) => sum + o.total, 0),
        totalReceived: received.reduce((sum: number, o: Order) => sum + o.total, 0),
        count: data.orders.length
      });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [filter]);

  const getStatusBadge = (status: string) => {
    const badges = {
      PENDING: { label: "Pendente", color: "bg-yellow-100 text-yellow-800" },
      CONFIRMED: { label: "Confirmado", color: "bg-blue-100 text-blue-800" },
      PREPARING: { label: "Preparando", color: "bg-purple-100 text-purple-800" },
      READY: { label: "Pronto", color: "bg-green-100 text-green-800" },
      DELIVERING: { label: "Entregando", color: "bg-indigo-100 text-indigo-800" },
      DELIVERED: { label: "Entregue", color: "bg-green-100 text-green-800" },
      CANCELLED: { label: "Cancelado", color: "bg-gray-100 text-gray-800" }
    };
    const badge = badges[status as keyof typeof badges] || badges.PENDING;
    return <span className={`px-2 py-1 rounded text-xs font-semibold ${badge.color}`}>{badge.label}</span>;
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      CASH: "Dinheiro",
      CARD: "Cartão",
      DEBIT: "Débito",
      CREDIT_CARD: "Crédito",
      PIX: "PIX",
      CREDIT: "Crediário",
      BOLETO: "Boleto"
    };
    return labels[method] || method;
  };

  const handleOpenPayment = (order: Order) => {
    setSelectedOrder(order);
    setPaymentAmount(order.total.toFixed(2));
    setShowPaymentModal(true);
  };

  const handleProcessPayment = async () => {
    if (!selectedOrder || !paymentAmount) {
      toast.error("Preencha o valor do pagamento");
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Valor inválido");
      return;
    }

    if (amount > selectedOrder.total) {
      toast.error("Valor não pode ser maior que o total do pedido");
      return;
    }

    setIsProcessingPayment(true);
    try {
      const res = await fetch("/api/financial/receivables/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          amount,
          paymentMethod: paymentMethodModal,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Erro ao processar pagamento");
      }

      toast.success("Pagamento registrado com sucesso!");
      setShowPaymentModal(false);
      fetchOrders(); // Reload orders
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  if (loading) {
    return <div className="space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Receipt className="h-6 w-6 text-blue-600" />
          Contas a Receber
        </h2>
        <div className="flex gap-2 flex-wrap">
          <Select value={filter.status} onValueChange={(v) => setFilter({ ...filter, status: v })}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="PENDING">Pendentes</SelectItem>
              <SelectItem value="PAID">Pagos/Entregues</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filter.paymentMethod} onValueChange={(v) => setFilter({ ...filter, paymentMethod: v })}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Pagamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="PIX">PIX</SelectItem>
              <SelectItem value="BOLETO">Boleto</SelectItem>
              <SelectItem value="CARD">Cartão</SelectItem>
              <SelectItem value="CREDIT">Crediário</SelectItem>
              <SelectItem value="CASH">Dinheiro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-900 dark:text-yellow-100">A Receber</p>
                <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                  R$ {stats.totalPending.toFixed(2)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-900 dark:text-green-100">Recebido</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                  R$ {stats.totalReceived.toFixed(2)}
                </p>
              </div>
              <Receipt className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-900 dark:text-blue-100">Total de Pedidos</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {stats.count}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Pedidos */}
      <div className="space-y-3">
        {orders.map((order) => (
          <Card key={order.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 flex-1">
                  <div>
                    <h3 className="font-semibold">Pedido #{order.orderNumber}</h3>
                    <div className="text-sm text-gray-500 space-y-1 mt-1">
                      <p className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {order.Customer?.name || order.customerName}
                      </p>
                      {(order.Customer?.phone || order.customerPhone) && (
                        <p className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {order.Customer?.phone || order.customerPhone}
                        </p>
                      )}
                      <p className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(order.createdAt).toLocaleDateString("pt-BR")}
                        {order.deliveryDate && ` • Entrega: ${new Date(order.deliveryDate).toLocaleDateString("pt-BR")}`}
                      </p>
                      {order.Seller && (
                        <p className="text-xs text-gray-400">Vendedor: {order.Seller.name}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-lg font-bold">R$ {order.total.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">{getPaymentMethodLabel(order.paymentMethod)}</p>
                  </div>
                  {getStatusBadge(order.status)}
                  {order.status === "PENDING" && (
                    <Button
                      size="sm"
                      onClick={() => handleOpenPayment(order)}
                      className="flex items-center gap-2"
                    >
                      <CreditCard className="h-4 w-4" />
                      Pagar
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {orders.length === 0 && (
          <Alert>
            <AlertDescription>Nenhum pedido encontrado com os filtros selecionados.</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Modal de Pagamento */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
            <DialogDescription>
              Pedido #{selectedOrder?.orderNumber} - Total: R$ {selectedOrder?.total.toFixed(2)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="payment-amount">Valor do Pagamento (R$)</Label>
              <Input
                id="payment-amount"
                type="number"
                step="0.01"
                min="0.01"
                max={selectedOrder?.total}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Digite o valor"
              />
              <p className="text-xs text-gray-500">
                Você pode pagar parcialmente. Digite um valor menor que o total para pagamento parcial.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-method">Método de Pagamento</Label>
              <Select value={paymentMethodModal} onValueChange={setPaymentMethodModal}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Dinheiro</SelectItem>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="DEBIT">Cartão de Débito</SelectItem>
                  <SelectItem value="CREDIT_CARD">Cartão de Crédito</SelectItem>
                  <SelectItem value="CARD">Cartão</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleProcessPayment} disabled={isProcessingPayment}>
              {isProcessingPayment ? "Processando..." : "Confirmar Pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
