
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, CreditCard, Receipt, Calendar, DollarSign, CheckCircle, X, Upload, FileText, Edit, Trash2, Download, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";

interface CreditCard {
  id: string;
  name: string;
  cardNumber?: string;
  cardFlag?: string;
  limit?: number;
  closingDay: number;
  dueDay: number;
  isActive: boolean;
  color?: string;
  pendingAmount?: number;
  pendingExpensesCount?: number;
  currentInvoice?: {
    id: string;
    referenceMonth: string;
    totalAmount: number;
    expensesCount: number;
  } | null;
  availableInvoices?: Array<{
    id: string;
    referenceMonth: string;
    status: string;
    totalAmount: number;
    expensesCount: number;
  }>;
  _count?: {
    Invoices: number;
    Expenses: number;
  };
}

interface CreditCardExpense {
  id: string;
  description: string;
  amount: number;
  purchaseDate: string;
  categoryId?: string;
  supplierName?: string;
  referenceNumber?: string;
  installments?: number;
  installmentNumber?: number;
  notes?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  invoiceId?: string; // 🆕 ID da fatura
  creditCardId: string; // 🆕 ID do cartão
  CreditCard: {
    name: string;
  };
  Category?: {
    name: string;
    color: string;
  };
  Invoice?: {
    referenceMonth: string;
    status: string;
  };
}

interface Invoice {
  id: string;
  creditCardId: string;
  referenceMonth: string;
  closingDate: string;
  dueDate: string;
  totalAmount: number;
  status: string;
  CreditCard: {
    name: string;
  };
  _count?: {
    Expenses: number;
  };
}

interface Category {
  id: string;
  name: string;
  color: string;
}

interface BankAccount {
  id: string;
  name: string;
}

// 🔧 Helper para formatar data de referência sem problemas de timezone
// Extrai ano e mês diretamente da string ISO sem converter para Date no timezone local
function formatReferenceMonth(dateString: string): string {
  // dateString vem como "2026-01-01T00:00:00.000Z" ou similar
  const date = new Date(dateString);
  
  // Usar UTC para garantir que não haja conversão de timezone
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth(); // 0-11
  
  // Nomes dos meses em português
  const monthNames = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  
  return `${monthNames[month]} de ${year}`;
}

