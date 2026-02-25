"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Plus,
  Search,
  ArrowDownToLine,
  Receipt,
  Calendar,
  TrendingUp,
  Trash2,
  AlertCircle,
  Filter,
  X,
  Edit,
  RotateCcw,
  CheckSquare,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Receivable {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  paymentDate?: string;
  status: string;
  paymentMethod?: string;
  bankAccountId?: string;
  feeAmount?: number;
  netAmount?: number;
  interestAmount?: number; // 🆕 Juros por atraso
  fineAmount?: number; // 🆕 Multa por atraso
  isInstallment: boolean;
  installmentNumber?: number;
  totalInstallments?: number;
  Customer?: {
    name: string;
  };
  Employee?: {
    name: string;
  };
  Order?: {
    orderNumber: string;
    casualCustomerName?: string | null; // 🆕 Nome do cliente avulso (legado)
    customerName?: string | null; // 🔧 Campo principal para clientes avulsos
  };
  BankAccount?: {
    name: string;
  };
}

interface BankAccount {
  id: string;
  name: string;
  bankName: string;
}

// 🔧 CORREÇÃO: Helper para parse seguro de datas (evita problemas de timezone)
const parseDateSafe = (dateString: string): Date => {
  const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
};

export default function ContasReceberFase2() {
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pendentes");
  const [showFilters, setShowFilters] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedReceivable, setSelectedReceivable] = useState<Receivable | null>(null);
  const [deletingReceivable, setDeletingReceivable] = useState<Receivable | null>(null);
  const [filters, setFilters] = useState({
    customerName: "",
    description: "",
    startDate: "",
    endDate: "",
    paymentMethod: "todos",
  });

  const [receiveForm, setReceiveForm] = useState({
    paymentDate: format(new Date(), "yyyy-MM-dd"),
    bankAccountId: "",
    feeAmount: "0",
    interestAmount: "0", // 🆕 Juros por atraso
    fineAmount: "0", // 🆕 Multa por atraso
    paymentMethod: "PIX",
    notes: "",
    paymentAmount: "",
  });

  const [addForm, setAddForm] = useState({
    customerId: "none",
    description: "",
    amount: "",
    dueDate: format(new Date(), "yyyy-MM-dd"),
    competenceDate: format(new Date(), "yyyy-MM-dd"),
    paymentMethod: "PIX",
    notes: "",
    referenceNumber: "",
  });

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingReceivable, setEditingReceivable] = useState<Receivable | null>(null);
  const [editForm, setEditForm] = useState({
    description: "",
    amount: "",
    dueDate: "",
    status: "PENDING",
    paymentMethod: "PIX",
    bankAccountId: "none",
  });

  // 🆕 Estados para recebimento em lote (múltipla seleção)
  const [selectedReceivableIds, setSelectedReceivableIds] = useState<Set<string>>(new Set());
  const [showBatchReceiveDialog, setShowBatchReceiveDialog] = useState(false);
  const [batchReceiveForm, setBatchReceiveForm] = useState({
    paymentDate: format(new Date(), "yyyy-MM-dd"),
    bankAccountId: "",
    paymentMethod: "CASH",
    notes: "",
  });

  useEffect(() => {
    fetchReceivables();
    fetchBankAccounts();
    fetchCustomers();
  }, []);

  const fetchReceivables = async () => {
    try {
      setLoading(true);
      // Buscar todas as contas (pendentes e pagas)
      const response = await fetch(`/api/financial/receivables`);
      const data = await response.json();
      setReceivables(data);
    } catch (error) {
      toast.error("Erro ao carregar contas a receber");
    } finally {
      setLoading(false);
    }
  };

  const fetchBankAccounts = async () => {
    try {
      const response = await fetch("/api/financial/bank-accounts");
      const data = await response.json();
      // A API retorna { accounts: [...] }
      const accounts = data.accounts || data;
      setBankAccounts(Array.isArray(accounts) ? accounts.filter((acc: BankAccount & { isActive: boolean }) => acc.isActive) : []);
    } catch (error) {
      console.error("Erro ao carregar contas bancárias:", error);
      toast.error("Erro ao carregar contas bancárias");
    }
  };

  const fetchCustomers = async () => {
    try {
      // Buscar clientes e funcionários em paralelo
      const [customersRes, employeesRes] = await Promise.all([
        fetch("/api/customers"),
        fetch("/api/hr/employees")
      ]);
      
      const customersData = await customersRes.json();
      const employeesData = await employeesRes.json();
      
      // Filtrar apenas funcionários com limite de crédito ou que recebem adiantamento
      const employeesWithCredit = (Array.isArray(employeesData) ? employeesData : [])
        .filter((emp: any) => emp.creditLimit > 0 || emp.receivesAdvance)
        .map((emp: any) => ({
          id: emp.id,
          name: `${emp.name} (Funcionário)`,
          email: emp.email || null,
          phone: emp.phone || null,
          cpfCnpj: emp.cpf || null,
          isEmployee: true,
          employeeNumber: emp.employeeNumber,
          position: emp.position,
          creditLimit: emp.creditLimit || 0
        }));
      
      // Mesclar clientes e funcionários
      const allCustomers = [
        ...(Array.isArray(customersData) ? customersData : []),
        ...employeesWithCredit
      ];
      
      setCustomers(allCustomers);
      console.log('📋 Clientes + Funcionários carregados:', allCustomers.length);
    } catch (error) {
      console.error("Erro ao carregar clientes:", error);
      toast.error("Erro ao carregar clientes e funcionários");
    }
  };

  const handleDelete = async () => {
    if (!deletingReceivable) return;

    try {
      const response = await fetch(`/api/financial/receivables/${deletingReceivable.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || "Excluído com sucesso!");
        setShowDeleteDialog(false);
        setDeletingReceivable(null);
        fetchReceivables();
      } else {
        const error = await response.json();
        toast.error(error.error || "Erro ao excluir entrada");
      }
    } catch (error) {
      toast.error("Erro ao excluir entrada");
    }
  };

  // Reverter um recebimento (voltar para PENDING)
  const handleRevertPayment = async (receivable: Receivable) => {
    if (!confirm(`Tem certeza que deseja reverter o recebimento?\n\nDescrição: ${receivable.description}\nValor: R$ ${receivable.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n\nO status voltará para PENDENTE.`)) {
      return;
    }

    try {
      // Verificar se é um boleto (tem a flag isBoleto ou boletoId igual ao id)
      const isBoleto = (receivable as any).isBoleto === true || 
                       (receivable as any).boletoId === receivable.id ||
                       receivable.description?.includes('Boleto BOL');
      
      if (isBoleto) {
        // Se for boleto, usar a action 'revert' na API de boletos
        console.log('[REVERT] Revertendo BOLETO:', receivable.id);
        const response = await fetch(`/api/boletos/${receivable.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "revert"
          }),
        });

        if (response.ok) {
          toast.success("Boleto revertido com sucesso! Status voltou para PENDENTE.");
          fetchReceivables();
        } else {
          const error = await response.json();
          toast.error(error.error || "Erro ao reverter boleto");
        }
      } else {
        // Se for receivable normal, usar a API de receivables
        console.log('[REVERT] Revertendo RECEIVABLE:', receivable.id);
        const response = await fetch(`/api/financial/receivables/${receivable.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "PENDING",
            paymentDate: null,
            paymentMethod: receivable.paymentMethod,
            amount: receivable.amount,
            dueDate: receivable.dueDate,
            description: receivable.description,
            revertPayment: true // Flag para a API saber que é reversão
          }),
        });

        if (response.ok) {
          toast.success("Recebimento revertido com sucesso! Status voltou para PENDENTE.");
          fetchReceivables();
        } else {
          const error = await response.json();
          toast.error(error.error || "Erro ao reverter recebimento");
        }
      }
    } catch (error) {
      toast.error("Erro ao reverter recebimento");
    }
  };

  const handleAddReceivable = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!addForm.description || !addForm.amount || !addForm.dueDate || !addForm.competenceDate) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      // Verificar se é funcionário ou cliente
      const selectedPerson = customers.find((c: any) => c.id === addForm.customerId);
      const isEmployee = selectedPerson?.isEmployee === true;
      
      const payload: any = {
        description: addForm.description,
        amount: parseFloat(addForm.amount),
        dueDate: addForm.dueDate,
        competenceDate: addForm.competenceDate,
        paymentMethod: addForm.paymentMethod,
        notes: addForm.notes,
        referenceNumber: addForm.referenceNumber,
        status: "PENDING",
      };
      
      // Adicionar customerId OU employeeId baseado no tipo
      if (addForm.customerId !== "none") {
        if (isEmployee) {
          payload.employeeId = addForm.customerId;
          console.log('🔥 Adicionando receivable para FUNCIONÁRIO:', selectedPerson?.name);
        } else {
          payload.customerId = addForm.customerId;
          console.log('📋 Adicionando receivable para CLIENTE:', selectedPerson?.name);
        }
      }
      
      const response = await fetch("/api/financial/receivables", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success("Conta a receber adicionada com sucesso!");
        setShowAddDialog(false);
        setAddForm({
          customerId: "none",
          description: "",
          amount: "",
          dueDate: format(new Date(), "yyyy-MM-dd"),
          competenceDate: format(new Date(), "yyyy-MM-dd"),
          paymentMethod: "PIX",
          notes: "",
          referenceNumber: "",
        });
        fetchReceivables();
      } else {
        const error = await response.json();
        toast.error(error.error || "Erro ao adicionar conta a receber");
      }
    } catch (error) {
      toast.error("Erro ao adicionar conta a receber");
    }
  };

  const openEditDialog = (receivable: Receivable) => {
    console.log('\n📝 [CONTAS_RECEBER] Abrindo dialog de edição')
    console.log('   - Receivable ID:', receivable.id)
    console.log('   - Descrição atual:', receivable.description)
    console.log('   - Valor atual:', receivable.amount)
    console.log('   - Vencimento atual:', receivable.dueDate)
    console.log('   - Status atual:', receivable.status)
    console.log('   - Método pagamento atual:', receivable.paymentMethod)
    console.log('   - Conta bancária atual:', receivable.bankAccountId)
    
    setEditingReceivable(receivable);
    setEditForm({
      description: receivable.description,
      amount: receivable.amount.toString(),
      dueDate: format(new Date(receivable.dueDate), "yyyy-MM-dd"),
      status: receivable.status,
      paymentMethod: receivable.paymentMethod || "PIX",
      bankAccountId: receivable.bankAccountId || "none",
    });
    setShowEditDialog(true);
  };

  const handleEditReceivable = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingReceivable) return;

    console.log('\n💾 [CONTAS_RECEBER] Salvando edição do receivable')
    console.log('   - ID:', editingReceivable.id)
    console.log('   - Nova descrição:', editForm.description)
    console.log('   - Novo valor:', editForm.amount)
    console.log('   - Nova data vencimento:', editForm.dueDate)
    console.log('   - Novo status:', editForm.status)
    console.log('   - Novo método pagamento:', editForm.paymentMethod)
    console.log('   - Nova conta bancária:', editForm.bankAccountId)

    if (!editForm.description || !editForm.amount || !editForm.dueDate) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      const response = await fetch(`/api/financial/receivables/${editingReceivable.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description: editForm.description,
          amount: parseFloat(editForm.amount),
          dueDate: editForm.dueDate,
          status: editForm.status,
          paymentMethod: editForm.paymentMethod,
          bankAccountId: editForm.bankAccountId === "none" || !editForm.bankAccountId ? undefined : editForm.bankAccountId,
        }),
      });

      if (response.ok) {
        console.log('✅ [CONTAS_RECEBER] Receivable atualizado com sucesso!')
        
        // Se mudou para cartão, avisar ao usuário
        const oldMethod = editingReceivable.paymentMethod
        const newMethod = editForm.paymentMethod
        const isChangingToCard = (newMethod === 'CREDIT_CARD' || newMethod === 'DEBIT' || newMethod === 'CARD') && 
                                 (oldMethod !== 'CREDIT_CARD' && oldMethod !== 'DEBIT' && oldMethod !== 'CARD')
        
        if (isChangingToCard) {
          toast.success("Conta atualizada! CardTransaction criado automaticamente - o pedido agora aparece na Gestão de Cartões! 💳", {
            duration: 5000
          });
        } else {
          toast.success("Conta a receber atualizada com sucesso!");
        }
        
        setShowEditDialog(false);
        setEditingReceivable(null);
        fetchReceivables();
      } else {
        const error = await response.json();
        console.error('❌ [CONTAS_RECEBER] Erro na API:', error)
        toast.error(error.error || "Erro ao atualizar conta a receber");
      }
    } catch (error) {
      console.error('❌ [CONTAS_RECEBER] Erro ao salvar:', error)
      toast.error("Erro ao atualizar conta a receber");
    }
  };

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('🔍 [RECEIVE_FORM] Iniciando handleReceive...');
    console.log('🔍 [RECEIVE_FORM] Event:', e);

    if (!selectedReceivable) {
      console.log('❌ [RECEIVE_FORM] selectedReceivable está null/undefined');
      return;
    }
    
    console.log('✅ [RECEIVE_FORM] selectedReceivable:', selectedReceivable);
    console.log('✅ [RECEIVE_FORM] receiveForm:', receiveForm);

    const paymentAmount = parseFloat(receiveForm.paymentAmount);
    const interestAmount = parseFloat(receiveForm.interestAmount) || 0;
    const fineAmount = parseFloat(receiveForm.fineAmount) || 0;
    
    console.log('💰 [RECEIVE_FORM] Valores parseados:');
    console.log('   paymentAmount:', paymentAmount);
    console.log('   interestAmount:', interestAmount);
    console.log('   fineAmount:', fineAmount);
    
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      console.log('❌ [RECEIVE_FORM] Valor inválido:', paymentAmount);
      toast.error("Digite um valor válido para o pagamento");
      return;
    }
    
    // ✅ VALIDAÇÃO: Verificar se conta bancária foi selecionada
    if (!receiveForm.bankAccountId || receiveForm.bankAccountId === "") {
      console.log('❌ [RECEIVE_FORM] Conta bancária não selecionada');
      toast.error("Selecione uma conta bancária");
      return;
    }
    
    console.log('✅ [RECEIVE_FORM] Conta bancária selecionada:', receiveForm.bankAccountId);

    // 🔧 CORREÇÃO: Arredondar valores para evitar problemas de precisão decimal
    const originalAmount = Math.round(selectedReceivable.amount * 100) / 100;
    const totalWithCharges = Math.round((originalAmount + interestAmount + fineAmount) * 100) / 100;
    const roundedPaymentAmount = Math.round(paymentAmount * 100) / 100;
    
    console.log('📊 [RECEIVE_FORM] Cálculo:');
    console.log('   Valor original (bruto):', selectedReceivable.amount);
    console.log('   Valor original (arredondado):', originalAmount);
    console.log('   Total com encargos:', totalWithCharges);
    console.log('   Valor a pagar:', roundedPaymentAmount);
    
    // ✅ NOVA LÓGICA: Validação com tolerância de 1 centavo (apenas aviso, não bloqueia)
    const tolerance = 0.01; // Tolerância de 1 centavo
    const difference = roundedPaymentAmount - totalWithCharges;
    
    if (difference > tolerance) {
      console.log('⚠️ [RECEIVE_FORM] Valor pago maior que total (diferença:', difference.toFixed(2), ')');
      // AVISO: Não bloqueia mais, apenas informa
      toast.warning(
        `Atenção: O valor do pagamento (R$ ${roundedPaymentAmount.toFixed(2)}) é R$ ${difference.toFixed(2)} maior que o esperado (R$ ${totalWithCharges.toFixed(2)}). Confirme se está correto.`,
        { duration: 5000 }
      );
    } else {
      console.log('✅ [RECEIVE_FORM] Valor dentro da tolerância (diferença:', difference.toFixed(2), ')');
    }

    try {
      console.log('🌐 [RECEIVE_FORM] Iniciando requisição à API...');
      
      const payload = {
        ...receiveForm,
        feeAmount: parseFloat(receiveForm.feeAmount),
        interestAmount: interestAmount, // 🆕 Enviar juros
        fineAmount: fineAmount, // 🆕 Enviar multa
        paymentAmount: paymentAmount,
      };
      
      console.log('📤 [RECEIVE_FORM] Payload:', payload);
      
      const response = await fetch(
        `/api/financial/receivables/${selectedReceivable.id}/receive`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      
      console.log('📥 [RECEIVE_FORM] Response status:', response.status);
      console.log('📥 [RECEIVE_FORM] Response ok:', response.ok);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ [RECEIVE_FORM] Dados recebidos:', data);
        
        // ✅ Usar valores arredondados para determinar se é pagamento parcial
        const isPartial = roundedPaymentAmount < (totalWithCharges - tolerance);
        
        let successMessage = "Conta recebida integralmente!";
        if (isPartial) {
          successMessage = `Pagamento parcial de R$ ${roundedPaymentAmount.toFixed(2)} registrado com sucesso!`;
        } else if (interestAmount > 0 || fineAmount > 0) {
          successMessage = `Conta recebida com juros/multa! Total: R$ ${roundedPaymentAmount.toFixed(2)}`;
        }
        
        console.log('✅ [RECEIVE_FORM] Sucesso! Mensagem:', successMessage);
        toast.success(successMessage);
        setShowReceiveDialog(false);
        fetchReceivables();
      } else {
        const error = await response.json();
        console.log('❌ [RECEIVE_FORM] Erro da API:', error);
        toast.error(error.error || "Erro ao receber conta");
      }
    } catch (error) {
      console.error('❌ [RECEIVE_FORM] Erro crítico:', error);
      toast.error("Erro ao receber conta");
    }
  };

  const openReceiveDialog = (receivable: Receivable) => {
    // ✅ Arredondar valor para 2 casas decimais ao abrir o diálogo
    const roundedAmount = Math.round(receivable.amount * 100) / 100;
    
    setSelectedReceivable(receivable);
    setReceiveForm({
      paymentDate: format(new Date(), "yyyy-MM-dd"),
      bankAccountId: "",
      feeAmount: "0",
      interestAmount: "0", // 🆕 Resetar juros
      fineAmount: "0", // 🆕 Resetar multa
      paymentMethod: receivable.paymentMethod || "PIX",
      notes: "",
      paymentAmount: roundedAmount.toFixed(2), // ✅ Usar valor arredondado
    });
    setShowReceiveDialog(true);
  };

  // 🆕 FUNÇÕES PARA RECEBIMENTO EM LOTE
  const toggleReceivableSelection = (receivableId: string) => {
    setSelectedReceivableIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(receivableId)) {
        newSet.delete(receivableId);
      } else {
        newSet.add(receivableId);
      }
      return newSet;
    });
  };

  const selectAllPending = () => {
    const pendingIds = pendingReceivables.map(r => r.id);
    setSelectedReceivableIds(new Set(pendingIds));
  };

  const clearSelection = () => {
    setSelectedReceivableIds(new Set());
  };

  const getSelectedReceivables = () => {
    return pendingReceivables.filter(r => selectedReceivableIds.has(r.id));
  };

  const getSelectedTotal = () => {
    const selected = getSelectedReceivables();
    return selected.reduce((sum, r) => sum + Number(r.amount), 0);
  };

  const openBatchReceiveDialog = () => {
    if (selectedReceivableIds.size === 0) {
      toast.error("Selecione ao menos um recebível");
      return;
    }
    setBatchReceiveForm({
      paymentDate: format(new Date(), "yyyy-MM-dd"),
      bankAccountId: "",
      paymentMethod: "CASH",
      notes: "",
    });
    setShowBatchReceiveDialog(true);
  };

  const handleBatchReceive = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!batchReceiveForm.bankAccountId) {
      toast.error("Selecione uma conta bancária");
      return;
    }

    const selectedIds = Array.from(selectedReceivableIds);
    const total = getSelectedTotal();

    try {
      const response = await fetch('/api/financial/receivables/batch-receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receivableIds: selectedIds,
          bankAccountId: batchReceiveForm.bankAccountId,
          paymentDate: batchReceiveForm.paymentDate,
          paymentMethod: batchReceiveForm.paymentMethod,
          notes: batchReceiveForm.notes,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`${data.message} - Total: R$ ${data.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        setShowBatchReceiveDialog(false);
        setSelectedReceivableIds(new Set());
        fetchReceivables();
      } else {
        const error = await response.json();
        toast.error(error.error || "Erro ao processar recebimento em lote");
      }
    } catch (error) {
      console.error('Erro no recebimento em lote:', error);
      toast.error("Erro ao processar recebimento em lote");
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "destructive" | "secondary" | "outline"; label: string }> = {
      PENDING: { variant: "secondary", label: "Pendente" },
      PAID: { variant: "default", label: "Pago" },
      OVERDUE: { variant: "destructive", label: "Vencido" },
      CANCELLED: { variant: "outline", label: "Cancelado" },
      PARTIAL: { variant: "secondary", label: "Parcial" },
    };
    const config = variants[status] || variants.PENDING;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // Função de filtragem
  const applyFilters = (receivablesList: Receivable[]) => {
    return receivablesList.filter((receivable) => {
      // Filtro por cliente OU funcionário OU cliente avulso
      if (filters.customerName) {
        const searchTerm = filters.customerName.toLowerCase();
        const customerMatch = receivable.Customer?.name?.toLowerCase().includes(searchTerm);
        const employeeMatch = receivable.Employee?.name?.toLowerCase().includes(searchTerm);
        const casualMatch = receivable.Order?.casualCustomerName?.toLowerCase().includes(searchTerm); // 🆕 Busca por nome do cliente avulso (legado)
        const customerNameMatch = receivable.Order?.customerName?.toLowerCase().includes(searchTerm); // 🔧 Busca por nome do cliente avulso
        
        if (!customerMatch && !employeeMatch && !casualMatch && !customerNameMatch) {
          return false;
        }
      }
      
      // Filtro por descrição
      if (filters.description && !receivable.description.toLowerCase().includes(filters.description.toLowerCase())) {
        return false;
      }
      
      // Filtro por forma de pagamento
      if (filters.paymentMethod && filters.paymentMethod !== "todos" && receivable.paymentMethod !== filters.paymentMethod) {
        return false;
      }
      
      // Filtro por período
      if (filters.startDate) {
        const receivableDate = new Date(receivable.dueDate);
        const startDate = new Date(filters.startDate);
        if (receivableDate < startDate) return false;
      }
      
      if (filters.endDate) {
        const receivableDate = new Date(receivable.dueDate);
        const endDate = new Date(filters.endDate);
        if (receivableDate > endDate) return false;
      }
      
      return true;
    });
  };
  
  const clearFilters = () => {
    setFilters({
      customerName: "",
      description: "",
      startDate: "",
      endDate: "",
      paymentMethod: "todos",
    });
  };
  
  const filteredReceivables = applyFilters(receivables);
  const pendingReceivables = filteredReceivables.filter(r => r.status === "PENDING" || r.status === "OVERDUE" || r.status === "PARTIAL");
  const paidReceivables = filteredReceivables.filter(r => r.status === "PAID");

  const calculateTotals = (receivablesList: Receivable[]) => {
    // 🔧 CORREÇÃO: Usar amount para TODOS os cálculos para consistência matemática
    // Total = Pendente + Recebido (valores brutos originais)
    const pending = receivablesList
      .filter((r) => r.status === "PENDING" || r.status === "OVERDUE" || r.status === "PARTIAL")
      .reduce((sum, r) => sum + r.amount, 0);
    const paid = receivablesList
      .filter((r) => r.status === "PAID")
      .reduce((sum, r) => sum + r.amount, 0); // Usar amount, não netAmount
    const total = pending + paid; // Total = Pendente + Recebido

    return { total, pending, paid };
  };

  const totals = calculateTotals(filteredReceivables);

  // 🔧 HELPER: Extrair nome do cliente de um receivable
  const getCustomerName = (receivable: Receivable): string => {
    return receivable.Order?.casualCustomerName 
      || receivable.Order?.customerName 
      || (receivable.Customer?.name !== 'Cliente Avulso' ? receivable.Customer?.name : null)
      || receivable.Employee?.name 
      || "Sem cliente";
  };

  // 🔧 HELPER: Agrupar recebíveis por cliente
  const groupByCustomer = (receivablesList: Receivable[]) => {
    const groups: { [key: string]: Receivable[] } = {};
    
    receivablesList.forEach(receivable => {
      const customerName = getCustomerName(receivable);
      if (!groups[customerName]) {
        groups[customerName] = [];
      }
      groups[customerName].push(receivable);
    });
    
    // Ordenar cada grupo por data de vencimento
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    });
    
    // Ordenar os grupos: primeiro os com vencimento mais antigo
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      const aOldest = groups[a][0]?.dueDate || '';
      const bOldest = groups[b][0]?.dueDate || '';
      return new Date(aOldest).getTime() - new Date(bOldest).getTime();
    });
    
    return { groups, sortedKeys };
  };

  const renderReceivablesTable = (receivablesList: Receivable[]) => {
    if (loading) {
      return (
        <TableRow>
          <TableCell colSpan={6} className="text-center">
            Carregando...
          </TableCell>
        </TableRow>
      );
    }
    
    if (receivablesList.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={6} className="text-center">
            Nenhuma conta a receber encontrada com os filtros selecionados
          </TableCell>
        </TableRow>
      );
    }
    
    const { groups, sortedKeys } = groupByCustomer(receivablesList);
    
    return sortedKeys.map((customerName) => {
      const customerReceivables = groups[customerName];
      const hasMultiple = customerReceivables.length > 1;
      const customerTotal = customerReceivables.reduce((sum, r) => sum + r.amount, 0);
      
      return (
        <React.Fragment key={customerName}>
          {/* 🆕 Linha de cabeçalho do cliente (se tiver mais de 1 recebível) */}
          {hasMultiple && (
            <TableRow className="bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50">
              <TableCell colSpan={2} className="font-bold text-blue-800 dark:text-blue-300">
                👤 {customerName}
                <Badge variant="secondary" className="ml-2">
                  {customerReceivables.length} recebíveis
                </Badge>
              </TableCell>
              <TableCell className="font-medium text-blue-700 dark:text-blue-400">
                {/* Mostrar intervalo de datas */}
                {format(parseDateSafe(customerReceivables[0].dueDate), "dd/MM", { locale: ptBR })} - {format(parseDateSafe(customerReceivables[customerReceivables.length - 1].dueDate), "dd/MM", { locale: ptBR })}
              </TableCell>
              <TableCell className="font-bold text-blue-800 dark:text-blue-300">
                Total: R$ {customerTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </TableCell>
              <TableCell colSpan={2}></TableCell>
            </TableRow>
          )}
          
          {/* Linhas individuais dos recebíveis */}
          {customerReceivables.map((receivable) => (
            <TableRow 
              key={receivable.id}
              className={hasMultiple ? "bg-gray-50/50 dark:bg-gray-900/30" : ""}
            >
              <TableCell className={`font-medium ${hasMultiple ? "pl-8" : ""}`}>
                {hasMultiple && <span className="text-gray-400 mr-2">└</span>}
                {receivable.description}
                {receivable.isInstallment && (
                  <span className="text-xs text-muted-foreground ml-2">
                    ({receivable.installmentNumber}/{receivable.totalInstallments})
                  </span>
                )}
              </TableCell>
              <TableCell>
                {hasMultiple ? (
                  <span className="text-gray-500 text-sm">—</span>
                ) : (
                  customerName
                )}
              </TableCell>
              <TableCell>
                {format(parseDateSafe(receivable.dueDate), "dd/MM/yyyy", { locale: ptBR })}
              </TableCell>
              <TableCell>
                R$ {receivable.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </TableCell>
              <TableCell>{getStatusBadge(receivable.status)}</TableCell>
              <TableCell className="text-right">
                <div className="flex gap-2 justify-end items-center">
                  {receivable.status === "PENDING" || receivable.status === "OVERDUE" || receivable.status === "PARTIAL" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openReceiveDialog(receivable)}
                    >
                      <ArrowDownToLine className="h-4 w-4 mr-1" />
                      Receber
                    </Button>
                  ) : (
                    <>
                      <span className="text-sm text-muted-foreground mr-2">
                        {receivable.paymentDate
                          ? format(new Date(receivable.paymentDate), "dd/MM/yyyy")
                          : "-"}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRevertPayment(receivable)}
                        title="Reverter recebimento - voltar para PENDENTE"
                        className="text-orange-600 border-orange-300 hover:bg-orange-50 hover:text-orange-700"
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Reverter
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(receivable)}
                    title="Editar conta a receber"
                    className="text-blue-600 hover:text-blue-600 hover:bg-blue-50"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  {!receivable.Order && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDeletingReceivable(receivable);
                        setShowDeleteDialog(true);
                      }}
                      title={receivable.status === "PAID" ? "Estornar e excluir pagamento" : "Excluir conta a receber"}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </React.Fragment>
      );
    });
  };

  // 🆕 Versão da tabela COM checkboxes para seleção múltipla
  const renderReceivablesTableWithCheckbox = (receivablesList: Receivable[]) => {
    if (loading) {
      return (
        <TableRow>
          <TableCell colSpan={7} className="text-center">
            Carregando...
          </TableCell>
        </TableRow>
      );
    }
    
    if (receivablesList.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={7} className="text-center">
            Nenhuma conta a receber encontrada com os filtros selecionados
          </TableCell>
        </TableRow>
      );
    }
    
    const { groups, sortedKeys } = groupByCustomer(receivablesList);
    
    return sortedKeys.map((customerName) => {
      const customerReceivables = groups[customerName];
      const hasMultiple = customerReceivables.length > 1;
      const customerTotal = customerReceivables.reduce((sum, r) => sum + r.amount, 0);
      
      // Verificar se todos os recebíveis do cliente estão selecionados
      const allCustomerSelected = customerReceivables.every(r => selectedReceivableIds.has(r.id));
      const someCustomerSelected = customerReceivables.some(r => selectedReceivableIds.has(r.id));
      
      const toggleCustomerSelection = () => {
        setSelectedReceivableIds(prev => {
          const newSet = new Set(prev);
          if (allCustomerSelected) {
            // Desmarcar todos do cliente
            customerReceivables.forEach(r => newSet.delete(r.id));
          } else {
            // Marcar todos do cliente
            customerReceivables.forEach(r => newSet.add(r.id));
          }
          return newSet;
        });
      };
      
      return (
        <React.Fragment key={customerName}>
          {/* Linha de cabeçalho do cliente (se tiver mais de 1 recebível) */}
          {hasMultiple && (
            <TableRow className="bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50">
              <TableCell className="w-12">
                <Checkbox
                  checked={allCustomerSelected}
                  onCheckedChange={toggleCustomerSelection}
                  className={someCustomerSelected && !allCustomerSelected ? "opacity-50" : ""}
                  title={`Selecionar todos os ${customerReceivables.length} recebíveis de ${customerName}`}
                />
              </TableCell>
              <TableCell colSpan={2} className="font-bold text-blue-800 dark:text-blue-300">
                👤 {customerName}
                <Badge variant="secondary" className="ml-2">
                  {customerReceivables.length} recebíveis
                </Badge>
              </TableCell>
              <TableCell className="font-medium text-blue-700 dark:text-blue-400">
                {format(parseDateSafe(customerReceivables[0].dueDate), "dd/MM", { locale: ptBR })} - {format(parseDateSafe(customerReceivables[customerReceivables.length - 1].dueDate), "dd/MM", { locale: ptBR })}
              </TableCell>
              <TableCell className="font-bold text-blue-800 dark:text-blue-300">
                Total: R$ {customerTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </TableCell>
              <TableCell colSpan={2}></TableCell>
            </TableRow>
          )}
          
          {/* Linhas individuais dos recebíveis */}
          {customerReceivables.map((receivable) => (
            <TableRow 
              key={receivable.id}
              className={`${hasMultiple ? "bg-gray-50/50 dark:bg-gray-900/30" : ""} ${selectedReceivableIds.has(receivable.id) ? "bg-green-50 dark:bg-green-950/20" : ""}`}
            >
              <TableCell className="w-12">
                <Checkbox
                  checked={selectedReceivableIds.has(receivable.id)}
                  onCheckedChange={() => toggleReceivableSelection(receivable.id)}
                />
              </TableCell>
              <TableCell className={`font-medium ${hasMultiple ? "pl-4" : ""}`}>
                {hasMultiple && <span className="text-gray-400 mr-2">└</span>}
                {receivable.description}
                {receivable.isInstallment && (
                  <span className="text-xs text-muted-foreground ml-2">
                    ({receivable.installmentNumber}/{receivable.totalInstallments})
                  </span>
                )}
              </TableCell>
              <TableCell>
                {hasMultiple ? (
                  <span className="text-gray-500 text-sm">—</span>
                ) : (
                  customerName
                )}
              </TableCell>
              <TableCell>
                {format(parseDateSafe(receivable.dueDate), "dd/MM/yyyy", { locale: ptBR })}
              </TableCell>
              <TableCell>
                R$ {receivable.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </TableCell>
              <TableCell>{getStatusBadge(receivable.status)}</TableCell>
              <TableCell className="text-right">
                <div className="flex gap-2 justify-end items-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openReceiveDialog(receivable)}
                  >
                    <ArrowDownToLine className="h-4 w-4 mr-1" />
                    Receber
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(receivable)}
                    title="Editar conta a receber"
                    className="text-blue-600 hover:text-blue-600 hover:bg-blue-50"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  {!receivable.Order && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDeletingReceivable(receivable);
                        setShowDeleteDialog(true);
                      }}
                      title="Excluir conta a receber"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </React.Fragment>
      );
    });
  };

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total a Receber</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {totals.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredReceivables.length} conta(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendente</CardTitle>
            <Calendar className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">
              R$ {totals.pending.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recebido</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              R$ {totals.paid.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Botões de Ação e Filtros */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h3 className="text-lg font-semibold">Contas a Receber</h3>
        <div className="flex gap-2">
          <Button 
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button variant="default" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Manualmente
              </Button>
            </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Adicionar Conta a Receber</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddReceivable} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <Label htmlFor="customer">
                          Cliente (Opcional)
                        </Label>
                        <Select
                          value={addForm.customerId}
                          onValueChange={(value) =>
                            setAddForm({ ...addForm, customerId: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um cliente (opcional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhum cliente</SelectItem>
                            {Array.isArray(customers) && customers.map((customer) => (
                              <SelectItem key={customer.id} value={customer.id}>
                                {customer.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="col-span-2">
                        <Label htmlFor="description">
                          Descrição <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="description"
                          value={addForm.description}
                          onChange={(e) =>
                            setAddForm({ ...addForm, description: e.target.value })
                          }
                          placeholder="Ex: Pagamento de serviço, Venda à vista, etc."
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="amount">
                          Valor <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="amount"
                          type="number"
                          step="0.01"
                          min="0"
                          value={addForm.amount}
                          onChange={(e) =>
                            setAddForm({ ...addForm, amount: e.target.value })
                          }
                          placeholder="0.00"
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="dueDate">
                          Data de Vencimento <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="dueDate"
                          type="date"
                          value={addForm.dueDate}
                          onChange={(e) =>
                            setAddForm({ ...addForm, dueDate: e.target.value })
                          }
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="competenceDate">
                          Data de Competência <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="competenceDate"
                          type="date"
                          value={addForm.competenceDate}
                          onChange={(e) =>
                            setAddForm({ ...addForm, competenceDate: e.target.value })
                          }
                          required
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Mês/ano em que a venda foi realizada
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="paymentMethod">Forma de Pagamento</Label>
                        <Select
                          value={addForm.paymentMethod}
                          onValueChange={(value) =>
                            setAddForm({ ...addForm, paymentMethod: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PIX">PIX</SelectItem>
                            <SelectItem value="CASH">Dinheiro</SelectItem>
                            <SelectItem value="CREDIT_CARD">Cartão de Crédito</SelectItem>
                            <SelectItem value="DEBIT">Cartão de Débito</SelectItem>
                            <SelectItem value="BOLETO">Boleto</SelectItem>
                            <SelectItem value="TRANSFER">Transferência</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="referenceNumber">Número de Referência</Label>
                        <Input
                          id="referenceNumber"
                          value={addForm.referenceNumber}
                          onChange={(e) =>
                            setAddForm({ ...addForm, referenceNumber: e.target.value })
                          }
                          placeholder="Ex: NF-12345, Contrato-001"
                        />
                      </div>

                      <div className="col-span-2">
                        <Label htmlFor="notes">Observações</Label>
                        <Input
                          id="notes"
                          value={addForm.notes}
                          onChange={(e) =>
                            setAddForm({ ...addForm, notes: e.target.value })
                          }
                          placeholder="Observações adicionais (opcional)"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowAddDialog(false)}
                      >
                        Cancelar
                      </Button>
                      <Button type="submit">Adicionar</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

      {/* Painel de Filtros */}
      {showFilters && (
        <Card className="bg-gray-50">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="filter-customer">Cliente</Label>
                <Input
                  id="filter-customer"
                  placeholder="Buscar por cliente..."
                  value={filters.customerName}
                  onChange={(e) => setFilters({ ...filters, customerName: e.target.value })}
                />
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
                <Label htmlFor="filter-payment-method">Forma de Pagamento</Label>
                <Select value={filters.paymentMethod} onValueChange={(v) => setFilters({ ...filters, paymentMethod: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas</SelectItem>
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="BOLETO">Boleto</SelectItem>
                    <SelectItem value="CARD">Cartão</SelectItem>
                    <SelectItem value="CASH">Dinheiro</SelectItem>
                    <SelectItem value="TRANSFER">Transferência</SelectItem>
                  </SelectContent>
                </Select>
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

      {/* Tabs para Pendentes e Recebidas */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="pendentes">
            Contas a Receber ({pendingReceivables.length})
          </TabsTrigger>
          <TabsTrigger value="recebidas">
            Contas Recebidas ({paidReceivables.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {/* 🆕 Barra de ações para seleção múltipla */}
              {selectedReceivableIds.size > 0 && (
                <div className="mb-4 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-800 dark:text-green-300">
                      {selectedReceivableIds.size} recebível(eis) selecionado(s)
                    </span>
                    <span className="text-green-600 dark:text-green-400">
                      - Total: R$ {getSelectedTotal().toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearSelection}
                      className="text-gray-600"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Limpar
                    </Button>
                    <Button
                      size="sm"
                      onClick={openBatchReceiveDialog}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <ArrowDownToLine className="h-4 w-4 mr-1" />
                      Receber Selecionados
                    </Button>
                  </div>
                </div>
              )}

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={pendingReceivables.length > 0 && selectedReceivableIds.size === pendingReceivables.length}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              selectAllPending();
                            } else {
                              clearSelection();
                            }
                          }}
                          title="Selecionar todos"
                        />
                      </TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {renderReceivablesTableWithCheckbox(pendingReceivables)}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recebidas" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {renderReceivablesTable(paidReceivables)}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de Recebimento */}
      <Dialog open={showReceiveDialog} onOpenChange={setShowReceiveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receber Conta</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleReceive} className="space-y-4">
            <div>
              <Label>Valor Total da Conta</Label>
              <Input
                value={`R$ ${selectedReceivable ? (Math.round(selectedReceivable.amount * 100) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'}`}
                disabled
                className="bg-gray-100"
              />
            </div>

            {/* 🆕 Campos de Juros e Multa */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="interestAmount">Juros (R$)</Label>
                <Input
                  id="interestAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={receiveForm.interestAmount}
                  onChange={(e) =>
                    setReceiveForm({ ...receiveForm, interestAmount: e.target.value })
                  }
                  placeholder="0,00"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Juros cobrados pelo atraso
                </p>
              </div>

              <div>
                <Label htmlFor="fineAmount">Multa (R$)</Label>
                <Input
                  id="fineAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={receiveForm.fineAmount}
                  onChange={(e) =>
                    setReceiveForm({ ...receiveForm, fineAmount: e.target.value })
                  }
                  placeholder="0,00"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Multa cobrada pelo atraso
                </p>
              </div>
            </div>

            {/* 🆕 Total com Juros e Multa */}
            {(parseFloat(receiveForm.interestAmount || "0") > 0 || parseFloat(receiveForm.fineAmount || "0") > 0) && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Valor Original:</span>
                  <span className="font-medium">R$ {(Math.round((selectedReceivable?.amount || 0) * 100) / 100).toFixed(2)}</span>
                </div>
                {parseFloat(receiveForm.interestAmount || "0") > 0 && (
                  <div className="flex justify-between items-center text-sm mt-1">
                    <span className="text-gray-600">+ Juros:</span>
                    <span className="font-medium text-orange-600">R$ {parseFloat(receiveForm.interestAmount).toFixed(2)}</span>
                  </div>
                )}
                {parseFloat(receiveForm.fineAmount || "0") > 0 && (
                  <div className="flex justify-between items-center text-sm mt-1">
                    <span className="text-gray-600">+ Multa:</span>
                    <span className="font-medium text-orange-600">R$ {parseFloat(receiveForm.fineAmount).toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-blue-300 mt-2 pt-2 flex justify-between items-center">
                  <span className="font-semibold text-gray-700">Total com Encargos:</span>
                  <span className="font-bold text-blue-600 text-lg">
                    R$ {(Math.round(((selectedReceivable?.amount || 0) + parseFloat(receiveForm.interestAmount || "0") + parseFloat(receiveForm.fineAmount || "0")) * 100) / 100).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="paymentAmount">Valor a Pagar *</Label>
              <Input
                id="paymentAmount"
                type="number"
                step="0.01"
                min="0.01"
                value={receiveForm.paymentAmount}
                onChange={(e) =>
                  setReceiveForm({ ...receiveForm, paymentAmount: e.target.value })
                }
                placeholder="Digite o valor que será pago"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                {(() => {
                  const paymentValue = parseFloat(receiveForm.paymentAmount || "0");
                  const totalWithCharges = (selectedReceivable?.amount || 0) + parseFloat(receiveForm.interestAmount || "0") + parseFloat(receiveForm.fineAmount || "0");
                  
                  if (paymentValue < totalWithCharges && paymentValue > 0) {
                    return (
                      <span className="text-orange-600 font-medium">
                        ⚠️ Pagamento parcial. Saldo restante: R$ {(totalWithCharges - paymentValue).toFixed(2)}
                      </span>
                    );
                  } else if (paymentValue === totalWithCharges) {
                    return (
                      <span className="text-green-600 font-medium">
                        ✓ Pagamento integral {totalWithCharges > (selectedReceivable?.amount || 0) ? '(com juros/multa)' : ''}
                      </span>
                    );
                  }
                  return null;
                })()}
              </p>
            </div>

            <div>
              <Label htmlFor="paymentDate">Data do Pagamento *</Label>
              <Input
                id="paymentDate"
                type="date"
                value={receiveForm.paymentDate}
                onChange={(e) =>
                  setReceiveForm({ ...receiveForm, paymentDate: e.target.value })
                }
                required
              />
            </div>

            <div>
              <Label htmlFor="bankAccountId">Conta Bancária *</Label>
              <Select
                value={receiveForm.bankAccountId}
                onValueChange={(value) =>
                  setReceiveForm({ ...receiveForm, bankAccountId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="paymentMethod">Forma de Pagamento *</Label>
              <Select
                value={receiveForm.paymentMethod}
                onValueChange={(value) =>
                  setReceiveForm({ ...receiveForm, paymentMethod: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="BOLETO">Boleto</SelectItem>
                  <SelectItem value="CARD">Cartão</SelectItem>
                  <SelectItem value="CASH">Dinheiro</SelectItem>
                  <SelectItem value="TRANSFER">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="feeAmount">Taxa/Desconto (R$)</Label>
              <Input
                id="feeAmount"
                type="number"
                step="0.01"
                value={receiveForm.feeAmount}
                onChange={(e) =>
                  setReceiveForm({ ...receiveForm, feeAmount: e.target.value })
                }
                placeholder="Ex: 1.70"
              />
              {receiveForm.paymentMethod === 'BOLETO' && (
                <p className="text-xs text-muted-foreground mt-1.5 bg-blue-50 p-2 rounded border border-blue-200">
                  💡 <span className="font-medium">Taxas de Boleto:</span>
                  <br />
                  • QR Code / PIX Copia e Cola: <span className="font-semibold text-blue-700">R$ 0,50</span>
                  <br />
                  • Código de Barras: <span className="font-semibold text-blue-700">R$ 1,70</span>
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="notes">Observações</Label>
              <Input
                id="notes"
                value={receiveForm.notes}
                onChange={(e) =>
                  setReceiveForm({ ...receiveForm, notes: e.target.value })
                }
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowReceiveDialog(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">Confirmar Recebimento</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Edição */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-blue-600" />
              Editar Conta a Receber
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditReceivable} className="space-y-4">
            <div>
              <Label htmlFor="edit-description">Descrição *</Label>
              <Input
                id="edit-description"
                value={editForm.description}
                onChange={(e) =>
                  setEditForm({ ...editForm, description: e.target.value })
                }
                placeholder="Ex: Pedido #1234"
                required
              />
            </div>

            <div>
              <Label htmlFor="edit-amount">Valor (R$) *</Label>
              <Input
                id="edit-amount"
                type="number"
                step="0.01"
                min="0"
                value={editForm.amount}
                onChange={(e) =>
                  setEditForm({ ...editForm, amount: e.target.value })
                }
                placeholder="0,00"
                required
              />
            </div>

            <div>
              <Label htmlFor="edit-dueDate">Data de Vencimento *</Label>
              <Input
                id="edit-dueDate"
                type="date"
                value={editForm.dueDate}
                onChange={(e) =>
                  setEditForm({ ...editForm, dueDate: e.target.value })
                }
                required
              />
            </div>

            <div>
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={editForm.status}
                onValueChange={(value) =>
                  setEditForm({ ...editForm, status: value })
                }
              >
                <SelectTrigger id="edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">Pendente</SelectItem>
                  <SelectItem value="OVERDUE">Vencido</SelectItem>
                  <SelectItem value="PAID">Pago</SelectItem>
                  <SelectItem value="CANCELLED">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="edit-paymentMethod">Forma de Pagamento</Label>
              <Select
                value={editForm.paymentMethod}
                onValueChange={(value) =>
                  setEditForm({ ...editForm, paymentMethod: value })
                }
              >
                <SelectTrigger id="edit-paymentMethod">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="DEBIT">Cartão de Débito</SelectItem>
                  <SelectItem value="CREDIT_CARD">Cartão de Crédito</SelectItem>
                  <SelectItem value="CARD">Cartão (Genérico)</SelectItem>
                  <SelectItem value="CASH">Dinheiro</SelectItem>
                  <SelectItem value="BANK_SLIP">Boleto</SelectItem>
                  <SelectItem value="BANK_TRANSFER">Transferência</SelectItem>
                  <SelectItem value="CHECK">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="edit-bankAccountId">Conta Bancária</Label>
              <Select
                value={editForm.bankAccountId}
                onValueChange={(value) =>
                  setEditForm({ ...editForm, bankAccountId: value })
                }
              >
                <SelectTrigger id="edit-bankAccountId">
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {bankAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} - {account.bankName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Alert className="border-blue-200 bg-blue-50">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 text-sm">
                <p className="font-semibold">Atenção:</p>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  <li>Alterações na data afetam relatórios e fluxo de caixa</li>
                  <li>Mudar o status para "Pago" não registra transação bancária</li>
                  <li>Use o botão "Receber" para recebimentos reais</li>
                  <li className="font-semibold text-green-700">✨ Ao mudar para CARTÃO, criaremos automaticamente uma transação de cartão!</li>
                </ul>
              </AlertDescription>
            </Alert>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowEditDialog(false);
                  setEditingReceivable(null);
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                <Edit className="h-4 w-4 mr-2" />
                Salvar Alterações
              </Button>
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
                {deletingReceivable?.status === "PAID" ? (
                  <>
                    <p className="font-semibold mb-2">Atenção: Este recebimento já foi pago!</p>
                    <p>Ao excluir esta entrada:</p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>O saldo da conta bancária será <strong>revertido</strong></li>
                      <li>Uma transação de estorno será registrada</li>
                      <li>Esta ação não pode ser desfeita</li>
                    </ul>
                  </>
                ) : (
                  <>
                    <p className="font-semibold">Tem certeza que deseja excluir esta conta a receber?</p>
                    <p className="mt-2">Esta ação não pode ser desfeita.</p>
                  </>
                )}
              </AlertDescription>
            </Alert>

            {deletingReceivable && (
              <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                <p><strong>Descrição:</strong> {deletingReceivable.description}</p>
                <p><strong>Valor:</strong> R$ {deletingReceivable.amount.toFixed(2)}</p>
                <p>
                  <strong>Status:</strong>{" "}
                  <Badge
                    variant={
                      deletingReceivable.status === "PAID"
                        ? "default"
                        : deletingReceivable.status === "PENDING"
                        ? "secondary"
                        : "destructive"
                    }
                  >
                    {deletingReceivable.status === "PAID"
                      ? "Recebido"
                      : deletingReceivable.status === "PENDING"
                      ? "Pendente"
                      : "Vencido"}
                  </Badge>
                </p>
                {(deletingReceivable.Customer || deletingReceivable.Employee) && (
                  <p>
                    <strong>{deletingReceivable.Customer ? "Cliente" : "Funcionário"}:</strong>{" "}
                    {deletingReceivable.Customer?.name || deletingReceivable.Employee?.name}
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowDeleteDialog(false);
                  setDeletingReceivable(null);
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

      {/* 🆕 Dialog de Recebimento em Lote */}
      <Dialog open={showBatchReceiveDialog} onOpenChange={setShowBatchReceiveDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-green-600" />
              Receber Múltiplos ({selectedReceivableIds.size})
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBatchReceive} className="space-y-4">
            {/* Resumo dos selecionados */}
            <div className="bg-green-50 dark:bg-green-950/30 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-green-700 dark:text-green-400">Recebíveis selecionados:</span>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  {selectedReceivableIds.size} itens
                </Badge>
              </div>
              <div className="text-2xl font-bold text-green-800 dark:text-green-300">
                R$ {getSelectedTotal().toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
              <div className="mt-2 max-h-32 overflow-y-auto text-xs text-green-600 dark:text-green-500">
                {getSelectedReceivables().map((r, i) => (
                  <div key={r.id} className="flex justify-between py-0.5">
                    <span className="truncate max-w-[200px]">{r.description}</span>
                    <span>R$ {r.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="batchPaymentDate">
                Data do Recebimento <span className="text-red-500">*</span>
              </Label>
              <Input
                id="batchPaymentDate"
                type="date"
                value={batchReceiveForm.paymentDate}
                onChange={(e) => setBatchReceiveForm({ ...batchReceiveForm, paymentDate: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="batchBankAccountId">
                Conta Bancária <span className="text-red-500">*</span>
              </Label>
              <Select
                value={batchReceiveForm.bankAccountId}
                onValueChange={(value) => setBatchReceiveForm({ ...batchReceiveForm, bankAccountId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} ({account.bankName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="batchPaymentMethod">Forma de Pagamento</Label>
              <Select
                value={batchReceiveForm.paymentMethod}
                onValueChange={(value) => setBatchReceiveForm({ ...batchReceiveForm, paymentMethod: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Dinheiro</SelectItem>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="TRANSFER">Transferência</SelectItem>
                  <SelectItem value="CREDIT_CARD">Cartão de Crédito</SelectItem>
                  <SelectItem value="DEBIT">Cartão de Débito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="batchNotes">Observações</Label>
              <Input
                id="batchNotes"
                value={batchReceiveForm.notes}
                onChange={(e) => setBatchReceiveForm({ ...batchReceiveForm, notes: e.target.value })}
                placeholder="Ex: Pagamento realizado na loja"
              />
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowBatchReceiveDialog(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <ArrowDownToLine className="h-4 w-4 mr-2" />
                Receber R$ {getSelectedTotal().toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
