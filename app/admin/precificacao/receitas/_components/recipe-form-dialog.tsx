'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { 
  Plus, 
  Trash2, 
  Save,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RecipeFormDialogProps {
  recipe?: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface Product {
  id: string;
  name: string;
  priceWholesale: number;
  isActive?: boolean;
}

interface RawMaterial {
  id: string;
  name: string;
  costPerUnit: number;
  measurementUnit: string;
}

interface Ingredient {
  rawMaterialId: string;
  quantityGrams: string;
  invisibleWastePercent: string;
  visibleWastePercent: string;
  notes: string;
  hasIcms: boolean;  // Se true, aplica ICMS de 3,6% no custo
}

interface Supply {
  globalSupplyId?: string;  // NOVO: ID do insumo global (se selecionado do catálogo)
  name: string;
  category: string;
  costPerUnit: string;
  quantityPerUnit: string;
  unit: string;
  notes: string;
  isFromCatalog?: boolean;  // NOVO: Indica se vem do catálogo ou é personalizado
  // 🧂 CAMPOS ESPECIAIS PARA TEMPEROS
  gramsPerKgMeat?: string;  // Quantos gramas de tempero por kg de carne (ex: 20)
  skewerGrams?: string;     // Gramatura do espeto em gramas (ex: 160)
}

const SUPPLY_CATEGORIES = [
  'PALITO',
  'EMBALAGEM',
  'TEMPERO',
  'ETIQUETA',
  'GAS',
  'OUTRO',
];

export function RecipeFormDialog({ recipe, open, onOpenChange, onSuccess }: RecipeFormDialogProps) {
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [globalSupplies, setGlobalSupplies] = useState<any[]>([]);  // NOVO: Catálogo de insumos globais
  const [productSearchTerm, setProductSearchTerm] = useState('');  // NOVO: Filtro de busca de produtos
  
  // 💾 NOVO: Estados para controle do rascunho
  const [draftRestored, setDraftRestored] = useState(false);
  const [autoSaveIndicator, setAutoSaveIndicator] = useState<string>('');
  
  // Form data
  const [productId, setProductId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [yieldQuantity, setYieldQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  
  // Ingredients
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  
  // Supplies
  const [supplies, setSupplies] = useState<Supply[]>([]);

  // 💾 MELHORIA 1: Auto-save no localStorage para não perder progresso
  useEffect(() => {
    if (!open) return;
    
    // Só salva se tiver algum dado preenchido
    if (!productId && !name && ingredients.length === 0 && supplies.length === 0) return;
    
    const formData = {
      productId,
      name,
      description,
      yieldQuantity,
      notes,
      ingredients,
      supplies,
      timestamp: new Date().toISOString(),
      originalRecipeId: recipe?.id || null, // Para saber se é edição
    };
    
    // 🔑 Determinar a chave do localStorage baseado no contexto
    let storageKey: string;
    if (recipe?.id) {
      // EDIÇÃO: Salva com ID específico
      storageKey = `recipe-draft-edit-${recipe.id}`;
    } else if (recipe && !recipe.id) {
      // DUPLICAÇÃO: Tem recipe mas sem ID
      storageKey = 'recipe-draft-duplicate';
    } else {
      // NOVA RECEITA
      storageKey = 'recipe-draft';
    }
    
    try {
      localStorage.setItem(storageKey, JSON.stringify(formData));
      setAutoSaveIndicator('💾 Salvo automaticamente');
      console.log('💾 Rascunho salvo:', { 
        tipo: recipe?.id ? 'EDIÇÃO' : recipe ? 'DUPLICAÇÃO' : 'NOVA',
        chave: storageKey,
        productId, 
        name, 
        ingredientes: ingredients.length 
      });
      
      // Limpar indicador após 2 segundos
      const timer = setTimeout(() => setAutoSaveIndicator(''), 2000);
      return () => clearTimeout(timer);
    } catch (error) {
      console.error('Erro ao salvar rascunho:', error);
      setAutoSaveIndicator('❌ Erro ao salvar');
    }
  }, [productId, name, description, yieldQuantity, notes, ingredients, supplies, open, recipe]);

  useEffect(() => {
    if (open) {
      loadProducts();
      loadRawMaterials();
      loadGlobalSupplies();  // NOVO: Carregar catálogo de insumos
      
      if (recipe) {
        // 🔑 Determinar a chave do rascunho baseado no contexto
        let storageKey: string;
        if (recipe.id) {
          // EDIÇÃO: Busca rascunho específico da edição
          storageKey = `recipe-draft-edit-${recipe.id}`;
        } else {
          // DUPLICAÇÃO: Busca rascunho de duplicação
          storageKey = 'recipe-draft-duplicate';
        }
        
        // 💾 Tentar restaurar rascunho salvo (para edição ou duplicação)
        const savedDraft = localStorage.getItem(storageKey);
        if (savedDraft) {
          try {
            const draft = JSON.parse(savedDraft);
            const draftAge = Date.now() - new Date(draft.timestamp).getTime();
            const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 dias
            
            if (draftAge < MAX_AGE && (draft.ingredients.length > 0 || draft.supplies.length > 0 || draft.productId)) {
              // Restaurar do rascunho
              setProductId(draft.productId || '');
              setName(draft.name || '');
              setDescription(draft.description || '');
              setYieldQuantity(draft.yieldQuantity || '1');
              setNotes(draft.notes || '');
              setIngredients(draft.ingredients || []);
              setSupplies(draft.supplies || []);
              setDraftRestored(true);
              
              // Calcular tempo desde o último salvamento
              const minutes = Math.floor(draftAge / (1000 * 60));
              const hours = Math.floor(minutes / 60);
              const timeAgo = hours > 0 
                ? `há ${hours} hora${hours > 1 ? 's' : ''}`
                : minutes > 0 
                  ? `há ${minutes} minuto${minutes > 1 ? 's' : ''}`
                  : 'agora mesmo';
              
              toast.success(`🎉 Rascunho restaurado! (salvo ${timeAgo})`, {
                duration: 5000,
                description: `${recipe.id ? 'Edição' : 'Duplicação'} - ${draft.ingredients.length} ingredientes e ${draft.supplies.length} insumos`
              });
              return; // Não carrega do banco se tem rascunho
            } else {
              // Rascunho expirado, remove
              localStorage.removeItem(storageKey);
            }
          } catch (error) {
            console.error('Erro ao restaurar rascunho:', error);
            localStorage.removeItem(storageKey);
          }
        }
        
        // Se não tem rascunho ou expirou, carrega do banco de dados
        setProductId(recipe.productId);
        setName(recipe.name);
        setDescription(recipe.description || '');
        setYieldQuantity(recipe.yieldQuantity.toString());
        setNotes(recipe.notes || '');
        
        // Carregar ingredientes
        setIngredients(recipe.Ingredients.map((ing: any) => ({
          rawMaterialId: ing.rawMaterialId,
          quantityGrams: ing.quantityGrams.toString(),
          invisibleWastePercent: ing.invisibleWastePercent.toString(),
          visibleWastePercent: ing.visibleWastePercent.toString(),
          hasIcms: ing.hasIcms || false,
          notes: ing.notes || '',
        })));
        
        // Carregar insumos
        setSupplies(recipe.Supplies.map((sup: any) => ({
          globalSupplyId: sup.globalSupplyId || undefined,
          name: sup.name,
          category: sup.category,
          costPerUnit: sup.costPerUnit.toString(),
          quantityPerUnit: sup.quantityPerUnit.toString(),
          unit: sup.unit,
          notes: sup.notes || '',
          isFromCatalog: !!sup.globalSupplyId,  // Se tem globalSupplyId, veio do catálogo
          // 🧂 Campos especiais para temperos
          gramsPerKgMeat: sup.gramsPerKgMeat ? sup.gramsPerKgMeat.toString() : '',
          skewerGrams: sup.skewerGrams ? sup.skewerGrams.toString() : '',
        })));
        setDraftRestored(false);
      } else {
        // NOVA RECEITA
        // 💾 Tentar restaurar rascunho salvo
        const savedDraft = localStorage.getItem('recipe-draft');
        if (savedDraft) {
          try {
            const draft = JSON.parse(savedDraft);
            const draftAge = Date.now() - new Date(draft.timestamp).getTime();
            const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 dias
            
            if (draftAge < MAX_AGE && (draft.ingredients.length > 0 || draft.supplies.length > 0 || draft.productId)) {
              setProductId(draft.productId || '');
              setName(draft.name || '');
              setDescription(draft.description || '');
              setYieldQuantity(draft.yieldQuantity || '1');
              setNotes(draft.notes || '');
              setIngredients(draft.ingredients || []);
              setSupplies(draft.supplies || []);
              setDraftRestored(true);
              
              // Calcular tempo desde o último salvamento
              const minutes = Math.floor(draftAge / (1000 * 60));
              const hours = Math.floor(minutes / 60);
              const timeAgo = hours > 0 
                ? `há ${hours} hora${hours > 1 ? 's' : ''}`
                : minutes > 0 
                  ? `há ${minutes} minuto${minutes > 1 ? 's' : ''}`
                  : 'agora mesmo';
              
              toast.success(`🎉 Rascunho restaurado! (salvo ${timeAgo})`, {
                duration: 5000,
                description: `${draft.ingredients.length} ingredientes e ${draft.supplies.length} insumos recuperados`
              });
            } else {
              clearForm();
              localStorage.removeItem('recipe-draft');
              setDraftRestored(false);
            }
          } catch (error) {
            console.error('Erro ao restaurar rascunho:', error);
            clearForm();
            setDraftRestored(false);
          }
        } else {
          clearForm();
          setDraftRestored(false);
        }
      }
    }
  }, [open, recipe]);

  const loadProducts = async () => {
    try {
      // Busca TODOS os produtos (incluindo inativos) para permitir criar receitas de qualquer produto
      const response = await fetch('/api/products?includeInactive=true');
      if (!response.ok) throw new Error('Erro ao carregar produtos');
      const data = await response.json();
      // Ordena alfabeticamente
      const sortedData = data.sort((a: Product, b: Product) => a.name.localeCompare(b.name));
      setProducts(sortedData);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar produtos');
    }
  };
  
  // Filtra produtos pela busca
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(productSearchTerm.toLowerCase())
  );

  const loadRawMaterials = async () => {
    try {
      const response = await fetch('/api/raw-materials?isActive=true');
      if (!response.ok) throw new Error('Erro ao carregar matérias-primas');
      const data = await response.json();
      setRawMaterials(data);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar matérias-primas');
    }
  };

  const loadGlobalSupplies = async () => {
    try {
      const response = await fetch('/api/admin/pricing/supplies?isActive=true');
      if (!response.ok) throw new Error('Erro ao carregar insumos do catálogo');
      const data = await response.json();
      setGlobalSupplies(data);
      console.log('✅ Insumos globais carregados:', data.length);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar catálogo de insumos');
    }
  };

  const clearForm = () => {
    setProductId('');
    setName('');
    setDescription('');
    setYieldQuantity('1');
    setNotes('');
    setIngredients([]);
    setSupplies([]);
    setDraftRestored(false);
    setProductSearchTerm('');  // Limpar busca de produto
  };

  // 💾 NOVO: Função para limpar rascunho manualmente
  const clearDraft = () => {
    // 🔑 Determinar qual rascunho limpar baseado no contexto
    if (recipe?.id) {
      localStorage.removeItem(`recipe-draft-edit-${recipe.id}`);
    } else if (recipe && !recipe.id) {
      localStorage.removeItem('recipe-draft-duplicate');
    } else {
      localStorage.removeItem('recipe-draft');
    }
    
    // Se era edição, recarrega os dados originais do banco
    if (recipe?.id) {
      setProductId(recipe.productId);
      setName(recipe.name);
      setDescription(recipe.description || '');
      setYieldQuantity(recipe.yieldQuantity.toString());
      setNotes(recipe.notes || '');
      setIngredients(recipe.Ingredients.map((ing: any) => ({
        rawMaterialId: ing.rawMaterialId,
        quantityGrams: ing.quantityGrams.toString(),
        invisibleWastePercent: ing.invisibleWastePercent.toString(),
        visibleWastePercent: ing.visibleWastePercent.toString(),
        hasIcms: ing.hasIcms || false,
        notes: ing.notes || '',
      })));
      setSupplies(recipe.Supplies.map((sup: any) => ({
        globalSupplyId: sup.globalSupplyId || undefined,
        name: sup.name,
        category: sup.category,
        costPerUnit: sup.costPerUnit.toString(),
        quantityPerUnit: sup.quantityPerUnit.toString(),
        unit: sup.unit,
        notes: sup.notes || '',
        isFromCatalog: !!sup.globalSupplyId,
        // 🧂 Campos especiais para temperos
        gramsPerKgMeat: sup.gramsPerKgMeat ? sup.gramsPerKgMeat.toString() : '',
        skewerGrams: sup.skewerGrams ? sup.skewerGrams.toString() : '',
      })));
      toast.success('Rascunho descartado! Dados originais restaurados.');
    } else {
      clearForm();
      toast.success('Rascunho limpo com sucesso!');
    }
    
    setDraftRestored(false);
  };

  const addIngredient = () => {
    setIngredients([
      ...ingredients,
      {
        rawMaterialId: '',
        quantityGrams: '',
        invisibleWastePercent: '0',
        visibleWastePercent: '0',
        notes: '',
        hasIcms: false,
      },
    ]);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, field: keyof Ingredient, value: string | boolean) => {
    const updated = [...ingredients];
    (updated[index] as any)[field] = value;
    setIngredients(updated);
  };

  const addSupply = () => {
    setSupplies([
      ...supplies,
      {
        globalSupplyId: undefined,
        name: '',
        category: 'PALITO',
        costPerUnit: '',
        quantityPerUnit: '1',
        unit: 'un',
        notes: '',
        isFromCatalog: false,  // Começa como personalizado
        // 🧂 Campos especiais para temperos
        gramsPerKgMeat: '',
        skewerGrams: '',
      },
    ]);
  };

  const removeSupply = (index: number) => {
    setSupplies(supplies.filter((_, i) => i !== index));
  };

  const updateSupply = (index: number, field: keyof Supply, value: any) => {
    const updated = [...supplies];
    (updated[index] as any)[field] = value;
    
    // 🧂 CÁLCULO AUTOMÁTICO PARA TEMPEROS
    const supply = updated[index];
    if (supply.category === 'TEMPERO' && (field === 'gramsPerKgMeat' || field === 'skewerGrams')) {
      const gramsPerKg = parseFloat(supply.gramsPerKgMeat || '0');
      const skewerGrams = parseFloat(supply.skewerGrams || '0');
      
      if (gramsPerKg > 0 && skewerGrams > 0) {
        // 1kg de tempero tempera quantos kg de carne?
        const kgsMeatPer1kgSeasonging = 1000 / gramsPerKg;
        
        // Cada espeto tem quantos kg?
        const kgPerSkewer = skewerGrams / 1000;
        
        // Quantos espetos com 1kg de tempero?
        const skewersPerKg = kgsMeatPer1kgSeasonging / kgPerSkewer;
        
        // Atualiza automaticamente quantityPerUnit
        supply.quantityPerUnit = skewersPerKg.toFixed(2);
        
        console.log(`🧂 [TEMPERO AUTO-CALC] ${gramsPerKg}g/kg carne + ${skewerGrams}g espeto = ${skewersPerKg.toFixed(2)} espetos`);
      }
    }
    
    setSupplies(updated);
  };

  // NOVO: Selecionar insumo do catálogo global
  const selectGlobalSupply = (index: number, globalSupplyId: string) => {
    const globalSupply = globalSupplies.find((gs) => gs.id === globalSupplyId);
    if (!globalSupply) return;

    const updated = [...supplies];
    updated[index] = {
      globalSupplyId: globalSupply.id,
      name: globalSupply.name,
      category: globalSupply.category,
      costPerUnit: globalSupply.costPerUnit.toString(),
      quantityPerUnit: updated[index].quantityPerUnit || '1',  // Mantém quantidade ou usa 1
      unit: globalSupply.unit,
      notes: updated[index].notes || '',  // Mantém notas ou usa vazio
      isFromCatalog: true,
    };
    setSupplies(updated);
    toast.success(`Insumo "${globalSupply.name}" selecionado do catálogo`);
  };

  // NOVO: Alternar entre catálogo e personalizado
  const toggleSupplySource = (index: number, isFromCatalog: boolean) => {
    const updated = [...supplies];
    updated[index].isFromCatalog = isFromCatalog;
    
    if (!isFromCatalog) {
      // Se mudou para personalizado, limpa o globalSupplyId
      updated[index].globalSupplyId = undefined;
    }
    
    setSupplies(updated);
  };

  const handleSubmit = async () => {
    // Validações
    if (!productId || !name) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    if (ingredients.length === 0) {
      toast.error('Adicione pelo menos um ingrediente');
      return;
    }

    // Validar ingredientes
    for (const ing of ingredients) {
      if (!ing.rawMaterialId || !ing.quantityGrams) {
        toast.error('Preencha todos os campos dos ingredientes');
        return;
      }
    }

    // Validar insumos
    for (const sup of supplies) {
      if (!sup.name || !sup.costPerUnit) {
        toast.error('Preencha todos os campos dos insumos');
        return;
      }
    }

    try {
      setSaving(true);

      const payload = {
        productId,
        name,
        description,
        yieldQuantity: parseInt(yieldQuantity),
        notes,
        ingredients: ingredients.map(ing => ({
          rawMaterialId: ing.rawMaterialId,
          quantityGrams: parseFloat((ing.quantityGrams || '0').replace(',', '.')),
          invisibleWastePercent: parseFloat((ing.invisibleWastePercent || '0').replace(',', '.')),
          visibleWastePercent: parseFloat((ing.visibleWastePercent || '0').replace(',', '.')),
          notes: ing.notes,
          hasIcms: ing.hasIcms || false,
        })),
        supplies: supplies.map(sup => ({
          globalSupplyId: sup.globalSupplyId || null,  // NOVO: Incluir ID do catálogo se existir
          name: sup.name,
          category: sup.category,
          costPerUnit: parseFloat(sup.costPerUnit),
          quantityPerUnit: parseFloat(sup.quantityPerUnit),
          unit: sup.unit,
          notes: sup.notes,
          // 🧂 CAMPOS ESPECIAIS PARA TEMPEROS
          gramsPerKgMeat: sup.gramsPerKgMeat ? parseFloat(sup.gramsPerKgMeat) : null,
          skewerGrams: sup.skewerGrams ? parseFloat(sup.skewerGrams) : null,
        })),
      };

      // Verificar se é edição (tem ID) ou criação/duplicação (não tem ID)
      const isEditing = recipe?.id;
      
      const url = isEditing
        ? `/api/admin/pricing/recipes/${recipe.id}`
        : '/api/admin/pricing/recipes';
      
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao salvar receita');
      }

      toast.success(`Receita ${isEditing ? 'atualizada' : 'criada'} com sucesso!`);
      
      // 💾 MELHORIA 1: Limpar rascunho salvo após sucesso
      if (recipe?.id) {
        localStorage.removeItem(`recipe-draft-edit-${recipe.id}`);
      } else if (recipe && !recipe.id) {
        localStorage.removeItem('recipe-draft-duplicate');
      } else {
        localStorage.removeItem('recipe-draft');
      }
      
      onSuccess();
    } catch (error: any) {
      console.error('Erro:', error);
      toast.error(error.message || 'Erro ao salvar receita');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>
              {recipe?.id ? 'Editar Receita' : recipe ? 'Duplicar Receita' : 'Nova Receita'}
            </DialogTitle>
            {/* 💾 Indicador de auto-save */}
            {autoSaveIndicator && (
              <span className="text-sm text-green-600 animate-pulse">
                {autoSaveIndicator}
              </span>
            )}
          </div>
        </DialogHeader>

        {/* 💾 Banner de rascunho restaurado */}
        {draftRestored && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="text-2xl">🎉</div>
                <div>
                  <h4 className="font-semibold text-green-900">
                    Rascunho Restaurado!
                    {recipe?.id && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">EDIÇÃO</span>}
                    {recipe && !recipe.id && <span className="ml-2 text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">DUPLICAÇÃO</span>}
                    {!recipe && <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">NOVA</span>}
                  </h4>
                  <p className="text-sm text-green-700 mt-1">
                    {recipe?.id 
                      ? 'Suas alterações não salvas foram recuperadas. Continue editando!' 
                      : recipe 
                        ? 'Seus dados de duplicação foram recuperados. Continue personalizando!'
                        : 'Seu trabalho foi recuperado automaticamente. Continue de onde parou!'}
                  </p>
                  <p className="text-xs text-green-600 mt-2">
                    💡 O sistema salva automaticamente a cada alteração para evitar perda de dados.
                  </p>
                </div>
              </div>
              <Button
                onClick={clearDraft}
                variant="ghost"
                size="sm"
                className="text-green-700 hover:text-green-900 hover:bg-green-100"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                {recipe?.id ? 'Descartar Alterações' : 'Limpar e Começar do Zero'}
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informações Básicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="product">Produto *</Label>
                  <Select value={productId} onValueChange={setProductId} disabled={!!recipe?.id}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o produto" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {/* Campo de busca dentro do Select */}
                      <div className="p-2 border-b sticky top-0 bg-white z-10">
                        <Input
                          placeholder="🔍 Buscar produto..."
                          value={productSearchTerm}
                          onChange={(e) => setProductSearchTerm(e.target.value)}
                          className="h-8"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {filteredProducts.length} produto{filteredProducts.length !== 1 ? 's' : ''} encontrado{filteredProducts.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      {filteredProducts.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          <span className={product.isActive === false ? 'text-gray-400' : ''}>
                            {product.name}
                            {product.isActive === false && ' (inativo)'}
                          </span>
                        </SelectItem>
                      ))}
                      {filteredProducts.length === 0 && (
                        <div className="p-4 text-center text-gray-500 text-sm">
                          Nenhum produto encontrado
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  {!recipe?.id && recipe && (
                    <p className="text-xs text-orange-600 mt-1">
                      💡 Duplicando receita - selecione o produto de destino
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="name">Nome da Receita *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Espeto de Fraldinha"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="yieldQuantity">Rendimento (unidades) *</Label>
                  <Input
                    id="yieldQuantity"
                    type="number"
                    value={yieldQuantity}
                    onChange={(e) => setYieldQuantity(e.target.value)}
                    placeholder="1"
                    min="1"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Descrição</Label>
                  <Input
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descrição da receita"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observações gerais"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Ingredients */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Ingredientes</CardTitle>
                <Button onClick={addIngredient} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Ingrediente
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {ingredients.length === 0 ? (
                <p className="text-center text-gray-500 py-4">
                  Nenhum ingrediente adicionado
                </p>
              ) : (
                ingredients.map((ing, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Ingrediente #{index + 1}</h4>
                      <Button
                        onClick={() => removeIngredient(index)}
                        variant="outline"
                        size="sm"
                        className="text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Matéria-Prima *</Label>
                        <Select
                          value={ing.rawMaterialId}
                          onValueChange={(value) =>
                            updateIngredient(index, 'rawMaterialId', value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {rawMaterials.map((rm) => (
                              <SelectItem key={rm.id} value={rm.id}>
                                {rm.name} ({rm.measurementUnit})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {/* Exibir custo da matéria-prima selecionada */}
                        {ing.rawMaterialId && (() => {
                          const selectedMaterial = rawMaterials.find(rm => rm.id === ing.rawMaterialId);
                          if (selectedMaterial) {
                            const baseCost = Number(selectedMaterial.costPerUnit);
                            const icmsRate = (selectedMaterial as any).icmsRate || 0;
                            const costWithIcms = icmsRate > 0 ? baseCost * (1 + icmsRate / 100) : baseCost;
                            return (
                              <div className="mt-1 text-sm">
                                <span className="text-gray-500">Custo: </span>
                                <span className="font-semibold text-green-600">
                                  R$ {costWithIcms.toFixed(2)}/{selectedMaterial.measurementUnit}
                                </span>
                                {icmsRate > 0 && (
                                  <span className="ml-2 text-xs text-orange-600 font-medium">
                                    (+{icmsRate}% ICMS)
                                  </span>
                                )}
                                {selectedMaterial.measurementUnit === 'KG' && (
                                  <span className="text-gray-400 ml-2">
                                    (R$ {(costWithIcms / 1000).toFixed(4)}/g)
                                  </span>
                                )}
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>

                      {/* ICMS agora é definido na matéria-prima, não mais no ingrediente */}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Quantidade (gramas) *</Label>
                        <Input
                          type="text"
                          value={ing.quantityGrams}
                          onChange={(e) =>
                            updateIngredient(index, 'quantityGrams', e.target.value)
                          }
                          placeholder="Ex: 80 ou 110"
                          min="0"
                        />
                        <span className="text-xs text-gray-400">
                          Use ponto ou vírgula (ex: 80.5 ou 80,5)
                        </span>
                      </div>

                      <div>
                        {/* Calcular custo do ingrediente */}
                        <Label>Custo deste ingrediente</Label>
                        {ing.rawMaterialId && ing.quantityGrams && (() => {
                          const selectedMaterial = rawMaterials.find(rm => rm.id === ing.rawMaterialId);
                          // Converter vírgula para ponto
                          const quantityGrams = parseFloat((ing.quantityGrams || '0').replace(',', '.'));
                          
                          if (selectedMaterial && quantityGrams > 0) {
                            // Usar o custo da matéria-prima + ICMS 3.6% (se definido)
                            const baseCostPerUnit = Number(selectedMaterial.costPerUnit);
                            const hasIcms = ((selectedMaterial as any).icmsRate || 0) > 0;
                            const costWithIcms = hasIcms ? baseCostPerUnit * 1.036 : baseCostPerUnit;
                            
                            const costPerGram = selectedMaterial.measurementUnit === 'KG' 
                              ? costWithIcms / 1000 
                              : costWithIcms;
                            const totalCost = costPerGram * quantityGrams;
                            
                            return (
                              <div className="mt-1 p-2 bg-blue-50 rounded border border-blue-200">
                                <span className="font-bold text-blue-700 text-lg">
                                  R$ {totalCost.toFixed(2)}
                                </span>
                                {hasIcms && (
                                  <span className="ml-2 text-xs text-orange-600">(+3,6% ICMS)</span>
                                )}
                              </div>
                            );
                          }
                          return (
                            <div className="mt-1 p-2 bg-gray-100 rounded border">
                              <span className="text-gray-500">R$ 0.00</span>
                            </div>
                          );
                        })()}
                        {(!ing.rawMaterialId || !ing.quantityGrams) && (
                          <div className="mt-1 p-2 bg-gray-100 rounded border">
                            <span className="text-gray-500">Preencha matéria-prima e quantidade</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>% Quebra Invisível (desidratação)</Label>
                        <Input
                          type="number"
                          value={ing.invisibleWastePercent}
                          onChange={(e) =>
                            updateIngredient(index, 'invisibleWastePercent', e.target.value)
                          }
                          placeholder="0"
                          min="0"
                          max="100"
                          step="0.01"
                        />
                      </div>

                      <div>
                        <Label>% Quebra Visível (limpeza)</Label>
                        <Input
                          type="number"
                          value={ing.visibleWastePercent}
                          onChange={(e) =>
                            updateIngredient(index, 'visibleWastePercent', e.target.value)
                          }
                          placeholder="0"
                          min="0"
                          max="100"
                          step="0.01"
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Observações</Label>
                      <Input
                        value={ing.notes}
                        onChange={(e) =>
                          updateIngredient(index, 'notes', e.target.value)
                        }
                        placeholder="Observações sobre este ingrediente"
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Supplies */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Insumos de Produção</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => window.open('/admin/precificacao/insumos', '_blank')}
                    size="sm"
                    variant="outline"
                    className="text-blue-600"
                  >
                    📦 Gerenciar Catálogo
                  </Button>
                  <Button onClick={addSupply} size="sm" variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Insumo
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {supplies.length === 0 ? (
                <p className="text-center text-gray-500 py-4">
                  Nenhum insumo adicionado (opcional)
                </p>
              ) : (
                supplies.map((sup, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Insumo #{index + 1}</h4>
                      <Button
                        onClick={() => removeSupply(index)}
                        variant="outline"
                        size="sm"
                        className="text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* NOVO: Seletor de origem do insumo */}
                    <div>
                      <Label>Origem do Insumo</Label>
                      <Select
                        value={sup.isFromCatalog ? 'catalog' : 'custom'}
                        onValueChange={(value) =>
                          toggleSupplySource(index, value === 'catalog')
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="catalog">
                            📦 Do Catálogo Global
                          </SelectItem>
                          <SelectItem value="custom">
                            ✏️ Personalizado
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Se for do catálogo, mostrar dropdown de seleção */}
                    {sup.isFromCatalog && (
                      <div>
                        <Label>Selecionar Insumo do Catálogo *</Label>
                        <Select
                          value={sup.globalSupplyId || ''}
                          onValueChange={(value) => selectGlobalSupply(index, value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Escolha um insumo..." />
                          </SelectTrigger>
                          <SelectContent>
                            {globalSupplies.length === 0 ? (
                              <div className="p-2 text-sm text-gray-500">
                                Nenhum insumo no catálogo
                              </div>
                            ) : (
                              globalSupplies.map((gs) => (
                                <SelectItem key={gs.id} value={gs.id}>
                                  {gs.name} - R$ {gs.costPerUnit.toFixed(2)}/{gs.unit}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        {sup.globalSupplyId && (
                          <p className="text-xs text-green-600 mt-1">
                            ✅ Dados preenchidos automaticamente do catálogo
                          </p>
                        )}
                      </div>
                    )}

                    {/* Se for personalizado, mostrar campos editáveis */}
                    {!sup.isFromCatalog && (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <Label>Nome *</Label>
                            <Input
                              value={sup.name}
                              onChange={(e) =>
                                updateSupply(index, 'name', e.target.value)
                              }
                              placeholder="Ex: Palito"
                            />
                          </div>

                          <div>
                            <Label>Categoria *</Label>
                            <Select
                              value={sup.category}
                              onValueChange={(value) =>
                                updateSupply(index, 'category', value)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {SUPPLY_CATEGORIES.map((cat) => (
                                  <SelectItem key={cat} value={cat}>
                                    {cat}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label>Custo Unitário (R$) *</Label>
                            <Input
                              type="number"
                              value={sup.costPerUnit}
                              onChange={(e) =>
                                updateSupply(index, 'costPerUnit', e.target.value)
                              }
                              placeholder="0.00"
                              min="0"
                              step="0.01"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label>Unidade</Label>
                            <Input
                              value={sup.unit}
                              onChange={(e) =>
                                updateSupply(index, 'unit', e.target.value)
                              }
                              placeholder="un, kg, g, ml"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* Se for do catálogo, mostrar info readonly */}
                    {sup.isFromCatalog && sup.globalSupplyId && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-blue-50 border border-blue-200 rounded">
                        <div>
                          <Label className="text-xs text-blue-700">Nome</Label>
                          <p className="font-medium text-sm">{sup.name}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-blue-700">Categoria</Label>
                          <p className="font-medium text-sm">{sup.category}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-blue-700">Custo</Label>
                          <p className="font-medium text-sm">
                            R$ {parseFloat(sup.costPerUnit).toFixed(2)}/{sup.unit}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* 🧂 CAMPOS ESPECIAIS PARA TEMPEROS */}
                    {sup.category === 'TEMPERO' && (
                      <div className="p-4 bg-orange-50 border-2 border-orange-300 rounded-lg space-y-3">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-2xl">🧂</span>
                          <div>
                            <h4 className="font-semibold text-orange-800">Cálculo Automático para Tempero</h4>
                            <p className="text-xs text-orange-700">Preencha os campos abaixo para calcular automaticamente quantos espetos você consegue temperar</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label className="text-orange-800">Quantas gramas de tempero por kg de carne? *</Label>
                            <Input
                              type="number"
                              value={sup.gramsPerKgMeat || ''}
                              onChange={(e) =>
                                updateSupply(index, 'gramsPerKgMeat', e.target.value)
                              }
                              placeholder="Ex: 20"
                              min="0"
                              step="1"
                              className="border-orange-300"
                            />
                            <p className="text-xs text-orange-600 mt-1">
                              Exemplo: 20g de tempero para cada 1kg de carne
                            </p>
                          </div>

                          <div>
                            <Label className="text-orange-800">Gramatura do espeto (gramas) *</Label>
                            <Input
                              type="number"
                              value={sup.skewerGrams || ''}
                              onChange={(e) =>
                                updateSupply(index, 'skewerGrams', e.target.value)
                              }
                              placeholder="Ex: 160"
                              min="0"
                              step="1"
                              className="border-orange-300"
                            />
                            <p className="text-xs text-orange-600 mt-1">
                              Exemplo: Espeto de 160g
                            </p>
                          </div>
                        </div>
                        
                        {/* Resultado do cálculo */}
                        {sup.gramsPerKgMeat && sup.skewerGrams && parseFloat(sup.gramsPerKgMeat) > 0 && parseFloat(sup.skewerGrams) > 0 && (
                          <div className="p-3 bg-green-100 border border-green-400 rounded mt-2">
                            <p className="text-sm font-semibold text-green-800">
                              ✅ Resultado: Com 1kg de tempero você consegue temperar aproximadamente{' '}
                              <span className="text-lg font-bold">{parseFloat(sup.quantityPerUnit).toFixed(0)}</span> espetos
                            </p>
                            <p className="text-xs text-green-700 mt-1">
                              Cálculo: 1kg tempero tempera {(1000 / parseFloat(sup.gramsPerKgMeat)).toFixed(1)}kg de carne ÷ {parseFloat(sup.skewerGrams) / 1000}kg por espeto = {parseFloat(sup.quantityPerUnit).toFixed(2)} espetos
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Campos comuns (sempre visíveis) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Quantas unidades eu consigo produzir com este insumo? *</Label>
                        <Input
                          type="number"
                          value={sup.quantityPerUnit}
                          onChange={(e) =>
                            updateSupply(index, 'quantityPerUnit', e.target.value)
                          }
                          placeholder="1"
                          min="0"
                          step="0.01"
                          disabled={!!(sup.category === 'TEMPERO' && sup.gramsPerKgMeat && sup.skewerGrams)}
                          className={sup.category === 'TEMPERO' && sup.gramsPerKgMeat && sup.skewerGrams ? 'bg-green-50 font-semibold text-green-700' : ''}
                        />
                        {sup.category === 'TEMPERO' && sup.gramsPerKgMeat && sup.skewerGrams ? (
                          <p className="text-xs text-green-600 mt-1 font-medium">
                            ✅ Calculado automaticamente com base nos dados do tempero acima
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-1">
                            Exemplo: 1 embalagem (R$ 0,11) produz 5 espetos → Digite 5
                          </p>
                        )}
                      </div>

                      <div>
                        <Label>Observações</Label>
                        <Input
                          value={sup.notes}
                          onChange={(e) =>
                            updateSupply(index, 'notes', e.target.value)
                          }
                          placeholder="Observações sobre este insumo"
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            variant="outline"
            disabled={saving}
          >
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? (
              'Salvando...'
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Salvar Receita
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
