'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  Users, 
  ArrowLeft,
  Calendar,
  Percent,
  DollarSign,
  TrendingUp,
  Filter,
  Send,
  Eye,
  BarChart3
} from 'lucide-react'
import Link from 'next/link'
import { HomeButton } from '@/components/home-button'

interface Coupon {
  id: string
  code: string
  description: string | null
  discountType: 'FIXED' | 'PERCENTAGE'
  discountValue: number
  minOrderValue: number | null
  maxDiscount: number | null
  validFrom: Date
  validUntil: Date | null
  isActive: boolean
  usageLimit: number | null
  usageCount: number
  isOneTimePerCustomer: boolean
  targetAllCustomers: boolean
  targetInactiveDays: number | null
  targetSpecificProducts: string[]
  targetMinPurchaseCount: number | null
  targetMaxPurchaseCount: number | null
  targetCities: string[]
  targetCustomerIds: string[]
  targetDecreasingVolume: boolean
  targetVolumeDecreasePercent: number | null
  targetProductDiversityChange: boolean
  targetPreviousProducts: string[]
  targetCurrentProducts: string[]
  createdAt: Date
  CouponUsage?: any[]
  Order?: any[]
}

interface Product {
  id: string
  name: string
}

interface Customer {
  id: string
  name: string
  email: string
  phone: string
  city: string
}

interface TargetCustomer {
  id: string
  name: string
  email: string
  phone: string
  city: string
  orderCount: number
  lastOrderDate: Date | null
  daysSinceLastOrder: number | null
}

