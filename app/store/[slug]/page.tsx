'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  ShoppingCart, 
  Plus, 
  Minus,
  MapPin,
  Phone,
  User,
  LogIn,
  Search,
  Flame,
  Package
} from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

interface StoreInfo {
  id: string
  name: string
  storeName: string | null
  phone: string
  city: string | null
  address: string | null
}

interface Product {
  id: string
  name: string
  description: string | null
  category: string
  unitPrice: number
  imageUrl: string | null
  currentStock: number
  measurementUnit: string
}

interface CartItem {
  product: Product
  quantity: number
}

export default function PublicStorePage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null)
  const [products, setProducts] = useState<Product[]>([])  
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<{[key: string]: number}>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Carregar dados da loja e produtos
  useEffect(() => {
    fetchStoreData()
    loadCartFromStorage()
    checkAuthStatus()
  }, [slug])

  // Filtrar produtos por busca e categoria
  useEffect(() => {
    let filtered = products

    if (searchTerm) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category === selectedCategory)
    }

    setFilteredProducts(filtered)
  }, [searchTerm, selectedCategory, products])

  // Salvar carrinho no localStorage sempre que mudar
  useEffect(() => {
    if (Object.keys(cart).length > 0) {
      const cartData = JSON.stringify(cart)
      localStorage.setItem(`publicCart_${slug}`, cartData)
      console.log('[LOJA] Carrinho salvo no localStorage:', cartData)
    }
  }, [cart, slug])

  const fetchStoreData = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/public/store/${slug}/catalog`)
      
      if (!response.ok) {
        if (response.status === 404) {
          toast.error('Loja não encontrada')
          router.push('/')
          return
        }
        throw new Error('Erro ao carregar loja')
      }

      const data = await response.json()
      setStoreInfo(data.store)
      setProducts(data.products || [])
      setFilteredProducts(data.products || [])
      console.log('[LOJA] Produtos carregados:', data.products?.length || 0)
      if (data.products && data.products.length > 0) {
        console.log('[LOJA] Exemplo de IDs de produtos:', data.products.slice(0, 3).map((p: any) => p.id))
      }
    } catch (error) {
      console.error('Erro ao carregar loja:', error)
      toast.error('Erro ao carregar produtos da loja')
    } finally {
      setIsLoading(false)
    }
  }

  const loadCartFromStorage = () => {
    const savedCart = localStorage.getItem(`publicCart_${slug}`)
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart))
      } catch (error) {
        console.error('Erro ao carregar carrinho:', error)
      }
    }
  }

  const checkAuthStatus = () => {
    const authData = localStorage.getItem(`publicAuth_${slug}`)
    setIsAuthenticated(!!authData)
  }

  const addToCart = (productId: string) => {
    const product = products.find(p => p.id === productId)
    if (!product) return

    const currentQty = cart[productId] || 0
    const newQty = currentQty + 1

    // ✅ LOJA PÚBLICA: Não há controle de estoque
    // Os pedidos são aceitos independente do estoque disponível
    console.log(`[LOJA_PÚBLICA] Adicionando produto ${product.name} (ID: ${productId}) ao carrinho (qty: ${newQty})`)

    setCart(prev => {
      const newCart = { ...prev, [productId]: newQty }
      console.log('[LOJA] Novo estado do carrinho:', newCart)
      return newCart
    })
    toast.success('Produto adicionado ao carrinho')
  }

  const removeFromCart = (productId: string) => {
    const currentQty = cart[productId] || 0
    if (currentQty <= 1) {
      const newCart = { ...cart }
      delete newCart[productId]
      setCart(newCart)
      localStorage.removeItem(`publicCart_${slug}`)
    } else {
      setCart(prev => ({ ...prev, [productId]: currentQty - 1 }))
    }
  }

  const getTotalItems = () => {
    return Object.values(cart).reduce((sum, qty) => sum + qty, 0)
  }

  const getTotalPrice = () => {
    return Object.entries(cart).reduce((sum, [productId, qty]) => {
      const product = products.find(p => p.id === productId)
      return sum + (product?.unitPrice || 0) * qty
    }, 0)
  }

  const getCartItems = (): CartItem[] => {
    return Object.entries(cart)
      .map(([productId, quantity]) => {
        const product = products.find(p => p.id === productId)
        if (!product) return null
        return { product, quantity }
      })
      .filter((item): item is CartItem => item !== null)
  }

  const handleCheckout = () => {
    if (getTotalItems() === 0) {
      toast.error('Adicione produtos ao carrinho')
      return
    }

    if (!isAuthenticated) {
      toast.info('Faça login para continuar')
      router.push(`/store/${slug}/auth`)
      return
    }

    router.push(`/store/${slug}/checkout`)
  }

  const categories = ['all', ...Array.from(new Set(products.map(p => p.category)))]

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50">
        <div className="text-center">
          <Flame className="w-16 h-16 text-orange-600 animate-pulse mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-700">Carregando loja...</p>
        </div>
      </div>
    )
  }

  if (!storeInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-700">Loja não encontrada</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50">
      {/* Header da Loja */}
      <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Flame className="w-10 h-10" />
                <h1 className="text-3xl md:text-4xl font-bold">
                  {storeInfo.storeName || storeInfo.name}
                </h1>
              </div>
              <div className="flex flex-wrap gap-4 text-orange-100">
                {storeInfo.city && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    <span>{storeInfo.city}</span>
                  </div>
                )}
                {storeInfo.phone && (
                  <div className="flex items-center gap-1">
                    <Phone className="w-4 h-4" />
                    <span>{storeInfo.phone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="flex gap-2">
              {!isAuthenticated && (
                <Button
                  onClick={() => router.push(`/store/${slug}/auth`)}
                  variant="secondary"
                  size="sm"
                  className="bg-white text-orange-600 hover:bg-orange-50"
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  Entrar
                </Button>
              )}
              {isAuthenticated && (
                <Button
                  onClick={() => router.push(`/store/${slug}/account`)}
                  variant="secondary"
                  size="sm"
                  className="bg-white text-orange-600 hover:bg-orange-50"
                >
                  <User className="w-4 h-4 mr-2" />
                  Minha Conta
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Busca e Filtros */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Busca */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Buscar produtos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white border-gray-300 focus:border-orange-500 focus:ring-orange-500"
            />
          </div>

          {/* Filtro de Categoria */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map((category) => (
              <Button
                key={category}
                onClick={() => setSelectedCategory(category)}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                className={selectedCategory === category ? 'bg-orange-600 hover:bg-orange-700' : ''}
              >
                {category === 'all' ? 'Todos' : category}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Grade de Produtos */}
      <div className="max-w-7xl mx-auto px-4 pb-24">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-lg text-gray-500">Nenhum produto encontrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => {
              const quantity = cart[product.id] || 0
              const isInCart = quantity > 0

              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="overflow-hidden hover:shadow-xl transition-shadow duration-300 h-full flex flex-col">
                    {/* Imagem do Produto */}
                    <div className="relative aspect-square bg-gray-100">
                      <Image
                        src={product.imageUrl || '/placeholder-product.jpg'}
                        alt={product.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                      {product.category && (
                        <Badge className="absolute top-2 right-2 bg-orange-600">
                          {product.category}
                        </Badge>
                      )}
                    </div>

                    {/* Informações do Produto */}
                    <CardContent className="p-4 flex-1 flex flex-col">
                      <h3 className="font-bold text-lg mb-1" style={{ color: '#1a1a1a' }}>
                        {product.name}
                      </h3>
                      {product.description && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                          {product.description}
                        </p>
                      )}

                      <div className="mt-auto">
                        <div className="flex items-baseline justify-between mb-3">
                          <span className="text-2xl font-bold" style={{ color: '#9a3412' }}>
                            R$ {product.unitPrice.toFixed(2)}
                          </span>
                          <span className="text-sm text-gray-500">
                            por {product.measurementUnit}
                          </span>
                        </div>

                        {/* ✅ LOJA PÚBLICA: Estoque não é exibido nem considerado */}

                        {/* Botões de Ação */}
                        {!isInCart ? (
                          <Button
                            onClick={() => addToCart(product.id)}
                            className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Adicionar
                          </Button>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <Button
                              onClick={() => removeFromCart(product.id)}
                              variant="outline"
                              size="sm"
                              className="flex-1"
                            >
                              <Minus className="w-4 h-4" />
                            </Button>
                            <span className="font-bold text-lg px-4" style={{ color: '#1a1a1a' }}>
                              {quantity}
                            </span>
                            <Button
                              onClick={() => addToCart(product.id)}
                              variant="outline"
                              size="sm"
                              className="flex-1"
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* Carrinho Flutuante */}
      {getTotalItems() > 0 && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-orange-600 shadow-2xl z-50"
        >
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-orange-600 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold">
                  {getTotalItems()}
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total</p>
                  <p className="text-xl font-bold" style={{ color: '#1a1a1a' }}>
                    R$ {getTotalPrice().toFixed(2)}
                  </p>
                </div>
              </div>

              <Button
                onClick={handleCheckout}
                size="lg"
                className="bg-orange-600 hover:bg-orange-700 text-white px-8"
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                Finalizar Pedido
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
