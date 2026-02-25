'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, ArrowLeft, Home, BookOpen, PackagePlus, ChefHat } from 'lucide-react';

interface Supply {
  id: string;
  name: string;
  unit: string;
  category: string;
  costPerUnit: number;
  currentStock: number;
  hasRecipe: boolean;
}

interface RecipeItem {
  id?: string;
  ingredientId: string;
  quantity: number;
  unit: string;
  notes?: string;
  Ingredient?: Supply;
}

interface Recipe {
  id: string;
  supplyId: string;
  name: string;
  description?: string;
  yieldAmount: number;
  yieldUnit: string;
  estimatedCost: number;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  Supply: Supply;
  Items: RecipeItem[];
  Productions?: any[];
}

export default function ReceitasInsumosPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [formData, setFormData] = useState({
    supplyId: '',
    name: '',
    description: '',
    yieldAmount: '',
    yieldUnit: 'kg',
    notes: '',
  });
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }

    if ((session?.user as any)?.userType !== 'ADMIN') {
      router.push('/dashboard');
      return;
    }

    loadData();
  }, [session, status, router]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Carregar receitas
      const recipesRes = await fetch('/api/supplies/recipes');
      if (recipesRes.ok) {
        const recipesData = await recipesRes.json();
        setRecipes(recipesData);
      }

      // Carregar insumos
      const suppliesRes = await fetch('/api/supplies');
      if (suppliesRes.ok) {
        const suppliesData = await suppliesRes.json();
        setSupplies(suppliesData);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (recipe?: Recipe) => {
    if (recipe) {
      // Modo edição
      setEditingRecipe(recipe);
      setFormData({
        supplyId: recipe.supplyId,
        name: recipe.name,
        description: recipe.description || '',
        yieldAmount: recipe.yieldAmount.toString(),
        yieldUnit: recipe.yieldUnit,
        notes: recipe.notes || '',
      });
      setRecipeItems(
        recipe.Items.map((item) => ({
          ingredientId: item.ingredientId,
          quantity: item.quantity,
          unit: item.unit,
          notes: item.notes || '',
          Ingredient: item.Ingredient,
        }))
      );
    } else {
      // Modo criação
      setEditingRecipe(null);
      setFormData({
        supplyId: '',
        name: '',
        description: '',
        yieldAmount: '',
        yieldUnit: 'kg',
        notes: '',
      });
      setRecipeItems([{ ingredientId: '', quantity: 0, unit: 'kg', notes: '' }]);
    }
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingRecipe(null);
    setFormData({
      supplyId: '',
      name: '',
      description: '',
      yieldAmount: '',
      yieldUnit: 'kg',
      notes: '',
    });
    setRecipeItems([]);
  };

  const addRecipeItem = () => {
    setRecipeItems([...recipeItems, { ingredientId: '', quantity: 0, unit: 'kg', notes: '' }]);
  };

  const removeRecipeItem = (index: number) => {
    setRecipeItems(recipeItems.filter((_, i) => i !== index));
  };

  const updateRecipeItem = (index: number, field: string, value: any) => {
    const updatedItems = [...recipeItems];
    (updatedItems[index] as any)[field] = value;

    // Se o ingrediente mudou, atualizar a unidade automaticamente
    if (field === 'ingredientId' && value) {
      const supply = supplies.find((s) => s.id === value);
      if (supply) {
        updatedItems[index].unit = supply.unit;
        updatedItems[index].Ingredient = supply;
      }
    }

    setRecipeItems(updatedItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validações
    if (!formData.supplyId || !formData.name || !formData.yieldAmount) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (recipeItems.length === 0) {
      toast.error('Adicione pelo menos um ingrediente');
      return;
    }

    const invalidItems = recipeItems.filter((item) => !item.ingredientId || item.quantity <= 0);
    if (invalidItems.length > 0) {
      toast.error('Todos os ingredientes devem ter ID e quantidade válida');
      return;
    }

    try {
      const payload = {
        ...formData,
        yieldAmount: parseFloat(formData.yieldAmount),
        items: recipeItems.map((item) => ({
          ingredientId: item.ingredientId,
          quantity: item.quantity,
          unit: item.unit,
          notes: item.notes || null,
        })),
      };

      const url = editingRecipe ? `/api/supplies/recipes/${editingRecipe.id}` : '/api/supplies/recipes';
      const method = editingRecipe ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success(editingRecipe ? 'Receita atualizada!' : 'Receita criada!');
        handleCloseDialog();
        loadData();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erro ao salvar receita');
      }
    } catch (error) {
      console.error('Erro ao salvar receita:', error);
      toast.error('Erro ao salvar receita');
    }
  };

  const handleDelete = async (recipeId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta receita?')) {
      return;
    }

    try {
      const response = await fetch(`/api/supplies/recipes/${recipeId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Receita excluída!');
        loadData();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erro ao excluir receita');
      }
    } catch (error) {
      console.error('Erro ao excluir receita:', error);
      toast.error('Erro ao excluir receita');
    }
  };

  const handleProduce = (recipeId: string) => {
    router.push(`/admin/compras/receitas-insumos/${recipeId}/producao`);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Carregando...</div>
        </div>
      </div>
    );
  }

  // Filtrar insumos sem receita para seleção
  const availableSupplies = editingRecipe
    ? supplies
    : supplies.filter((s) => !s.hasRecipe);

  return (
    <div className="container mx-auto p-6">
      {/* Header com botões de navegação */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BookOpen className="h-8 w-8" />
            Insumos Compostos
          </h1>
          <p className="text-muted-foreground mt-1">
            Crie insumos compostos a partir de ingredientes básicos. O sistema calcula o custo automaticamente e dá baixa proporcional nos ingredientes ao produzir espetos.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push('/')}>
            <Home className="h-4 w-4 mr-2" />
            Início
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push('/admin/precificacao')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>
      </div>

      {/* Botão Nova Receita */}
      <div className="mb-6">
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Receita
        </Button>
      </div>

      {/* Listagem de Receitas */}
      <div className="grid gap-4">
        {recipes.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Nenhuma receita cadastrada. Clique em "Nova Receita" para começar.
            </CardContent>
          </Card>
        ) : (
          recipes.map((recipe) => (
            <Card key={recipe.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      <ChefHat className="h-5 w-5 text-orange-500" />
                      {recipe.name}
                    </CardTitle>
                    <CardDescription>
                      {recipe.description || 'Sem descrição'}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleProduce(recipe.id)}
                    >
                      <PackagePlus className="h-4 w-4 mr-1" />
                      Produzir
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleOpenDialog(recipe)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(recipe.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Informações da Receita */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Insumo Produzido:</span>
                      <p className="font-medium">{recipe.Supply.name}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Rendimento:</span>
                      <p className="font-medium">
                        {recipe.yieldAmount} {recipe.yieldUnit}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Custo Estimado:</span>
                      <p className="font-medium">
                        R$ {recipe.estimatedCost.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Custo/Unidade:</span>
                      <p className="font-medium">
                        R$ {(recipe.estimatedCost / recipe.yieldAmount).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Ingredientes */}
                  <div>
                    <h4 className="font-semibold mb-2">Ingredientes ({recipe.Items.length}):</h4>
                    <div className="grid gap-2">
                      {recipe.Items.map((item, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between bg-muted/50 p-2 rounded"
                        >
                          <div>
                            <span className="font-medium">{item.Ingredient?.name}</span>
                            {item.notes && (
                              <span className="text-sm text-muted-foreground ml-2">
                                ({item.notes})
                              </span>
                            )}
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">{item.quantity} {item.unit}</span>
                            <span className="text-muted-foreground ml-2">
                              (Estoque: {item.Ingredient?.currentStock} {item.Ingredient?.unit})
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Produções Recentes */}
                  {recipe.Productions && recipe.Productions.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">
                        Últimas Produções ({recipe.Productions.length}):
                      </h4>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        {recipe.Productions.map((prod) => (
                          <div key={prod.id}>
                            • {new Date(prod.productionDate).toLocaleDateString('pt-BR')} -{' '}
                            {prod.quantityProduced} {recipe.yieldUnit} - R${' '}
                            {prod.productionCost.toFixed(2)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Dialog de Criação/Edição */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRecipe ? 'Editar Receita' : 'Nova Receita de Insumo'}
            </DialogTitle>
            <DialogDescription>
              {editingRecipe
                ? 'Atualize as informações da receita'
                : 'Crie uma receita para produzir um insumo a partir de outros insumos'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Informações Básicas */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="supplyId">Insumo a Produzir *</Label>
                <Select
                  value={formData.supplyId}
                  onValueChange={(value) => {
                    setFormData({ ...formData, supplyId: value });
                    const supply = supplies.find((s) => s.id === value);
                    if (supply && !editingRecipe) {
                      setFormData({
                        ...formData,
                        supplyId: value,
                        name: `Receita ${supply.name}`,
                        yieldUnit: supply.unit,
                      });
                    }
                  }}
                  disabled={!!editingRecipe}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o insumo" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSupplies.map((supply) => (
                      <SelectItem key={supply.id} value={supply.id}>
                        {supply.name} ({supply.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="name">Nome da Receita *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Tempero Genuíno"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descreva esta receita..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="yieldAmount">Rendimento *</Label>
                <Input
                  id="yieldAmount"
                  type="number"
                  step="0.001"
                  value={formData.yieldAmount}
                  onChange={(e) => setFormData({ ...formData, yieldAmount: e.target.value })}
                  placeholder="Ex: 5.9"
                  required
                />
              </div>

              <div>
                <Label htmlFor="yieldUnit">Unidade *</Label>
                <Select
                  value={formData.yieldUnit}
                  onValueChange={(value) => setFormData({ ...formData, yieldUnit: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="g">g</SelectItem>
                    <SelectItem value="un">un</SelectItem>
                    <SelectItem value="l">l</SelectItem>
                    <SelectItem value="ml">ml</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Observações sobre a receita..."
                rows={2}
              />
            </div>

            {/* Ingredientes */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-lg font-semibold">Ingredientes *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addRecipeItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Ingrediente
                </Button>
              </div>

              <div className="space-y-3">
                {recipeItems.map((item, index) => (
                  <div key={index} className="flex gap-2 items-start bg-muted/50 p-3 rounded">
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <div>
                        <Select
                          value={item.ingredientId}
                          onValueChange={(value) => updateRecipeItem(index, 'ingredientId', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Insumo" />
                          </SelectTrigger>
                          <SelectContent>
                            {supplies
                              .filter((s) => s.id !== formData.supplyId)
                              .map((supply) => (
                                <SelectItem key={supply.id} value={supply.id}>
                                  {supply.name}
                                  <span className="text-xs text-muted-foreground ml-1">
                                    ({supply.currentStock} {supply.unit})
                                  </span>
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Input
                          type="number"
                          step="0.001"
                          placeholder="Quantidade"
                          value={item.quantity || ''}
                          onChange={(e) =>
                            updateRecipeItem(index, 'quantity', parseFloat(e.target.value))
                          }
                        />
                      </div>
                      <div>
                        <Input value={item.unit} disabled className="bg-gray-100" />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeRecipeItem(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingRecipe ? 'Atualizar' : 'Criar'} Receita
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
