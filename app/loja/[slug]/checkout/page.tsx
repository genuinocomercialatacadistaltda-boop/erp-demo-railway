"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart,
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  Lock,
  CheckCircle,
  Star,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PixPaymentModal } from "@/components/pix-payment-modal";

interface CartItem {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  imageUrl: string | null;
}

interface ClientCustomer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  pointsBalance: number;
  pointsMultiplier: number;
  creditLimit: number;
  currentDebt: number;
}

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<ClientCustomer | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [orderNotes, setOrderNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("DINHEIRO");
  const [showPixModal, setShowPixModal] = useState(false);

  // Formulário de Login
  const [loginData, setLoginData] = useState({
    phone: "",
    password: "",
  });

  // Formulário de Cadastro
  const [registerData, setRegisterData] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    document: "",
    address: "",
  });

  useEffect(() => {
    // Carregar carrinho do localStorage
    const savedCart = localStorage.getItem(`cart_${slug}`);
    if (savedCart) {
      const parsedCart = JSON.parse(savedCart);
      if (parsedCart.length === 0) {
        toast.error("Carrinho vazio");
        router.push(`/loja/${slug}`);
        return;
      }
      setCart(parsedCart);
    } else {
      toast.error("Carrinho vazio");
      router.push(`/loja/${slug}`);
    }

    // Verificar se já está logado
    const savedCustomer = localStorage.getItem(`customer_${slug}`);
    if (savedCustomer) {
      setCustomer(JSON.parse(savedCustomer));
    }
  }, [slug, router]);

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!loginData.phone || !loginData.password) {
      toast.error("Preencha todos os campos");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/public/store/${slug}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao fazer login");
      }

      setCustomer(data.customer);
      localStorage.setItem(`customer_${slug}`, JSON.stringify(data.customer));
      toast.success("✅ Login realizado com sucesso!");
    } catch (error: any) {
      console.error("[LOGIN_ERROR]", error);
      toast.error(error.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!registerData.name || !registerData.phone || !registerData.password) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/public/store/${slug}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registerData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao criar conta");
      }

      setCustomer(data.customer);
      localStorage.setItem(`customer_${slug}`, JSON.stringify(data.customer));
      toast.success("✅ Conta criada com sucesso!");
    } catch (error: any) {
      console.error("[REGISTER_ERROR]", error);
      toast.error(error.message || "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!customer) {
      toast.error("Faça login ou cadastre-se para continuar");
      return;
    }

    // Se é PIX, abrir modal de PIX primeiro
    if (paymentMethod === "PIX") {
      setShowPixModal(true);
      return;
    }

    // Continuar com criação do pedido normalmente
    await createOrder();
  };

  const handlePixPaymentConfirmed = async (confirmedPixChargeId: string, netAmount: number) => {
    setShowPixModal(false);
    await createOrder(confirmedPixChargeId);
  };

  const createOrder = async (confirmedPixChargeId?: string) => {
    try {
      setLoading(true);
      toast.loading("Processando pedido...", { id: "order" });

      const orderData: any = {
        clientCustomerId: customer!.id,
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        notes: orderNotes,
        paymentMethod,
      };

      // 💳 Adicionar PIX charge ID se pagamento foi via PIX
      if (confirmedPixChargeId) {
        orderData.pixChargeId = confirmedPixChargeId;
        orderData.pixPaid = true;
      }

      const response = await fetch(`/api/public/store/${slug}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao criar pedido");
      }

      // Limpar carrinho
      localStorage.removeItem(`cart_${slug}`);

      toast.success(
        `Pedido realizado! Você ganhou ${data.order.pointsEarned} pontos!`,
        { id: "order", duration: 5000 }
      );

      // Redirecionar para página de sucesso
      router.push(`/loja/${slug}/pedido/${data.order.id}`);
    } catch (error: any) {
      console.error("[ORDER_ERROR]", error);
      toast.error(error.message || "Erro ao criar pedido", { id: "order" });
    } finally {
      setLoading(false);
    }
  };

  const pointsToEarn = Math.floor(getCartTotal() * (customer?.pointsMultiplier || 1.0));

  return (
    <>
    {/* Modal de Pagamento PIX */}
    <PixPaymentModal
      isOpen={showPixModal}
      onClose={() => setShowPixModal(false)}
      onPaymentConfirmed={handlePixPaymentConfirmed}
      amount={getCartTotal()}
      description={`Pedido Loja - ${customer?.name || 'Cliente'}`}
      customerId={customer?.id}
      customerName={customer?.name}
      createdBy="loja-checkout"
    />
    
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/loja/${slug}`)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <h1 className="text-xl font-bold text-slate-900">
              Finalizar Pedido
            </h1>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Identificação do Cliente */}
          <div className="lg:col-span-2 space-y-6">
            {!customer ? (
              <Card className="p-6">
                <h2 className="text-lg font-bold text-slate-900 mb-4">
                  Identificação
                </h2>

                {/* Tabs Login/Cadastro */}
                <div className="flex gap-2 mb-6">
                  <Button
                    variant={mode === "login" ? "default" : "outline"}
                    onClick={() => setMode("login")}
                    className="flex-1"
                  >
                    Login
                  </Button>
                  <Button
                    variant={mode === "register" ? "default" : "outline"}
                    onClick={() => setMode("register")}
                    className="flex-1"
                  >
                    Criar Conta
                  </Button>
                </div>

                {/* Formulário de Login */}
                {mode === "login" && (
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        <Phone className="h-4 w-4 inline mr-1" />
                        Telefone *
                      </label>
                      <Input
                        type="tel"
                        placeholder="(99) 99999-9999"
                        value={loginData.phone}
                        onChange={(e) =>
                          setLoginData({ ...loginData, phone: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        <Lock className="h-4 w-4 inline mr-1" />
                        Senha *
                      </label>
                      <Input
                        type="password"
                        placeholder="Digite sua senha"
                        value={loginData.password}
                        onChange={(e) =>
                          setLoginData({
                            ...loginData,
                            password: e.target.value,
                          })
                        }
                        required
                      />
                    </div>

                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Entrando..." : "Entrar"}
                    </Button>
                  </form>
                )}

                {/* Formulário de Cadastro */}
                {mode === "register" && (
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        <User className="h-4 w-4 inline mr-1" />
                        Nome Completo *
                      </label>
                      <Input
                        type="text"
                        placeholder="Seu nome"
                        value={registerData.name}
                        onChange={(e) =>
                          setRegisterData({
                            ...registerData,
                            name: e.target.value,
                          })
                        }
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        <Phone className="h-4 w-4 inline mr-1" />
                        Telefone *
                      </label>
                      <Input
                        type="tel"
                        placeholder="(99) 99999-9999"
                        value={registerData.phone}
                        onChange={(e) =>
                          setRegisterData({
                            ...registerData,
                            phone: e.target.value,
                          })
                        }
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        <Mail className="h-4 w-4 inline mr-1" />
                        E-mail (opcional)
                      </label>
                      <Input
                        type="email"
                        placeholder="seu@email.com"
                        value={registerData.email}
                        onChange={(e) =>
                          setRegisterData({
                            ...registerData,
                            email: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        <FileText className="h-4 w-4 inline mr-1" />
                        CPF (opcional)
                      </label>
                      <Input
                        type="text"
                        placeholder="000.000.000-00"
                        value={registerData.document}
                        onChange={(e) =>
                          setRegisterData({
                            ...registerData,
                            document: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        <MapPin className="h-4 w-4 inline mr-1" />
                        Endereço (opcional)
                      </label>
                      <Input
                        type="text"
                        placeholder="Rua, número, bairro"
                        value={registerData.address}
                        onChange={(e) =>
                          setRegisterData({
                            ...registerData,
                            address: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        <Lock className="h-4 w-4 inline mr-1" />
                        Senha *
                      </label>
                      <Input
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        value={registerData.password}
                        onChange={(e) =>
                          setRegisterData({
                            ...registerData,
                            password: e.target.value,
                          })
                        }
                        required
                        minLength={6}
                      />
                    </div>

                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Criando conta..." : "Criar Conta e Continuar"}
                    </Button>
                  </form>
                )}
              </Card>
            ) : (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-slate-900">
                    Informações do Pedido
                  </h2>
                  <Badge className="bg-green-100 text-green-700">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Logado
                  </Badge>
                </div>

                <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm font-medium text-slate-900">
                    {customer.name}
                  </p>
                  <p className="text-sm text-slate-600">{customer.phone}</p>
                  {customer.email && (
                    <p className="text-sm text-slate-600">{customer.email}</p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <Badge className="bg-yellow-100 text-yellow-700">
                      <Star className="h-3 w-3 mr-1" />
                      {customer.pointsBalance} pontos
                    </Badge>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Método de Pagamento
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="DINHEIRO">Dinheiro</option>
                      <option value="PIX">PIX</option>
                      <option value="CARTAO">Cartão</option>
                      <option value="FIADO">Fiado</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Observações (opcional)
                    </label>
                    <Textarea
                      placeholder="Alguma observação sobre o pedido?"
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>

                <Button
                  onClick={() => {
                    setCustomer(null);
                    localStorage.removeItem(`customer_${slug}`);
                  }}
                  variant="outline"
                  className="w-full mt-4"
                >
                  Sair
                </Button>
              </Card>
            )}
          </div>

          {/* Resumo do Pedido */}
          <div>
            <Card className="p-6 sticky top-4">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Resumo do Pedido
              </h3>

              <div className="space-y-3 mb-4">
                {cart.map((item) => (
                  <div
                    key={item.productId}
                    className="flex justify-between items-start pb-3 border-b border-slate-200"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm text-slate-900">
                        {item.name}
                      </p>
                      <p className="text-xs text-slate-600">
                        {item.quantity}x {formatCurrency(item.unitPrice)}
                      </p>
                    </div>
                    <p className="font-medium text-slate-900">
                      {formatCurrency(item.unitPrice * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-200 pt-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-900">Total:</span>
                  <span className="text-xl font-bold text-blue-600">
                    {formatCurrency(getCartTotal())}
                  </span>
                </div>

                {customer && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Pontos a ganhar:</span>
                    <Badge className="bg-yellow-100 text-yellow-700">
                      <Star className="h-3 w-3 mr-1" />
                      +{pointsToEarn} pontos
                    </Badge>
                  </div>
                )}
              </div>

              <Button
                onClick={handlePlaceOrder}
                className="w-full mt-4"
                size="lg"
                disabled={!customer || loading}
              >
                {loading ? "Processando..." : "Finalizar Pedido"}
              </Button>

              {!customer && (
                <p className="text-xs text-center text-slate-600 mt-2">
                  Faça login ou cadastre-se para continuar
                </p>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
