'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Flame, ArrowLeft, Plus, Pencil, Trash2, Package, Search, Home, Tag, Percent, Users, AlertTriangle, Check, X, Edit3 } from 'lucide-react'
import { toast } from 'sonner'
import { HomeButton } from '@/components/home-button'

interface Product {
  id: string
  name: string
  description: string
  imageUrl: string
  weight: string
  priceWholesale: number
  priceRetail: number
  unitCost?: number | null  // Custo unitário para produtos sem receita (revenda)
  bulkDiscountMinQty?: number | null
  bulkDiscountPrice?: number | null
  isActive: boolean
  availableIn: string
  quantityIncrement: number
  soldByWeight: boolean
  // 🏷️ Promoções
  isOnPromotion?: boolean
  promotionalPrice?: number | null
  isWeeklyPromotion?: boolean
}

// Interface para clientes afetados por mudança de preço
interface AffectedCustomer {
  customerProductId: string
  customerId: string
  customerName: string
  customerEmail: string | null
  customerPhone: string | null
  currentCustomPrice: number | null
  productPriceWholesale: number
  effectivePrice: number
  hasCustomPrice: boolean
}

interface ProductManagementProps {
  products: Product[]
}

export function ProductManagement({ products: initialProducts }: ProductManagementProps) {
  const router = useRouter()
  const [products, setProducts] = useState(initialProducts)
  const [searchTerm, setSearchTerm] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [weight, setWeight] = useState('')
  const [priceWholesale, setPriceWholesale] = useState('')
  const [priceRetail, setPriceRetail] = useState('')
  const [unitCost, setUnitCost] = useState('')  // Custo unitário para produtos sem receita
  const [bulkDiscountMinQty, setBulkDiscountMinQty] = useState('')
  const [bulkDiscountPrice, setBulkDiscountPrice] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [availableIn, setAvailableIn] = useState('BOTH')
  const [quantityIncrement, setQuantityIncrement] = useState('1')
  const [soldByWeight, setSoldByWeight] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  // 🏷️ States de Promoção
  const [isOnPromotion, setIsOnPromotion] = useState(false)
  const [promotionalPrice, setPromotionalPrice] = useState('')
  const [isWeeklyPromotion, setIsWeeklyPromotion] = useState(false)
  
  // 👥 States para Clientes Afetados
  const [activeTab, setActiveTab] = useState('dados')
  const [affectedCustomers, setAffectedCustomers] = useState<AffectedCustomer[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [customerUpdates, setCustomerUpdates] = useState<Record<string, 'UPDATE' | 'KEEP' | 'CUSTOM'>>({})
  const [customerCustomPrices, setCustomerCustomPrices] = useState<Record<string, string>>({})
  const [originalPrice, setOriginalPrice] = useState<number>(0)
  const [priceChanged, setPriceChanged] = useState(false)
  const [originalImageUrl, setOriginalImageUrl] = useState('')  // 🖼️ Guardar URL original da imagem
  const [customerSearchTerm, setCustomerSearchTerm] = useState('')  // 🔍 Filtro de busca de clientes

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // 👥 Carregar clientes afetados quando editar um produto
  const loadAffectedCustomers = async (productId: string) => {
    setLoadingCustomers(true)
    try {
      const response = await fetch(`/api/products/${productId}/affected-customers`)
      if (response.ok) {
        const data = await response.json()
        setAffectedCustomers(data.affectedCustomers || [])
        // Inicializar todos como UPDATE por padrão e preços personalizados
        const initialUpdates: Record<string, 'UPDATE' | 'KEEP' | 'CUSTOM'> = {}
        const initialPrices: Record<string, string> = {}
        data.affectedCustomers.forEach((c: AffectedCustomer) => {
          initialUpdates[c.customerProductId] = 'UPDATE'
          // Inicializar preço personalizado com o preço efetivo atual
          initialPrices[c.customerProductId] = c.effectivePrice.toFixed(2)
        })
        setCustomerUpdates(initialUpdates)
        setCustomerCustomPrices(initialPrices)
      }
    } catch (error) {
      console.error('Erro ao carregar clientes afetados:', error)
    } finally {
      setLoadingCustomers(false)
    }
  }

  // Detectar mudança de preço
  useEffect(() => {
    if (editingProduct && priceWholesale) {
      const newPrice = parseFloat(priceWholesale)
      const changed = Math.abs(newPrice - originalPrice) > 0.001
      setPriceChanged(changed)
    }
  }, [priceWholesale, originalPrice, editingProduct])

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setName(product.name)
    setDescription(product.description)
    setImageUrl(product.imageUrl)
    setOriginalImageUrl(product.imageUrl)  // 🖼️ Guardar URL original
    setWeight(product.weight)
    setPriceWholesale(product.priceWholesale.toString())
    setPriceRetail(product.priceRetail.toString())
    setUnitCost(product.unitCost?.toString() || '')  // Custo unitário para produtos sem receita
    setBulkDiscountMinQty(product.bulkDiscountMinQty?.toString() || '')
    setBulkDiscountPrice(product.bulkDiscountPrice?.toString() || '')
    setIsActive(product.isActive)
    setAvailableIn(product.availableIn || 'BOTH')
    setQuantityIncrement(product.quantityIncrement.toString())
    setSoldByWeight(product.soldByWeight || false)
    // 🏷️ Promoções
    setIsOnPromotion(product.isOnPromotion || false)
    setPromotionalPrice(product.promotionalPrice?.toString() || '')
    setIsWeeklyPromotion(product.isWeeklyPromotion || false)
    // 👥 Guardar preço original e carregar clientes
    setOriginalPrice(product.priceWholesale)
    setPriceChanged(false)
    setActiveTab('dados')
    setAffectedCustomers([])
    setCustomerUpdates({})
    setCustomerCustomPrices({})
    setCustomerSearchTerm('')
    loadAffectedCustomers(product.id)
    setIsDialogOpen(true)
  }

  const handleAdd = () => {
    setEditingProduct(null)
    setName('')
    setDescription('')
    setImageUrl('')
    setWeight('')
    setPriceWholesale('')
    setPriceRetail('')
    setUnitCost('')  // Resetar custo unitário
    setBulkDiscountMinQty('')
    setBulkDiscountPrice('')
    setIsActive(true)
    setAvailableIn('BOTH')
    setQuantityIncrement('1')
    setSoldByWeight(false)
    // 🏷️ Resetar Promoções
    setIsOnPromotion(false)
    setPromotionalPrice('')
    setIsWeeklyPromotion(false)
    setIsDialogOpen(true)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar tipo de arquivo
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      toast.error('Tipo de arquivo inválido. Use JPG, PNG ou WEBP.')
      return
    }

    setIsUploading(true)

    try {
      // Se for edição, fazer upload direto
      if (editingProduct) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('productId', editingProduct.id)

        const response = await fetch('/api/products/upload-image', {
          method: 'POST',
          body: formData
        })

        if (response.ok) {
          const data = await response.json()
          setImageUrl(data.imageUrl)
          toast.success('Imagem atualizada!')
        } else {
          toast.error('Erro ao fazer upload da imagem')
        }
      } else {
        // Se for novo produto, mostrar preview local
        const reader = new FileReader()
        reader.onloadend = () => {
          setImageUrl(reader.result as string)
          toast.success('Imagem selecionada! Salve o produto para confirmar.')
        }
        reader.readAsDataURL(file)
      }
    } catch (error) {
      console.error(error)
      toast.error('Erro ao processar imagem')
    } finally {
      setIsUploading(false)
    }
  }

  const handleSave = async () => {
    try {
      const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products'
      const method = editingProduct ? 'PUT' : 'POST'

      // 🖼️ Usar URL original se não foi alterada, para evitar perder a imagem
      const finalImageUrl = imageUrl || originalImageUrl || 'https://upload.wikimedia.org/wikipedia/commons/6/65/No-Image-Placeholder.svg'

      const payload = {
        name: name || 'Produto Sem Nome',
        description: description || '',
        imageUrl: finalImageUrl,
        weight: weight || '',
        priceWholesale: parseFloat(priceWholesale) || 0,
        priceRetail: parseFloat(priceRetail) || 0,
        unitCost: unitCost ? parseFloat(unitCost) : null,  // Custo unitário para produtos sem receita
        bulkDiscountMinQty: bulkDiscountMinQty ? parseInt(bulkDiscountMinQty) : null,
        bulkDiscountPrice: bulkDiscountPrice ? parseFloat(bulkDiscountPrice) : null,
        quantityIncrement: parseInt(quantityIncrement) || 1,
        soldByWeight: soldByWeight,
        isActive: isActive,
        availableIn: availableIn,
        // 🏷️ Promoções
        isOnPromotion: isOnPromotion,
        promotionalPrice: promotionalPrice ? parseFloat(promotionalPrice) : null,
        isWeeklyPromotion: isWeeklyPromotion
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        // 👥 Se o preço mudou e há clientes afetados, processar atualizações
        if (editingProduct && priceChanged && affectedCustomers.length > 0) {
          const newPrice = parseFloat(priceWholesale)
          const updates = affectedCustomers.map(customer => {
            const action = customerUpdates[customer.customerProductId] || 'UPDATE'
            
            // Determinar o preço a ser aplicado baseado na ação
            let newCustomPrice: number | null = null
            
            if (action === 'CUSTOM') {
              // CUSTOM: usar o preço personalizado digitado
              const customPriceStr = customerCustomPrices[customer.customerProductId]
              newCustomPrice = customPriceStr ? parseFloat(customPriceStr) : customer.effectivePrice
            } else if (action === 'KEEP') {
              // KEEP: manter o preço antigo
              newCustomPrice = customer.effectivePrice
            }
            // UPDATE: newCustomPrice = null (usa o preço do produto)

            return {
              customerProductId: customer.customerProductId,
              action: action === 'CUSTOM' ? 'UPDATE' : action, // API entende UPDATE com newPrice como custom
              keepOldPrice: action === 'KEEP',
              oldPrice: customer.effectivePrice,
              newPrice: action === 'UPDATE' ? null : newCustomPrice  // null = usa preço do produto
            }
          })

          try {
            const customerResponse = await fetch(`/api/products/${editingProduct.id}/affected-customers`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ newProductPrice: newPrice, customerUpdates: updates })
            })

            if (customerResponse.ok) {
              const result = await customerResponse.json()
              toast.success(`Produto salvo! ${result.message}`)
            } else {
              toast.success('Produto salvo, mas houve erro ao atualizar alguns clientes')
            }
          } catch (err) {
            toast.success('Produto salvo, mas houve erro ao atualizar clientes')
          }
        } else {
          toast.success('Produto salvo com sucesso!')
        }
        
        setIsDialogOpen(false)
        window.location.reload()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Erro ao salvar produto')
      }
    } catch (error) {
      console.error(error)
      toast.error('Erro ao salvar produto')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return

    try {
      const response = await fetch(`/api/products/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Erro ao excluir produto')

      toast.success('Produto excluído!')
      setProducts(products.filter(p => p.id !== id))
    } catch (error) {
      toast.error('Erro ao excluir produto')
    }
  }

  const handleToggleActive = async (product: Product) => {
    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...product, isActive: !product.isActive })
      })

      if (!response.ok) throw new Error('Erro ao atualizar produto')

      toast.success(product.isActive ? 'Produto desativado!' : 'Produto ativado!')
      router.refresh()
    } catch (error) {
      toast.error('Erro ao atualizar produto')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-amber-50">
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto max-w-7xl flex h-16 items-center justify-between px-4">
          <div 
            className="flex items-center space-x-3 cursor-pointer" 
            onClick={() => window.location.href = '/admin'}
          >
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-white">
              <Image 
                src="/logo.jpg" 
                alt="[SUA EMPRESA]" 
                fill 
                className="object-contain"
              />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Gerenciar Produtos</h1>
              <p className="text-xs text-gray-600">[SUA EMPRESA]</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <HomeButton />
            <Button onClick={handleAdd} className="bg-red-600 hover:bg-red-700">
              <Plus className="w-4 h-4 mr-2" />
              Novo Produto
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl px-4 py-8">
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Buscar produtos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <Card key={product.id} className={product.isOnPromotion ? 'ring-2 ring-orange-400' : ''}>
              {/* Badges no canto superior */}
              <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
                {!product.isActive && (
                  <Badge variant="secondary">Inativo</Badge>
                )}
                {product.isOnPromotion && (
                  <Badge className="bg-orange-500 hover:bg-orange-600">
                    <Tag className="w-3 h-3 mr-1" />
                    Promoção
                  </Badge>
                )}
                {product.isWeeklyPromotion && (
                  <Badge className="bg-red-500 hover:bg-red-600">
                    ⭐ Semana
                  </Badge>
                )}
              </div>
              
              <div className="relative w-full aspect-square bg-gray-200">
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  className="object-cover"
                />
              </div>

              <CardHeader>
                <CardTitle className="text-lg">{product.name}</CardTitle>
                <CardDescription className="line-clamp-2">{product.description}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Atacado:</span>
                  <div className="text-right">
                    {product.isOnPromotion && product.promotionalPrice ? (
                      <>
                        <span className="text-sm text-gray-400 line-through mr-2">{formatCurrency(product.priceWholesale)}</span>
                        <span className="font-bold text-orange-600">{formatCurrency(product.promotionalPrice)}</span>
                        <p className="text-xs text-orange-500">PIX/Dinheiro</p>
                      </>
                    ) : (
                      <span className="font-bold text-green-600">{formatCurrency(product.priceWholesale)}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Varejo:</span>
                  <span className="font-bold text-blue-600">{formatCurrency(product.priceRetail)}</span>
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <Switch checked={product.isActive} onCheckedChange={() => handleToggleActive(product)} />
                    <span className="text-sm text-gray-600">Ativo</span>
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleEdit(product)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDelete(product.id)} className="text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <Card className="p-12">
            <div className="text-center">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum produto encontrado</h3>
              <Button onClick={handleAdd} className="bg-red-600 hover:bg-red-700">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Produto
              </Button>
            </div>
          </Card>
        )}
      </main>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
            <DialogDescription>
              {editingProduct ? 'Edite os dados do produto' : 'Todos os campos são opcionais'}
            </DialogDescription>
          </DialogHeader>

          {/* 👥 Abas: Dados do Produto + Clientes Afetados */}
          {editingProduct ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="dados" className="flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Dados do Produto
                </TabsTrigger>
                <TabsTrigger value="clientes" className="flex items-center gap-2 relative">
                  <Users className="w-4 h-4" />
                  Clientes Afetados
                  {affectedCustomers.length > 0 && (
                    <Badge variant={priceChanged ? "destructive" : "secondary"} className="ml-1">
                      {affectedCustomers.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Aba: Dados do Produto */}
              <TabsContent value="dados" className="space-y-4">
                <div>
                  <Label>Nome do Produto</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>

                <div>
                  <Label>Descrição</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                </div>

            <div>
              <Label>Imagem do Produto</Label>
              {imageUrl && (
                <div className="mb-4 relative w-full h-64 bg-gray-100 rounded-lg overflow-hidden">
                  <Image
                    src={imageUrl}
                    alt="Preview"
                    fill
                    className="object-contain"
                  />
                </div>
              )}
              <Input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleImageUpload}
                disabled={isUploading}
                className="cursor-pointer"
              />
              {isUploading && (
                <p className="text-sm text-gray-500 mt-2">Fazendo upload...</p>
              )}
              <p className="text-xs text-gray-500 mt-2">
                {editingProduct 
                  ? 'Selecione uma nova imagem para substituir a atual' 
                  : 'Selecione uma imagem (JPG, PNG ou WEBP)'}
              </p>
            </div>

            <div>
              <Label>Peso</Label>
              <Input value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="Ex: 200g" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Preço Atacado (R$)</Label>
                <Input type="number" step="0.01" value={priceWholesale} onChange={(e) => setPriceWholesale(e.target.value)} />
              </div>

              <div>
                <Label>Preço Varejo (R$)</Label>
                <Input type="number" step="0.01" value={priceRetail} onChange={(e) => setPriceRetail(e.target.value)} />
              </div>
            </div>

            {/* 💰 Custo Unitário para Produtos de Revenda */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-3 text-orange-700">💰 Custo Unitário (Produtos de Revenda)</h3>
              <p className="text-xs text-gray-500 mb-3">
                Para produtos sem receita (acendedor, pão de alho, etc.), informe o custo unitário de aquisição.
                Isso permite calcular a lucratividade real mesmo sem uma receita cadastrada.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Custo Unitário (R$)</Label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    value={unitCost} 
                    onChange={(e) => setUnitCost(e.target.value)}
                    placeholder="Ex: 1,95"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-3 text-gray-700">Desconto Progressivo (Opcional)</h3>
              <p className="text-xs text-gray-500 mb-3">
                Configure um desconto por quantidade. Quando o cliente atingir a quantidade mínima, o preço com desconto será aplicado.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Quantidade Mínima</Label>
                  <Input 
                    type="number" 
                    step="1" 
                    value={bulkDiscountMinQty} 
                    onChange={(e) => setBulkDiscountMinQty(e.target.value)}
                    placeholder="Ex: 25"
                  />
                </div>

                <div>
                  <Label>Preço com Desconto (R$)</Label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    value={bulkDiscountPrice} 
                    onChange={(e) => setBulkDiscountPrice(e.target.value)}
                    placeholder="Ex: 5.40"
                  />
                </div>
              </div>
            </div>

            {/* 🏷️ SEÇÃO DE PROMOÇÃO */}
            <div className="border-t pt-4 bg-gradient-to-r from-orange-50 to-red-50 -mx-6 px-6 pb-4">
              <div className="flex items-center gap-2 mb-3">
                <Tag className="w-5 h-5 text-orange-600" />
                <h3 className="text-sm font-semibold text-gray-700">Promoção</h3>
              </div>
              
              <div className="flex items-center gap-2 mb-4">
                <Switch 
                  checked={isOnPromotion} 
                  onCheckedChange={(checked) => {
                    setIsOnPromotion(checked)
                    if (!checked) {
                      setPromotionalPrice('')
                      setIsWeeklyPromotion(false)
                    }
                  }} 
                />
                <Label className="font-medium">Colocar produto em promoção?</Label>
              </div>

              {isOnPromotion && (
                <div className="space-y-4 pl-2 border-l-2 border-orange-300">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-xs text-yellow-800">
                      <strong>⚠️ Atenção:</strong> O preço promocional só vale para pagamentos em <strong>PIX</strong> ou <strong>Dinheiro</strong>. 
                      Boleto e Cartão continuam com o preço normal.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Preço Normal (R$)</Label>
                      <Input 
                        type="number" 
                        step="0.01" 
                        value={priceWholesale} 
                        disabled
                        className="bg-gray-100"
                      />
                      <p className="text-xs text-gray-500 mt-1">Este é o preço cheio (atacado)</p>
                    </div>

                    <div>
                      <Label className="text-orange-600 font-semibold">Preço Promocional (R$) *</Label>
                      <Input 
                        type="number" 
                        step="0.01" 
                        value={promotionalPrice} 
                        onChange={(e) => setPromotionalPrice(e.target.value)}
                        placeholder="Ex: 5.50"
                        className="border-orange-300 focus:border-orange-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">Preço com desconto para PIX/Dinheiro</p>
                    </div>
                  </div>

                  {promotionalPrice && parseFloat(priceWholesale) > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-sm text-green-800">
                        <strong>Economia:</strong> {((1 - parseFloat(promotionalPrice) / parseFloat(priceWholesale)) * 100).toFixed(1)}% de desconto
                        {' '}(de R$ {parseFloat(priceWholesale).toFixed(2)} por R$ {parseFloat(promotionalPrice).toFixed(2)})
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2">
                    <Switch 
                      checked={isWeeklyPromotion} 
                      onCheckedChange={setIsWeeklyPromotion} 
                    />
                    <Label className="font-medium text-orange-700">⭐ Promoção da Semana (destaque especial)</Label>
                  </div>
                  <p className="text-xs text-gray-500 -mt-2 ml-8">
                    Marque esta opção para destacar este produto como a promoção principal da semana
                  </p>
                </div>
              )}
            </div>

            <div>
              <Label>Incremento de Quantidade</Label>
              <Select value={quantityIncrement} onValueChange={setQuantityIncrement}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 em 1</SelectItem>
                  <SelectItem value="2">2 em 2</SelectItem>
                  <SelectItem value="3">3 em 3</SelectItem>
                  <SelectItem value="4">4 em 4</SelectItem>
                  <SelectItem value="5">5 em 5</SelectItem>
                  <SelectItem value="7">7 em 7</SelectItem>
                  <SelectItem value="10">10 em 10</SelectItem>
                  <SelectItem value="20">20 em 20</SelectItem>
                  <SelectItem value="25">25 em 25</SelectItem>
                  <SelectItem value="40">40 em 40</SelectItem>
                  <SelectItem value="50">50 em 50</SelectItem>
                  <SelectItem value="70">70 em 70</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Disponível em</Label>
              <Select value={availableIn} onValueChange={setAvailableIn}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BOTH">Varejo e Atacado</SelectItem>
                  <SelectItem value="RETAIL">Apenas Varejo</SelectItem>
                  <SelectItem value="WHOLESALE">Apenas Atacado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={soldByWeight} onCheckedChange={setSoldByWeight} />
              <Label>Vendido por Peso (kg)</Label>
            </div>
            <p className="text-xs text-gray-500 -mt-2 ml-8">
              Quando ativado, permite especificar quantidades decimais como 1,350 kg
            </p>

            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Produto ativo</Label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} className="bg-red-600 hover:bg-red-700">Salvar</Button>
            </div>
              </TabsContent>

              {/* Aba: Clientes Afetados */}
              <TabsContent value="clientes" className="space-y-4">
                {/* Alerta de mudança de preço */}
                {priceChanged && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-amber-800">Preço Alterado!</h4>
                        <p className="text-sm text-amber-700">
                          O preço atacado mudou de <strong>R$ {originalPrice.toFixed(2)}</strong> para <strong>R$ {parseFloat(priceWholesale).toFixed(2)}</strong>.
                          Selecione abaixo quais clientes devem ter o preço atualizado.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {!priceChanged && affectedCustomers.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-700">
                      <strong>{affectedCustomers.length} cliente(s)</strong> têm este produto em seus catálogos personalizados.
                      Se alterar o preço, você poderá escolher quais clientes serão afetados.
                    </p>
                  </div>
                )}

                {loadingCustomers ? (
                  <div className="text-center py-8">
                    <div className="animate-spin h-8 w-8 border-4 border-red-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                    <p className="text-gray-500">Carregando clientes...</p>
                  </div>
                ) : affectedCustomers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>Nenhum cliente tem este produto em catálogo personalizado.</p>
                    <p className="text-sm">Todos os clientes usam o preço padrão do produto.</p>
                  </div>
                ) : (
                  <>
                    {/* 🔍 Campo de busca de clientes */}
                    <div className="mb-4">
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Buscar cliente por nome..."
                          value={customerSearchTerm}
                          onChange={(e) => setCustomerSearchTerm(e.target.value)}
                          className="max-w-md"
                        />
                        {customerSearchTerm && (
                          <span className="text-sm text-gray-500">
                            {affectedCustomers.filter(c => c.customerName.toLowerCase().includes(customerSearchTerm.toLowerCase())).length} de {affectedCustomers.length}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Ações em massa */}
                    {priceChanged && (
                      <div className="flex gap-2 mb-4">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            const newUpdates: Record<string, 'UPDATE' | 'KEEP'> = {}
                            affectedCustomers.forEach(c => newUpdates[c.customerProductId] = 'UPDATE')
                            setCustomerUpdates(newUpdates)
                          }}
                          className="text-green-600 border-green-300 hover:bg-green-50"
                        >
                          <Check className="w-4 h-4 mr-1" /> Atualizar Todos
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            const newUpdates: Record<string, 'UPDATE' | 'KEEP'> = {}
                            affectedCustomers.forEach(c => newUpdates[c.customerProductId] = 'KEEP')
                            setCustomerUpdates(newUpdates)
                          }}
                          className="text-amber-600 border-amber-300 hover:bg-amber-50"
                        >
                          <X className="w-4 h-4 mr-1" /> Manter Todos
                        </Button>
                      </div>
                    )}

                    {/* Lista de clientes (filtrada por busca) */}
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {affectedCustomers
                        .filter(customer => 
                          customer.customerName.toLowerCase().includes(customerSearchTerm.toLowerCase())
                        )
                        .map((customer) => {
                        const action = customerUpdates[customer.customerProductId] || 'UPDATE'
                        const customPrice = customerCustomPrices[customer.customerProductId] || ''
                        
                        return (
                          <div 
                            key={customer.customerProductId}
                            className={`p-3 rounded-lg border ${
                              priceChanged 
                                ? action === 'UPDATE'
                                  ? 'bg-green-50 border-green-200'
                                  : action === 'KEEP'
                                    ? 'bg-amber-50 border-amber-200'
                                    : 'bg-blue-50 border-blue-200'
                                : 'bg-gray-50 border-gray-200'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 truncate">{customer.customerName}</p>
                                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                                  <span>
                                    Preço atual: <strong className="text-gray-700">R$ {customer.effectivePrice.toFixed(2)}</strong>
                                    {customer.hasCustomPrice && (
                                      <Badge variant="outline" className="ml-1 text-xs">Personalizado</Badge>
                                    )}
                                  </span>
                                  {priceChanged && (
                                    <>
                                      {action === 'UPDATE' && (
                                        <span className="text-green-600">
                                          → Novo: <strong>R$ {parseFloat(priceWholesale).toFixed(2)}</strong>
                                        </span>
                                      )}
                                      {action === 'KEEP' && (
                                        <span className="text-amber-600">
                                          → Manter: <strong>R$ {customer.effectivePrice.toFixed(2)}</strong>
                                        </span>
                                      )}
                                      {action === 'CUSTOM' && (
                                        <span className="text-blue-600">
                                          → Personalizado: <strong>R$ {parseFloat(customPrice || '0').toFixed(2)}</strong>
                                        </span>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                              
                              {priceChanged && (
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {/* Campo de preço personalizado (só aparece se CUSTOM está selecionado) */}
                                  {action === 'CUSTOM' && (
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-500">R$</span>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={customPrice}
                                        onChange={(e) => setCustomerCustomPrices(prev => ({
                                          ...prev,
                                          [customer.customerProductId]: e.target.value
                                        }))}
                                        className="w-20 h-8 text-sm"
                                        placeholder="0.00"
                                      />
                                    </div>
                                  )}
                                  
                                  {/* Botões de ação */}
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant={action === 'UPDATE' ? 'default' : 'outline'}
                                      className={`w-8 h-8 p-0 ${action === 'UPDATE' 
                                        ? 'bg-green-600 hover:bg-green-700' 
                                        : 'text-green-600 border-green-300 hover:bg-green-50'}`}
                                      onClick={() => setCustomerUpdates(prev => ({
                                        ...prev,
                                        [customer.customerProductId]: 'UPDATE'
                                      }))}
                                      title="Atualizar para novo preço"
                                    >
                                      <Check className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant={action === 'KEEP' ? 'default' : 'outline'}
                                      className={`w-8 h-8 p-0 ${action === 'KEEP' 
                                        ? 'bg-amber-600 hover:bg-amber-700' 
                                        : 'text-amber-600 border-amber-300 hover:bg-amber-50'}`}
                                      onClick={() => setCustomerUpdates(prev => ({
                                        ...prev,
                                        [customer.customerProductId]: 'KEEP'
                                      }))}
                                      title="Manter preço atual"
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant={action === 'CUSTOM' ? 'default' : 'outline'}
                                      className={`w-8 h-8 p-0 ${action === 'CUSTOM' 
                                        ? 'bg-blue-600 hover:bg-blue-700' 
                                        : 'text-blue-600 border-blue-300 hover:bg-blue-50'}`}
                                      onClick={() => setCustomerUpdates(prev => ({
                                        ...prev,
                                        [customer.customerProductId]: 'CUSTOM'
                                      }))}
                                      title="Definir preço personalizado"
                                    >
                                      <Edit3 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Resumo */}
                    {priceChanged && (
                      <div className="bg-gray-100 rounded-lg p-3 mt-4">
                        <p className="text-sm text-gray-700">
                          <strong>Resumo:</strong>{' '}
                          <span className="text-green-600">
                            {Object.values(customerUpdates).filter(v => v === 'UPDATE').length} atualizados
                          </span>
                          {' | '}
                          <span className="text-amber-600">
                            {Object.values(customerUpdates).filter(v => v === 'KEEP').length} mantidos
                          </span>
                          {' | '}
                          <span className="text-blue-600">
                            {Object.values(customerUpdates).filter(v => v === 'CUSTOM').length} personalizados
                          </span>
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          ✅ = atualizar para R$ {parseFloat(priceWholesale).toFixed(2)} | 
                          ❌ = manter preço atual | 
                          ✏️ = definir preço específico
                        </p>
                      </div>
                    )}
                  </>
                )}

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={handleSave} className="bg-red-600 hover:bg-red-700">Salvar Produto</Button>
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            /* Formulário para NOVO produto (sem abas) */
            <div className="space-y-4">
              <div>
                <Label>Nome do Produto</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div>
                <Label>Descrição</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              </div>

              <div>
                <Label>Imagem do Produto</Label>
                {imageUrl && (
                  <div className="mb-4 relative w-full h-64 bg-gray-100 rounded-lg overflow-hidden">
                    <Image src={imageUrl} alt="Preview" fill className="object-contain" />
                  </div>
                )}
                <Input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleImageUpload}
                  disabled={isUploading}
                  className="cursor-pointer"
                />
                {isUploading && <p className="text-sm text-gray-500 mt-2">Fazendo upload...</p>}
              </div>

              <div>
                <Label>Peso</Label>
                <Input value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="Ex: 200g" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Preço Atacado (R$)</Label>
                  <Input type="number" step="0.01" value={priceWholesale} onChange={(e) => setPriceWholesale(e.target.value)} />
                </div>
                <div>
                  <Label>Preço Varejo (R$)</Label>
                  <Input type="number" step="0.01" value={priceRetail} onChange={(e) => setPriceRetail(e.target.value)} />
                </div>
              </div>

              <div>
                <Label>Incremento de Quantidade</Label>
                <Select value={quantityIncrement} onValueChange={setQuantityIncrement}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 em 1</SelectItem>
                    <SelectItem value="5">5 em 5</SelectItem>
                    <SelectItem value="10">10 em 10</SelectItem>
                    <SelectItem value="25">25 em 25</SelectItem>
                    <SelectItem value="50">50 em 50</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Disponível em</Label>
                <Select value={availableIn} onValueChange={setAvailableIn}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BOTH">Varejo e Atacado</SelectItem>
                    <SelectItem value="RETAIL">Apenas Varejo</SelectItem>
                    <SelectItem value="WHOLESALE">Apenas Atacado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Switch checked={soldByWeight} onCheckedChange={setSoldByWeight} />
                <Label>Vendido por Peso (kg)</Label>
              </div>

              <div className="flex items-center gap-2">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                <Label>Produto ativo</Label>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave} className="bg-red-600 hover:bg-red-700">Salvar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
