
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { DollarSign, Calendar, CreditCard, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface Payment {
  id: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  notes?: string;
  receivedBy?: string;
}

interface PaymentInfo {
  orderId: string;
  orderNumber: string;
  customerName: string;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
  payments: Payment[];
}

export function PaymentTracker({ orderId }: { orderId: string }) {
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [notes, setNotes] = useState("");

  // Carregar informações de pagamento
  const loadPaymentInfo = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/orders/${orderId}/payments`);
      if (!res.ok) throw new Error("Erro ao carregar informações");
      const data = await res.json();
      setPaymentInfo(data);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPaymentInfo();
  }, [orderId]);

  // Registrar novo pagamento
  const handleSubmitPayment = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Insira um valor válido");
      return;
    }

    if (!paymentMethod) {
      toast.error("Selecione a forma de pagamento");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/orders/${orderId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amount),
          paymentMethod,
          notes
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao registrar pagamento");
      }

      toast.success(data.message);
      setShowDialog(false);
      setAmount("");
      setNotes("");
      setPaymentMethod("CASH");
      await loadPaymentInfo();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Remover pagamento
  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm("Tem certeza que deseja remover este pagamento?")) return;

    try {
      const res = await fetch(`/api/orders/${orderId}/payments/${paymentId}`, {
        method: "DELETE"
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      toast.success("Pagamento removido");
      await loadPaymentInfo();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (loading) {
    return <div className="animate-pulse h-64 bg-gray-100 rounded-lg" />;
  }

  if (!paymentInfo) {
    return null;
  }

  const statusColors = {
    UNPAID: "bg-red-100 text-red-800",
    PARTIAL: "bg-yellow-100 text-yellow-800",
    PAID: "bg-green-100 text-green-800"
  };

  const statusLabels = {
    UNPAID: "Não Pago",
    PARTIAL: "Parcialmente Pago",
    PAID: "Quitado"
  };

  const paymentMethodLabels: Record<string, string> = {
    CASH: "Dinheiro",
    PIX: "PIX",
    CARD: "Cartão",
    DEBIT: "Débito",
    CREDIT_CARD: "Crédito",
    BOLETO: "Boleto",
    CREDIT: "Crediário"
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Controle de Pagamentos
          </CardTitle>
          <Badge className={statusColors[paymentInfo.paymentStatus]}>
            {statusLabels[paymentInfo.paymentStatus]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resumo do Pagamento */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="text-sm text-gray-600">Valor Total</div>
            <div className="text-2xl font-bold text-blue-600">
              R$ {paymentInfo.total.toFixed(2)}
            </div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="text-sm text-gray-600">Total Pago</div>
            <div className="text-2xl font-bold text-green-600">
              R$ {paymentInfo.paidAmount.toFixed(2)}
            </div>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg">
            <div className="text-sm text-gray-600">Saldo Devedor</div>
            <div className="text-2xl font-bold text-orange-600">
              R$ {paymentInfo.remainingAmount.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Botão Registrar Pagamento */}
        {paymentInfo.paymentStatus !== "PAID" && (
          <Button
            onClick={() => setShowDialog(true)}
            className="w-full"
            size="lg"
          >
            <DollarSign className="w-4 h-4 mr-2" />
            Registrar Pagamento
          </Button>
        )}

        {/* Lista de Pagamentos */}
        {paymentInfo.payments.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-gray-700">Histórico de Pagamentos</h4>
            <div className="space-y-2">
              {paymentInfo.payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span className="font-semibold">
                        R$ {payment.amount.toFixed(2)}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {paymentMethodLabels[payment.paymentMethod] || payment.paymentMethod}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(payment.paymentDate).toLocaleString("pt-BR")}
                      {payment.notes && ` • ${payment.notes}`}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeletePayment(payment.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mensagem quando quitado */}
        {paymentInfo.paymentStatus === "PAID" && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Este pedido está totalmente quitado! 🎉
            </AlertDescription>
          </Alert>
        )}

        {/* Dialog de Registro de Pagamento */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Pagamento</DialogTitle>
              <DialogDescription>
                Pedido #{paymentInfo.orderNumber} - {paymentInfo.customerName}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="p-3 bg-orange-50 rounded-lg">
                <div className="text-sm text-gray-600">Saldo Devedor</div>
                <div className="text-xl font-bold text-orange-600">
                  R$ {paymentInfo.remainingAmount.toFixed(2)}
                </div>
              </div>

              <div>
                <Label htmlFor="amount">Valor do Pagamento*</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={paymentInfo.remainingAmount}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div>
                <Label htmlFor="paymentMethod">Forma de Pagamento*</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Dinheiro</SelectItem>
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="DEBIT">Débito</SelectItem>
                    <SelectItem value="CREDIT_CARD">Crédito</SelectItem>
                    <SelectItem value="CARD">Cartão</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="notes">Observações (opcional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Pagamento referente à venda dos espetos..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowDialog(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button onClick={handleSubmitPayment} disabled={submitting}>
                {submitting ? "Registrando..." : "Registrar Pagamento"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
