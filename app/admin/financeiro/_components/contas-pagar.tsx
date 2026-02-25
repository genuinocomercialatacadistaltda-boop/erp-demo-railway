"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, AlertCircle, CheckCircle, XCircle, Clock, DollarSign, Upload, Download, Edit, Trash2, Filter, X, Calculator } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

interface Expense {
  id: string;
  description: string;
  amount: number;
  competenceDate?: string; // Data de Competência - Quando a despesa ocorreu
  dueDate: string; // Data de Vencimento - Quando a despesa deve ser paga
  paymentDate?: string; // Data de Pagamento - Quando a despesa foi paga
  status: string;
  supplierName?: string;
  referenceNumber?: string;
  feeAmount?: number;
  attachmentUrl?: string;
  attachmentName?: string;
  Category: { name: string; color: string };
  BankAccount?: { name: string };
  type?: string; // 'expense' ou 'credit_card'
  creditCardInfo?: {
    last4Digits?: string;
    invoiceMonth?: string;
    cardName?: string;
    cardDigits?: string;
    invoiceStatus?: string;
  };
  invoiceStatus?: string;
  Customer?: { name: string };
}

interface Category { id: string; name: string; color: string; }
interface BankAccount { id: string; name: string; }
interface Supplier { name: string; }
interface CreditCard {
  id: string;
  name: string;
  limit: number;
  availableLimit: number;
}

