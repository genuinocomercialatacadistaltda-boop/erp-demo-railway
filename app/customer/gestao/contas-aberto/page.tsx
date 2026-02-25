
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Receipt, Calendar, DollarSign, AlertCircle, CheckCircle, Plus, PieChart, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

interface Receivable {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  status: string;
  paymentDate: string | null;
  netAmount: number | null;
  category: string;
  Order?: {
    id: string;
    orderNumber: string;
    paymentMethod: string;
  };
}

interface ClientExpense {
  id: string;
  description: string;
  amount: number;
  category: string;
  dueDate: string;
  paymentDate: string | null;
  status: string;
  supplierName: string | null;
  notes: string | null;
  createdAt: string;
}

// Categorias padrão de despesas
const EXPENSE_CATEGORIES = [
  { value: "CARVAO", label: "Carvão" },
  { value: "GAS", label: "Gás" },
  { value: "EMBALAGENS", label: "Embalagens" },
  { value: "TEMPEROS", label: "Temperos e Condimentos" },
  { value: "BEBIDAS", label: "Bebidas" },
  { value: "MATERIAIS", label: "Materiais de Limpeza" },
  { value: "FUNCIONARIOS", label: "Salários e Encargos" },
  { value: "ALUGUEL", label: "Aluguel" },
  { value: "ENERGIA", label: "Energia Elétrica" },
  { value: "AGUA", label: "Água" },
  { value: "TELEFONE", label: "Telefone/Internet" },
  { value: "MANUTENCAO", label: "Manutenção" },
  { value: "MARKETING", label: "Marketing e Publicidade" },
  { value: "TRANSPORTE", label: "Transporte e Frete" },
  { value: "IMPOSTOS", label: "Impostos e Taxas" },
  { value: "OUTROS", label: "Outros" },
];

