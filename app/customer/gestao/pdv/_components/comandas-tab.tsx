
"use client";

import { useEffect, useState } from "react";
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
import { Plus, Minus, Trash2, Eye, DollarSign, Table as TableIcon } from "lucide-react";
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

interface TableItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface Table {
  id: string;
  tableNumber: string;
  tableName?: string;
  status: string;
  currentTotal: number;
  openedAt: string;
  Items: TableItem[];
}

interface BankAccount {
  id: string;
  name: string;
  balance: number;
}

export default function ComandasTab() {
  const [tables, setTables] = useState<Table[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [showNewTableDialog, setShowNewTableDialog] = useState(false);
  const [showViewTableDialog, setShowViewTableDialog] = useState(false);
  const [showCloseTableDialog, setShowCloseTableDialog] = useState(false);

  // Novo estado de mesa
  const [newTableNumber, setNewTableNumber] = useState("");
  const [newTableName, setNewTableName] = useState("");

  // Adicionar produto à mesa
  const [selectedProduct, setSelectedProduct] = useState("");
  const [productQuantity, setProductQuantity] = useState(1);

  // Fechar mesa
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [bankAccountId, setBankAccountId] = useState("");
  const [discount, setDiscount] = useState(0);
  const [customerName, setCustomerName] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [tablesRes, productsRes, accountsRes] = await Promise.all([
        fetch("/api/client-management/tables"),
        fetch("/api/client-management/products"),
        fetch("/api/client-management/bank-accounts"),
      ]);

      const tablesData = await tablesRes.json();
      const productsData = await productsRes.json();
      const accountsData = await accountsRes.json();

      if (tablesData.success) {
        setTables(tablesData.data);
      }

      if (productsData.success) {
        setProducts(productsData.data);
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

  const handleCreateTable = async () => {
    if (!newTableNumber) {
      toast.error("Informe o número da mesa");
      return;
    }

    try {
      const res = await fetch("/api/client-management/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableNumber: newTableNumber,
          tableName: newTableName,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Mesa aberta!");
        setShowNewTableDialog(false);
        setNewTableNumber("");
        setNewTableName("");
        loadData();
      } else {
        toast.error(data.error || "Erro ao abrir mesa");
      }
    } catch (error) {
      console.error("Error creating table:", error);
      toast.error("Erro ao abrir mesa");
    }
  };

  const handleAddProductToTable = async () => {
    console.log("===== INICIANDO ADIÇÃO DE PRODUTO À MESA =====");
    console.log("selectedTable:", selectedTable);
    console.log("selectedProduct:", selectedProduct);
    console.log("productQuantity:", productQuantity);
    
    if (!selectedTable || !selectedProduct) {
      console.log("❌ Validação falhou: mesa ou produto não selecionado");
      toast.error("Selecione um produto");
      return;
    }

    if (productQuantity <= 0) {
      console.log("❌ Validação falhou: quantidade inválida");
      toast.error("Informe a quantidade");
      return;
    }

    const product = products.find((p) => p.id === selectedProduct);
    console.log("Produto encontrado:", product);
    
    if (!product) {
      console.log("❌ Produto não encontrado na lista");
      toast.error("Produto não encontrado");
      return;
    }

    if (productQuantity > product.currentStock) {
      console.log("❌ Estoque insuficiente:", {
        solicitado: productQuantity,
        disponivel: product.currentStock
      });
      toast.error("Estoque insuficiente");
      return;
    }

    const payload = {
      tableId: selectedTable.id,
      productId: product.id,
      productName: product.name,
      quantity: productQuantity,
      unitPrice: product.unitPrice,
    };
    
    console.log("📤 PAYLOAD ENVIADO:", JSON.stringify(payload, null, 2));

    try {
      console.log("Fazendo requisição para /api/client-management/tables/add-item...");
      
      const res = await fetch("/api/client-management/tables/add-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      console.log("📥 Status da resposta:", res.status, res.statusText);
      
      const data = await res.json();
      console.log("📥 Resposta da API:", data);

      if (data.success) {
        console.log("✅ Produto adicionado com sucesso!");
        toast.success("Produto adicionado à mesa!");
        setSelectedProduct("");
        setProductQuantity(1);
        loadData();
        // Atualizar mesa selecionada
        const updatedTables = await fetch("/api/client-management/tables");
        const updatedData = await updatedTables.json();
        if (updatedData.success) {
          const updatedTable = updatedData.data.find((t: Table) => t.id === selectedTable.id);
          if (updatedTable) {
            setSelectedTable(updatedTable);
          }
        }
      } else {
        console.log("❌ API retornou erro:", data.error);
        toast.error(data.error || "Erro ao adicionar produto");
      }
    } catch (error) {
      console.error("❌ ERRO AO ADICIONAR PRODUTO:", error);
      toast.error("Erro ao adicionar produto");
    }
  };

  const handleRemoveItemFromTable = async (itemId: string) => {
    if (!selectedTable) return;

    try {
      const res = await fetch("/api/client-management/tables/remove-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId: selectedTable.id,
          itemId,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Item removido!");
        loadData();
        // Atualizar mesa selecionada
        const updatedTables = await fetch("/api/client-management/tables");
        const updatedData = await updatedTables.json();
        if (updatedData.success) {
          const updatedTable = updatedData.data.find((t: Table) => t.id === selectedTable.id);
          if (updatedTable) {
            setSelectedTable(updatedTable);
          }
        }
      } else {
        toast.error(data.error || "Erro ao remover item");
      }
    } catch (error) {
      console.error("Error removing item:", error);
      toast.error("Erro ao remover item");
    }
  };

  const handleCloseTable = async () => {
    if (!selectedTable) return;

    if (!bankAccountId) {
      toast.error("Selecione uma conta bancária");
      return;
    }

    if (selectedTable.Items.length === 0) {
      toast.error("Mesa sem itens");
      return;
    }

    try {
      const subtotal = selectedTable.currentTotal;
      const total = subtotal - discount;

      const res = await fetch("/api/client-management/tables/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId: selectedTable.id,
          customerName,
          paymentMethod,
          bankAccountId,
          discount,
          subtotal,
          total,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Mesa fechada com sucesso!");
        setShowCloseTableDialog(false);
        setShowViewTableDialog(false);
        setSelectedTable(null);
        setCustomerName("");
        setDiscount(0);
        loadData();
      } else {
        toast.error(data.error || "Erro ao fechar mesa");
      }
    } catch (error) {
      console.error("Error closing table:", error);
      toast.error("Erro ao fechar mesa");
    }
  };

  const openTable = (table: Table) => {
    setSelectedTable(table);
    setShowViewTableDialog(true);
  };

  const openCloseDialog = (table: Table) => {
    setSelectedTable(table);
    setShowCloseTableDialog(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("pt-BR");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-6">
      {/* Header com botão de nova mesa */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Comandas e Mesas</h2>
        <Dialog open={showNewTableDialog} onOpenChange={setShowNewTableDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Mesa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Abrir Nova Mesa</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>Número da Mesa *</Label>
                <Input
                  value={newTableNumber}
                  onChange={(e) => setNewTableNumber(e.target.value)}
                  placeholder="Ex: 1, 2, 3..."
                />
              </div>
              <div>
                <Label>Nome (opcional)</Label>
                <Input
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  placeholder="Ex: VIP, Varanda..."
                />
              </div>
              <Button className="w-full" onClick={handleCreateTable}>
                Abrir Mesa
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de Mesas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tables.filter((t) => t.status === "OCCUPIED").map((table) => (
          <Card key={table.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TableIcon className="h-5 w-5" />
                    Mesa {table.tableNumber}
                  </CardTitle>
                  {table.tableName && (
                    <p className="text-sm text-gray-600">{table.tableName}</p>
                  )}
                </div>
                <Badge variant="default">Aberta</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Aberta em:</p>
                <p className="text-sm font-medium">{formatDate(table.openedAt)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Itens:</p>
                <p className="text-sm font-medium">{table.Items.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total:</p>
                <p className="text-lg font-bold text-green-600">
                  {formatCurrency(table.currentTotal)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => openTable(table)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Ver
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1"
                  onClick={() => openCloseDialog(table)}
                  disabled={table.Items.length === 0}
                >
                  <DollarSign className="h-4 w-4 mr-1" />
                  Fechar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {tables.filter((t) => t.status === "OCCUPIED").length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <TableIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">Nenhuma mesa aberta</p>
            <p className="text-sm text-gray-500 mt-1">
              Clique em "Nova Mesa" para começar
            </p>
          </CardContent>
        </Card>
      )}

      {/* Dialog: Ver Mesa */}
      <Dialog open={showViewTableDialog} onOpenChange={setShowViewTableDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Mesa {selectedTable?.tableNumber}{" "}
              {selectedTable?.tableName && `- ${selectedTable.tableName}`}
            </DialogTitle>
          </DialogHeader>
          {selectedTable && (
            <div className="space-y-4 pt-4">
              {/* Adicionar Produto */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Adicionar Produto</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>Produto</Label>
                    <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o produto" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} - {formatCurrency(product.unitPrice)} (Est: {product.currentStock})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Quantidade</Label>
                    <Input
                      type="number"
                      value={productQuantity}
                      onChange={(e) => setProductQuantity(parseInt(e.target.value) || 1)}
                      min="1"
                    />
                  </div>
                  <Button className="w-full" onClick={handleAddProductToTable}>
                    Adicionar
                  </Button>
                </CardContent>
              </Card>

              {/* Itens da Mesa */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Itens da Mesa</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedTable.Items.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">Nenhum item adicionado</p>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {selectedTable.Items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2 border rounded"
                        >
                          <div>
                            <p className="font-medium">{item.productName}</p>
                            <p className="text-sm text-gray-600">
                              {item.quantity}x {formatCurrency(item.unitPrice)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-green-600">
                              {formatCurrency(item.totalPrice)}
                            </p>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRemoveItemFromTable(item.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total:</span>
                      <span className="text-green-600">
                        {formatCurrency(selectedTable.currentTotal)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Fechar Mesa */}
      <Dialog open={showCloseTableDialog} onOpenChange={setShowCloseTableDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fechar Mesa {selectedTable?.tableNumber}</DialogTitle>
          </DialogHeader>
          {selectedTable && (
            <div className="space-y-4 pt-4">
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

              <div className="space-y-2 pt-4 border-t">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-semibold">
                    {formatCurrency(selectedTable.currentTotal)}
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
                    {formatCurrency(selectedTable.currentTotal - discount)}
                  </span>
                </div>
              </div>

              <Button className="w-full" size="lg" onClick={handleCloseTable}>
                <DollarSign className="h-4 w-4 mr-2" />
                Fechar Mesa e Finalizar Venda
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
