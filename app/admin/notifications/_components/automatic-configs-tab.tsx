
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Edit, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

interface AutoConfig {
  id: string;
  name: string;
  description: string | null;
  eventType: string;
  daysOffset: number;
  isActive: boolean;
  title: string;
  message: string;
  targetRole: string;
  category: string;
}

const eventTypeLabels: Record<string, string> = {
  BOLETO_DUE: "Boleto no Vencimento",
  BOLETO_OVERDUE: "Boleto Vencido",
  ORDER_CONFIRMED: "Pedido Confirmado",
  NEW_COMMISSION: "Nova Comissão",
  INACTIVE_CUSTOMER: "Cliente Inativo",
};

const categoryLabels: Record<string, string> = {
  ORDER: "Pedido",
  BOLETO: "Boleto",
  COMMISSION: "Comissão",
  CUSTOMER_ALERT: "Alerta de Cliente",
  GENERAL: "Geral",
};

export default function AutomaticConfigsTab() {
  const [configs, setConfigs] = useState<AutoConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<AutoConfig | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    eventType: "BOLETO_DUE",
    daysOffset: 0,
    isActive: true,
    title: "",
    message: "",
    targetRole: "CUSTOMER",
    category: "GENERAL",
  });

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const response = await fetch("/api/admin/notifications/configs");
      if (!response.ok) throw new Error();
      const data = await response.json();
      setConfigs(data);
    } catch (error) {
      toast.error("Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const config = configs.find((c) => c.id === id);
      if (!config) return;

      const response = await fetch(`/api/admin/notifications/configs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...config, isActive }),
      });

      if (!response.ok) throw new Error();

      setConfigs((prev) =>
        prev.map((c) => (c.id === id ? { ...c, isActive } : c))
      );
      toast.success(isActive ? "Configuração ativada" : "Configuração desativada");
    } catch (error) {
      toast.error("Erro ao atualizar configuração");
    }
  };

  const handleEdit = (config: AutoConfig) => {
    setSelectedConfig(config);
    setFormData({
      name: config.name,
      description: config.description || "",
      eventType: config.eventType,
      daysOffset: config.daysOffset,
      isActive: config.isActive,
      title: config.title,
      message: config.message,
      targetRole: config.targetRole,
      category: config.category,
    });
    setEditDialogOpen(true);
  };

  const handleCreate = () => {
    setFormData({
      name: "",
      description: "",
      eventType: "BOLETO_DUE",
      daysOffset: 0,
      isActive: true,
      title: "",
      message: "",
      targetRole: "CUSTOMER",
      category: "GENERAL",
    });
    setCreateDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedConfig) return;

    try {
      const response = await fetch(`/api/admin/notifications/configs/${selectedConfig.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error();

      toast.success("Configuração atualizada com sucesso!");
      fetchConfigs();
      setEditDialogOpen(false);
    } catch (error) {
      toast.error("Erro ao atualizar configuração");
    }
  };

  const handleSaveCreate = async () => {
    try {
      const response = await fetch("/api/admin/notifications/configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error();

      toast.success("Configuração criada com sucesso!");
      fetchConfigs();
      setCreateDialogOpen(false);
    } catch (error) {
      toast.error("Erro ao criar configuração");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja deletar esta configuração?")) return;

    try {
      const response = await fetch(`/api/admin/notifications/configs/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error();

      toast.success("Configuração deletada!");
      fetchConfigs();
    } catch (error) {
      toast.error("Erro ao deletar configuração");
    }
  };

  if (loading) {
    return <div>Carregando...</div>;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Configurações de Notificações Automáticas</CardTitle>
              <CardDescription>
                Gerencie as notificações automáticas do sistema
              </CardDescription>
            </div>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Configuração
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Dias</TableHead>
                <TableHead>Destinatário</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configs.map((config) => (
                <TableRow key={config.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{config.name}</p>
                      {config.description && (
                        <p className="text-sm text-muted-foreground">
                          {config.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {eventTypeLabels[config.eventType] || config.eventType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {config.daysOffset === 0
                      ? "No dia"
                      : config.daysOffset > 0
                      ? `${config.daysOffset}d depois`
                      : `${Math.abs(config.daysOffset)}d antes`}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={
                        config.targetRole === "CUSTOMER"
                          ? "bg-blue-500 text-white"
                          : "bg-green-500 text-white"
                      }
                    >
                      {config.targetRole === "CUSTOMER" ? "Cliente" : "Vendedor"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={config.isActive}
                      onCheckedChange={(checked) => handleToggleActive(config.id, checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(config)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(config.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog de Edição */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Configuração</DialogTitle>
            <DialogDescription>
              Modifique as configurações da notificação automática
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Dias (offset)</Label>
                <Input
                  type="number"
                  value={formData.daysOffset}
                  onChange={(e) => setFormData({ ...formData, daysOffset: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Título da Notificação</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Criação */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova Configuração</DialogTitle>
            <DialogDescription>
              Crie uma nova notificação automática
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome da configuração"
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo de Evento</Label>
                <Select
                  value={formData.eventType}
                  onValueChange={(v) => setFormData({ ...formData, eventType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BOLETO_DUE">Boleto no Vencimento</SelectItem>
                    <SelectItem value="BOLETO_OVERDUE">Boleto Vencido</SelectItem>
                    <SelectItem value="ORDER_CONFIRMED">Pedido Confirmado</SelectItem>
                    <SelectItem value="NEW_COMMISSION">Nova Comissão</SelectItem>
                    <SelectItem value="INACTIVE_CUSTOMER">Cliente Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Dias (offset)</Label>
                <Input
                  type="number"
                  value={formData.daysOffset}
                  onChange={(e) => setFormData({ ...formData, daysOffset: parseInt(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <Label>Destinatário</Label>
                <Select
                  value={formData.targetRole}
                  onValueChange={(v) => setFormData({ ...formData, targetRole: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CUSTOMER">Cliente</SelectItem>
                    <SelectItem value="SELLER">Vendedor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData({ ...formData, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ORDER">Pedido</SelectItem>
                    <SelectItem value="BOLETO">Boleto</SelectItem>
                    <SelectItem value="COMMISSION">Comissão</SelectItem>
                    <SelectItem value="CUSTOMER_ALERT">Alerta Cliente</SelectItem>
                    <SelectItem value="GENERAL">Geral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição da notificação"
              />
            </div>

            <div className="space-y-2">
              <Label>Título da Notificação</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: 💳 Boleto Vence Hoje"
              />
            </div>

            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                rows={4}
                placeholder="Mensagem que será enviada ao destinatário"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveCreate}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
