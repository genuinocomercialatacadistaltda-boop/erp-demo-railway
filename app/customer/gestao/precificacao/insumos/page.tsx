'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Package, Plus, Edit, Trash2, Home, ArrowLeft, Calculator } from 'lucide-react'

interface GlobalSupply {
  id: string
  name: string
  category: string
  costPerUnit: number
  unit: string
  description?: string
  notes?: string
  isActive: boolean
  _count?: {
    ProductionSupplies: number
  }
}

const SUPPLY_CATEGORIES = [
  { value: 'EMBALAGEM', label: 'Embalagem' },
  { value: 'PALITO', label: 'Palito' },
  { value: 'TEMPERO', label: 'Tempero/Condimento' },
  { value: 'GAS', label: 'Gás' },
  { value: 'ENERGIA', label: 'Energia' },
  { value: 'MATERIAL_LIMPEZA', label: 'Material de Limpeza' },
  { value: 'OUTRO', label: 'Outro' }
]

const UNITS = [
  { value: 'un', label: 'Unidade (un)' },
  { value: 'kg', label: 'Quilograma (kg)' },
  { value: 'g', label: 'Grama (g)' },
  { value: 'l', label: 'Litro (l)' },
  { value: 'ml', label: 'Mililitro (ml)' },
  { value: 'm', label: 'Metro (m)' },
  { value: 'cm', label: 'Centímetro (cm)' }
]

