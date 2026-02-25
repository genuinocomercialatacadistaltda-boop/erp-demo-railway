

'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowLeft, 
  ShoppingCart, 
  Truck, 
  MapPin, 
  CreditCard, 
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Percent,
  PackageCheck,
  Trash2
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useToast } from '@/hooks/use-toast'
import { HomeButton } from '@/components/home-button'
import { OrderConfirmationDialog } from '@/components/order-confirmation-dialog'
import { OrderSuccessDialog } from '@/components/order-success-dialog'
import { PixPaymentModal } from '@/components/pix-payment-modal'
import { 
  getOrderRulesSummary, 
  type DeliveryType, 
  type OrderRulesSummary,
  getMinDeliveryDate,
  getMinPickupDate,
  getMaxDate,
  formatDateForInput,
  getDeliveryWarnings,
  getPickupWarnings
} from '@/lib/business-rules'

interface Product {
  id: string
  name: string
  priceWholesale: number
  imageUrl: string
  weight: string
  quantityIncrement: number
  bulkDiscountMinQty?: number | null
  bulkDiscountPrice?: number | null
  isOnPromotion?: boolean
  promotionalPrice?: number | null
}

interface Customer {
  id: string
  name: string
  email: string
  phone: string
  address?: string
  city?: string
  cpfCnpj?: string
  customDiscount: number
  creditLimit: number
  availableCredit: number
  paymentTerms: number
  allowInstallments?: boolean
  installmentOptions?: string
  canPayWithBoleto?: boolean
}

