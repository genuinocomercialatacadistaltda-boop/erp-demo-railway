
'use client'

import { useState, useEffect } from 'react'
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
import { 
  ArrowLeft, 
  ShoppingCart, 
  Truck, 
  MapPin, 
  CreditCard, 
  Calendar,
  Clock,
  PackageCheck,
  Trash2
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useToast } from '@/hooks/use-toast'
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
  priceRetail: number
  imageUrl: string
  weight: string
  quantityIncrement: number
}

export default function RetailCheckoutPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<{[key: string]: number}>({})
  const [isLoading, setIsLoading] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [showPixModal, setShowPixModal] = useState(false)
  const [completedOrder, setCompletedOrder] = useState<{orderNumber: string, orderId: string, hasBoleto: boolean} | null>(null)
  const [rulesSummary, setRulesSummary] = useState<OrderRulesSummary | null>(null)
  const [dateWarnings, setDateWarnings] = useState<string[]>([])
  
  // 🎟️ Estados do Cupom de Desconto
  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null)
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [isCouponValidating, setIsCouponValidating] = useState(false)
  
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    deliveryType: 'DELIVERY', // DELIVERY or PICKUP
    deliveryRegion: 'gurupi', // gurupi, outside
    address: '',
    city: '',
    deliveryDate: '',
    deliveryTime: '16:00', // Horário fixo para entrega
    paymentMethod: '', // CASH, CARD, PIX
    notes: ''
  })

  const router = useRouter()
  const { toast } = useToast()

  // Calcula datas mínimas e máximas
  const currentDate = new Date()
  const minDeliveryDate = getMinDeliveryDate(currentDate)
  const minPickupDate = getMinPickupDate(currentDate)
  const maxDate = getMaxDate(currentDate)

  useEffect(() => {
    // Load cart from localStorage
    const savedCart = localStorage.getItem('retailCart')
    if (savedCart) {
      setCart(JSON.parse(savedCart))
    }
    
    fetchProducts()
  }, [])

  useEffect(() => {
    // Save cart to localStorage whenever it changes
    localStorage.setItem('retailCart', JSON.stringify(cart))
  }, [cart])

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

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products')
      if (response.ok) {
        const data = await response.json()
        setProducts(data)
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const getCartItems = () => {
    return Object.entries(cart).map(([productId, quantity]) => {
      const product = products.find(p => p.id === productId)
      return product ? { product, quantity } : null
    }).filter(Boolean)
  }

  const getCartTotal = () => {
    return Object.entries(cart).reduce((total, [productId, quantity]) => {
      const product = products.find(p => p.id === productId)
      return total + (product?.priceRetail || 0) * quantity
    }, 0)
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

  const handleQuantityInputChange = (productId: string, value: string) => {
    const numValue = parseInt(value) || 0
    if (numValue > 0) {
      updateQuantity(productId, numValue)
    }
  }

  const removeFromCart = (productId: string) => {
    const newCart = { ...cart }
    delete newCart[productId]
    setCart(newCart)
    toast({
      title: "Item removido",
      description: "O item foi removido do carrinho.",
    })
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  // 🎟️ Validar Cupom de Desconto
  const validateCoupon = async (code: string) => {
    if (!code || !code.trim()) {
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
          customerId: null, // Cliente sem ID específico
          orderTotal: cartTotal,
          orderItems: cartItems.map((item: any) => ({
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

  // 🎟️ Remover Cupom de Desconto
  const removeCoupon = () => {
    setCouponCode('')
    setAppliedCoupon(null)
    setCouponDiscount(0)
    toast({
      title: "Cupom removido",
      description: "O cupom foi removido do pedido"
    })
  }

  const handleFormChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const validateForm = () => {
    if (!formData.customerName || !formData.customerPhone || !formData.paymentMethod) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha nome, telefone e método de pagamento.",
        variant: "destructive"
      })
      return false
    }

    if (!formData.deliveryDate) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione a data de entrega ou retirada.",
        variant: "destructive"
      })
      return false
    }

    if (formData.deliveryType === 'DELIVERY' && (!formData.address || !formData.city)) {
      toast({
        title: "Endereço necessário",
        description: "Para entrega, informe o endereço completo.",
        variant: "destructive"
      })
      return false
    }

    return true
  }

  const handleProceedToReview = () => {
    if (!validateForm()) return

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
    
    // 💜 Se é PIX, abrir modal para gerar QR Code
    if (formData.paymentMethod === 'PIX') {
      console.log('💜 [RETAIL_CHECKOUT] Abrindo modal PIX para gerar QR Code')
      setShowPixModal(true)
      return
    }
    
    // Outros métodos de pagamento: criar pedido diretamente
    await createOrder()
  }

  // 💜 Callback quando PIX é confirmado
  const handlePixPaymentConfirmed = async (confirmedPixChargeId: string, netAmount: number) => {
    setShowPixModal(false)
    await createOrder(confirmedPixChargeId)
  }

  const createOrder = async (confirmedPixChargeId?: string) => {
    setIsLoading(true)

    try {
      const orderItems = getCartItems().map(item => ({
        productId: item?.product.id,
        quantity: item?.quantity
      }))

      const orderData = {
        items: orderItems,
        customerData: {
          name: formData.customerName,
          phone: formData.customerPhone,
          email: formData.customerEmail || null,
          address: formData.address || null,
          city: formData.city || null
        },
        orderType: 'RETAIL',
        deliveryType: formData.deliveryType,
        deliveryRegion: formData.deliveryRegion,
        deliveryFee: rulesSummary?.totalFee || 0,
        deliveryDate: formData.deliveryDate || null,
        deliveryTime: formData.deliveryTime || null,
        paymentMethod: formData.paymentMethod,
        notes: formData.notes || null,
        // 💜 PIX: incluir ID da cobrança confirmada
        ...(confirmedPixChargeId && {
          pixChargeId: confirmedPixChargeId,
          pixPaid: true
        }),
        // 🎟️ Adicionar cupom de desconto se aplicado
        ...(appliedCoupon && couponDiscount > 0 && {
          couponId: appliedCoupon.id,
          couponCode: appliedCoupon.code,
          couponDiscount: couponDiscount
        })
      }

      console.log('🎟️ [RETAIL_CHECKOUT] Dados do pedido:', {
        hasCoupon: !!appliedCoupon,
        couponCode: appliedCoupon?.code,
        couponDiscount,
        pixChargeId: confirmedPixChargeId
      })

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
        localStorage.removeItem('retailCart')
        
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
        throw new Error(errorData.error || 'Erro ao realizar pedido')
      }
    } catch (error) {
      console.error('Error submitting order:', error)
      toast({
        title: "Erro ao realizar pedido",
        description: "Tente novamente ou entre em contato conosco.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const cartItems = getCartItems()
  const total = getCartTotal()

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <ShoppingCart className="w-8 h-8 text-gray-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Carrinho Vazio</h1>
          <p className="text-gray-600 mb-6">Adicione alguns espetinhos deliciosos ao seu carrinho.</p>
          <Link href="/retail">
            <Button className="bg-orange-600 hover:bg-orange-700">
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
        router.push('/admin/orders')
      }}
    />

    {/* 💜 Modal de Pagamento PIX */}
    <PixPaymentModal
      isOpen={showPixModal}
      onClose={() => setShowPixModal(false)}
      onPaymentConfirmed={handlePixPaymentConfirmed}
      amount={total + (rulesSummary?.totalFee || 0) - couponDiscount}
      description={`Pedido Varejo - ${formData.customerName || 'Cliente'}`}
      customerName={formData.customerName}
    />

    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-amber-50">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto max-w-6xl flex h-16 items-center justify-between px-4">
          <Link href="/retail" className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-4 h-4" />
            Voltar ao Catálogo
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
              Finalizar Pedido
            </h1>
          </div>
          
          <div className="w-16"></div>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Order Form */}
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-orange-600" />
                    Informações Pessoais
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="customerName">Nome completo *</Label>
                    <Input
                      id="customerName"
                      value={formData.customerName}
                      onChange={(e) => handleFormChange('customerName', e.target.value)}
                      placeholder="Seu nome completo"
                      required
                    />
                  </div>
                  
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="customerPhone">Telefone *</Label>
                      <Input
                        id="customerPhone"
                        value={formData.customerPhone}
                        onChange={(e) => handleFormChange('customerPhone', e.target.value)}
                        placeholder="(63) 99999-9999"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="customerEmail">E-mail (opcional)</Label>
                      <Input
                        id="customerEmail"
                        type="email"
                        value={formData.customerEmail}
                        onChange={(e) => handleFormChange('customerEmail', e.target.value)}
                        placeholder="seu@email.com"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="w-5 h-5 text-orange-600" />
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
                    <div className="space-y-4 pt-4 border-t">
                      <div>
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

                      <div>
                        <Label htmlFor="address">Endereço completo *</Label>
                        <Input
                          id="address"
                          value={formData.address}
                          onChange={(e) => handleFormChange('address', e.target.value)}
                          placeholder="Rua, número, complemento"
                          required
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="city">Cidade *</Label>
                        <Input
                          id="city"
                          value={formData.city}
                          onChange={(e) => handleFormChange('city', e.target.value)}
                          placeholder="Sua cidade"
                          required
                        />
                      </div>
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
                    <CreditCard className="w-5 h-5 text-orange-600" />
                    Pagamento
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Método de pagamento *</Label>
                    <Select value={formData.paymentMethod} onValueChange={(value) => handleFormChange('paymentMethod', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o método" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CASH">Dinheiro</SelectItem>
                        <SelectItem value="CARD">Cartão</SelectItem>
                        <SelectItem value="PIX">PIX</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 🎟️ Campo de Cupom de Desconto */}
                  <div>
                    <Label htmlFor="coupon">Cupom de Desconto (opcional)</Label>
                    {appliedCoupon ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 px-3 py-2 bg-green-50 border border-green-200 rounded-md">
                          <p className="text-sm font-medium text-green-700">
                            ✓ Cupom "{appliedCoupon.code}" aplicado
                          </p>
                          <p className="text-xs text-green-600">
                            Desconto: {formatCurrency(couponDiscount)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={removeCoupon}
                          className="text-red-600 hover:text-red-700"
                        >
                          Remover
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          id="coupon"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              validateCoupon(couponCode)
                            }
                          }}
                          placeholder="Digite o código do cupom"
                          className="flex-1"
                          disabled={isCouponValidating}
                        />
                        <Button
                          type="button"
                          onClick={() => validateCoupon(couponCode)}
                          disabled={isCouponValidating || !couponCode.trim()}
                          className="bg-orange-600 hover:bg-orange-700"
                        >
                          {isCouponValidating ? 'Validando...' : 'Aplicar'}
                        </Button>
                      </div>
                    )}
                  </div>
                  
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
                className="w-full h-12 bg-orange-600 hover:bg-orange-700"
                disabled={!formData.customerName || !formData.customerPhone || !formData.paymentMethod || !formData.deliveryDate}
              >
                Revisar e Confirmar Pedido
              </Button>
            </motion.div>
          </div>

          {/* Order Summary */}
          <div className="lg:sticky lg:top-24 h-fit">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-orange-600" />
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
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-sm font-medium">
                          {formatCurrency(item?.product.priceRetail || 0)} × {item?.quantity}
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
                        </div>
                      </div>
                      {(item?.product.quantityIncrement || 1) > 1 && (
                        <p className="text-xs text-gray-500 mt-1">
                          ↗️ Incremento: {item?.product.quantityIncrement || 1} un.
                        </p>
                      )}
                    </div>
                    
                    <div className="flex flex-col items-end gap-2">
                      <p className="font-medium text-gray-900">
                        {formatCurrency((item?.product.priceRetail || 0) * (item?.quantity || 1))}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => removeFromCart(item?.product.id || '')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                <Separator />

                {/* 🎟️ Resumo de Valores */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium">{formatCurrency(total)}</span>
                  </div>

                  {/* Mostrar desconto do cupom se aplicado */}
                  {appliedCoupon && couponDiscount > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-green-600">🎟️ Desconto (Cupom)</span>
                      <span className="font-semibold text-green-600">-{formatCurrency(couponDiscount)}</span>
                    </div>
                  )}

                  <Separator />

                  <div className="flex items-center justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-orange-600">{formatCurrency(total - couponDiscount)}</span>
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
          isLoading={isLoading}
        />
      )}
    </div>
    </>
  )
}
