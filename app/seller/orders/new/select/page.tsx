'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Minus, Plus, ShoppingCart, ArrowLeft, AlertCircle, Trash2, ArrowRight, Search } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { HomeButton } from '@/components/home-button'
import Image from 'next/image'
import { motion } from 'framer-motion'

interface Customer {
  id: string
  name: string
  email: string
  phone: string
  cpfCnpj: string
  city: string
  address: string | null
  creditLimit: number
  availableCredit: number
  customDiscount: number
  paymentTerms: number
  allowInstallments: boolean
  installmentOptions: string | null
  customerType?: 'NORMAL' | 'CONSUMIDOR_FINAL' | 'CASUAL'
  allowLaterPayment?: boolean
}

interface Product {
  id: string
  name: string
  description: string
  imageUrl: string
  priceWholesale: number
  priceRetail: number
  availableIn?: string
  quantityIncrement: number
  isRawMaterial?: boolean
  soldByWeight?: boolean
  measurementUnit?: string
}

interface CartItem {
  productId: string
  product: Product
  quantity: number
}

export default function SellerOrderSelectPage() {
  const { data: session, status } = useSession() || {}
  const router = useRouter()
  
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerHasOverdueBoletos, setCustomerHasOverdueBoletos] = useState(false)
  const [overdueBoletosInfo, setOverdueBoletosInfo] = useState<{count: number, amount: number} | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [casualCustomerName, setCasualCustomerName] = useState('')
  const [showCasualNameInput, setShowCasualNameInput] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    } else if (session && !['SELLER', 'EMPLOYEE'].includes((session.user as any)?.userType)) {
      router.push('/dashboard')
    } else if (session && ['SELLER', 'EMPLOYEE'].includes((session.user as any)?.userType)) {
      fetchData()
    }
  }, [session, status, router])

  const fetchData = async () => {
    try {
      const customersRes = await fetch('/api/sellers/customers')
      const customersData = await customersRes.json()
      setCustomers(customersData)

      // 🆕 Usar API de catálogo completo que inclui matérias-primas
      console.log('🔄 Carregando catálogo completo (produtos + matérias-primas)...')
      const productsRes = await fetch('/api/products/catalog')
      const productsData = await productsRes.json()
      const filteredProducts = productsData.filter((p: Product) => p.availableIn !== 'RETAIL')
      console.log('✅ Catálogo carregado:', filteredProducts.length, 'itens (incluindo matérias-primas)')
      setAllProducts(filteredProducts)
      setProducts(filteredProducts)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  const fetchCustomerProducts = async (customerId: string) => {
    setLoadingProducts(true)
    try {
      const response = await fetch(`/api/customers/catalog?customerId=${customerId}`)
      if (response.ok) {
        const data = await response.json()
        setAllProducts(data.products)
        setProducts(data.products)
        
        if (data.useCustomCatalog) {
          toast.info('📋 Exibindo catálogo personalizado do cliente', {
            description: `${data.products.length} produto(s) disponíveis`
          })
        }
      } else {
        // Se falhar, usar produtos gerais
        const productsRes = await fetch('/api/products')
        const productsData = await productsRes.json()
        const filteredProducts = productsData.filter((p: Product) => p.availableIn !== 'RETAIL')
        setAllProducts(filteredProducts)
        setProducts(filteredProducts)
      }
    } catch (error) {
      console.error('Error fetching customer products:', error)
      toast.error('Erro ao carregar produtos do cliente')
    } finally {
      setLoadingProducts(false)
      setSearchTerm('') // Limpar busca ao trocar de cliente
    }
  }

  const checkCustomerPaymentStatus = async (customerId: string) => {
    try {
      const response = await fetch(`/api/customers/payment-status?customerId=${customerId}`)
      if (response.ok) {
        const data = await response.json()
        setCustomerHasOverdueBoletos(data.hasOverdueBoletos)
        if (data.hasOverdueBoletos) {
          setOverdueBoletosInfo({
            count: data.overdueCount,
            amount: data.overdueAmount
          })
          toast.error(
            `⚠️ ATENÇÃO: Este cliente possui ${data.overdueCount} boleto(s) vencido(s) no valor de R$ ${data.overdueAmount.toFixed(2)}. Compras bloqueadas até regularização!`,
            { duration: 10000 }
          )
        } else {
          setOverdueBoletosInfo(null)
        }
      }
    } catch (error) {
      console.error('Error checking payment status:', error)
    }
  }

  // Filtrar produtos com base no termo de busca
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setProducts(allProducts)
    } else {
      const filtered = allProducts.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setProducts(filtered)
    }
  }, [searchTerm, allProducts])

  const addToCart = (product: Product) => {
    const increment = product.soldByWeight ? 0.1 : (product.quantityIncrement || 1)
    const existing = cart.find(item => item.productId === product.id)
    if (existing) {
      setCart(cart.map(item =>
        item.productId === product.id
          ? { ...item, quantity: item.quantity + increment }
          : item
      ))
    } else {
      setCart([...cart, { productId: product.id, product, quantity: increment }])
    }
    toast.success(`${product.name} adicionado ao carrinho`)
  }

  const updateQuantity = (productId: string, quantity: number) => {
    const cartItem = cart.find(item => item.productId === productId)
    const increment = cartItem?.product.quantityIncrement || 1
    const soldByWeight = cartItem?.product.soldByWeight || false
    
    let adjustedQuantity: number
    
    if (soldByWeight) {
      // Para produtos vendidos por peso, permite até 3 casas decimais
      adjustedQuantity = Math.round(quantity * 1000) / 1000
      adjustedQuantity = Math.max(0.001, adjustedQuantity)
    } else {
      // Para unidades, arredonda para múltiplos do incremento
      adjustedQuantity = Math.max(increment, Math.round(quantity / increment) * increment)
    }

    if (adjustedQuantity <= 0) {
      setCart(cart.filter(item => item.productId !== productId))
    } else {
      setCart(cart.map(item =>
        item.productId === productId ? { ...item, quantity: adjustedQuantity } : item
      ))
    }
  }

  const removeItem = (productId: string) => {
    const item = cart.find(c => c.productId === productId)
    setCart(cart.filter(item => item.productId !== productId))
    if (item) {
      toast.success(`${item.product.name} removido do carrinho`)
    }
  }

  const handleQuantityInputChange = (productId: string, value: string) => {
    const cartItem = cart.find(item => item.productId === productId)
    const soldByWeight = cartItem?.product.soldByWeight || false
    
    // 🆕 Substituir vírgula por ponto para aceitar formato brasileiro
    const normalizedValue = value.replace(',', '.')
    
    // Se vendido por peso, usa parseFloat; senão, usa parseInt
    const numValue = soldByWeight ? (parseFloat(normalizedValue) || 0) : (parseInt(normalizedValue) || 0)
    
    if (numValue > 0) {
      updateQuantity(productId, numValue)
    }
  }

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + (item.product.priceWholesale * item.quantity), 0)
  }

  const handleProceedToCheckout = () => {
    if (!selectedCustomer) {
      toast.error('Selecione um cliente')
      return
    }

    // Validar nome para cliente casual
    if (showCasualNameInput && !casualCustomerName.trim()) {
      toast.error('Digite o nome do cliente')
      return
    }

    if (cart.length === 0) {
      toast.error('Adicione produtos ao carrinho')
      return
    }

    if (customerHasOverdueBoletos) {
      toast.error('Cliente com boletos em atraso não pode fazer novos pedidos')
      return
    }

    localStorage.setItem('seller_order_customer', JSON.stringify(selectedCustomer))
    localStorage.setItem('seller_order_cart', JSON.stringify(cart))
    
    // Marcar se é pedido próprio (para mim)
    if (selectedCustomer.id === 'PARA_MIM') {
      localStorage.setItem('seller_order_is_own', 'true')
      console.log('✅ Marcado como pedido próprio - SEM COMISSÃO')
    } else {
      localStorage.removeItem('seller_order_is_own')
    }
    
    // Se for cliente casual, salvar o nome digitado
    if (showCasualNameInput) {
      localStorage.setItem('seller_order_casual_customer_name', casualCustomerName)
    } else {
      localStorage.removeItem('seller_order_casual_customer_name')
    }

    router.push('/seller/orders/new/checkout')
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-amber-50">
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto max-w-6xl flex h-16 items-center justify-between px-4">
          <HomeButton />
          
          <div className="flex items-center gap-2">
            <div className="relative w-10 h-10 rounded-lg overflow-hidden">
              <Image 
                src="/logo.jpg" 
                alt="[SUA EMPRESA]" 
                fill 
                className="object-contain"
                priority
              />
            </div>
            <h1 className="text-lg font-semibold text-gray-900">
              Novo Pedido - Vendedor
            </h1>
          </div>
          
          <div className="w-20"></div>
        </div>
      </header>

      <div className="bg-white border-b">
        <div className="container mx-auto max-w-6xl px-4 py-4">
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-2 text-red-600">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-red-600 text-white">
                1
              </div>
              <span className="font-medium hidden sm:inline">Cliente & Produtos</span>
            </div>
            <div className="w-12 h-0.5 bg-gray-300" />
            <div className="flex items-center gap-2 text-gray-400">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-200">
                2
              </div>
              <span className="font-medium hidden sm:inline">Entrega & Pagamento</span>
            </div>
          </div>
        </div>
      </div>

      <main className="container mx-auto max-w-6xl px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <Card>
                <CardHeader>
                  <CardTitle>Selecione o Cliente</CardTitle>
                  <CardDescription>Escolha o cliente que fará o pedido</CardDescription>
                </CardHeader>
                <CardContent>
                  <Select
                    value={selectedCustomer?.id || ''}
                    onValueChange={(value) => {
                      // Se for "Para Mim", criar um cliente virtual
                      if (value === 'PARA_MIM') {
                        const employeeCustomer: Customer = {
                          id: 'PARA_MIM',
                          name: (session?.user as any)?.name || 'Funcionário',
                          email: (session?.user as any)?.email || '',
                          phone: '',
                          cpfCnpj: '',
                          city: 'Pedido Próprio',
                          address: null,
                          creditLimit: (session?.user as any)?.employee?.creditLimit || 0,
                          availableCredit: (session?.user as any)?.employee?.creditLimit || 0,
                          customDiscount: 0,
                          paymentTerms: 0,
                          allowInstallments: false,
                          installmentOptions: null,
                          customerType: 'NORMAL',
                          allowLaterPayment: false
                        }
                        setSelectedCustomer(employeeCustomer)
                        setShowCasualNameInput(false)
                        setCasualCustomerName('')
                        setCustomerHasOverdueBoletos(false)
                        setOverdueBoletosInfo(null)
                        
                        // Buscar catálogo completo (produtos + matérias-primas)
                        console.log('🔄 [PARA_MIM] Carregando catálogo completo para pedido próprio...')
                        const productsRes = fetch('/api/products/catalog').then(r => r.json()).then(data => {
                          const filteredProducts = data.filter((p: Product) => p.availableIn !== 'RETAIL')
                          console.log('✅ [PARA_MIM] Catálogo carregado:', filteredProducts.length, 'itens')
                          console.log('📦 [PARA_MIM] Incluindo matérias-primas:', filteredProducts.filter((p: Product) => p.isRawMaterial).length)
                          setAllProducts(filteredProducts)
                          setProducts(filteredProducts)
                        })
                        
                        return
                      }
                      
                      const customer = customers.find(c => c.id === value)
                      setSelectedCustomer(customer || null)
                      
                      // Verificar se é um cliente especial que precisa de nome
                      if (customer?.customerType === 'CASUAL' || value === 'CASUAL') {
                        setShowCasualNameInput(true)
                      } else {
                        setShowCasualNameInput(false)
                        setCasualCustomerName('')
                      }
                      
                      if (customer) {
                        checkCustomerPaymentStatus(customer.id)
                        fetchCustomerProducts(customer.id)
                      } else {
                        setCustomerHasOverdueBoletos(false)
                        setOverdueBoletosInfo(null)
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha um cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Opção "Para Mim" no topo */}
                      {(session?.user as any)?.employeeId && (
                        <>
                          <SelectItem 
                            value="PARA_MIM"
                            className="font-bold bg-green-50 hover:bg-green-100 border-2 border-green-200"
                          >
                            🏠 Para Mim (Pedido Próprio - Sem Comissão)
                          </SelectItem>
                          <SelectItem value="sep1" disabled className="text-xs text-gray-400 text-center">
                            ───────────
                          </SelectItem>
                        </>
                      )}
                      
                      {/* Opções especiais no topo */}
                      {customers.filter(c => c.customerType === 'CONSUMIDOR_FINAL' || c.customerType === 'CASUAL').map(customer => (
                        <SelectItem 
                          key={customer.id} 
                          value={customer.id}
                          className="font-semibold bg-yellow-50 hover:bg-yellow-100"
                        >
                          ⭐ {customer.name} {customer.customerType === 'CONSUMIDOR_FINAL' ? '(Pagar na hora)' : '(Encomenda avulsa)'}
                        </SelectItem>
                      ))}
                      
                      {/* Separador se houver clientes especiais */}
                      {customers.some(c => c.customerType === 'CONSUMIDOR_FINAL' || c.customerType === 'CASUAL') && (
                        <SelectItem value="separator" disabled className="text-xs text-gray-400 text-center">
                          ─── Clientes Normais ───
                        </SelectItem>
                      )}
                      
                      {/* Clientes normais */}
                      {customers.filter(c => !c.customerType || c.customerType === 'NORMAL').map(customer => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name} - {customer.city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {/* Campo de nome para cliente casual */}
                  {showCasualNameInput && (
                    <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nome do Cliente (para o cupom)
                      </label>
                      <Input
                        type="text"
                        value={casualCustomerName}
                        onChange={(e) => setCasualCustomerName(e.target.value)}
                        placeholder="Digite o nome completo do cliente"
                        className="w-full"
                      />
                      <p className="text-xs text-gray-600 mt-2">
                        💡 Este nome aparecerá no cupom e será salvo no histórico do pedido
                      </p>
                    </div>
                  )}

                  {selectedCustomer && (
                    <>
                      {/* Alerta para Consumidor Final */}
                      {selectedCustomer.customerType === 'CONSUMIDOR_FINAL' && (
                        <Alert className="mt-4 bg-yellow-50 border-yellow-300">
                          <AlertCircle className="h-4 w-4 text-yellow-600" />
                          <AlertDescription className="text-yellow-800">
                            <strong>⚠️ CONSUMIDOR FINAL - PAGAR NA HORA</strong><br />
                            Este cliente deve pagar no ato da compra. <strong>Boleto não é permitido.</strong>
                          </AlertDescription>
                        </Alert>
                      )}
                      
                      {/* Alerta para Cliente Casual */}
                      {selectedCustomer.customerType === 'CASUAL' && (
                        <Alert className="mt-4 bg-blue-50 border-blue-300">
                          <AlertCircle className="h-4 w-4 text-blue-600" />
                          <AlertDescription className="text-blue-800">
                            <strong>ℹ️ CLIENTE CASUAL - ENCOMENDA AVULSA</strong><br />
                            Cliente sem cadastro completo. Pode buscar depois. Nome será registrado no cupom.
                          </AlertDescription>
                        </Alert>
                      )}
                      
                      {customerHasOverdueBoletos && overdueBoletosInfo && (
                        <Alert variant="destructive" className="mt-4">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            <strong>⚠️ CLIENTE EM ATRASO!</strong><br />
                            Este cliente possui <strong>{overdueBoletosInfo.count} boleto(s) vencido(s)</strong> no valor total de <strong>R$ {overdueBoletosInfo.amount.toFixed(2)}</strong>.<br />
                            <span className="text-red-600 font-semibold">Não é possível criar novos pedidos até a regularização dos pagamentos.</span>
                          </AlertDescription>
                        </Alert>
                      )}
                      <div className="mt-4 p-4 bg-blue-50 rounded-lg space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">Crédito Disponível:</span>
                          <Badge variant={selectedCustomer.availableCredit > 0 ? 'default' : 'destructive'}>
                            R$ {selectedCustomer.availableCredit.toFixed(2)}
                          </Badge>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">Desconto Padrão:</span>
                          <span>{formatCurrency(selectedCustomer.customDiscount)}</span>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Adicione Produtos ao Carrinho</CardTitle>
                  <CardDescription>
                    {selectedCustomer ? 'Clique nos produtos para adicionar' : 'Selecione um cliente primeiro'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedCustomer && (
                    <div className="mb-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                          type="text"
                          placeholder="Buscar produtos..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      {searchTerm && (
                        <p className="text-sm text-gray-600 mt-2">
                          {products.length} produto(s) encontrado(s)
                        </p>
                      )}
                    </div>
                  )}
                  
                  {loadingProducts ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
                        <p className="mt-2 text-sm text-gray-600">Carregando produtos...</p>
                      </div>
                    </div>
                  ) : !selectedCustomer ? (
                    <div className="text-center py-12 text-gray-500">
                      Selecione um cliente para ver os produtos disponíveis
                    </div>
                  ) : products.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      {searchTerm ? 'Nenhum produto encontrado com esse termo' : 'Nenhum produto disponível para este cliente'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {products.map(product => (
                      <div 
                        key={product.id} 
                        className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" 
                        onClick={() => addToCart(product)}
                      >
                        <div className="relative aspect-square bg-gray-100">
                          <Image
                            src={product.imageUrl || '/placeholder.png'}
                            alt={product.name}
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 100vw, 300px"
                          />
                        </div>
                        <div className="p-3">
                          <h3 className="font-semibold text-sm mb-1">{product.name}</h3>
                          <div className="flex items-center justify-between">
                            <span className="text-lg font-bold text-red-600">
                              {formatCurrency(product.priceWholesale)}
                            </span>
                            <Plus className="h-5 w-5 text-red-600" />
                          </div>
                        </div>
                      </div>
                    ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <div className="lg:sticky lg:top-24 h-fit">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-red-600" />
                  Carrinho
                </CardTitle>
                <CardDescription>
                  {cart.length} {cart.length === 1 ? 'item' : 'itens'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {cart.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">
                    Carrinho vazio
                  </p>
                ) : (
                  <>
                    <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
                      {cart.map(item => (
                        <div key={item.productId} className="flex items-center gap-4 pb-3 border-b">
                          <div className="relative w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                            <Image
                              src={item.product.imageUrl || '/placeholder.png'}
                              alt={item.product.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm truncate">{item.product.name}</h4>
                            <p className="text-xs text-gray-600">{formatCurrency(item.product.priceWholesale)}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => {
                                  const decrement = item.product.soldByWeight ? 0.1 : (item.product.quantityIncrement || 1)
                                  updateQuantity(item.productId, item.quantity - decrement)
                                }}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={item.quantity}
                                onChange={(e) => handleQuantityInputChange(item.productId, e.target.value)}
                                className="w-12 h-6 text-center text-xs p-0"
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => {
                                  const increment = item.product.soldByWeight ? 0.1 : (item.product.quantityIncrement || 1)
                                  updateQuantity(item.productId, item.quantity + increment)
                                }}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                                onClick={() => removeItem(item.productId)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <p className="font-bold text-sm">
                              {formatCurrency(item.product.priceWholesale * item.quantity)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <Separator className="my-4" />

                    <div className="space-y-2">
                      <div className="flex justify-between text-lg font-bold">
                        <span>Subtotal</span>
                        <span className="text-red-600">{formatCurrency(calculateSubtotal())}</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        * Descontos e taxas serão calculados na próxima etapa
                      </p>
                    </div>

                    <Button 
                      onClick={handleProceedToCheckout}
                      className="w-full h-12 bg-red-600 hover:bg-red-700 mt-4"
                      disabled={!selectedCustomer || cart.length === 0 || customerHasOverdueBoletos}
                    >
                      {customerHasOverdueBoletos ? (
                        <>🚫 Cliente em Atraso</>
                      ) : (
                        <>
                          Prosseguir para Entrega e Pagamento
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
