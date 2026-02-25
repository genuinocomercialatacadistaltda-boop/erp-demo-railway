'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { Package, AlertTriangle, CheckCircle, Search, PackageCheck, Boxes, Pencil } from 'lucide-react'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface StockItem {
  id: string
  name: string
  type: 'product' | 'raw_material' | 'supply'
  category: string
  imageUrl: string
  currentStock: number
  minStock: number | null
  maxStock: number | null
  unit: string
  sku?: string | null
  alert: 'LOW_STOCK' | 'HIGH_STOCK' | null
  hasRecipe: boolean
  ingredientsCount: number
}

interface ProductsStockStats {
  totalProducts: number
  totalRawMaterials: number
  totalSupplies: number
  totalItems: number
  productsWithRecipe: number
  productsWithoutRecipe: number
  lowStockCount: number
  highStockCount: number
  totalStock: number
}

export function ProductsStockTab() {
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<StockItem[]>([])
  const [stats, setStats] = useState<ProductsStockStats | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'product' | 'raw_material' | 'supply'>('all')

  // Estados para ajuste de estoque
  const [showAdjustDialog, setShowAdjustDialog] = useState(false)
  const [adjustItem, setAdjustItem] = useState<StockItem | null>(null)
  const [adjustNewStock, setAdjustNewStock] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjustPassword, setAdjustPassword] = useState('')
  const [isAdjusting, setIsAdjusting] = useState(false)

  useEffect(() => {
    fetchStock()
  }, [])

  const fetchStock = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/products/stock')
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao buscar estoque')
      }

      setItems(data.items)
      setStats(data.stats)
    } catch (error: any) {
      console.error('Erro ao buscar estoque:', error)
      toast.error(error.message || 'Erro ao buscar estoque')
    } finally {
      setLoading(false)
    }
  }

  const filteredItems = items.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesType = filterType === 'all' || item.type === filterType

    return matchesSearch && matchesType
  })

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'product': return 'Produto'
      case 'raw_material': return 'Matéria-Prima'
      case 'supply': return 'Insumo'
      default: return type
    }
  }

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'product': return 'bg-green-100 text-green-800'
      case 'raw_material': return 'bg-blue-100 text-blue-800'
      case 'supply': return 'bg-orange-100 text-orange-800'
      default: return ''
    }
  }

  // Função para abrir dialog de ajuste
  const openAdjustDialog = (item: StockItem) => {
    setAdjustItem(item)
    setAdjustNewStock(item.currentStock.toString())
    setShowAdjustDialog(true)
  }

  // Função para ajustar estoque
  const handleAdjustStock = async () => {
    if (!adjustPassword) {
      toast.error('Digite a senha')
      return
    }

    if (!adjustItem || adjustNewStock === '') {
      toast.error('Preencha todos os campos')
      return
    }

    setIsAdjusting(true)
    try {
      const response = await fetch('/api/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: adjustPassword,
          itemId: adjustItem.id,
          itemType: adjustItem.type,
          newStock: parseFloat(adjustNewStock),
          reason: adjustReason || 'Ajuste manual via Controle de Estoque'
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao ajustar estoque')
      }

      toast.success(data.message || 'Estoque ajustado com sucesso!')
      setShowAdjustDialog(false)
      setAdjustPassword('')
      setAdjustItem(null)
      setAdjustNewStock('')
      setAdjustReason('')
      fetchStock() // Recarregar dados
    } catch (error: any) {
      toast.error(error.message || 'Erro ao ajustar estoque')
    } finally {
      setIsAdjusting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Itens</CardTitle>
            <Boxes className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalItems || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.totalProducts || 0} produtos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Matérias-Primas</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats?.totalRawMaterials || 0}</div>
            <p className="text-xs text-muted-foreground">Ingredientes base</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Insumos</CardTitle>
            <PackageCheck className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats?.totalSupplies || 0}</div>
            <p className="text-xs text-muted-foreground">Palitos, embalagens</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estoque Baixo</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats?.lowStockCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">Requer atenção</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estoque Alto</CardTitle>
            <AlertTriangle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats?.highStockCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">Acima do limite</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros e Busca */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Filtro por Tipo */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filterType === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('all')}
            >
              <Boxes className="h-4 w-4 mr-2" />
              Todos ({stats?.totalItems || 0})
            </Button>
            <Button
              variant={filterType === 'product' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('product')}
              className={filterType === 'product' ? '' : 'border-green-200'}
            >
              <PackageCheck className="h-4 w-4 mr-2" />
              Produtos ({stats?.totalProducts || 0})
            </Button>
            <Button
              variant={filterType === 'raw_material' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('raw_material')}
              className={filterType === 'raw_material' ? '' : 'border-blue-200'}
            >
              <Package className="h-4 w-4 mr-2" />
              Matérias-Primas ({stats?.totalRawMaterials || 0})
            </Button>
            <Button
              variant={filterType === 'supply' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('supply')}
              className={filterType === 'supply' ? '' : 'border-orange-200'}
            >
              <Package className="h-4 w-4 mr-2" />
              Insumos ({stats?.totalSupplies || 0})
            </Button>
          </div>

          {/* Busca */}
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, categoria ou SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Items Grid */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <Alert>
          <AlertDescription>
            Nenhum item encontrado.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <div className="aspect-video relative bg-muted">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
              </div>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base">{item.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-sm text-muted-foreground">
                        {item.category}
                      </p>
                      <Badge className={getTypeBadgeColor(item.type)} variant="secondary">
                        {getTypeLabel(item.type)}
                      </Badge>
                    </div>
                    {item.sku && (
                      <p className="text-xs text-muted-foreground mt-1">
                        SKU: {item.sku}
                      </p>
                    )}
                  </div>
                  {item.alert && (
                    <Badge
                      variant={item.alert === 'LOW_STOCK' ? 'destructive' : 'default'}
                      className="ml-2"
                    >
                      {item.alert === 'LOW_STOCK' ? 'Baixo' : 'Alto'}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Estoque Atual */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Estoque Atual:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">
                      {item.currentStock.toFixed(item.type === 'product' ? 0 : 2)} {item.unit}
                    </span>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => openAdjustDialog(item)}
                      className="h-7 w-7 p-0"
                      title="Ajustar estoque"
                    >
                      <Pencil className="h-4 w-4 text-muted-foreground hover:text-primary" />
                    </Button>
                  </div>
                </div>

                {/* Limites */}
                {(item.minStock || item.maxStock) && (
                  <div className="space-y-1">
                    {item.minStock && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Min:</span>
                        <span>{item.minStock.toFixed(item.type === 'product' ? 0 : 2)} {item.unit}</span>
                      </div>
                    )}
                    {item.maxStock && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Max:</span>
                        <span>{item.maxStock.toFixed(item.type === 'product' ? 0 : 2)} {item.unit}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Receita (apenas para produtos) */}
                {item.type === 'product' && (
                  <div className="pt-2 border-t">
                    {item.hasRecipe ? (
                      <div className="flex items-center gap-2 text-xs text-green-600">
                        <CheckCircle className="h-3 w-3" />
                        <span>Receita cadastrada ({item.ingredientsCount} ingredientes)</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-orange-600">
                        <AlertTriangle className="h-3 w-3" />
                        <span>Sem receita cadastrada</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de Ajustar Estoque */}
      <Dialog open={showAdjustDialog} onOpenChange={(open) => {
        setShowAdjustDialog(open)
        if (!open) {
          setAdjustPassword('')
          setAdjustItem(null)
          setAdjustNewStock('')
          setAdjustReason('')
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar Estoque</DialogTitle>
            <DialogDescription>
              {adjustItem ? `Ajustando: ${adjustItem.name}` : 'Selecione um item'}
            </DialogDescription>
          </DialogHeader>

          {adjustItem && (
            <div className="space-y-4 mt-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Estoque Atual:</span>
                  <span className="text-lg font-bold">{adjustItem.currentStock.toFixed(adjustItem.type === 'product' ? 0 : 2)} {adjustItem.unit}</span>
                </div>
              </div>

              <div>
                <Label>Novo Estoque *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Digite o novo valor do estoque"
                  value={adjustNewStock}
                  onChange={(e) => setAdjustNewStock(e.target.value)}
                  className="mt-2"
                />
                {adjustNewStock && adjustItem && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Diferença: {(parseFloat(adjustNewStock) - adjustItem.currentStock).toFixed(2)} {adjustItem.unit}
                  </p>
                )}
              </div>

              <div>
                <Label>Motivo (opcional)</Label>
                <Input
                  placeholder="Ex: Contagem física, Correção de erro"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="mt-2"
                />
              </div>

              <div>
                <Label>Senha de Confirmação *</Label>
                <Input
                  type="password"
                  placeholder="Digite a senha"
                  value={adjustPassword}
                  onChange={(e) => setAdjustPassword(e.target.value)}
                  className="mt-2"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowAdjustDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleAdjustStock} 
              disabled={isAdjusting || !adjustPassword || !adjustItem || adjustNewStock === ''}
            >
              {isAdjusting ? 'Salvando...' : 'Confirmar Ajuste'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
