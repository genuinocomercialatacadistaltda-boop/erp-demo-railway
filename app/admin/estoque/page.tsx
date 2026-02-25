'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { 
  Package, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Plus,
  Home,
  ArrowLeft,
  DollarSign,
  Activity,
  PackageX,
  PackageCheck,
  Pencil,
  RotateCcw
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ProductionTab } from './_components/production-tab'
import { GoalsTab } from './_components/goals-tab'
import { ProductsStockTab } from './_components/products-stock-tab'

interface RawMaterial {
  id: string
  name: string
  sku: string | null
  currentStock: number
  measurementUnit: string
}

interface InventoryStats {
  summary: {
    totalMaterials: number
    totalValue: number
    lowStock: number
    outOfStock: number
    recentMovements: number
  }
  movementsByType: Array<{
    type: string
    count: number
  }>
  topMaterials: Array<{
    id: string
    name: string
    sku: string | null
    currentStock: number
    measurementUnit: string
    movementCount: number
  }>
}

interface Alert {
  id: string
  name: string
  sku: string | null
  currentStock: number
  minStock: number | null
  maxStock: number | null
  measurementUnit: string
  imageUrl: string | null
  alertSeverity: 'OUT_OF_STOCK' | 'CRITICAL' | 'LOW'
  stockPercentage: number
  deficit: number
  Supplier: {
    id: string
    name: string
    phone: string | null
    email: string | null
  } | null
}

interface Movement {
  id: string
  type: string
  quantity: number
  previousStock: number
  newStock: number
  reason: string
  notes: string | null
  performedBy: string | null
  createdAt: string
  RawMaterial?: {
    id: string
    name: string
    sku: string | null
    measurementUnit: string
    currentStock: number
  }
  Product?: {
    id: string
    name: string
    category: string
    imageUrl: string
    currentStock: number
  }
}

