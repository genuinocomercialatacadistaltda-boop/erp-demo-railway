'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  ArrowLeft, 
  ShoppingCart, 
  Truck, 
  MapPin, 
  CreditCard, 
  Trash2,
  AlertCircle,
  PackageCheck
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useToast } from '@/hooks/use-toast'
import { PixPaymentModal } from '@/components/pix-payment-modal'

interface Product {
  id: string
  name: string
  priceWholesale: number
  imageUrl: string
  weight: string
  quantityIncrement: number
  // 💰 Desconto Progressivo
  bulkDiscountMinQty?: number | null
  bulkDiscountPrice?: number | null
}

export default function VarejoCheckoutPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<{[key: string]: number}>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(true)
  
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    deliveryType: 'DELIVERY',
    address: '',
    city: '',
    paymentMethod: '',
    notes: ''
  })

  // 🎟️ Estados do Cupom de Desconto
  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null)
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [isCouponValidating, setIsCouponValidating] = useState(false)
  
  // 💳 Estados do PIX
  const [showPixModal, setShowPixModal] = useState(false)

  const router = useRouter()
  const { toast } = useToast()
  const { data: session, status } = useSession() || {}
  const MIN_ESPETOS = 25

  useEffect(() => {
    const savedCart = localStorage.getItem('varejoCart')
    if (savedCart) {
      setCart(JSON.parse(savedCart))
    }
    
    fetchProducts()
  }, [])

  useEffect(() => {
    localStorage.setItem('varejoCart', JSON.stringify(cart))
  }, [cart])

  // 🎯 Buscar dados completos do cliente se estiver logado
  useEffect(() => {
    const fetchCustomerData = async () => {
      if (session?.user?.customerId) {
        try {
          console.log('🎯 Buscando dados do cliente varejo...')
          const response = await fetch('/api/varejo/me')
          if (response.ok) {
            const data = await response.json()
            if (data.success && data.customer) {
              const customerData = data.customer
              setFormData(prev => ({
                ...prev,
                customerName: customerData.name || prev.customerName,
                customerEmail: customerData.email || prev.customerEmail,
                customerPhone: customerData.phone || prev.customerPhone
              }))
              console.log('✅ Dados do cliente carregados:', {
                nome: customerData.name,
                email: customerData.email,
                telefone: customerData.phone
              })
            } else {
              console.error('❌ Resposta da API sem dados do cliente')
            }
          } else {
            console.error('❌ Erro na resposta da API:', response.status)
          }
        } catch (error) {
          console.error('❌ Erro ao buscar dados do cliente:', error)
        }
      }
    }

    if (session?.user?.customerId) {
      fetchCustomerData()
    }
  }, [session])

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products')
      if (response.ok) {
        const data = await response.json()
        setProducts(data)
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setIsLoadingData(false)
    }
  }

  const getCartItems = () => {
    return Object.entries(cart).map(([productId, quantity]) => {
      const product = products.find(p => p.id === productId)
      return product ? { product, quantity } : null
    }).filter(Boolean)
  }

  const getTotalEspetos = () => {
    return Object.values(cart).reduce((sum, quantity) => sum + quantity, 0)
  }

  const getCartTotal = () => {
    return Object.entries(cart).reduce((total, [productId, quantity]) => {
      const product = products.find(p => p.id === productId)
      if (!product) return total
      
      // 💰 Aplicar desconto progressivo se configurado e quantidade atingir o mínimo
      let unitPrice = product.priceWholesale
      if (product.bulkDiscountMinQty && product.bulkDiscountPrice && quantity >= product.bulkDiscountMinQty) {
        unitPrice = product.bulkDiscountPrice
      }
      
      return total + unitPrice * quantity
    }, 0)
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

  // 💰 Calcular preço unitário com desconto progressivo
  const getUnitPrice = (product: Product, quantity: number) => {
    if (product.bulkDiscountMinQty && product.bulkDiscountPrice && quantity >= product.bulkDiscountMinQty) {
      return product.bulkDiscountPrice
    }
    return product.priceWholesale
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
      const cartTotal = getCartTotal() // Já inclui desconto progressivo
      const cartItems = getCartItems()

      const response = await fetch('/api/admin/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.toUpperCase(),
          customerId: null, // Cliente sem cadastro
          orderTotal: cartTotal, // Total JÁ com desconto progressivo aplicado
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

    if (formData.deliveryType === 'DELIVERY' && (!formData.address || !formData.city)) {
      toast({
        title: "Endereço necessário",
        description: "Para entrega, informe o endereço completo.",
        variant: "destructive"
      })
      return false
    }

    const totalEspetos = getTotalEspetos()
    if (totalEspetos < MIN_ESPETOS) {
      toast({
        title: "Pedido mínimo não atingido",
        description: `São necessários pelo menos ${MIN_ESPETOS} espetos. Você tem ${totalEspetos}.`,
        variant: "destructive"
      })
      return false
    }

    return true
  }

  const handleConfirmOrder = async () => {
    if (!validateForm()) return

    // Se é PIX, abrir modal de PIX primeiro
    if (formData.paymentMethod === 'PIX') {
      setShowPixModal(true)
      return
    }

    // Continuar com criação do pedido normalmente
    await createOrder()
  }

  const handlePixPaymentConfirmed = async (confirmedPixChargeId: string, netAmount: number) => {
    setShowPixModal(false)
    await createOrder(confirmedPixChargeId)
  }

  const createOrder = async (confirmedPixChargeId?: string) => {
    setIsLoading(true)

    try {
      const orderItems = getCartItems().map(item => ({
        productId: item?.product.id,
        quantity: item?.quantity,
        price: item?.product.priceWholesale
      }))

      const orderData: any = {
        items: orderItems,
        customerData: {
          name: formData.customerName,
          phone: formData.customerPhone,
          email: formData.customerEmail || null,
          address: formData.address || null,
          city: formData.city || null
        },
        orderType: 'WHOLESALE_CASUAL', // Atacado sem cadastro
        deliveryType: formData.deliveryType,
        paymentMethod: formData.paymentMethod,
        notes: formData.notes || null,
        totalAmount: getCartTotal()
      }

      // 🎯 Adicionar customerId se o usuário estiver logado
      if (session?.user?.customerId) {
        orderData.customerId = session.user.customerId
        console.log('🎯 Cliente logado - customerId:', session.user.customerId)
      }

      // 🎟️ Adicionar cupom de desconto se aplicado
      if (appliedCoupon && couponDiscount > 0) {
        orderData.couponId = appliedCoupon.id
        orderData.couponCode = appliedCoupon.code
        orderData.couponDiscount = couponDiscount
        console.log('🎟️ Cupom aplicado ao pedido:', {
          code: appliedCoupon.code,
          discount: couponDiscount
        })
      }

      // 💳 Adicionar PIX charge ID se pagamento foi via PIX
      if (confirmedPixChargeId) {
        orderData.pixChargeId = confirmedPixChargeId
        orderData.pixPaid = true
      }

      const response = await fetch('/api/orders/wholesale-casual', {
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
        localStorage.removeItem('varejoCart')
        
        toast({
          title: "Pedido realizado com sucesso!",
          description: `Número do pedido: ${order.orderNumber}`,
        })
        
        // Redirect to success page or home
        setTimeout(() => {
          router.push('/')
        }, 2000)
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
  const totalEspetos = getTotalEspetos()
  const espetosRestantes = Math.max(0, MIN_ESPETOS - totalEspetos)

  // Show loading while data is being fetched
  if (isLoadingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-orange-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <ShoppingCart className="w-8 h-8 text-white animate-pulse" />
          </div>
          <p className="text-lg text-gray-600">Carregando carrinho...</p>
        </div>
      </div>
    )
  }

  // Only show empty cart after data is loaded
  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <ShoppingCart className="w-8 h-8 text-gray-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Carrinho Vazio</h1>
          <p className="text-gray-600 mb-6">Adicione pelo menos 25 espetos ao carrinho.</p>
          <Link href="/varejo/catalogo">
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
    {/* Modal de Pagamento PIX */}
    <PixPaymentModal
      isOpen={showPixModal}
      onClose={() => setShowPixModal(false)}
      onPaymentConfirmed={handlePixPaymentConfirmed}
      amount={getCartTotal() - couponDiscount}
      description={`Pedido Varejo - ${formData.customerName}`}
      customerName={formData.customerName}
      createdBy="varejo-checkout"
      customerId={session?.user?.customerId || undefined}
      cartData={{
        items: getCartItems().map(item => ({
          productId: item?.product.id || '',
          quantity: item?.quantity || 0,
          price: item?.product.priceWholesale || 0,
        })),
        customerData: {
          name: formData.customerName,
          phone: formData.customerPhone,
          email: formData.customerEmail || undefined,
          address: formData.address || undefined,
          city: formData.city || undefined,
        },
        orderType: 'WHOLESALE_CASUAL',
        deliveryType: formData.deliveryType,
        paymentMethod: 'PIX',
        notes: formData.notes || undefined,
        couponId: appliedCoupon?.id,
        couponCode: appliedCoupon?.code,
        couponDiscount: couponDiscount,
        customerId: session?.user?.customerId || undefined,
      }}
    />
    
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto max-w-6xl flex h-16 items-center justify-between px-4">
          <Link href="/varejo/catalogo" className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
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
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Finalizar Pedido</h1>
              <p className="text-xs text-orange-600">Atacado sem cadastro</p>
            </div>
          </div>
          
          <div className="w-16"></div>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl px-4 py-8">
        {/* Alert de Pedido Mínimo */}
        {totalEspetos < MIN_ESPETOS && (
          <Alert className="bg-red-50 border-red-300 mb-6">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <AlertDescription className="text-red-900 font-medium">
              <span className="font-bold">Atenção!</span> Você precisa de mais <span className="font-bold text-lg">{espetosRestantes}</span> espeto(s) para atingir o mínimo de 25 unidades.
            </AlertDescription>
          </Alert>
        )}

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
                    Suas Informações
                  {session?.user?.customerId && (
                    <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                      <PackageCheck className="w-4 h-4" />
                      Dados carregados do seu cadastro
                    </p>
                  )}
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
                      disabled={!!session?.user?.customerId}
                      className={session?.user?.customerId ? "bg-gray-100 cursor-not-allowed" : ""}
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
                        disabled={!!session?.user?.customerId}
                        className={session?.user?.customerId ? "bg-gray-100 cursor-not-allowed" : ""}
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
                        disabled={!!session?.user?.customerId}
                        className={session?.user?.customerId ? "bg-gray-100 cursor-not-allowed" : ""}
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
                onClick={handleConfirmOrder}
                className="w-full h-12 bg-orange-600 hover:bg-orange-700"
                disabled={isLoading || totalEspetos < MIN_ESPETOS}
              >
                {isLoading ? 'Processando...' : 'Confirmar Pedido'}
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
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Total de espetos:</span>
                    <span className="text-lg font-bold text-orange-600">{totalEspetos}</span>
                  </div>
                  {totalEspetos >= MIN_ESPETOS ? (
                    <p className="text-xs text-green-700 font-semibold mt-1">
                      ✓ Pedido mínimo atingido!
                    </p>
                  ) : (
                    <p className="text-xs text-red-700 font-semibold mt-1">
                      ✗ Faltam {espetosRestantes} espeto(s) para o mínimo
                    </p>
                  )}
                </div>

                <Separator />

                {cartItems.map((item) => (
                  <div key={item?.product.id} className="flex items-center gap-4">
                    <div className="relative w-16 h-16 bg-gray-100 rounded-lg overflow-hidden">
                      <Image
                        src={item?.product.imageUrl || '/placeholder-product.jpg'}
                        alt={item?.product.name || ''}
                        fill
                        className="object-cover"
                      />
                    </div>
                    
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 text-sm">{item?.product.name}</h4>
                      <p className="text-xs text-gray-600">{item?.product.weight}</p>
                      <div className="mt-1">
                        {/* 💰 Mostrar preço com desconto progressivo se aplicável */}
                        {item?.product.bulkDiscountMinQty && item?.product.bulkDiscountPrice && item?.quantity >= item.product.bulkDiscountMinQty ? (
                          <>
                            <p className="text-xs text-gray-400 line-through">
                              {formatCurrency(item.product.priceWholesale || 0)} × {item.quantity}
                            </p>
                            <p className="text-sm font-medium text-green-600">
                              {formatCurrency(item.product.bulkDiscountPrice || 0)} × {item.quantity}
                              <span className="ml-1 text-xs">💰</span>
                            </p>
                          </>
                        ) : (
                          <p className="text-sm font-medium">
                            {formatCurrency(item?.product.priceWholesale || 0)} × {item?.quantity}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-2">
                      <p className="font-medium text-gray-900">
                        {formatCurrency(getUnitPrice(item?.product, item?.quantity || 1) * (item?.quantity || 1))}
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
                  <PackageCheck className="w-4 h-4 inline mr-2" />
                  <span className="font-semibold">Preços de atacado</span> já aplicados automaticamente!
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
    </>
  )
}