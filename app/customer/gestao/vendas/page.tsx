
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Home,
  ArrowLeft,
  Search,
  Printer,
  Edit,
  Trash2,
  DollarSign,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SaleItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  Product?: {
    id: string;
    name: string;
  };
}

interface Sale {
  id: string;
  saleNumber: string;
  totalAmount: number;
  discount: number;
  finalAmount: number;
  isPaid: boolean;
  paymentMethod: string | null;
  wasteQuantity: number | null;
  wasteNotes: string | null;
  createdAt: string;
  Items: SaleItem[];
}

export default function HistoricoVendasPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [sales, setSales] = useState<Sale[]>([]);
  const [filteredSales, setFilteredSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "paid" | "unpaid">("all");
  
  // Estados para visualização/edição
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({
    isPaid: false,
    paymentMethod: "",
    wasteQuantity: 0,
    wasteNotes: "",
  });

  // Carregar vendas
  useEffect(() => {
    if (status === "authenticated") {
      loadSales();
    }
  }, [status]);

  // Aplicar filtros
  useEffect(() => {
    let filtered = [...sales];

    // Filtro por busca
    if (searchTerm) {
      filtered = filtered.filter((sale) =>
        sale.saleNumber.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtro por status de pagamento
    if (filterStatus !== "all") {
      filtered = filtered.filter((sale) =>
        filterStatus === "paid" ? sale.isPaid : !sale.isPaid
      );
    }

    setFilteredSales(filtered);
  }, [sales, searchTerm, filterStatus]);

  const loadSales = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/client-management/sales");
      const data = await response.json();

      if (data.success) {
        setSales(data.data);
      } else {
        toast.error("Erro ao carregar vendas");
      }
    } catch (error) {
      console.error("Erro ao carregar vendas:", error);
      toast.error("Erro ao carregar vendas");
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (sale: Sale) => {
    setSelectedSale(sale);
    setShowDetailsDialog(true);
  };

  const handleEditSale = (sale: Sale) => {
    setSelectedSale(sale);
    setEditForm({
      isPaid: sale.isPaid,
      paymentMethod: sale.paymentMethod || "",
      wasteQuantity: sale.wasteQuantity || 0,
      wasteNotes: sale.wasteNotes || "",
    });
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedSale) return;

    try {
      const response = await fetch(
        `/api/client-management/sales/${selectedSale.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            totalAmount: selectedSale.totalAmount,
            discount: selectedSale.discount,
            finalAmount: selectedSale.finalAmount,
            isPaid: editForm.isPaid,
            paymentMethod: editForm.paymentMethod,
            wasteQuantity: editForm.wasteQuantity || null,
            wasteNotes: editForm.wasteNotes || null,
            items: selectedSale.Items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
            })),
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        toast.success("Venda atualizada com sucesso!");
        setShowEditDialog(false);
        loadSales();
      } else {
        toast.error(data.error || "Erro ao atualizar venda");
      }
    } catch (error) {
      console.error("Erro ao atualizar venda:", error);
      toast.error("Erro ao atualizar venda");
    }
  };

  const handleDeleteSale = async (saleId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta venda?")) {
      return;
    }

    try {
      const response = await fetch(`/api/client-management/sales/${saleId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Venda excluída com sucesso!");
        loadSales();
      } else {
        toast.error(data.error || "Erro ao excluir venda");
      }
    } catch (error) {
      console.error("Erro ao excluir venda:", error);
      toast.error("Erro ao excluir venda");
    }
  };

  const handlePrintSale = (saleId: string) => {
    window.open(`/customer/gestao/vendas/${saleId}/print`, "_blank");
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return "Data inválida";
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando vendas...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    router.push("/auth/login");
    return null;
  }

  // Estatísticas
  const totalSales = sales.length;
  const totalRevenue = sales.reduce((sum, sale) => sum + sale.finalAmount, 0);
  const paidSales = sales.filter((s) => s.isPaid).length;
  const unpaidSales = sales.filter((s) => !s.isPaid).length;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-6">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-red-700"
            onClick={() => router.push("/customer/gestao")}
          >
            <Home className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-red-700"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Histórico de Vendas</h1>
            <p className="text-red-100 text-sm">
              Gerencie todas as suas vendas realizadas
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total de Vendas</p>
                  <p className="text-xl font-bold">{totalSales}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Faturamento</p>
                  <p className="text-xl font-bold">{formatCurrency(totalRevenue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Pagas</p>
                  <p className="text-xl font-bold">{paidSales}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Não Pagas</p>
                  <p className="text-xl font-bold">{unpaidSales}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar por número da venda..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select
                value={filterStatus}
                onValueChange={(value: any) => setFilterStatus(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="paid">Pagas</SelectItem>
                  <SelectItem value="unpaid">Não Pagas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Vendas */}
        <Card>
          <CardHeader>
            <CardTitle>Vendas Realizadas</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredSales.length === 0 ? (
              <div className="text-center py-12">
                <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">
                  {sales.length === 0
                    ? "Nenhuma venda registrada ainda"
                    : "Nenhuma venda encontrada com os filtros aplicados"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Valor Total</TableHead>
                      <TableHead>Desconto</TableHead>
                      <TableHead>Valor Final</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="font-medium">
                          {sale.saleNumber}
                        </TableCell>
                        <TableCell>{formatDate(sale.createdAt)}</TableCell>
                        <TableCell>{formatCurrency(sale.totalAmount)}</TableCell>
                        <TableCell>{formatCurrency(sale.discount)}</TableCell>
                        <TableCell className="font-bold">
                          {formatCurrency(sale.finalAmount)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={sale.isPaid ? "default" : "destructive"}
                          >
                            {sale.isPaid ? "Pago" : "Não Pago"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {sale.paymentMethod || "Não informado"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleViewDetails(sale)}
                              title="Ver detalhes"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handlePrintSale(sale.id)}
                              title="Imprimir cupom"
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditSale(sale)}
                              title="Editar"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDeleteSale(sale.id)}
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de Detalhes */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Venda</DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-gray-600">Número</Label>
                  <p className="font-medium">{selectedSale.saleNumber}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">Data</Label>
                  <p className="font-medium">
                    {formatDate(selectedSale.createdAt)}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">Status</Label>
                  <Badge
                    variant={selectedSale.isPaid ? "default" : "destructive"}
                  >
                    {selectedSale.isPaid ? "Pago" : "Não Pago"}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">
                    Método de Pagamento
                  </Label>
                  <p className="font-medium">
                    {selectedSale.paymentMethod || "Não informado"}
                  </p>
                </div>
              </div>

              <div className="border-t pt-4">
                <Label className="text-sm font-semibold mb-2">
                  Itens da Venda
                </Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Qtd</TableHead>
                      <TableHead>Preço Unit.</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedSale.Items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          {item.Product?.name || "Produto Genérico"}
                        </TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>
                          {formatCurrency(item.unitPrice)}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(item.totalPrice)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">
                    {formatCurrency(selectedSale.totalAmount)}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Desconto</span>
                  <span className="font-medium text-red-600">
                    -{formatCurrency(selectedSale.discount)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-lg font-bold border-t pt-2">
                  <span>Total</span>
                  <span>{formatCurrency(selectedSale.finalAmount)}</span>
                </div>
              </div>

              {selectedSale.wasteQuantity && selectedSale.wasteQuantity > 0 && (
                <div className="border-t pt-4 bg-yellow-50 p-3 rounded-lg">
                  <Label className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    Desperdício Registrado
                  </Label>
                  <div className="text-sm space-y-1">
                    <p>
                      <strong>Quantidade:</strong> {selectedSale.wasteQuantity}
                    </p>
                    {selectedSale.wasteNotes && (
                      <p>
                        <strong>Motivo:</strong> {selectedSale.wasteNotes}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowDetailsDialog(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Edição */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Venda</DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-4">
              <div>
                <Label>Status de Pagamento</Label>
                <Select
                  value={editForm.isPaid.toString()}
                  onValueChange={(value) =>
                    setEditForm({ ...editForm, isPaid: value === "true" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false">Não Pago</SelectItem>
                    <SelectItem value="true">Pago</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Método de Pagamento</Label>
                <Select
                  value={editForm.paymentMethod}
                  onValueChange={(value) =>
                    setEditForm({ ...editForm, paymentMethod: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="Cartão">Cartão</SelectItem>
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="Crédito">Crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Quantidade Desperdiçada</Label>
                <Input
                  type="number"
                  min="0"
                  value={editForm.wasteQuantity}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      wasteQuantity: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>

              <div>
                <Label>Motivo do Desperdício</Label>
                <Input
                  value={editForm.wasteNotes}
                  onChange={(e) =>
                    setEditForm({ ...editForm, wasteNotes: e.target.value })
                  }
                  placeholder="Ex: Queimado, Vencido..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowEditDialog(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