export default function ClientInsumosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [supplies, setSupplies] = useState<GlobalSupply[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [editingSupply, setEditingSupply] = useState<GlobalSupply | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category: 'EMBALAGEM',
    costPerUnit: '',
    unit: 'un',
    description: '',
    notes: ''
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }

    if (status === 'authenticated') {
      const user = session?.user as any
      if (user?.userType !== 'CUSTOMER') {
        toast.error('Acesso negado')
        router.push('/customer/gestao')
        return
      }
      loadSupplies()
    }
  }, [status, session, router])

  const loadSupplies = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/client-management/pricing/supplies')
      
      if (!response.ok) throw new Error('Erro ao carregar insumos')
      
      const data = await response.json()
      setSupplies(data)
      console.log(`✅ ${data.length} insumos carregados`)
    } catch (error: any) {
      console.error('❌ Erro ao carregar insumos:', error)
      toast.error('Erro ao carregar insumos')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDialog = (supply?: GlobalSupply) => {
    if (supply) {
      setEditingSupply(supply)
      setFormData({
        name: supply.name,
        category: supply.category,
        costPerUnit: supply.costPerUnit.toString(),
        unit: supply.unit,
        description: supply.description || '',
        notes: supply.notes || ''
      })
    } else {
      setEditingSupply(null)
      setFormData({
        name: '',
        category: 'EMBALAGEM',
        costPerUnit: '',
        unit: 'un',
        description: '',
        notes: ''
      })
    }
    setShowDialog(true)
  }

  const handleCloseDialog = () => {
    setShowDialog(false)
    setEditingSupply(null)
    setFormData({
      name: '',
      category: 'EMBALAGEM',
      costPerUnit: '',
      unit: 'un',
      description: '',
      notes: ''
    })
  }

  const handleSave = async () => {
    try {
      // Validações
      if (!formData.name || !formData.costPerUnit) {
        toast.error('Preencha nome e custo por unidade')
        return
      }

      const cost = parseFloat(formData.costPerUnit)
      if (isNaN(cost) || cost < 0) {
        toast.error('Custo inválido')
        return
      }

      setSaving(true)

      const payload = {
        name: formData.name,
        category: formData.category,
        costPerUnit: cost,
        unit: formData.unit,
        description: formData.description || null,
        notes: formData.notes || null
      }

      const url = editingSupply
        ? `/api/client-management/pricing/supplies/${editingSupply.id}`
        : '/api/client-management/pricing/supplies'
      
      const method = editingSupply ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao salvar insumo')
      }

      toast.success(editingSupply ? 'Insumo atualizado com sucesso!' : 'Insumo criado com sucesso!')
      handleCloseDialog()
      loadSupplies()
    } catch (error: any) {
      console.error('❌ Erro ao salvar insumo:', error)
      toast.error(error.message || 'Erro ao salvar insumo')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (supply: GlobalSupply) => {
    if (!confirm(`Tem certeza que deseja excluir "${supply.name}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/client-management/pricing/supplies/${supply.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.details || error.error || 'Erro ao excluir insumo')
      }

      toast.success('Insumo excluído com sucesso!')
      loadSupplies()
    } catch (error: any) {
      console.error('❌ Erro ao excluir insumo:', error)
      toast.error(error.message || 'Erro ao excluir insumo')
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const getCategoryLabel = (category: string) => {
    return SUPPLY_CATEGORIES.find(c => c.value === category)?.label || category
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      EMBALAGEM: 'bg-blue-100 text-blue-800',
      PALITO: 'bg-green-100 text-green-800',
      TEMPERO: 'bg-yellow-100 text-yellow-800',
      GAS: 'bg-red-100 text-red-800',
      ENERGIA: 'bg-purple-100 text-purple-800',
      MATERIAL_LIMPEZA: 'bg-cyan-100 text-cyan-800',
      OUTRO: 'bg-gray-100 text-gray-800'
    }
    return colors[category] || colors.OUTRO
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Calculator className="w-12 h-12 text-amber-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Carregando insumos...</p>
        </div>
      </div>
    )
  }

  const activeSupplies = supplies.filter(s => s.isActive)
  const inactiveSupplies = supplies.filter(s => !s.isActive)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-amber-600 to-yellow-600 text-white py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Button
                onClick={() => window.location.href = '/customer/gestao'}
                variant="outline"
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
              >
                <Home className="w-4 h-4 mr-2" />
                Página Inicial
              </Button>
              <Button
                onClick={() => window.history.back()}
                variant="outline"
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Package className="w-8 h-8" />
                Catálogo de Insumos
              </h1>
              <p className="text-white/90 mt-2">
                Gerencie insumos reutilizáveis em várias receitas
              </p>
            </div>
            <Button
              onClick={() => handleOpenDialog()}
              className="bg-white text-amber-600 hover:bg-white/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Novo Insumo
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total de Insumos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600">
                {supplies.length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Insumos Ativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {activeSupplies.length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Custo Médio por Insumo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {supplies.length > 0
                  ? formatCurrency(
                      supplies.reduce((sum, s) => sum + s.costPerUnit, 0) /
                        supplies.length
                    )
                  : formatCurrency(0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Insumos */}
        <Card>
          <CardHeader>
            <CardTitle>Insumos Cadastrados</CardTitle>
          </CardHeader>
          <CardContent>
            {supplies.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg mb-2">
                  Nenhum insumo cadastrado
                </p>
                <p className="text-gray-400 text-sm mb-4">
                  Comece criando seu primeiro insumo de produção
                </p>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Primeiro Insumo
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {supplies.map((supply) => (
                  <div
                    key={supply.id}
                    className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold">{supply.name}</h3>
                          <Badge className={getCategoryColor(supply.category)}>
                            {getCategoryLabel(supply.category)}
                          </Badge>
                          {!supply.isActive && (
                            <Badge variant="secondary">Inativo</Badge>
                          )}
                        </div>
                        
                        {supply.description && (
                          <p className="text-gray-600 text-sm mb-2">
                            {supply.description}
                          </p>
                        )}

                        <div className="flex items-center gap-6 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Custo: </span>
                            <span className="text-amber-600 font-semibold">
                              {formatCurrency(supply.costPerUnit)}/{supply.unit}
                            </span>
                          </div>
                          {supply._count && supply._count.ProductionSupplies > 0 && (
                            <div>
                              <span className="font-medium">Usado em: </span>
                              <span className="text-blue-600 font-semibold">
                                {supply._count.ProductionSupplies} receita(s)
                              </span>
                            </div>
                          )}
                        </div>

                        {supply.notes && (
                          <p className="text-gray-500 text-xs mt-2 italic">
                            Obs: {supply.notes}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDialog(supply)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(supply)}
                          className="text-red-600 hover:bg-red-50"
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
      </div>

      {/* Dialog de Criação/Edição */}
      <Dialog open={showDialog} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSupply ? 'Editar Insumo' : 'Novo Insumo'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nome do Insumo *</Label>
              <Input
                id="name"
                placeholder="Ex: Palito Padrão 15cm"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

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
                    {SUPPLY_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="unit">Unidade de Medida</Label>
                <Select
                  value={formData.unit}
                  onValueChange={(value) => setFormData({ ...formData, unit: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((unit) => (
                      <SelectItem key={unit.value} value={unit.value}>
                        {unit.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="costPerUnit">Custo por Unidade (R$) *</Label>
              <Input
                id="costPerUnit"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.costPerUnit}
                onChange={(e) => setFormData({ ...formData, costPerUnit: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                placeholder="Descrição detalhada do insumo..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                placeholder="Observações adicionais..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : editingSupply ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
