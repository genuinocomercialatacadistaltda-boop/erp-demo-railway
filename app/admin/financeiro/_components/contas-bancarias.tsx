"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Landmark, Trash2, CheckCircle, XCircle, History, ArrowRightLeft } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ImportCsvDialog } from "./import-csv-dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BankAccount {
  id: string;
  name: string;
  accountType: string;
  bankName?: string;
  accountNumber?: string;
  agency?: string;
  balance: number;
  isActive: boolean;
  description?: string;
  color?: string;
  _count?: {
    Transaction: number;
    Expense: number;
  };
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  date: string;
  createdAt: string;
  balanceAfter: number;
  category?: string;
  notes?: string;
  referenceType?: string;
  referenceId?: string;
}

export default function ContasBancarias() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [showTransactionsDialog, setShowTransactionsDialog] = useState(false);
  const [selectedAccountTransactions, setSelectedAccountTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [selectedAccountName, setSelectedAccountName] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    accountType: "CHECKING",
    bankName: "",
    accountNumber: "",
    agency: "",
    balance: 0,
    description: "",
    color: "#3B82F6"
  });

  // Estados para transferência entre contas
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferData, setTransferData] = useState({
    fromAccountId: "",
    toAccountId: "",
    amount: "",
    description: ""
  });

  const fetchAccounts = async () => {
    try {
      const res = await fetch("/api/financial/bank-accounts");
      if (!res.ok) throw new Error("Erro ao carregar contas");
      const data = await res.json();
      setAccounts(data.accounts);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  // Função para realizar transferência entre contas
  const handleTransfer = async () => {
    if (!transferData.fromAccountId || !transferData.toAccountId) {
      toast.error("Selecione as contas de origem e destino");
      return;
    }

    if (transferData.fromAccountId === transferData.toAccountId) {
      toast.error("As contas de origem e destino devem ser diferentes");
      return;
    }

    const amount = parseFloat(transferData.amount.replace(",", "."));
    if (!amount || amount <= 0) {
      toast.error("Digite um valor válido para a transferência");
      return;
    }

    setTransferLoading(true);

    try {
      const res = await fetch("/api/financial/bank-accounts/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromAccountId: transferData.fromAccountId,
          toAccountId: transferData.toAccountId,
          amount: amount,
          description: transferData.description
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao realizar transferência");
      }

      toast.success(data.message);
      setShowTransferDialog(false);
      setTransferData({ fromAccountId: "", toAccountId: "", amount: "", description: "" });
      fetchAccounts(); // Recarregar contas para atualizar saldos
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setTransferLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = editingAccount
        ? `/api/financial/bank-accounts/${editingAccount.id}`
        : "/api/financial/bank-accounts";
      
      const method = editingAccount ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao salvar conta");
      }

      toast.success(`Conta ${editingAccount ? "atualizada" : "criada"} com sucesso`);

      setShowDialog(false);
      setEditingAccount(null);
      resetForm();
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      accountType: "CHECKING",
      bankName: "",
      accountNumber: "",
      agency: "",
      balance: 0,
      description: "",
      color: "#3B82F6"
    });
  };

  const handleEdit = (account: BankAccount) => {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      accountType: account.accountType,
      bankName: account.bankName || "",
      accountNumber: account.accountNumber || "",
      agency: account.agency || "",
      balance: account.balance,
      description: account.description || "",
      color: account.color || "#3B82F6"
    });
    setShowDialog(true);
  };

  const toggleActive = async (accountId: string, isActive: boolean) => {
    try {
      const account = accounts.find(a => a.id === accountId);
      if (!account) return;

      const res = await fetch(`/api/financial/bank-accounts/${accountId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...account, isActive: !isActive })
      });

      if (!res.ok) throw new Error("Erro ao atualizar conta");

      toast.success("Conta atualizada");
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const viewTransactions = async (accountId: string, accountName: string) => {
    try {
      setLoadingTransactions(true);
      setSelectedAccountName(accountName);
      setShowTransactionsDialog(true);
      
      const res = await fetch(`/api/financial/transactions?bankAccountId=${accountId}&limit=50`);
      if (!res.ok) throw new Error("Erro ao carregar transações");
      
      const data = await res.json();
      setSelectedAccountTransactions(data.transactions || data || []);
    } catch (err: any) {
      toast.error(err.message || "Erro ao carregar transações");
      setSelectedAccountTransactions([]);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    // Confirmar exclusão
    if (!confirm("Tem certeza que deseja excluir esta transação? O saldo da conta será automaticamente ajustado.")) {
      return;
    }

    try {
      console.log(`[DELETE] Excluindo transação ${transactionId}...`);
      
      const res = await fetch(`/api/financial/transactions/${transactionId}`, {
        method: "DELETE"
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.details || error.error || "Erro ao excluir transação");
      }

      const result = await res.json();
      
      console.log(`✅ [DELETE] Transação excluída com sucesso!`);
      console.log(`   - Saldo Antigo: R$ ${result.oldBalance.toFixed(2)}`);
      console.log(`   - Valor Revertido: R$ ${result.amountReverted.toFixed(2)}`);
      console.log(`   - Novo Saldo: R$ ${result.newBalance.toFixed(2)}`);

      toast.success("Transação excluída com sucesso! O saldo da conta foi ajustado.");

      // Atualizar lista de transações
      setSelectedAccountTransactions(prev => prev.filter(t => t.id !== transactionId));
      
      // Recarregar contas para atualizar saldos
      fetchAccounts();
    } catch (err: any) {
      console.error("[DELETE ERROR]", err);
      toast.error(err.message || "Erro ao excluir transação");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Landmark className="h-6 w-6 text-blue-600" />
          Contas Bancárias
        </h2>
        <div className="flex items-center gap-2">
          <ImportCsvDialog 
            bankAccounts={accounts.map(a => ({ id: a.id, name: a.name }))} 
            onSuccess={fetchAccounts}
          />
          
          {/* Botão de Transferência */}
          <Button 
            variant="outline" 
            className="border-green-500 text-green-600 hover:bg-green-50"
            onClick={() => setShowTransferDialog(true)}
          >
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            Transferir
          </Button>

          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Conta
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingAccount ? "Editar Conta" : "Nova Conta Bancária"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Nome da Conta *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Itaú, Mercado Pago"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="accountType">Tipo *</Label>
                  <select
                    id="accountType"
                    value={formData.accountType}
                    onChange={(e) => setFormData({ ...formData, accountType: e.target.value })}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background"
                    required
                  >
                    <option value="CHECKING">Conta Corrente</option>
                    <option value="SAVINGS">Poupança</option>
                    <option value="CASH">Caixa/Dinheiro</option>
                    <option value="DIGITAL_WALLET">Carteira Digital</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="bankName">Banco</Label>
                  <Input
                    id="bankName"
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    placeholder="Nome do banco"
                  />
                </div>
                <div>
                  <Label htmlFor="agency">Agência</Label>
                  <Input
                    id="agency"
                    value={formData.agency}
                    onChange={(e) => setFormData({ ...formData, agency: e.target.value })}
                    placeholder="0000"
                  />
                </div>
                <div>
                  <Label htmlFor="accountNumber">Número da Conta</Label>
                  <Input
                    id="accountNumber"
                    value={formData.accountNumber}
                    onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                    placeholder="00000-0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="balance">Saldo Inicial *</Label>
                  <Input
                    id="balance"
                    type="number"
                    step="0.01"
                    value={formData.balance}
                    onChange={(e) => setFormData({ ...formData, balance: parseFloat(e.target.value) })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="color">Cor de Identificação</Label>
                  <Input
                    id="color"
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Descrição</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Informações adicionais"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingAccount ? "Atualizar" : "Criar Conta"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((account) => (
          <Card key={account.id} className={!account.isActive ? "opacity-60" : ""}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: account.color || "#3B82F6" }}
                />
                {account.name}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => handleEdit(account)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Switch
                  checked={account.isActive}
                  onCheckedChange={() => toggleActive(account.id, account.isActive)}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-2xl font-bold">
                  R$ {account.balance.toFixed(2)}
                </div>
                <div className="text-sm text-gray-500 space-y-1">
                  <p>Tipo: {account.accountType}</p>
                  {account.bankName && <p>Banco: {account.bankName}</p>}
                  {account.accountNumber && (
                    <p>
                      Conta: {account.agency || "–"} / {account.accountNumber}
                    </p>
                  )}
                  {account._count && (
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-gray-400">
                        {account._count.Transaction} transações • {account._count.Expense} despesas
                      </p>
                      <Button
                        variant="link"
                        size="sm"
                        className="text-xs h-auto p-0"
                        onClick={() => viewTransactions(account.id, account.name)}
                      >
                        <History className="h-3 w-3 mr-1" />
                        Ver histórico
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {accounts.length === 0 && (
        <Alert>
          <AlertDescription>
            Nenhuma conta bancária cadastrada. Clique em "Nova Conta" para começar.
          </AlertDescription>
        </Alert>
      )}

      {/* Dialog de Histórico de Transações */}
      <Dialog open={showTransactionsDialog} onOpenChange={setShowTransactionsDialog}>
        <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Histórico de Transações - {selectedAccountName}</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {selectedAccountTransactions.length} transação(ões) encontrada(s)
            </p>
          </DialogHeader>
          
          {/* Container com scroll */}
          <div className="flex-1 overflow-y-auto pr-2 -mr-2" style={{ maxHeight: 'calc(85vh - 120px)' }}>
            {loadingTransactions ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : selectedAccountTransactions.length === 0 ? (
              <Alert>
                <AlertDescription>
                  Nenhuma transação encontrada para esta conta.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3 pb-4">
                {selectedAccountTransactions.map((transaction) => (
                  <Card key={transaction.id} className="p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`font-semibold text-lg ${transaction.type === 'EXPENSE' ? 'text-red-600' : 'text-green-600'}`}>
                            {transaction.type === 'EXPENSE' ? '- ' : '+ '}R$ {Math.abs(Number(transaction.amount)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                          {transaction.category && (
                            <Badge variant="outline" className="text-xs">
                              {transaction.category}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-900 font-medium mb-1">{transaction.description}</p>
                        {transaction.notes && (
                          <p className="text-xs text-gray-600 mt-1.5 bg-gray-50 p-2 rounded border border-gray-200">
                            <span className="font-medium">Observações:</span> {transaction.notes}
                          </p>
                        )}
                        
                        {/* Informação adicional sobre o tipo de referência */}
                        {transaction.referenceType && (
                          <p className="text-xs text-gray-500 mt-1.5">
                            Ref: {transaction.referenceType}
                            {transaction.referenceId && ` (${transaction.referenceId.substring(0, 8)}...)`}
                          </p>
                        )}
                      </div>
                      
                      <div className="text-right flex flex-col items-end gap-2 flex-shrink-0">
                        <div>
                          <p className="text-sm font-medium text-gray-700">
                            {format(new Date(transaction.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {format(new Date(transaction.createdAt), "HH:mm", { locale: ptBR })}
                          </p>
                          <p className="text-xs text-blue-600 font-medium mt-1.5">
                            Saldo: R$ {transaction.balanceAfter.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 px-3"
                          onClick={() => handleDeleteTransaction(transaction.id)}
                          title="Excluir transação"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Excluir
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Transferência entre Contas */}
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-green-600" />
              Transferir entre Contas
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            {/* Conta de Origem */}
            <div className="space-y-2">
              <Label>Conta de Origem *</Label>
              <Select
                value={transferData.fromAccountId}
                onValueChange={(value) => setTransferData({ ...transferData, fromAccountId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta de origem" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.filter(a => a.isActive).map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex items-center justify-between w-full gap-4">
                        <span>{account.name}</span>
                        <span className="text-sm text-gray-500">
                          R$ {Number(account.balance).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {transferData.fromAccountId && (
                <p className="text-sm text-gray-500">
                  Saldo disponível: R$ {
                    Number(accounts.find(a => a.id === transferData.fromAccountId)?.balance || 0)
                      .toLocaleString("pt-BR", { minimumFractionDigits: 2 })
                  }
                </p>
              )}
            </div>

            {/* Conta de Destino */}
            <div className="space-y-2">
              <Label>Conta de Destino *</Label>
              <Select
                value={transferData.toAccountId}
                onValueChange={(value) => setTransferData({ ...transferData, toAccountId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta de destino" />
                </SelectTrigger>
                <SelectContent>
                  {accounts
                    .filter(a => a.isActive && a.id !== transferData.fromAccountId)
                    .map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        <div className="flex items-center justify-between w-full gap-4">
                          <span>{account.name}</span>
                          <span className="text-sm text-gray-500">
                            R$ {Number(account.balance).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Valor */}
            <div className="space-y-2">
              <Label>Valor da Transferência *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                <Input
                  className="pl-10"
                  placeholder="0,00"
                  value={transferData.amount}
                  onChange={(e) => {
                    // Permitir apenas números e vírgula
                    const value = e.target.value.replace(/[^0-9,]/g, "");
                    setTransferData({ ...transferData, amount: value });
                  }}
                />
              </div>
            </div>

            {/* Descrição */}
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Input
                placeholder="Ex: Depósito no banco"
                value={transferData.description}
                onChange={(e) => setTransferData({ ...transferData, description: e.target.value })}
              />
            </div>

            {/* Botões */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowTransferDialog(false);
                  setTransferData({ fromAccountId: "", toAccountId: "", amount: "", description: "" });
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleTransfer}
                disabled={transferLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                {transferLoading ? "Transferindo..." : "Confirmar Transferência"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
