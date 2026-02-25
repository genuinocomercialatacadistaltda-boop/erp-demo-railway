
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'
import { ProductImage } from '@/components/product-image'
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
  CreditCard,
  Percent,
  LogOut,
  Search,
  Eye,
  EyeOff,
  Package,
  Tag
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useToast } from '@/hooks/use-toast'
import { HomeButton } from '@/components/home-button'

interface Product {
  id: string
  name: string
  description: string
  imageUrl: string
  weight: string
  priceWholesale: number
  priceRetail: number
  category: string
  availableIn: string
  isActive: boolean
  quantityIncrement: number
  // 🏷️ Promoções
  isOnPromotion?: boolean
  promotionalPrice?: number | null
  isWeeklyPromotion?: boolean
}

interface Customer {
  id: string
  name: string
  customDiscount: number
  creditLimit: number
  availableCredit: number
  paymentTerms: number
}

interface CatalogClientProps {
  customerId: string
  userName: string
}

export function CatalogClient({ customerId, userName }: CatalogClientProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [cart, setCart] = useState<{[key: string]: number}>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [showAllProducts, setShowAllProducts] = useState(false) // 🆕 Controla se mostra todos os produtos
  const [hasCustomCatalog, setHasCustomCatalog] = useState(false) // 🆕 Verifica se cliente tem catálogo personalizado
  const [imageErrors, setImageErrors] = useState<{[key: string]: boolean}>({}) // 🆕 Controla erros de imagem
  const router = useRouter()
  const { toast } = useToast()

  // Load customer data and products
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch customer data
        const customerResponse = await fetch(`/api/customers/${customerId}`)
        if (customerResponse.ok) {
          const customerData = await customerResponse.json()
          setCustomer(customerData)
        }

        // 🆕 Fetch catalog with personalized products or all products
        const showAllParam = showAllProducts ? '&showAll=true' : ''
        const catalogResponse = await fetch(`/api/customers/catalog?customerId=${customerId}${showAllParam}`)
        if (catalogResponse.ok) {
          const catalogData = await catalogResponse.json()
          console.log('🛒 [CATALOG] Dados recebidos da API:', catalogData)
          console.log('🛒 [CATALOG] Primeiro produto:', catalogData.products?.[0])
          console.log('🛒 [CATALOG] imageUrl do primeiro produto:', catalogData.products?.[0]?.imageUrl)
          setProducts(catalogData.products || [])
          setHasCustomCatalog(catalogData.useCustomCatalog || false) // 🆕 Salva se tem catálogo personalizado
        }
      } catch (error) {
        console.error('Error fetching data:', error)
        toast({
          title: "Erro ao carregar dados",
          description: "Não foi possível carregar o catálogo.",
          variant: "destructive"
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [customerId, showAllProducts, toast]) // 🆕 Adiciona showAllProducts como dependência

  // Load cart from localStorage on mount
  useEffect(() => {
    if (!customerId) return
    console.log('🛒 [CATALOG] Carregando carrinho do localStorage...')
    console.log('🛒 [CATALOG] customerId:', customerId)
    const savedCart = localStorage.getItem(`cart_${customerId}`)
    console.log('🛒 [CATALOG] Carrinho salvo (raw):', savedCart)
    if (savedCart) {
      try {
        const parsedCart = JSON.parse(savedCart)
        console.log('🛒 [CATALOG] Carrinho parseado:', parsedCart)
        setCart(parsedCart)
      } catch (error) {
        console.error('🛒 [CATALOG] ❌ Erro ao carregar carrinho:', error)
      }
    } else {
      console.log('🛒 [CATALOG] ⚠️ Nenhum carrinho encontrado no localStorage')
    }
  }, [customerId])

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    if (!customerId) return
    console.log('🛒 [CATALOG] Salvando carrinho no localStorage...')
    console.log('🛒 [CATALOG] cart:', cart)
    console.log('🛒 [CATALOG] Quantidade de itens:', Object.keys(cart).length)
    localStorage.setItem(`cart_${customerId}`, JSON.stringify(cart))
    console.log('🛒 [CATALOG] ✅ Carrinho salvo')
  }, [cart, customerId])

  const filteredProducts = products?.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.description.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  const addToCart = (productId: string) => {
    const product = products?.find(p => p.id === productId)
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
    const product = products?.find(p => p.id === productId)
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

  const updateCartQuantity = (productId: string, value: string) => {
    const product = products?.find(p => p.id === productId)
    const increment = product?.quantityIncrement || 1
    const numValue = parseInt(value) || 0
    
    if (numValue <= 0) {
      setCart(prev => {
        const newCart = { ...prev }
        delete newCart[productId]
        return newCart
      })
      return
    }
    
    // Validate if the value is a multiple of the increment
    if (numValue % increment !== 0) {
      toast({
        title: "Quantidade inválida",
        description: `Este produto deve ser adicionado de ${increment} em ${increment} unidades.`,
        variant: "destructive"
      })
      return
    }
    
    setCart(prev => ({
      ...prev,
      [productId]: numValue
    }))
  }

  const getCartTotal = () => {
    const subtotal = Object.entries(cart).reduce((total, [productId, quantity]) => {
      const product = products?.find(p => p.id === productId)
      return total + (product?.priceWholesale || 0) * quantity
    }, 0)
    
    const discountAmount = subtotal * (customer?.customDiscount || 0) / 100
    return subtotal - discountAmount
  }

  const getCartSubtotal = () => {
    return Object.entries(cart).reduce((total, [productId, quantity]) => {
      const product = products?.find(p => p.id === productId)
      return total + (product?.priceWholesale || 0) * quantity
    }, 0)
  }

  const getCartItemsCount = () => {
    return Object.values(cart).reduce((sum, quantity) => sum + quantity, 0)
  }

  const calculateFinalPrice = (wholesalePrice: number) => {
    const discountAmount = wholesalePrice * (customer?.customDiscount || 0) / 100
    return wholesalePrice - discountAmount
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const handleImageError = (productId: string) => {
    console.log('❌ [CATALOG] Erro ao carregar imagem do produto:', productId)
    setImageErrors(prev => ({ ...prev, [productId]: true }))
  }

  if (isLoading || !customer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <Flame className="w-8 h-8 text-white animate-pulse" />
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
        <div className="container mx-auto max-w-7xl flex h-16 items-center justify-between px-4">
          <div className="flex items-center space-x-3">
            <HomeButton />
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
              <h1 className="text-lg font-bold text-gray-900">Catálogo Atacado</h1>
              <p className="text-xs text-gray-600">{customer?.name}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="hidden md:block text-right">
              <p className="text-sm font-medium text-green-600">
                {formatCurrency(customer?.availableCredit || 0)} disponível
              </p>
              <p className="text-xs text-gray-600">
                Desconto: {customer?.customDiscount || 0}%
              </p>
            </div>
            
            <Link href="/dashboard/checkout">
              <Button className="relative bg-red-600 hover:bg-red-700">
                <ShoppingCart className="w-5 h-5 mr-2" />
                Carrinho
                {getCartItemsCount() > 0 && (
                  <Badge className="absolute -top-2 -right-2 w-6 h-6 flex items-center justify-center p-0 bg-orange-500">
                    {getCartItemsCount()}
                  </Badge>
                )}
              </Button>
            </Link>

            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => signOut({ callbackUrl: '/' })}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto max-w-7xl px-4 py-8">
        {/* Hero Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 bg-red-100 text-red-800 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Star className="w-4 h-4" />
            Preços especiais para atacado
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Seu <span className="text-red-600">Catálogo</span> Personalizado
          </h1>
          <p className="text-lg text-gray-600 mb-6">
            Preços exclusivos com {customer?.customDiscount || 0}% de desconto já aplicado
          </p>
          
          {/* Customer Info Cards */}
          <div className="grid md:grid-cols-2 gap-4 max-w-xl mx-auto">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <CreditCard className="w-6 h-6 text-green-600 mx-auto mb-2" />
              <p className="text-sm text-green-800 font-medium">Crédito Disponível</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(customer?.availableCredit || 0)}</p>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <Star className="w-6 h-6 text-blue-600 mx-auto mb-2" />
              <p className="text-sm text-blue-800 font-medium">Prazo de Pagamento</p>
              <p className="text-lg font-bold text-blue-600">{customer?.paymentTerms || 0} dias</p>
            </div>
          </div>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Buscar produtos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 bg-white/80 border-gray-200"
            />
          </div>
        </motion.div>

        {/* 🆕 Botão para ver todos os produtos (só aparece se cliente tem catálogo personalizado) */}
        {hasCustomCatalog && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-8"
          >
            <div className="max-w-2xl mx-auto">
              <Card className="bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="text-center md:text-left">
                      <h3 className="text-lg font-bold text-gray-900 mb-2">
                        {showAllProducts 
                          ? "Você está vendo todos os produtos disponíveis" 
                          : "Quer conhecer mais produtos?"}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {showAllProducts 
                          ? "Volte para o seu catálogo personalizado para ver os produtos selecionados para você"
                          : "Descubra outros produtos e tamanhos de espetinho além do seu catálogo personalizado"}
                      </p>
                    </div>
                    <Button
                      onClick={() => {
                        setShowAllProducts(!showAllProducts)
                        setIsLoading(true)
                        toast({
                          title: showAllProducts ? "Catálogo Personalizado" : "Catálogo Completo",
                          description: showAllProducts 
                            ? "Mostrando apenas produtos do seu catálogo" 
                            : "Mostrando todos os produtos disponíveis",
                        })
                      }}
                      className={`
                        min-w-[200px] transition-all duration-300
                        ${showAllProducts 
                          ? 'bg-gray-600 hover:bg-gray-700' 
                          : 'bg-orange-600 hover:bg-orange-700'
                        }
                      `}
                    >
                      {showAllProducts ? (
                        <>
                          <EyeOff className="w-5 h-5 mr-2" />
                          Ver Meu Catálogo
                        </>
                      ) : (
                        <>
                          <Eye className="w-5 h-5 mr-2" />
                          Ver Todos os Produtos
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}

        {/* Cart Summary */}
        {getCartItemsCount() > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Card className="bg-red-50 border-red-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">
                      {getCartItemsCount()} {getCartItemsCount() === 1 ? 'item' : 'itens'} no carrinho
                    </p>
                    <div className="space-y-1">
                      <p className="text-gray-600">
                        Subtotal: {formatCurrency(getCartSubtotal())}
                      </p>
                      {customer?.customDiscount > 0 && (
                        <p className="text-green-600">
                          Desconto ({customer.customDiscount}%): -{formatCurrency(getCartSubtotal() * customer.customDiscount / 100)}
                        </p>
                      )}
                      <p className="text-xl font-bold text-red-600">
                        Total: {formatCurrency(getCartTotal())}
                      </p>
                    </div>
                  </div>
                  <Link href="/dashboard/checkout">
                    <Button className="bg-red-600 hover:bg-red-700">
                      Finalizar Pedido
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Products Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts?.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="group overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col">
                <div className="relative aspect-square overflow-hidden bg-gray-100">
                  {imageErrors[product.id] ? (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                      <div className="text-center p-4">
                        <Package className="w-16 h-16 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">{product.name}</p>
                      </div>
                    </div>
                  ) : (
                    <ProductImage
                      src={product.imageUrl}
                      alt={product.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  
                  {/* Discount Badge */}
                  {customer?.customDiscount > 0 && (
                    <div className="absolute top-3 left-3">
                      <Badge className="bg-green-600 text-white">
                        -{customer.customDiscount}%
                      </Badge>
                    </div>
                  )}
                  
                  <div className="absolute top-3 right-3">
                    <Badge variant="outline" className="bg-white/90 text-xs">
                      {product.weight}
                    </Badge>
                  </div>
                </div>
                
                <CardContent className="p-6 flex flex-col flex-1">
                  <div className="flex-grow">
                    <h3 className="text-xl font-bold text-gray-900 group-hover:text-red-600 transition-colors mb-3">
                      {product.name}
                    </h3>
                    
                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                      {product.description}
                    </p>
                  </div>
                  
                  <div className="mt-auto">
                    <div className="mb-4">
                      {/* 🏷️ Preço Promocional */}
                      {product.isOnPromotion && product.promotionalPrice ? (
                        <>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className="bg-orange-500 hover:bg-orange-600 text-xs">
                              <Tag className="w-3 h-3 mr-1" />
                              PROMOÇÃO
                            </Badge>
                            {product.isWeeklyPromotion && (
                              <Badge className="bg-red-500 hover:bg-red-600 text-xs">
                                ⭐ SEMANA
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-400 line-through">
                            {formatCurrency(product.priceWholesale)}
                          </p>
                          <p className="text-2xl font-bold text-orange-600">
                            {formatCurrency(calculateFinalPrice(product.promotionalPrice))}
                          </p>
                          <p className="text-xs text-orange-600 font-medium">
                            💰 Preço especial para PIX ou Dinheiro
                          </p>
                        </>
                      ) : (
                        <>
                          {customer?.customDiscount > 0 && (
                            <p className="text-sm text-gray-500 line-through">
                              {formatCurrency(product.priceWholesale)}
                            </p>
                          )}
                          <p className="text-2xl font-bold text-red-600">
                            {formatCurrency(calculateFinalPrice(product.priceWholesale))}
                          </p>
                        </>
                      )}
                      <p className="text-xs text-gray-500">Preço atacado unitário</p>
                      {product.quantityIncrement > 1 && (
                        <p className="text-xs text-orange-600 font-medium mt-1">
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
                          <Input
                            type="number"
                            min={product.quantityIncrement}
                            step={product.quantityIncrement}
                            value={cart[product.id]}
                            onChange={(e) => updateCartQuantity(product.id, e.target.value)}
                            className="w-16 h-8 text-center font-medium p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-8 h-8 p-0"
                            onClick={() => addToCart(product.id)}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="text-sm font-medium text-gray-900">
                          {formatCurrency(calculateFinalPrice(product.priceWholesale) * cart[product.id])}
                        </p>
                      </div>
                    ) : (
                      <Button 
                        onClick={() => addToCart(product.id)}
                        className="w-full bg-red-600 hover:bg-red-700 group-hover:bg-orange-600 transition-colors"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Adicionar ao Carrinho
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {filteredProducts?.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl mx-auto mb-4 flex items-center justify-center">
              <ShoppingCart className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-lg text-gray-600">
              {searchQuery ? 'Nenhum produto encontrado para sua busca.' : 'Nenhum produto disponível no momento.'}
            </p>
            {searchQuery && (
              <Button
                variant="outline"
                onClick={() => setSearchQuery('')}
                className="mt-4"
              >
                Limpar busca
              </Button>
            )}
          </div>
        )}
      </main>

      {/* Floating Cart Button on Mobile */}
      {getCartItemsCount() > 0 && (
        <div className="fixed bottom-4 right-4 md:hidden z-50">
          <Link href="/dashboard/checkout">
            <Button size="lg" className="rounded-full bg-red-600 hover:bg-red-700 shadow-lg">
              <ShoppingCart className="w-5 h-5 mr-2" />
              {getCartItemsCount()}
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
