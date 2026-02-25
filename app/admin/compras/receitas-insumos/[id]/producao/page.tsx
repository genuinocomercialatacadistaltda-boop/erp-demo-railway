'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { ArrowLeft, PackagePlus, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

interface Supply {
  id: string;
  name: string;
  unit: string;
  costPerUnit: number;
  currentStock: number;
}

interface RecipeItem {
  id: string;
  ingredientId: string;
  quantity: number;
  unit: string;
  notes?: string;
  Ingredient: Supply;
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
  Supply: Supply;
  Items: RecipeItem[];
}

export default function ProducaoInsumoPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const params = useParams();
  const recipeId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [multiplier, setMultiplier] = useState(1);
  const [notes, setNotes] = useState('');
  const [producing, setProducing] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }

    if ((session?.user as any)?.userType !== 'ADMIN') {
      router.push('/dashboard');
      return;
    }

    loadRecipe();
  }, [session, status, router]);

  const loadRecipe = async () => {
    try {
      setLoading(true);

      const response = await fetch(`/api/supplies/recipes/${recipeId}`);
      if (response.ok) {
        const data = await response.json();
        setRecipe(data);
      } else {
        toast.error('Receita não encontrada');
        router.push('/admin/compras/receitas-insumos');
      }
    } catch (error) {
      console.error('Erro ao carregar receita:', error);
      toast.error('Erro ao carregar receita');
    } finally {
      setLoading(false);
    }
  };

  const handleProduce = async () => {
    if (!recipe) return;

    if (multiplier <= 0) {
      toast.error('Multiplicador deve ser maior que zero');
      return;
    }

    // Verificar se há estoque suficiente
    const insufficientStock = recipe.Items.filter(
      (item) => item.Ingredient.currentStock < item.quantity * multiplier
    );

    if (insufficientStock.length > 0) {
      const details = insufficientStock
        .map(
          (item) =>
            `${item.Ingredient.name}: necessário ${item.quantity * multiplier} ${item.unit}, disponível ${item.Ingredient.currentStock} ${item.Ingredient.unit}`
        )
        .join('\n');
      toast.error('Estoque insuficiente', { description: details });
      return;
    }

    try {
      setProducing(true);

      const response = await fetch(`/api/supplies/recipes/${recipeId}/produce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ multiplier, notes: notes || null }),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success('Produção realizada com sucesso!', {
          description: `${result.production.quantityProduced} ${result.production.unit} produzidos. Novo estoque: ${result.newStock} ${result.production.unit}`,
        });
        router.push('/admin/compras/receitas-insumos');
      } else {
        const error = await response.json();
        if (error.details && Array.isArray(error.details)) {
          toast.error(error.error || 'Erro na produção', {
            description: error.details.join('\n'),
          });
        } else {
          toast.error(error.error || 'Erro na produção');
        }
      }
    } catch (error) {
      console.error('Erro ao produzir:', error);
      toast.error('Erro ao produzir insumo');
    } finally {
      setProducing(false);
    }
  };

  if (loading || !recipe) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Carregando...</div>
        </div>
      </div>
    );
  }

  const totalProduction = recipe.yieldAmount * multiplier;
  const totalCost = recipe.estimatedCost * multiplier;
  const costPerUnit = totalCost / totalProduction;

  // Verificar estoque suficiente
  const insufficientStock = recipe.Items.filter(
    (item) => item.Ingredient.currentStock < item.quantity * multiplier
  );
  const hasInsufficientStock = insufficientStock.length > 0;

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <PackagePlus className="h-8 w-8 text-green-600" />
            Produzir Insumo
          </h1>
          <p className="text-muted-foreground mt-1">Configure e execute a produção</p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>

      {/* Informações da Receita */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{recipe.name}</CardTitle>
          <CardDescription>{recipe.description || 'Sem descrição'}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Insumo Produzido:</span>
              <p className="font-medium text-lg">{recipe.Supply.name}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Rendimento por Lote:</span>
              <p className="font-medium text-lg">
                {recipe.yieldAmount} {recipe.yieldUnit}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Custo por Lote:</span>
              <p className="font-medium text-lg">R$ {recipe.estimatedCost.toFixed(2)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Estoque Atual:</span>
              <p className="font-medium text-lg">
                {recipe.Supply.currentStock} {recipe.Supply.unit}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuração da Produção */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Configuração da Produção</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="multiplier">
              Multiplicador (quantos lotes produzir)
            </Label>
            <Input
              id="multiplier"
              type="number"
              step="0.1"
              min="0.1"
              value={multiplier}
              onChange={(e) => setMultiplier(parseFloat(e.target.value) || 1)}
              className="max-w-xs"
            />
            <p className="text-sm text-muted-foreground mt-1">
              1 = produzir {recipe.yieldAmount} {recipe.yieldUnit} | 2 = produzir{' '}
              {recipe.yieldAmount * 2} {recipe.yieldUnit}
            </p>
          </div>

          <div>
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Adicione observações sobre esta produção..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Resumo da Produção */}
      <Card className="mb-6 bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-700">
            <Info className="h-5 w-5" />
            Resumo da Produção
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-muted-foreground">Quantidade a Produzir:</span>
              <p className="text-2xl font-bold text-blue-700">
                {totalProduction.toFixed(3)} {recipe.yieldUnit}
              </p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Custo Total:</span>
              <p className="text-2xl font-bold text-blue-700">R$ {totalCost.toFixed(2)}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Custo por Unidade:</span>
              <p className="text-lg font-semibold text-blue-600">
                R$ {costPerUnit.toFixed(2)}/{recipe.yieldUnit}
              </p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Estoque Após Produção:</span>
              <p className="text-lg font-semibold text-green-600">
                {(recipe.Supply.currentStock + totalProduction).toFixed(3)} {recipe.Supply.unit}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ingredientes Necessários */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Ingredientes Necessários</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recipe.Items.map((item) => {
              const requiredQty = item.quantity * multiplier;
              const hasStock = item.Ingredient.currentStock >= requiredQty;
              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-3 rounded ${
                    hasStock ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                  }`}
                >
                  <div>
                    <p className="font-medium">{item.Ingredient.name}</p>
                    {item.notes && (
                      <p className="text-sm text-muted-foreground">{item.notes}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {requiredQty.toFixed(3)} {item.unit}
                    </p>
                    <p
                      className={`text-sm ${
                        hasStock ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      Disponível: {item.Ingredient.currentStock} {item.Ingredient.unit}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Alertas */}
      {hasInsufficientStock && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Estoque insuficiente!</strong> Os seguintes ingredientes não possuem estoque
            suficiente:
            <ul className="mt-2 list-disc list-inside">
              {insufficientStock.map((item) => (
                <li key={item.id}>
                  {item.Ingredient.name}: necessário {(item.quantity * multiplier).toFixed(3)}{' '}
                  {item.unit}, disponível {item.Ingredient.currentStock} {item.Ingredient.unit}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Botão de Produção */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.back()} disabled={producing}>
          Cancelar
        </Button>
        <Button
          onClick={handleProduce}
          disabled={producing || hasInsufficientStock}
          className="bg-green-600 hover:bg-green-700"
        >
          {producing ? (
            <>
              <span className="animate-spin mr-2">⏳</span>
              Produzindo...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Confirmar Produção
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
