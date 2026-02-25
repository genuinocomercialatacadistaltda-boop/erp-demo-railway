
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Trash2, Search, FileText, AlertCircle, RefreshCw, DollarSign, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BankAccount {
  id: string;
  name: string;
  balance: number;
}

interface Boleto {
  id: string;
  boletoNumber: string;
  amount: number;
  dueDate: string;
  status: string;
  orderId: string | null;
  customerId: string;
  createdAt: string;
  paidDate: string | null;
  pixPaymentId: string | null;
  Customer: {
    name: string;
    email: string;
  };
  Order?: {
    id: string;
    total: number;
  };
}

const statusTranslations: Record<string, string> = {
  PENDING: "Pendente",
  PAID: "Pago",
  OVERDUE: "Vencido",
  CANCELLED: "Cancelado",
};

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-500",
  PAID: "bg-green-500",
  OVERDUE: "bg-red-500",
  CANCELLED: "bg-gray-500",
};

// 🔧 CORREÇÃO: Helper para parse seguro de datas (evita problemas de timezone)
const parseDateSafe = (dateString: string): Date => {
  const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
};

export default function BoletosManagement() {
  const [boletos, setBoletos] = useState<Boleto[]>([]);
  const [filteredBoletos, setFilteredBoletos] = useState<Boleto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [boletoToDelete, setBoletoToDelete] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState<string | null>(null);
  
  // Estados para modal de recebimento
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [boletoToReceive, setBoletoToReceive] = useState<Boleto | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankAccount, setSelectedBankAccount] = useState<string>("");
  const [interestAmount, setInterestAmount] = useState<string>("0");
  const [fineAmount, setFineAmount] = useState<string>("0");
  const [paymentDate, setPaymentDate] = useState<string>("");
  const [receivingBoleto, setReceivingBoleto] = useState(false);

  useEffect(() => {
    fetchBoletos();
    fetchBankAccounts();
  }, []);

  useEffect(() => {
    filterBoletos();
  }, [boletos, searchTerm, statusFilter]);

  const fetchBoletos = async () => {
    try {
      const response = await fetch("/api/admin/boletos");
      if (!response.ok) throw new Error("Erro ao buscar boletos");
      const data = await response.json();
      setBoletos(data);
    } catch (error) {
      toast.error("Erro ao carregar boletos");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBankAccounts = async () => {
    try {
      const response = await fetch("/api/financial/bank-accounts");
      if (!response.ok) throw new Error("Erro ao buscar contas bancárias");
      const data = await response.json();
      setBankAccounts(data.filter((acc: BankAccount) => acc.id));
    } catch (error) {
      console.error("Erro ao carregar contas bancárias:", error);
    }
  };

  const openReceiveDialog = (boleto: Boleto) => {
    setBoletoToReceive(boleto);
    setSelectedBankAccount("");
    setInterestAmount("0");
    setFineAmount("0");
    // Definir data de pagamento como hoje
    const today = new Date();
    setPaymentDate(format(today, "yyyy-MM-dd"));
    setReceiveDialogOpen(true);
  };

  const handleReceiveBoleto = async () => {
    if (!boletoToReceive || !selectedBankAccount) {
      toast.error("Selecione uma conta bancária");
      return;
    }

    setReceivingBoleto(true);
    try {
      const response = await fetch(`/api/boletos/${boletoToReceive.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "pay",
          bankAccountId: selectedBankAccount,
          interestAmount: parseFloat(interestAmount) || 0,
          fineAmount: parseFloat(fineAmount) || 0,
          paymentDate: paymentDate || undefined
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao dar entrada no boleto");
      }

      const totalReceived = boletoToReceive.amount + (parseFloat(interestAmount) || 0) + (parseFloat(fineAmount) || 0);
      const accountName = bankAccounts.find(a => a.id === selectedBankAccount)?.name || "";
      
      toast.success("Boleto recebido com sucesso!", {
        description: `R$ ${totalReceived.toFixed(2)} creditado na conta ${accountName}`
      });
      
      fetchBoletos();
      setReceiveDialogOpen(false);
      setBoletoToReceive(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao dar entrada no boleto");
      console.error(error);
    } finally {
      setReceivingBoleto(false);
    }
  };

  const filterBoletos = () => {
    let filtered = [...boletos];

    // Filtro por texto
    if (searchTerm) {
      filtered = filtered.filter(
        (b) =>
          b.Customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          b.Customer?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          b.boletoNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          b.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtro por status
    if (statusFilter !== "all") {
      if (statusFilter === "orphan") {
        filtered = filtered.filter((b) => !b.orderId);
      } else {
        filtered = filtered.filter((b) => b.status === statusFilter);
      }
    }

    setFilteredBoletos(filtered);
  };

  const handleCheckStatus = async (boletoId: string) => {
    setCheckingStatus(boletoId);
    try {
      const response = await fetch(`/api/admin/boletos/${boletoId}/check-status`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao verificar status");
      }

      if (data.wasUpdated) {
        toast.success(data.message, {
          description: `Cliente: ${data.boleto.customerName} | Valor: R$ ${data.boleto.amount.toFixed(2)}`
        });
        // Recarregar lista de boletos
        fetchBoletos();
      } else {
        toast.info(data.message);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao verificar status");
      console.error(error);
    } finally {
      setCheckingStatus(null);
    }
  };

  const handleDeleteBoleto = async () => {
    if (!boletoToDelete) return;

    try {
      const response = await fetch(`/api/admin/boletos/${boletoToDelete}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Erro ao deletar boleto");

      toast.success("Boleto deletado com sucesso!");
      fetchBoletos();
    } catch (error) {
      toast.error("Erro ao deletar boleto");
      console.error(error);
    } finally {
      setDeleteDialogOpen(false);
      setBoletoToDelete(null);
    }
  };

  const orphanCount = boletos.filter((b) => !b.orderId).length;
  const overdueCount = boletos.filter((b) => b.status === 'OVERDUE').length;
  const pendingCount = boletos.filter((b) => b.status === 'PENDING').length;
  const paidCount = boletos.filter((b) => b.status === 'PAID').length;

  if (loading) {
    return <div className="flex items-center justify-center h-64">
      <div className="text-lg">Carregando boletos...</div>
    </div>;
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{boletos.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pagos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{paidCount}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vencidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{overdueCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gestão de Boletos</CardTitle>
          <CardDescription>
            Gerencie todos os boletos do sistema e verifique status de pagamento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Pesquisar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cliente, email ou número..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="PENDING">Pendentes</SelectItem>
                  <SelectItem value="PAID">Pagos</SelectItem>
                  <SelectItem value="OVERDUE">Vencidos</SelectItem>
                  <SelectItem value="CANCELLED">Cancelados</SelectItem>
                  <SelectItem value="orphan">🚨 Órfãos (sem pedido)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Ações</Label>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                }}
              >
                Limpar Filtros
              </Button>
            </div>
          </div>

          {/* Alertas */}
          {overdueCount > 0 && (
            <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              <p className="text-sm text-red-800 dark:text-red-200">
                <strong>{overdueCount} boleto(s) vencido(s)</strong> - necessitam atenção
              </p>
            </div>
          )}
          
          {orphanCount > 0 && (
            <div className="flex items-center gap-2 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>{orphanCount} boleto(s) órfão(s)</strong> - sem pedido associado
              </p>
            </div>
          )}

          {/* Tabela */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº Boleto</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBoletos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum boleto encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBoletos.map((boleto) => (
                    <TableRow key={boleto.id}>
                      <TableCell className="font-mono text-sm">
                        {boleto.boletoNumber}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{boleto.Customer?.name || 'N/A'}</p>
                          <p className="text-sm text-muted-foreground">
                            {boleto.Customer?.email || 'Sem email'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">
                        R$ {Number(boleto.amount).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {format(parseDateSafe(boleto.dueDate), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`${statusColors[boleto.status]} text-white`}
                        >
                          {statusTranslations[boleto.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {boleto.orderId ? (
                          <div className="flex items-center gap-1 text-sm">
                            <FileText className="h-3 w-3" />
                            <span className="font-mono">
                              {boleto.orderId.slice(0, 8)}...
                            </span>
                          </div>
                        ) : (
                          <Badge variant="destructive">Órfão</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Botão Dar Entrada - para boletos pendentes ou vencidos */}
                          {(boleto.status === 'PENDING' || boleto.status === 'OVERDUE') && (
                            <Button
                              variant="default"
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => openReceiveDialog(boleto)}
                            >
                              <DollarSign className="h-4 w-4 mr-1" />
                              Dar Entrada
                            </Button>
                          )}
                          {boleto.pixPaymentId && boleto.status !== 'PAID' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCheckStatus(boleto.id)}
                              disabled={checkingStatus === boleto.id}
                            >
                              {checkingStatus === boleto.id ? (
                                <>
                                  <RefreshCw className="h-4 w-4 animate-spin mr-1" />
                                  Verificando...
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="h-4 w-4 mr-1" />
                                  Verificar Status
                                </>
                              )}
                            </Button>
                          )}
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setBoletoToDelete(boleto.id);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de confirmação */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar este boleto? Esta ação não pode ser desfeita.
              {boletoToDelete && boletos.find((b) => b.id === boletoToDelete)?.orderId && (
                <p className="mt-2 font-semibold text-amber-600">
                  ⚠️ Este boleto está associado a um pedido. Deletar pode afetar o crédito do cliente.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBoleto}
              className="bg-red-600 hover:bg-red-700"
            >
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Recebimento de Boleto */}
      <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Dar Entrada no Boleto
            </DialogTitle>
          </DialogHeader>
          
          {boletoToReceive && (
            <div className="space-y-4">
              {/* Informações do Boleto */}
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Boleto:</span>
                  <span className="font-mono font-semibold">{boletoToReceive.boletoNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Cliente:</span>
                  <span className="font-semibold">{boletoToReceive.Customer?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Valor Original:</span>
                  <span className="font-bold text-lg">R$ {boletoToReceive.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Vencimento:</span>
                  <span>{format(parseDateSafe(boletoToReceive.dueDate), "dd/MM/yyyy", { locale: ptBR })}</span>
                </div>
              </div>

              {/* Formulário */}
              <div className="space-y-4">
                {/* Conta Bancária (obrigatório) */}
                <div className="space-y-2">
                  <Label htmlFor="bankAccount" className="flex items-center gap-1">
                    Conta Bancária <span className="text-red-500">*</span>
                  </Label>
                  <Select value={selectedBankAccount} onValueChange={setSelectedBankAccount}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a conta bancária" />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name} (Saldo: R$ {account.balance.toFixed(2)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Data de Pagamento */}
                <div className="space-y-2">
                  <Label htmlFor="paymentDate">Data do Recebimento</Label>
                  <Input
                    id="paymentDate"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </div>

                {/* Juros e Multa */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="interestAmount">Juros (R$)</Label>
                    <Input
                      id="interestAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={interestAmount}
                      onChange={(e) => setInterestAmount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fineAmount">Multa (R$)</Label>
                    <Input
                      id="fineAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={fineAmount}
                      onChange={(e) => setFineAmount(e.target.value)}
                    />
                  </div>
                </div>

                {/* Total a Receber */}
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Total a Receber:</span>
                    <span className="text-2xl font-bold text-green-600">
                      R$ {(
                        boletoToReceive.amount + 
                        (parseFloat(interestAmount) || 0) + 
                        (parseFloat(fineAmount) || 0)
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleReceiveBoleto}
              disabled={receivingBoleto || !selectedBankAccount}
              className="bg-green-600 hover:bg-green-700"
            >
              {receivingBoleto ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <DollarSign className="h-4 w-4 mr-2" />
                  Confirmar Recebimento
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
