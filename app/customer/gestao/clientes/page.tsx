
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Plus, 
  Users, 
  ArrowLeft, 
  Edit, 
  Trash2, 
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  Star,
  Gift
} from "lucide-react";
import toast from "react-hot-toast";

interface FinalCustomer {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  document?: string | null;
  creditLimit: number;
  currentDebt: number;
  pointsBalance: number;
  totalPointsEarned: number;
  pointsMultiplier: number;
  isActive: boolean;
  notes?: string | null;
  totalDebt: number;
  unpaidSalesCount: number;
  oldestDebtDate?: string | null;
  daysOverdue: number;
  isOverdue: boolean;
  unpaidSales: Array<{
    id: string;
    total: number;
    createdAt: string;
    saleNumber: string;
  }>;
}

interface BankAccount {
  id: string;
  name: string;
  balance: number;
}

export default function ClientesPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<FinalCustomer[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<FinalCustomer | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<FinalCustomer | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [document, setDocument] = useState("");
  const [creditLimit, setCreditLimit] = useState(0);
  const [notes, setNotes] = useState("");

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
      loadData();
    }
  }, [status]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [customersRes, accountsRes] = await Promise.all([
        fetch("/api/client-management/final-customers"),
        fetch("/api/client-management/bank-accounts"),
      ]);

      const customersData = await customersRes.json();
      const accountsData = await accountsRes.json();

      if (customersData.success) {
        setCustomers(customersData.data);
      }

      if (accountsData.success) {
        setBankAccounts(accountsData.data);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName("");
    setPhone("");
    setEmail("");
    setAddress("");
    setDocument("");
    setCreditLimit(0);
    setNotes("");
    setEditingCustomer(null);
  };

  const handleOpenDialog = (customer?: FinalCustomer) => {
    if (customer) {
      setEditingCustomer(customer);
      setName(customer.name);
      setPhone(customer.phone || "");
      setEmail(customer.email || "");
      setAddress(customer.address || "");
      setDocument(customer.document || "");
      setCreditLimit(customer.creditLimit);
      setNotes(customer.notes || "");
    } else {
      resetForm();
    }
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        document: document.trim() || null,
        creditLimit,
        notes: notes.trim() || null,
      };

      const url = editingCustomer
        ? `/api/client-management/final-customers/${editingCustomer.id}`
        : "/api/client-management/final-customers";
      
      const method = editingCustomer ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(
          editingCustomer ? "Cliente atualizado!" : "Cliente cadastrado!"
        );
        setShowDialog(false);
        resetForm();
        loadData();
      } else {
        toast.error(data.error || "Erro ao salvar cliente");
      }
    } catch (error) {
      console.error("Error saving customer:", error);
      toast.error("Erro ao salvar cliente");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (customerId: string) => {
    if (!confirm("Tem certeza que deseja excluir este cliente?")) {
      return;
    }

    try {
      const res = await fetch(
        `/api/client-management/final-customers/${customerId}`,
        { method: "DELETE" }
      );

      const data = await res.json();

      if (data.success) {
        toast.success("Cliente excluído!");
        loadData();
      } else {
        toast.error(data.error || "Erro ao excluir cliente");
      }
    } catch (error) {
      console.error("Error deleting customer:", error);
      toast.error("Erro ao excluir cliente");
    }
  };

  const handleReceivePayment = async (saleId: string, bankAccountId: string) => {
    if (!confirm("Confirmar recebimento deste pagamento?")) {
      return;
    }

    try {
      const res = await fetch(
        `/api/client-management/final-customers/${selectedCustomer?.id}/receive-payment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            saleId,
            bankAccountId,
            paymentMethod: "CASH",
          }),
        }
      );

      const data = await res.json();

      if (data.success) {
        toast.success("Pagamento recebido!");
        setShowDetailsDialog(false);
        loadData();
      } else {
        toast.error(data.error || "Erro ao receber pagamento");
      }
    } catch (error) {
      console.error("Error receiving payment:", error);
      toast.error("Erro ao receber pagamento");
    }
  };

  const handleViewDetails = (customer: FinalCustomer) => {
    setSelectedCustomer(customer);
    setShowDetailsDialog(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("pt-BR");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  const totalDebt = customers.reduce((sum, c) => sum + c.totalDebt, 0);
  const overdueCustomers = customers.filter((c) => c.isOverdue).length;
  const activeCustomers = customers.filter((c) => c.isActive && c.name !== "Consumidor Final").length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/customer/gestao")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                Gestão de Clientes
              </h1>
              <p className="text-gray-600">Controle de fiado e contas a receber</p>
            </div>
          </div>
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingCustomer ? "Editar Cliente" : "Novo Cliente"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Nome *</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nome do cliente"
                    />
                  </div>
                  <div>
                    <Label>Telefone</Label>
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@exemplo.com"
                    />
                  </div>
                  <div>
                    <Label>CPF</Label>
                    <Input
                      value={document}
                      onChange={(e) => setDocument(e.target.value)}
                      placeholder="000.000.000-00"
                    />
                  </div>
                </div>
                <div>
                  <Label>Endereço</Label>
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Rua, número, bairro"
                  />
                </div>
                <div>
                  <Label>Limite de Crédito (R$)</Label>
                  <Input
                    type="number"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <Label>Observações</Label>
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notas sobre o cliente"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? "Salvando..." : "Salvar Cliente"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total a Receber
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(totalDebt)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Clientes Ativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{activeCustomers}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Clientes em Atraso
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{overdueCustomers}</p>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Lista de Clientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Débito Total</TableHead>
                    <TableHead>Vendas Abertas</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">
                        {customer.name}
                        {customer.name === "Consumidor Final" && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Padrão
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{customer.phone || "-"}</TableCell>
                      <TableCell>
                        {customer.totalDebt > 0 ? (
                          <span className="font-semibold text-orange-600">
                            {formatCurrency(customer.totalDebt)}
                          </span>
                        ) : (
                          <span className="text-gray-500">R$ 0,00</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {customer.unpaidSalesCount > 0 ? (
                          <Badge variant="secondary">
                            {customer.unpaidSalesCount}
                          </Badge>
                        ) : (
                          <span className="text-gray-500">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {customer.isOverdue ? (
                          <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                            <AlertTriangle className="h-3 w-3" />
                            {customer.daysOverdue} dias
                          </Badge>
                        ) : customer.totalDebt > 0 ? (
                          <Badge variant="outline" className="flex items-center gap-1 w-fit">
                            <Clock className="h-3 w-3" />
                            Em dia
                          </Badge>
                        ) : (
                          <Badge variant="default" className="flex items-center gap-1 w-fit bg-green-100 text-green-700">
                            <CheckCircle className="h-3 w-3" />
                            Sem débitos
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          {customer.unpaidSalesCount > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDetails(customer)}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              Ver
                            </Button>
                          )}
                          {customer.name !== "Consumidor Final" && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenDialog(customer)}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDelete(customer.id)}
                                disabled={customer.totalDebt > 0}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Details Dialog */}
        <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                Contas a Receber - {selectedCustomer?.name}
              </DialogTitle>
            </DialogHeader>
            {selectedCustomer && (
              <div className="space-y-4 pt-4">
                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-gray-600">Total em Aberto</p>
                      <p className="text-2xl font-bold text-orange-600">
                        {formatCurrency(selectedCustomer.totalDebt)}
                      </p>
                    </div>
                    {selectedCustomer.isOverdue && (
                      <Badge variant="destructive" className="text-lg py-2 px-4">
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        {selectedCustomer.daysOverdue} dias em atraso
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold">Vendas Não Pagas</h3>
                  {selectedCustomer.unpaidSales.map((sale) => (
                    <div
                      key={sale.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                    >
                      <div>
                        <p className="font-medium">{sale.saleNumber}</p>
                        <p className="text-sm text-gray-600">
                          {formatDate(sale.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-lg font-bold text-orange-600">
                          {formatCurrency(sale.total)}
                        </p>
                        {bankAccounts.length > 0 && (
                          <Button
                            size="sm"
                            onClick={() =>
                              handleReceivePayment(sale.id, bankAccounts[0].id)
                            }
                          >
                            <DollarSign className="h-3 w-3 mr-1" />
                            Receber
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
