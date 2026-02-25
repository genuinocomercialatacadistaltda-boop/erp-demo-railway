"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Tags, Trash2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
  description?: string;
  color?: string;
  isActive: boolean;
  expenseType: string;
  _count?: { Expense: number };
}

export default function CategoriasD() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "#3B82F6",
    expenseType: "OPERATIONAL" // Padrão
  });

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/financial/categories?includeInactive=true");
      if (!res.ok) throw new Error("Erro ao carregar categorias");
      const data = await res.json();
      setCategories(data.categories);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log("🟢 [FRONTEND] Iniciando envio do formulário");
    console.log("🟢 [FRONTEND] formData:", JSON.stringify(formData, null, 2));
    console.log("🟢 [FRONTEND] editing:", editing ? editing.id : "null");
    
    try {
      const url = editing
        ? `/api/financial/categories/${editing.id}`
        : "/api/financial/categories";
      const method = editing ? "PUT" : "POST";

      console.log("🟢 [FRONTEND] URL:", url);
      console.log("🟢 [FRONTEND] Method:", method);

      const payload = { ...formData, isActive: true };
      console.log("🟢 [FRONTEND] Payload completo:", JSON.stringify(payload, null, 2));

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      console.log("🟢 [FRONTEND] Status da resposta:", res.status);
      console.log("🟢 [FRONTEND] Status text:", res.statusText);

      if (!res.ok) {
        const error = await res.json();
        console.error("❌ [FRONTEND] Erro da API:", error);
        throw new Error(error.error || "Erro ao salvar categoria");
      }

      const data = await res.json();
      console.log("✅ [FRONTEND] Categoria salva com sucesso:", data);

      toast.success(`Categoria ${editing ? "atualizada" : "criada"} com sucesso`);
      setShowDialog(false);
      setEditing(null);
      resetForm();
      fetchCategories();
    } catch (err: any) {
      console.error("❌ [FRONTEND] Erro ao enviar:", err);
      toast.error(err.message);
    }
  };

  const seedCategories = async () => {
    try {
      const res = await fetch("/api/financial/categories/seed", { method: "POST" });
      if (!res.ok) throw new Error("Erro ao criar categorias padrão");
      toast.success("Categorias padrão criadas");
      fetchCategories();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const resetForm = () => {
    setFormData({ name: "", description: "", color: "#3B82F6", expenseType: "OPERATIONAL" });
  };

  const handleEdit = (cat: Category) => {
    setEditing(cat);
    setFormData({
      name: cat.name,
      description: cat.description || "",
      color: cat.color || "#3B82F6",
      expenseType: cat.expenseType || "OPERATIONAL"
    });
    setShowDialog(true);
  };

  if (loading) {
    return <div className="space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Tags className="h-6 w-6 text-blue-600" />
          Categorias de Despesas
        </h2>
        <div className="flex gap-2">
          {categories.length === 0 && (
            <Button variant="outline" onClick={seedCategories}>
              Criar Categorias Padrão
            </Button>
          )}
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Categoria
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Descrição</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="expenseType">Tipo de Despesa *</Label>
                  <Select
                    value={formData.expenseType}
                    onValueChange={(value) => setFormData({ ...formData, expenseType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OPERATIONAL">🏢 Despesas Operacionais</SelectItem>
                      <SelectItem value="PRODUCTS">📦 Despesas com Produtos</SelectItem>
                      <SelectItem value="RAW_MATERIALS">🥩 Compras de Matéria Prima</SelectItem>
                      <SelectItem value="INVESTMENT">💰 Investimentos</SelectItem>
                      <SelectItem value="PROLABORE">👔 Pró-labore</SelectItem>
                      <SelectItem value="OTHER">📌 Outros</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.expenseType === "OPERATIONAL" && "Aluguel, salários, marketing, etc."}
                    {formData.expenseType === "PRODUCTS" && "Embalagens, palitos, etiquetas, etc."}
                    {formData.expenseType === "RAW_MATERIALS" && "Carne, frango, queijo, etc."}
                    {formData.expenseType === "INVESTMENT" && "Equipamentos, melhorias, expansão, etc."}
                    {formData.expenseType === "PROLABORE" && "Retirada dos sócios"}
                    {formData.expenseType === "OTHER" && "Outras despesas diversas"}
                  </p>
                </div>
                <div>
                  <Label htmlFor="color">Cor</Label>
                  <Input
                    id="color"
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">{editing ? "Atualizar" : "Criar"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat) => (
          <Card key={cat.id}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }} />
                {cat.name}
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={() => handleEdit(cat)}>
                <Edit className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">{cat.description}</p>
              <div className="mt-2">
                <span className={`text-xs px-2 py-1 rounded ${
                  cat.expenseType === "OPERATIONAL" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" :
                  cat.expenseType === "PRODUCTS" ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" :
                  cat.expenseType === "RAW_MATERIALS" ? "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" :
                  cat.expenseType === "INVESTMENT" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" :
                  cat.expenseType === "PROLABORE" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" :
                  "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                }`}>
                  {cat.expenseType === "OPERATIONAL" && "🏢 Operacional"}
                  {cat.expenseType === "PRODUCTS" && "📦 Produtos"}
                  {cat.expenseType === "RAW_MATERIALS" && "🥩 Matéria Prima"}
                  {cat.expenseType === "INVESTMENT" && "💰 Investimentos"}
                  {cat.expenseType === "PROLABORE" && "👔 Pró-labore"}
                  {cat.expenseType === "OTHER" && "📌 Outros"}
                </span>
              </div>
              {cat._count && (
                <p className="text-xs text-gray-400 mt-2">{cat._count.Expense} despesas</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {categories.length === 0 && (
        <Alert>
          <AlertDescription>
            Nenhuma categoria cadastrada. Crie categorias padrão ou adicione manualmente.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
