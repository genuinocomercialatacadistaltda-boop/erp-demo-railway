
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Home,
  ArrowLeft,
  Plus,
  Trash2,
  ShoppingCart,
  Save,
} from "lucide-react";
import { toast } from "react-hot-toast";

interface RawMaterial {
  id: string;
  name: string;
  measurementUnit: string;
  costPerUnit?: number;
}

interface Supplier {
  id: string;
  name: string;
  document?: string;
}

interface PurchaseItem {
  rawMaterialId: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}

export default function NovaCompraPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  
  // Dados
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  
  // Formulário
  const [supplierId, setSupplierId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [paidImmediately, setPaidImmediately] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<PurchaseItem[]>([
    { rawMaterialId: "", quantity: 0, unitPrice: 0, notes: "" },
  ]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
      return;
    }

    if (status === "authenticated") {
      loadInitialData();
    }
  }, [status, router]);

  const loadInitialData = async () => {
    try {
      setLoadingData(true);
      
      // Carregar fornecedores
      const suppliersResponse = await fetch("/api/customer/suppliers");
      if (suppliersResponse.ok) {
        const suppliersData = await suppliersResponse.json();
        setSuppliers(suppliersData);
      }

      // Carregar matérias-primas
      const materialsResponse = await fetch("/api/customer/raw-materials");
      if (materialsResponse.ok) {
        const materialsData = await materialsResponse.json();
        setRawMaterials(materialsData);
      }
    } catch (error) {
      console.error("[LOAD_INITIAL_DATA_ERROR]", error);
      toast.error("Erro ao carregar dados iniciais");
    } finally {
      setLoadingData(false);
    }
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      { rawMaterialId: "", quantity: 0, unitPrice: 0, notes: "" },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) {
      toast.error("É necessário pelo menos um item");
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (
    index: number,
    field: keyof PurchaseItem,
    value: any
  ) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    // Se mudou a matéria-prima, buscar o custo unitário
    if (field === "rawMaterialId" && value) {
      const material = rawMaterials.find((m) => m.id === value);
      if (material?.costPerUnit) {
        newItems[index].unitPrice = material.costPerUnit;
      }
    }

    setItems(newItems);
  };

  const calculateTotal = () => {
    return items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validações
    if (!supplierId) {
      toast.error("Selecione um fornecedor");
      return;
    }

    if (!dueDate) {
      toast.error("Informe a data de vencimento");
      return;
    }

    const validItems = items.filter(
      (item) => item.rawMaterialId && item.quantity > 0 && item.unitPrice > 0
    );

    if (validItems.length === 0) {
      toast.error("Adicione pelo menos um item válido");
      return;
    }

    if (paidImmediately && !paymentMethod) {
      toast.error("Informe a forma de pagamento");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        supplierId,
        items: validItems,
        dueDate,
        paymentDate: paidImmediately ? new Date().toISOString() : null,
        paymentMethod: paidImmediately ? paymentMethod : null,
        paidImmediately,
        invoiceNumber: invoiceNumber || null,
        notes: notes || null,
      };

      console.log("[SUBMIT_PURCHASE] Enviando:", payload);

      const response = await fetch("/api/customer/purchases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao registrar compra");
      }

      toast.success("Compra registrada com sucesso!");
      router.push("/customer/gestao/compras");
    } catch (error) {
      console.error("[SUBMIT_PURCHASE_ERROR]", error);
      toast.error(
        error instanceof Error ? error.message : "Erro ao registrar compra"
      );
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-slate-600 mt-4">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <ShoppingCart className="h-8 w-8 text-blue-600" />
              Nova Compra
            </h1>
            <p className="text-slate-600 mt-1">
              Registre uma compra manual
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => router.push("/customer/gestao/compras")}
              className="flex items-center gap-2"
              disabled={loading}
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-2"
              disabled={loading}
            >
              <Home className="h-4 w-4" />
              Início
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Informações Gerais */}
            <Card className="p-6 bg-white border-2 border-slate-200">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">
                Informações Gerais
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Fornecedor */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Fornecedor *
                  </label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Selecione um fornecedor</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Data de Vencimento */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Data de Vencimento *
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* Número da NF */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Número da Nota Fiscal
                  </label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="Ex: 12345"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Pagamento Imediato */}
                <div className="flex items-center gap-3 md:col-span-2">
                  <input
                    type="checkbox"
                    id="paidImmediately"
                    checked={paidImmediately}
                    onChange={(e) => setPaidImmediately(e.target.checked)}
                    className="h-5 w-5 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label
                    htmlFor="paidImmediately"
                    className="text-sm font-medium text-slate-700 cursor-pointer"
                  >
                    Pago na hora (não gera conta a pagar)
                  </label>
                </div>

                {/* Forma de Pagamento (se pago imediatamente) */}
                {paidImmediately && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Forma de Pagamento *
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Selecione</option>
                      <option value="DINHEIRO">Dinheiro</option>
                      <option value="PIX">PIX</option>
                      <option value="DEBITO">Débito</option>
                      <option value="CREDITO">Crédito</option>
                      <option value="BOLETO">Boleto</option>
                    </select>
                  </div>
                )}

                {/* Observações */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Observações
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Informações adicionais sobre a compra"
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </Card>

            {/* Itens da Compra */}
            <Card className="p-6 bg-white border-2 border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-slate-900">
                  Itens da Compra
                </h2>
                <Button
                  type="button"
                  onClick={handleAddItem}
                  className="bg-blue-600 hover:bg-blue-700"
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Item
                </Button>
              </div>

              <div className="space-y-4">
                {items.map((item, index) => (
                  <div
                    key={index}
                    className="p-4 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* Matéria-Prima */}
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Matéria-Prima *
                          </label>
                          <select
                            value={item.rawMaterialId}
                            onChange={(e) =>
                              handleItemChange(index, "rawMaterialId", e.target.value)
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          >
                            <option value="">Selecione</option>
                            {rawMaterials.map((material) => (
                              <option key={material.id} value={material.id}>
                                {material.name} ({material.measurementUnit})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Quantidade */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Quantidade *
                          </label>
                          <input
                            type="number"
                            value={item.quantity || ""}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "quantity",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            min="0"
                            step="0.01"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>

                        {/* Preço Unitário */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Preço Unitário *
                          </label>
                          <input
                            type="number"
                            value={item.unitPrice || ""}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "unitPrice",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            min="0"
                            step="0.01"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>

                        {/* Total do Item */}
                        <div className="md:col-span-4">
                          <p className="text-sm text-slate-600">
                            Subtotal:{" "}
                            <span className="font-semibold text-slate-900">
                              {formatCurrency(item.quantity * item.unitPrice)}
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Botão Remover */}
                      {items.length > 1 && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemoveItem(index)}
                          className="mt-7"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Total Geral */}
              <div className="mt-6 pt-6 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-slate-900">
                    Total da Compra
                  </span>
                  <span className="text-3xl font-bold text-blue-600">
                    {formatCurrency(calculateTotal())}
                  </span>
                </div>
              </div>
            </Card>

            {/* Botões de Ação */}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/customer/gestao/compras")}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar Compra
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
