
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Receipt, DollarSign, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Product {
  id: string;
  name: string;
  category: string;
  unitPrice: number;
  currentStock: number;
}

interface ProductGroup {
  category: string;
  products: Product[];
  totalStock: number;
}

interface BankAccount {
  id: string;
  name: string;
  balance: number;
}

interface SaleItem {
  productCategory: string;
  quantity: number;
  averagePrice: number;
  totalValue: number;
}

export default function ResumoVendasTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Itens da venda
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  
  // Campos do formulário
  const [selectedCategory, setSelectedCategory] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [unitPrice, setUnitPrice] = useState(0);
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [bankAccountId, setBankAccountId] = useState("");
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [productsRes, accountsRes] = await Promise.all([
        fetch("/api/client-management/products"),
        fetch("/api/client-management/bank-accounts"),
      ]);

      const productsData = await productsRes.json();
      const accountsData = await accountsRes.json();

      if (productsData.success) {
        setProducts(productsData.data);
        groupProducts(productsData.data);
      }

      if (accountsData.success) {
        setBankAccounts(accountsData.data);
        if (accountsData.data.length > 0) {
          setBankAccountId(accountsData.data[0].id);
        }
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const groupProducts = (prods: Product[]) => {
    const groups: Record<string, ProductGroup> = {};

    prods.forEach((product) => {
      if (!groups[product.category]) {
        groups[product.category] = {
          category: product.category,
          products: [],
          totalStock: 0,
        };
      }
      
      groups[product.category].products.push(product);
      groups[product.category].totalStock += product.currentStock;
    });

    setProductGroups(Object.values(groups));
  };

  const addSaleItem = () => {
    if (!selectedCategory) {
      toast.error("Selecione uma categoria");
      return;
    }

    if (quantity <= 0) {
      toast.error("Informe a quantidade vendida");
      return;
    }

    if (unitPrice <= 0) {
      toast.error("Informe o preço unitário da venda");
      return;
    }

    const group = productGroups.find((g) => g.category === selectedCategory);
    
    if (!group) {
      toast.error("Categoria não encontrada");
      return;
    }

    // Validação de estoque removida para permitir vendas resumidas
    // O assador pode vender mais do que tem em estoque registrado

    const existingItem = saleItems.find((item) => item.productCategory === selectedCategory);

    if (existingItem) {
      setSaleItems(
        saleItems.map((item) =>
          item.productCategory === selectedCategory
            ? {
                ...item,
                quantity: item.quantity + quantity,
                totalValue: (item.quantity + quantity) * unitPrice,
                averagePrice: unitPrice, // Atualiza com o novo preço
              }
            : item
        )
      );
    } else {
      setSaleItems([
        ...saleItems,
        {
          productCategory: selectedCategory,
          quantity,
          averagePrice: unitPrice,
          totalValue: quantity * unitPrice,
        },
      ]);
    }

    toast.success(`${quantity} ${selectedCategory} adicionado(s) - ${formatCurrency(unitPrice * quantity)}`);
    setSelectedCategory("");
    setQuantity(0);
    setUnitPrice(0);
  };

  const removeSaleItem = (category: string) => {
    setSaleItems(saleItems.filter((item) => item.productCategory !== category));
    toast.success("Item removido");
  };

  const calculateSubtotal = () => {
    return saleItems.reduce((sum, item) => sum + item.totalValue, 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal() - discount;
  };

  const clearForm = () => {
    setSaleItems([]);
    setCustomerName("");
    setDiscount(0);
    setNotes("");
    setSelectedCategory("");
    setQuantity(0);
    setUnitPrice(0);
  };

  const handleSubmit = async () => {
    if (saleItems.length === 0) {
      toast.error("Adicione itens à venda");
      return;
    }

    const totalValue = calculateTotal();
    if (totalValue <= 0) {
      toast.error("O valor total da venda deve ser maior que zero");
      return;
    }

    if (!bankAccountId) {
      toast.error("Selecione uma conta bancária");
      return;
    }

    try {
      setSubmitting(true);

      // Preparar payload com agrupamento automático
      const payload = {
        customerName,
        isGroupedSale: true, // Marcador para venda genérica
        groupedItems: saleItems,
        subtotal: calculateSubtotal(),
        discount,
        total: calculateTotal(),
        paymentMethod,
        paymentStatus: "PAID",
        bankAccountId,
        notes: notes + " [VENDA GENÉRICA - AGRUPADA]",
      };

      const res = await fetch("/api/client-management/sales/grouped", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Venda registrada! Estoque convertido para genérico.");
        clearForm();
        loadData();
      } else {
        toast.error(data.error || "Erro ao registrar venda");
      }
    } catch (error) {
      console.error("Error submitting sale:", error);
      toast.error("Erro ao registrar venda");
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      {/* Painel de Entrada */}
      <div>
        <Card>
          <CardHeader>
            <CardTitle>Resumo de Vendas do Dia</CardTitle>
            <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-md mt-2">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-1">Venda Resumida do Dia</p>
                <p>
                  Use este modo para registrar <strong>resumo das vendas do dia</strong>. 
                  Você pode adicionar múltiplos produtos (espetos, jantinhas, refrigerantes, etc).
                </p>
                <p className="mt-1">
                  <strong>Importante:</strong> Informe a <strong>quantidade</strong> e o <strong>preço unitário</strong> de cada item vendido.
                </p>
                <p className="mt-1 text-xs">
                  O estoque detalhado será convertido automaticamente para genérico após finalizar.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Adicionar Item */}
            <div className="space-y-3 p-4 border rounded-lg bg-gray-50">
              <h3 className="font-semibold">Adicionar Item</h3>
              
              <div>
                <Label>Categoria de Produto</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {productGroups.map((group) => (
                      <SelectItem key={group.category} value={group.category}>
                        {group.category} (Estoque: {group.totalStock})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Quantidade</Label>
                  <Input
                    type="number"
                    value={quantity || ""}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                    min="1"
                    placeholder="Ex: 50"
                  />
                </div>

                <div>
                  <Label>Preço Unitário (R$)</Label>
                  <Input
                    type="number"
                    value={unitPrice || ""}
                    onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.01"
                    placeholder="Ex: 8,00"
                  />
                </div>
              </div>

              {quantity > 0 && unitPrice > 0 && (
                <div className="p-2 bg-green-50 rounded border border-green-200">
                  <p className="text-sm text-green-900">
                    <strong>Total do Item:</strong> {formatCurrency(quantity * unitPrice)}
                  </p>
                </div>
              )}

              <Button className="w-full" onClick={addSaleItem}>
                Adicionar à Venda
              </Button>
            </div>

            {/* Itens Adicionados */}
            {saleItems.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold">Itens da Venda</h3>
                {saleItems.map((item) => (
                  <Card key={item.productCategory}>
                    <CardContent className="p-3 flex justify-between items-center">
                      <div>
                        <p className="font-medium">{item.productCategory}</p>
                        <p className="text-sm text-gray-600">
                          {item.quantity} unidades × {formatCurrency(item.averagePrice)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600">
                          {formatCurrency(item.totalValue)}
                        </p>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => removeSaleItem(item.productCategory)}
                        >
                          Remover
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Painel de Finalização */}
      <div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Finalizar Venda
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Cliente (opcional)</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nome do cliente"
              />
            </div>

            <div>
              <Label>Conta Bancária</Label>
              <Select value={bankAccountId} onValueChange={setBankAccountId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} - {formatCurrency(account.balance)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Forma de Pagamento</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Dinheiro</SelectItem>
                  <SelectItem value="PIX">Pix</SelectItem>
                  <SelectItem value="DEBIT_CARD">Débito</SelectItem>
                  <SelectItem value="CREDIT_CARD">Crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Desconto (R$)</Label>
              <Input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                min="0"
                step="0.01"
              />
            </div>

            <div>
              <Label>Observações</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações da venda"
              />
            </div>

            {/* Totais */}
            <div className="space-y-2 pt-4 border-t">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-semibold">
                  {formatCurrency(calculateSubtotal())}
                </span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Desconto:</span>
                  <span>-{formatCurrency(discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span className="text-green-600">
                  {formatCurrency(calculateTotal())}
                </span>
              </div>
            </div>

            {/* Botões */}
            <div className="space-y-2 pt-4">
              <Button
                className="w-full"
                size="lg"
                onClick={handleSubmit}
                disabled={submitting || saleItems.length === 0}
              >
                <DollarSign className="h-4 w-4 mr-2" />
                {submitting ? "Finalizando..." : "Finalizar Venda"}
              </Button>
              <Button
                className="w-full"
                variant="outline"
                onClick={clearForm}
                disabled={submitting}
              >
                Limpar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