export function CouponsManagement() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<TargetCustomer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [showDialog, setShowDialog] = useState(false)
  const [showTargetDialog, setShowTargetDialog] = useState(false)
  const [showStatsDialog, setShowStatsDialog] = useState(false)
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    code: '',
    description: '',
    discountType: 'FIXED' as 'FIXED' | 'PERCENTAGE',
    discountValue: '',
    minOrderValue: '',
    maxDiscount: '',
    validFrom: '',
    validUntil: '',
    isActive: true,
    usageLimit: '',
    isOneTimePerCustomer: false,
    targetAllCustomers: true,
    targetInactiveDays: '',
    targetSpecificProducts: [] as string[],
    targetMinPurchaseCount: '',
    targetMaxPurchaseCount: '',
    targetCities: [] as string[],
    targetCustomerIds: [] as string[],
    targetDecreasingVolume: false,
    targetVolumeDecreasePercent: '',
    targetProductDiversityChange: false,
    targetPreviousProducts: [] as string[],
    targetCurrentProducts: [] as string[]
  })

  useEffect(() => {
    fetchCoupons()
    fetchProducts()
    fetchCustomers()
  }, [])

  const fetchCoupons = async () => {
    try {
      const response = await fetch('/api/admin/coupons')
      if (response.ok) {
        const data = await response.json()
        setCoupons(data)
      }
    } catch (error) {
      console.error('Error fetching coupons:', error)
      toast({
        title: "Erro",
        description: "Não foi possível carregar os cupons",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products')
      if (response.ok) {
        const data = await response.json()
        setProducts(data)
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const fetchCustomers = async () => {
    try {
      const response = await fetch('/api/customers')
      if (response.ok) {
        const data = await response.json()
        setCustomers(data)
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
    }
  }

  const fetchTargetCustomers = async () => {
    try {
      const response = await fetch('/api/admin/coupons/target-customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetAllCustomers: formData.targetAllCustomers,
          targetInactiveDays: formData.targetInactiveDays ? parseInt(formData.targetInactiveDays) : null,
          targetSpecificProducts: formData.targetSpecificProducts,
          targetMinPurchaseCount: formData.targetMinPurchaseCount ? parseInt(formData.targetMinPurchaseCount) : null,
          targetMaxPurchaseCount: formData.targetMaxPurchaseCount ? parseInt(formData.targetMaxPurchaseCount) : null,
          targetCities: formData.targetCities,
          targetCustomerIds: formData.targetCustomerIds,
          targetDecreasingVolume: formData.targetDecreasingVolume,
          targetVolumeDecreasePercent: formData.targetVolumeDecreasePercent ? parseFloat(formData.targetVolumeDecreasePercent) : null,
          targetProductDiversityChange: formData.targetProductDiversityChange,
          targetPreviousProducts: formData.targetPreviousProducts,
          targetCurrentProducts: formData.targetCurrentProducts
        })
      })

      if (response.ok) {
        const data = await response.json()
        setFilteredCustomers(data.customers)
        setShowTargetDialog(true)
      }
    } catch (error) {
      console.error('Error fetching target customers:', error)
      toast({
        title: "Erro",
        description: "Não foi possível buscar clientes-alvo",
        variant: "destructive"
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const url = selectedCoupon 
        ? `/api/admin/coupons/${selectedCoupon.id}`
        : '/api/admin/coupons'
      
      const method = selectedCoupon ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        toast({
          title: "Sucesso!",
          description: selectedCoupon ? "Cupom atualizado com sucesso" : "Cupom criado com sucesso"
        })
        setShowDialog(false)
        resetForm()
        fetchCoupons()
      } else {
        const error = await response.json()
        toast({
          title: "Erro",
          description: error.error || "Não foi possível salvar o cupom",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error saving coupon:', error)
      toast({
        title: "Erro",
        description: "Não foi possível salvar o cupom",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este cupom?')) return

    try {
      const response = await fetch(`/api/admin/coupons/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast({
          title: "Sucesso!",
          description: "Cupom excluído com sucesso"
        })
        fetchCoupons()
      }
    } catch (error) {
      console.error('Error deleting coupon:', error)
      toast({
        title: "Erro",
        description: "Não foi possível excluir o cupom",
        variant: "destructive"
      })
    }
  }

  const handleToggleStatus = async (coupon: Coupon) => {
    try {
      const response = await fetch(`/api/admin/coupons/${coupon.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !coupon.isActive })
      })

      if (response.ok) {
        toast({
          title: "Sucesso!",
          description: `Cupom ${!coupon.isActive ? 'ativado' : 'desativado'} com sucesso`
        })
        fetchCoupons()
      }
    } catch (error) {
      console.error('Error toggling coupon status:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      code: '',
      description: '',
      discountType: 'FIXED',
      discountValue: '',
      minOrderValue: '',
      maxDiscount: '',
      validFrom: '',
      validUntil: '',
      isActive: true,
      usageLimit: '',
      isOneTimePerCustomer: false,
      targetAllCustomers: true,
      targetInactiveDays: '',
      targetSpecificProducts: [],
      targetMinPurchaseCount: '',
      targetMaxPurchaseCount: '',
      targetCities: [],
      targetCustomerIds: [],
      targetDecreasingVolume: false,
      targetVolumeDecreasePercent: '',
      targetProductDiversityChange: false,
      targetPreviousProducts: [],
      targetCurrentProducts: []
    })
    setSelectedCoupon(null)
  }

  const openEditDialog = (coupon: Coupon) => {
    setSelectedCoupon(coupon)
    
    // Função auxiliar para converter data UTC para data local (Brasília) no formato YYYY-MM-DD
    const formatDateForInput = (dateValue: Date | string | null): string => {
      if (!dateValue) return ''
      
      try {
        const date = new Date(dateValue)
        
        // Obter componentes da data em horário de Brasília (UTC-3)
        // Subtrair 3 horas do UTC para obter horário de Brasília
        const brasiliaTime = new Date(date.getTime() - (3 * 60 * 60 * 1000))
        
        const year = brasiliaTime.getUTCFullYear()
        const month = String(brasiliaTime.getUTCMonth() + 1).padStart(2, '0')
        const day = String(brasiliaTime.getUTCDate()).padStart(2, '0')
        
        const formatted = `${year}-${month}-${day}`
        console.log('[EDIT_DIALOG] Convertendo data:', dateValue, '->', formatted)
        return formatted
      } catch (error) {
        console.error('[EDIT_DIALOG] Erro ao converter data:', error)
        return ''
      }
    }
    
    setFormData({
      code: coupon.code,
      description: coupon.description || '',
      discountType: coupon.discountType,
      discountValue: coupon.discountValue.toString(),
      minOrderValue: coupon.minOrderValue?.toString() || '',
      maxDiscount: coupon.maxDiscount?.toString() || '',
      validFrom: formatDateForInput(coupon.validFrom),
      validUntil: formatDateForInput(coupon.validUntil),
      isActive: coupon.isActive,
      usageLimit: coupon.usageLimit?.toString() || '',
      isOneTimePerCustomer: coupon.isOneTimePerCustomer,
      targetAllCustomers: coupon.targetAllCustomers,
      targetInactiveDays: coupon.targetInactiveDays?.toString() || '',
      targetSpecificProducts: coupon.targetSpecificProducts || [],
      targetMinPurchaseCount: coupon.targetMinPurchaseCount?.toString() || '',
      targetMaxPurchaseCount: coupon.targetMaxPurchaseCount?.toString() || '',
      targetCities: coupon.targetCities || [],
      targetCustomerIds: coupon.targetCustomerIds || [],
      targetDecreasingVolume: coupon.targetDecreasingVolume,
      targetVolumeDecreasePercent: coupon.targetVolumeDecreasePercent?.toString() || '',
      targetProductDiversityChange: coupon.targetProductDiversityChange,
      targetPreviousProducts: coupon.targetPreviousProducts || [],
      targetCurrentProducts: coupon.targetCurrentProducts || []
    })
    setShowDialog(true)
  }

  const openStatsDialog = (coupon: Coupon) => {
    setSelectedCoupon(coupon)
    setShowStatsDialog(true)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  // Função para formatar data no horário de Brasília (UTC-3)
  const formatDateBrasilia = (dateValue: Date | string | null): string => {
    if (!dateValue) return ''
    
    try {
      const date = new Date(dateValue)
      
      // Converter para horário de Brasília (UTC-3)
      const brasiliaTime = new Date(date.getTime() - (3 * 60 * 60 * 1000))
      
      // Formatar como DD/MM/YYYY
      const day = String(brasiliaTime.getUTCDate()).padStart(2, '0')
      const month = String(brasiliaTime.getUTCMonth() + 1).padStart(2, '0')
      const year = brasiliaTime.getUTCFullYear()
      
      return `${day}/${month}/${year}`
    } catch (error) {
      console.error('Erro ao formatar data:', error)
      return ''
    }
  }

  const filteredCoupons = coupons.filter(coupon => {
    const matchesSearch = 
      coupon.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      coupon.description?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = 
      filterStatus === 'all' ||
      (filterStatus === 'active' && coupon.isActive) ||
      (filterStatus === 'inactive' && !coupon.isActive)

    return matchesSearch && matchesStatus
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <Percent className="w-16 h-16 text-red-600 animate-spin mx-auto mb-4" />
          <p className="text-lg text-gray-600">Carregando cupons...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-amber-50">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto max-w-7xl flex h-16 items-center justify-between px-4">
          <div className="flex items-center space-x-4">
            <HomeButton />
            <Link href="/admin">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Gerenciar Cupons</h1>
              <p className="text-sm text-gray-600">Crie e gerencie cupons de desconto</p>
            </div>
          </div>
          
          <Button onClick={() => { resetForm(); setShowDialog(true); }} className="bg-red-600 hover:bg-red-700">
            <Plus className="w-4 h-4 mr-2" />
            Novo Cupom
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto max-w-7xl p-6">
        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label>Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Código ou descrição..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div>
                <Label>Status</Label>
                <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Ativos</SelectItem>
                    <SelectItem value="inactive">Inativos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label className="mb-2 block">Total de cupons</Label>
                  <div className="text-2xl font-bold text-red-600">{filteredCoupons.length}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Coupons List */}
        <div className="grid gap-4">
          {filteredCoupons.map((coupon) => (
            <Card key={coupon.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-900">#{coupon.code}</h3>
                      <Badge variant={coupon.isActive ? "default" : "secondary"}>
                        {coupon.isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                      {coupon.usageLimit && (
                        <Badge variant="outline">
                          {coupon.usageCount} / {coupon.usageLimit} usos
                        </Badge>
                      )}
                    </div>
                    
                    <p className="text-gray-600 mb-3">{coupon.description || 'Sem descrição'}</p>
                    
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="flex items-center gap-2">
                        {coupon.discountType === 'FIXED' ? (
                          <DollarSign className="w-4 h-4 text-green-600" />
                        ) : (
                          <Percent className="w-4 h-4 text-green-600" />
                        )}
                        <div>
                          <p className="text-xs text-gray-500">Desconto</p>
                          <p className="font-semibold">
                            {coupon.discountType === 'FIXED' 
                              ? formatCurrency(coupon.discountValue)
                              : `${coupon.discountValue}%`
                            }
                          </p>
                        </div>
                      </div>

                      {coupon.minOrderValue && (
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-blue-600" />
                          <div>
                            <p className="text-xs text-gray-500">Valor mínimo</p>
                            <p className="font-semibold">{formatCurrency(coupon.minOrderValue)}</p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-purple-600" />
                        <div>
                          <p className="text-xs text-gray-500">Válido até</p>
                          <p className="font-semibold">
                            {coupon.validUntil 
                              ? formatDateBrasilia(coupon.validUntil)
                              : 'Sem limite'
                            }
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-orange-600" />
                        <div>
                          <p className="text-xs text-gray-500">Público</p>
                          <p className="font-semibold">
                            {coupon.targetAllCustomers 
                              ? 'Todos'
                              : 'Segmentado'
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openStatsDialog(coupon)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(coupon)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleStatus(coupon)}
                    >
                      {coupon.isActive ? 'Desativar' : 'Ativar'}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(coupon.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredCoupons.length === 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <Percent className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-lg text-gray-600">
                    {searchQuery ? 'Nenhum cupom encontrado' : 'Nenhum cupom cadastrado'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedCoupon ? 'Editar Cupom' : 'Criar Novo Cupom'}</DialogTitle>
            <DialogDescription>
              Preencha os campos abaixo para criar ou editar um cupom de desconto
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Informações Básicas</TabsTrigger>
                <TabsTrigger value="rules">Regras</TabsTrigger>
                <TabsTrigger value="targeting">Público-Alvo</TabsTrigger>
              </TabsList>

              {/* Basic Information Tab */}
              <TabsContent value="basic" className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="code">Código do Cupom *</Label>
                    <Input
                      id="code"
                      value={formData.code}
                      onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                      placeholder="Ex: GENUINO, VOLTE, CARNE"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="discountType">Tipo de Desconto *</Label>
                    <Select 
                      value={formData.discountType} 
                      onValueChange={(value: 'FIXED' | 'PERCENTAGE') => setFormData({...formData, discountType: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FIXED">Valor Fixo (R$)</SelectItem>
                        <SelectItem value="PERCENTAGE">Porcentagem (%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="discountValue">
                      {formData.discountType === 'FIXED' ? 'Valor do Desconto (R$) *' : 'Porcentagem de Desconto (%) *'}
                    </Label>
                    <Input
                      id="discountValue"
                      type="number"
                      step="0.01"
                      value={formData.discountValue}
                      onChange={(e) => setFormData({...formData, discountValue: e.target.value})}
                      placeholder={formData.discountType === 'FIXED' ? '20.00' : '10'}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Descrição</Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      placeholder="Descrição do cupom"
                    />
                  </div>

                  <div>
                    <Label htmlFor="validFrom">Válido a partir de</Label>
                    <Input
                      id="validFrom"
                      type="date"
                      value={formData.validFrom}
                      onChange={(e) => setFormData({...formData, validFrom: e.target.value})}
                    />
                  </div>

                  <div>
                    <Label htmlFor="validUntil">Válido até</Label>
                    <Input
                      id="validUntil"
                      type="date"
                      value={formData.validUntil}
                      onChange={(e) => setFormData({...formData, validUntil: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({...formData, isActive: checked as boolean})}
                  />
                  <Label htmlFor="isActive">Cupom ativo</Label>
                </div>
              </TabsContent>

              {/* Rules Tab */}
              <TabsContent value="rules" className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="minOrderValue">Valor Mínimo do Pedido (R$)</Label>
                    <Input
                      id="minOrderValue"
                      type="number"
                      step="0.01"
                      value={formData.minOrderValue}
                      onChange={(e) => setFormData({...formData, minOrderValue: e.target.value})}
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <Label htmlFor="maxDiscount">Desconto Máximo (R$)</Label>
                    <Input
                      id="maxDiscount"
                      type="number"
                      step="0.01"
                      value={formData.maxDiscount}
                      onChange={(e) => setFormData({...formData, maxDiscount: e.target.value})}
                      placeholder="Sem limite"
                    />
                  </div>

                  <div>
                    <Label htmlFor="usageLimit">Limite de Uso Total</Label>
                    <Input
                      id="usageLimit"
                      type="number"
                      value={formData.usageLimit}
                      onChange={(e) => setFormData({...formData, usageLimit: e.target.value})}
                      placeholder="Ilimitado"
                    />
                  </div>

                  <div className="flex items-center space-x-2 pt-8">
                    <Checkbox
                      id="isOneTimePerCustomer"
                      checked={formData.isOneTimePerCustomer}
                      onCheckedChange={(checked) => setFormData({...formData, isOneTimePerCustomer: checked as boolean})}
                    />
                    <Label htmlFor="isOneTimePerCustomer">Uso único por cliente</Label>
                  </div>
                </div>
              </TabsContent>

              {/* Targeting Tab */}
              <TabsContent value="targeting" className="space-y-4">
                <div className="flex items-center space-x-2 mb-4">
                  <Checkbox
                    id="targetAllCustomers"
                    checked={formData.targetAllCustomers}
                    onCheckedChange={(checked) => setFormData({...formData, targetAllCustomers: checked as boolean})}
                  />
                  <Label htmlFor="targetAllCustomers">Disponível para todos os clientes</Label>
                </div>

                {!formData.targetAllCustomers && (
                  <>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="targetInactiveDays">Clientes inativos há X dias</Label>
                        <Input
                          id="targetInactiveDays"
                          type="number"
                          value={formData.targetInactiveDays}
                          onChange={(e) => setFormData({...formData, targetInactiveDays: e.target.value})}
                          placeholder="Ex: 7 (inativos há 7 dias)"
                        />
                      </div>

                      <div>
                        <Label htmlFor="targetMinPurchaseCount">Mínimo de compras anteriores</Label>
                        <Input
                          id="targetMinPurchaseCount"
                          type="number"
                          value={formData.targetMinPurchaseCount}
                          onChange={(e) => setFormData({...formData, targetMinPurchaseCount: e.target.value})}
                          placeholder="Ex: 1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="targetMaxPurchaseCount">Máximo de compras anteriores</Label>
                        <Input
                          id="targetMaxPurchaseCount"
                          type="number"
                          value={formData.targetMaxPurchaseCount}
                          onChange={(e) => setFormData({...formData, targetMaxPurchaseCount: e.target.value})}
                          placeholder="Ex: 5"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Cidades-alvo</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Digite uma cidade e pressione Enter"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              const input = e.currentTarget
                              const city = input.value.trim()
                              if (city && !formData.targetCities.includes(city)) {
                                setFormData({
                                  ...formData,
                                  targetCities: [...formData.targetCities, city]
                                })
                                input.value = ''
                              }
                            }
                          }}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {formData.targetCities.map((city, index) => (
                          <Badge key={index} variant="secondary">
                            {city}
                            <button
                              type="button"
                              onClick={() => setFormData({
                                ...formData,
                                targetCities: formData.targetCities.filter((_, i) => i !== index)
                              })}
                              className="ml-2"
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Produtos específicos</Label>
                      <Select 
                        value={formData.targetSpecificProducts[0] || "none"}
                        onValueChange={(value) => {
                          if (value !== "none" && !formData.targetSpecificProducts.includes(value)) {
                            setFormData({
                              ...formData,
                              targetSpecificProducts: [...formData.targetSpecificProducts, value]
                            })
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione produtos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Selecione um produto</SelectItem>
                          {products.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {formData.targetSpecificProducts.map((productId, index) => {
                          const product = products.find(p => p.id === productId)
                          return (
                            <Badge key={index} variant="secondary">
                              {product?.name || productId}
                              <button
                                type="button"
                                onClick={() => setFormData({
                                  ...formData,
                                  targetSpecificProducts: formData.targetSpecificProducts.filter((_, i) => i !== index)
                                })}
                                className="ml-2"
                              >
                                ×
                              </button>
                            </Badge>
                          )
                        })}
                      </div>
                    </div>

                    {/* Filtros Estratégicos Avançados */}
                    <div className="border-t pt-4 mt-4">
                      <h4 className="font-semibold mb-3 text-pink-600">📊 Filtros Estratégicos Avançados</h4>
                      
                      {/* Volume Decrescente */}
                      <div className="space-y-3 mb-4">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="targetDecreasingVolume"
                            checked={formData.targetDecreasingVolume}
                            onCheckedChange={(checked) => setFormData({...formData, targetDecreasingVolume: checked as boolean})}
                          />
                          <Label htmlFor="targetDecreasingVolume">
                            Clientes com volume de compras em queda
                          </Label>
                        </div>
                        {formData.targetDecreasingVolume && (
                          <div>
                            <Label htmlFor="targetVolumeDecreasePercent">
                              Queda mínima (%) - últimos 30 dias vs 30-60 dias anteriores
                            </Label>
                            <Input
                              id="targetVolumeDecreasePercent"
                              type="number"
                              step="0.1"
                              value={formData.targetVolumeDecreasePercent}
                              onChange={(e) => setFormData({...formData, targetVolumeDecreasePercent: e.target.value})}
                              placeholder="Ex: 20 (queda de 20% ou mais)"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Exemplo: Cliente que comprava R$ 200/mês e agora compra R$ 160/mês (20% de queda)
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Mudança de Padrão de Produtos */}
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="targetProductDiversityChange"
                            checked={formData.targetProductDiversityChange}
                            onCheckedChange={(checked) => setFormData({...formData, targetProductDiversityChange: checked as boolean})}
                          />
                          <Label htmlFor="targetProductDiversityChange">
                            Clientes que mudaram padrão de produtos
                          </Label>
                        </div>
                        {formData.targetProductDiversityChange && (
                          <>
                            <div>
                              <Label>Produtos que compravam antes (últimos 60-90 dias)</Label>
                              <Select 
                                value="none"
                                onValueChange={(value) => {
                                  if (value !== "none" && !formData.targetPreviousProducts.includes(value)) {
                                    setFormData({
                                      ...formData,
                                      targetPreviousProducts: [...formData.targetPreviousProducts, value]
                                    })
                                  }
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Adicione produtos" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Selecione um produto</SelectItem>
                                  {products.map((product) => (
                                    <SelectItem key={product.id} value={product.id}>
                                      {product.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {formData.targetPreviousProducts.map((productId, index) => {
                                  const product = products.find(p => p.id === productId)
                                  return (
                                    <Badge key={index} variant="secondary">
                                      {product?.name || productId}
                                      <button
                                        type="button"
                                        onClick={() => setFormData({
                                          ...formData,
                                          targetPreviousProducts: formData.targetPreviousProducts.filter((_, i) => i !== index)
                                        })}
                                        className="ml-2"
                                      >
                                        ×
                                      </button>
                                    </Badge>
                                  )
                                })}
                              </div>
                            </div>
                            
                            <div>
                              <Label>Produtos que compram agora (últimos 30 dias)</Label>
                              <Select 
                                value="none"
                                onValueChange={(value) => {
                                  if (value !== "none" && !formData.targetCurrentProducts.includes(value)) {
                                    setFormData({
                                      ...formData,
                                      targetCurrentProducts: [...formData.targetCurrentProducts, value]
                                    })
                                  }
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Adicione produtos" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Selecione um produto</SelectItem>
                                  {products.map((product) => (
                                    <SelectItem key={product.id} value={product.id}>
                                      {product.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {formData.targetCurrentProducts.map((productId, index) => {
                                  const product = products.find(p => p.id === productId)
                                  return (
                                    <Badge key={index} variant="secondary">
                                      {product?.name || productId}
                                      <button
                                        type="button"
                                        onClick={() => setFormData({
                                          ...formData,
                                          targetCurrentProducts: formData.targetCurrentProducts.filter((_, i) => i !== index)
                                        })}
                                        className="ml-2"
                                      >
                                        ×
                                      </button>
                                    </Badge>
                                  )
                                })}
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                Exemplo: Clientes que compravam carne e frango, mas agora só compram frango
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={fetchTargetCustomers}
                      className="w-full"
                    >
                      <Filter className="w-4 h-4 mr-2" />
                      Ver Clientes-Alvo ({filteredCustomers.length})
                    </Button>
                  </>
                )}
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDialog(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-red-600 hover:bg-red-700"
              >
                {isSubmitting ? 'Salvando...' : 'Salvar Cupom'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Target Customers Dialog */}
      <Dialog open={showTargetDialog} onOpenChange={setShowTargetDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Clientes-Alvo</DialogTitle>
            <DialogDescription>
              {filteredCustomers.length} cliente(s) atendem aos critérios definidos
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {filteredCustomers.map((customer) => (
              <Card key={customer.id}>
                <CardContent className="pt-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{customer.name}</p>
                      <p className="text-sm text-gray-600">{customer.email || customer.phone}</p>
                      <p className="text-sm text-gray-500">{customer.city}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-medium">{customer.orderCount} pedidos</p>
                      {customer.daysSinceLastOrder !== null && (
                        <p className="text-gray-500">
                          {customer.daysSinceLastOrder} dias inativo
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Statistics Dialog */}
      <Dialog open={showStatsDialog} onOpenChange={setShowStatsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Estatísticas do Cupom</DialogTitle>
            <DialogDescription>
              Detalhes de uso do cupom #{selectedCoupon?.code}
            </DialogDescription>
          </DialogHeader>

          {selectedCoupon && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <BarChart3 className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold">{selectedCoupon.usageCount}</p>
                      <p className="text-sm text-gray-600">Usos totais</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <Users className="w-8 h-8 text-green-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold">{selectedCoupon.CouponUsage?.length || 0}</p>
                      <p className="text-sm text-gray-600">Clientes únicos</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <DollarSign className="w-8 h-8 text-red-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold">
                        {formatCurrency(
                          selectedCoupon.Order?.reduce((sum, order) => sum + order.couponDiscount, 0) || 0
                        )}
                      </p>
                      <p className="text-sm text-gray-600">Desconto total</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {selectedCoupon.Order && selectedCoupon.Order.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Últimos pedidos</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedCoupon.Order.slice(0, 10).map((order: any) => (
                      <Card key={order.id}>
                        <CardContent className="pt-3 pb-3">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium">#{order.orderNumber}</p>
                              <p className="text-sm text-gray-600">{order.customerName}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">{formatCurrency(order.total)}</p>
                              <p className="text-sm text-green-600">
                                -{formatCurrency(order.couponDiscount)}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
