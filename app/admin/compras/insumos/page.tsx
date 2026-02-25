'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Package, Plus, Edit, Trash2, ArrowLeft, AlertTriangle, TrendingUp, TrendingDown, History } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'

interface Supply {
  id: string
  name: string
  category: string
  costPerUnit: number
  unit: string
  description?: string
  notes?: string
  currentStock: number
  minStock: number
  maxStock?: number
  sku?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  ProductionSupplies: any[]
  _count: {
    PurchaseSupplyItems: number
    SupplyMovements: number
  }
}

interface FormData {
  name: string
  category: string
  costPerUnit: string
  unit: string
  description: string
  notes: string
  currentStock: string
  minStock: string
  maxStock: string
  sku: string
}

const CATEGORIES = [
  { value: 'PALITO', label: '🔸 Palitos' },
  { value: 'EMBALAGEM', label: '📦 Embalagens' },
  { value: 'TEMPERO', label: '🧂 Temperos' },
  { value: 'OUTRO', label: '📌 Outros' }
]

const UNITS = [
  { value: 'un', label: 'Unidade (un)' },
  { value: 'kg', label: 'Quilograma (kg)' },
  { value: 'g', label: 'Grama (g)' },
  { value: 'l', label: 'Litro (l)' },
  { value: 'ml', label: 'Mililitro (ml)' }
]