export default function CustomerCheckoutPage() {
  const { data: session, status } = useSession() || {}
  const user = session?.user as any
  const [products, setProducts] = useState<Product[]>([])
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [cart, setCart] = useState<{[key: string]: number}>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [step, setStep] = useState(1)
  const [isCartLoaded, setIsCartLoaded] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [showPixModal, setShowPixModal] = useState(false)
  const [pixChargeId, setPixChargeId] = useState<string | null>(null)
  const [completedOrder, setCompletedOrder] = useState<{orderNumber: string, orderId: string, hasBoleto: boolean} | null>(null)
  const [rulesSummary, setRulesSummary] = useState<OrderRulesSummary | null>(null)
  const [dateWarnings, setDateWarnings] = useState<string[]>([])
  
  const [formData, setFormData] = useState({
    // 📝 Dados pessoais do cliente (pré-preenchidos mas editáveis)
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    customerAddress: '',
    customerCity: '',
    deliveryType: 'DELIVERY', // DELIVERY or PICKUP
    deliveryRegion: 'gurupi', // gurupi, outside
    deliveryDate: '',
    deliveryTime: '16:00', // Horário fixo para entrega
    paymentMethod: '', // CASH, DEBIT, CREDIT_CARD, PIX, BOLETO
    useCombinedPayment: false, // Se vai usar pagamento combinado
    secondaryPaymentMethod: '', // Método secundário (para pagamento combinado)
    primaryPaymentAmount: 0, // Valor do pagamento primário
    secondaryPaymentAmount: 0, // Valor do pagamento secundário
    boletoInstallments: null as null | string, // Parcelamento do boleto (formato: "3x-10-20-30")
    notes: ''
  })

  // Coupon state
  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null)
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [isCouponValidating, setIsCouponValidating] = useState(false)

  const router = useRouter()
  const { toast } = useToast()

  // Calcula datas mínimas e máximas
  const currentDate = new Date()
  const minDeliveryDate = getMinDeliveryDate(currentDate)
  const minPickupDate = getMinPickupDate(currentDate)
  const maxDate = getMaxDate(currentDate)

  useEffect(() => {
    if (status === 'loading') return
    
    if (!session || user?.userType !== 'CUSTOMER') {
      router.push('/auth/login')
      return
    }

    fetchData()
  }, [session, status, user, router])

  const fetchData = async () => {
    try {
      if (!user?.customerId) return

      // Fetch customer data
      const customerResponse = await fetch(`/api/customers/${user.customerId}`)
      if (customerResponse.ok) {
        const customerData = await customerResponse.json()
        setCustomer(customerData)
        
        // 🔧 PRÉ-PREENCHER campos pessoais com dados do cliente cadastrado
        setFormData(prev => ({
          ...prev,
          customerName: customerData.name || '',
          customerPhone: customerData.phone || '',
          customerEmail: customerData.email || '',
          customerAddress: customerData.address || '',
          customerCity: customerData.city || ''
        }))
        
        console.log('[CHECKOUT] Dados do cliente pré-preenchidos:', {
          nome: customerData.name,
          telefone: customerData.phone,
          email: customerData.email,
          endereco: customerData.address,
          cidade: customerData.city
        })
      }

      // 🔧 CORREÇÃO DE TIMEZONE: Usar a API que já foi corrigida para respeitar o timezone de Brasília
      // Substituindo a verificação manual que usava new Date() diretamente
      const paymentStatusResponse = await fetch(`/api/customers/payment-status?customerId=${user.customerId}`)
      if (paymentStatusResponse.ok) {
        const paymentStatus = await paymentStatusResponse.json()
        
        console.log('[CHECKOUT] ========================================')
        console.log('[CHECKOUT] Status de pagamento do cliente:', {
          hasOverdueBoletos: paymentStatus.hasOverdueBoletos,
          hasOverdueReceivables: paymentStatus.hasOverdueReceivables,
          hasAnyOverdue: paymentStatus.hasAnyOverdue,
          isBlocked: paymentStatus.isBlocked,
          manuallyUnblocked: paymentStatus.manuallyUnblocked,
          unblockedAt: paymentStatus.unblockedAt,
          overdueCount: paymentStatus.overdueCount,
          overdueAmount: paymentStatus.overdueAmount
        })
        
        // 🔧 LÓGICA SIMPLIFICADA: Verificar liberação manual PRIMEIRO
        if (paymentStatus.manuallyUnblocked === true) {
          console.log('[CHECKOUT] ✅ Cliente LIBERADO MANUALMENTE - Permitindo checkout')
          console.log('[CHECKOUT] Liberado em:', paymentStatus.unblockedAt)
          toast({
            title: "✓ Cliente Liberado Manualmente",
            description: "Você pode realizar compras normalmente. Seu gerente liberou temporariamente.",
            variant: "default",
            duration: 8000
          })
        } 
        // Se NÃO foi liberado manualmente, verificar se está bloqueado
        else if (paymentStatus.isBlocked === true) {
          console.log('[CHECKOUT] ❌ Cliente BLOQUEADO por pagamentos vencidos')
          console.log('[CHECKOUT] Detalhes:', {
            count: paymentStatus.overdueCount,
            amount: paymentStatus.overdueAmount
          })
          
          toast({
            title: "⚠️ Atenção: Pagamentos Vencidos",
            description: `Você possui ${paymentStatus.overdueCount} pagamento(s) vencido(s) no valor de R$ ${paymentStatus.overdueAmount.toFixed(2)}. Compras estão bloqueadas até regularizar a situação.`,
            variant: "destructive",
            duration: 10000
          })
        } else {
          console.log('[CHECKOUT] ✅ Cliente SEM problemas de pagamento')
        }
        console.log('[CHECKOUT] ========================================')
      }

      // 🔧 CORREÇÃO: Fetch TODOS os produtos (não apenas catálogo personalizado)
      // Isso garante que produtos adicionados quando o cliente visualizava "todos os produtos"
      // sejam encontrados e exibidos corretamente no checkout
      const catalogResponse = await fetch(`/api/customers/catalog?customerId=${user.customerId}&showAll=true`)
      if (catalogResponse.ok) {
        const catalogData = await catalogResponse.json()
        setProducts(catalogData.products || [])
      }

      // Load cart from localStorage
      console.log('🛒 [CHECKOUT] Carregando carrinho do localStorage...')
      console.log('🛒 [CHECKOUT] customerId:', user.customerId)
      const savedCart = localStorage.getItem(`cart_${user.customerId}`)
      console.log('🛒 [CHECKOUT] Carrinho salvo (raw):', savedCart)
      if (savedCart) {
        try {
          const parsedCart = JSON.parse(savedCart)
          console.log('🛒 [CHECKOUT] Carrinho parseado:', parsedCart)
          console.log('🛒 [CHECKOUT] Quantidade de itens no carrinho:', Object.keys(parsedCart).length)
          setCart(parsedCart)
        } catch (e) {
          console.error('🛒 [CHECKOUT] ❌ Erro ao parsear carrinho:', e)
        }
      } else {
        console.log('🛒 [CHECKOUT] ⚠️ Nenhum carrinho encontrado no localStorage')
      }
      setIsCartLoaded(true)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar as informações.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    // Save cart to localStorage whenever it changes, but only after initial load
    if (user?.customerId && isCartLoaded) {
      localStorage.setItem(`cart_${user.customerId}`, JSON.stringify(cart))
    }
  }, [cart, user?.customerId, isCartLoaded])

  // Atualiza avisos quando o tipo de entrega mudar
  useEffect(() => {
    const selectedDate = formData.deliveryDate ? new Date(formData.deliveryDate) : null
    
    if (formData.deliveryType === 'DELIVERY') {
      setDateWarnings(getDeliveryWarnings(selectedDate, currentDate))
      // Define horário fixo para entrega
      if (formData.deliveryTime !== '16:00') {
        setFormData(prev => ({ ...prev, deliveryTime: '16:00' }))
      }
    } else {
      setDateWarnings(getPickupWarnings(selectedDate, currentDate))
      // Remove horário fixo para retirada
      if (formData.deliveryTime === '16:00') {
        setFormData(prev => ({ ...prev, deliveryTime: '' }))
      }
    }
  }, [formData.deliveryType, formData.deliveryDate])

  const getCartItems = () => {
    console.log('🛒 [GET_CART_ITEMS] Iniciando...')
    console.log('🛒 [GET_CART_ITEMS] cart:', cart)
    console.log('🛒 [GET_CART_ITEMS] products:', products.length, 'produtos carregados')
    
    const items = Object.entries(cart).map(([productId, quantity]) => {
      const product = products.find(p => p.id === productId)
      console.log(`🛒 [GET_CART_ITEMS] Produto ${productId}:`, product ? 'ENCONTRADO' : '❌ NÃO ENCONTRADO')
      return product ? { product, quantity } : null
    }).filter(Boolean)
    
    console.log('🛒 [GET_CART_ITEMS] Total de itens válidos:', items.length)
    return items
  }

  // Função para calcular preço unitário com desconto progressivo
  const getUnitPrice = (product: Product, quantity: number) => {
    // 🏷️ PRIORIDADE DE PREÇOS (igual ao backend):
    // 1. Promoção (maior prioridade)
    // 2. MENOR PREÇO entre catálogo personalizado e desconto por quantidade
    // 3. Só catálogo personalizado
    // 4. Só desconto progressivo por quantidade
    // 5. Preço base (atacado)
    
    // 1️⃣ Se produto está em promoção → usar preço promocional
    if (product.isOnPromotion && product.promotionalPrice) {
      return product.promotionalPrice
    }
    
    const hasCustomPrice = (product as any).hasCustomPrice
    const customPrice = hasCustomPrice ? product.priceWholesale : null
    const hasBulkDiscount = product.bulkDiscountMinQty && product.bulkDiscountPrice && quantity >= product.bulkDiscountMinQty
    const bulkDiscountPrice = hasBulkDiscount ? product.bulkDiscountPrice : null
    
    // 2️⃣ Se tem AMBOS catálogo E desconto por quantidade → usar o MENOR
    if (customPrice && bulkDiscountPrice) {
      return Math.min(customPrice, bulkDiscountPrice)
    }
    
    // 3️⃣ Se só tem catálogo personalizado → usar catálogo
    if (customPrice) {
      return customPrice
    }
    
    // 4️⃣ Se só tem desconto por quantidade → usar desconto
    if (bulkDiscountPrice) {
      return bulkDiscountPrice
    }
    
    // 5️⃣ Preço base
    return product.priceWholesale
  }

  const getCartSubtotal = () => {
    return Object.entries(cart).reduce((total, [productId, quantity]) => {
      const product = products.find(p => p.id === productId)
      if (!product) return total
      const unitPrice = getUnitPrice(product, quantity)
      return total + unitPrice * quantity
    }, 0)
  }

  const getDiscountAmount = () => {
    // customDiscount agora é um valor fixo em R$, não porcentagem
    return customer?.customDiscount || 0
  }

  const getCardFee = () => {
    let fee = 0
    const subtotalAfterDiscount = getCartSubtotal() - getDiscountAmount()
    
    // Calculate fee for primary payment
    if (formData.paymentMethod === 'CREDIT_CARD') {
      if (formData.useCombinedPayment) {
        fee += formData.primaryPaymentAmount * 0.035
      } else {
        fee += subtotalAfterDiscount * 0.035
      }
    } else if (formData.paymentMethod === 'DEBIT') {
      if (formData.useCombinedPayment) {
        fee += formData.primaryPaymentAmount * 0.01
      } else {
        fee += subtotalAfterDiscount * 0.01
      }
    }
    
    // Calculate fee for secondary payment (if combined)
    if (formData.useCombinedPayment && formData.secondaryPaymentMethod) {
      if (formData.secondaryPaymentMethod === 'CREDIT_CARD') {
        fee += formData.secondaryPaymentAmount * 0.035
      } else if (formData.secondaryPaymentMethod === 'DEBIT') {
        fee += formData.secondaryPaymentAmount * 0.01
      }
    }
    
    return fee
  }

  const getCartTotal = () => {
    return getCartSubtotal() - getDiscountAmount() - couponDiscount + getCardFee()
  }

  const getTotalPackages = () => {
    return Object.values(cart).reduce((total, quantity) => total + quantity, 0)
  }

  const updateQuantity = (productId: string, quantity: number) => {
    const product = products.find(p => p.id === productId)
    const increment = product?.quantityIncrement || 1

    // Ajusta para o múltiplo mais próximo do incremento
    const adjustedQuantity = Math.max(increment, Math.round(quantity / increment) * increment)

    if (adjustedQuantity <= 0) {
      const newCart = { ...cart }
      delete newCart[productId]
      setCart(newCart)
    } else {
      setCart(prev => ({
        ...prev,
        [productId]: adjustedQuantity
      }))
    }
  }

  const removeItem = (productId: string) => {
    const product = products.find(p => p.id === productId)
    const newCart = { ...cart }
    delete newCart[productId]
    setCart(newCart)
    if (product) {
      toast({
        title: "Item removido",
        description: `${product.name} removido do carrinho`
      })
    }
  }

  const handleQuantityInputChange = (productId: string, value: string) => {
    const numValue = parseInt(value) || 0
    if (numValue > 0) {
      updateQuantity(productId, numValue)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const validateCoupon = async (code: string) => {
    if (!code.trim()) {
      setAppliedCoupon(null)
      setCouponDiscount(0)
      return
    }

    setIsCouponValidating(true)
    try {
      const cartTotal = getCartTotal()
      const cartItems = getCartItems()

      const response = await fetch('/api/admin/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.toUpperCase(),
          customerId: user?.customerId,
          orderTotal: cartTotal,
          orderItems: cartItems.map(item => ({
            productId: item?.product?.id || '',
            quantity: item?.quantity || 0
          }))
        })
      })

      const data = await response.json()

      if (data.valid) {
        setAppliedCoupon(data.coupon)
        setCouponDiscount(data.discountAmount)
        toast({
          title: "✅ Cupom aplicado!",
          description: `Desconto de ${formatCurrency(data.discountAmount)} aplicado com sucesso!`
        })
      } else {
        setAppliedCoupon(null)
        setCouponDiscount(0)
        toast({
          title: "❌ Cupom inválido",
          description: data.error || "Não foi possível aplicar o cupom",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error validating coupon:', error)
      setAppliedCoupon(null)
      setCouponDiscount(0)
      toast({
        title: "Erro",
        description: "Não foi possível validar o cupom",
        variant: "destructive"
      })
    } finally {
      setIsCouponValidating(false)
    }
  }

  const removeCoupon = () => {
    setCouponCode('')
    setAppliedCoupon(null)
    setCouponDiscount(0)
    toast({
      title: "Cupom removido",
      description: "O cupom foi removido do pedido"
    })
  }

  const handleFormChange = (field: string, value: string | boolean | number | null) => {
    setFormData(prev => {
      const newData = {
        ...prev,
        [field]: value
      }
      
      // Auto-calculate payment amounts for combined payment
      if (field === 'useCombinedPayment' && value === false) {
        newData.secondaryPaymentMethod = ''
        newData.primaryPaymentAmount = 0
        newData.secondaryPaymentAmount = 0
      }
      
      // If changing primary payment method to BOLETO in combined payment, use available credit
      if (field === 'paymentMethod' && value === 'BOLETO' && newData.useCombinedPayment) {
        const total = getCartTotal()
        const availableCredit = customer?.availableCredit || 0
        newData.primaryPaymentAmount = Math.min(availableCredit, total)
        newData.secondaryPaymentAmount = Math.max(0, total - newData.primaryPaymentAmount)
      }
      
      return newData
    })
  }

  const validateForm = () => {
    if (!formData.deliveryDate) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione a data de entrega ou retirada.",
        variant: "destructive"
      })
      return false
    }

    if (!formData.paymentMethod) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione o método de pagamento.",
        variant: "destructive"
      })
      return false
    }

    // Validate combined payment
    if (formData.useCombinedPayment) {
      if (!formData.secondaryPaymentMethod) {
        toast({
          title: "Pagamento combinado incompleto",
          description: "Selecione o método de pagamento secundário.",
          variant: "destructive"
        })
        return false
      }
      
      const total = getCartTotal()
      const sumPayments = formData.primaryPaymentAmount + formData.secondaryPaymentAmount
      
      if (Math.abs(sumPayments - total) > 0.01) {
        toast({
          title: "Valores de pagamento incorretos",
          description: `A soma dos pagamentos (${formatCurrency(sumPayments)}) deve ser igual ao total (${formatCurrency(total)}).`,
          variant: "destructive"
        })
        return false
      }
    }

    // Check if order total exceeds available credit when using BOLETO
    if (formData.paymentMethod === 'BOLETO') {
      const boletoAmount = formData.useCombinedPayment ? formData.primaryPaymentAmount : getCartTotal()
      if (boletoAmount > (customer?.availableCredit || 0)) {
        toast({
          title: "Crédito insuficiente",
          description: `Seu crédito disponível é ${formatCurrency(customer?.availableCredit || 0)}. O valor do boleto é ${formatCurrency(boletoAmount)}.`,
          variant: "destructive"
        })
        return false
      }
    }

    return true
  }

  const handleProceedToReview = async () => {
    if (!validateForm()) return

    // Verificar boletos em atraso antes de prosseguir - RESPEITANDO LIBERAÇÃO MANUAL
    try {
      const paymentStatusResponse = await fetch('/api/customers/payment-status')
      if (paymentStatusResponse.ok) {
        const paymentStatus = await paymentStatusResponse.json()
        
        console.log('[CHECKOUT_REVIEW] ========================================')
        console.log('[CHECKOUT_REVIEW] Verificando status de pagamento:', {
          hasOverdueBoletos: paymentStatus.hasOverdueBoletos,
          hasOverdueReceivables: paymentStatus.hasOverdueReceivables,
          hasAnyOverdue: paymentStatus.hasAnyOverdue,
          isBlocked: paymentStatus.isBlocked,
          manuallyUnblocked: paymentStatus.manuallyUnblocked,
          unblockedAt: paymentStatus.unblockedAt,
          overdueCount: paymentStatus.overdueCount,
          overdueAmount: paymentStatus.overdueAmount
        })
        
        // 🔧 LÓGICA SIMPLIFICADA: Verificar liberação manual PRIMEIRO
        if (paymentStatus.manuallyUnblocked === true) {
          console.log('[CHECKOUT_REVIEW] ✅ Cliente LIBERADO MANUALMENTE - Permitindo finalizar pedido')
          console.log('[CHECKOUT_REVIEW] Liberado em:', paymentStatus.unblockedAt)
          // Cliente liberado, não bloquear
        } 
        // Se NÃO foi liberado manualmente, verificar se está bloqueado
        else if (paymentStatus.isBlocked === true) {
          console.log('[CHECKOUT_REVIEW] ❌ BLOQUEANDO finalização - Cliente tem pagamentos vencidos e NÃO está liberado')
          console.log('[CHECKOUT_REVIEW] Detalhes:', {
            count: paymentStatus.overdueCount,
            amount: paymentStatus.overdueAmount
          })
          
          toast({
            title: "⚠️ Compra Bloqueada!",
            description: `Você possui ${paymentStatus.overdueCount} pagamento(s) vencido(s) no valor total de R$ ${paymentStatus.overdueAmount.toFixed(2)}. Por favor, regularize sua situação antes de fazer novos pedidos.`,
            variant: "destructive",
            duration: 10000
          })
          console.log('[CHECKOUT_REVIEW] ========================================')
          return // BLOQUEAR aqui
        } else {
          console.log('[CHECKOUT_REVIEW] ✅ Cliente SEM problemas - Permitindo finalizar pedido')
        }
        console.log('[CHECKOUT_REVIEW] ========================================')
      }
    } catch (error) {
      console.error('[CHECKOUT_REVIEW] Erro ao verificar pagamentos:', error)
      toast({
        title: "Erro ao verificar pagamentos",
        description: "Não foi possível verificar seus pagamentos. Tente novamente.",
        variant: "destructive"
      })
      return
    }

    // Calculate rules summary
    const cartTotal = getCartTotal()
    const packageCount = getTotalPackages()
    
    let deliveryTypeForRules: DeliveryType = 'pickup'
    if (formData.deliveryType === 'DELIVERY') {
      deliveryTypeForRules = formData.deliveryRegion === 'gurupi' ? 'delivery_gurupi' : 'delivery_outside'
    }

    const summary = getOrderRulesSummary(
      deliveryTypeForRules,
      cartTotal,
      packageCount,
      new Date()
    )

    setRulesSummary(summary)
    setShowConfirmDialog(true)
  }

  const handleConfirmOrder = async () => {
    setShowConfirmDialog(false)
    
    // Se é PIX (e não pagamento combinado com PIX secundário), abrir modal de PIX
    const isPrimaryPix = formData.paymentMethod === 'PIX' && !formData.useCombinedPayment
    const isSecondaryPix = formData.useCombinedPayment && formData.secondaryPaymentMethod === 'PIX'
    
    if (isPrimaryPix || isSecondaryPix) {
      setShowPixModal(true)
      return
    }
    
    // Continuar com criação do pedido normalmente
    await createOrder()
  }

  const handlePixPaymentConfirmed = async (confirmedPixChargeId: string, netAmount: number) => {
    setShowPixModal(false)
    setPixChargeId(confirmedPixChargeId)
    await createOrder(confirmedPixChargeId)
  }

  const createOrder = async (confirmedPixChargeId?: string) => {
    setIsSubmitting(true)

    try {
      // 🔒 VALIDAÇÃO: Enviar preços calculados pelo frontend para o backend verificar
      const orderItems = getCartItems().map(item => ({
        productId: item?.product.id,
        quantity: item?.quantity,
        expectedUnitPrice: getUnitPrice(item?.product, item?.quantity || 1) // 🔒 Preço esperado pelo frontend
      }))

      const orderData: any = {
        customerData: {
          // 🔧 USAR dados do formData (pré-preenchidos mas editáveis pelo cliente)
          name: formData.customerName || customer?.name,
          phone: formData.customerPhone || customer?.phone,
          email: formData.customerEmail || customer?.email,
          address: formData.customerAddress || customer?.address,
          city: formData.customerCity || customer?.city
        },
        items: orderItems,
        orderType: 'WHOLESALE',
        deliveryType: formData.deliveryType,
        deliveryRegion: formData.deliveryRegion,
        deliveryFee: rulesSummary?.totalFee || 0,
        deliveryDate: formData.deliveryDate || null,
        deliveryTime: formData.deliveryTime || null,
        paymentMethod: formData.paymentMethod,
        notes: formData.notes || null
      }

      // Add combined payment data if applicable
      if (formData.useCombinedPayment) {
        orderData.secondaryPaymentMethod = formData.secondaryPaymentMethod
        orderData.primaryPaymentAmount = formData.primaryPaymentAmount
        orderData.secondaryPaymentAmount = formData.secondaryPaymentAmount
      }

      // Add boleto installments if applicable
      if (formData.boletoInstallments) {
        orderData.boletoInstallments = formData.boletoInstallments
      }

      // Add coupon data if applicable
      if (appliedCoupon && couponDiscount > 0) {
        orderData.couponId = appliedCoupon.id
        orderData.couponCode = appliedCoupon.code
        orderData.couponDiscount = couponDiscount
      }

      // Add PIX charge ID if payment was via PIX
      if (confirmedPixChargeId) {
        orderData.pixChargeId = confirmedPixChargeId
        orderData.pixPaid = true
      }

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData)
      })

      if (response.ok) {
        const order = await response.json()
        
        // Clear cart
        setCart({})
        localStorage.removeItem(`cart_${user.customerId}`)
        
        // Set completed order info
        setCompletedOrder({
          orderNumber: order.orderNumber,
          orderId: order.id,
          hasBoleto: !!order.boleto
        })
        
        // Show success dialog
        setShowSuccessDialog(true)
        
        toast({
          title: "Pedido realizado com sucesso!",
          description: `Número do pedido: ${order.orderNumber}`,
        })
      } else {
        const errorData = await response.json()
        console.error('❌ [CHECKOUT] Erro da API:', errorData)
        throw new Error(errorData.details || errorData.error || 'Erro ao realizar pedido')
      }
    } catch (error) {
      console.error('Error submitting order:', error)
      toast({
        title: "Erro ao realizar pedido",
        description: error instanceof Error ? error.message : "Tente novamente ou entre em contato conosco.",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <ShoppingCart className="w-8 h-8 text-white animate-pulse" />
          </div>
          <p className="text-lg text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }

  const cartItems = getCartItems()
  const subtotal = getCartSubtotal()
  const discount = getDiscountAmount()
  const total = getCartTotal()

  console.log('🛒 [RENDER] cartItems.length:', cartItems.length)
  console.log('🛒 [RENDER] isLoading:', isLoading)
  console.log('🛒 [RENDER] isCartLoaded:', isCartLoaded)

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <ShoppingCart className="w-8 h-8 text-gray-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Carrinho Vazio</h1>
          <p className="text-gray-600 mb-6">Adicione alguns produtos ao seu carrinho.</p>
          <Link href="/dashboard/catalog">
            <Button className="bg-red-600 hover:bg-red-700">
              Voltar ao Catálogo
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
    <OrderSuccessDialog
      open={showSuccessDialog}
      onOpenChange={setShowSuccessDialog}
      orderNumber={completedOrder?.orderNumber || ''}
      orderId={completedOrder?.orderId || ''}
      hasBoleto={completedOrder?.hasBoleto || false}
      onClose={() => {
        setShowSuccessDialog(false)
        router.push('/dashboard/catalog')
      }}
    />
    
    {/* Modal de Pagamento PIX */}
    <PixPaymentModal
      isOpen={showPixModal}
      onClose={() => setShowPixModal(false)}
      onPaymentConfirmed={handlePixPaymentConfirmed}
      amount={formData.useCombinedPayment && formData.secondaryPaymentMethod === 'PIX' 
        ? formData.secondaryPaymentAmount 
        : getCartTotal() + (rulesSummary?.totalFee || 0) - couponDiscount}
      description={`Pedido Atacado - ${customer?.name || formData.customerName}`}
      customerId={user?.customerId}
      customerName={customer?.name || formData.customerName}
      customerDocument={customer?.cpfCnpj}
      createdBy={user?.id}
      cartData={{
        items: getCartItems().map(item => ({
          productId: item?.product.id,
          quantity: item?.quantity,
          price: getUnitPrice(item?.product, item?.quantity || 1)
        })),
        customerData: {
          name: formData.customerName || customer?.name || '',
          phone: formData.customerPhone || customer?.phone,
          email: formData.customerEmail || customer?.email,
          address: formData.customerAddress || customer?.address,
          city: formData.customerCity || customer?.city
        },
        orderType: 'WHOLESALE',
        deliveryType: formData.deliveryType,
        deliveryRegion: formData.deliveryRegion,
        deliveryFee: rulesSummary?.totalFee || 0,
        deliveryDate: formData.deliveryDate || null,
        deliveryTime: formData.deliveryTime || null,
        paymentMethod: 'PIX',
        notes: formData.notes || null,
        couponId: appliedCoupon?.id,
        couponCode: appliedCoupon?.code,
        couponDiscount: couponDiscount,
        customerId: user?.customerId
      }}
    />
    
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-amber-50">
      {/* Header */}
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
              Finalizar Pedido
            </h1>
          </div>
          
          <div className="w-16"></div> {/* Spacer for centering */}
        </div>
      </header>

      <main className="container mx-auto max-w-6xl px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Order Form */}
          <div className="space-y-6">
            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                {/* 📝 Dados Pessoais e Endereço - PRÉ-PREENCHIDOS MAS EDITÁVEIS */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <MapPin className="w-5 h-5 text-red-600" />
                      Dados Pessoais e Endereço
                    </CardTitle>
                    <p className="text-xs text-gray-600 mt-1">
                      ✓ Os campos já estão preenchidos com seus dados cadastrados. Você pode editá-los se necessário.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <Label htmlFor="customerName">Nome completo *</Label>
                        <Input
                          id="customerName"
                          type="text"
                          value={formData.customerName}
                          onChange={(e) => handleFormChange('customerName', e.target.value)}
                          placeholder="Digite seu nome completo"
                          required
                          className="bg-white"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="customerPhone">Telefone *</Label>
                        <Input
                          id="customerPhone"
                          type="tel"
                          value={formData.customerPhone}
                          onChange={(e) => handleFormChange('customerPhone', e.target.value)}
                          placeholder="(00) 00000-0000"
                          required
                          className="bg-white"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="customerEmail">E-mail *</Label>
                        <Input
                          id="customerEmail"
                          type="email"
                          value={formData.customerEmail}
                          onChange={(e) => handleFormChange('customerEmail', e.target.value)}
                          placeholder="seu@email.com"
                          required
                          className="bg-white"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="customerAddress">Endereço *</Label>
                        <Input
                          id="customerAddress"
                          type="text"
                          value={formData.customerAddress}
                          onChange={(e) => handleFormChange('customerAddress', e.target.value)}
                          placeholder="Rua, número, complemento"
                          required
                          className="bg-white"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="customerCity">Cidade *</Label>
                        <Input
                          id="customerCity"
                          type="text"
                          value={formData.customerCity}
                          onChange={(e) => handleFormChange('customerCity', e.target.value)}
                          placeholder="Nome da cidade"
                          required
                          className="bg-white"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Credit Info */}
                {customer && (
                  <Card className="bg-green-50 border-green-200">
                    <CardContent className="p-4">
                      <div className="text-center">
                        <p className="text-sm text-gray-600">Crédito Disponível</p>
                        <p className="text-lg font-bold text-green-600">
                          {formatCurrency(customer.availableCredit)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Truck className="w-5 h-5 text-red-600" />
                      Entrega ou Retirada
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <RadioGroup
                      value={formData.deliveryType}
                      onValueChange={(value) => handleFormChange('deliveryType', value)}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="DELIVERY" id="delivery" />
                        <Label htmlFor="delivery">Entrega no endereço</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="PICKUP" id="pickup" />
                        <Label htmlFor="pickup">Retirada no local</Label>
                      </div>
                    </RadioGroup>

                    {formData.deliveryType === 'DELIVERY' && (
                      <div className="pt-4 border-t">
                        <Label htmlFor="deliveryRegion">Região de entrega *</Label>
                        <Select value={formData.deliveryRegion} onValueChange={(value) => handleFormChange('deliveryRegion', value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a região" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gurupi">Gurupi (entrega no mesmo dia)</SelectItem>
                            <SelectItem value="outside">Fora de Gurupi (via transportadora)</SelectItem>
                          </SelectContent>
                        </Select>
                        {formData.deliveryRegion === 'outside' && (
                          <p className="text-xs text-gray-600 mt-1">
                            🚚 Entrega via transportadora com 1 dia de antecedência
                          </p>
                        )}
                      </div>
                    )}

                    <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t">
                      <div>
                        <Label htmlFor="deliveryDate">
                          {formData.deliveryType === 'DELIVERY' ? 'Data de entrega' : 'Data de retirada'} *
                        </Label>
                        <Input
                          id="deliveryDate"
                          type="date"
                          value={formData.deliveryDate}
                          onChange={(e) => handleFormChange('deliveryDate', e.target.value)}
                          min={formatDateForInput(
                            formData.deliveryType === 'DELIVERY' ? minDeliveryDate : minPickupDate
                          )}
                          max={formatDateForInput(maxDate)}
                          required
                        />
                        <p className="text-xs text-gray-600 mt-1">
                          {formData.deliveryType === 'DELIVERY' 
                            ? '📅 Selecione o dia para entrega (apenas dias úteis)'
                            : '📅 Selecione o dia para retirada'
                          }
                        </p>
                      </div>
                      
                      <div>
                        <Label htmlFor="deliveryTime">
                          {formData.deliveryType === 'DELIVERY' ? 'Horário de entrega' : 'Horário preferido'}
                        </Label>
                        <Input
                          id="deliveryTime"
                          type="time"
                          value={formData.deliveryTime}
                          onChange={(e) => handleFormChange('deliveryTime', e.target.value)}
                          disabled={formData.deliveryType === 'DELIVERY'}
                          placeholder={formData.deliveryType === 'DELIVERY' ? '16:00 - 18:00 (fixo)' : 'Opcional'}
                        />
                        {formData.deliveryType === 'DELIVERY' && (
                          <p className="text-xs text-gray-600 mt-1">
                            🕐 Horário fixo: 16h às 18h
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Avisos de data e horário */}
                    {dateWarnings.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4">
                        <div className="space-y-2">
                          {dateWarnings.map((warning, index) => (
                            <p key={index} className="text-xs text-amber-900">
                              {warning}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-red-600" />
                      Pagamento
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Aviso sobre taxas de cartão */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                      <p className="text-amber-900 font-medium">⚠️ Importante sobre pagamentos com cartão:</p>
                      <p className="text-amber-800 text-xs mt-1">
                        No atacado, aceitamos pagamentos em dinheiro, PIX ou boleto. Caso opte por cartão, será aplicada uma taxa de serviço conforme a forma escolhida:
                      </p>
                      <ul className="text-amber-800 text-xs mt-1 ml-4 list-disc">
                        <li>Cartão de débito: <strong>1%</strong></li>
                        <li>Cartão de crédito: <strong>3,5%</strong></li>
                      </ul>
                    </div>

                    <div>
                      <Label>Método de pagamento *</Label>
                      <Select value={formData.paymentMethod} onValueChange={(value) => handleFormChange('paymentMethod', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o método" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CASH">Dinheiro</SelectItem>
                          <SelectItem value="PIX">PIX</SelectItem>
                          <SelectItem value="DEBIT">Cartão de Débito (+ 1% taxa)</SelectItem>
                          <SelectItem value="CREDIT_CARD">Cartão de Crédito (+ 3,5% taxa)</SelectItem>
                          {(customer?.canPayWithBoleto !== false) && (
                            <SelectItem value="BOLETO">Boleto (usar limite de crédito)</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Checkbox para pagamento combinado */}
                    <div className="flex items-center space-x-2 pt-2 border-t">
                      <input
                        type="checkbox"
                        id="useCombinedPayment"
                        checked={formData.useCombinedPayment}
                        onChange={(e) => handleFormChange('useCombinedPayment', e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <Label htmlFor="useCombinedPayment" className="cursor-pointer">
                        Usar pagamento combinado (duas formas de pagamento)
                      </Label>
                    </div>

                    {/* Combined Payment Section */}
                    {formData.useCombinedPayment && (
                      <div className="space-y-4 pt-4 border-t bg-blue-50 -mx-6 px-6 py-4 rounded-lg">
                        <p className="text-sm font-medium text-blue-900">Dividir pagamento</p>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs">Valor do primeiro método</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={formData.primaryPaymentAmount}
                              onChange={(e) => handleFormChange('primaryPaymentAmount', parseFloat(e.target.value) || 0)}
                              placeholder="R$ 0,00"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Valor do segundo método</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={formData.secondaryPaymentAmount}
                              onChange={(e) => handleFormChange('secondaryPaymentAmount', parseFloat(e.target.value) || 0)}
                              placeholder="R$ 0,00"
                            />
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs">Segundo método de pagamento *</Label>
                          <Select value={formData.secondaryPaymentMethod} onValueChange={(value) => handleFormChange('secondaryPaymentMethod', value)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o segundo método" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="CASH">Dinheiro</SelectItem>
                              <SelectItem value="PIX">PIX</SelectItem>
                              <SelectItem value="DEBIT">Cartão de Débito (+ 1% taxa)</SelectItem>
                              <SelectItem value="CREDIT_CARD">Cartão de Crédito (+ 3,5% taxa)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="bg-white border border-blue-200 rounded p-2 text-sm">
                          <p className="text-blue-900">
                            <strong>Total a pagar:</strong> {formatCurrency(getCartTotal())}
                          </p>
                          <p className="text-blue-800 text-xs mt-1">
                            Soma dos pagamentos: {formatCurrency(formData.primaryPaymentAmount + formData.secondaryPaymentAmount)}
                          </p>
                          {Math.abs((formData.primaryPaymentAmount + formData.secondaryPaymentAmount) - getCartTotal()) > 0.01 && (
                            <p className="text-red-600 text-xs mt-1">
                              ⚠️ A soma dos valores deve ser igual ao total
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Card Fee Display */}
                    {(formData.paymentMethod === 'CREDIT_CARD' || formData.paymentMethod === 'DEBIT' ||
                      formData.secondaryPaymentMethod === 'CREDIT_CARD' || formData.secondaryPaymentMethod === 'DEBIT') && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                        <p className="text-sm font-medium text-orange-900">
                          Taxa de cartão: {formatCurrency(getCardFee())}
                        </p>
                        <p className="text-xs text-orange-800 mt-1">
                          Esta taxa será adicionada ao total do pedido
                        </p>
                      </div>
                    )}
                    
                    {/* Boleto Warning */}
                    {(formData.paymentMethod === 'BOLETO' || formData.secondaryPaymentMethod === 'BOLETO') && (
                      <div className="space-y-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-sm font-medium text-blue-900">ℹ️ Sobre o boleto:</p>
                          <ul className="text-xs text-blue-800 mt-1 ml-4 list-disc space-y-1">
                            <li>O boleto será gerado manualmente pelo administrativo</li>
                            <li>Prazo de pagamento: {customer?.paymentTerms || 30} dias</li>
                            <li>Crédito disponível: {formatCurrency(customer?.availableCredit || 0)}</li>
                            <li>O valor será descontado do seu limite de crédito</li>
                          </ul>
                        </div>

                        {/* Installment Options */}
                        {customer?.allowInstallments && customer?.installmentOptions && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                            <Label className="text-sm font-medium text-green-900">💳 Opções de Parcelamento</Label>
                            <p className="text-xs text-green-800 mb-3 mt-1">Você pode dividir o pagamento do boleto:</p>
                            
                            <RadioGroup 
                              value={formData.boletoInstallments || 'none'} 
                              onValueChange={(value) => handleFormChange('boletoInstallments', value === 'none' ? null : value)}
                            >
                              <div className="flex items-center space-x-2 mb-2">
                                <RadioGroupItem value="none" id="installment-none" />
                                <Label htmlFor="installment-none" className="cursor-pointer text-sm font-normal">
                                  À vista - Prazo normal ({customer?.paymentTerms || 30} dias)
                                </Label>
                              </div>

                              {(() => {
                                // Parse installment options (format: "7,14,21,28")
                                const days = customer.installmentOptions.split(',').map(d => d.trim()).filter(d => d)
                                if (days.length === 0) return null

                                // Generate options for 2x, 3x, 4x, etc based on available days
                                const options = []
                                for (let i = 2; i <= days.length; i++) {
                                  const selectedDays = days.slice(0, i)
                                  const optionValue = `${i}x-${selectedDays.join('-')}`
                                  options.push({
                                    value: optionValue,
                                    qty: i,
                                    days: selectedDays
                                  })
                                }

                                return options.map((option, index) => (
                                  <div key={index} className="flex items-center space-x-2 mb-2">
                                    <RadioGroupItem value={option.value} id={`installment-${index}`} />
                                    <Label htmlFor={`installment-${index}`} className="cursor-pointer text-sm font-normal">
                                      {option.qty}x - Pagamentos em {option.days.join(', ')} dias
                                    </Label>
                                  </div>
                                ))
                              })()}
                            </RadioGroup>

                            {formData.boletoInstallments && (
                              <div className="mt-3 pt-3 border-t border-green-300 text-xs text-green-800">
                                <p className="font-medium">
                                  {(() => {
                                    const parts = formData.boletoInstallments.split('x-')
                                    if (parts.length === 2) {
                                      const numInstallments = parseInt(parts[0])
                                      const boletoAmount = formData.paymentMethod === 'BOLETO' ? (formData.primaryPaymentAmount || getCartTotal()) : (formData.secondaryPaymentAmount || 0)
                                      return `Valor de cada parcela: ${formatCurrency(boletoAmount / numInstallments)}`
                                    }
                                    return ''
                                  })()}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <Label htmlFor="notes">Observações (opcional)</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => handleFormChange('notes', e.target.value)}
                        placeholder="Alguma observação especial para seu pedido?"
                        rows={3}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Button 
                  onClick={handleProceedToReview}
                  className="w-full h-12 bg-red-600 hover:bg-red-700"
                  disabled={
                    !formData.customerName || 
                    !formData.customerPhone || 
                    !formData.customerEmail || 
                    !formData.customerAddress || 
                    !formData.customerCity ||
                    !formData.paymentMethod || 
                    !formData.deliveryDate
                  }
                >
                  Revisar e Confirmar Pedido
                </Button>
              </motion.div>
            )}
          </div>

          {/* Order Summary */}
          <div className="lg:sticky lg:top-24 h-fit">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-red-600" />
                  Resumo do Pedido
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {cartItems.map((item) => (
                  <div key={item?.product.id} className="flex items-center gap-4">
                    <div className="relative w-16 h-16 bg-gray-100 rounded-lg overflow-hidden">
                      <Image
                        src={item?.product.imageUrl || ''}
                        alt={item?.product.name || ''}
                        fill
                        className="object-cover"
                      />
                    </div>
                    
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 text-sm">{item?.product.name}</h4>
                      <p className="text-xs text-gray-600">{item?.product.weight}</p>
                      {/* Só mostrar indicador de desconto progressivo se NÃO houver preço personalizado */}
                      {item?.product.bulkDiscountMinQty && item?.product.bulkDiscountPrice && !(item?.product as any).hasCustomPrice && (
                        <div className="flex items-center gap-1 mt-1">
                          {item.quantity >= item.product.bulkDiscountMinQty ? (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                              💰 Desconto aplicado!
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500">
                              Desconto a partir de {item.product.bulkDiscountMinQty} un
                            </span>
                          )}
                        </div>
                      )}
                      {/* Mostrar indicador de preço personalizado */}
                      {(item?.product as any).hasCustomPrice && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded mt-1">
                          📋 Preço do catálogo
                        </span>
                      )}
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-sm font-medium">
                          {formatCurrency(getUnitPrice(item?.product, item?.quantity || 1))} × {item?.quantity}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-7 h-7 p-0 text-xs"
                            onClick={() => updateQuantity(item?.product.id || '', (item?.quantity || 1) - (item?.product.quantityIncrement || 1))}
                          >
                            -
                          </Button>
                          <Input
                            type="number"
                            value={item?.quantity || 1}
                            onChange={(e) => handleQuantityInputChange(item?.product.id || '', e.target.value)}
                            onBlur={(e) => {
                              const value = parseInt(e.target.value) || 1
                              updateQuantity(item?.product.id || '', value)
                            }}
                            className="w-14 h-7 text-center text-xs p-0"
                            min={(item?.product.quantityIncrement || 1)}
                            step={(item?.product.quantityIncrement || 1)}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-7 h-7 p-0 text-xs"
                            onClick={() => updateQuantity(item?.product.id || '', (item?.quantity || 1) + (item?.product.quantityIncrement || 1))}
                          >
                            +
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-7 h-7 p-0 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => removeItem(item?.product.id || '')}
                            title="Remover item"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      {(item?.product.quantityIncrement || 1) > 1 && (
                        <p className="text-xs text-gray-500 mt-1">
                          ↗️ Incremento: {item?.product.quantityIncrement || 1} un.
                        </p>
                      )}
                    </div>
                    
                    <div className="text-right">
                      <p className="font-medium text-gray-900">
                        {formatCurrency(getUnitPrice(item?.product, item?.quantity || 1) * (item?.quantity || 1))}
                      </p>
                    </div>
                  </div>
                ))}

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  
                  {customer && customer.customDiscount > 0 && (
                    <div className="flex items-center justify-between text-green-600">
                      <span className="flex items-center gap-1">
                        <Percent className="w-4 h-4" />
                        Desconto Personalizado
                      </span>
                      <span>-{formatCurrency(discount)}</span>
                    </div>
                  )}

                  {/* Coupon Section */}
                  <div className="space-y-2 py-2">
                    {!appliedCoupon ? (
                      <div className="flex gap-2">
                        <Input
                          placeholder="Código do cupom"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              validateCoupon(couponCode)
                            }
                          }}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          onClick={() => validateCoupon(couponCode)}
                          disabled={isCouponValidating || !couponCode.trim()}
                          variant="outline"
                          size="sm"
                        >
                          {isCouponValidating ? 'Validando...' : 'Aplicar'}
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between text-pink-600 bg-pink-50 p-2 rounded">
                          <span className="flex items-center gap-2">
                            <Percent className="w-4 h-4" />
                            <span className="text-sm">
                              Cupom: <strong>#{appliedCoupon.code}</strong>
                            </span>
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="font-semibold">-{formatCurrency(couponDiscount)}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={removeCoupon}
                              className="h-6 w-6 p-0"
                            >
                              ×
                            </Button>
                          </span>
                        </div>
                        {appliedCoupon.description && (
                          <p className="text-xs text-gray-600 px-2">{appliedCoupon.description}</p>
                        )}
                      </>
                    )}
                  </div>

                  {getCardFee() > 0 && (
                    <div className="flex items-center justify-between text-orange-600">
                      <span className="flex items-center gap-1 text-sm">
                        <CreditCard className="w-4 h-4" />
                        Taxa de cartão
                      </span>
                      <span className="text-sm">+{formatCurrency(getCardFee())}</span>
                    </div>
                  )}

                  <Separator />

                  <div className="flex items-center justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-red-600">{formatCurrency(total)}</span>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
                  <div className="flex items-start gap-2">
                    <PackageCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium mb-1">Total de pacotes: {getTotalPackages()}</p>
                      <p className="text-blue-800">Taxa de entrega será calculada no próximo passo</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Confirmation Dialog */}
      {rulesSummary && (
        <OrderConfirmationDialog
          open={showConfirmDialog}
          onOpenChange={setShowConfirmDialog}
          onConfirm={handleConfirmOrder}
          rulesSummary={rulesSummary}
          totalValue={total}
          isLoading={isSubmitting}
        />
      )}
    </div>
    </>
  )
}
