
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, Trash2, ShoppingCart, DollarSign, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface Product {
  id: string;
  name: string;
  category: string;
  unitPrice: number;
  currentStock: number;
}

interface CartItem extends Product {
  quantity: number;
  totalPrice: number;
}

interface BankAccount {
  id: string;
  name: string;
  balance: number;
}

interface CustomerForPayment {
  id: string;
  name: string;
  phone: string;
}

export default function VendaNormalTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [customers, setCustomers] = useState<CustomerForPayment[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Campos do formulário
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(""); // Cliente selecionado (sempre obrigatório)
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [bankAccountId, setBankAccountId] = useState("");
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED'>('FIXED');
  const [notes, setNotes] = useState("");

  // Controle de pagamento
  const [isPaid, setIsPaid] = useState(true);
  const [linkedCustomerId, setLinkedCustomerId] = useState<string>("");

  // Campos para pagamento dividido
  const [splitPayment, setSplitPayment] = useState(false);
  const [cashAmount, setCashAmount] = useState(0);
  const [pixAmount, setPixAmount] = useState(0);
  const [cardAmount, setCardAmount] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [productsRes, accountsRes, customersRes] = await Promise.all([
        fetch("/api/client-management/products"),
        fetch("/api/client-management/bank-accounts"),
        fetch("/api/client-management/customers-for-payment"),
      ]);

      const productsData = await productsRes.json();
      const accountsData = await accountsRes.json();
      const customersData = await customersRes.json();

      if (productsData.success) {
        setProducts(productsData.data);
      }

      if (accountsData.success) {
        setBankAccounts(accountsData.data);
        if (accountsData.data.length > 0) {
          setBankAccountId(accountsData.data[0].id);
        }
      }

      if (customersData.success) {
        console.log("🔍 [PDV] Clientes carregados:", customersData.data);
        console.log("🔍 [PDV] Número de clientes:", customersData.data?.length || 0);
        setCustomers(customersData.data || []);
        
        // Selecionar "Consumidor Final" automaticamente se existir
        const consumidorFinal = customersData.data?.find(
          (c: CustomerForPayment) => c.name === "Consumidor Final"
        );
        if (consumidorFinal) {
          setSelectedCustomerId(consumidorFinal.id);
          setCustomerName(consumidorFinal.name);
          console.log("✅ [PDV] Consumidor Final selecionado automaticamente:", consumidorFinal.id);
        } else if (customersData.data && customersData.data.length > 0) {
          // Se não tiver Consumidor Final, selecionar o primeiro cliente
          setSelectedCustomerId(customersData.data[0].id);
          setCustomerName(customersData.data[0].name);
          console.log("✅ [PDV] Primeiro cliente selecionado:", customersData.data[0].id);
        }
      } else {
        console.error("❌ [PDV] Erro ao carregar clientes:", customersData.error);
        toast.error("Erro ao carregar clientes");
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product: Product) => {
    const existingItem = cart.find((item) => item.id === product.id);

    if (existingItem) {
      if (existingItem.quantity >= product.currentStock) {
        toast.error("Estoque insuficiente");
        return;
      }
      
      setCart(
        cart.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                totalPrice: (item.quantity + 1) * item.unitPrice,
              }
            : item
        )
      );
    } else {
      if (product.currentStock < 1) {
        toast.error("Produto sem estoque");
        return;
      }
      
      setCart([
        ...cart,
        {
          ...product,
          quantity: 1,
          totalPrice: product.unitPrice,
        },
      ]);
    }
    
    toast.success(`${product.name} adicionado`);
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    const product = products.find((p) => p.id === productId);
    
    if (!product) return;

    if (newQuantity > product.currentStock) {
      toast.error("Estoque insuficiente");
      return;
    }

    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart(
      cart.map((item) =>
        item.id === productId
          ? {
              ...item,
              quantity: newQuantity,
              totalPrice: newQuantity * item.unitPrice,
            }
          : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((item) => item.id !== productId));
    toast.success("Item removido");
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
    setNotes("");
    setSplitPayment(false);
    setCashAmount(0);
    setPixAmount(0);
    setCardAmount(0);
    setIsPaid(true);
    setLinkedCustomerId("");
    
    // Manter o Consumidor Final selecionado
    const consumidorFinal = customers.find(c => c.name === "Consumidor Final");
    if (consumidorFinal) {
      setSelectedCustomerId(consumidorFinal.id);
      setCustomerName(consumidorFinal.name);
    } else if (customers.length > 0) {
      setSelectedCustomerId(customers[0].id);
      setCustomerName(customers[0].name);
    }
    
    toast.success("Carrinho limpo");
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + item.totalPrice, 0);
  };

  const calculateDiscountValue = () => {
    const subtotal = calculateSubtotal();
    if (discount > 0) {
      if (discountType === 'PERCENTAGE') {
        return subtotal * (discount / 100);
      } else {
        return discount;
      }
    }
    return 0;
  };

  const calculateTotal = () => {
    return calculateSubtotal() - calculateDiscountValue();
  };

  const handleSubmit = async () => {
    if (cart.length === 0) {
      toast.error("Adicione produtos ao carrinho");
      return;
    }

    if (!selectedCustomerId) {
      toast.error("Selecione um cliente");
      return;
    }

    if (!bankAccountId) {
      toast.error("Selecione uma conta bancária");
      return;
    }

    // Validar se não pago, deve ter cliente vinculado
    if (!isPaid && !linkedCustomerId) {
      toast.error("Para vendas não pagas, selecione um cliente");
      return;
    }

    // Validar pagamento dividido
    if (splitPayment) {
      const totalPaid = cashAmount + pixAmount + cardAmount;
      const total = calculateTotal();
      
      if (Math.abs(totalPaid - total) > 0.01) {
        toast.error("O valor total do pagamento não corresponde ao total da venda");
        return;
      }
    }

    try {
      setSubmitting(true);

      const payload = {
        customerName,
        items: cart.map((item) => ({
          productId: item.id,
          productName: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        })),
        subtotal: calculateSubtotal(),
        discount,
        total: calculateTotal(),
        paymentMethod,
        paymentStatus: isPaid ? "PAID" : "PENDING",
        isPaid,
        linkedCustomerId: !isPaid ? linkedCustomerId : null,
        bankAccountId,
        splitPayment,
        cashAmount: splitPayment ? cashAmount : 0,
        pixAmount: splitPayment ? pixAmount : 0,
        cardAmount: splitPayment ? cardAmount : 0,
        notes,
      };

      const res = await fetch("/api/client-management/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Venda registrada com sucesso!");
        
        // Perguntar se deseja imprimir cupom
        const printCupom = confirm(
          "Venda registrada! Deseja imprimir o cupom agora?"
        );
        
        if (printCupom && data.data?.id) {
          // Abrir página de impressão em nova aba
          window.open(
            `/customer/gestao/vendas/${data.data.id}/print`,
            "_blank"
          );
        }
        
        clearCart();
        loadData(); // Recarregar produtos para atualizar estoque
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

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
      {/* Lista de Produtos */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Produtos</CardTitle>
            <Input
              placeholder="Buscar produto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto">
              {filteredProducts.map((product) => (
                <Card
                  key={product.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => addToCart(product)}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold">{product.name}</h3>
                        <Badge variant="outline" className="mt-1">
                          {product.category}
                        </Badge>
                      </div>
                      <p className="text-lg font-bold text-green-600">
                        {formatCurrency(product.unitPrice)}
                      </p>
                    </div>
                    <p className="text-sm text-gray-600">
                      Estoque: {product.currentStock}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Carrinho e Checkout */}
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Carrinho ({cart.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Itens do Carrinho */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 border rounded"
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-xs text-gray-600">
                      {formatCurrency(item.unitPrice)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center">{item.quantity}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => removeFromCart(item.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {cart.length > 0 && (
              <>
                {/* Campos do Formulário */}
                <div className="space-y-3 pt-4 border-t">
                  <div>
                    <Label className="font-semibold">Cliente *</Label>
                    <Select 
                      value={selectedCustomerId} 
                      onValueChange={(value) => {
                        setSelectedCustomerId(value);
                        const selectedCustomer = customers.find(c => c.id === value);
                        if (selectedCustomer) {
                          setCustomerName(selectedCustomer.name);
                          console.log("🔍 [PDV] Cliente alterado:", selectedCustomer.name);
                        }
                      }}
                    >
                      <SelectTrigger className="border-blue-300">
                        <SelectValue placeholder="Selecione o cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.length > 0 ? (
                          customers.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.name}
                              {customer.name === "Consumidor Final" && " 🌟"}
                              {customer.phone && customer.phone !== "0000000000" && ` - ${customer.phone}`}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-customers" disabled>
                            Nenhum cliente cadastrado
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {selectedCustomerId && (
                      <p className="text-xs text-gray-600 mt-1">
                        ✓ Cliente selecionado: <span className="font-medium">{customerName}</span>
                      </p>
                    )}
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

                  <div className="space-y-2">
                    <Label>Desconto</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        value={discount}
                        onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                        placeholder={discountType === 'PERCENTAGE' ? '0.00' : '0.00'}
                        className="flex-1"
                      />
                      <Select value={discountType} onValueChange={(value: 'PERCENTAGE' | 'FIXED') => setDiscountType(value)}>
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FIXED">R$</SelectItem>
                          <SelectItem value="PERCENTAGE">%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {discountType === 'PERCENTAGE' ? 'Desconto em porcentagem' : 'Desconto em reais'}
                    </p>
                  </div>

                  <div>
                    <Label>Observações</Label>
                    <Input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Observações da venda"
                    />
                  </div>

                  {/* Controle de Pagamento */}
                  <div className="space-y-3 pt-3 border-t bg-blue-50 p-3 rounded-md">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="isPaid"
                        checked={isPaid}
                        onCheckedChange={(checked) => {
                          setIsPaid(checked as boolean);
                          if (checked) {
                            setLinkedCustomerId("");
                          }
                        }}
                      />
                      <Label htmlFor="isPaid" className="cursor-pointer font-semibold">
                        ✅ Já foi pago agora
                      </Label>
                    </div>

                    {!isPaid && (
                      <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                        <Label className="text-red-600 font-medium">
                          Cliente que vai pagar depois *
                        </Label>
                        <Select 
                          value={linkedCustomerId} 
                          onValueChange={(value) => {
                            console.log("🔍 [PDV] Cliente selecionado:", value);
                            setLinkedCustomerId(value);
                          }}
                        >
                          <SelectTrigger className="mt-1 border-red-300">
                            <SelectValue placeholder="Selecione o cliente" />
                          </SelectTrigger>
                          <SelectContent>
                            {customers.length > 0 ? (
                              customers.map((customer) => (
                                <SelectItem key={customer.id} value={customer.id}>
                                  {customer.name}
                                  {customer.name === "Consumidor Final" && " 🌟"}
                                  {customer.phone && ` - ${customer.phone}`}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="no-customers" disabled>
                                Nenhum cliente cadastrado
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <p className="text-sm text-red-600 mt-1">
                          ⚠️ O valor NÃO será adicionado ao saldo da conta bancária
                        </p>
                      </div>
                    )}
                  </div>
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
                      <span>Desconto{discountType === 'PERCENTAGE' ? ` (${discount}%)` : ''}:</span>
                      <span>-{formatCurrency(calculateDiscountValue())}</span>
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
                    disabled={submitting}
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    {submitting ? "Finalizando..." : "Finalizar Venda"}
                  </Button>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={clearCart}
                    disabled={submitting}
                  >
                    Limpar Carrinho
                  </Button>
                </div>
              </>
            )}

            {cart.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Carrinho vazio</p>
                <p className="text-sm">Adicione produtos para começar</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
