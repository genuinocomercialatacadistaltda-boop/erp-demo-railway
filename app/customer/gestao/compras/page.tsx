
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Home,
  ArrowLeft,
  ShoppingCart,
  Plus,
  Search,
  Calendar,
  DollarSign,
  Package,
  FileText,
  Trash2,
  Eye,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Purchase {
  id: string;
  purchaseNumber: string;
  totalAmount: number;
  status: string;
  purchaseDate: string;
  dueDate: string;
  paymentDate?: string;
  invoiceNumber?: string;
  notes?: string;
  Supplier: {
    id: string;
    name: string;
  };
  PurchaseItem: Array<{
    id: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    RawMaterial: {
      id: string;
      name: string;
      measurementUnit: string;
    };
  }>;
  Expense?: {
    id: string;
    status: string;
    paymentDate?: string;
  };
}

export default function ComprasPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [filteredPurchases, setFilteredPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
      return;
    }

    if (status === "authenticated") {
      loadPurchases();
    }
  }, [status, router]);

  useEffect(() => {
    filterPurchases();
  }, [searchTerm, purchases]);

  const loadPurchases = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/customer/purchases");
      
      if (!response.ok) {
        throw new Error("Erro ao carregar compras");
      }

      const data = await response.json();
      setPurchases(data);
      setFilteredPurchases(data);
    } catch (error) {
      console.error("[LOAD_PURCHASES_ERROR]", error);
      toast.error("Erro ao carregar histórico de compras");
    } finally {
      setLoading(false);
    }
  };

  const filterPurchases = () => {
    if (!searchTerm) {
      setFilteredPurchases(purchases);
      return;
    }

    const filtered = purchases.filter(
      (purchase) =>
        purchase.purchaseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        purchase.Supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        purchase.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    setFilteredPurchases(filtered);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      PENDING: {
        label: "Pendente",
        color: "bg-yellow-100 text-yellow-800 border-yellow-300",
      },
      PAID: {
        label: "Pago",
        color: "bg-green-100 text-green-800 border-green-300",
      },
      OVERDUE: {
        label: "Vencido",
        color: "bg-red-100 text-red-800 border-red-300",
      },
    };

    return statusConfig[status as keyof typeof statusConfig] || statusConfig.PENDING;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR });
  };

  const handleViewDetails = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    setShowDetailsDialog(true);
  };

  const handleDeletePurchase = async (purchaseId: string) => {
    if (!confirm('⚠️ Tem certeza que deseja excluir esta compra?\n\nISSO IRÁ:\n• Remover a compra do histórico\n• Excluir a despesa associada (se houver)\n\n❌ Esta ação NÃO pode ser desfeita!\n\n⚠️ ATENÇÃO: O estoque de matérias-primas não será ajustado automaticamente.')) {
      return;
    }

    try {
      console.log('🗑️ [DELETE] Excluindo compra:', purchaseId);
      
      const response = await fetch(`/api/customer/purchases/${purchaseId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao excluir compra');
      }

      console.log('✅ [DELETE] Compra excluída com sucesso:', data.purchaseNumber);
      
      toast.success(`Compra ${data.purchaseNumber} excluída com sucesso!`);
      
      // Fechar modal e recarregar lista
      setShowDetailsDialog(false);
      setSelectedPurchase(null);
      await loadPurchases();
      
    } catch (error: any) {
      console.error('❌ [DELETE_ERROR]', error);
      toast.error(error.message || 'Erro ao excluir compra');
    }
  };

  const totalCompras = purchases.length;
  const totalGasto = purchases.reduce((sum, p) => sum + p.totalAmount, 0);
  const totalPendente = purchases
    .filter((p) => p.status === "PENDING")
    .reduce((sum, p) => sum + p.totalAmount, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <ShoppingCart className="h-8 w-8 text-blue-600" />
              Compras
            </h1>
            <p className="text-slate-600 mt-1">
              Histórico e registro de compras
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => router.push("/customer/gestao/compras/nova")}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Nova Compra
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/customer/gestao")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-2"
            >
              <Home className="h-4 w-4" />
              Início
            </Button>
          </div>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="p-6 bg-white border-2 border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total de Compras</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">
                  {totalCompras}
                </p>
              </div>
              <ShoppingCart className="h-12 w-12 text-blue-600 opacity-20" />
            </div>
          </Card>

          <Card className="p-6 bg-white border-2 border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Gasto</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">
                  {formatCurrency(totalGasto)}
                </p>
              </div>
              <DollarSign className="h-12 w-12 text-green-600 opacity-20" />
            </div>
          </Card>

          <Card className="p-6 bg-white border-2 border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">A Pagar</p>
                <p className="text-3xl font-bold text-yellow-600 mt-1">
                  {formatCurrency(totalPendente)}
                </p>
              </div>
              <Calendar className="h-12 w-12 text-yellow-600 opacity-20" />
            </div>
          </Card>
        </div>

        {/* Barra de Busca */}
        <Card className="p-4 mb-6 bg-white border-2 border-slate-200">
          <div className="flex items-center gap-3">
            <Search className="h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por número, fornecedor ou nota fiscal..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 outline-none text-slate-900"
            />
          </div>
        </Card>

        {/* Lista de Compras */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-slate-600 mt-4">Carregando compras...</p>
          </div>
        ) : filteredPurchases.length === 0 ? (
          <Card className="p-12 bg-white border-2 border-slate-200 text-center">
            <ShoppingCart className="h-16 w-16 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600 text-lg">
              {searchTerm
                ? "Nenhuma compra encontrada"
                : "Nenhuma compra registrada"}
            </p>
            <p className="text-slate-500 text-sm mt-2">
              {searchTerm
                ? "Tente buscar com outros termos"
                : "Clique em 'Nova Compra' para registrar sua primeira compra"}
            </p>
            <Button
              onClick={() => router.push("/customer/gestao/compras/nova")}
              className="mt-4 bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Registrar Compra
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredPurchases.map((purchase) => {
              const statusBadge = getStatusBadge(purchase.status);

              return (
                <Card
                  key={purchase.id}
                  className="p-5 bg-white border-2 border-slate-200 hover:border-blue-300 transition-all"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Info Principal */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-slate-900 text-lg">
                          {purchase.purchaseNumber}
                        </h3>
                        <Badge className={statusBadge.color}>
                          {statusBadge.label}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Package className="h-4 w-4" />
                          <span>Fornecedor: <strong className="text-slate-900">{purchase.Supplier.name}</strong></span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <Calendar className="h-4 w-4" />
                          <span>Data: {formatDate(purchase.purchaseDate)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <DollarSign className="h-4 w-4" />
                          <span>Valor: <strong className="text-slate-900">{formatCurrency(purchase.totalAmount)}</strong></span>
                        </div>
                        {purchase.invoiceNumber && (
                          <div className="flex items-center gap-2 text-slate-600">
                            <FileText className="h-4 w-4" />
                            <span>NF: {purchase.invoiceNumber}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDetails(purchase)}
                        className="flex items-center gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        Ver Detalhes
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Detalhes */}
      {showDetailsDialog && selectedPurchase && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-2xl w-full max-h-[80vh] overflow-y-auto bg-white">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-slate-900">
                  Detalhes da Compra
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDetailsDialog(false)}
                >
                  ✕
                </Button>
              </div>

              {/* Informações Gerais */}
              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-600">Número</p>
                    <p className="font-semibold text-slate-900">
                      {selectedPurchase.purchaseNumber}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Status</p>
                    <Badge className={getStatusBadge(selectedPurchase.status).color}>
                      {getStatusBadge(selectedPurchase.status).label}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Fornecedor</p>
                    <p className="font-semibold text-slate-900">
                      {selectedPurchase.Supplier.name}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Data da Compra</p>
                    <p className="font-semibold text-slate-900">
                      {formatDate(selectedPurchase.purchaseDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Vencimento</p>
                    <p className="font-semibold text-slate-900">
                      {formatDate(selectedPurchase.dueDate)}
                    </p>
                  </div>
                  {selectedPurchase.paymentDate && (
                    <div>
                      <p className="text-sm text-slate-600">Data do Pagamento</p>
                      <p className="font-semibold text-slate-900">
                        {formatDate(selectedPurchase.paymentDate)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Itens da Compra */}
              <div className="border-t border-slate-200 pt-4">
                <h3 className="font-semibold text-slate-900 mb-3">
                  Itens da Compra
                </h3>
                <div className="space-y-2">
                  {selectedPurchase.PurchaseItem.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-slate-900">
                          {item.RawMaterial.name}
                        </p>
                        <p className="text-sm text-slate-600">
                          {item.quantity} {item.RawMaterial.measurementUnit} × {formatCurrency(item.unitPrice)}
                        </p>
                      </div>
                      <p className="font-semibold text-slate-900">
                        {formatCurrency(item.totalPrice)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="border-t border-slate-200 mt-4 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-slate-900">
                    Total
                  </span>
                  <span className="text-2xl font-bold text-blue-600">
                    {formatCurrency(selectedPurchase.totalAmount)}
                  </span>
                </div>
              </div>

              {/* Observações */}
              {selectedPurchase.notes && (
                <div className="border-t border-slate-200 mt-4 pt-4">
                  <p className="text-sm text-slate-600 mb-2">Observações</p>
                  <p className="text-slate-900">{selectedPurchase.notes}</p>
                </div>
              )}

              {/* Ações */}
              <div className="border-t border-slate-200 mt-6 pt-4 flex justify-end gap-2">
                {selectedPurchase.status === 'PAID' ? (
                  <div className="flex-1 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-800">
                      ⚠️ <strong>Compras pagas não podem ser excluídas</strong>
                      <br />
                      <span className="text-yellow-700">
                        Esta compra já foi paga e não pode mais ser modificada ou excluída.
                      </span>
                    </p>
                  </div>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setShowDetailsDialog(false)}
                    >
                      Fechar
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleDeletePurchase(selectedPurchase.id)}
                      className="flex items-center gap-2 bg-red-600 hover:bg-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                      Excluir Compra
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
