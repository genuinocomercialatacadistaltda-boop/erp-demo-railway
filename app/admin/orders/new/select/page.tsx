
'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Minus, Plus, ShoppingCart, ArrowLeft, AlertCircle, Trash2, ArrowRight, Search, Unlock, Tag, Star } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ProductImage } from '@/components/product-image'

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
  isEmployee?: boolean  // 🆕 Indica se é funcionário
  employeeId?: string   // 🆕 ID do funcionário (quando é funcionário)
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
  soldByWeight?: boolean
  isRawMaterial?: boolean  // 🆕 Identifica matérias-primas
  currentStock?: number    // 🆕 Estoque atual do produto
  minStock?: number        // 🆕 Estoque mínimo (alerta)
  bulkDiscountMinQty?: number | null
  bulkDiscountPrice?: number | null
  // 🏷️ Promoções
  isOnPromotion?: boolean
  promotionalPrice?: number | null
  isWeeklyPromotion?: boolean
}

interface CartItem {
  productId: string
  product: Product
  quantity: number
}

export default function AdminOrderSelectPage() {
  const { data: session, status } = useSession() || {}
  const router = useRouter()
  
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerHasOverdueBoletos, setCustomerHasOverdueBoletos] = useState(false)
  const [customerIsBlocked, setCustomerIsBlocked] = useState(false)
  const [customerManuallyUnblocked, setCustomerManuallyUnblocked] = useState(false)
  const [overdueBoletosInfo, setOverdueBoletosInfo] = useState<{count: number, amount: number} | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [inputValues, setInputValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [customerSearchTerm, setCustomerSearchTerm] = useState('')
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [initialLoadDone, setInitialLoadDone] = useState(false)
  const [cartLoadedFromStorage, setCartLoadedFromStorage] = useState(false)

  // 🛒 CARREGAR CARRINHO DO LOCALSTORAGE AO INICIAR
  useEffect(() => {
    if (typeof window !== 'undefined' && !cartLoadedFromStorage) {
      try {
        const savedCart = localStorage.getItem('admin_order_cart')
        const savedCustomer = localStorage.getItem('admin_order_customer')
        
        if (savedCart) {
          const parsedCart = JSON.parse(savedCart)
          if (Array.isArray(parsedCart) && parsedCart.length > 0) {
            console.log('🛒 [CARRINHO] Restaurando carrinho do localStorage:', parsedCart.length, 'itens')
            setCart(parsedCart)
          }
        }
        
        if (savedCustomer) {
          const parsedCustomer = JSON.parse(savedCustomer)
          if (parsedCustomer && parsedCustomer.id) {
            console.log('👤 [CARRINHO] Restaurando cliente do localStorage:', parsedCustomer.name)
            setSelectedCustomer(parsedCustomer)
            // Verificar status de pagamento do cliente restaurado
            checkCustomerPaymentStatus(parsedCustomer.id)
            // Carregar produtos do cliente restaurado
            fetchCustomerProducts(parsedCustomer.id, parsedCustomer.isEmployee || false)
          }
        }
        
        setCartLoadedFromStorage(true)
      } catch (error) {
        console.error('❌ [CARRINHO] Erro ao restaurar do localStorage:', error)
        setCartLoadedFromStorage(true)
      }
    }
  }, [cartLoadedFromStorage])

  // 🛒 SALVAR CARRINHO NO LOCALSTORAGE SEMPRE QUE MUDAR
  useEffect(() => {
    if (typeof window !== 'undefined' && cartLoadedFromStorage) {
      try {
        if (cart.length > 0) {
          localStorage.setItem('admin_order_cart', JSON.stringify(cart))
          console.log('💾 [CARRINHO] Salvando carrinho:', cart.length, 'itens')
        } else {
          // Se carrinho vazio, manter o localStorage (não limpar automaticamente)
          // Só limpa quando o pedido é finalizado
        }
      } catch (error) {
        console.error('❌ [CARRINHO] Erro ao salvar no localStorage:', error)
      }
    }
  }, [cart, cartLoadedFromStorage])

  // 🛒 SALVAR CLIENTE NO LOCALSTORAGE SEMPRE QUE MUDAR
  useEffect(() => {
    if (typeof window !== 'undefined' && cartLoadedFromStorage && selectedCustomer) {
      try {
        localStorage.setItem('admin_order_customer', JSON.stringify(selectedCustomer))
        console.log('💾 [CARRINHO] Salvando cliente:', selectedCustomer.name)
      } catch (error) {
        console.error('❌ [CARRINHO] Erro ao salvar cliente no localStorage:', error)
      }
    }
  }, [selectedCustomer, cartLoadedFromStorage])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    } else if (session && (session.user as any)?.userType !== 'ADMIN') {
      router.push('/dashboard')
    } else if (session && (session.user as any)?.userType === 'ADMIN' && !initialLoadDone) {
      fetchData()
      setInitialLoadDone(true)
    }
  }, [session, status, router, initialLoadDone])

  const fetchData = async () => {
    try {
      // ⚡ OTIMIZADO - Buscar clientes com API simplificada (sem pedidos/receivables)
      const customersRes = await fetch('/api/customers/simple')
      const customersData = await customersRes.json()

      // Buscar funcionários ativos
      const employeesRes = await fetch('/api/hr/employees')
      const employeesData = await employeesRes.json()

      // Filtrar TODOS os funcionários ativos (não precisa mais ter sellerId)
      // ✅ LIMITE FIXO DE R$ 300 PARA TODOS FUNCIONÁRIOS
      const EMPLOYEE_CREDIT_LIMIT = 300
      
      const activeEmployees = employeesData
        .filter((emp: any) => emp.isActive && emp.status === 'ACTIVE')
        .map((emp: any) => {
          // 🔥 CORREÇÃO: Evitar duplicação entre Orders e Receivables
          // Se um receivable tem orderId, significa que já está representado pela Order
          // Devemos contar APENAS receivables OU orders, nunca ambos para o mesmo pedido
          
          const orders = emp.orders || []
          const receivables = emp.receivables || []
          
          // IDs de ordens não pagas
          const unpaidOrderIds = orders
            .filter((o: any) => o.paymentStatus === 'UNPAID')
            .map((o: any) => o.id)
          
          // Receivables pendentes que NÃO estão vinculados a uma ordem não paga
          // (para evitar duplicação)
          const pendingReceivablesNotInOrders = receivables
            .filter((r: any) => {
              const isPending = r.status === 'PENDING' || r.status === 'OVERDUE'
              // Se tem orderId e essa ordem está na lista de UNPAID, ignorar (já contamos pela ordem)
              const isAlreadyCountedInOrder = r.orderId && unpaidOrderIds.includes(r.orderId)
              return isPending && !isAlreadyCountedInOrder
            })
            .reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0)
          
          // Total de ordens não pagas
          const unpaidOrdersTotal = orders
            .filter((o: any) => o.paymentStatus === 'UNPAID')
            .reduce((sum: number, o: any) => sum + Number(o.total || 0), 0)
          
          const usedCredit = unpaidOrdersTotal + pendingReceivablesNotInOrders
          const availableCredit = EMPLOYEE_CREDIT_LIMIT - usedCredit
          
          console.log(`👷 [CHECKOUT] ${emp.name}: Limite R$ ${EMPLOYEE_CREDIT_LIMIT}, Usado R$ ${usedCredit} (Orders: ${unpaidOrdersTotal}, Receivables sem duplicação: ${pendingReceivablesNotInOrders}), Disponível R$ ${availableCredit}`)
          
          return {
            id: emp.id,
            name: `Funcionário - ${emp.name}`, // 🆕 Prefixo "Funcionário - "
            email: emp.email || '',
            phone: emp.phone || '',
            cpfCnpj: emp.cpf || '',
            city: '',
            address: emp.address || null,
            creditLimit: EMPLOYEE_CREDIT_LIMIT, // ✅ LIMITE FIXO R$ 300
            availableCredit: availableCredit,  // ✅ Crédito disponível correto
            customDiscount: 0,
            paymentTerms: 0,
            allowInstallments: false,
            installmentOptions: null,
            customerType: 'NORMAL' as const,
            isEmployee: true,        // 🆕 Marca como funcionário
            employeeId: emp.id       // 🆕 ID do funcionário (não precisa mais ser sellerId)
          }
        })

      console.log(`✅ Encontrados ${customersData.length} clientes e ${activeEmployees.length} funcionários`)

      // Mesclar clientes e funcionários
      const allCustomers = [...customersData, ...activeEmployees]
      setCustomers(allCustomers)

      // ⚡ OTIMIZADO - NÃO carregar produtos no início
      // Os produtos serão carregados apenas quando o usuário selecionar um cliente
      console.log('⚡ Produtos serão carregados ao selecionar um cliente (otimização de performance)')
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  // Filtrar clientes pela busca
  const filteredCustomers = customers.filter(customer => 
    customer.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
    customer.city.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
    customer.phone?.includes(customerSearchTerm) ||
    customer.cpfCnpj?.includes(customerSearchTerm)
  )

  const fetchCustomerProducts = async (customerId: string, isEmployee: boolean = false) => {
    const startTime = Date.now()
    console.log(`🚀 [FRONTEND] === INICIANDO fetchCustomerProducts ===`)
    console.log(`🚀 [FRONTEND] customerId: ${customerId}, isEmployee: ${isEmployee}`)
    
    setLoadingProducts(true)
    try {
      // Para funcionários, SEMPRE usar catálogo completo
      if (isEmployee) {
        console.log('👤 [FRONTEND] Funcionário selecionado - usando catálogo completo')
        const productsRes = await fetch('/api/products/catalog')
        const productsData = await productsRes.json()
        const allItems = productsData.products || []
        const filteredProducts = allItems.filter((p: Product) => p.availableIn !== 'RETAIL')
        console.log(`📦 [FRONTEND] Catálogo completo carregado: ${filteredProducts.length} itens`)
        setAllProducts(filteredProducts)
        setProducts(filteredProducts)
        return
      }

      // Para clientes normais, tentar buscar catálogo personalizado
      console.log(`⏱️  [FRONTEND] Buscando catálogo...`)
      const fetchStart = Date.now()
      const response = await fetch(`/api/customers/catalog?customerId=${customerId}`)
      const fetchTime = Date.now() - fetchStart
      console.log(`⏱️  [FRONTEND] API respondeu em ${fetchTime}ms, status: ${response.status}`)
      
      if (response.ok) {
        // 🔍 CRITICAL: Medir tamanho do response ANTES de parsear
        const clonedResponse = response.clone()
        const responseText = await clonedResponse.text()
        const responseSizeKB = (responseText.length / 1024).toFixed(2)
        console.log(`📊 [FRONTEND] Tamanho do response: ${responseSizeKB} KB`)
        
        console.log(`⏱️  [FRONTEND] Iniciando parse do JSON...`)
        const parseStart = Date.now()
        const data = JSON.parse(responseText)
        const parseTime = Date.now() - parseStart
        console.log(`⏱️  [FRONTEND] JSON parseado em ${parseTime}ms`)
        console.log(`✅ [FRONTEND] ${data.products?.length || 0} produtos recebidos`)
        
        // 🔍 Verificar primeiro produto
        if (data.products?.length > 0) {
          const firstProduct = data.products[0]
          console.log(`🔍 [FRONTEND] Primeiro produto:`, {
            name: firstProduct.name,
            imageUrlLength: firstProduct.imageUrl?.length || 0
          })
        }
        
        setAllProducts(data.products)
        setProducts(data.products)
        
        if (data.useCustomCatalog) {
          toast.info('📋 Exibindo catálogo personalizado do cliente', {
            description: `${data.products.length} produto(s) disponíveis`
          })
        }
      } else {
        // Se falhar, usar catálogo completo
        console.log(`⚠️  [FRONTEND] Falha, usando catálogo geral`)
        const productsRes = await fetch('/api/products/catalog')
        const productsData = await productsRes.json()
        const allItems = productsData.products || []
        const filteredProducts = allItems.filter((p: Product) => p.availableIn !== 'RETAIL')
        setAllProducts(filteredProducts)
        setProducts(filteredProducts)
      }
      console.log(`⏱️  [FRONTEND] TEMPO TOTAL: ${Date.now() - startTime}ms`)
    } catch (error) {
      console.error(`❌ [FRONTEND] Erro:`, error)
      toast.error('Erro ao carregar produtos do cliente')
    } finally {
      setLoadingProducts(false)
      setSearchTerm('')
      console.log(`🏁 [FRONTEND] === FIM (${Date.now() - startTime}ms) ===`)
    }
  }

  const checkCustomerPaymentStatus = async (customerId: string) => {
    try {
      console.log('🔍 [CHECKOUT] Verificando status de pagamento para:', customerId)
      const response = await fetch(`/api/customers/payment-status?customerId=${customerId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })
      console.log('📡 [CHECKOUT] Response status:', response.status)
      if (response.ok) {
        const data = await response.json()
        console.log('📋 [CHECKOUT] Dados recebidos:', JSON.stringify(data, null, 2))
        
        // 🆕 Verificar receivables vencidos também (não só boletos)
        const hasOverdue = data.hasOverdueBoletos || data.hasOverdueReceivables
        const totalOverdueCount = (data.overdueBoletos?.length || 0) + (data.overdueReceivables?.length || 0)
        const totalOverdueAmount = data.overdueAmount || 0
        
        console.log('🚨 [CHECKOUT] hasOverdue:', hasOverdue, '| totalOverdueCount:', totalOverdueCount, '| totalOverdueAmount:', totalOverdueAmount, '| isBlocked:', data.isBlocked)
        
        setCustomerHasOverdueBoletos(hasOverdue)
        setCustomerIsBlocked(data.isBlocked) // Considera liberação manual
        setCustomerManuallyUnblocked(data.manuallyUnblocked || false)
        
        if (hasOverdue) {
          setOverdueBoletosInfo({
            count: totalOverdueCount,
            amount: totalOverdueAmount
          })
          
          if (data.isBlocked) {
            // Cliente está bloqueado (tem boletos/receivables vencidos E NÃO foi liberado)
            toast.error(
              `⚠️ ATENÇÃO: Este cliente possui ${totalOverdueCount} título(s) vencido(s) no valor de R$ ${totalOverdueAmount.toFixed(2)}. Compras bloqueadas até regularização!`,
              { duration: 10000 }
            )
          } else if (data.manuallyUnblocked) {
            // Cliente foi liberado manualmente (comprovante recebido)
            toast.warning(
              `⚠️ Cliente possui ${totalOverdueCount} título(s) vencido(s), mas foi LIBERADO MANUALMENTE. Pedido pode ser criado.`,
              { duration: 8000 }
            )
          }
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
    
    // Se vendido por peso, permite decimais; senão, arredonda para múltiplos do incremento
    let adjustedQuantity: number
    if (soldByWeight) {
      // Para produtos vendidos por peso, mantém até 3 casas decimais
      adjustedQuantity = Math.round(quantity * 1000) / 1000
      adjustedQuantity = Math.max(0.001, adjustedQuantity)
    } else {
      // Para produtos por unidade, arredonda para múltiplos do incremento
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
    // ✅ Permite edição livre - aceita qualquer caractere durante digitação
    // Filtra apenas caracteres válidos (números, vírgula, ponto)
    const filtered = value.replace(/[^0-9,\.]/g, '')
    setInputValues(prev => ({ ...prev, [productId]: filtered }))
  }
  
  const handleQuantityBlur = (productId: string) => {
    // ✅ Quando o usuário sai do campo, converte e valida
    const value = inputValues[productId]
    
    const cartItem = cart.find(item => item.productId === productId)
    if (!cartItem) return
    
    const soldByWeight = cartItem.product.soldByWeight || false
    
    // Se vazio, restaura o valor do carrinho
    if (value === undefined || value === '' || value === '0' || value === '0,') {
      setInputValues(prev => {
        const newValues = { ...prev }
        delete newValues[productId]
        return newValues
      })
      return
    }
    
    // Substituir vírgula por ponto para conversão
    const normalizedValue = String(value).replace(',', '.')
    
    // Converte para número
    const numValue = soldByWeight ? (parseFloat(normalizedValue) || 0) : (parseInt(normalizedValue) || 0)
    
    console.log('🔢 handleQuantityBlur:', { 
      productId, 
      inputValue: value, 
      normalizedValue, 
      numValue, 
      soldByWeight 
    })
    
    // Atualiza o carrinho com o valor válido
    if (numValue > 0) {
      updateQuantity(productId, numValue)
      
      // ✅ MANTÉM vírgula brasileira na visualização
      const displayValue = soldByWeight 
        ? numValue.toString().replace('.', ',')  // 1.5 → "1,5"
        : numValue.toString()
      
      setInputValues(prev => ({
        ...prev,
        [productId]: displayValue
      }))
      
      console.log('✅ Valor salvo:', numValue, '| Display:', displayValue)
    } else {
      // Se inválido, remove do input para mostrar o valor do carrinho
      setInputValues(prev => {
        const newValues = { ...prev }
        delete newValues[productId]
        return newValues
      })
    }
  }

  const calculateSubtotal = () => {
    // 🏷️ Usar preço promocional por padrão (será ajustado no checkout se Boleto/Cartão)
    return cart.reduce((sum, item) => {
      const price = (item.product.isOnPromotion && item.product.promotionalPrice) 
        ? item.product.promotionalPrice 
        : item.product.priceWholesale
      return sum + (price * item.quantity)
    }, 0)
  }

  const handleProceedToCheckout = () => {
    if (!selectedCustomer) {
      toast.error('Selecione um cliente')
      return
    }

    if (cart.length === 0) {
      toast.error('Adicione produtos ao carrinho')
      return
    }

    // 🔧 CORREÇÃO: Verifica customerIsBlocked ao invés de customerHasOverdueBoletos
    // customerIsBlocked considera a liberação manual
    if (customerIsBlocked) {
      toast.error('Cliente bloqueado não pode fazer novos pedidos. Use o botão "Liberar Cliente" se já recebeu o comprovante.')
      return
    }

    // Salvar no localStorage
    localStorage.setItem('admin_order_customer', JSON.stringify(selectedCustomer))
    localStorage.setItem('admin_order_cart', JSON.stringify(cart))

    // Redirecionar para página de checkout
    router.push('/admin/orders/new/checkout')
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
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto max-w-6xl flex h-16 items-center justify-between px-4">
          <Link href="/admin/orders">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </Link>
          
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
              Novo Pedido - Admin
            </h1>
          </div>
          
          <div className="w-20"></div>
        </div>
      </header>

      {/* Progress Indicator */}
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
          {/* Form Column */}
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              {/* Customer Selection */}
              <Card>
                <CardHeader>
                  <CardTitle>Selecione o Cliente</CardTitle>
                  <CardDescription>Escolha o cliente que fará o pedido</CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Campo de busca de clientes */}
                  <div className="mb-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        type="text"
                        placeholder="Buscar cliente por nome, cidade, telefone ou CPF/CNPJ..."
                        value={customerSearchTerm}
                        onChange={(e) => setCustomerSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    {customerSearchTerm && (
                      <p className="text-sm text-gray-600 mt-2">
                        {filteredCustomers.length} cliente(s) encontrado(s)
                      </p>
                    )}
                  </div>

                  <Select
                    value={selectedCustomer?.id || ''}
                    onValueChange={(value) => {
                      const customer = customers.find(c => c.id === value)
                      setSelectedCustomer(customer || null)
                      if (customer) {
                        checkCustomerPaymentStatus(customer.id)
                        // 🆕 Passar flag isEmployee para funcionários
                        fetchCustomerProducts(customer.id, customer.isEmployee || false)
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
                      {filteredCustomers.length === 0 ? (
                        <SelectItem value="no-results" disabled>
                          Nenhum cliente encontrado
                        </SelectItem>
                      ) : (
                        filteredCustomers.map(customer => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name} - {customer.city}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>

                  {selectedCustomer && (
                    <>
                      {customerHasOverdueBoletos && overdueBoletosInfo && (
                        <>
                          {customerIsBlocked ? (
                            <Alert variant="destructive" className="mt-4">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription>
                                <strong>⚠️ CLIENTE EM ATRASO!</strong><br />
                                Este cliente possui <strong>{overdueBoletosInfo.count} título(s) vencido(s)</strong> no valor total de <strong>R$ {overdueBoletosInfo.amount.toFixed(2)}</strong>.<br />
                                <span className="text-red-600 font-semibold">Não é possível criar novos pedidos até a regularização dos pagamentos.</span>
                              </AlertDescription>
                            </Alert>
                          ) : customerManuallyUnblocked && (
                            <Alert className="mt-4 bg-yellow-50 border-yellow-300">
                              <Unlock className="h-4 w-4 text-yellow-600" />
                              <AlertDescription>
                                <strong>✅ CLIENTE LIBERADO MANUALMENTE</strong><br />
                                Este cliente possui <strong>{overdueBoletosInfo.count} título(s) vencido(s)</strong> no valor de <strong>R$ {overdueBoletosInfo.amount.toFixed(2)}</strong>, mas foi <strong className="text-green-600">LIBERADO pelo administrador</strong> (comprovante de pagamento recebido).<br />
                                <span className="text-green-600 font-semibold">Pedido pode ser criado normalmente.</span>
                              </AlertDescription>
                            </Alert>
                          )}
                        </>
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

              {/* Products Grid */}
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
                        className={`border rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer ${product.isOnPromotion ? 'border-orange-400 ring-2 ring-orange-200' : ''}`}
                        onClick={() => addToCart(product)}
                      >
                        <div className="relative aspect-square bg-gray-100">
                          <ProductImage
                            src={product.imageUrl}
                            alt={product.name}
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 100vw, 300px"
                          />
                          {/* 🏷️ Badges de Promoção */}
                          {product.isOnPromotion && (
                            <div className="absolute top-2 left-2 flex flex-col gap-1">
                              <Badge className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-2 py-0.5">
                                <Tag className="w-3 h-3 mr-1" />
                                PROMOÇÃO
                              </Badge>
                              {product.isWeeklyPromotion && (
                                <Badge className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-2 py-0.5">
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
                        <div className="p-3">
                          <h3 className="font-semibold text-sm mb-1">{product.name}</h3>
                          <div className="flex items-center justify-between mb-2">
                            {product.isOnPromotion && product.promotionalPrice ? (
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-400 line-through">
                                  {formatCurrency(product.priceWholesale)}
                                </span>
                                <span className="text-lg font-bold text-orange-600">
                                  {formatCurrency(product.promotionalPrice)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-lg font-bold text-red-600">
                                {formatCurrency(product.priceWholesale)}
                              </span>
                            )}
                            <Plus className="h-5 w-5 text-red-600" />
                          </div>
                          {/* 🏷️ Aviso de promoção PIX/Dinheiro */}
                          {product.isOnPromotion && (
                            <p className="text-xs text-orange-600 font-medium mb-1">
                              💰 PIX ou Dinheiro
                            </p>
                          )}
                          <div className="text-xs text-gray-600 flex items-center gap-1">
                            <span className={`font-medium ${
                              product.currentStock === undefined 
                                ? 'text-gray-400' 
                                : product.currentStock <= 0 
                                ? 'text-red-600' 
                                : product.currentStock <= (product.minStock || 0)
                                ? 'text-orange-600'
                                : 'text-green-600'
                            }`}>
                              📦 Estoque: {product.currentStock !== undefined ? product.currentStock : '?'}
                            </span>
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

          {/* Cart Summary (Sticky) */}
          <div className="lg:sticky lg:top-24 h-fit">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-red-600" />
                    Carrinho
                  </CardTitle>
                  {cart.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 px-2"
                      onClick={() => {
                        if (confirm('Tem certeza que deseja limpar todo o carrinho?')) {
                          setCart([])
                          localStorage.removeItem('admin_order_cart')
                          toast.success('Carrinho limpo!')
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Limpar
                    </Button>
                  )}
                </div>
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
                        <div key={item.productId} className={`flex items-center gap-4 pb-3 border-b ${item.product.isOnPromotion ? 'bg-orange-50/50 p-2 rounded-lg border border-orange-200' : ''}`}>
                          <div className="relative w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                            <ProductImage
                              src={item.product.imageUrl}
                              alt={item.product.name}
                              fill
                              className="object-cover"
                            />
                            {/* 🏷️ Badge de promoção */}
                            {item.product.isOnPromotion && (
                              <div className="absolute top-0 left-0">
                                <Badge className="bg-orange-500 text-white text-[8px] px-1 py-0 rounded-none rounded-br">
                                  %
                                </Badge>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm truncate">{item.product.name}</h4>
                            {/* 🏷️ Preço com promoção */}
                            {item.product.isOnPromotion && item.product.promotionalPrice ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400 line-through">
                                  {formatCurrency(item.product.priceWholesale)}
                                </span>
                                <span className="text-xs text-orange-600 font-bold">
                                  {formatCurrency(item.product.promotionalPrice)}
                                </span>
                                <span className="text-[10px] text-orange-500">(PIX/Din)</span>
                              </div>
                            ) : (
                              <p className="text-xs text-gray-600">{formatCurrency(item.product.priceWholesale)}</p>
                            )}
                            <p className={`text-xs font-medium ${
                              item.product.currentStock === undefined 
                                ? 'text-gray-400' 
                                : item.product.currentStock <= 0 
                                ? 'text-red-600' 
                                : item.product.currentStock <= (item.product.minStock || 0)
                                ? 'text-orange-600'
                                : 'text-green-600'
                            }`}>
                              📦 Estoque: {item.product.currentStock !== undefined ? item.product.currentStock : '?'}
                            </p>
                            <div className="flex items-center gap-1 mt-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => {
                                  const decrement = item.product.soldByWeight ? 0.1 : (item.product.quantityIncrement || 1)
                                  updateQuantity(item.productId, item.quantity - decrement)
                                  // Limpa o input temporário para mostrar valor atualizado do carrinho
                                  setInputValues(prev => {
                                    const newValues = { ...prev }
                                    delete newValues[item.productId]
                                    return newValues
                                  })
                                }}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={
                                  inputValues[item.productId] !== undefined
                                    ? inputValues[item.productId]
                                    : (item.product.soldByWeight 
                                        ? item.quantity.toString().replace('.', ',') 
                                        : item.quantity)
                                }
                                onChange={(e) => handleQuantityInputChange(item.productId, e.target.value)}
                                onBlur={() => handleQuantityBlur(item.productId)}
                                onFocus={(e) => e.target.select()}
                                placeholder={item.product.soldByWeight ? "0,0" : "0"}
                                className="w-12 h-6 text-center text-xs p-0"
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => {
                                  const increment = item.product.soldByWeight ? 0.1 : (item.product.quantityIncrement || 1)
                                  updateQuantity(item.productId, item.quantity + increment)
                                  // Limpa o input temporário para mostrar valor atualizado do carrinho
                                  setInputValues(prev => {
                                    const newValues = { ...prev }
                                    delete newValues[item.productId]
                                    return newValues
                                  })
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
                            {/* 🏷️ Total com preço promocional */}
                            {item.product.isOnPromotion && item.product.promotionalPrice ? (
                              <div className="flex flex-col items-end">
                                <span className="text-[10px] text-gray-400 line-through">
                                  {formatCurrency(item.product.priceWholesale * item.quantity)}
                                </span>
                                <p className="font-bold text-sm text-orange-600">
                                  {formatCurrency(item.product.promotionalPrice * item.quantity)}
                                </p>
                              </div>
                            ) : (
                              <p className="font-bold text-sm">
                                {formatCurrency(item.product.priceWholesale * item.quantity)}
                              </p>
                            )}
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
                      {/* 🏷️ Aviso de promoção */}
                      {cart.some(item => item.product.isOnPromotion) && (
                        <div className="p-2 bg-orange-50 rounded-lg border border-orange-200 mt-2">
                          <p className="text-xs text-orange-700 font-medium text-center">
                            💰 Preços promocionais aplicados automaticamente para PIX ou Dinheiro
                          </p>
                        </div>
                      )}
                    </div>

                    <Button 
                      onClick={handleProceedToCheckout}
                      className="w-full h-12 bg-red-600 hover:bg-red-700 mt-4"
                      disabled={!selectedCustomer || cart.length === 0 || customerIsBlocked}
                    >
                      {customerIsBlocked ? (
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
