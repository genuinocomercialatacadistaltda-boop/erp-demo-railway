
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Send, Users, UserCheck, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface Customer {
  id: string;
  name: string;
  email: string;
}

interface Seller {
  id: string;
  name: string;
  email: string;
}

const categoryOptions = {
  CUSTOMER: [
    { value: "ORDER", label: "Pedido" },
    { value: "BOLETO", label: "Boleto" },
    { value: "PROMOTION", label: "Promoção" },
    { value: "COUPON", label: "Cupom de Desconto" },
    { value: "GENERAL", label: "Geral" },
  ],
  SELLER: [
    { value: "COMMISSION", label: "Comissão" },
    { value: "CUSTOMER_ALERT", label: "Alerta de Cliente" },
    { value: "PRODUCT_ALERT", label: "Alerta de Produto" },
    { value: "COUPON", label: "Cupom de Desconto" },
    { value: "GENERAL", label: "Geral" },
  ],
};

export default function NotificationsManagement() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sending, setSending] = useState(false);

  // Form state
  const [targetRole, setTargetRole] = useState<"CUSTOMER" | "SELLER">("CUSTOMER");
  const [targetType, setTargetType] = useState<"all" | "specific">("all");
  const [targetUserId, setTargetUserId] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchCustomers();
    fetchSellers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const response = await fetch("/api/admin/customers");
      if (!response.ok) throw new Error();
      const data = await response.json();
      setCustomers(data);
    } catch (error) {
      console.error("Erro ao buscar clientes:", error);
    }
  };

  const fetchSellers = async () => {
    try {
      const response = await fetch("/api/admin/sellers");
      if (!response.ok) throw new Error();
      const data = await response.json();
      setSellers(data);
    } catch (error) {
      console.error("Erro ao buscar vendedores:", error);
    }
  };

  const handleSendNotification = async () => {
    if (!title || !message) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setSending(true);

    try {
      const response = await fetch("/api/admin/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetRole,
          targetUserId: targetType === "specific" ? targetUserId : null,
          category,
          title,
          message,
        }),
      });

      if (!response.ok) throw new Error();

      const result = await response.json();
      toast.success(`Notificação enviada para ${result.count} usuário(s)!`);
      
      // Reset form
      setTitle("");
      setMessage("");
      setCategory("GENERAL");
      setTargetType("all");
      setTargetUserId("");
      setSendDialogOpen(false);
    } catch (error) {
      toast.error("Erro ao enviar notificação");
      console.error(error);
    } finally {
      setSending(false);
    }
  };

  const notificationTemplates = {
    CUSTOMER: {
      PROMOTION: {
        title: "🎉 Promoção Especial!",
        message: "Aproveite nossa promoção exclusiva! Confira os produtos em destaque.",
      },
      COUPON: {
        title: "🎁 Cupom de Desconto",
        message: "Use o cupom DESCONTO10 e ganhe 10% de desconto na sua próxima compra!",
      },
      ORDER: {
        title: "📦 Atualização do Pedido",
        message: "Seu pedido foi atualizado. Confira os detalhes no painel.",
      },
      BOLETO: {
        title: "💳 Lembrete de Pagamento",
        message: "Você tem um boleto com vencimento próximo. Não esqueça de pagar!",
      },
    },
    SELLER: {
      COMMISSION: {
        title: "💰 Nova Comissão Disponível",
        message: "Você tem uma nova comissão disponível para saque!",
      },
      CUSTOMER_ALERT: {
        title: "⚠️ Cliente Inativo",
        message: "Cliente sem comprar há mais de 7 dias. Entre em contato!",
      },
      PRODUCT_ALERT: {
        title: "🏷️ Desconto em Produto",
        message: "Produto com desconto especial disponível para seus clientes!",
      },
    },
  };

  const applyTemplate = (cat: string) => {
    const templates = notificationTemplates[targetRole];
    const template = templates[cat as keyof typeof templates] as { title: string; message: string } | undefined;
    if (template) {
      setTitle(template.title);
      setMessage(template.message);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Stats Cards */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customers.length}</div>
            <p className="text-xs text-muted-foreground">
              Clientes ativos no sistema
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Vendedores</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sellers.length}</div>
            <p className="text-xs text-muted-foreground">
              Vendedores ativos no sistema
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Enviar Notificação</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              onClick={() => setSendDialogOpen(true)}
            >
              <Send className="h-4 w-4 mr-2" />
              Nova Notificação
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Tipos de Notificações Automáticas */}
      <Card>
        <CardHeader>
          <CardTitle>Notificações Automáticas Configuradas</CardTitle>
          <CardDescription>
            Sistema gerencia automaticamente estas notificações
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="customers">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="customers">Clientes</TabsTrigger>
              <TabsTrigger value="sellers">Vendedores</TabsTrigger>
            </TabsList>

            <TabsContent value="customers" className="space-y-4 mt-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <Badge variant="secondary" className="bg-green-500 text-white">AUTO</Badge>
                  <div className="flex-1">
                    <p className="font-medium">Pedido Finalizado</p>
                    <p className="text-sm text-muted-foreground">
                      Quando o status do pedido muda para "Finalizado"
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <Badge variant="secondary" className="bg-green-500 text-white">AUTO</Badge>
                  <div className="flex-1">
                    <p className="font-medium">Pedido Entregue</p>
                    <p className="text-sm text-muted-foreground">
                      Quando o status do pedido muda para "Entregue"
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <Badge variant="secondary" className="bg-amber-500 text-white">AUTO</Badge>
                  <div className="flex-1">
                    <p className="font-medium">Vencimento de Boleto</p>
                    <p className="text-sm text-muted-foreground">
                      3 dias antes do vencimento do boleto
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <Badge variant="secondary" className="bg-red-500 text-white">AUTO</Badge>
                  <div className="flex-1">
                    <p className="font-medium">Boleto Vencido</p>
                    <p className="text-sm text-muted-foreground">
                      Quando o boleto passa da data de vencimento
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="sellers" className="space-y-4 mt-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <Badge variant="secondary" className="bg-green-500 text-white">AUTO</Badge>
                  <div className="flex-1">
                    <p className="font-medium">Comissão Disponível</p>
                    <p className="text-sm text-muted-foreground">
                      Quando uma nova comissão é liberada
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <Badge variant="secondary" className="bg-amber-500 text-white">AUTO</Badge>
                  <div className="flex-1">
                    <p className="font-medium">Cliente Inativo</p>
                    <p className="text-sm text-muted-foreground">
                      Cliente sem comprar há mais de 7 dias
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialog de envio */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Enviar Notificação Manual</DialogTitle>
            <DialogDescription>
              Escolha o destinatário e escreva sua mensagem
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Target Role */}
            <div className="space-y-2">
              <Label>Enviar para</Label>
              <Select value={targetRole} onValueChange={(v) => setTargetRole(v as "CUSTOMER" | "SELLER")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CUSTOMER">Clientes</SelectItem>
                  <SelectItem value="SELLER">Vendedores</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Target Type */}
            <div className="space-y-2">
              <Label>Tipo de envio</Label>
              <Select value={targetType} onValueChange={(v) => setTargetType(v as "all" | "specific")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="specific">Específico</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Specific User */}
            {targetType === "specific" && (
              <div className="space-y-2">
                <Label>Selecionar {targetRole === "CUSTOMER" ? "Cliente" : "Vendedor"}</Label>
                <Select value={targetUserId} onValueChange={setTargetUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha..." />
                  </SelectTrigger>
                  <SelectContent>
                    {targetRole === "CUSTOMER"
                      ? customers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} - {c.email}
                          </SelectItem>
                        ))
                      : sellers.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} - {s.email}
                          </SelectItem>
                        ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Category */}
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={(v) => { setCategory(v); applyTemplate(v); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions[targetRole].map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                placeholder="Título da notificação..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea
                placeholder="Escreva a mensagem..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSendNotification} disabled={sending}>
              {sending ? "Enviando..." : "Enviar Notificação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