export default function CartoesCredito() {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("cards");
  
  const [showNewCardDialog, setShowNewCardDialog] = useState(false);
  const [showNewExpenseDialog, setShowNewExpenseDialog] = useState(false);
  const [showNewCreditDialog, setShowNewCreditDialog] = useState(false); // 🆕 Dialog para adicionar crédito
  const [showPayInvoiceDialog, setShowPayInvoiceDialog] = useState(false);
  const [showStatementDialog, setShowStatementDialog] = useState(false);
  const [showEditExpenseDialog, setShowEditExpenseDialog] = useState(false);
  const [showCreateInvoiceDialog, setShowCreateInvoiceDialog] = useState(false); // 🆕 Dialog para criar fatura
  const [selectedCard, setSelectedCard] = useState<CreditCard | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [cardExpenses, setCardExpenses] = useState<CreditCardExpense[]>([]);
  const [invoiceExpenses, setInvoiceExpenses] = useState<CreditCardExpense[]>([]);
  const [invoiceCredits, setInvoiceCredits] = useState<any[]>([]); // 🆕 Créditos da fatura
  const [editingExpense, setEditingExpense] = useState<CreditCardExpense | null>(null);
  const [availableInvoices, setAvailableInvoices] = useState<Invoice[]>([]); // 🆕 Faturas disponíveis para edição
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [showInvoiceStatementDialog, setShowInvoiceStatementDialog] = useState(false);

  const [cardForm, setCardForm] = useState({
    name: "",
    cardNumber: "",
    cardFlag: "",
    limit: "",
    closingDay: "",
    dueDay: "",
    color: "#8B5CF6"
  });

  const [expenseForm, setExpenseForm] = useState({
    creditCardId: "",
    description: "",
    amount: "",
    purchaseDate: new Date().toISOString().split("T")[0],
    categoryId: "",
    supplierName: "",
    referenceNumber: "",
    installments: "1",
    notes: "",
    invoiceId: "", // 🆕 Fatura/mês de referência
    file: null as File | null
  });

  const [creditForm, setCreditForm] = useState({
    creditCardId: "",
    description: "",
    amount: "",
    creditDate: new Date().toISOString().split("T")[0],
    referenceNumber: "",
    notes: ""
  });

  const [paymentForm, setPaymentForm] = useState({
    bankAccountId: "",
    paymentDate: new Date().toISOString().split("T")[0]
  });

  // 🆕 Form para criar fatura
  const [createInvoiceForm, setCreateInvoiceForm] = useState({
    creditCardId: "",
    month: new Date().getMonth() + 1, // Mês atual (1-12)
    year: new Date().getFullYear()
  });

  const fetchData = async () => {
    try {
      const [cardsRes, invoicesRes, catRes, accRes] = await Promise.all([
        fetch("/api/financial/credit-cards"),
        fetch("/api/financial/credit-cards/invoices"),
        fetch("/api/financial/categories"),
        fetch("/api/financial/bank-accounts")
      ]);

      if (!cardsRes.ok || !invoicesRes.ok || !catRes.ok || !accRes.ok) {
        throw new Error("Erro ao carregar dados");
      }

      const cardsData = await cardsRes.json();
      const invoicesData = await invoicesRes.json();
      const catData = await catRes.json();
      const accData = await accRes.json();

      setCards(cardsData.cards);
      setInvoices(invoicesData.invoices);
      setCategories(catData.categories);
      setAccounts(accData.accounts);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/financial/credit-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cardForm)
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao criar cartão");
      }

      toast.success("Cartão criado com sucesso");
      setShowNewCardDialog(false);
      resetCardForm();
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteCard = async (card: CreditCard) => {
    if (!confirm(`Tem certeza que deseja excluir o cartão "${card.name}"?\n\nATENÇÃO: Só é possível excluir cartões sem faturas ou despesas vinculadas.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/financial/credit-cards/${card.id}`, {
        method: "DELETE"
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao excluir cartão");
      }

      toast.success("Cartão excluído com sucesso");
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleViewInvoiceStatement = async (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setLoadingExpenses(true);
    setShowInvoiceStatementDialog(true);

    try {
      const res = await fetch(`/api/financial/credit-cards/invoices/${invoice.id}`);
      
      if (!res.ok) {
        throw new Error("Erro ao carregar extrato da fatura");
      }

      const data = await res.json();
      // Ordenar por displayOrder (para manter a ordem personalizada do usuário)
      const sortedExpenses = (data.invoice.Expenses || []).sort((a: any, b: any) => 
        (a.displayOrder || 0) - (b.displayOrder || 0)
      );
      setInvoiceExpenses(sortedExpenses);
    } catch (err: any) {
      toast.error(err.message);
      setInvoiceExpenses([]);
    } finally {
      setLoadingExpenses(false);
    }
  };

  const handleDeleteInvoice = async (invoice: Invoice) => {
    const confirmMsg = invoice._count && invoice._count.Expenses > 0
      ? `Tem certeza que deseja excluir esta fatura?\n\n⚠️ ATENÇÃO: Esta ação irá:\n- Excluir ${invoice._count.Expenses} despesa(s) do cartão\n- Remover o registro em Contas a Pagar (se existir)\n- Devolver R$ ${invoice.totalAmount.toFixed(2)} ao limite do cartão\n\nEsta ação NÃO PODE ser desfeita!`
      : `Tem certeza que deseja excluir esta fatura vazia?`;

    if (!confirm(confirmMsg)) {
      return;
    }

    try {
      const res = await fetch(`/api/financial/credit-cards/invoices/${invoice.id}`, {
        method: "DELETE"
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao excluir fatura");
      }

      const result = await res.json();
      toast.success(`Fatura excluída! ${result.deletedExpenses} despesa(s) removida(s).`);
      fetchData();
      setShowInvoiceStatementDialog(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // 🆕 Criar fatura manualmente
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!createInvoiceForm.creditCardId) {
      toast.error('Selecione um cartão');
      return;
    }

    try {
      console.log('📅 [CREATE_INVOICE] Enviando requisição:', createInvoiceForm);

      const res = await fetch('/api/financial/credit-cards/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          creditCardId: createInvoiceForm.creditCardId,
          month: createInvoiceForm.month,
          year: createInvoiceForm.year
        })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao criar fatura');
      }

      const result = await res.json();
      console.log('✅ [CREATE_INVOICE] Fatura criada:', result);

      const card = cards.find(c => c.id === createInvoiceForm.creditCardId);
      toast.success(`Fatura de ${createInvoiceForm.month.toString().padStart(2, '0')}/${createInvoiceForm.year} criada para ${card?.name || 'cartão'}!`);
      
      setShowCreateInvoiceDialog(false);
      resetCreateInvoiceForm();
      fetchData();
    } catch (err: any) {
      console.error('❌ [CREATE_INVOICE] Erro:', err);
      toast.error(err.message);
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      Object.entries(expenseForm).forEach(([key, value]) => {
        if (key === "file" && value) {
          formData.append(key, value as File);
        } else if (value !== null && value !== undefined && value !== "") {
          formData.append(key, String(value));
        }
      });

      const res = await fetch("/api/financial/credit-cards/expenses", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao lançar despesa");
      }

      toast.success("Despesa lançada com sucesso");
      setShowNewExpenseDialog(false);
      resetExpenseForm();
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleCloseInvoice = async (card: CreditCard) => {
    if (!confirm(`Deseja fechar a fatura atual do cartão ${card.name}?`)) return;

    try {
      const res = await fetch("/api/financial/credit-cards/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creditCardId: card.id,
          action: "close"
        })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao fechar fatura");
      }

      toast.success("Fatura fechada com sucesso");
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAddCredit = async () => {
    try {
      if (!creditForm.creditCardId || !creditForm.description || !creditForm.amount || !creditForm.creditDate) {
        toast.error("Preencha todos os campos obrigatórios");
        return;
      }

      const formData = new FormData();
      Object.entries(creditForm).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== "") {
          formData.append(key, String(value));
        }
      });

      const res = await fetch("/api/financial/credit-cards/credits", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao adicionar crédito");
      }

      toast.success("Crédito adicionado com sucesso! O valor foi abatido da fatura.");
      setShowNewCreditDialog(false);
      resetCreditForm();
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const resetCreditForm = () => {
    setCreditForm({
      creditCardId: "",
      description: "",
      amount: "",
      creditDate: new Date().toISOString().split("T")[0],
      referenceNumber: "",
      notes: ""
    });
  };

  // 🗑️ Função para deletar crédito/estorno
  const handleDeleteCredit = async (creditId: string, creditDescription: string) => {
    if (!confirm(`Deseja realmente excluir o estorno "${creditDescription}"?\n\nIsso irá:\n- Adicionar o valor de volta à fatura\n- Diminuir o limite disponível do cartão`)) {
      return;
    }

    try {
      const res = await fetch(`/api/financial/credit-cards/credits/${creditId}`, {
        method: "DELETE"
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Erro ao excluir estorno");
      }

      toast.success("Estorno excluído com sucesso!");
      
      // Recarregar dados
      fetchData();
      
      // Atualizar lista de créditos no extrato
      setInvoiceCredits((prev) => prev.filter((c) => c.id !== creditId));
      
    } catch (error) {
      console.error("Erro ao excluir estorno:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao excluir estorno");
    }
  };

  // 🔄 Função para reordenar despesas (mover para cima/baixo)
  const handleReorderExpense = async (expenseId: string, direction: 'up' | 'down', invoiceId: string) => {
    try {
      console.log('[REORDER] Iniciando reordenação:', { expenseId, direction, invoiceId });
      
      const res = await fetch('/api/financial/credit-cards/expenses/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenseId, direction, invoiceId })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erro ao reordenar despesa');
      }

      const result = await res.json();
      console.log('[REORDER] Sucesso:', result);

      // Recarregar despesas da fatura usando o invoiceId passado
      const expensesRes = await fetch(`/api/financial/credit-cards/expenses?invoiceId=${invoiceId}`);
      if (expensesRes.ok) {
        const data = await expensesRes.json();
        // Ordenar por displayOrder
        const sortedExpenses = (data.expenses || []).sort((a: any, b: any) => 
          (a.displayOrder || 0) - (b.displayOrder || 0)
        );
        console.log('[REORDER] Despesas recarregadas:', sortedExpenses.length);
        
        // Atualizar tanto cardExpenses quanto invoiceExpenses
        setCardExpenses(sortedExpenses);
        setInvoiceExpenses(sortedExpenses);
        
        toast.success('Despesa reordenada com sucesso!');
      }
    } catch (error) {
      console.error('[REORDER] Erro:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao reordenar despesa');
    }
  };

  const handlePayInvoice = async () => {
    if (!selectedInvoice) return;

    try {
      const res = await fetch(`/api/financial/credit-cards/invoices/${selectedInvoice.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "pay",
          ...paymentForm
        })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao pagar fatura");
      }

      toast.success("Fatura paga com sucesso");
      setShowPayInvoiceDialog(false);
      setSelectedInvoice(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleViewStatement = async (card: CreditCard) => {
    setSelectedCard(card);
    setLoadingExpenses(true);
    setShowStatementDialog(true);

    try {
      // CRÍTICO: Mostrar apenas despesas da fatura atual (currentInvoice)
      if (!card.currentInvoice || !card.currentInvoice.id) {
        toast.error("Nenhuma fatura selecionada");
        setCardExpenses([]);
        setLoadingExpenses(false);
        return;
      }
      
      console.log('[VIEW_STATEMENT] Buscando despesas da fatura:', card.currentInvoice.id);
      console.log('[VIEW_STATEMENT] Fatura:', formatReferenceMonth(card.currentInvoice.referenceMonth));
      
      // Buscar despesas filtradas por invoiceId (fatura atual)
      const res = await fetch(`/api/financial/credit-cards/expenses?invoiceId=${card.currentInvoice.id}`);
      
      if (!res.ok) {
        throw new Error("Erro ao carregar despesas");
      }

      const data = await res.json();
      console.log('[VIEW_STATEMENT] ✅ Despesas da fatura carregadas:', data.expenses.length);
      setCardExpenses(data.expenses);

      // 🆕 Buscar créditos da fatura
      const creditsRes = await fetch(`/api/financial/credit-cards/credits?invoiceId=${card.currentInvoice.id}`);
      if (creditsRes.ok) {
        const creditsData = await creditsRes.json();
        console.log('[VIEW_STATEMENT] ✅ Créditos da fatura carregados:', creditsData.credits.length);
        setInvoiceCredits(creditsData.credits);
      } else {
        setInvoiceCredits([]);
      }
    } catch (err: any) {
      console.error('[VIEW_STATEMENT] ❌ Erro:', err);
      toast.error(err.message);
      setCardExpenses([]);
      setInvoiceCredits([]);
    } finally {
      setLoadingExpenses(false);
    }
  };

  const handleEditExpense = async (expense: CreditCardExpense) => {
    try {
      const res = await fetch(`/api/financial/credit-cards/expenses/${expense.id}`);
      
      if (!res.ok) {
        throw new Error("Erro ao carregar despesa");
      }

      const data = await res.json();
      const fullExpense = data.expense;

      // 🆕 Buscar faturas disponíveis do cartão para permitir mudança de mês
      const invoicesRes = await fetch(`/api/financial/credit-cards/${fullExpense.creditCardId}/invoices`);
      if (invoicesRes.ok) {
        const invoicesData = await invoicesRes.json();
        setAvailableInvoices(invoicesData.invoices || []);
      }

      setEditingExpense(fullExpense);
      setExpenseForm({
        creditCardId: fullExpense.creditCardId,
        description: fullExpense.description,
        amount: fullExpense.amount.toString(),
        purchaseDate: fullExpense.purchaseDate.split("T")[0],
        categoryId: fullExpense.categoryId || "",
        supplierName: fullExpense.supplierName || "",
        referenceNumber: fullExpense.referenceNumber || "",
        installments: fullExpense.installments?.toString() || "1",
        notes: fullExpense.notes || "",
        invoiceId: fullExpense.invoiceId || "", // 🆕 Fatura atual
        file: null
      });
      setShowEditExpenseDialog(true);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUpdateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;

    try {
      const formData = new FormData();
      Object.entries(expenseForm).forEach(([key, value]) => {
        if (key === "file" && value) {
          formData.append(key, value as File);
        } else if (value !== null && value !== undefined && value !== "" && key !== "creditCardId" && key !== "installments") {
          formData.append(key, String(value));
        }
      });

      console.log('🔄 [UPDATE_EXPENSE] Atualizando despesa:', {
        expenseId: editingExpense.id,
        oldInvoiceId: editingExpense.invoiceId,
        newInvoiceId: expenseForm.invoiceId,
        invoiceChanged: editingExpense.invoiceId !== expenseForm.invoiceId
      });

      const res = await fetch(`/api/financial/credit-cards/expenses/${editingExpense.id}`, {
        method: "PUT",
        body: formData
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao atualizar despesa");
      }

      toast.success("Despesa atualizada com sucesso");
      setShowEditExpenseDialog(false);
      setEditingExpense(null);
      resetExpenseForm();
      
      // Recarregar o extrato se estiver aberto
      if (selectedCard) {
        handleViewStatement(selectedCard);
      }
      
      // Recarregar o extrato da fatura se estiver aberto
      if (selectedInvoice) {
        handleViewInvoiceStatement(selectedInvoice);
      }
      
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm("Deseja realmente excluir esta despesa?")) return;

    try {
      const res = await fetch(`/api/financial/credit-cards/expenses/${expenseId}`, {
        method: "DELETE"
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao excluir despesa");
      }

      toast.success("Despesa excluída com sucesso");
      
      // Recarregar o extrato
      if (selectedCard) {
        handleViewStatement(selectedCard);
      }
      
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const resetCardForm = () => {
    setCardForm({
      name: "",
      cardNumber: "",
      cardFlag: "",
      limit: "",
      closingDay: "",
      dueDay: "",
      color: "#8B5CF6"
    });
  };

  const resetExpenseForm = () => {
    setExpenseForm({
      creditCardId: "",
      description: "",
      amount: "",
      purchaseDate: new Date().toISOString().split("T")[0],
      categoryId: "",
      supplierName: "",
      referenceNumber: "",
      installments: "1",
      notes: "",
      invoiceId: "", // 🆕 Resetar fatura também
      file: null
    });
  };

  // 🆕 Reset form de criar fatura
  const resetCreateInvoiceForm = () => {
    setCreateInvoiceForm({
      creditCardId: "",
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear()
    });
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      OPEN: { label: "Aberta", color: "bg-blue-100 text-blue-800" },
      CLOSED: { label: "Fechada", color: "bg-yellow-100 text-yellow-800" },
      PAID: { label: "Paga", color: "bg-green-100 text-green-800" },
      OVERDUE: { label: "Vencida", color: "bg-red-100 text-red-800" }
    };
    const badge = badges[status as keyof typeof badges] || badges.OPEN;
    return <span className={`px-2 py-1 rounded text-xs font-semibold ${badge.color}`}>{badge.label}</span>;
  };

  if (loading) {
    return <div className="space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-purple-600" />
          Cartões de Crédito
        </h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="cards">Meus Cartões</TabsTrigger>
          <TabsTrigger value="invoices">Faturas</TabsTrigger>
        </TabsList>

        <TabsContent value="cards" className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button onClick={() => setShowNewCardDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Cartão
            </Button>
            <Button 
              onClick={() => {
                // Setar o primeiro cartão ativo como padrão
                const defaultCard = cards.find(c => c.isActive);
                if (defaultCard) {
                  setExpenseForm({ ...expenseForm, creditCardId: defaultCard.id });
                }
                setShowNewExpenseDialog(true);
              }}
              disabled={!cards.some(c => c.isActive)}
            >
              <Receipt className="h-4 w-4 mr-2" />
              Lançar Despesa
            </Button>

            <Button
              onClick={() => {
                const activeCard = cards.find(c => c.isActive);
                if (activeCard) {
                  setCreditForm({ ...creditForm, creditCardId: activeCard.id });
                }
                setShowNewCreditDialog(true);
              }}
              disabled={!cards.some(c => c.isActive)}
              variant="outline"
              className="border-green-600 text-green-600 hover:bg-green-50"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Crédito (Estorno)
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map((card) => (
              <Card key={card.id} className={!card.isActive ? "opacity-50" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: card.color || "#8B5CF6" }}
                      />
                      <CardTitle className="text-lg">{card.name}</CardTitle>
                    </div>
                    {!card.isActive && (
                      <span className="text-xs text-gray-500">Inativo</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {card.cardNumber && (
                      <p className="text-gray-600">
                        <strong>Cartão:</strong> **** {card.cardNumber}
                      </p>
                    )}
                    {card.cardFlag && (
                      <p className="text-gray-600">
                        <strong>Bandeira:</strong> {card.cardFlag}
                      </p>
                    )}
                    {card.limit && (
                      <div className="space-y-1">
                        <p className="text-gray-600">
                          <strong>Limite Total:</strong> R$ {card.limit.toFixed(2)}
                        </p>
                        {(() => {
                          const usado = card.pendingAmount || 0;
                          const restante = card.limit - usado;
                          const porcentagem = (usado / card.limit) * 100;
                          
                          return (
                            <>
                              <div className="flex justify-between text-xs text-gray-600">
                                <span>Usado: R$ {usado.toFixed(2)}</span>
                                <span className={porcentagem > 80 ? "text-red-600 font-semibold" : porcentagem > 60 ? "text-yellow-600" : "text-green-600"}>
                                  {porcentagem.toFixed(1)}%
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                <div 
                                  className={`h-full transition-all ${
                                    porcentagem > 80 ? "bg-red-500" : 
                                    porcentagem > 60 ? "bg-yellow-500" : 
                                    "bg-green-500"
                                  }`}
                                  style={{ width: `${Math.min(porcentagem, 100)}%` }}
                                />
                              </div>
                              <p className="text-xs text-gray-500">
                                Disponível: R$ {restante.toFixed(2)}
                              </p>
                            </>
                          );
                        })()}
                      </div>
                    )}
                    <p className="text-gray-600">
                      <strong>Fechamento:</strong> Dia {card.closingDay}
                    </p>
                    <p className="text-gray-600">
                      <strong>Vencimento:</strong> Dia {card.dueDay}
                    </p>
                    <div className="pt-2 border-t space-y-2">
                      {/* Exibir informações da fatura atual/selecionada */}
                      {card.currentInvoice ? (
                        <>
                          <div>
                            <p className="text-sm font-semibold text-purple-600">
                              Fatura Atual: R$ {card.currentInvoice.totalAmount.toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatReferenceMonth(card.currentInvoice.referenceMonth)} • {card.currentInvoice.expensesCount} lançamento(s)
                            </p>
                          </div>
                          
                          {/* Seletor de fatura - exibir outras faturas disponíveis */}
                          {card.availableInvoices && card.availableInvoices.length > 1 && (
                            <div className="pt-1">
                              <Label className="text-xs text-gray-600">Ver outra fatura:</Label>
                              <Select
                                value={card.currentInvoice.id}
                                onValueChange={(invoiceId) => {
                                  const selectedInvoice = card.availableInvoices?.find(inv => inv.id === invoiceId);
                                  if (selectedInvoice) {
                                    // Atualizar a fatura selecionada no estado local
                                    setCards(cards.map(c => 
                                      c.id === card.id 
                                        ? { ...c, currentInvoice: {
                                            id: selectedInvoice.id,
                                            referenceMonth: selectedInvoice.referenceMonth,
                                            totalAmount: selectedInvoice.totalAmount,
                                            expensesCount: selectedInvoice.expensesCount
                                          }}
                                        : c
                                    ));
                                  }
                                }}
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {card.availableInvoices.map((inv) => (
                                    <SelectItem key={inv.id} value={inv.id}>
                                      {formatReferenceMonth(inv.referenceMonth)} - R$ {inv.totalAmount.toFixed(2)} ({inv.expensesCount} lançamento(s))
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-gray-500">
                          Sem fatura aberta
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleViewStatement(card)}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Ver Extrato
                    </Button>
                    {card.isActive && card.currentInvoice && card.currentInvoice.totalAmount > 0 && (
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => handleCloseInvoice(card)}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Fechar Fatura
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteCard(card)}
                      title="Excluir cartão"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {cards.length === 0 && (
              <Alert className="col-span-full">
                <AlertDescription>
                  Nenhum cartão cadastrado. Clique em "Novo Cartão" para começar.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-3">
          {/* 🆕 Botão para criar nova fatura */}
          <div className="flex justify-end">
            <Button 
              onClick={() => setShowCreateInvoiceDialog(true)}
              disabled={cards.length === 0}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Fatura
            </Button>
          </div>

          {invoices.map((invoice) => {
            const dueDate = new Date(invoice.dueDate);
            const isOverdue = dueDate < new Date() && invoice.status === "CLOSED";

            return (
              <Card key={invoice.id} className={isOverdue ? "border-red-300 bg-red-50/50" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex-1">
                      <h3 className="font-semibold">{invoice.CreditCard.name}</h3>
                      <p className="text-sm text-gray-500">
                        Referência: {formatReferenceMonth(invoice.referenceMonth)}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Vencimento: {dueDate.toLocaleDateString("pt-BR")} • {invoice._count?.Expenses || 0} lançamento(s)
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-lg font-bold">R$ {invoice.totalAmount.toFixed(2)}</p>
                      </div>
                      {getStatusBadge(invoice.status)}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewInvoiceStatement(invoice)}
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          Ver Extrato
                        </Button>
                        {(invoice.status === "CLOSED" || invoice.status === "OVERDUE") && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedInvoice(invoice);
                                setShowPayInvoiceDialog(true);
                              }}
                            >
                              <DollarSign className="h-4 w-4 mr-1" />
                              Pagar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                if (!confirm("Deseja reabrir esta fatura? As despesas não serão excluídas.")) return;
                                
                                try {
                                  const res = await fetch("/api/financial/credit-cards/invoices", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      creditCardId: invoice.creditCardId,
                                      invoiceId: invoice.id,
                                      action: "reopen"
                                    })
                                  });
                                  
                                  if (!res.ok) {
                                    const error = await res.json();
                                    throw new Error(error.error);
                                  }
                                  
                                  toast.success("Fatura reaberta com sucesso");
                                  fetchData();
                                } catch (err: any) {
                                  toast.error(err.message);
                                }
                              }}
                            >
                              Reabrir
                            </Button>
                          </>
                        )}
                        {invoice.status !== "PAID" && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteInvoice(invoice)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {invoices.length === 0 && (
            <Alert>
              <AlertDescription>Nenhuma fatura encontrada.</AlertDescription>
            </Alert>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog Novo Cartão */}
      <Dialog open={showNewCardDialog} onOpenChange={setShowNewCardDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Cartão de Crédito</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateCard} className="space-y-4">
            <div>
              <Label htmlFor="name">Nome do Cartão *</Label>
              <Input
                id="name"
                placeholder="Ex: Nubank Empresa"
                value={cardForm.name}
                onChange={(e) => setCardForm({ ...cardForm, name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cardNumber">Últimos 4 dígitos</Label>
                <Input
                  id="cardNumber"
                  maxLength={4}
                  placeholder="1234"
                  value={cardForm.cardNumber}
                  onChange={(e) => setCardForm({ ...cardForm, cardNumber: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="cardFlag">Bandeira</Label>
                <Select value={cardForm.cardFlag || undefined} onValueChange={(v) => setCardForm({ ...cardForm, cardFlag: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Visa">Visa</SelectItem>
                    <SelectItem value="Mastercard">Mastercard</SelectItem>
                    <SelectItem value="Elo">Elo</SelectItem>
                    <SelectItem value="American Express">American Express</SelectItem>
                    <SelectItem value="Hipercard">Hipercard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="limit">Limite</Label>
              <Input
                id="limit"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={cardForm.limit}
                onChange={(e) => setCardForm({ ...cardForm, limit: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="closingDay">Dia de Fechamento *</Label>
                <Input
                  id="closingDay"
                  type="number"
                  min="1"
                  max="31"
                  placeholder="10"
                  value={cardForm.closingDay}
                  onChange={(e) => setCardForm({ ...cardForm, closingDay: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="dueDay">Dia de Vencimento *</Label>
                <Input
                  id="dueDay"
                  type="number"
                  min="1"
                  max="31"
                  placeholder="15"
                  value={cardForm.dueDay}
                  onChange={(e) => setCardForm({ ...cardForm, dueDay: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowNewCardDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit">Criar Cartão</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Lançar Despesa */}
      <Dialog open={showNewExpenseDialog} onOpenChange={setShowNewExpenseDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lançar Despesa no Cartão</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateExpense} className="space-y-4">
            <div>
              <Label htmlFor="creditCardId">Cartão *</Label>
              <Select 
                value={expenseForm.creditCardId || undefined} 
                onValueChange={(v) => setExpenseForm({ ...expenseForm, creditCardId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cartão" />
                </SelectTrigger>
                <SelectContent>
                  {cards.filter((c) => c.isActive).map((card) => (
                    <SelectItem key={card.id} value={card.id}>{card.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="exp-description">Descrição *</Label>
              <Input
                id="exp-description"
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="exp-amount">Valor *</Label>
                <Input
                  id="exp-amount"
                  type="number"
                  step="0.01"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="exp-purchaseDate">Data da Compra *</Label>
                <Input
                  id="exp-purchaseDate"
                  type="date"
                  value={expenseForm.purchaseDate}
                  onChange={(e) => setExpenseForm({ ...expenseForm, purchaseDate: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="exp-installments">Parcelas</Label>
                <Input
                  id="exp-installments"
                  type="number"
                  min="1"
                  value={expenseForm.installments}
                  onChange={(e) => setExpenseForm({ ...expenseForm, installments: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="exp-categoryId">Categoria</Label>
              <Select 
                value={expenseForm.categoryId || undefined} 
                onValueChange={(v) => setExpenseForm({ ...expenseForm, categoryId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="exp-supplierName">Fornecedor</Label>
                <Input
                  id="exp-supplierName"
                  value={expenseForm.supplierName}
                  onChange={(e) => setExpenseForm({ ...expenseForm, supplierName: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="exp-referenceNumber">Nº Nota/Comprovante</Label>
                <Input
                  id="exp-referenceNumber"
                  value={expenseForm.referenceNumber}
                  onChange={(e) => setExpenseForm({ ...expenseForm, referenceNumber: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="exp-file">Anexo (Comprovante)</Label>
              <Input
                id="exp-file"
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setExpenseForm({ ...expenseForm, file: e.target.files?.[0] || null })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowNewExpenseDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit">Lançar Despesa</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Adicionar Crédito (Estorno) */}
      <Dialog open={showNewCreditDialog} onOpenChange={setShowNewCreditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Adicionar Crédito (Estorno) no Cartão</DialogTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Use este formulário para registrar estornos ou créditos recebidos no cartão de crédito. 
              O valor será abatido da fatura automaticamente.
            </p>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleAddCredit(); }} className="space-y-4">
            <div>
              <Label htmlFor="credit-creditCardId">Cartão *</Label>
              <Select 
                value={creditForm.creditCardId || undefined} 
                onValueChange={(v) => setCreditForm({ ...creditForm, creditCardId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cartão" />
                </SelectTrigger>
                <SelectContent>
                  {cards.filter((c) => c.isActive).map((card) => (
                    <SelectItem key={card.id} value={card.id}>{card.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="credit-description">Descrição *</Label>
              <Input
                id="credit-description"
                placeholder="Ex: Estorno de compra cancelada"
                value={creditForm.description}
                onChange={(e) => setCreditForm({ ...creditForm, description: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="credit-amount">Valor do Crédito *</Label>
                <Input
                  id="credit-amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={creditForm.amount}
                  onChange={(e) => setCreditForm({ ...creditForm, amount: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="credit-creditDate">Data do Crédito *</Label>
                <Input
                  id="credit-creditDate"
                  type="date"
                  value={creditForm.creditDate}
                  onChange={(e) => setCreditForm({ ...creditForm, creditDate: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="credit-referenceNumber">Número de Referência/Protocolo</Label>
              <Input
                id="credit-referenceNumber"
                placeholder="Ex: Protocolo do estorno"
                value={creditForm.referenceNumber}
                onChange={(e) => setCreditForm({ ...creditForm, referenceNumber: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="credit-notes">Observações</Label>
              <textarea
                id="credit-notes"
                className="w-full min-h-[80px] px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Detalhes adicionais sobre o crédito..."
                value={creditForm.notes}
                onChange={(e) => setCreditForm({ ...creditForm, notes: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowNewCreditDialog(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" className="bg-green-600 hover:bg-green-700">
                Adicionar Crédito
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Pagar Fatura */}
      <Dialog open={showPayInvoiceDialog} onOpenChange={setShowPayInvoiceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pagar Fatura</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  <strong>{selectedInvoice.CreditCard.name}</strong>
                  <br />
                  Valor: R$ {selectedInvoice.totalAmount.toFixed(2)}
                </AlertDescription>
              </Alert>
              <div>
                <Label htmlFor="pay-bankAccountId">Conta Bancária *</Label>
                <Select 
                  value={paymentForm.bankAccountId || undefined} 
                  onValueChange={(v) => setPaymentForm({ ...paymentForm, bankAccountId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="pay-paymentDate">Data do Pagamento *</Label>
                <Input
                  id="pay-paymentDate"
                  type="date"
                  value={paymentForm.paymentDate}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowPayInvoiceDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={handlePayInvoice} disabled={!paymentForm.bankAccountId}>
                  Confirmar Pagamento
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Extrato do Cartão */}
      <Dialog open={showStatementDialog} onOpenChange={setShowStatementDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Extrato - {selectedCard?.name} - {selectedCard?.currentInvoice ? formatReferenceMonth(selectedCard.currentInvoice.referenceMonth) : 'Sem fatura'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {loadingExpenses ? (
              [1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)
            ) : cardExpenses.length > 0 ? (
              cardExpenses.map((expense) => {
                const canEdit = !expense.Invoice || expense.Invoice.status === "OPEN";
                return (
                  <Card key={expense.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {expense.Category && (
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: expense.Category.color }}
                              />
                            )}
                            <h3 className="font-semibold">{expense.description}</h3>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            Data: {new Date(expense.purchaseDate).toLocaleDateString("pt-BR")}
                            {expense.Category && ` • ${expense.Category.name}`}
                            {expense.supplierName && ` • ${expense.supplierName}`}
                          </p>
                          {expense.installmentNumber && expense.installments && (
                            <p className="text-xs text-gray-400">
                              Parcela {expense.installmentNumber}/{expense.installments}
                            </p>
                          )}
                          {expense.Invoice && (
                            <p className="text-xs text-gray-400">
                              Fatura: {formatReferenceMonth(expense.Invoice.referenceMonth)}
                              {" • "}
                              {expense.Invoice.status === "OPEN" && "Aberta"}
                              {expense.Invoice.status === "CLOSED" && "Fechada"}
                              {expense.Invoice.status === "PAID" && "Paga"}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Botões de reordenar - usando selectedCard.currentInvoice.id */}
                          {canEdit && selectedCard?.currentInvoice?.id && (
                            <div className="flex flex-col gap-0.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 hover:bg-gray-100"
                                onClick={() => handleReorderExpense(expense.id, 'up', selectedCard!.currentInvoice!.id)}
                                title="Mover para cima"
                              >
                                <ChevronUp className="h-4 w-4 text-gray-500" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 hover:bg-gray-100"
                                onClick={() => handleReorderExpense(expense.id, 'down', selectedCard!.currentInvoice!.id)}
                                title="Mover para baixo"
                              >
                                <ChevronDown className="h-4 w-4 text-gray-500" />
                              </Button>
                            </div>
                          )}
                          <div className="text-right">
                            <p className="text-lg font-bold">R$ {expense.amount.toFixed(2)}</p>
                          </div>
                          {expense.attachmentUrl && (
                            <Button size="sm" variant="ghost" asChild>
                              <a href={expense.attachmentUrl} target="_blank" rel="noopener noreferrer">
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          {canEdit && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditExpense(expense)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteExpense(expense.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <Alert>
                <AlertDescription>Nenhuma despesa encontrada neste cartão.</AlertDescription>
              </Alert>
            )}

            {/* 🆕 Seção de Créditos/Estornos */}
            {invoiceCredits.length > 0 && (
              <div className="mt-6 space-y-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                    Créditos / Estornos
                  </Badge>
                </h3>
                {invoiceCredits.map((credit: any) => (
                  <Card key={credit.id} className="border-green-200">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-green-700">{credit.description}</h3>
                          <p className="text-sm text-gray-500 mt-1">
                            Data: {new Date(credit.creditDate).toLocaleDateString("pt-BR")}
                            {credit.referenceNumber && ` • Ref: ${credit.referenceNumber}`}
                          </p>
                          {credit.notes && (
                            <p className="text-xs text-gray-400 mt-1">{credit.notes}</p>
                          )}
                        </div>
                        <div className="text-right flex items-start gap-2">
                          <div>
                            <p className="text-lg font-bold text-green-600">
                              - R$ {Number(credit.amount).toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-400">Abatido da fatura</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 h-auto"
                            onClick={() => handleDeleteCredit(credit.id, credit.description)}
                            title="Excluir estorno"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Extrato da Fatura */}
      <Dialog open={showInvoiceStatementDialog} onOpenChange={setShowInvoiceStatementDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Extrato da Fatura - {selectedInvoice?.CreditCard.name}
              {selectedInvoice && (
                <span className="text-sm text-gray-500 font-normal ml-2">
                  {formatReferenceMonth(selectedInvoice.referenceMonth)}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {selectedInvoice && (
              <div className="bg-gray-100 p-4 rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total da Fatura:</span>
                  <span className="text-lg font-bold">R$ {selectedInvoice.totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Vencimento:</span>
                  <span className="text-sm">{new Date(selectedInvoice.dueDate).toLocaleDateString("pt-BR")}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Status:</span>
                  {getStatusBadge(selectedInvoice.status)}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Despesas:</span>
                  <span className="text-sm">{invoiceExpenses.length} lançamento(s)</span>
                </div>
              </div>
            )}

            {loadingExpenses ? (
              [1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)
            ) : invoiceExpenses.length > 0 ? (
              invoiceExpenses.map((expense, index) => (
                <Card key={expense.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {expense.Category && (
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: expense.Category.color }}
                            />
                          )}
                          <h3 className="font-semibold">{expense.description}</h3>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          Data: {new Date(expense.purchaseDate).toLocaleDateString("pt-BR")}
                          {expense.Category && ` • ${expense.Category.name}`}
                          {expense.supplierName && ` • ${expense.supplierName}`}
                        </p>
                        {expense.installmentNumber && expense.installments && (
                          <p className="text-xs text-gray-400">
                            Parcela {expense.installmentNumber}/{expense.installments}
                          </p>
                        )}
                        {expense.notes && (
                          <p className="text-xs text-gray-500 mt-1">{expense.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Botões de reordenar */}
                        {selectedInvoice && selectedInvoice.status === "OPEN" && (
                          <div className="flex flex-col gap-0.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 hover:bg-gray-100"
                              onClick={() => handleReorderExpense(expense.id, 'up', selectedInvoice.id)}
                              title="Mover para cima"
                              disabled={index === 0}
                            >
                              <ChevronUp className={`h-4 w-4 ${index === 0 ? 'text-gray-300' : 'text-gray-500'}`} />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 hover:bg-gray-100"
                              onClick={() => handleReorderExpense(expense.id, 'down', selectedInvoice.id)}
                              title="Mover para baixo"
                              disabled={index === invoiceExpenses.length - 1}
                            >
                              <ChevronDown className={`h-4 w-4 ${index === invoiceExpenses.length - 1 ? 'text-gray-300' : 'text-gray-500'}`} />
                            </Button>
                          </div>
                        )}
                        <div className="text-right">
                          <p className="text-lg font-bold">R$ {expense.amount.toFixed(2)}</p>
                        </div>
                        {expense.attachmentUrl && (
                          <Button size="sm" variant="ghost" asChild>
                            <a href={expense.attachmentUrl} target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Alert>
                <AlertDescription>Nenhuma despesa encontrada nesta fatura.</AlertDescription>
              </Alert>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
            {selectedInvoice && selectedInvoice.status !== "PAID" && (
              <Button
                variant="destructive"
                onClick={() => selectedInvoice && handleDeleteInvoice(selectedInvoice)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir Fatura e Todas as Despesas
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowInvoiceStatementDialog(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Editar Despesa */}
      <Dialog open={showEditExpenseDialog} onOpenChange={setShowEditExpenseDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Despesa</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateExpense} className="space-y-4">
            <div>
              <Label htmlFor="edit-exp-description">Descrição *</Label>
              <Input
                id="edit-exp-description"
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-exp-amount">Valor *</Label>
                <Input
                  id="edit-exp-amount"
                  type="number"
                  step="0.01"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-exp-purchaseDate">Data da Compra *</Label>
                <Input
                  id="edit-exp-purchaseDate"
                  type="date"
                  value={expenseForm.purchaseDate}
                  onChange={(e) => setExpenseForm({ ...expenseForm, purchaseDate: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* 🆕 Campo para escolher o CARTÃO */}
            <div>
              <Label htmlFor="edit-exp-creditCardId">💳 Cartão *</Label>
              <Select 
                value={expenseForm.creditCardId || undefined} 
                onValueChange={async (v) => {
                  setExpenseForm({ ...expenseForm, creditCardId: v, invoiceId: '' });
                  // Carregar faturas do novo cartão
                  try {
                    const res = await fetch(`/api/financial/credit-cards/${v}/invoices`);
                    if (res.ok) {
                      const data = await res.json();
                      setAvailableInvoices(data);
                    }
                  } catch (e) {
                    console.error('Erro ao carregar faturas:', e);
                  }
                }}
              >
                <SelectTrigger id="edit-exp-creditCardId">
                  <SelectValue placeholder="Selecione o cartão" />
                </SelectTrigger>
                <SelectContent>
                  {cards.map((card) => (
                    <SelectItem key={card.id} value={card.id}>
                      {card.name} (**** {card.cardNumber})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-orange-600 mt-1">
                ⚠️ Ao mudar o cartão, os limites serão ajustados automaticamente
              </p>
            </div>

            {/* 🆕 Campo para escolher o mês da fatura */}
            <div>
              <Label htmlFor="edit-exp-invoiceId">📅 Mês da Fatura *</Label>
              <Select 
                value={expenseForm.invoiceId || undefined} 
                onValueChange={(v) => setExpenseForm({ ...expenseForm, invoiceId: v })}
              >
                <SelectTrigger id="edit-exp-invoiceId">
                  <SelectValue placeholder="Selecione o mês da fatura" />
                </SelectTrigger>
                <SelectContent>
                  {availableInvoices.length === 0 && (
                    <div className="p-4 text-sm text-gray-500 text-center">
                      Nenhuma fatura disponível
                    </div>
                  )}
                  {availableInvoices.map((inv) => {
                    const [year, month] = inv.referenceMonth.split('-');
                    const monthName = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                    return (
                      <SelectItem key={inv.id} value={inv.id}>
                        {monthName} - R$ {inv.totalAmount.toFixed(2)} ({inv.status === 'OPEN' ? 'Aberta' : inv.status === 'CLOSED' ? 'Fechada' : 'Paga'})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                💡 Mude a fatura para reorganizar suas despesas por mês
              </p>
            </div>
            <div>
              <Label htmlFor="edit-exp-categoryId">Categoria</Label>
              <Select 
                value={expenseForm.categoryId || undefined} 
                onValueChange={(v) => setExpenseForm({ ...expenseForm, categoryId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-exp-supplierName">Fornecedor</Label>
                <Input
                  id="edit-exp-supplierName"
                  value={expenseForm.supplierName}
                  onChange={(e) => setExpenseForm({ ...expenseForm, supplierName: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-exp-referenceNumber">Nº Nota/Comprovante</Label>
                <Input
                  id="edit-exp-referenceNumber"
                  value={expenseForm.referenceNumber}
                  onChange={(e) => setExpenseForm({ ...expenseForm, referenceNumber: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-exp-notes">Observações</Label>
              <Input
                id="edit-exp-notes"
                value={expenseForm.notes}
                onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-exp-file">Anexo (Comprovante)</Label>
              <Input
                id="edit-exp-file"
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setExpenseForm({ ...expenseForm, file: e.target.files?.[0] || null })}
              />
              {editingExpense?.attachmentUrl && (
                <p className="text-xs text-gray-500 mt-1">
                  Arquivo atual: {editingExpense.attachmentName}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => {
                setShowEditExpenseDialog(false);
                setEditingExpense(null);
                resetExpenseForm();
              }}>
                Cancelar
              </Button>
              <Button type="submit">Atualizar Despesa</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 🆕 Dialog - Criar Nova Fatura */}
      <Dialog open={showCreateInvoiceDialog} onOpenChange={setShowCreateInvoiceDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>📅 Criar Nova Fatura</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateInvoice} className="space-y-4">
            <div>
              <Label htmlFor="invoice-card">💳 Cartão *</Label>
              <Select 
                value={createInvoiceForm.creditCardId} 
                onValueChange={(value) => setCreateInvoiceForm({ ...createInvoiceForm, creditCardId: value })}
                required
              >
                <SelectTrigger id="invoice-card">
                  <SelectValue placeholder="Selecione o cartão" />
                </SelectTrigger>
                <SelectContent>
                  {cards.filter(c => c.isActive).map((card) => (
                    <SelectItem key={card.id} value={card.id}>
                      {card.name}
                      {card.cardNumber && ` - **** ${card.cardNumber}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="invoice-month">📆 Mês *</Label>
                <Select 
                  value={createInvoiceForm.month.toString()} 
                  onValueChange={(value) => setCreateInvoiceForm({ ...createInvoiceForm, month: parseInt(value) })}
                  required
                >
                  <SelectTrigger id="invoice-month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Janeiro</SelectItem>
                    <SelectItem value="2">Fevereiro</SelectItem>
                    <SelectItem value="3">Março</SelectItem>
                    <SelectItem value="4">Abril</SelectItem>
                    <SelectItem value="5">Maio</SelectItem>
                    <SelectItem value="6">Junho</SelectItem>
                    <SelectItem value="7">Julho</SelectItem>
                    <SelectItem value="8">Agosto</SelectItem>
                    <SelectItem value="9">Setembro</SelectItem>
                    <SelectItem value="10">Outubro</SelectItem>
                    <SelectItem value="11">Novembro</SelectItem>
                    <SelectItem value="12">Dezembro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="invoice-year">📅 Ano *</Label>
                <Select 
                  value={createInvoiceForm.year.toString()} 
                  onValueChange={(value) => setCreateInvoiceForm({ ...createInvoiceForm, year: parseInt(value) })}
                  required
                >
                  <SelectTrigger id="invoice-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026, 2027, 2028].map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Alert>
              <AlertDescription className="text-sm">
                ℹ️ A fatura será criada com status <strong>"Aberta"</strong> e valor inicial <strong>R$ 0,00</strong>. 
                Você poderá lançar despesas nesta fatura após a criação.
              </AlertDescription>
            </Alert>

            <Alert>
              <AlertDescription className="text-sm">
                ⚠️ Não é possível criar uma fatura para um mês que já possui fatura cadastrada.
              </AlertDescription>
            </Alert>

            <div className="flex justify-end gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setShowCreateInvoiceDialog(false);
                  resetCreateInvoiceForm();
                }}
              >
                Cancelar
              </Button>
              <Button type="submit">
                <Calendar className="h-4 w-4 mr-2" />
                Criar Fatura
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