export default function EstoquePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<InventoryStats | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [materials, setMaterials] = useState<RawMaterial[]>([])
  const [products, setProducts] = useState<any[]>([]) // Lista de produtos
  const [showMovementDialog, setShowMovementDialog] = useState(false)
  const [selectedTab, setSelectedTab] = useState<'dashboard' | 'alerts' | 'movements' | 'products' | 'production' | 'goals'>('dashboard')

  const [movementItemType, setMovementItemType] = useState<'material' | 'product'>('material')
  const [formData, setFormData] = useState({
    rawMaterialId: '',
    productId: '',
    type: 'ENTRY' as 'ENTRY' | 'EXIT' | 'ADJUSTMENT' | 'LOSS',
    quantity: '',
    reason: '',
    notes: ''
  })

  // 🆕 Estados para reset e ajuste de estoque
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [showAdjustDialog, setShowAdjustDialog] = useState(false)
  const [resetPassword, setResetPassword] = useState('')
  const [adjustPassword, setAdjustPassword] = useState('')
  const [adjustItem, setAdjustItem] = useState<{id: string, type: string, name: string, currentStock: number, unit: string} | null>(null)
  const [adjustNewStock, setAdjustNewStock] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [isResetting, setIsResetting] = useState(false)
  const [isAdjusting, setIsAdjusting] = useState(false)

  // 🆕 Estados para paginação de movimentações
  const [movementsPage, setMovementsPage] = useState(1)
  const [movementsLimit, setMovementsLimit] = useState(50)
  const [totalMovements, setTotalMovements] = useState(0)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Buscar estatísticas
      console.log('[ESTOQUE] 📊 Buscando estatísticas do dashboard...')
      const statsRes = await fetch('/api/inventory/stats')
      console.log('[ESTOQUE] Response status:', statsRes.status, statsRes.ok ? '✅' : '❌')
      
      if (statsRes.ok) {
        const statsData = await statsRes.json()
        console.log('[ESTOQUE] ✅ Estatísticas carregadas:', statsData)
        setStats(statsData)
      } else {
        const errorData = await statsRes.json().catch(() => ({ error: 'Erro desconhecido' }))
        console.error('[ESTOQUE] ❌ Erro ao buscar estatísticas:', errorData)
        toast.error('Erro ao carregar estatísticas do dashboard')
      }

      // Buscar alertas
      const alertsRes = await fetch('/api/inventory/alerts')
      if (alertsRes.ok) {
        const alertsData = await alertsRes.json()
        setAlerts(alertsData.alerts || [])
      } else {
        console.error('[ESTOQUE] Erro ao buscar alertas:', alertsRes.status)
      }

      // Buscar movimentações recentes (limite maior)
      const movementsRes = await fetch('/api/inventory/movements?limit=500')
      if (movementsRes.ok) {
        const movementsData = await movementsRes.json()
        setMovements(movementsData.movements || [])
        setTotalMovements(movementsData.movements?.length || 0)
      } else {
        console.error('[ESTOQUE] Erro ao buscar movimentações:', movementsRes.status)
      }

      // Buscar matérias-primas para o formulário
      const materialsRes = await fetch('/api/raw-materials?active=true')
      if (materialsRes.ok) {
        const materialsData = await materialsRes.json()
        console.log('[ESTOQUE] Matérias-primas carregadas:', materialsData.length)
        setMaterials(materialsData || []) // API retorna array direto, não objeto com .materials
      } else {
        console.error('[ESTOQUE] Erro ao buscar matérias-primas:', materialsRes.status)
      }

      // Buscar produtos para o formulário
      const productsRes = await fetch('/api/products')
      if (productsRes.ok) {
        const productsData = await productsRes.json()
        console.log('[ESTOQUE] Produtos carregados:', productsData.length)
        setProducts(productsData || [])
      } else {
        console.error('[ESTOQUE] Erro ao buscar produtos:', productsRes.status)
      }
    } catch (error) {
      console.error('[ESTOQUE] ❌ Erro crítico ao buscar dados:', error)
      toast.error('Erro ao carregar dados do estoque')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateMovement = async () => {
    // Validar se selecionou matéria-prima OU produto
    if (movementItemType === 'material' && !formData.rawMaterialId) {
      toast.error('Selecione uma matéria-prima')
      return
    }

    if (movementItemType === 'product' && !formData.productId) {
      toast.error('Selecione um produto')
      return
    }

    if (!formData.quantity) {
      toast.error('Informe a quantidade')
      return
    }

    setLoading(true)
    try {
      const payload: any = {
        type: formData.type,
        quantity: parseFloat(formData.quantity),
        reason: formData.reason,
        notes: formData.notes
      }

      // Adicionar rawMaterialId OU productId
      if (movementItemType === 'material') {
        payload.rawMaterialId = formData.rawMaterialId
      } else {
        payload.productId = formData.productId
      }

      console.log('[ESTOQUE] Criando movimentação:', payload)

      const response = await fetch('/api/inventory/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar movimentação')
      }

      toast.success('Movimentação criada com sucesso!')
      setShowMovementDialog(false)
      setFormData({
        rawMaterialId: '',
        productId: '',
        type: 'ENTRY',
        quantity: '',
        reason: '',
        notes: ''
      })
      setMovementItemType('material') // Resetar para matéria-prima
      fetchData()
    } catch (error: any) {
      console.error('[ESTOQUE] Erro ao criar movimentação:', error)
      toast.error(error.message || 'Erro ao criar movimentação')
    } finally {
      setLoading(false)
    }
  }

  const getMovementTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      ENTRY: 'Entrada',
      EXIT: 'Saída',
      ADJUSTMENT: 'Ajuste',
      LOSS: 'Perda'
    }
    return labels[type] || type
  }

  const getMovementTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      ENTRY: 'text-green-600 bg-green-50',
      EXIT: 'text-orange-600 bg-orange-50',
      ADJUSTMENT: 'text-blue-600 bg-blue-50',
      LOSS: 'text-red-600 bg-red-50'
    }
    return colors[type] || 'text-gray-600 bg-gray-50'
  }

  const getAlertSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      OUT_OF_STOCK: 'destructive',
      CRITICAL: 'destructive',
      LOW: 'default'
    }
    return colors[severity] || 'default'
  }

  const getAlertSeverityLabel = (severity: string) => {
    const labels: Record<string, string> = {
      OUT_OF_STOCK: 'SEM ESTOQUE',
      CRITICAL: 'CRÍTICO',
      LOW: 'BAIXO'
    }
    return labels[severity] || severity
  }

  // 🆕 Função para zerar todo o estoque
  const handleResetStock = async () => {
    if (!resetPassword) {
      toast.error('Digite a senha')
      return
    }

    setIsResetting(true)
    try {
      const response = await fetch('/api/inventory/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: resetPassword })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao zerar estoque')
      }

      toast.success('Estoque zerado com sucesso!')
      setShowResetDialog(false)
      setResetPassword('')
      fetchData()
    } catch (error: any) {
      toast.error(error.message || 'Erro ao zerar estoque')
    } finally {
      setIsResetting(false)
    }
  }

  // 🆕 Função para ajustar estoque individual
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
      fetchData()
    } catch (error: any) {
      toast.error(error.message || 'Erro ao ajustar estoque')
    } finally {
      setIsAdjusting(false)
    }
  }

  // 🆕 Função para abrir dialog de ajuste
  const openAdjustDialog = (item: {id: string, type: string, name: string, currentStock: number, unit: string}) => {
    setAdjustItem(item)
    setAdjustNewStock(item.currentStock.toString())
    setShowAdjustDialog(true)
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push('/admin')}
          >
            <Home className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Controle de Estoque</h1>
            <p className="text-muted-foreground">Gerencie movimentações e alertas de estoque</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowMovementDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Movimentação
          </Button>
          <Button 
            variant="destructive" 
            onClick={() => setShowResetDialog(true)}
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Zerar Estoque
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b overflow-x-auto pb-2">
        <Button
          variant={selectedTab === 'dashboard' ? 'default' : 'ghost'}
          onClick={() => setSelectedTab('dashboard')}
        >
          <Activity className="h-4 w-4 mr-2" />
          Dashboard
        </Button>
        <Button
          variant={selectedTab === 'alerts' ? 'default' : 'ghost'}
          onClick={() => setSelectedTab('alerts')}
        >
          <AlertTriangle className="h-4 w-4 mr-2" />
          Alertas {alerts.length > 0 && `(${alerts.length})`}
        </Button>
        <Button
          variant={selectedTab === 'movements' ? 'default' : 'ghost'}
          onClick={() => setSelectedTab('movements')}
        >
          <Package className="h-4 w-4 mr-2" />
          Movimentações
        </Button>
        <Button
          variant={selectedTab === 'products' ? 'default' : 'ghost'}
          onClick={() => setSelectedTab('products')}
        >
          <PackageCheck className="h-4 w-4 mr-2" />
          Estoque de Produtos
        </Button>
        <Button
          variant={selectedTab === 'production' ? 'default' : 'ghost'}
          onClick={() => setSelectedTab('production')}
        >
          <PackageCheck className="h-4 w-4 mr-2" />
          Produção
        </Button>
        <Button
          variant={selectedTab === 'goals' ? 'default' : 'ghost'}
          onClick={() => setSelectedTab('goals')}
        >
          <TrendingUp className="h-4 w-4 mr-2" />
          Metas
        </Button>
      </div>

      {/* Dashboard Tab */}
      {selectedTab === 'dashboard' && !loading && !stats && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-yellow-600" />
              <p className="text-lg font-medium mb-2">Não foi possível carregar as estatísticas</p>
              <p className="text-sm mb-4">Verifique o console do navegador para mais detalhes</p>
              <Button onClick={fetchData} variant="outline">
                Tentar Novamente
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      {selectedTab === 'dashboard' && stats && (
        <div className="space-y-6">
          {/* Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total de Itens</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Package className="h-8 w-8 text-blue-600" />
                  <span className="text-3xl font-bold">{stats.summary.totalMaterials}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Valor Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-8 w-8 text-green-600" />
                  <span className="text-3xl font-bold">R$ {stats.summary.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Estoque Baixo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-8 w-8 text-yellow-600" />
                  <span className="text-3xl font-bold">{stats.summary.lowStock}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Sem Estoque</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <PackageX className="h-8 w-8 text-red-600" />
                  <span className="text-3xl font-bold">{stats.summary.outOfStock}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Movimentações (30d)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Activity className="h-8 w-8 text-purple-600" />
                  <span className="text-3xl font-bold">{stats.summary.recentMovements}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Movimentações por Tipo */}
          <Card>
            <CardHeader>
              <CardTitle>Movimentações por Tipo (Últimos 30 dias)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {stats.movementsByType.map((movement) => (
                  <div key={movement.type} className="text-center p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">
                      {getMovementTypeLabel(movement.type)}
                    </p>
                    <p className="text-2xl font-bold">{movement.count}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Matérias-Primas Movimentadas */}
          <Card>
            <CardHeader>
              <CardTitle>Itens Mais Movimentados</CardTitle>
              <CardDescription>Últimos 30 dias</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Estoque Atual</TableHead>
                    <TableHead>Movimentações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.topMaterials.map((material) => (
                    <TableRow key={material.id}>
                      <TableCell className="font-medium">{material.name}</TableCell>
                      <TableCell>{material.sku || '-'}</TableCell>
                      <TableCell>
                        {material.currentStock} {material.measurementUnit}
                      </TableCell>
                      <TableCell>
                        <Badge>{material.movementCount}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Alertas Tab */}
      {selectedTab === 'alerts' && (
        <Card>
          <CardHeader>
            <CardTitle>Alertas de Estoque</CardTitle>
            <CardDescription>
              {alerts.length} {alerts.length === 1 ? 'item requer' : 'itens requerem'} atenção
            </CardDescription>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <PackageCheck className="h-12 w-12 mx-auto mb-2 text-green-600" />
                <p>Nenhum alerta de estoque no momento</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Matéria-Prima</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Estoque Atual</TableHead>
                    <TableHead>Estoque Mínimo</TableHead>
                    <TableHead>Déficit</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Severidade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts.map((alert) => (
                    <TableRow key={alert.id}>
                      <TableCell className="font-medium">{alert.name}</TableCell>
                      <TableCell>{alert.sku || '-'}</TableCell>
                      <TableCell>
                        {alert.currentStock} {alert.measurementUnit}
                      </TableCell>
                      <TableCell>
                        {alert.minStock} {alert.measurementUnit}
                      </TableCell>
                      <TableCell className="font-semibold text-red-600">
                        {alert.deficit.toFixed(2)} {alert.measurementUnit}
                      </TableCell>
                      <TableCell>
                        {alert.Supplier ? (
                          <div>
                            <p className="font-medium">{alert.Supplier.name}</p>
                            {alert.Supplier.phone && (
                              <p className="text-xs text-muted-foreground">{alert.Supplier.phone}</p>
                            )}
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getAlertSeverityColor(alert.alertSeverity) as any}>
                          {getAlertSeverityLabel(alert.alertSeverity)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Movimentações Tab */}
      {selectedTab === 'movements' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Histórico de Movimentações</CardTitle>
              <CardDescription>
                Total: {totalMovements} movimentações | Mostrando: {Math.min(movementsPage * movementsLimit, movements.length)} de {movements.length}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Por página:</span>
              <select 
                value={movementsLimit} 
                onChange={(e) => {
                  setMovementsLimit(parseInt(e.target.value))
                  setMovementsPage(1)
                }}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>
          </CardHeader>
          <CardContent>
            {movements.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma movimentação registrada
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead>Estoque Anterior</TableHead>
                      <TableHead>Estoque Novo</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Realizado Por</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements
                      .slice((movementsPage - 1) * movementsLimit, movementsPage * movementsLimit)
                      .map((movement) => {
                        const isRawMaterial = !!movement.RawMaterial
                        const item = isRawMaterial ? movement.RawMaterial : movement.Product
                        const unit = isRawMaterial && movement.RawMaterial ? movement.RawMaterial.measurementUnit : 'un'
                        const itemType = isRawMaterial ? '🧱 Mat-Prima' : '📦 Produto'
                        
                        return (
                          <TableRow key={movement.id}>
                            <TableCell>
                              {format(new Date(movement.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                            </TableCell>
                            <TableCell className="font-medium">
                              <div className="flex flex-col">
                                <span>{item?.name || 'Item não encontrado'}</span>
                                <span className="text-xs text-muted-foreground">{itemType}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={getMovementTypeColor(movement.type)}>
                                {getMovementTypeLabel(movement.type)}
                              </Badge>
                            </TableCell>
                            <TableCell className={movement.quantity > 0 ? 'text-green-600' : 'text-red-600'}>
                              {movement.quantity > 0 ? '+' : ''}{movement.quantity.toFixed(2)} {unit}
                            </TableCell>
                            <TableCell>
                              {movement.previousStock.toFixed(2)} {unit}
                            </TableCell>
                            <TableCell>
                              {movement.newStock.toFixed(2)} {unit}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate" title={movement.reason}>
                              {movement.reason}
                            </TableCell>
                            <TableCell>{movement.performedBy || '-'}</TableCell>
                          </TableRow>
                        )
                      })}
                  </TableBody>
                </Table>

                {/* Paginação */}
                {movements.length > movementsLimit && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <span className="text-sm text-muted-foreground">
                      Página {movementsPage} de {Math.ceil(movements.length / movementsLimit)}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setMovementsPage(p => Math.max(1, p - 1))}
                        disabled={movementsPage === 1}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setMovementsPage(p => Math.min(Math.ceil(movements.length / movementsLimit), p + 1))}
                        disabled={movementsPage >= Math.ceil(movements.length / movementsLimit)}
                      >
                        Próxima
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Products Stock Tab */}
      {selectedTab === 'products' && (
        <ProductsStockTab />
      )}

      {/* Production Tab */}
      {selectedTab === 'production' && (
        <ProductionTab />
      )}

      {/* Goals Tab */}
      {selectedTab === 'goals' && (
        <GoalsTab />
      )}

      {/* Dialog de Nova Movimentação */}
      <Dialog open={showMovementDialog} onOpenChange={setShowMovementDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova Movimentação de Estoque</DialogTitle>
            <DialogDescription>
              Registre entradas, saídas, ajustes ou perdas de estoque
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Seletor de Tipo de Item */}
            <div className="space-y-2">
              <Label>Tipo de Item *</Label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setMovementItemType('material')
                    setFormData({ ...formData, rawMaterialId: '', productId: '' })
                  }}
                  className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                    movementItemType === 'material'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-muted hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Package className="h-5 w-5" />
                    <span className="font-medium">Matéria-Prima</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMovementItemType('product')
                    setFormData({ ...formData, rawMaterialId: '', productId: '' })
                  }}
                  className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                    movementItemType === 'product'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-muted hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <PackageCheck className="h-5 w-5" />
                    <span className="font-medium">Produto Acabado</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Seletor de Matéria-Prima */}
            {movementItemType === 'material' && (
              <div>
                <Label>Matéria-Prima *</Label>
                <Select
                  value={formData.rawMaterialId}
                  onValueChange={(value) => setFormData({ ...formData, rawMaterialId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma matéria-prima..." />
                  </SelectTrigger>
                  <SelectContent>
                    {materials.map((material) => (
                      <SelectItem key={material.id} value={material.id}>
                        {material.name} (Estoque: {material.currentStock.toFixed(2)} {material.measurementUnit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Seletor de Produto */}
            {movementItemType === 'product' && (
              <div>
                <Label>Produto *</Label>
                <Select
                  value={formData.productId}
                  onValueChange={(value) => setFormData({ ...formData, productId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um produto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} (Estoque: {product.currentStock.toFixed(0)} un)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Tipo de Movimentação *</Label>
              <Select
                value={formData.type}
                onValueChange={(value: any) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENTRY">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      <span>Entrada</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="EXIT">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-orange-600" />
                      <span>Saída</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="ADJUSTMENT">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-blue-600" />
                      <span>Ajuste</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="LOSS">
                    <div className="flex items-center gap-2">
                      <PackageX className="h-4 w-4 text-red-600" />
                      <span>Perda</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {formData.type === 'ENTRY' && 'Entrada: Adiciona ao estoque'}
                {formData.type === 'EXIT' && 'Saída: Remove do estoque'}
                {formData.type === 'ADJUSTMENT' && 'Ajuste: Valor positivo ou negativo para correção'}
                {formData.type === 'LOSS' && 'Perda: Remove do estoque por desperdício/validade'}
              </p>
            </div>

            <div>
              <Label>Quantidade *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder={formData.type === 'ADJUSTMENT' ? 'Ex: +10 ou -5' : 'Ex: 10'}
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              />
            </div>

            <div>
              <Label>Motivo *</Label>
              <Input
                placeholder="Ex: Compra, Venda, Correção de inventário, Validade vencida"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              />
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea
                placeholder="Detalhes adicionais (opcional)"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowMovementDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateMovement} disabled={loading}>
              {loading ? 'Salvando...' : 'Criar Movimentação'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 🆕 Dialog de Zerar Estoque */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Zerar Todo o Estoque
            </DialogTitle>
            <DialogDescription>
              <Alert variant="destructive" className="mt-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>ATENÇÃO!</strong> Esta ação irá:
                  <ul className="list-disc ml-4 mt-2">
                    <li>Zerar o estoque de TODOS os produtos</li>
                    <li>Zerar o estoque de TODAS as matérias-primas</li>
                    <li>Zerar o estoque de TODOS os insumos</li>
                    <li>APAGAR todo o histórico de movimentações</li>
                  </ul>
                  <p className="mt-2 font-bold">Esta ação NÃO pode ser desfeita!</p>
                </AlertDescription>
              </Alert>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <Label>Digite a senha para confirmar:</Label>
              <Input
                type="password"
                placeholder="Senha de confirmação"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => {
              setShowResetDialog(false)
              setResetPassword('')
            }}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleResetStock} 
              disabled={isResetting || !resetPassword}
            >
              {isResetting ? 'Zerando...' : 'Confirmar - Zerar Tudo'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 🆕 Dialog de Ajustar Estoque Individual */}
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
                  <span className="text-lg font-bold">{adjustItem.currentStock} {adjustItem.unit}</span>
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
