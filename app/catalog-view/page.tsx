'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Search, Package, ShoppingBag, Info, Tag, Star } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface Product {
  id: string
  name: string
  description: string
  category: string
  priceWholesale: number
  priceRetail: number
  weight: string
  isActive: boolean
  availableIn: string
  quantityIncrement: number
  imageUrl: string
  // 🏷️ Promoções
  isOnPromotion?: boolean
  promotionalPrice?: number | null
  isWeeklyPromotion?: boolean
}

export default function CatalogViewPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<string[]>([])
  const [productsByCategory, setProductsByCategory] = useState<Record<string, Product[]>>({})
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadCatalog()
  }, [])

  const loadCatalog = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/catalog/public')
      const data = await response.json()
      
      if (data.success) {
        setCategories(data.categories || [])
        setProductsByCategory(data.productsByCategory || {})
      }
    } catch (error) {
      console.error('Erro ao carregar catálogo:', error)
    } finally {
      setLoading(false)
    }
  }

  const getFilteredProducts = () => {
    let products: Product[] = []
    
    if (selectedCategory === 'all') {
      products = Object.values(productsByCategory).flat()
    } else {
      products = productsByCategory[selectedCategory] || []
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      products = products.filter(p => 
        p.name.toLowerCase().includes(search) ||
        p.description.toLowerCase().includes(search)
      )
    }

    return products
  }

  const filteredProducts = getFilteredProducts()

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <Package className="w-8 h-8 text-white animate-pulse" />
          </div>
          <p className="text-lg text-gray-600">Carregando catálogo...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-amber-50">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto max-w-6xl flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Button>
            <div className="flex items-center space-x-3">
              <Image 
                src="/logo.jpg" 
                alt="[SUA EMPRESA]" 
                width={40} 
                height={40}
                className="rounded-lg"
              />
              <div>
                <h1 className="text-lg font-bold text-gray-900">Catálogo do Atacado</h1>
                <p className="text-xs text-gray-600">Visualização apenas</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto max-w-6xl px-4 py-8">
        {/* Info Alert */}
        <Alert className="mb-6 border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-900">
            <strong>Visualização do Catálogo:</strong> Esta é uma visualização dos produtos disponíveis para atacado. 
            Para fazer pedidos, é necessário ser um cliente cadastrado.
          </AlertDescription>
        </Alert>

        {/* Filters */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 mb-6 shadow-lg">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Buscar produtos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Categorias</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-lg text-gray-600">Nenhum produto encontrado</p>
            <p className="text-sm text-gray-500 mt-2">
              {searchTerm ? 'Tente ajustar sua busca' : 'Não há produtos disponíveis no momento'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <Card key={product.id} className={`overflow-hidden border-2 hover:border-red-300 transition-all duration-300 hover:shadow-xl ${product.isOnPromotion ? 'border-orange-400 ring-2 ring-orange-200' : ''}`}>
                {/* Product Image */}
                {product.imageUrl && (
                  <div className="relative aspect-video bg-gray-100">
                    <Image 
                      src={product.imageUrl}
                      alt={product.name}
                      fill
                      className="object-cover"
                    />
                    {/* 🏷️ Badges de Promoção na imagem */}
                    {product.isOnPromotion && (
                      <div className="absolute top-2 left-2 flex flex-col gap-1">
                        <Badge className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold">
                          <Tag className="w-3 h-3 mr-1" />
                          PROMOÇÃO
                        </Badge>
                        {product.isWeeklyPromotion && (
                          <Badge className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold">
                            <Star className="w-3 h-3 mr-1" />
                            SEMANA
                          </Badge>
                        )}
                      </div>
                    )}
                    {/* Badge de desconto */}
                    {product.isOnPromotion && product.promotionalPrice && (
                      <div className="absolute top-2 right-2">
                        <Badge className="bg-green-600 text-white text-xs font-bold">
                          -{Math.round(((product.priceWholesale - product.promotionalPrice) / product.priceWholesale) * 100)}%
                        </Badge>
                      </div>
                    )}
                  </div>
                )}
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg line-clamp-2">{product.name}</CardTitle>
                      {product.category && (
                        <Badge variant="secondary" className="mt-2">
                          {product.category}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {product.description && (
                    <CardDescription className="text-sm mb-4 line-clamp-2">
                      {product.description}
                    </CardDescription>
                  )}
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Preço Atacado:</span>
                      {product.isOnPromotion && product.promotionalPrice ? (
                        <div className="text-right">
                          <span className="text-sm text-gray-400 line-through mr-2">
                            R$ {product.priceWholesale.toFixed(2)}
                          </span>
                          <span className="font-bold text-orange-600 text-lg">
                            R$ {product.promotionalPrice.toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <span className="font-semibold text-red-600">
                          R$ {product.priceWholesale.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Peso:</span>
                      <span className="font-medium">{product.weight}</span>
                    </div>
                    {product.quantityIncrement > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Incremento:</span>
                        <span className="font-medium">{product.quantityIncrement}</span>
                      </div>
                    )}
                  </div>

                  {/* 🏷️ Aviso de promoção */}
                  {product.isOnPromotion && (
                    <div className="mt-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <p className="text-xs text-orange-700 text-center font-medium">
                        💰 Preço promocional para PIX ou Dinheiro
                      </p>
                    </div>
                  )}

                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-600 text-center">
                      <Info className="w-3 h-3 inline mr-1" />
                      Preços personalizados para clientes cadastrados
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Footer CTA */}
      <div className="container mx-auto max-w-6xl px-4 py-12">
        <Card className="bg-gradient-to-r from-red-600 to-orange-600 text-white border-0">
          <CardContent className="p-8 text-center">
            <h3 className="text-2xl font-bold mb-4">Interessado em fazer pedidos?</h3>
            <p className="mb-6 text-white/90">
              Torne-se um cliente cadastrado e tenha acesso a preços especiais, 
              limite de crédito e muito mais!
            </p>
            <div className="flex gap-4 justify-center">
              <Button 
                size="lg"
                variant="secondary"
                onClick={() => router.push('/auth/login')}
                className="bg-white text-red-600 hover:bg-gray-100"
              >
                <ShoppingBag className="w-5 h-5 mr-2" />
                Fazer Login
              </Button>
              <Button 
                size="lg"
                variant="outline"
                onClick={() => router.push('/')}
                className="border-white text-white hover:bg-white/20"
              >
                Voltar ao Início
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