export default function ContasAbertoPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [totalPending, setTotalPending] = useState(0);
  const [totalOverdue, setTotalOverdue] = useState(0);

  // Estados para despesas
  const [expenses, setExpenses] = useState<ClientExpense[]>([]);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    description: "",
    amount: "",
    category: "OUTROS",
    dueDate: new Date().toISOString().split("T")[0],
    supplierName: "",
    notes: "",
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
    
    if (status === "authenticated" && (session?.user as any)?.userType !== "CUSTOMER") {
      toast.error("Acesso negado");
      router.push("/");
    }
  }, [status, session, router]);

  useEffect(() => {
    if (status === "authenticated") {
      loadReceivables();
      loadExpenses();
    }
  }, [status]);

  const loadReceivables = async () => {
    try {
      setLoading(true);
      const customerId = (session?.user as any)?.customerId;
      
      if (!customerId) {
        toast.error("Cliente não identificado");
        return;
      }

      const res = await fetch(`/api/customer-receivables?customerId=${customerId}`);
      const data = await res.json();

      if (data.success) {
        setReceivables(data.receivables);
        setTotalPending(data.totalPending);
        setTotalOverdue(data.totalOverdue);
      } else {
        toast.error(data.error || "Erro ao carregar contas");
      }
    } catch (error) {
      console.error("Erro ao carregar contas:", error);
      toast.error("Erro ao carregar contas");
    } finally {
      setLoading(false);
    }
  };

  const loadExpenses = async () => {
    try {
      const res = await fetch("/api/client-management/expenses");
      const data = await res.json();

      if (data.success) {
        setExpenses(data.data);
      } else {
        toast.error("Erro ao carregar despesas");
      }
    } catch (error) {
      console.error("Erro ao carregar despesas:", error);
      toast.error("Erro ao carregar despesas");
    }
  };

  const handleSaveExpense = async () => {
    if (!expenseForm.description || !expenseForm.amount || !expenseForm.category) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      setSavingExpense(true);

      const res = await fetch("/api/client-management/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: expenseForm.description,
          amount: parseFloat(expenseForm.amount),
          category: expenseForm.category,
          dueDate: new Date(expenseForm.dueDate),
          supplierName: expenseForm.supplierName || null,
          notes: expenseForm.notes || null,
          status: "PENDING",
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Despesa adicionada com sucesso!");
        setShowExpenseDialog(false);
        setExpenseForm({
          description: "",
          amount: "",
          category: "OUTROS",
          dueDate: new Date().toISOString().split("T")[0],
          supplierName: "",
          notes: "",
        });
        loadExpenses();
      } else {
        toast.error(data.error || "Erro ao adicionar despesa");
      }
    } catch (error) {
      console.error("Erro ao salvar despesa:", error);
      toast.error("Erro ao salvar despesa");
    } finally {
      setSavingExpense(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm("Deseja realmente excluir esta despesa?")) {
      return;
    }

    try {
      const res = await fetch(`/api/client-management/expenses/${expenseId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Despesa excluída com sucesso!");
        loadExpenses();
      } else {
        toast.error(data.error || "Erro ao excluir despesa");
      }
    } catch (error) {
      console.error("Erro ao excluir despesa:", error);
      toast.error("Erro ao excluir despesa");
    }
  };

  // Calcular dados para o gráfico de pizza
  const getExpensesByCategory = () => {
    const categoryTotals: Record<string, number> = {};
    
    expenses.forEach((expense) => {
      if (!categoryTotals[expense.category]) {
        categoryTotals[expense.category] = 0;
      }
      categoryTotals[expense.category] += expense.amount;
    });

    return Object.entries(categoryTotals).map(([category, total]) => {
      const categoryLabel = EXPENSE_CATEGORIES.find(c => c.value === category)?.label || category;
      return {
        category: categoryLabel,
        total,
        percentage: expenses.length > 0 ? (total / expenses.reduce((sum, e) => sum + e.amount, 0)) * 100 : 0,
      };
    }).sort((a, b) => b.total - a.total);
  };

  const getCategoryColor = (index: number) => {
    const colors = [
      "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF",
      "#FF9F40", "#FF6384", "#C9CBCF", "#4BC0C0", "#FF6384",
      "#36A2EB", "#FFCE56", "#FF9F40", "#9966FF", "#C9CBCF",
      "#4BC0C0"
    ];
    return colors[index % colors.length];
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date() && new Date(dueDate).toDateString() !== new Date().toDateString();
  };

  const getStatusBadge = (receivable: Receivable) => {
    if (receivable.status === "PAID") {
      return <Badge className="bg-green-100 text-green-800">✅ Pago</Badge>;
    }
    if (isOverdue(receivable.dueDate)) {
      return <Badge className="bg-red-100 text-red-800">❌ Vencido</Badge>;
    }
    return <Badge className="bg-yellow-100 text-yellow-800">⏳ Pendente</Badge>;
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  const pendingReceivables = receivables.filter(r => r.status === "PENDING");
  const overdueReceivables = pendingReceivables.filter(r => isOverdue(r.dueDate));
  const upcomingReceivables = pendingReceivables.filter(r => !isOverdue(r.dueDate));

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => router.push("/customer/gestao")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                Contas em Aberto
              </h1>
              <p className="text-gray-600">Pedidos pendentes e despesas do negócio</p>
            </div>
          </div>
          <Button
            onClick={() => setShowExpenseDialog(true)}
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700"
          >
            <Plus className="h-4 w-4" />
            Adicionar Despesa
          </Button>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Total Pendente
              </CardTitle>
              <DollarSign className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {formatCurrency(totalPending)}
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {pendingReceivables.length} conta(s) em aberto
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Vencidos
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(totalOverdue)}
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {overdueReceivables.length} conta(s) atrasada(s)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                A Vencer
              </CardTitle>
              <Calendar className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(totalPending - totalOverdue)}
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {upcomingReceivables.length} conta(s) no prazo
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Contas em Aberto */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Detalhamento das Contas
            </CardTitle>
            <CardDescription>
              Histórico completo de pedidos não pagos
            </CardDescription>
          </CardHeader>
          <CardContent>
            {receivables.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-900">
                  Parabéns! Não há contas em aberto
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  Todos os seus pedidos foram pagos
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {receivables.map((receivable) => (
                  <div
                    key={receivable.id}
                    className={`border rounded-lg p-4 ${
                      isOverdue(receivable.dueDate) && receivable.status === "PENDING"
                        ? "bg-red-50 border-red-200"
                        : receivable.status === "PAID"
                        ? "bg-green-50 border-green-200"
                        : "bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getStatusBadge(receivable)}
                          {receivable.Order && (
                            <Badge variant="outline">
                              Pedido #{receivable.Order.orderNumber}
                            </Badge>
                          )}
                        </div>
                        
                        <p className="font-medium text-gray-900">
                          {receivable.description}
                        </p>
                        
                        <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            Vencimento: {formatDate(receivable.dueDate)}
                          </div>
                          {receivable.Order && (
                            <div className="flex items-center gap-1">
                              <Receipt className="h-4 w-4" />
                              Forma: {receivable.Order.paymentMethod}
                            </div>
                          )}
                        </div>

                        {receivable.status === "PAID" && receivable.paymentDate && (
                          <p className="text-sm text-green-600 mt-2">
                            ✅ Pago em {formatDate(receivable.paymentDate)}
                          </p>
                        )}
                      </div>

                      <div className="text-right ml-4">
                        <p className={`text-2xl font-bold ${
                          receivable.status === "PAID"
                            ? "text-green-600"
                            : isOverdue(receivable.dueDate)
                            ? "text-red-600"
                            : "text-gray-900"
                        }`}>
                          {formatCurrency(receivable.amount)}
                        </p>
                        {receivable.status === "PAID" && receivable.netAmount && (
                          <p className="text-sm text-gray-600 mt-1">
                            Líquido: {formatCurrency(receivable.netAmount)}
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
      </div>
    </div>
  );
}