export default function InsumosPage() {
  const router = useRouter()
  const [supplies, setSupplies] = useState<Supply[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSupply, setEditingSupply] = useState<Supply | null>(null)
  const [formData, setFormData] = useState<FormData>({
    name: '',
    category: 'PALITO',
    costPerUnit: '',
    unit: 'un',
    description: '',
    notes: '',
    currentStock: '0',
    minStock: '0',
    maxStock: '',
    sku: ''
  })

  useEffect(() => {
    fetchSupplies()
  }, [])

  const fetchSupplies = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/supplies')
      const data = await res.json()
      
      if (res.ok) {
        setSupplies(data)
        console.log('[INSUMOS] Carregados:', data.length)
      } else {
        toast.error('Erro ao carregar insumos')
      }
    } catch (error: any) {
      console.error('[INSUMOS] Erro:', error)
      toast.error('Erro ao carregar insumos')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDialog = (supply?: Supply) => {
    if (supply) {
      setEditingSupply(supply)
      setFormData({
        name: supply.name,
        category: supply.category,
        costPerUnit: supply.costPerUnit.toString(),
        unit: supply.unit,
        description: supply.description || '',
        notes: supply.notes || '',
        currentStock: supply.currentStock.toString(),
        minStock: supply.minStock.toString(),
        maxStock: supply.maxStock?.toString() || '',
        sku: supply.sku || ''
      })
    } else {
      setEditingSupply(null)
      setFormData({
        name: '',
        category: 'PALITO',
        costPerUnit: '',
        unit: 'un',
        description: '',
        notes: '',
        currentStock: '0',
        minStock: '0',
        maxStock: '',
        sku: ''
      })
    }
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!formData.name || !formData.costPerUnit) {
      toast.error('Preencha nome e custo unitário')
      return
    }

    try {
      const url = editingSupply ? `/api/supplies/${editingSupply.id}` : '/api/supplies'
      const method = editingSupply ? 'PUT' : 'POST'

      const payload = {
        name: formData.name,
        category: formData.category,
        costPerUnit: parseFloat(formData.costPerUnit),
        unit: formData.unit,
        description: formData.description || null,
        notes: formData.notes || null,
        currentStock: parseFloat(formData.currentStock || '0'),
        minStock: parseFloat(formData.minStock || '0'),
        maxStock: formData.maxStock ? parseFloat(formData.maxStock) : null,
        sku: formData.sku || null
      }

      console.log('[INSUMO_SUBMIT] Enviando:', payload)

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (res.ok) {
        toast.success(editingSupply ? 'Insumo atualizado!' : 'Insumo criado!')
        setDialogOpen(false)
        fetchSupplies()
      } else {
        toast.error(data.error || 'Erro ao salvar insumo')
      }
    } catch (error: any) {
      console.error('[INSUMO_SUBMIT] Erro:', error)
      toast.error('Erro ao salvar insumo')
    }
  }

  const handleDelete = async (supply: Supply) => {
    if (!confirm(`Deletar "${supply.name}"?`)) return

    try {
      const res = await fetch(`/api/supplies/${supply.id}`, { method: 'DELETE' })
      const data = await res.json()

      if (res.ok) {
        toast.success('Insumo deletado!')
        fetchSupplies()
      } else {
        toast.error(data.error || 'Erro ao deletar')
      }
    } catch (error: any) {
      console.error('[INSUMO_DELETE] Erro:', error)
      toast.error('Erro ao deletar insumo')
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'PALITO': return '🔸'
      case 'EMBALAGEM': return '📦'
      case 'TEMPERO': return '🧂'
      default: return '📌'
    }
  }

  const getStockStatus = (supply: Supply) => {
    if (supply.currentStock <= supply.minStock) {
      return { color: 'text-red-600', icon: AlertTriangle, text: 'Crítico' }
    } else if (supply.currentStock <= supply.minStock * 1.5) {
      return { color: 'text-yellow-600', icon: TrendingDown, text: 'Baixo' }
    } else {
      return { color: 'text-green-600', icon: TrendingUp, text: 'OK' }
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Package className="h-8 w-8 text-orange-600" />
            Gestão de Insumos
          </h1>
          <p className="text-gray-600 mt-1">Palitos, embalagens, temperos e outros insumos</p>
        </div>
        <Button
          onClick={() => handleOpenDialog()}
          className="bg-orange-600 hover:bg-orange-700 flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Novo Insumo
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total de Insumos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{supplies.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Estoque Crítico</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {supplies.filter(s => s.currentStock <= s.minStock).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Estoque Baixo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {supplies.filter(s => s.currentStock > s.minStock && s.currentStock <= s.minStock * 1.5).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Estoque OK</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {supplies.filter(s => s.currentStock > s.minStock * 1.5).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Supplies Grid */}
      {supplies.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Nenhum insumo cadastrado</p>
            <p className="text-gray-400 text-sm mt-2">Clique em "Novo Insumo" para começar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {supplies.map((supply) => {
            const stockStatus = getStockStatus(supply)
            const StockIcon = stockStatus.icon

            return (
              <Card key={supply.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <span>{getCategoryIcon(supply.category)}</span>
                        {supply.name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        <Badge variant="outline">
                          {CATEGORIES.find(c => c.value === supply.category)?.label || supply.category}
                        </Badge>
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(supply)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(supply)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Estoque */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Estoque:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          {supply.currentStock.toFixed(2)} {supply.unit}
                        </span>
                        <Badge variant="outline" className={stockStatus.color}>
                          <StockIcon className="h-3 w-3 mr-1" />
                          {stockStatus.text}
                        </Badge>
                      </div>
                    </div>

                    {/* Estoque Mínimo */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Mínimo:</span>
                      <span className="text-gray-900">{supply.minStock.toFixed(2)} {supply.unit}</span>
                    </div>

                    {/* Custo Unitário */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Custo:</span>
                      <span className="font-medium">R$ {supply.costPerUnit.toFixed(2)}/{supply.unit}</span>
                    </div>

                    {/* SKU */}
                    {supply.sku && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">SKU:</span>
                        <Badge variant="secondary">{supply.sku}</Badge>
                      </div>
                    )}

                    {/* Estatísticas */}
                    <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t">
                      <span>{supply._count.PurchaseSupplyItems} compras</span>
                      <span>{supply._count.SupplyMovements} movimentações</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Dialog Create/Edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSupply ? 'Editar Insumo' : 'Novo Insumo'}
            </DialogTitle>
            <DialogDescription>
              {editingSupply
                ? 'Atualize as informações do insumo'
                : 'Cadastre um novo insumo de produção'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Nome */}
            <div>
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Palito 15cm, Embalagem 100g"
              />
            </div>

            {/* Categoria e Unidade */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Categoria *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="unit">Unidade *</Label>
                <Select
                  value={formData.unit}
                  onValueChange={(value) => setFormData({ ...formData, unit: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map(unit => (
                      <SelectItem key={unit.value} value={unit.value}>
                        {unit.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Custo e SKU */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="costPerUnit">Custo Unitário (R$) *</Label>
                <Input
                  id="costPerUnit"
                  type="number"
                  step="0.01"
                  value={formData.costPerUnit}
                  onChange={(e) => setFormData({ ...formData, costPerUnit: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div>
                <Label htmlFor="sku">SKU (Código)</Label>
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="Opcional"
                />
              </div>
            </div>

            {/* Estoques */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="currentStock">Estoque Atual</Label>
                <Input
                  id="currentStock"
                  type="number"
                  step="0.01"
                  value={formData.currentStock}
                  onChange={(e) => setFormData({ ...formData, currentStock: e.target.value })}
                  placeholder="0"
                />
              </div>

              <div>
                <Label htmlFor="minStock">Estoque Mínimo</Label>
                <Input
                  id="minStock"
                  type="number"
                  step="0.01"
                  value={formData.minStock}
                  onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                  placeholder="0"
                />
              </div>

              <div>
                <Label htmlFor="maxStock">Estoque Máximo</Label>
                <Input
                  id="maxStock"
                  type="number"
                  step="0.01"
                  value={formData.maxStock}
                  onChange={(e) => setFormData({ ...formData, maxStock: e.target.value })}
                  placeholder="Opcional"
                />
              </div>
            </div>

            {/* Descrição */}
            <div>
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição detalhada do insumo"
                rows={2}
              />
            </div>

            {/* Observações */}
            <div>
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Observações adicionais"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} className="bg-orange-600 hover:bg-orange-700">
              {editingSupply ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
