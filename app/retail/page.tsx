
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Flame, 
  ShoppingCart, 
  ArrowLeft, 
  Plus, 
  Minus,
  Star,
  Clock,
  Truck
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useToast } from '@/hooks/use-toast'

interface Product {
  id: string
  name: string
  description: string
  imageUrl: string
  weight: string
  priceRetail: number
  category: string
  availableIn: string
  quantityIncrement: number
}

export default function RetailPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<{[key: string]: number}>({})
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  // Load products and cart from localStorage
  useEffect(() => {
    fetchProducts()
    
    // Load cart from localStorage
    const savedCart = localStorage.getItem('retailCart')
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart))
      } catch (error) {
        console.error('Error loading cart:', error)
      }
    }
  }, [])

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('retailCart', JSON.stringify(cart))
  }, [cart])

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products')
      if (response.ok) {
        const data = await response.json()
        // Filter products available for retail
        const retailProducts = data.filter((p: Product) => 
          p.availableIn === 'RETAIL' || p.availableIn === 'BOTH'
        )
        setProducts(retailProducts)
      } else {
        toast({
          title: "Erro ao carregar produtos",
          description: "Não foi possível carregar o catálogo.",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error fetching products:', error)
      toast({
        title: "Erro de conexão",
        description: "Verifique sua conexão e tente novamente.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const addToCart = (productId: string) => {
    const product = products.find(p => p.id === productId)
    const increment = product?.quantityIncrement || 1
    
    setCart(prev => ({
      ...prev,
      [productId]: (prev[productId] || 0) + increment
    }))
    
    const incrementText = increment > 1 ? `${increment} unidades adicionadas` : 'Item adicionado ao carrinho'
    toast({
      title: "Produto adicionado!",
      description: incrementText,
    })
  }

  const removeFromCart = (productId: string) => {
    const product = products.find(p => p.id === productId)
    const increment = product?.quantityIncrement || 1
    
    setCart(prev => {
      const newCart = { ...prev }
      if (newCart[productId] > increment) {
        newCart[productId] -= increment
      } else {
        delete newCart[productId]
      }
      return newCart
    })
  }

  const getCartTotal = () => {
    return Object.entries(cart).reduce((total, [productId, quantity]) => {
      const product = products.find(p => p.id === productId)
      return total + (product?.priceRetail || 0) * quantity
    }, 0)
  }

  const getCartItemsCount = () => {
    return Object.values(cart).reduce((sum, quantity) => sum + quantity, 0)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <Flame className="w-8 h-8 text-white animate-pulse" />
          </div>
          <p className="text-lg text-gray-600">Carregando produtos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-amber-50">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto max-w-6xl flex h-16 items-center justify-between px-4">
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Link>
            <div className="relative w-10 h-10 rounded-lg overflow-hidden">
              <Image 
                src="/logo.jpg" 
                alt="[SUA EMPRESA]" 
                fill 
                className="object-contain"
                priority
              />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">[SUA EMPRESA]</h1>
              <p className="text-xs text-gray-600">Loja Varejo</p>
            </div>
          </div>
          
          <Link href="/retail/checkout">
            <Button className="relative bg-orange-600 hover:bg-orange-700">
              <ShoppingCart className="w-5 h-5 mr-2" />
              Carrinho
              {getCartItemsCount() > 0 && (
                <Badge className="absolute -top-2 -right-2 w-6 h-6 flex items-center justify-center p-0 bg-red-500">
                  {getCartItemsCount()}
                </Badge>
              )}
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto max-w-6xl px-4 py-8">
        {/* Hero Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-800 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Star className="w-4 h-4" />
            Compra sem cadastro
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Catálogo <span className="text-orange-600">Varejo</span>
          </h1>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Escolha seus espetinhos favoritos e finalize seu pedido rapidamente.
            Entrega ou retirada disponível.
          </p>
          
          <div className="flex items-center justify-center gap-8 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-600" />
              <span>Entrega rápida</span>
            </div>
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-orange-600" />
              <span>Retirada no local</span>
            </div>
          </div>
        </motion.div>

        {/* Cart Summary */}
        {getCartItemsCount() > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Card className="bg-orange-50 border-orange-200">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm text-gray-600">
                    {getCartItemsCount()} {getCartItemsCount() === 1 ? 'item' : 'itens'} no carrinho
                  </p>
                  <p className="text-lg font-bold text-orange-900">
                    Total: {formatCurrency(getCartTotal())}
                  </p>
                </div>
                <Link href="/retail/checkout">
                  <Button className="bg-orange-600 hover:bg-orange-700">
                    Finalizar Pedido
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Products Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products?.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.3 }}
            >
              <Card className="hover:shadow-xl transition-all duration-300 bg-white">
                <div className="relative aspect-square overflow-hidden bg-gray-100 rounded-t-lg">
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    fill
                    className="object-cover hover:scale-105 transition-transform duration-300"
                  />
                </div>
                
                <div className="p-6 bg-white">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-xl font-bold" style={{ color: '#1a1a1a' }}>
                      {product.name}
                    </h3>
                    <Badge variant="outline" className="text-xs font-bold bg-white border-gray-300" style={{ color: '#1a1a1a' }}>
                      {product.weight}
                    </Badge>
                  </div>
                  
                  <p className="text-sm mb-4 line-clamp-2 font-medium" style={{ color: '#333333' }}>
                    {product.description}
                  </p>
                  
                  <div className="mb-4">
                    <p className="text-2xl font-bold" style={{ color: '#9a3412' }}>
                      {formatCurrency(product.priceRetail)}
                    </p>
                    <p className="text-xs font-medium" style={{ color: '#333333' }}>Preço unitário</p>
                    {product.quantityIncrement > 1 && (
                      <p className="text-xs font-bold mt-1" style={{ color: '#991b1b' }}>
                        📦 Adicione de {product.quantityIncrement} em {product.quantityIncrement}
                      </p>
                    )}
                  </div>
                  
                  {cart[product.id] ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-8 h-8 p-0"
                          onClick={() => removeFromCart(product.id)}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="font-medium w-8 text-center" style={{ color: '#1a1a1a' }}>
                          {cart[product.id]}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-8 h-8 p-0"
                          onClick={() => addToCart(product.id)}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-sm font-bold" style={{ color: '#1a1a1a' }}>
                        {formatCurrency(product.priceRetail * cart[product.id])}
                      </p>
                    </div>
                  ) : (
                    <Button 
                      onClick={() => addToCart(product.id)}
                      className="w-full font-bold shadow-md border-2"
                      style={{ backgroundColor: '#c2410c', color: '#FFFFFF' }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar ao Carrinho
                    </Button>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {products?.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl mx-auto mb-4 flex items-center justify-center">
              <ShoppingCart className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-lg text-gray-600">
              Nenhum produto disponível no momento.
            </p>
          </div>
        )}

        {/* Contact Section */}
        <div className="mt-12 mb-8">
          <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
            <CardContent className="p-6 text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Dúvidas ou precisa de ajuda?
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Entre em contato conosco pelo WhatsApp
              </p>
              <a 
                href="https://wa.me/5563999997942?text=Olá!%20Tenho%20uma%20dúvida%20sobre%20os%20produtos." 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                (63) 99999-7942
              </a>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Floating Cart Button on Mobile */}
      {getCartItemsCount() > 0 && (
        <div className="fixed bottom-4 right-4 md:hidden z-50">
          <Link href="/retail/checkout">
            <Button size="lg" className="rounded-full bg-orange-600 hover:bg-orange-700 shadow-lg">
              <ShoppingCart className="w-5 h-5 mr-2" />
              {getCartItemsCount()}
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
