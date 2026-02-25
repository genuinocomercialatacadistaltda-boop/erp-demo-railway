'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Flame, 
  ShoppingCart, 
  ArrowLeft, 
  Plus, 
  Minus,
  PackageCheck,
  AlertCircle,
  Tag,
  Star
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useToast } from '@/hooks/use-toast'

interface Product {
  id: string
  name: string
  description: string
  imageUrl: string
  weight: string
  priceWholesale: number
  category: string
  quantityIncrement: number
  // 🏷️ Promoções
  isOnPromotion?: boolean
  promotionalPrice?: number | null
  isWeeklyPromotion?: boolean
}

export default function VarejoCatalogoPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<{[key: string]: number}>({})
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()
  const router = useRouter()

  const MIN_ESPETOS = 25 // Mínimo de 25 espetos para atacado

  // Load products and cart from localStorage
  useEffect(() => {
    fetchProducts()
    
    // Load cart from localStorage
    const savedCart = localStorage.getItem('varejoCart')
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
    localStorage.setItem('varejoCart', JSON.stringify(cart))
  }, [cart])

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products')
      if (response.ok) {
        const data = await response.json()
        // Filter products available for wholesale
        const wholesaleProducts = data.filter((p: Product) => 
          p.priceWholesale && p.priceWholesale > 0
        )
        setProducts(wholesaleProducts)
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
    
    toast({
      title: "Produto adicionado!",
      description: `${increment} unidade(s) adicionada(s) ao carrinho`,
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

  const getTotalEspetos = () => {
    return Object.values(cart).reduce((sum, quantity) => sum + quantity, 0)
  }

  const getCartTotal = () => {
    return Object.entries(cart).reduce((total, [productId, quantity]) => {
      const product = products.find(p => p.id === productId)
      return total + (product?.priceWholesale || 0) * quantity
    }, 0)
  }

  const canProceedToCheckout = () => {
    return getTotalEspetos() >= MIN_ESPETOS
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-orange-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <Flame className="w-8 h-8 text-white animate-pulse" />
          </div>
          <p className="text-lg text-gray-600">Carregando catálogo atacado...</p>
        </div>
      </div>
    )
  }

  const totalEspetos = getTotalEspetos()
  const espetosRestantes = Math.max(0, MIN_ESPETOS - totalEspetos)

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto max-w-6xl flex h-16 items-center justify-between px-4">
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
              <ArrowLeft className="w-4 h-4" />
              Início
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
              <p className="text-xs text-orange-600 font-semibold">Atacado - Sem Cadastro</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="text-right mr-2">
              <p className="text-xs text-gray-600">Espetos no carrinho</p>
              <p className="text-lg font-bold text-orange-600">{totalEspetos}</p>
            </div>
            <Button 
              onClick={() => {
                if (canProceedToCheckout()) {
                  router.push('/varejo/checkout')
                } else {
                  toast({
                    title: "Pedido mínimo não atingido",
                    description: `Adicione mais ${espetosRestantes} espeto(s) para continuar.`,
                    variant: "destructive"
                  })
                }
              }}
              className="relative bg-orange-600 hover:bg-orange-700"
              disabled={!canProceedToCheckout()}
            >
              <ShoppingCart className="w-5 h-5 mr-2" />
              Checkout
              {totalEspetos > 0 && (
                <Badge className="absolute -top-2 -right-2 w-6 h-6 flex items-center justify-center p-0 bg-red-500">
                  {totalEspetos}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto max-w-6xl px-4 py-8">
        {/* Hero Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-full text-sm font-bold mb-4">
            <PackageCheck className="w-4 h-4" />
            Atacado - Mínimo 25 espetos
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Catálogo <span className="text-orange-600">Atacado</span>
          </h1>
          <p className="text-lg text-gray-600 mb-6 max-w-2xl mx-auto">
            Escolha seus espetinhos sem precisar fazer cadastro. <br/>
            <span className="font-bold text-orange-600">Pedido mínimo: 25 unidades de espeto</span>
          </p>
        </motion.div>

        {/* Alert de Pedido Mínimo */}
        {totalEspetos > 0 && totalEspetos < MIN_ESPETOS && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Alert className="bg-amber-50 border-amber-300">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <AlertDescription className="text-amber-900 font-medium">
                Adicione mais <span className="font-bold text-lg">{espetosRestantes}</span> espeto(s) para atingir o mínimo de 25 unidades.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        {/* Cart Summary */}
        {totalEspetos > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Card className={canProceedToCheckout() ? "bg-green-50 border-green-300" : "bg-orange-50 border-orange-200"}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm text-gray-600">
                    {totalEspetos} espeto(s) no carrinho
                    {!canProceedToCheckout() && (
                      <span className="text-amber-600 font-semibold ml-2">
                        (faltam {espetosRestantes})
                      </span>
                    )}
                  </p>
                  <p className="text-lg font-bold text-gray-900">
                    Total: {formatCurrency(getCartTotal())}
                  </p>
                  {canProceedToCheckout() && (
                    <p className="text-xs text-green-700 font-semibold mt-1">
                      ✓ Pedido mínimo atingido! Pode finalizar.
                    </p>
                  )}
                </div>
                <Button 
                  onClick={() => window.location.href = '/varejo/checkout'}
                  disabled={!canProceedToCheckout()}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  Finalizar Pedido
                </Button>
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
              <Card className={`hover:shadow-xl transition-all duration-300 bg-white ${product.isOnPromotion ? 'border-2 border-orange-400 ring-2 ring-orange-200' : ''}`}>
                <div className="relative aspect-square overflow-hidden bg-gray-100 rounded-t-lg">
                  <Image
                    src={product.imageUrl || '/placeholder-product.jpg'}
                    alt={product.name}
                    fill
                    className="object-cover hover:scale-105 transition-transform duration-300"
                  />
                  {/* 🏷️ Badges de Promoção */}
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
                  {/* Badge de desconto % */}
                  {product.isOnPromotion && product.promotionalPrice && (
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-green-600 text-white text-xs font-bold">
                        -{Math.round(((product.priceWholesale - product.promotionalPrice) / product.priceWholesale) * 100)}%
                      </Badge>
                    </div>
                  )}
                </div>
                
                <div className="p-6 bg-white">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-xl font-bold text-gray-900">
                      {product.name}
                    </h3>
                    <Badge variant="outline" className="text-xs font-bold">
                      {product.weight}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {product.description}
                  </p>
                  
                  <div className="mb-4">
                    {/* 🏷️ Preço com promoção */}
                    {product.isOnPromotion && product.promotionalPrice ? (
                      <>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg text-gray-400 line-through">
                            {formatCurrency(product.priceWholesale)}
                          </span>
                        </div>
                        <p className="text-2xl font-bold text-orange-600">
                          {formatCurrency(product.promotionalPrice)}
                        </p>
                        <p className="text-xs text-orange-700 font-medium">
                          💰 Preço promocional para PIX ou Dinheiro
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-2xl font-bold text-orange-600">
                          {formatCurrency(product.priceWholesale)}
                        </p>
                        <p className="text-xs text-gray-600">Preço atacado (por unidade)</p>
                      </>
                    )}
                    {product.quantityIncrement > 1 && (
                      <p className="text-xs text-orange-600 font-bold mt-1">
                        📦 Incremento: {product.quantityIncrement} em {product.quantityIncrement}
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
                        <span className="font-medium w-8 text-center text-gray-900">
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
                      <p className="text-sm font-bold text-gray-900">
                        {formatCurrency(product.priceWholesale * cart[product.id])}
                      </p>
                    </div>
                  ) : (
                    <Button 
                      onClick={() => addToCart(product.id)}
                      className="w-full bg-orange-600 hover:bg-orange-700 font-bold"
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
              Nenhum produto disponível para atacado no momento.
            </p>
          </div>
        )}

        {/* Info Section */}
        <div className="mt-12 mb-8">
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                📦 Informações Importantes
              </h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>• <span className="font-semibold">Pedido mínimo:</span> 25 espetos</li>
                <li>• <span className="font-semibold">Sem cadastro:</span> Forneça apenas dados básicos no checkout</li>
                <li>• <span className="font-semibold">Preços especiais:</span> Preços de atacado já aplicados</li>
                <li>• <span className="font-semibold">Entrega:</span> Consulte prazos no checkout</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
