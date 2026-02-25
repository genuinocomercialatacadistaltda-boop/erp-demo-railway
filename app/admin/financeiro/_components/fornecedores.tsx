"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Building2 } from "lucide-react";

interface Supplier {
  id: string;
  name: string;
  companyName?: string;
  document: string;
  documentType: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  bankName?: string;
  bankAgency?: string;
  bankAccount?: string;
  pixKey?: string;
  notes?: string;
  isActive: boolean;
  _count?: {
    Expense: number;
  };
}

export default function Fornecedores() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    companyName: "",
    document: "",
    documentType: "CPF",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    bankName: "",
    bankAgency: "",
    bankAccount: "",
    pixKey: "",
    notes: "",
    isActive: true,
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/financial/suppliers");
      const data = await response.json();
      setSuppliers(data);
    } catch (error) {
      toast.error("Erro ao carregar fornecedores");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = editingSupplier
        ? `/api/financial/suppliers/${editingSupplier.id}`
        : "/api/financial/suppliers";

      const response = await fetch(url, {
        method: editingSupplier ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success(
          editingSupplier
            ? "Fornecedor atualizado com sucesso"
            : "Fornecedor criado com sucesso"
        );
        setShowDialog(false);
        resetForm();
        fetchSuppliers();
      } else {
        const error = await response.json();
        toast.error(error.error || "Erro ao salvar fornecedor");
      }
    } catch (error) {
      toast.error("Erro ao salvar fornecedor");
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      companyName: supplier.companyName || "",
      document: supplier.document,
      documentType: supplier.documentType,
      email: supplier.email || "",
      phone: supplier.phone || "",
      address: supplier.address || "",
      city: supplier.city || "",
      state: supplier.state || "",
      zipCode: supplier.zipCode || "",
      bankName: supplier.bankName || "",
      bankAgency: supplier.bankAgency || "",
      bankAccount: supplier.bankAccount || "",
      pixKey: supplier.pixKey || "",
      notes: supplier.notes || "",
      isActive: supplier.isActive,
    });
    setShowDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja deletar este fornecedor?")) {
      return;
    }

    try {
      const response = await fetch(`/api/financial/suppliers/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Fornecedor deletado com sucesso");
        fetchSuppliers();
      } else {
        const error = await response.json();
        toast.error(error.error || "Erro ao deletar fornecedor");
      }
    } catch (error) {
      toast.error("Erro ao deletar fornecedor");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      companyName: "",
      document: "",
      documentType: "CPF",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      bankName: "",
      bankAgency: "",
      bankAccount: "",
      pixKey: "",
      notes: "",
      isActive: true,
    });
    setEditingSupplier(null);
  };

  const filteredSuppliers = suppliers.filter(
    (supplier) =>
      supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.document.includes(searchTerm) ||
      supplier.companyName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            <CardTitle>Fornecedores</CardTitle>
          </div>
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Fornecedor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingSupplier ? "Editar Fornecedor" : "Novo Fornecedor"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="name">Nome/Razão Social *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="documentType">Tipo de Documento *</Label>
                    <Select
                      value={formData.documentType}
                      onValueChange={(value) =>
                        setFormData({ ...formData, documentType: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CPF">CPF</SelectItem>
                        <SelectItem value="CNPJ">CNPJ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="document">CPF/CNPJ *</Label>
                    <Input
                      id="document"
                      value={formData.document}
                      onChange={(e) =>
                        setFormData({ ...formData, document: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                    />
                  </div>

                  <div className="col-span-2">
                    <Label htmlFor="address">Endereço</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) =>
                        setFormData({ ...formData, address: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor="city">Cidade</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) =>
                        setFormData({ ...formData, city: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor="state">Estado</Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) =>
                        setFormData({ ...formData, state: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor="bankName">Banco</Label>
                    <Input
                      id="bankName"
                      value={formData.bankName}
                      onChange={(e) =>
                        setFormData({ ...formData, bankName: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor="pixKey">Chave PIX</Label>
                    <Input
                      id="pixKey"
                      value={formData.pixKey}
                      onChange={(e) =>
                        setFormData({ ...formData, pixKey: e.target.value })
                      }
                    />
                  </div>

                  <div className="col-span-2">
                    <Label htmlFor="notes">Observações</Label>
                    <Input
                      id="notes"
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowDialog(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">Salvar</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar fornecedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Despesas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredSuppliers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    Nenhum fornecedor encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-medium">
                      {supplier.name}
                    </TableCell>
                    <TableCell>{supplier.document}</TableCell>
                    <TableCell>{supplier.phone || "-"}</TableCell>
                    <TableCell>{supplier.city || "-"}</TableCell>
                    <TableCell>{supplier._count?.Expense || 0}</TableCell>
                    <TableCell>
                      <Badge
                        variant={supplier.isActive ? "default" : "secondary"}
                      >
                        {supplier.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(supplier)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(supplier.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
