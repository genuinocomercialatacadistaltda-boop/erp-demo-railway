
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Calculator,
  ChefHat,
  Home,
  ArrowLeft,
  Package,
  TrendingUp,
  Zap,
  Layers,
  BookOpen,
  Copy,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  X,
  Search,
  Beaker,
  Check
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RecipeFormDialog } from './_components/recipe-form-dialog';

interface Recipe {
  id: string;
  productId: string;
  name: string;
  description?: string;
  yieldQuantity: number;
  isActive: boolean;
  notes?: string;
  Product: {
    id: string;
    name: string;
    priceWholesale: number;
    canBeUsedAsIngredient?: boolean;
    linkedRawMaterialId?: string;
  };
  Ingredients: any[];
  Supplies: any[];
  calculatedCost: {
    ingredientsCost: number;
    suppliesCost: number;
    totalCost: number;
  };
}

interface Product {
  id: string;
  name: string;
  priceWholesale: number;
  category: string;
}

export default function ReceitasPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  
  // 📋 MELHORIA 2: Produtos sem receita
  const [productsWithoutRecipe, setProductsWithoutRecipe] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [showProductsWithoutRecipe, setShowProductsWithoutRecipe] = useState(false);

  // 💾 MELHORIA 1: Detectar rascunho salvo ao carregar a página
  const [hasDraft, setHasDraft] = useState(false);
  
  // 🔍 BUSCA E ORDENAÇÃO
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filtrar e ordenar receitas alfabeticamente
  const filteredAndSortedRecipes = recipes
    .filter(recipe => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return (
        recipe.name.toLowerCase().includes(search) ||
        recipe.Product.name.toLowerCase().includes(search)
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const [draftInfo, setDraftInfo] = useState<{ timestamp: string; name: string; ingredientsCount: number } | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    
    // Verificar se existe rascunho no localStorage
    const checkDraft = () => {
      try {
        const savedDraft = localStorage.getItem('recipe-draft');
        console.log('🔍 Verificando rascunho:', savedDraft ? 'ENCONTRADO' : 'NÃO ENCONTRADO');
        
        if (savedDraft) {
          const draft = JSON.parse(savedDraft);
          const draftAge = Date.now() - new Date(draft.timestamp).getTime();
          const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 dias
          
          console.log('📋 Rascunho:', {
            nome: draft.name,
            produto: draft.productId,
            ingredientes: draft.ingredients?.length,
            idade: Math.floor(draftAge / 60000) + ' minutos'
          });
          
          if (draftAge < MAX_AGE && (draft.ingredients?.length > 0 || draft.supplies?.length > 0 || draft.productId || draft.name)) {
            setHasDraft(true);
            setDraftInfo({
              timestamp: draft.timestamp,
              name: draft.name || 'Sem nome',
              ingredientsCount: draft.ingredients?.length || 0
            });
            console.log('✅ Banner de rascunho ATIVADO');
          } else {
            // Rascunho expirado ou vazio, limpar
            localStorage.removeItem('recipe-draft');
            setHasDraft(false);
            console.log('🗑️ Rascunho expirado ou vazio, removido');
          }
        } else {
          setHasDraft(false);
        }
      } catch (error) {
        console.error('❌ Erro ao verificar rascunho:', error);
        setHasDraft(false);
      }
    };

    checkDraft();
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    } else if (status === 'authenticated') {
      if ((session.user as any).userType !== 'ADMIN') {
        toast.error('Acesso negado');
        router.push('/');
      } else {
        loadRecipes();
      }
    }
  }, [status, session, router]);

  const loadRecipes = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/pricing/recipes');
      
      if (!response.ok) throw new Error('Erro ao carregar receitas');
      
      const data = await response.json();
      setRecipes(data);
      
      // 📋 MELHORIA 2: Carregar produtos sem receita automaticamente
      loadProductsWithoutRecipe(data);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar receitas');
    } finally {
      setLoading(false);
    }
  };

  // 📋 MELHORIA 2: Buscar produtos sem receita
  const loadProductsWithoutRecipe = async (currentRecipes?: Recipe[]) => {
    try {
      setLoadingProducts(true);
      const response = await fetch('/api/products?availableIn=WHOLESALE&isActive=true');
      
      if (!response.ok) throw new Error('Erro ao carregar produtos');
      
      const allProducts: Product[] = await response.json();
      const recipesToUse = currentRecipes || recipes;
      
      // Filtrar produtos que não têm receita
      const productsWithRecipeIds = recipesToUse.map(r => r.productId);
      const withoutRecipe = allProducts.filter(p => !productsWithRecipeIds.includes(p.id));
      
      setProductsWithoutRecipe(withoutRecipe);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar produtos sem receita');
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleNewRecipe = () => {
    setSelectedRecipe(null);
    setShowFormDialog(true);
  };

  // 💾 MELHORIA 1: Continuar rascunho salvo
  const handleContinueDraft = () => {
    setSelectedRecipe(null);
    setShowFormDialog(true);
    setHasDraft(false); // Ocultar o banner após abrir
  };

  // 💾 MELHORIA 1: Descartar rascunho
  const handleDiscardDraft = () => {
    localStorage.removeItem('recipe-draft');
    setHasDraft(false);
    setDraftInfo(null);
    toast.success('Rascunho descartado');
  };

  const handleEditRecipe = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setShowFormDialog(true);
  };

  // 🔄 MELHORIA 3: Duplicar receita
  const handleDuplicateRecipe = (recipe: Recipe) => {
    // Criar um objeto receita sem o ID para forçar criação de uma nova
    const recipeToDuplicate = {
      ...recipe,
      id: undefined,  // Remove o ID para criar nova
      name: `${recipe.name} (CÓPIA)`,
      Product: recipe.Product,
      Ingredients: recipe.Ingredients,
      Supplies: recipe.Supplies
    };
    
    setSelectedRecipe(recipeToDuplicate as any);
    setShowFormDialog(true);
    toast.info('Receita duplicada! Altere o nome e o produto de destino.');
  };

  // 📋 MELHORIA 2: Criar receita para produto sem receita
  const handleCreateRecipeForProduct = (product: Product) => {
    setSelectedRecipe(null);
    setShowFormDialog(true);
    // O formulário vai abrir vazio, mas o usuário pode selecionar este produto
    toast.info(`Criando receita para: ${product.name}`);
  };

  const handleViewDetails = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setShowDetailsDialog(true);
  };

  const handleDeleteRecipe = async (recipeId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta receita?')) return;

    try {
      const response = await fetch(`/api/admin/pricing/recipes/${recipeId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Erro ao excluir receita');

      toast.success('Receita excluída com sucesso!');
      loadRecipes();
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao excluir receita');
    }
  };

  // 🧪 Toggle para usar produto como matéria-prima
  const handleToggleIngredient = async (recipe: Recipe) => {
    const isCurrentlyEnabled = recipe.Product.canBeUsedAsIngredient;
    const action = isCurrentlyEnabled ? 'desativar' : 'ativar';
    
    if (isCurrentlyEnabled) {
      if (!confirm(`Deseja ${action} o uso de "${recipe.Product.name}" como matéria-prima em outras receitas?`)) {
        return;
      }
    }

    try {
      const response = await fetch(`/api/products/${recipe.Product.id}/toggle-ingredient`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable: !isCurrentlyEnabled })
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || `Erro ao ${action}`);
        return;
      }

      toast.success(data.message);
      loadRecipes(); // Recarregar para atualizar o estado
    } catch (error) {
      console.error('Erro:', error);
      toast.error(`Erro ao ${action} uso como matéria-prima`);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <p className="text-orange-600">Carregando...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-orange-800 flex items-center gap-2">
              <ChefHat className="w-8 h-8" />
              Receitas de Produtos
            </h1>
            <p className="text-orange-600 mt-1">
              Cadastre receitas com ingredientes e insumos
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => window.location.href = "/admin"}
              variant="outline"
              size="sm"
            >
              <Home className="w-4 h-4 mr-2" />
              Página Inicial
            </Button>
            <Button
              onClick={() => window.history.back()}
              variant="outline"
              size="sm"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          </div>
        </div>

        {/* Link para Insumos Compostos */}
        <Card className="border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50 cursor-pointer hover:shadow-lg transition-shadow" onClick={() => router.push('/admin/precificacao/insumos-compostos')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <BookOpen className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-orange-900">Insumos Compostos</h3>
                  <p className="text-sm text-orange-700">
                    Crie insumos compostos a partir de ingredientes básicos. O sistema calcula o custo e dá baixa automática.
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="border-orange-300 text-orange-700 hover:bg-orange-100">
                Acessar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total de Receitas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {recipes.length}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Cadastradas no sistema
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Receitas Ativas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {recipes.filter(r => r.isActive).length}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Em uso atualmente
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Custo Médio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {recipes.length > 0
                  ? formatCurrency(
                      recipes.reduce((sum, r) => sum + r.calculatedCost.totalCost, 0) /
                        recipes.length
                    )
                  : formatCurrency(0)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Por unidade
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 💾 MELHORIA 1: Banner de Rascunho Salvo */}
        {isMounted && hasDraft && (
          <Card className="border-blue-400 bg-gradient-to-r from-blue-100 to-cyan-100 shadow-lg animate-pulse-once">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className="p-3 bg-blue-200 rounded-xl flex-shrink-0">
                    <FileText className="h-8 w-8 text-blue-700" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-xl text-blue-900 mb-2">
                      ⚠️ Rascunho de Receita Encontrado!
                    </h3>
                    <p className="text-base text-blue-800 mb-3">
                      Você tem uma receita em andamento que foi salva automaticamente. <strong>Clique no botão para continuar de onde parou!</strong>
                    </p>
                    {draftInfo && (
                      <div className="flex flex-wrap items-center gap-3 text-sm text-blue-700">
                        <span className="bg-blue-200 px-2 py-1 rounded">
                          📝 {draftInfo.name}
                        </span>
                        <span className="bg-blue-200 px-2 py-1 rounded">
                          🥩 {draftInfo.ingredientsCount} ingrediente{draftInfo.ingredientsCount !== 1 ? 's' : ''}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          Salvo há {Math.floor((Date.now() - new Date(draftInfo.timestamp).getTime()) / 60000)} minutos
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <Button
                    onClick={handleContinueDraft}
                    size="lg"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                  >
                    <FileText className="w-5 h-5 mr-2" />
                    Continuar Receita
                  </Button>
                  <Button
                    onClick={handleDiscardDraft}
                    variant="outline"
                    size="sm"
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Descartar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          <Button
            onClick={() => window.location.href = '/admin/precificacao/insumos'}
            variant="outline"
            className="border-blue-600 text-blue-600 hover:bg-blue-50"
          >
            <Package className="w-4 h-4 mr-2" />
            Catálogo de Insumos
          </Button>
          <Button
            onClick={() => window.location.href = '/admin/precificacao/calculadora-insumos'}
            variant="outline"
            className="border-cyan-600 text-cyan-600 hover:bg-cyan-50"
          >
            <Layers className="w-4 h-4 mr-2" />
            Calculadora de Insumos
          </Button>
          <Button
            onClick={() => window.location.href = '/admin/precificacao/rentabilidade'}
            variant="outline"
            className="border-green-600 text-green-600 hover:bg-green-50"
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            Dashboard de Rentabilidade
          </Button>
          <Button
            onClick={() => window.location.href = '/admin/precificacao/simulador'}
            variant="outline"
            className="border-purple-600 text-purple-600 hover:bg-purple-50"
          >
            <Zap className="w-4 h-4 mr-2" />
            Simulador de Preços
          </Button>
          <Button
            onClick={handleNewRecipe}
            className="bg-orange-600 hover:bg-orange-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Receita
          </Button>
        </div>

        {/* 📋 MELHORIA 2: Produtos sem Receita */}
        {productsWithoutRecipe.length > 0 && (
          <Card className="border-amber-300 bg-amber-50/50">
            <CardHeader 
              className="cursor-pointer hover:bg-amber-100/50 transition-colors"
              onClick={() => setShowProductsWithoutRecipe(!showProductsWithoutRecipe)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <div>
                    <CardTitle className="text-lg">
                      Produtos sem Receita
                    </CardTitle>
                    <p className="text-sm text-amber-700 font-normal mt-1">
                      {productsWithoutRecipe.length} produto{productsWithoutRecipe.length !== 1 ? 's' : ''} ainda não {productsWithoutRecipe.length !== 1 ? 'têm' : 'tem'} receita cadastrada
                    </p>
                  </div>
                </div>
                {showProductsWithoutRecipe ? (
                  <ChevronUp className="w-5 h-5 text-amber-600" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-amber-600" />
                )}
              </div>
            </CardHeader>
            {showProductsWithoutRecipe && (
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {productsWithoutRecipe.map((product) => (
                    <Card key={product.id} className="bg-white hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-900 text-sm truncate">
                              {product.name}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {product.category}
                              </Badge>
                              <span className="text-xs text-gray-600">
                                {formatCurrency(product.priceWholesale)}
                              </span>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCreateRecipeForProduct(product)}
                            className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 flex-shrink-0"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Recipes List */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle>Lista de Receitas</CardTitle>
              {/* 🔍 Campo de Busca */}
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar receita ou produto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            {searchTerm && (
              <p className="text-sm text-gray-500 mt-2">
                {filteredAndSortedRecipes.length} receita(s) encontrada(s) para "{searchTerm}"
              </p>
            )}
          </CardHeader>
          <CardContent>
            {recipes.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <ChefHat className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Nenhuma receita cadastrada</p>
                <p className="text-sm mt-2">
                  Clique em "Nova Receita" para começar
                </p>
              </div>
            ) : filteredAndSortedRecipes.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Search className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Nenhuma receita encontrada</p>
                <p className="text-sm mt-2">
                  Tente buscar com outros termos
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredAndSortedRecipes.map((recipe) => (
                  <div
                    key={recipe.id}
                    className="border rounded-lg p-4 hover:border-orange-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-gray-900">
                            {recipe.name}
                          </h3>
                          <Badge variant={recipe.isActive ? "default" : "secondary"}>
                            {recipe.isActive ? "Ativa" : "Inativa"}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          Produto: {recipe.Product.name}
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Ingredientes:</span>
                            <span className="font-medium ml-2">
                              {recipe.Ingredients.length}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Insumos:</span>
                            <span className="font-medium ml-2">
                              {recipe.Supplies.length}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Custo Total:</span>
                            <span className="font-medium ml-2 text-orange-600">
                              {formatCurrency(recipe.calculatedCost.totalCost)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Rendimento:</span>
                            <span className="font-medium ml-2">
                              {recipe.yieldQuantity} un
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          onClick={() => handleViewDetails(recipe)}
                          variant="outline"
                          size="sm"
                          title="Ver detalhes"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={() => handleDuplicateRecipe(recipe)}
                          variant="outline"
                          size="sm"
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          title="Duplicar receita"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={() => handleToggleIngredient(recipe)}
                          variant="outline"
                          size="sm"
                          className={recipe.Product.canBeUsedAsIngredient 
                            ? "text-green-600 hover:text-green-700 hover:bg-green-50 border-green-300 bg-green-50" 
                            : "text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                          }
                          title={recipe.Product.canBeUsedAsIngredient 
                            ? "✓ Produto pode ser usado como matéria-prima (clique para desativar)" 
                            : "Usar também como matéria-prima em outras receitas"
                          }
                        >
                          {recipe.Product.canBeUsedAsIngredient ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Beaker className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          onClick={() => handleEditRecipe(recipe)}
                          variant="outline"
                          size="sm"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={() => handleDeleteRecipe(recipe.id)}
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recipe Form Dialog */}
        {showFormDialog && (
          <RecipeFormDialog
            recipe={selectedRecipe}
            open={showFormDialog}
            onOpenChange={(open) => {
              setShowFormDialog(open);
              if (!open) {
                setSelectedRecipe(null);
              }
            }}
            onSuccess={() => {
              setShowFormDialog(false);
              setSelectedRecipe(null);
              loadRecipes();
            }}
          />
        )}

        {/* Recipe Details Dialog */}
        {showDetailsDialog && selectedRecipe && (
          <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Calculator className="w-5 h-5" />
                  Detalhes da Receita
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Basic Info */}
                <div>
                  <h3 className="font-semibold mb-2">{selectedRecipe.name}</h3>
                  {selectedRecipe.description && (
                    <p className="text-sm text-gray-600 mb-2">
                      {selectedRecipe.description}
                    </p>
                  )}
                  <p className="text-sm text-gray-600">
                    Produto: {selectedRecipe.Product.name}
                  </p>
                  <p className="text-sm text-gray-600">
                    Rendimento: {selectedRecipe.yieldQuantity} unidade(s)
                  </p>
                </div>

                {/* Ingredients */}
                <div>
                  <h4 className="font-semibold mb-2">Ingredientes ({selectedRecipe.Ingredients.length})</h4>
                  <div className="space-y-2">
                    {selectedRecipe.Ingredients.map((ing: any, index: number) => {
                      // Calcular custo por produto baseado no custo por kg da matéria-prima
                      const costPerGram = ing.RawMaterial.costPerUnit / 1000;
                      
                      // Custo base (sem quebras)
                      const baseCost = costPerGram * ing.quantityGrams;
                      
                      // Calcular quantidade total necessária considerando quebras
                      let adjustedQuantity = ing.quantityGrams;
                      
                      // Aplicar quebra invisível (ex: 135g × 1.05 = 141.75g)
                      if (ing.invisibleWastePercent > 0) {
                        adjustedQuantity = adjustedQuantity * (1 + ing.invisibleWastePercent / 100);
                      }
                      
                      // Aplicar quebra visível (ex: 141.75g × 1.05 = 148.84g)
                      if (ing.visibleWastePercent > 0) {
                        adjustedQuantity = adjustedQuantity * (1 + ing.visibleWastePercent / 100);
                      }
                      
                      // Custo final com quebras incluídas
                      const totalCost = costPerGram * adjustedQuantity;
                      
                      // Custo adicional das quebras
                      const wasteCost = totalCost - baseCost;
                      
                      const hasWaste = ing.invisibleWastePercent > 0 || ing.visibleWastePercent > 0;
                      
                      return (
                        <div key={index} className="bg-gray-50 p-3 rounded">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-medium">{ing.RawMaterial.name}</p>
                              <p className="text-sm text-gray-600">
                                Quantidade: {ing.quantityGrams}g
                                {ing.invisibleWastePercent > 0 && ` | Quebra Invisível: ${ing.invisibleWastePercent}%`}
                                {ing.visibleWastePercent > 0 && ` | Quebra Visível: ${ing.visibleWastePercent}%`}
                              </p>
                              {hasWaste && (
                                <p className="text-xs text-orange-600 mt-1">
                                  ⚠️ Quantidade ajustada com quebras: {adjustedQuantity.toFixed(2)}g
                                </p>
                              )}
                            </div>
                            <div className="ml-4 text-right min-w-[140px]">
                              <p className="text-xs text-gray-500 mb-1">Custo/produto</p>
                              
                              {/* Custo base da matéria-prima */}
                              <div className="text-xs text-gray-600 mb-1">
                                <span className="text-gray-500">MP base:</span> {formatCurrency(baseCost)}
                              </div>
                              
                              {/* Custo das quebras (se houver) */}
                              {hasWaste && (
                                <div className="text-xs text-orange-600 mb-1">
                                  <span className="text-orange-500">+ Quebras:</span> {formatCurrency(wasteCost)}
                                </div>
                              )}
                              
                              {/* Total */}
                              <div className={`pt-1 ${hasWaste ? 'border-t border-gray-300' : ''}`}>
                                <p className="font-bold text-green-600">
                                  {formatCurrency(totalCost)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Supplies */}
                {selectedRecipe.Supplies.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Insumos ({selectedRecipe.Supplies.length})</h4>
                    <div className="space-y-2">
                      {selectedRecipe.Supplies.map((sup: any, index: number) => {
                        // Calcular custo por produto = custo total ÷ quantidade
                        const costPerProduct = sup.costPerUnit / sup.quantityPerUnit;
                        
                        return (
                          <div key={index} className="bg-gray-50 p-3 rounded">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-medium">{sup.name}</p>
                                <p className="text-sm text-gray-600">
                                  Custo: {formatCurrency(sup.costPerUnit)} | 
                                  Quantidade: {sup.quantityPerUnit} {sup.unit}
                                </p>
                              </div>
                              <div className="ml-4 text-right">
                                <p className="text-xs text-gray-500">Custo/produto</p>
                                <p className="font-bold text-green-600">
                                  {formatCurrency(costPerProduct)}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Cost Summary */}
                <div className="bg-orange-50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-3">Resumo de Custos</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Custo de Ingredientes:</span>
                      <span className="font-medium">
                        {formatCurrency(selectedRecipe.calculatedCost.ingredientsCost)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Custo de Insumos:</span>
                      <span className="font-medium">
                        {formatCurrency(selectedRecipe.calculatedCost.suppliesCost)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t">
                      <span className="font-semibold">Custo Total:</span>
                      <span className="font-bold text-orange-600 text-lg">
                        {formatCurrency(selectedRecipe.calculatedCost.totalCost)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Custo por Unidade:</span>
                      <span>
                        {formatCurrency(
                          selectedRecipe.calculatedCost.totalCost / selectedRecipe.yieldQuantity
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedRecipe.notes && (
                  <div>
                    <h4 className="font-semibold mb-2">Observações</h4>
                    <p className="text-sm text-gray-600">{selectedRecipe.notes}</p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
