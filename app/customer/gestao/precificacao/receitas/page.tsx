'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { ChefHat, Home, ArrowLeft, Plus, Edit, Trash2, Package, Layers } from 'lucide-react'

interface Ingredient {
  id?: string
  rawMaterialId: string
  rawMaterialName: string
  quantityGrams: number
  invisibleWastePercent: number
  visibleWastePercent: number
  costPerGram: number
}

interface Supply {
  id?: string
  globalSupplyId?: string
  name: string
  category: string
  costPerUnit: number
  quantityUsed: number
  unit: string
  isFromCatalog?: boolean
}

interface Recipe {
  id: string
  name: string
  description: string
  yieldQuantity: number
  notes: string
  isActive: boolean
  Ingredients: Ingredient[]
  Supplies: Supply[]
  ingredientsCost?: number
  suppliesCost?: number
  totalCost?: number
}

interface GlobalSupply {
  id: string
  name: string
  category: string
  costPerUnit: number
  unit: string
}

interface RawMaterial {
  id: string
  name: string
  costPerUnit: number
}

export default function ClientReceitasPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([])
  const [globalSupplies, setGlobalSupplies] = useState<GlobalSupply[]>([])
  const [showDialog, setShowDialog] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null)
  const [saving, setSaving] = useState(false)

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    yieldQuantity: 1,
    notes: '',
    isActive: true
  })
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [supplies, setSupplies] = useState<Supply[]>([])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }

    if (status === 'authenticated' && session?.user) {
      const userType = (session.user as any)?.userType
      if (userType !== 'CUSTOMER') {
        toast.error('Acesso não autorizado')
        router.push('/customer/gestao')
        return
      }

      loadData()
    }
  }, [status, session, router])

  const loadData = async () => {
    try {
      setLoading(true)

      // Load recipes
      const recipesRes = await fetch('/api/client-management/pricing/recipes')
      if (recipesRes.ok) {
        const recipesData = await recipesRes.json()
        setRecipes(recipesData)
      }

      // Load raw materials (from customer's catalog)
      const rawMaterialsRes = await fetch('/api/raw-materials')
      if (rawMaterialsRes.ok) {
        const rawMaterialsData = await rawMaterialsRes.json()
        setRawMaterials(rawMaterialsData.filter((rm: any) => rm.isActive))
      }

      // Load global supplies (from customer's catalog)
      const suppliesRes = await fetch('/api/client-management/pricing/supplies?isActive=true')
      if (suppliesRes.ok) {
        const suppliesData = await suppliesRes.json()
        setGlobalSupplies(suppliesData)
      }

      setLoading(false)
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      toast.error('Erro ao carregar dados')
      setLoading(false)
    }
  }

  const handleOpenDialog = (recipe?: Recipe) => {
    if (recipe) {
      setEditingRecipe(recipe)
      setFormData({
        name: recipe.name,
        description: recipe.description || '',
        yieldQuantity: recipe.yieldQuantity,
        notes: recipe.notes || '',
        isActive: recipe.isActive
      })
      setIngredients(recipe.Ingredients || [])
      setSupplies(recipe.Supplies || [])
    } else {
      setEditingRecipe(null)
      setFormData({
        name: '',
        description: '',
        yieldQuantity: 1,
        notes: '',
        isActive: true
      })
      setIngredients([])
      setSupplies([])
    }
    setShowDialog(true)
  }

  const handleSave = async () => {
    if (!formData.name || formData.yieldQuantity <= 0) {
      toast.error('Preencha o nome e o rendimento')
      return
    }

    try {
      setSaving(true)

      const payload = {
        ...formData,
        ingredients: ingredients.map(ing => ({
          rawMaterialId: ing.rawMaterialId,
          rawMaterialName: ing.rawMaterialName,
          quantityGrams: ing.quantityGrams,
          invisibleWastePercent: ing.invisibleWastePercent,
          visibleWastePercent: ing.visibleWastePercent,
          costPerGram: ing.costPerGram
        })),
        supplies: supplies.map(sup => ({
          globalSupplyId: sup.globalSupplyId || undefined,
          name: sup.name,
          category: sup.category,
          costPerUnit: sup.costPerUnit,
          quantityUsed: sup.quantityUsed,
          unit: sup.unit
        }))
      }

      const url = editingRecipe
        ? `/api/client-management/pricing/recipes/${editingRecipe.id}`
        : '/api/client-management/pricing/recipes'

      const method = editingRecipe ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        toast.success(`Receita ${editingRecipe ? 'atualizada' : 'criada'} com sucesso!`)
        setShowDialog(false)
        loadData()
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Erro ao salvar receita')
      }
    } catch (error) {
      console.error('Erro ao salvar receita:', error)
      toast.error('Erro ao salvar receita')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (recipeId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta receita?')) return

    try {
      const response = await fetch(`/api/client-management/pricing/recipes/${recipeId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Receita excluída com sucesso!')
        loadData()
      } else {
        toast.error('Erro ao excluir receita')
      }
    } catch (error) {
      console.error('Erro ao excluir receita:', error)
      toast.error('Erro ao excluir receita')
    }
  }

  // Ingredient management
  const addIngredient = () => {
    setIngredients([...ingredients, {
      rawMaterialId: '',
      rawMaterialName: '',
      quantityGrams: 0,
      invisibleWastePercent: 0,
      visibleWastePercent: 0,
      costPerGram: 0
    }])
  }

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index))
  }

  const updateIngredient = (index: number, field: string, value: any) => {
    const updated = [...ingredients]
    ;(updated[index] as any)[field] = value

    // Auto-populate name and cost when raw material is selected
    if (field === 'rawMaterialId') {
      const rawMaterial = rawMaterials.find(rm => rm.id === value)
      if (rawMaterial) {
        updated[index].rawMaterialName = rawMaterial.name
        updated[index].costPerGram = rawMaterial.costPerUnit
      }
    }

    setIngredients(updated)
  }

  // Supply management
  const addSupply = () => {
    setSupplies([...supplies, {
      name: '',
      category: '',
      costPerUnit: 0,
      quantityUsed: 0,
      unit: 'unidade',
      isFromCatalog: false
    }])
  }

  const removeSupply = (index: number) => {
    setSupplies(supplies.filter((_, i) => i !== index))
  }

  const updateSupply = (index: number, field: string, value: any) => {
    const updated = [...supplies]
    ;(updated[index] as any)[field] = value
    setSupplies(updated)
  }

  const selectGlobalSupply = (index: number, supplyId: string) => {
    const globalSupply = globalSupplies.find(gs => gs.id === supplyId)
    if (globalSupply) {
      const updated = [...supplies]
      updated[index] = {
        ...updated[index],
        globalSupplyId: globalSupply.id,
        name: globalSupply.name,
        category: globalSupply.category,
        costPerUnit: globalSupply.costPerUnit,
        unit: globalSupply.unit,
        isFromCatalog: true
      }
      setSupplies(updated)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando receitas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ChefHat className="h-8 w-8 text-orange-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Receitas</h1>
              <p className="text-gray-600">Gerencie as receitas dos seus produtos</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => router.push('/customer/gestao')}
            >
              <Home className="mr-2 h-4 w-4" />
              Página Inicial
            </Button>
            <Button
              variant="outline"
              onClick={() => router.back()}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => router.push('/customer/gestao/precificacao/insumos')}
            variant="outline"
            className="border-orange-600 text-orange-600 hover:bg-orange-50"
          >
            <Package className="mr-2 h-4 w-4" />
            Catálogo de Insumos
          </Button>
          <Button
            onClick={() => router.push('/customer/gestao/precificacao/rentabilidade')}
            variant="outline"
            className="border-green-600 text-green-600 hover:bg-green-50"
          >
            <Layers className="mr-2 h-4 w-4" />
            Dashboard de Rentabilidade
          </Button>
          <Button
            onClick={() => handleOpenDialog()}
            className="bg-orange-600 hover:bg-orange-700 text-white ml-auto"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova Receita
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Total de Receitas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{recipes.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Receitas Ativas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {recipes.filter(r => r.isActive).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Custo Médio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {recipes.length > 0
                ? formatCurrency(
                    recipes.reduce((sum, r) => sum + (r.totalCost || 0), 0) / recipes.length
                  )
                : 'R$ 0,00'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recipes List */}
      <div className="grid grid-cols-1 gap-6">
        {recipes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ChefHat className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg mb-4">Nenhuma receita cadastrada</p>
              <Button
                onClick={() => handleOpenDialog()}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Plus className="mr-2 h-4 w-4" />
                Criar Primeira Receita
              </Button>
            </CardContent>
          </Card>
        ) : (
          recipes.map(recipe => (
            <Card key={recipe.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle>{recipe.name}</CardTitle>
                      {recipe.isActive ? (
                        <Badge variant="default" className="bg-green-600">Ativa</Badge>
                      ) : (
                        <Badge variant="secondary">Inativa</Badge>
                      )}
                    </div>
                    {recipe.description && (
                      <CardDescription>{recipe.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDialog(recipe)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(recipe.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-600">Rendimento</p>
                    <p className="text-lg font-semibold">{recipe.yieldQuantity} unidades</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Custo Ingredientes</p>
                    <p className="text-lg font-semibold text-orange-600">
                      {formatCurrency(recipe.ingredientsCost || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Custo Insumos</p>
                    <p className="text-lg font-semibold text-blue-600">
                      {formatCurrency(recipe.suppliesCost || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Custo Total</p>
                    <p className="text-lg font-semibold text-green-600">
                      {formatCurrency(recipe.totalCost || 0)}
                    </p>
                  </div>
                </div>

                {recipe.Ingredients && recipe.Ingredients.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-semibold mb-2 text-gray-700">Ingredientes:</h4>
                    <div className="space-y-1">
                      {recipe.Ingredients.map((ing, idx) => (
                        <div key={idx} className="text-sm text-gray-600">
                          • {ing.rawMaterialName} - {ing.quantityGrams}g
                          {(ing.invisibleWastePercent + ing.visibleWastePercent) > 0 && (
                            <span className="text-orange-600 ml-1">
                              (Quebra: {ing.invisibleWastePercent + ing.visibleWastePercent}%)
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {recipe.Supplies && recipe.Supplies.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2 text-gray-700">Insumos:</h4>
                    <div className="space-y-1">
                      {recipe.Supplies.map((sup, idx) => (
                        <div key={idx} className="text-sm text-gray-600">
                          • {sup.name} - {sup.quantityUsed} {sup.unit}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRecipe ? 'Editar Receita' : 'Nova Receita'}
            </DialogTitle>
            <DialogDescription>
              Defina os ingredientes e insumos necessários para produzir este produto
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nome da Receita *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Espeto de Frango"
                />
              </div>
              <div>
                <Label>Rendimento (unidades) *</Label>
                <Input
                  type="number"
                  value={formData.yieldQuantity}
                  onChange={(e) => setFormData({ ...formData, yieldQuantity: parseFloat(e.target.value) || 1 })}
                  min="1"
                  step="1"
                />
              </div>
            </div>

            <div>
              <Label>Descrição</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição da receita..."
              />
            </div>

            {/* Ingredients */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-lg font-semibold">Ingredientes</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addIngredient}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </div>

              <div className="space-y-3">
                {ingredients.map((ing, index) => (
                  <Card key={index} className="p-3">
                    <div className="grid grid-cols-6 gap-2 items-end">
                      <div className="col-span-2">
                        <Label className="text-xs">Matéria-Prima</Label>
                        <Select
                          value={ing.rawMaterialId}
                          onValueChange={(value) => updateIngredient(index, 'rawMaterialId', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {rawMaterials.map(rm => (
                              <SelectItem key={rm.id} value={rm.id}>
                                {rm.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-xs">Quantidade (g)</Label>
                        <Input
                          type="number"
                          value={ing.quantityGrams}
                          onChange={(e) => updateIngredient(index, 'quantityGrams', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Quebra Invisível (%)</Label>
                        <Input
                          type="number"
                          value={ing.invisibleWastePercent}
                          onChange={(e) => updateIngredient(index, 'invisibleWastePercent', parseFloat(e.target.value) || 0)}
                          min="0"
                          max="100"
                          step="0.1"
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Quebra Visível (%)</Label>
                        <Input
                          type="number"
                          value={ing.visibleWastePercent}
                          onChange={(e) => updateIngredient(index, 'visibleWastePercent', parseFloat(e.target.value) || 0)}
                          min="0"
                          max="100"
                          step="0.1"
                        />
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeIngredient(index)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Supplies */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-lg font-semibold">Insumos de Produção</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => router.push('/customer/gestao/precificacao/insumos')}
                  >
                    Gerenciar Catálogo
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addSupply}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {supplies.map((sup, index) => (
                  <Card key={index} className="p-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Origem</Label>
                        <Select
                          value={sup.isFromCatalog ? 'catalog' : 'custom'}
                          onValueChange={(value) => {
                            const updated = [...supplies]
                            updated[index].isFromCatalog = value === 'catalog'
                            if (value === 'custom') {
                              updated[index].globalSupplyId = undefined
                            }
                            setSupplies(updated)
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="catalog">Do Catálogo Global</SelectItem>
                            <SelectItem value="custom">Personalizado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {sup.isFromCatalog ? (
                        <div>
                          <Label className="text-xs">Selecionar do Catálogo</Label>
                          <Select
                            value={sup.globalSupplyId || ''}
                            onValueChange={(value) => selectGlobalSupply(index, value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Escolha um insumo" />
                            </SelectTrigger>
                            <SelectContent>
                              {globalSupplies.map(gs => (
                                <SelectItem key={gs.id} value={gs.id}>
                                  {gs.name} ({gs.category}) - {formatCurrency(gs.costPerUnit)}/{gs.unit}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {sup.globalSupplyId && (
                            <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                              <p><strong>Nome:</strong> {sup.name}</p>
                              <p><strong>Categoria:</strong> {sup.category}</p>
                              <p><strong>Custo:</strong> {formatCurrency(sup.costPerUnit)}/{sup.unit}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-5 gap-2">
                          <div>
                            <Label className="text-xs">Nome</Label>
                            <Input
                              value={sup.name}
                              onChange={(e) => updateSupply(index, 'name', e.target.value)}
                              placeholder="Nome"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Categoria</Label>
                            <Select
                              value={sup.category}
                              onValueChange={(value) => updateSupply(index, 'category', value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Categoria" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Embalagem">Embalagem</SelectItem>
                                <SelectItem value="Utensílio">Utensílio</SelectItem>
                                <SelectItem value="Consumível">Consumível</SelectItem>
                                <SelectItem value="Outros">Outros</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Custo Unitário</Label>
                            <Input
                              type="number"
                              value={sup.costPerUnit}
                              onChange={(e) => updateSupply(index, 'costPerUnit', parseFloat(e.target.value) || 0)}
                              min="0"
                              step="0.01"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Unidade</Label>
                            <Select
                              value={sup.unit}
                              onValueChange={(value) => updateSupply(index, 'unit', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unidade">unidade</SelectItem>
                                <SelectItem value="kg">kg</SelectItem>
                                <SelectItem value="g">g</SelectItem>
                                <SelectItem value="L">L</SelectItem>
                                <SelectItem value="ml">ml</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Quantidade Usada</Label>
                          <Input
                            type="number"
                            value={sup.quantityUsed}
                            onChange={(e) => updateSupply(index, 'quantityUsed', parseFloat(e.target.value) || 0)}
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div className="flex items-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeSupply(index)}
                            className="text-red-600 w-full"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Remover
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Notes and Status */}
            <div>
              <Label>Observações</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Observações adicionais..."
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="isActive">Receita Ativa</Label>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setShowDialog(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {saving ? 'Salvando...' : 'Salvar Receita'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