export default function ContasPagar() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [activeTab, setActiveTab] = useState("pendentes");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    categoryId: "todos",
    supplierName: "todos",
    customerName: "",
    description: "",
    startDate: "",
    endDate: "",
  });
  const [formData, setFormData] = useState({
    description: "",
    amount: 0,
    categoryId: "",
    bankAccountId: "",
    supplierName: "",
    supplierDocument: "",
    competenceDate: "", // DATA DE COMPETÊNCIA - Quando a despesa ocorreu
    dueDate: "", // DATA DE VENCIMENTO - Quando a despesa deve ser paga
    referenceNumber: "",
    feeAmount: 0,
    notes: "",
    file: null as File | null
  });
  const [paymentData, setPaymentData] = useState({
    bankAccountId: "",
    paymentDate: new Date().toISOString().split("T")[0],
    notes: ""
  });

  // Estados para seleção múltipla
  const [selectedExpenses, setSelectedExpenses] = useState<string[]>([]);
  const [showBulkPayDialog, setShowBulkPayDialog] = useState(false);
  const [expensesWithAcknowledgment, setExpensesWithAcknowledgment] = useState<Set<string>>(new Set());
  const [bulkPaymentData, setBulkPaymentData] = useState({
    bankAccountId: "",
    paymentDate: new Date().toISOString().split("T")[0],
    notes: ""
  });

  const fetchData = async () => {
    try {
      // Buscar todas as despesas (pendentes e pagas) + cartões
      const [expRes, catRes, accRes, supplierRes, cardsRes] = await Promise.all([
        fetch(`/api/financial/expenses`),
        fetch("/api/financial/categories"),
        fetch("/api/financial/bank-accounts"),
        fetch("/api/financial/suppliers"),
        fetch("/api/financial/credit-cards")
      ]);

      if (!expRes.ok || !catRes.ok || !accRes.ok) throw new Error("Erro ao carregar dados");

      const expData = await expRes.json();
      const catData = await catRes.json();
      const accData = await accRes.json();
      const supplierData = supplierRes.ok ? await supplierRes.json() : { suppliers: [] };
      const cardsData = cardsRes.ok ? await cardsRes.json() : { creditCards: [] };

      // Combinar despesas normais e de cartão de crédito
      const allExpenses = [
        ...expData.expenses,
        ...(expData.creditCardExpenses || [])
      ];
      setExpenses(allExpenses);
      setCategories(catData.categories);
      setAccounts(accData.accounts);
      setCreditCards(cardsData.creditCards || []);
      
      // Extrair fornecedores únicos das despesas
      const uniqueSuppliers = Array.from(
        new Set(allExpenses.map((e: Expense) => e.supplierName).filter(Boolean))
      ).map((name) => ({ name: name as string }));
      setSuppliers(uniqueSuppliers);

      // Verificar aceites digitais para despesas de funcionários
      await checkEmployeeAcknowledgments(allExpenses);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 🖊️ Função para verificar aceites digitais
  const checkEmployeeAcknowledgments = async (allExpenses: Expense[]) => {
    try {
      console.log('[CHECK_ACKNOWLEDGMENTS] Verificando aceites digitais...');
      
      // Filtrar apenas despesas de funcionários pendentes
      const employeeExpenses = allExpenses.filter(
        exp => exp.Category?.name?.toLowerCase().includes('pagamento de funcionários') && 
               exp.status === 'PENDING'
      );

      console.log(`[CHECK_ACKNOWLEDGMENTS] ${employeeExpenses.length} despesas de funcionários pendentes encontradas`);

      if (employeeExpenses.length === 0) {
        return;
      }

      // Verificar aceites para cada despesa
      const expenseIds = employeeExpenses.map(exp => exp.id);
      const checkRes = await fetch('/api/financial/expenses/check-acknowledgments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenseIds })
      });

      if (!checkRes.ok) {
        console.error('[CHECK_ACKNOWLEDGMENTS] Erro ao verificar aceites:', await checkRes.text());
        return;
      }

      const checkData = await checkRes.json();
      console.log('[CHECK_ACKNOWLEDGMENTS] Resultado:', checkData);

      // Criar Set com IDs das despesas QUE TÊM aceite
      // (ou seja, que NÃO estão na lista de employeesWithoutAcknowledgment)
      const expensesWithoutAck = new Set(
        checkData.employeesWithoutAcknowledgment?.map((emp: any) => {
          // Encontrar a despesa correspondente ao funcionário
          return employeeExpenses.find(exp => 
            exp.description.toLowerCase().includes(emp.employeeName.toLowerCase())
          )?.id;
        }).filter(Boolean) || []
      );

      // Criar Set com IDs das despesas QUE TÊM aceite (inverso)
      const expensesWithAck = new Set(
        employeeExpenses
          .filter(exp => !expensesWithoutAck.has(exp.id))
          .map(exp => exp.id)
      );

      console.log(`[CHECK_ACKNOWLEDGMENTS] Despesas COM aceite: ${expensesWithAck.size}`);
      console.log(`[CHECK_ACKNOWLEDGMENTS] Despesas SEM aceite: ${expensesWithoutAck.size}`);

      setExpensesWithAcknowledgment(expensesWithAck);
    } catch (error) {
      console.error('[CHECK_ACKNOWLEDGMENTS] Erro:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const form = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (key === "file" && value) {
          form.append(key, value as File);
        } else if (value !== null && value !== undefined) {
          form.append(key, typeof value === "number" ? value.toString() : value as string);
        }
      });

      const res = await fetch("/api/financial/expenses", {
        method: "POST",
        body: form
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao criar despesa");
      }

      toast.success("Despesa criada com sucesso");
      setShowNewDialog(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handlePay = async () => {
    if (!selectedExpense) return;
    try {
      const res = await fetch(`/api/financial/expenses/${selectedExpense.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentData)
      });

      if (!res.ok) throw new Error("Erro ao pagar despesa");

      toast.success("Despesa paga com sucesso");
      setShowPayDialog(false);
      setSelectedExpense(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUnpayExpense = async (expense: Expense) => {
    console.log('[UNPAY] Desmarcando pagamento da despesa:', expense.id);
    
    if (!confirm(`Tem certeza que deseja desmarcar o pagamento de "${expense.description}"?\n\nEsta ação irá:\n✓ Marcar a despesa como PENDENTE\n✓ Remover a data de pagamento`)) {
      return;
    }

    try {
      // Buscar despesa completa para ter todos os dados necessários
      const getRes = await fetch(`/api/financial/expenses/${expense.id}`);
      if (!getRes.ok) throw new Error("Erro ao buscar despesa");
      
      const { expense: fullExpense } = await getRes.json();
      
      const form = new FormData();
      form.append('status', 'PENDING');
      form.append('paymentDate', ''); // Remove a data
      form.append('description', fullExpense.description);
      form.append('amount', fullExpense.amount.toString());
      form.append('categoryId', fullExpense.categoryId);
      if (fullExpense.competenceDate) {
        form.append('competenceDate', fullExpense.competenceDate.split('T')[0]);
      }
      form.append('dueDate', fullExpense.dueDate.split('T')[0]);

      const res = await fetch(`/api/financial/expenses/${expense.id}`, {
        method: "PUT",
        body: form
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao desmarcar pagamento");
      }

      toast.success("Pagamento desmarcado com sucesso");
      fetchData();
    } catch (err: any) {
      console.error('[UNPAY] Erro:', err);
      toast.error(err.message);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    
    try {
      console.log('[EDIT] Dados do formulário:', formData);
      
      const form = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (key === "file" && value) {
          form.append(key, value as File);
        } else if (value !== null && value !== undefined && value !== "") {
          form.append(key, typeof value === "number" ? value.toString() : value as string);
          console.log(`[EDIT] Enviando ${key}:`, value);
        }
      });
      
      // CRITICAL: Sempre enviar competenceDate mesmo que vazio
      if (formData.competenceDate) {
        form.set('competenceDate', formData.competenceDate);
        console.log('[EDIT] ✅ competenceDate definido:', formData.competenceDate);
      } else {
        console.log('[EDIT] ⚠️ competenceDate está vazio');
      }
      
      // Sempre enviar dueDate
      form.set('dueDate', formData.dueDate);
      console.log('[EDIT] ✅ dueDate definido:', formData.dueDate);

      console.log('[EDIT] Enviando requisição para:', `/api/financial/expenses/${editingExpense.id}`);
      const res = await fetch(`/api/financial/expenses/${editingExpense.id}`, {
        method: "PUT",
        body: form
      });

      if (!res.ok) {
        const error = await res.json();
        console.error('[EDIT] ❌ Erro na API:', error);
        throw new Error(error.error || "Erro ao atualizar despesa");
      }

      const result = await res.json();
      console.log('[EDIT] ✅ Despesa atualizada:', result);
      
      toast.success("Despesa atualizada com sucesso");
      setShowEditDialog(false);
      setEditingExpense(null);
      resetForm();
      fetchData();
    } catch (err: any) {
      console.error('[EDIT] ❌ Erro:', err);
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    console.log("[DELETE] Iniciando exclusão...");
    console.log("[DELETE] deletingExpense:", deletingExpense);
    
    if (!deletingExpense) {
      console.error("[DELETE] Nenhuma despesa selecionada para exclusão!");
      toast.error("Nenhuma despesa selecionada para exclusão");
      return;
    }

    try {
      // Verificar se é despesa de cartão ou despesa normal
      const isCreditCard = deletingExpense.type === "CREDIT_CARD";
      const endpoint = isCreditCard 
        ? `/api/financial/credit-cards/expenses/${deletingExpense.id}`
        : `/api/financial/expenses/${deletingExpense.id}`;
      
      console.log(`[DELETE] Tipo de despesa: ${isCreditCard ? "Cartão de Crédito" : "Normal"}`);
      console.log(`[DELETE] Enviando requisição para: ${endpoint}`);
      
      const res = await fetch(endpoint, {
        method: "DELETE"
      });

      console.log("[DELETE] Status da resposta:", res.status);

      if (!res.ok) {
        const error = await res.json();
        console.error("[DELETE] Erro na API:", error);
        throw new Error(error.error || "Erro ao excluir despesa");
      }

      const data = await res.json();
      console.log("[DELETE] Resposta da API:", data);
      
      toast.success(data.message || "Despesa excluída com sucesso");
      setShowDeleteDialog(false);
      setDeletingExpense(null);
      await fetchData();
      
      console.log("[DELETE] Exclusão concluída com sucesso!");
    } catch (err: any) {
      console.error("[DELETE] Erro capturado:", err);
      toast.error(err.message || "Erro ao excluir despesa");
    }
  };

  const handleDeleteGroup = async (groupedFees: Expense[]) => {
    if (!groupedFees || groupedFees.length === 0) {
      toast.error("Nenhuma taxa encontrada para exclusão");
      return;
    }
    
    const confirmMessage = `Você tem certeza que deseja excluir ${groupedFees.length} taxa(s) de cartão?\n\nValor total: R$ ${groupedFees.reduce((sum, fee) => sum + fee.amount, 0).toFixed(2)}`;
    
    if (!confirm(confirmMessage)) {
      return;
    }
    
    try {
      console.log(`[DELETE_GROUP] Iniciando exclusão de ${groupedFees.length} taxas...`);
      
      let successCount = 0;
      let errorCount = 0;
      
      for (const fee of groupedFees) {
        try {
          const isCreditCard = fee.type === "CREDIT_CARD";
          const endpoint = isCreditCard 
            ? `/api/financial/credit-cards/expenses/${fee.id}`
            : `/api/financial/expenses/${fee.id}`;
          
          const res = await fetch(endpoint, {
            method: "DELETE"
          });
          
          if (!res.ok) {
            const error = await res.json();
            console.error(`[DELETE_GROUP] Erro ao excluir ${fee.description}:`, error);
            errorCount++;
          } else {
            successCount++;
          }
        } catch (err: any) {
          console.error(`[DELETE_GROUP] Erro ao excluir ${fee.description}:`, err);
          errorCount++;
        }
      }
      
      console.log(`[DELETE_GROUP] Resultado: ${successCount} excluídas, ${errorCount} erros`);
      
      if (successCount > 0) {
        toast.success(`${successCount} taxa(s) excluída(s) com sucesso`);
        await fetchData();
      }
      
      if (errorCount > 0) {
        toast.error(`Erro ao excluir ${errorCount} taxa(s)`);
      }
    } catch (err: any) {
      console.error("[DELETE_GROUP] Erro capturado:", err);
      toast.error(err.message || "Erro ao excluir taxas");
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedExpenses.length === 0) {
      toast.error("Selecione pelo menos uma despesa para excluir");
      return;
    }

    const confirmMessage = `⚠️ ATENÇÃO: EXCLUSÃO EM MASSA!\n\n` +
      `Você está prestes a EXCLUIR ${selectedExpenses.length} despesa(s) permanentemente.\n\n` +
      `Esta ação NÃO PODE SER DESFEITA!\n\n` +
      `Confirma a exclusão de todas as ${selectedExpenses.length} despesas selecionadas?`;

    if (!confirm(confirmMessage)) {
      return;
    }

    console.log("[DELETE-SELECTED] Iniciando exclusão em massa...");
    console.log("[DELETE-SELECTED] Total de despesas:", selectedExpenses.length);

    let deletedCount = 0;
    let errorCount = 0;

    for (const expenseId of selectedExpenses) {
      const expense = pendingExpenses.find(e => e.id === expenseId);
      if (!expense) continue;

      try {
        const isCreditCard = expense.type === "CREDIT_CARD";
        const endpoint = isCreditCard 
          ? `/api/financial/credit-cards/expenses/${expense.id}`
          : `/api/financial/expenses/${expense.id}`;
        
        const res = await fetch(endpoint, {
          method: "DELETE"
        });

        if (!res.ok) {
          throw new Error("Erro ao excluir");
        }

        deletedCount++;
        console.log(`[DELETE-SELECTED] ✅ Despesa ${expense.id} excluída (${deletedCount}/${selectedExpenses.length})`);
      } catch (err) {
        errorCount++;
        console.error(`[DELETE-SELECTED] ❌ Erro ao excluir despesa ${expense.id}:`, err);
      }
    }

    console.log("[DELETE-SELECTED] Processo concluído:");
    console.log(`   - Excluídas: ${deletedCount}`);
    console.log(`   - Erros: ${errorCount}`);

    if (deletedCount > 0) {
      toast.success(`${deletedCount} despesa(s) excluída(s) com sucesso!${errorCount > 0 ? ` (${errorCount} com erro)` : ''}`);
      setSelectedExpenses([]);
      await fetchData();
    } else {
      toast.error("Nenhuma despesa foi excluída");
    }
  };

  const openEditDialog = async (expense: Expense) => {
    // Buscar os dados completos da despesa para ter acesso aos IDs
    try {
      const res = await fetch(`/api/financial/expenses/${expense.id}`);
      if (!res.ok) throw new Error("Erro ao buscar despesa");
      
      const data = await res.json();
      const fullExpense = data.expense;
      
      setEditingExpense(fullExpense);
      setFormData({
        description: fullExpense.description,
        amount: fullExpense.amount,
        categoryId: fullExpense.categoryId || "",
        bankAccountId: fullExpense.bankAccountId || "",
        supplierName: fullExpense.supplierName || "",
        supplierDocument: fullExpense.supplierDocument || "",
        competenceDate: fullExpense.competenceDate ? fullExpense.competenceDate.split("T")[0] : "",
        dueDate: fullExpense.dueDate.split("T")[0],
        referenceNumber: fullExpense.referenceNumber || "",
        feeAmount: fullExpense.feeAmount || 0,
        notes: fullExpense.notes || "",
        file: null
      });
      setShowEditDialog(true);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      description: "",
      amount: 0,
      categoryId: "",
      bankAccountId: "",
      supplierName: "",
      supplierDocument: "",
      competenceDate: "",
      dueDate: "",
      referenceNumber: "",
      feeAmount: 0,
      notes: "",
      file: null
    });
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      PENDING: { label: "Pendente", color: "bg-yellow-100 text-yellow-800" },
      PAID: { label: "Paga", color: "bg-green-100 text-green-800" },
      OVERDUE: { label: "Vencida", color: "bg-red-100 text-red-800" },
      CANCELLED: { label: "Cancelada", color: "bg-gray-100 text-gray-800" }
    };
    const badge = badges[status as keyof typeof badges] || badges.PENDING;
    return <span className={`px-2 py-1 rounded text-xs font-semibold ${badge.color}`}>{badge.label}</span>;
  };

  // Função de filtragem
  const applyFilters = (expensesList: Expense[]) => {
    return expensesList.filter((expense) => {
      // Filtro por categoria
      if (filters.categoryId && filters.categoryId !== "todos" && expense.Category?.name !== filters.categoryId) {
        return false;
      }
      
      // Filtro por fornecedor
      if (filters.supplierName && filters.supplierName !== "todos" && !expense.supplierName?.toLowerCase().includes(filters.supplierName.toLowerCase())) {
        return false;
      }
      
      // Filtro por cliente (se houver)
      if (filters.customerName && !expense.Customer?.name?.toLowerCase().includes(filters.customerName.toLowerCase())) {
        return false;
      }
      
      // Filtro por descrição
      if (filters.description && !expense.description.toLowerCase().includes(filters.description.toLowerCase())) {
        return false;
      }
      
      // Filtro por período
      if (filters.startDate) {
        const expenseDate = new Date(expense.dueDate);
        const startDate = new Date(filters.startDate);
        if (expenseDate < startDate) return false;
      }
      
      if (filters.endDate) {
        const expenseDate = new Date(expense.dueDate);
        const endDate = new Date(filters.endDate);
        if (expenseDate > endDate) return false;
      }
      
      return true;
    });
  };
  
  const filteredExpenses = applyFilters(expenses);
  
  // Separar despesas normais (sem cartão) e de cartão
  const normalExpenses = filteredExpenses.filter(e => e.type !== 'credit_card' && !e.creditCardInfo);
  const creditCardExpenses = filteredExpenses.filter(e => e.type === 'credit_card' || e.creditCardInfo);
  
  // Despesas normais separadas por status
  const pendingNormalExpenses = normalExpenses.filter(e => e.status === "PENDING" || e.status === "OVERDUE");
  const paidNormalExpenses = normalExpenses.filter(e => e.status === "PAID");
  
  // Função para obter despesas de um cartão específico
  const getCardExpenses = (cardId: string) => {
    const card = creditCards.find(c => c.id === cardId);
    if (!card) return [];
    
    return creditCardExpenses.filter(e => {
      // Verificar pelo creditCardInfo.cardName
      if (e.creditCardInfo?.cardName) {
        return e.creditCardInfo.cardName.toLowerCase().includes(card.name.toLowerCase());
      }
      // Fallback: verificar pelo nome do cartão na descrição (formato "Cartão (Nome do Cartão)")
      const cardMatch = e.description.match(/\(([^)]+)\)/);
      if (cardMatch) {
        return cardMatch[1].toLowerCase().includes(card.name.toLowerCase());
      }
      return false;
    });
  };
  
  const pendingExpenses = pendingNormalExpenses;
  const paidExpenses = paidNormalExpenses;
  
  // 💳 Função para agrupar taxas de cartão por dia
  const groupCardFees = (expensesList: Expense[]) => {
    const grouped: { [key: string]: Expense[] } = {};
    const nonFees: Expense[] = [];
    
    expensesList.forEach(expense => {
      // Verifica se é taxa de cartão (descrição contém "Taxa" e categoria é "Taxa de Cartão")
      const isCardFee = expense.Category.name === "Taxa de Cartão" || 
                        expense.description.toLowerCase().includes("taxa") && 
                        (expense.description.toLowerCase().includes("débito") || 
                         expense.description.toLowerCase().includes("crédito") ||
                         expense.description.toLowerCase().includes("cartão"));
      
      if (isCardFee) {
        const date = new Date(expense.dueDate).toISOString().split('T')[0];
        if (!grouped[date]) {
          grouped[date] = [];
        }
        grouped[date].push(expense);
      } else {
        nonFees.push(expense);
      }
    });
    
    // Criar despesas agrupadas
    const groupedExpenses: Expense[] = Object.entries(grouped).map(([date, fees]) => {
      const totalAmount = fees.reduce((sum, fee) => sum + fee.amount, 0);
      const firstFee = fees[0];
      
      return {
        id: `group-${date}`,
        description: `Taxas de Cartão - ${new Date(date + 'T00:00:00').toLocaleDateString('pt-BR')} (${fees.length} transações)`,
        amount: totalAmount,
        dueDate: date,
        status: firstFee.status,
        Category: { name: "Taxa de Cartão", color: firstFee.Category.color },
        type: 'card_fee_group',
        // @ts-ignore - campo customizado para armazenar detalhes
        _groupedFees: fees
      } as Expense;
    });
    
    return [...groupedExpenses, ...nonFees];
  };
  
  const clearFilters = () => {
    setFilters({
      categoryId: "todos",
      supplierName: "todos",
      customerName: "",
      description: "",
      startDate: "",
      endDate: "",
    });
  };

  // Funções para seleção múltipla
  const toggleExpenseSelection = (expenseId: string) => {
    setSelectedExpenses(prev => 
      prev.includes(expenseId) 
        ? prev.filter(id => id !== expenseId)
        : [...prev, expenseId]
    );
  };

  const selectAllPending = () => {
    const pendingIds = pendingExpenses.map(e => e.id);
    setSelectedExpenses(pendingIds);
  };

  const clearSelection = () => {
    setSelectedExpenses([]);
  };

  const getSelectedTotal = () => {
    return expenses
      .filter(e => selectedExpenses.includes(e.id))
      .reduce((sum, e) => sum + e.amount + (e.feeAmount || 0), 0);
  };

  const handleBulkPayment = async () => {
    if (!bulkPaymentData.bankAccountId) {
      toast.error("Selecione uma conta bancária");
      return;
    }

    if (selectedExpenses.length === 0) {
      toast.error("Selecione pelo menos uma despesa");
      return;
    }

    try {
      console.log('🔄 Pagando múltiplas despesas:', { 
        count: selectedExpenses.length, 
        total: getSelectedTotal(),
        bankAccountId: bulkPaymentData.bankAccountId 
      });

      // 🖊️ VERIFICAR ACEITES DIGITAIS ANTES DE PAGAR
      console.log('🔍 Verificando aceites digitais dos funcionários...');
      
      const checkResponse = await fetch('/api/financial/expenses/check-acknowledgments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expenseIds: selectedExpenses
        })
      });

      if (!checkResponse.ok) {
        throw new Error('Erro ao verificar aceites digitais');
      }

      const checkData = await checkResponse.json();

      // Apenas aviso - NÃO bloqueia o pagamento
      if (!checkData.canProceed && checkData.employeesWithoutAcknowledgment?.length > 0) {
        const employeesList = checkData.employeesWithoutAcknowledgment
          .map((emp: any) => `• ${emp.employeeName} (${emp.month}/${emp.year})`)
          .join('\n');

        toast.warning(
          <div>
            <p className="font-bold mb-2">⚠️ Atenção - Funcionários sem assinatura:</p>
            <div className="text-sm bg-yellow-50 p-2 rounded mt-2 max-h-40 overflow-y-auto whitespace-pre-line">
              {employeesList}
            </div>
            <p className="mt-2 text-xs">Pagamento será processado mesmo assim.</p>
          </div>,
          { duration: 5000 }
        );
        console.warn('⚠️ Funcionários sem aceite (pagamento liberado):', checkData.employeesWithoutAcknowledgment);
      } else {
        console.log('✅ Todos os funcionários deram aceite!');
      }

      console.log('💰 Processando pagamentos...');

      // Processar pagamento de cada despesa SEQUENCIALMENTE (para evitar race condition no saldo)
      const results: { status: 'fulfilled' | 'rejected'; value?: any; reason?: any }[] = [];
      
      for (let i = 0; i < selectedExpenses.length; i++) {
        const expenseId = selectedExpenses[i];
        const expense = expenses.find(e => e.id === expenseId);
        
        if (!expense) {
          results.push({ status: 'rejected', reason: new Error(`Despesa ${expenseId} não encontrada`) });
          continue;
        }

        try {
          console.log(`💰 Pagando despesa ${i + 1}/${selectedExpenses.length}: ${expense.description}`);
          
          const response = await fetch(`/api/financial/expenses/${expenseId}/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bankAccountId: bulkPaymentData.bankAccountId,
              paymentDate: bulkPaymentData.paymentDate,
              notes: bulkPaymentData.notes
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Erro ao pagar ${expense.description}`);
          }

          results.push({ status: 'fulfilled', value: { success: true, expenseId, description: expense.description } });
        } catch (error: any) {
          results.push({ status: 'rejected', reason: error });
        }
      }

      // Contar sucessos e falhas
      const successes = results.filter(r => r.status === 'fulfilled').length;
      const failures = results.filter(r => r.status === 'rejected').length;

      if (successes > 0) {
        toast.success(`${successes} despesa(s) paga(s) com sucesso!`);
      }
      
      if (failures > 0) {
        toast.error(`${failures} despesa(s) falharam ao processar`);
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.error(`❌ Erro no pagamento ${index + 1}:`, result.reason);
          }
        });
      }

      // Recarregar dados e limpar seleção
      await fetchData();
      setSelectedExpenses([]);
      setShowBulkPayDialog(false);
      setBulkPaymentData({
        bankAccountId: "",
        paymentDate: new Date().toISOString().split("T")[0],
        notes: ""
      });

    } catch (error: any) {
      console.error('❌ Erro ao processar pagamentos em lote:', error);
      toast.error(error.message || 'Erro ao processar pagamentos em lote');
    }
  };

  if (loading) {
    return <div className="space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  }

  const renderExpensesList = (expensesList: Expense[]) => {
    if (expensesList.length === 0) {
      return (
        <Alert>
          <AlertDescription>Nenhuma despesa encontrada com os filtros selecionados.</AlertDescription>
        </Alert>
      );
    }
    
    return (
      <div className="space-y-3">
        {expensesList.map((expense) => {
          // 💳 Verificar se é um grupo de taxas de cartão
          const isGroup = expense.type === 'card_fee_group';
          const groupedFees = (expense as any)._groupedFees || [];
          const isExpanded = expandedGroups.has(expense.id);
          
          // Extrair apenas a parte da data (ignorar horas) para evitar problemas de timezone
          const dueDateStr = expense.dueDate.split("T")[0]; // "2025-12-04"
          const [year, month, day] = dueDateStr.split("-").map(Number);
          const dueDate = new Date(year, month - 1, day); // Cria data local sem conversão de timezone
          dueDate.setHours(0, 0, 0, 0);
          
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const isOverdue = dueDate < today && expense.status === "PENDING";
          const totalAmount = expense.amount + (expense.feeAmount || 0);

          // Para data de pagamento, usar o mesmo método
          let paymentDateFormatted = "";
          if (expense.paymentDate) {
            const paymentDateStr = expense.paymentDate.split("T")[0];
            const [pYear, pMonth, pDay] = paymentDateStr.split("-").map(Number);
            const paymentDate = new Date(pYear, pMonth - 1, pDay);
            paymentDateFormatted = paymentDate.toLocaleDateString("pt-BR");
          }

          return (
            <div key={expense.id}>
              <Card className={isOverdue ? "border-red-300 bg-red-50/50" : isGroup ? "border-blue-200 bg-blue-50/30" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    {/* Checkbox para seleção múltipla (apenas para pendentes e não-grupos) */}
                    {expense.status === "PENDING" && !isGroup && (
                      <Checkbox
                        checked={selectedExpenses.includes(expense.id)}
                        onCheckedChange={() => toggleExpenseSelection(expense.id)}
                        className="mr-2"
                      />
                    )}
                    
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: expense.Category.color }} />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{expense.description}</h3>
                          {isGroup && (
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-300">
                              📊 Agrupado
                            </Badge>
                          )}
                          {!isGroup && expense.Category.name?.toLowerCase().includes('pagamento de funcionários') && 
                           expense.status === "PENDING" && 
                           !expensesWithAcknowledgment.has(expense.id) && (
                            <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300">
                              🖊️ Requer Aceite Digital
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          {expense.Category.name}
                          {!isGroup && expense.supplierName && ` • ${expense.supplierName}`}
                          {!isGroup && expense.referenceNumber && ` • Ref: ${expense.referenceNumber}`}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Vencimento: {dueDate.toLocaleDateString("pt-BR")}
                          {expense.paymentDate && ` • Pago em: ${paymentDateFormatted}`}
                          {expense.BankAccount && ` • Conta: ${expense.BankAccount.name}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-lg font-bold">R$ {totalAmount.toFixed(2)}</p>
                        {!isGroup && expense.feeAmount && expense.feeAmount > 0 && (
                          <p className="text-xs text-gray-500">+ taxa R$ {expense.feeAmount.toFixed(2)}</p>
                        )}
                      </div>
                      {getStatusBadge(expense.status)}
                      
                      {/* Botões para grupos */}
                      {isGroup && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setExpandedGroups(prev => {
                                const newSet = new Set(prev);
                                if (newSet.has(expense.id)) {
                                  newSet.delete(expense.id);
                                } else {
                                  newSet.add(expense.id);
                                }
                                return newSet;
                              });
                            }}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            {isExpanded ? "Ocultar" : "Ver Detalhes"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeleteGroup(groupedFees)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      
                      {/* Botões padrão para despesas não-agrupadas */}
                      {!isGroup && (
                        <>
                          {expense.attachmentUrl && (
                            <Button size="sm" variant="ghost" asChild>
                              <a href={expense.attachmentUrl} target="_blank" rel="noopener noreferrer">
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDialog(expense)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              setDeletingExpense(expense);
                              setShowDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      
                      {expense.status === "PENDING" && !isGroup && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedExpense(expense);
                          setPaymentData({
                            bankAccountId: "",
                            paymentDate: new Date().toISOString().split("T")[0],
                            notes: ""
                          });
                          setShowPayDialog(true);
                        }}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Pagar
                      </Button>
                    )}
                    {expense.status === "PAID" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                        onClick={() => handleUnpayExpense(expense)}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Desmarcar Pagamento
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* 📋 Lista expandida de taxas individuais */}
            {isGroup && isExpanded && groupedFees.length > 0 && (
              <div className="ml-8 mt-2 space-y-2">
                {groupedFees.map((fee: Expense, index: number) => (
                  <Card key={fee.id} className="border-l-4 border-blue-400 bg-white">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{fee.description}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {fee.Category.name}
                            {fee.supplierName && ` • ${fee.supplierName}`}
                            {fee.referenceNumber && ` • Ref: ${fee.referenceNumber}`}
                          </p>
                          {fee.paymentDate && (
                            <p className="text-xs text-green-600 mt-1">
                              ✓ Pago em: {new Date(fee.paymentDate).toLocaleDateString('pt-BR')}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-sm">R$ {fee.amount.toFixed(2)}</p>
                          {fee.feeAmount && fee.feeAmount > 0 && (
                            <p className="text-xs text-gray-500">+ R$ {fee.feeAmount.toFixed(2)}</p>
                          )}
                        </div>
                        {getStatusBadge(fee.status)}
                        
                        {/* Botões de Ação para Taxas Individuais */}
                        <div className="flex gap-2">
                          {fee.attachmentUrl && (
                            <Button size="sm" variant="ghost" asChild>
                              <a href={fee.attachmentUrl} target="_blank" rel="noopener noreferrer" title="Download">
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDialog(fee)}
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          
                          {fee.status === "PENDING" && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedExpense(fee);
                                setPaymentData({
                                  bankAccountId: "",
                                  paymentDate: new Date().toISOString().split("T")[0],
                                  notes: ""
                                });
                                setShowPayDialog(true);
                              }}
                              className="bg-green-600 hover:bg-green-700 text-white"
                              title="Pagar"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Pagar
                            </Button>
                          )}
                          
                          {fee.status === "PAID" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                              onClick={() => handleUnpayExpense(fee)}
                              title="Desmarcar Pagamento"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                          
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              setDeletingExpense(fee);
                              setShowDeleteDialog(true);
                            }}
                            title="Deletar"
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
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6 text-blue-600" />
          Contas a Pagar
        </h2>
        <div className="flex gap-2 flex-wrap">
          <Button 
            variant={showFilters ? "default" : "outline"}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
          </Button>
          <Button onClick={() => setShowNewDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Despesa
          </Button>
        </div>
      </div>

      {/* Painel de Filtros */}
      {showFilters && (
        <Card className="bg-gray-50">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="filter-category">Categoria</Label>
                <Select value={filters.categoryId} onValueChange={(v) => setFilters({ ...filters, categoryId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as categorias" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="filter-supplier">Fornecedor</Label>
                <Select value={filters.supplierName} onValueChange={(v) => setFilters({ ...filters, supplierName: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os fornecedores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {suppliers.map((sup, idx) => (
                      <SelectItem key={idx} value={sup.name}>{sup.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="filter-description">Descrição</Label>
                <Input
                  id="filter-description"
                  placeholder="Buscar por descrição..."
                  value={filters.description}
                  onChange={(e) => setFilters({ ...filters, description: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="filter-start-date">Data Início</Label>
                <Input
                  id="filter-start-date"
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="filter-end-date">Data Fim</Label>
                <Input
                  id="filter-end-date"
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                />
              </div>

              <div className="flex items-end">
                <Button variant="outline" onClick={clearFilters} className="w-full">
                  <X className="h-4 w-4 mr-2" />
                  Limpar Filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs para Pendentes, Pagas e Cartões */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(2 + creditCards.length, 6)}, minmax(0, 1fr))` }}>
          <TabsTrigger value="pendentes">
            Contas a Pagar ({pendingExpenses.length})
          </TabsTrigger>
          <TabsTrigger value="pagas">
            Contas Pagas ({paidExpenses.length})
          </TabsTrigger>
          {creditCards.map((card) => {
            const cardExpenses = getCardExpenses(card.id);
            return (
              <TabsTrigger key={card.id} value={`card-${card.id}`}>
                💳 {card.name} ({cardExpenses.length})
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="pendentes" className="mt-4">
          {renderExpensesList(groupCardFees(pendingExpenses))}
        </TabsContent>

        <TabsContent value="pagas" className="mt-4">
          {renderExpensesList(groupCardFees(paidExpenses))}
        </TabsContent>

        {/* Abas de Cartões */}
        {creditCards.map((card) => {
          const cardExpenses = getCardExpenses(card.id);
          const pendingCardExpenses = cardExpenses.filter(e => e.status === "PENDING" || e.status === "OVERDUE");
          const paidCardExpenses = cardExpenses.filter(e => e.status === "PAID");
          
          return (
            <TabsContent key={card.id} value={`card-${card.id}`} className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>💳 {card.name}</span>
                    <div className="flex items-center gap-4 text-sm font-normal">
                      <span className="text-muted-foreground">
                        Limite: <span className="font-semibold text-foreground">{(card.limit || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                      </span>
                      <span className="text-muted-foreground">
                        Disponível: <span className="font-semibold text-green-600">{(card.availableLimit || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                      </span>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="pendentes-card">
                    <TabsList className="grid w-full grid-cols-2 max-w-md">
                      <TabsTrigger value="pendentes-card">
                        Não Pagas ({pendingCardExpenses.length})
                      </TabsTrigger>
                      <TabsTrigger value="pagas-card">
                        Pagas ({paidCardExpenses.length})
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="pendentes-card" className="mt-4">
                      {pendingCardExpenses.length > 0 ? (
                        renderExpensesList(groupCardFees(pendingCardExpenses))
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <p>Nenhuma despesa pendente neste cartão</p>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="pagas-card" className="mt-4">
                      {paidCardExpenses.length > 0 ? (
                        renderExpensesList(groupCardFees(paidCardExpenses))
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <p>Nenhuma despesa paga neste cartão</p>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Dialog Nova Despesa */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Despesa</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="description">Descrição *</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="amount">Valor *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="feeAmount">Taxa</Label>
                <Input
                  id="feeAmount"
                  type="number"
                  step="0.01"
                  value={formData.feeAmount}
                  onChange={(e) => setFormData({ ...formData, feeAmount: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="categoryId">Categoria *</Label>
                <Select value={formData.categoryId || undefined} onValueChange={(v) => setFormData({ ...formData, categoryId: v })}>
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
              <div>
                <Label htmlFor="bankAccountId">Conta Bancária *</Label>
                <Select value={formData.bankAccountId || undefined} onValueChange={(v) => setFormData({ ...formData, bankAccountId: v })}>
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
                <Label htmlFor="competenceDate">Data de Competência</Label>
                <Input
                  id="competenceDate"
                  type="date"
                  value={formData.competenceDate}
                  onChange={(e) => setFormData({ ...formData, competenceDate: e.target.value })}
                  placeholder="Quando a despesa ocorreu"
                />
                <p className="text-xs text-gray-500 mt-1">
                  A data em que a despesa ocorreu (regime de competência)
                </p>
              </div>
              <div>
                <Label htmlFor="dueDate">Vencimento *</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Quando a despesa deve ser paga
                </p>
              </div>
              <div>
                <Label htmlFor="supplierName">Fornecedor</Label>
                <Input
                  id="supplierName"
                  value={formData.supplierName}
                  onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="supplierDocument">CPF/CNPJ</Label>
                <Input
                  id="supplierDocument"
                  value={formData.supplierDocument}
                  onChange={(e) => setFormData({ ...formData, supplierDocument: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="referenceNumber">Nº Nota/Boleto</Label>
                <Input
                  id="referenceNumber"
                  value={formData.referenceNumber}
                  onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="file">Anexo (Nota Fiscal/Boleto)</Label>
                <Input
                  id="file"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setFormData({ ...formData, file: e.target.files?.[0] || null })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowNewDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit">Criar Despesa</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Pagar Despesa */}
      <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pagar Despesa</DialogTitle>
          </DialogHeader>
          {selectedExpense && (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  <strong>{selectedExpense.description}</strong>
                  <br />
                  Valor: R$ {(selectedExpense.amount + (selectedExpense.feeAmount || 0)).toFixed(2)}
                </AlertDescription>
              </Alert>
              <div>
                <Label htmlFor="bankAccountId">Conta Bancária *</Label>
                <Select value={paymentData.bankAccountId || undefined} onValueChange={(v) => setPaymentData({ ...paymentData, bankAccountId: v })}>
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
                <Label htmlFor="paymentDate">Data do Pagamento *</Label>
                <Input
                  id="paymentDate"
                  type="date"
                  value={paymentData.paymentDate}
                  onChange={(e) => setPaymentData({ ...paymentData, paymentDate: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="notes">Observações</Label>
                <Input
                  id="notes"
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowPayDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={handlePay} disabled={!paymentData.bankAccountId}>
                  Confirmar Pagamento
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Editar Despesa */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Despesa</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="edit-description">Descrição *</Label>
                <Input
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-amount">Valor *</Label>
                <Input
                  id="edit-amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-feeAmount">Taxa</Label>
                <Input
                  id="edit-feeAmount"
                  type="number"
                  step="0.01"
                  value={formData.feeAmount}
                  onChange={(e) => setFormData({ ...formData, feeAmount: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="edit-categoryId">Categoria *</Label>
                <Select value={formData.categoryId || undefined} onValueChange={(v) => setFormData({ ...formData, categoryId: v })}>
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
              <div>
                <Label htmlFor="edit-bankAccountId">Conta Bancária *</Label>
                <Select value={formData.bankAccountId || undefined} onValueChange={(v) => setFormData({ ...formData, bankAccountId: v })}>
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
                <Label htmlFor="edit-competenceDate">Data de Competência</Label>
                <Input
                  id="edit-competenceDate"
                  type="date"
                  value={formData.competenceDate}
                  onChange={(e) => setFormData({ ...formData, competenceDate: e.target.value })}
                  placeholder="Quando a despesa ocorreu"
                />
                <p className="text-xs text-gray-500 mt-1">
                  A data em que a despesa ocorreu (regime de competência)
                </p>
              </div>
              <div>
                <Label htmlFor="edit-dueDate">Vencimento *</Label>
                <Input
                  id="edit-dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Quando a despesa deve ser paga
                </p>
              </div>
              <div>
                <Label htmlFor="edit-supplierName">Fornecedor</Label>
                <Input
                  id="edit-supplierName"
                  value={formData.supplierName}
                  onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-supplierDocument">CPF/CNPJ</Label>
                <Input
                  id="edit-supplierDocument"
                  value={formData.supplierDocument}
                  onChange={(e) => setFormData({ ...formData, supplierDocument: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-referenceNumber">Nº Nota/Boleto</Label>
                <Input
                  id="edit-referenceNumber"
                  value={formData.referenceNumber}
                  onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="edit-file">Anexo (Nota Fiscal/Boleto)</Label>
                <Input
                  id="edit-file"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setFormData({ ...formData, file: e.target.files?.[0] || null })}
                />
                {editingExpense?.attachmentUrl && (
                  <p className="text-xs text-gray-500 mt-1">
                    Arquivo atual: {editingExpense.attachmentName}
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => {
                setShowEditDialog(false);
                setEditingExpense(null);
                resetForm();
              }}>
                Cancelar
              </Button>
              <Button type="submit">Atualizar Despesa</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Confirmação de Exclusão */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Confirmar Exclusão
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {deletingExpense?.status === "PAID" ? (
                  <>
                    <p className="font-semibold mb-2">Atenção: Esta despesa já foi paga!</p>
                    <p>Ao excluir esta despesa:</p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>O saldo da conta bancária será <strong>revertido</strong></li>
                      <li>Uma transação de estorno será registrada</li>
                      <li>Esta ação não pode ser desfeita</li>
                    </ul>
                  </>
                ) : (
                  <>
                    <p className="font-semibold">Tem certeza que deseja excluir esta despesa?</p>
                    <p className="mt-2">Esta ação não pode ser desfeita.</p>
                  </>
                )}
              </AlertDescription>
            </Alert>

            {deletingExpense && (
              <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                <p><strong>Descrição:</strong> {deletingExpense.description}</p>
                <p><strong>Valor:</strong> R$ {(deletingExpense.amount + (deletingExpense.feeAmount || 0)).toFixed(2)}</p>
                <p><strong>Status:</strong> {getStatusBadge(deletingExpense.status)}</p>
                {deletingExpense.BankAccount && (
                  <p><strong>Conta:</strong> {deletingExpense.BankAccount.name}</p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowDeleteDialog(false);
                  setDeletingExpense(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Confirmar Exclusão
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Pagamento em Lote */}
      <Dialog open={showBulkPayDialog} onOpenChange={setShowBulkPayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Pagar Múltiplas Despesas
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert className="border-blue-200 bg-blue-50">
              <Calculator className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <p className="font-semibold mb-2">Resumo do Pagamento</p>
                <p><strong>{selectedExpenses.length}</strong> despesa(s) selecionada(s)</p>
                <p className="text-lg font-bold mt-2">
                  Total: R$ {getSelectedTotal().toFixed(2)}
                </p>
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <div>
                <Label>Conta Bancária *</Label>
                <Select 
                  value={bulkPaymentData.bankAccountId} 
                  onValueChange={(v) => setBulkPaymentData({ ...bulkPaymentData, bankAccountId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Data do Pagamento *</Label>
                <Input
                  type="date"
                  value={bulkPaymentData.paymentDate}
                  onChange={(e) => setBulkPaymentData({ ...bulkPaymentData, paymentDate: e.target.value })}
                />
              </div>

              <div>
                <Label>Observações</Label>
                <Input
                  placeholder="Informações adicionais sobre o pagamento"
                  value={bulkPaymentData.notes}
                  onChange={(e) => setBulkPaymentData({ ...bulkPaymentData, notes: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowBulkPayDialog(false);
                  setBulkPaymentData({
                    bankAccountId: "",
                    paymentDate: new Date().toISOString().split("T")[0],
                    notes: ""
                  });
                }}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={handleBulkPayment}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirmar Pagamento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Barra Flutuante de Calculadora e Ações */}
      {selectedExpenses.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white shadow-2xl border-2 border-blue-500 rounded-lg p-4 z-50 animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-3">
              <Calculator className="h-6 w-6 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Total Selecionado</p>
                <p className="text-2xl font-bold text-blue-600">
                  R$ {getSelectedTotal().toFixed(2)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-sm text-gray-600 bg-blue-50 px-3 py-2 rounded">
                <strong>{selectedExpenses.length}</strong> {selectedExpenses.length === 1 ? 'despesa' : 'despesas'}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={clearSelection}
              >
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
              
              {pendingExpenses.length > selectedExpenses.length && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={selectAllPending}
                >
                  Selecionar Todos
                </Button>
              )}
              
              <Button
                size="default"
                onClick={() => setShowBulkPayDialog(true)}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Pagar Todos
              </Button>

              <Button
                size="default"
                variant="destructive"
                onClick={handleDeleteSelected}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Excluir Todos
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
