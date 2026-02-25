
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  Trash2,
  Plus,
  Package,
  Edit,
  Save,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ClientProduct {
  id: string;
  name: string;
  category: string;
  unitPrice: number;
  costPrice?: number;
  trackInventory: boolean;
  Inventory?: {
    currentStock: number;
  };
}

interface WasteRecord {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  approximateValue: number;
  reason?: string;
  notes?: string;
  createdAt: string;
  Product: ClientProduct;
}

const MOTIVOS_DESPERDICIO = [
  { value: "Queimado", label: "🔥 Queimado" },
  { value: "Vencido/Velho", label: "📅 Vencido/Velho" },
  { value: "Mal conservado", label: "❄️ Mal conservado" },
  { value: "Quebrado", label: "💔 Quebrado" },
  { value: "Erro de preparo", label: "⚠️ Erro de preparo" },
  { value: "Excesso de produção", label: "📦 Excesso de produção" },
  { value: "Contaminado", label: "🦠 Contaminado" },
  { value: "Outros", label: "🔧 Outros" },
];

export default function WasteTab() {
  const [products, setProducts] = useState<ClientProduct[]>([]);
  const [wasteRecords, setWasteRecords] = useState<WasteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Formulário
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [approximateValue, setApproximateValue] = useState(0);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  // Edição
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadProducts(), loadWasteRecords()]);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    const res = await fetch("/api/customer/products");
    if (res.ok) {
      const data = await res.json();
      setProducts(data || []);
    }
  };

  const loadWasteRecords = async () => {
    const res = await fetch("/api/client-management/waste");
    if (res.ok) {
      const data = await res.json();
      setWasteRecords(data || []);
    }
  };

  const handleProductChange = (value: string) => {
    setProductId(value);
    
    // Auto-preencher o valor aproximado com o custo ou preço do produto
    const product = products.find(p => p.id === value);
    if (product) {
      setApproximateValue(product.costPrice || product.unitPrice || 0);
    }
  };

  const handleSubmit = async () => {
    // Validações
    if (!productId) {
      toast.error("Selecione um produto");
      return;
    }

    if (!quantity || quantity <= 0) {
      toast.error("Informe a quantidade desperdiçada");
      return;
    }

    if (!approximateValue || approximateValue <= 0) {
      toast.error("Informe o valor aproximado");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        productId,
        quantity,
        approximateValue,
        reason: reason || null,
        notes: notes || null,
      };

      const url = editingId 
        ? `/api/client-management/waste/${editingId}`
        : "/api/client-management/waste";
      
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(editingId ? "Desperdício atualizado!" : "Desperdício registrado!");
        clearForm();
        loadWasteRecords();
      } else {
        const error = await res.json();
        toast.error(error.error || "Erro ao registrar desperdício");
      }
    } catch (error) {
      console.error("Erro:", error);
      toast.error("Erro ao registrar desperdício");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (record: WasteRecord) => {
    setEditingId(record.id);
    setProductId(record.productId);
    setQuantity(record.quantity);
    setApproximateValue(record.approximateValue);
    setReason(record.reason || "");
    setNotes(record.notes || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja excluir este registro de desperdício? O estoque será revertido.")) {
      return;
    }

    try {
      const res = await fetch(`/api/client-management/waste/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Registro excluído e estoque revertido!");
        loadWasteRecords();
      } else {
        const error = await res.json();
        toast.error(error.error || "Erro ao excluir registro");
      }
    } catch (error) {
      console.error("Erro:", error);
      toast.error("Erro ao excluir registro");
    }
  };

  const clearForm = () => {
    setEditingId(null);
    setProductId("");
    setQuantity(0);
    setApproximateValue(0);
    setReason("");
    setNotes("");
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const calculateTotal = () => {
    return wasteRecords.reduce((sum, record) => sum + record.approximateValue, 0);
  };

  const calculateTotalQuantity = () => {
    return wasteRecords.reduce((sum, record) => sum + record.quantity, 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Formulário de Registro */}
      <Card className="border-orange-200">
        <CardHeader className="bg-orange-50">
          <CardTitle className="flex items-center gap-2 text-orange-900">
            <AlertTriangle className="h-5 w-5" />
            {editingId ? "Editar Desperdício" : "Registrar Desperdício"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 mt-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
            <p className="font-semibold">ℹ️ Controle de Estoque Automático</p>
            <p className="mt-1">
              Ao registrar desperdício, a quantidade será automaticamente descontada do seu estoque.
            </p>
          </div>

          <div>
            <Label>Produto Desperdiçado *</Label>
            <Select value={productId} onValueChange={handleProductChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o produto" />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name} 
                    {product.trackInventory && product.Inventory && (
                      <span className="text-gray-500 ml-2">
                        (Estoque: {product.Inventory.currentStock})
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Quantidade Desperdiçada *</Label>
            <Input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
              min="1"
              placeholder="Ex: 5"
            />
          </div>

          <div>
            <Label>Valor Aproximado (R$) *</Label>
            <Input
              type="number"
              step="0.01"
              value={approximateValue}
              onChange={(e) => setApproximateValue(parseFloat(e.target.value) || 0)}
              min="0"
              placeholder="Ex: 15.00"
            />
            <p className="text-xs text-gray-500 mt-1">
              Valor total do desperdício (calculado ou manual)
            </p>
          </div>

          <div>
            <Label>Motivo do Desperdício</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {MOTIVOS_DESPERDICIO.map((motivo) => (
                  <SelectItem key={motivo.value} value={motivo.value}>
                    {motivo.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações adicionais (opcional)"
              rows={3}
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 bg-orange-600 hover:bg-orange-700"
            >
              {saving ? (
                "Salvando..."
              ) : editingId ? (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Atualizar
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Registrar
                </>
              )}
            </Button>
            
            {editingId && (
              <Button
                variant="outline"
                onClick={clearForm}
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Cancelar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lista de Registros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Histórico de Desperdício
            </span>
            <span className="text-sm font-normal text-gray-600">
              {wasteRecords.length} registro{wasteRecords.length !== 1 && "s"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Resumo */}
          {wasteRecords.length > 0 && (
            <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">Total Desperdiçado</p>
                <p className="text-2xl font-bold text-orange-600">
                  {calculateTotalQuantity()}
                </p>
                <p className="text-xs text-gray-500">unidades</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Valor Total</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(calculateTotal())}
                </p>
                <p className="text-xs text-gray-500">aproximado</p>
              </div>
            </div>
          )}

          {/* Tabela */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Qtd</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wasteRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>🎉 Nenhum desperdício registrado!</p>
                      <p className="text-sm mt-1">Continue com esse ótimo trabalho.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  wasteRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="text-xs">
                        {format(new Date(record.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-medium">
                        {record.productName}
                      </TableCell>
                      <TableCell>{record.quantity}</TableCell>
                      <TableCell className="text-red-600 font-semibold">
                        {formatCurrency(record.approximateValue)}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                          {record.reason || "Sem motivo"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(record)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(record.id)}
                          >
                            <Trash2 className="h-3 w-3" />
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
    </div>
  );
}
