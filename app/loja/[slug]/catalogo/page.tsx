'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  ShoppingCart, 
  Store, 
  Search,
  Plus,
  Minus,
  Package,
  MapPin,
  Phone,
  X
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import Image from 'next/image'

interface StoreInfo {
  id: string
  name: string
  storeName: string | null
  storeSlug: string
  phone: string | null
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
  Inventory?: {
    currentStock: number
    measurementUnit: string
  }
}

interface CartItem extends Product {
  quantity: number
}

export default function LojaPublicaPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params?.slug as string

  const [loading, setLoading] = useState(true)
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [showCart, setShowCart] = useState(false)

  useEffect(() => {
    loadStoreAndProducts()
  }, [slug])

  useEffect(() => {
    filterProducts()
  }, [searchTerm, products])

  const loadStoreAndProducts = async () => {
    try {
      setLoading(true)
      console.log(`[PUBLIC_STORE] Carregando loja: ${slug}`)
      
      const response = await fetch(`/api/public/store/${slug}/catalog`)
      
      if (!response.ok) {
        if (response.status === 404) {
          toast.error('Loja não encontrada')
        } else {
          toast.error('Erro ao carregar loja')
        }
        return
      }

      const data = await response.json()
      console.log('[PUBLIC_STORE] Dados recebidos:', data)
      console.log(`[PUBLIC_STORE] Produtos públicos: ${data.products?.length || 0}`)
      
      setStore(data.store)
      setProducts(data.products || [])
      setFilteredProducts(data.products || [])

      if (!data.products || data.products.length === 0) {
        toast('Nenhum produto disponível no momento', { icon: '📦' })
      }
    } catch (error) {
      console.error('[PUBLIC_STORE_ERROR]', error)
      toast.error('Erro ao carregar loja')
    } finally {
      setLoading(false)
    }
  }

  const filterProducts = () => {
    if (!searchTerm) {
      setFilteredProducts(products)
      return
    }

    const filtered = products.filter((product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    setFilteredProducts(filtered)
  }

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.id === product.id)

    if (existingItem) {
      // ✅ REMOVIDO: Não há controle de estoque para loja pública
      // Os pedidos são aceitos independente do estoque disponível
      
      setCart(cart.map(item => 
        item.id === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
      toast.success(`+1 ${product.name}`)
    } else {
      setCart([...cart, { ...product, quantity: 1 }])
      toast.success(`${product.name} adicionado ao carrinho`)
    }
  }

  const updateQuantity = (productId: string, delta: number) => {
    const product = products.find(p => p.id === productId)
    const cartItem = cart.find(item => item.id === productId)

    if (!cartItem) return

    const newQuantity = cartItem.quantity + delta

    if (newQuantity <= 0) {
      removeFromCart(productId)
      return
    }

    // ✅ REMOVIDO: Não há controle de estoque para loja pública
    // Os pedidos são aceitos independente do estoque disponível

    setCart(cart.map(item =>
      item.id === productId
        ? { ...item, quantity: newQuantity }
        : item
    ))
  }

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.id !== productId))
    toast.success('Produto removido do carrinho')
  }

  const getTotalPrice = () => {
    return cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast.error('Carrinho vazio')
      return
    }

    // Salvar carrinho no localStorage
    localStorage.setItem(`cart_${slug}`, JSON.stringify(cart))
    
    // Redirecionar para página de checkout
    console.log('[CHECKOUT] Redirecionando para checkout com carrinho:', cart)
    router.push(`/loja/${slug}/checkout`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Carregando loja...</p>
        </div>
      </div>
    )
  }

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle className="text-red-600">Loja não encontrada</CardTitle>
            <CardDescription>
              A loja que você está procurando não existe ou não está mais ativa.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Badge Oficial Genuíno */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 border-b border-green-800">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="flex items-center justify-center gap-2 text-white">
            <svg 
              className="h-5 w-5" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" 
              />
            </svg>
            <span className="font-semibold text-sm md:text-base">
              🏆 Este site é oficial [SUA EMPRESA] - Qualidade garantida pela nossa marca
            </span>
          </div>
        </div>
      </div>

      {/* Header da Loja */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto p-4 md:p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
              <Store className="h-10 w-10 text-blue-600" />
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                  {store.storeName || store.name}
                </h1>
                <div className="flex flex-wrap gap-3 mt-1">
                  {store.city && (
                    <p className="text-sm text-slate-600 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {store.city}
                    </p>
                  )}
                  {store.phone && (
                    <p className="text-sm text-slate-600 flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {store.phone}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <Button
              onClick={() => setShowCart(!showCart)}
              className="relative bg-blue-600 hover:bg-blue-700"
            >
              <ShoppingCart className="h-5 w-5 mr-2" />
              Carrinho
              {cart.length > 0 && (
                <Badge className="absolute -top-2 -right-2 bg-red-600">
                  {cart.length}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {/* Busca */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
              <Input
                type="text"
                placeholder="Buscar produtos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Produtos */}
        {filteredProducts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 text-lg">
                {searchTerm 
                  ? 'Nenhum produto encontrado com esses termos'
                  : 'Nenhum produto disponível no momento'
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map((product) => (
              <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="relative aspect-square bg-slate-100">
                  {product.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt={product.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Package className="h-16 w-16 text-slate-300" />
                    </div>
                  )}
                  <Badge className="absolute top-2 right-2 bg-blue-600">
                    {product.category}
                  </Badge>
                </div>
                
                <CardContent className="p-4">
                  <h3 className="font-bold text-slate-900 mb-1 line-clamp-2">
                    {product.name}
                  </h3>
                  {product.description && (
                    <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                      {product.description}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(product.unitPrice)}
                    </p>
                  </div>

                  <Button
                    onClick={() => addToCart(product)}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Adicionar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Carrinho Lateral */}
      {showCart && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end">
          <Card className="w-full max-w-md h-full rounded-none overflow-auto">
            <CardHeader className="border-b sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Meu Carrinho
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCart(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-4">
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600">Carrinho vazio</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => (
                    <Card key={item.id} className="p-4">
                      <div className="flex gap-3">
                        <div className="relative w-20 h-20 bg-slate-100 rounded flex-shrink-0">
                          {item.imageUrl ? (
                            <Image
                              src={item.imageUrl}
                              alt={item.name}
                              fill
                              className="object-cover rounded"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Package className="h-8 w-8 text-slate-300" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-slate-900 text-sm mb-1 line-clamp-1">
                            {item.name}
                          </h4>
                          <p className="text-sm text-slate-600 mb-2">
                            {formatCurrency(item.unitPrice)} cada
                          </p>
                          
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateQuantity(item.id, -1)}
                              className="h-8 w-8 p-0"
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            
                            <span className="font-semibold text-sm w-8 text-center">
                              {item.quantity}
                            </span>
                            
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateQuantity(item.id, 1)}
                              className="h-8 w-8 p-0"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeFromCart(item.id)}
                              className="ml-auto text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t flex justify-between items-center">
                        <span className="text-sm text-slate-600">Subtotal:</span>
                        <span className="font-bold text-slate-900">
                          {formatCurrency(item.unitPrice * item.quantity)}
                        </span>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>

            {cart.length > 0 && (
              <div className="border-t p-4 sticky bottom-0 bg-white">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-lg font-semibold text-slate-900">Total:</span>
                  <span className="text-2xl font-bold text-blue-600">
                    {formatCurrency(getTotalPrice())}
                  </span>
                </div>
                
                <Button
                  onClick={handleCheckout}
                  className="w-full bg-green-600 hover:bg-green-700 h-12 text-lg"
                >
                  Finalizar Pedido
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
