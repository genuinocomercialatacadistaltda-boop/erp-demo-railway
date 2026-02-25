
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Home,
  Plus,
  Wallet,
  Eye,
  Edit,
  Trash2,
  DollarSign,
  Building2,
  Smartphone,
  AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";

interface BankAccount {
  id: string;
  name: string;
  accountType: string;
  bankName?: string;
  balance: number;
  isActive: boolean;
  color?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: string;
  createdAt: string;
  balanceAfter: number;
}

export default function FinanceiroPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [showStatementDialog, setShowStatementDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    accountType: "CASH",
    bankName: "",
    balance: "",
    color: "#3b82f6",
    notes: "",
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
      return;
    }

    if (status === "authenticated" && (session?.user as any)?.userType !== "CUSTOMER") {
      toast.error("Acesso negado");
      router.push("/");
      return;
    }

    if (status === "authenticated") {
      loadAccounts();
    }
  }, [status, session, router]);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/client-management/bank-accounts");
      
      if (!response.ok) {
        throw new Error("Erro ao carregar contas");
      }

      const data = await response.json();
      setAccounts(data.data || []);
    } catch (error) {
      console.error("[LOAD_ACCOUNTS_ERROR]", error);
      toast.error("Erro ao carregar contas bancárias");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (account?: BankAccount) => {
    if (account) {
      setEditingAccount(account);
      setFormData({
        name: account.name,
        accountType: account.accountType,
        bankName: account.bankName || "",
        balance: account.balance.toString(),
        color: account.color || "#3b82f6",
        notes: account.notes || "",
      });
    } else {
      setEditingAccount(null);
      setFormData({
        name: "",
        accountType: "CASH",
        bankName: "",
        balance: "0",
        color: "#3b82f6",
        notes: "",
      });
    }
    setShowAccountDialog(true);
  };

  const handleCloseDialog = () => {
    setShowAccountDialog(false);
    setEditingAccount(null);
    setFormData({
      name: "",
      accountType: "CASH",
      bankName: "",
      balance: "0",
      color: "#3b82f6",
      notes: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Nome da conta é obrigatório");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        name: formData.name.trim(),
        accountType: formData.accountType,
        bankName: formData.bankName.trim() || null,
        balance: parseFloat(formData.balance) || 0,
        color: formData.color || null,
        notes: formData.notes.trim() || null,
        isActive: true,
      };

      const url = editingAccount
        ? `/api/client-management/bank-accounts/${editingAccount.id}`
        : "/api/client-management/bank-accounts";

      const method = editingAccount ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Erro ao salvar conta");
      }

      toast.success(
        editingAccount
          ? "Conta atualizada com sucesso!"
          : "Conta criada com sucesso!"
      );

      handleCloseDialog();
      loadAccounts();
    } catch (error) {
      console.error("[SAVE_ACCOUNT_ERROR]", error);
      toast.error("Erro ao salvar conta");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta conta? Esta ação não pode ser desfeita.")) {
      return;
    }

    try {
      const response = await fetch(`/api/client-management/bank-accounts/${accountId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Erro ao excluir conta");
      }

      toast.success("Conta excluída com sucesso!");
      loadAccounts();
    } catch (error) {
      console.error("[DELETE_ACCOUNT_ERROR]", error);
      toast.error("Erro ao excluir conta");
    }
  };

  const handleViewStatement = async (account: BankAccount) => {
    setSelectedAccount(account);
    setShowStatementDialog(true);
    setLoadingTransactions(true);

    try {
      // Buscar transações da conta
      const response = await fetch(`/api/client-management/bank-accounts/${account.id}/transactions`);
      
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.data || []);
      } else {
        setTransactions([]);
      }
    } catch (error) {
      console.error("[LOAD_TRANSACTIONS_ERROR]", error);
      setTransactions([]);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getAccountTypeIcon = (type: string) => {
    switch (type) {
      case "CASH":
        return <DollarSign className="h-5 w-5" />;
      case "BANK":
        return <Building2 className="h-5 w-5" />;
      case "DIGITAL_WALLET":
        return <Smartphone className="h-5 w-5" />;
      default:
        return <Wallet className="h-5 w-5" />;
    }
  };

  const getAccountTypeName = (type: string) => {
    switch (type) {
      case "CASH":
        return "Dinheiro";
      case "BANK":
        return "Banco";
      case "DIGITAL_WALLET":
        return "Carteira Digital";
      default:
        return type;
    }
  };

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-slate-600">Carregando contas bancárias...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Wallet className="h-8 w-8 text-green-600" />
              Contas Bancárias
            </h1>
            <p className="text-slate-600 mt-1">
              Gerencie suas contas e acompanhe seus saldos
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => router.push("/customer/gestao")}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <Button
              onClick={() => router.push("/dashboard")}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Home className="h-4 w-4" />
              Início
            </Button>
          </div>
        </div>

        {/* Card de Saldo Total */}
        <Card className="bg-gradient-to-r from-green-500 to-green-600 border-none shadow-lg">
          <CardHeader>
            <CardTitle className="text-white text-2xl">Saldo Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-white">
              {formatCurrency(totalBalance)}
            </p>
            <p className="text-green-100 mt-2">
              {accounts.length} {accounts.length === 1 ? "conta" : "contas"} ativa{accounts.length !== 1 && "s"}
            </p>
          </CardContent>
        </Card>

        {/* Botão Adicionar Conta */}
        <div className="flex justify-end">
          <Button
            onClick={() => handleOpenDialog()}
            className="bg-green-600 hover:bg-green-700 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Nova Conta
          </Button>
        </div>

        {/* Lista de Contas */}
        {accounts.length === 0 ? (
          <Card className="p-12 bg-white border-2 border-slate-200 text-center">
            <Wallet className="h-16 w-16 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600 text-lg">
              Nenhuma conta cadastrada ainda
            </p>
            <p className="text-slate-500 text-sm mt-2">
              Clique em "Nova Conta" para começar
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((account) => (
              <Card
                key={account.id}
                className="bg-white border-2 hover:shadow-lg transition-shadow"
                style={{ borderColor: account.color || "#3b82f6" }}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="p-2 rounded-lg"
                        style={{ backgroundColor: `${account.color || "#3b82f6"}20` }}
                      >
                        {getAccountTypeIcon(account.accountType)}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{account.name}</CardTitle>
                        <Badge variant="outline" className="mt-1">
                          {getAccountTypeName(account.accountType)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {account.bankName && (
                    <div className="text-sm text-slate-600">
                      <span className="font-medium">Banco:</span> {account.bankName}
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-200">
                    <p className="text-sm text-slate-600">Saldo</p>
                    <p
                      className="text-2xl font-bold"
                      style={{ color: account.balance >= 0 ? "#10b981" : "#ef4444" }}
                    >
                      {formatCurrency(account.balance)}
                    </p>
                  </div>

                  {account.notes && (
                    <div className="text-sm text-slate-500 italic">
                      {account.notes}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => handleViewStatement(account)}
                      variant="outline"
                      size="sm"
                      className="flex-1 flex items-center gap-2"
                    >
                      <Eye className="h-3 w-3" />
                      Extrato
                    </Button>
                    <Button
                      onClick={() => handleOpenDialog(account)}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Edit className="h-3 w-3" />
                      Editar
                    </Button>
                    <Button
                      onClick={() => handleDeleteAccount(account.id)}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:border-red-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modal Criar/Editar Conta */}
      {showAccountDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg bg-white max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>
                {editingAccount ? "Editar Conta" : "Nova Conta"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Nome da Conta *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Ex: Caixa Principal, Banco Itaú, PicPay"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Tipo de Conta *
                  </label>
                  <select
                    value={formData.accountType}
                    onChange={(e) =>
                      setFormData({ ...formData, accountType: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="CASH">Dinheiro / Caixa</option>
                    <option value="BANK">Conta Bancária</option>
                    <option value="DIGITAL_WALLET">Carteira Digital (PIX, PicPay, etc)</option>
                  </select>
                </div>

                {formData.accountType === "BANK" && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Nome do Banco
                    </label>
                    <input
                      type="text"
                      value={formData.bankName}
                      onChange={(e) =>
                        setFormData({ ...formData, bankName: e.target.value })
                      }
                      placeholder="Ex: Itaú, Bradesco, Santander"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    {editingAccount ? "Saldo Atual" : "Saldo Inicial"}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.balance}
                    onChange={(e) =>
                      setFormData({ ...formData, balance: e.target.value })
                    }
                    placeholder="0,00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Cor de Identificação
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) =>
                        setFormData({ ...formData, color: e.target.value })
                      }
                      className="h-10 w-20 rounded border border-slate-300 cursor-pointer"
                    />
                    <span className="text-sm text-slate-600">
                      {formData.color}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Observações
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    placeholder="Notas ou observações sobre esta conta"
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    onClick={handleCloseDialog}
                    variant="outline"
                    className="flex-1"
                    disabled={saving}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    disabled={saving}
                  >
                    {saving
                      ? "Salvando..."
                      : editingAccount
                      ? "Atualizar"
                      : "Criar Conta"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Ver Extrato */}
      {showStatementDialog && selectedAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Extrato - {selectedAccount.name}</CardTitle>
                  <p className="text-sm text-slate-600 mt-1">
                    Saldo atual: <span className="font-bold text-green-600">{formatCurrency(selectedAccount.balance)}</span>
                  </p>
                </div>
                <Button
                  onClick={() => {
                    setShowStatementDialog(false);
                    setSelectedAccount(null);
                    setTransactions([]);
                  }}
                  variant="outline"
                  size="sm"
                >
                  Fechar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingTransactions ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mb-2"></div>
                  <p className="text-slate-600">Carregando transações...</p>
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                  <p className="text-slate-600">Nenhuma transação registrada ainda</p>
                  <p className="text-slate-500 text-sm mt-1">
                    As transações aparecerão aqui quando você registrar vendas ou despesas
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {transactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-slate-900">
                            {transaction.description}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {formatDate(transaction.createdAt)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p
                            className={`font-bold ${
                              transaction.type === "INCOME"
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {transaction.type === "INCOME" ? "+" : "-"}
                            {formatCurrency(Math.abs(transaction.amount))}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            Saldo: {formatCurrency(transaction.balanceAfter)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
