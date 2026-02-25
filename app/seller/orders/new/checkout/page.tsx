'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { ShoppingCart, ArrowLeft, AlertCircle, Truck, CreditCard, Percent, Minus, Plus, Trash2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { getDeliveryWarnings, getPickupWarnings, formatDateForInput, getMinDeliveryDate, getMinPickupDate, getOrderRulesSummary, type DeliveryType } from '@/lib/business-rules'
import { OrderConfirmationDialog } from '@/components/order-confirmation-dialog'
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
}

interface CartItem {
  productId: string
  product: Product
  quantity: number
}

export default function SellerOrderCheckoutPage() {
  const { data: session, status } = useSession() || {}
  const router = useRouter()
  
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [deliveryType, setDeliveryType] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY')
  const [deliveryDate, setDeliveryDate] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState<string>('')
  const [secondaryPaymentMethod, setSecondaryPaymentMethod] = useState<string>('NONE')
  const [primaryPaymentAmount, setPrimaryPaymentAmount] = useState<string>('')
  const [secondaryPaymentAmount, setSecondaryPaymentAmount] = useState<string>('')
  const [boletoInstallments, setBoletoInstallments] = useState<string>('avista')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [rulesSummary, setRulesSummary] = useState<any>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    } else if (session && !['SELLER', 'EMPLOYEE'].includes((session.user as any)?.userType)) {
      router.push('/dashboard')
    } else if (session && ['SELLER', 'EMPLOYEE'].includes((session.user as any)?.userType)) {
      loadFromLocalStorage()
    }
  }, [session, status, router])

  // 🔧 Selecionar parcelamento automaticamente quando cliente tem opção de 4 parcelas
  useEffect(() => {
    if (paymentMethod === 'BOLETO' && selectedCustomer?.allowInstallments && selectedCustomer?.installmentOptions) {
      const days = selectedCustomer.installmentOptions.split(',').map(d => d.trim()).filter(d => d)
      
      console.log('[SELLER_CHECKOUT_BOLETO] Cliente com parcelamento habilitado:', {
        customer: selectedCustomer.name,
        installmentOptions: selectedCustomer.installmentOptions,
        totalDays: days.length
      })
      
      // Se tem 4 dias configurados (7,14,21,28), selecionar automaticamente 4x
      if (days.length === 4 && boletoInstallments === 'avista') {
        const value = `4x-${days.join('-')}`
        console.log('[SELLER_CHECKOUT_BOLETO] ✅ Selecionando automaticamente 4 parcelas:', value)
        setBoletoInstallments(value)
      }
    }
  }, [paymentMethod, selectedCustomer, boletoInstallments])

  const loadFromLocalStorage = () => {
    try {
      const customerData = localStorage.getItem('seller_order_customer')
      const cartData = localStorage.getItem('seller_order_cart')

      if (!customerData || !cartData) {
        toast.error('Dados do pedido não encontrados')
        router.push('/seller/orders/new/select')
        return
      }

      setSelectedCustomer(JSON.parse(customerData))
      setCart(JSON.parse(cartData))
      setLoading(false)
    } catch (error) {
      console.error('Error loading from localStorage:', error)
      toast.error('Erro ao carregar dados do pedido')
      router.push('/seller/orders/new/select')
    }
  }

  const updateQuantity = (productId: string, quantity: number) => {
    const cartItem = cart.find(item => item.productId === productId)
    const increment = cartItem?.product.quantityIncrement || 1
    const adjustedQuantity = Math.max(increment, Math.round(quantity / increment) * increment)

    if (adjustedQuantity <= 0) {
      setCart(cart.filter(item => item.productId !== productId))
    } else {
      setCart(cart.map(item =>
        item.productId === productId ? { ...item, quantity: adjustedQuantity } : item
      ))
    }

    const updatedCart = cart.map(item =>
      item.productId === productId ? { ...item, quantity: adjustedQuantity } : item
    ).filter(item => item.quantity > 0)
    localStorage.setItem('seller_order_cart', JSON.stringify(updatedCart))
  }

  const removeItem = (productId: string) => {
    const item = cart.find(c => c.productId === productId)
    const updatedCart = cart.filter(item => item.productId !== productId)
    setCart(updatedCart)
    localStorage.setItem('seller_order_cart', JSON.stringify(updatedCart))
    if (item) {
      toast.success(`${item.product.name} removido do carrinho`)
    }
  }

  const handleQuantityInputChange = (productId: string, value: string) => {
    const cartItem = cart.find(item => item.productId === productId)
    const soldByWeight = cartItem?.product.soldByWeight || false
    
    // Substituir vírgula por ponto para aceitar formato brasileiro (1,2 → 1.2)
    const normalizedValue = value.replace(',', '.')
    
    // Se vendido por peso, usa parseFloat; senão, usa parseInt
    const numValue = soldByWeight ? (parseFloat(normalizedValue) || 0) : (parseInt(normalizedValue) || 0)
    
    if (numValue > 0) {
      updateQuantity(productId, numValue)
    }
  }

  const calculateTotals = () => {
    const subtotal = cart.reduce((sum, item) => {
      return sum + (item.product.priceWholesale * item.quantity)
    }, 0)

    const customDiscountValue = selectedCustomer?.customDiscount || 0
    const totalDiscountValue = customDiscountValue
    
    let total = subtotal - totalDiscountValue

    let cardFee = 0
    if (paymentMethod === 'CREDIT_CARD') {
      cardFee = total * 0.035
    } else if (paymentMethod === 'DEBIT') {
      cardFee = total * 0.01
    }

    if (secondaryPaymentMethod && secondaryPaymentMethod !== 'NONE') {
      if (secondaryPaymentMethod === 'CREDIT_CARD') {
        cardFee += (parseFloat(secondaryPaymentAmount) || 0) * 0.035
      } else if (secondaryPaymentMethod === 'DEBIT') {
        cardFee += (parseFloat(secondaryPaymentAmount) || 0) * 0.01
      }
    }

    total += cardFee

    return { subtotal, customDiscountValue, totalDiscountValue, cardFee, total }
  }

  const handleProceedToReview = () => {
    if (!deliveryDate) {
      toast.error('Selecione a data de entrega/retirada')
      return
    }

    if (!paymentMethod) {
      toast.error('Selecione a forma de pagamento')
      return
    }

    if (secondaryPaymentMethod && secondaryPaymentMethod !== 'NONE') {
      const primary = parseFloat(primaryPaymentAmount) || 0
      const secondary = parseFloat(secondaryPaymentAmount) || 0
      const { total } = calculateTotals()

      if (Math.abs(primary + secondary - total) > 0.01) {
        toast.error('A soma dos pagamentos deve ser igual ao total')
        return
      }
    }

    if (paymentMethod === 'BOLETO') {
      const boletoAmount = secondaryPaymentMethod && secondaryPaymentMethod !== 'NONE'
        ? (parseFloat(primaryPaymentAmount) || 0)
        : calculateTotals().total

      if (selectedCustomer && selectedCustomer.availableCredit < boletoAmount) {
        toast.error(`Limite insuficiente. Disponível: R$ ${selectedCustomer.availableCredit.toFixed(2)}`)
        return
      }
    }

    const { total } = calculateTotals()
    const packageCount = cart.reduce((sum, item) => sum + item.quantity, 0)
    
    let deliveryTypeForRules: DeliveryType = 'pickup'
    if (deliveryType === 'DELIVERY') {
      deliveryTypeForRules = 'delivery_gurupi'
    }

    const summary = getOrderRulesSummary(
      deliveryTypeForRules,
      total,
      packageCount,
      new Date()
    )

    setRulesSummary(summary)
    setShowConfirmDialog(true)
  }

  const handleConfirmOrder = async () => {
    setSubmitting(true)
    setShowConfirmDialog(false)

    try {
      const { total } = calculateTotals()
      
      // Verificar se há nome de cliente casual salvo
      const casualCustomerName = localStorage.getItem('seller_order_casual_customer_name')
      
      // Verificar se é pedido próprio
      const isOwnOrder = localStorage.getItem('seller_order_is_own') === 'true'
      
      // 🔍 LOG DE DEBUG: Ver parcelamento sendo enviado
      console.log('[SELLER_CHECKOUT_SUBMIT] Dados do parcelamento:', {
        boletoInstallments,
        willSendToAPI: boletoInstallments && boletoInstallments !== 'avista' ? boletoInstallments : null,
        paymentMethod,
        customerHasInstallments: selectedCustomer?.allowInstallments,
        installmentOptions: selectedCustomer?.installmentOptions
      })

      const orderData = {
        items: cart.map(item => ({
          productId: item.productId,
          quantity: item.quantity
        })),
        customerId: selectedCustomer?.id === 'PARA_MIM' ? null : selectedCustomer?.id,
        casualCustomerName: casualCustomerName || null, // Nome para clientes casuais
        orderType: 'WHOLESALE',
        deliveryType: deliveryType,
        deliveryDate: deliveryDate,
        deliveryTime: deliveryType === 'DELIVERY' ? '16:00-18:00' : null,
        deliveryFee: rulesSummary?.totalFee || 0,
        paymentMethod: paymentMethod,
        secondaryPaymentMethod: secondaryPaymentMethod && secondaryPaymentMethod !== 'NONE' ? secondaryPaymentMethod : null,
        primaryPaymentAmount: secondaryPaymentMethod && secondaryPaymentMethod !== 'NONE' ? parseFloat(primaryPaymentAmount) : null,
        secondaryPaymentAmount: secondaryPaymentMethod && secondaryPaymentMethod !== 'NONE' ? parseFloat(secondaryPaymentAmount) : null,
        boletoInstallments: boletoInstallments && boletoInstallments !== 'avista' ? boletoInstallments : null,
        discountPercent: 0,
        discountAmount: 0,
        notes: notes,
        isOwnOrder: isOwnOrder  // Indica se é pedido próprio (sem comissão)
      }

      console.log('📦 Criando pedido:', { isOwnOrder, customerId: orderData.customerId })

      const res = await fetch('/api/sellers/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Erro ao criar pedido')
        return
      }

      localStorage.removeItem('seller_order_customer')
      localStorage.removeItem('seller_order_cart')
      localStorage.removeItem('seller_order_casual_customer_name')
      localStorage.removeItem('seller_order_is_own')

      toast.success('Pedido criado com sucesso!')
      
      // ✅ Pequeno delay antes do redirect para evitar erros de client-side durante a navegação
      setTimeout(() => {
        router.push('/seller/orders')
      }, 100)
    } catch (error) {
      console.error('Error creating order:', error)
      toast.error('Erro ao criar pedido')
    } finally {
      setSubmitting(false)
    }
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

  const { subtotal, customDiscountValue, totalDiscountValue, cardFee, total } = calculateTotals()
  const minDate = deliveryType === 'DELIVERY' ? getMinDeliveryDate() : getMinPickupDate()
  const warnings = deliveryType === 'DELIVERY' 
    ? getDeliveryWarnings(deliveryDate ? new Date(deliveryDate) : null)
    : getPickupWarnings(deliveryDate ? new Date(deliveryDate) : null)

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-amber-50">
        <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-sm">
          <div className="container mx-auto max-w-6xl flex h-16 items-center justify-between px-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => router.push('/seller/orders/new/select')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            
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
                Finalizar Pedido - Vendedor
              </h1>
            </div>
            
            <div className="w-20"></div>
          </div>
        </header>

        <div className="bg-white border-b">
          <div className="container mx-auto max-w-6xl px-4 py-4">
            <div className="flex items-center justify-center gap-4">
              <div className="flex items-center gap-2 text-gray-400">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-green-500 text-white">
                  ✓
                </div>
                <span className="font-medium hidden sm:inline">Cliente & Produtos</span>
              </div>
              <div className="w-12 h-0.5 bg-red-600" />
              <div className="flex items-center gap-2 text-red-600">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-red-600 text-white">
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
                    <CardTitle>Cliente</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="font-semibold">{selectedCustomer?.name}</p>
                      <p className="text-sm text-gray-600">{selectedCustomer?.email}</p>
                      <p className="text-sm text-gray-600">{selectedCustomer?.phone}</p>
                      <p className="text-sm text-gray-600">{selectedCustomer?.city}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Truck className="w-5 h-5 text-red-600" />
                      Detalhes da Entrega
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* 🆕 CONSUMIDOR FINAL: Venda de loja (sem opção de entrega/retirada) */}
                    {selectedCustomer?.customerType === 'CONSUMIDOR_FINAL' ? (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 flex items-center justify-center rounded-full bg-amber-100 text-amber-600 flex-shrink-0">
                            🏪
                          </div>
                          <div>
                            <h4 className="font-semibold text-amber-900 mb-1">Venda de Loja</h4>
                            <p className="text-sm text-amber-700">
                              Este é um cliente <strong>Consumidor Final</strong>. A venda é de balcão e o pedido já está marcado como entregue automaticamente.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <Label>Tipo</Label>
                        <RadioGroup value={deliveryType} onValueChange={(v: any) => setDeliveryType(v)}>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="DELIVERY" id="delivery" />
                            <Label htmlFor="delivery">Entrega</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="PICKUP" id="pickup" />
                            <Label htmlFor="pickup">Retirada</Label>
                          </div>
                        </RadioGroup>
                      </div>
                    )}

                    <div>
                      <Label htmlFor="deliveryDate">Data de {deliveryType === 'DELIVERY' ? 'Entrega' : 'Retirada'} *</Label>
                      <Input
                        id="deliveryDate"
                        type="date"
                        value={deliveryDate}
                        onChange={(e) => setDeliveryDate(e.target.value)}
                        min={formatDateForInput(minDate)}
                      />
                    </div>

                    {warnings.length > 0 && (
                      <div className="space-y-2">
                        {warnings.map((warning, idx) => (
                          <Alert key={idx}>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="text-xs">{warning}</AlertDescription>
                          </Alert>
                        ))}
                      </div>
                    )}

                    <div>
                      <Label htmlFor="notes">Observações</Label>
                      <Textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Observações adicionais..."
                        rows={3}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-red-600" />
                      Forma de Pagamento
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Método de Pagamento *</Label>
                      <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CASH">Dinheiro</SelectItem>
                          <SelectItem value="PIX">PIX</SelectItem>
                          <SelectItem value="DEBIT">Débito (+ 1% taxa)</SelectItem>
                          <SelectItem value="CREDIT_CARD">Crédito (+ 3,5% taxa)</SelectItem>
                          {selectedCustomer && selectedCustomer.availableCredit > 0 && (
                            <SelectItem value="BOLETO">Boleto</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {paymentMethod === 'BOLETO' && selectedCustomer?.allowInstallments && selectedCustomer?.installmentOptions && (
                      <div>
                        <Label>Parcelamento do Boleto</Label>
                        <Select value={boletoInstallments} onValueChange={setBoletoInstallments}>
                          <SelectTrigger className="border-orange-500">
                            <SelectValue placeholder="À vista" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="avista">À vista (1 boleto)</SelectItem>
                            {(() => {
                              const days = selectedCustomer.installmentOptions.split(',').map(d => d.trim()).filter(d => d)
                              const options = []
                              for (let i = 2; i <= days.length; i++) {
                                const selectedDays = days.slice(0, i)
                                const isMaxInstallments = i === days.length
                                options.push({
                                  value: `${i}x-${selectedDays.join('-')}`,
                                  label: `${i}x - ${selectedDays.join(', ')} dias${isMaxInstallments ? ' ⭐ (Padrão do Cliente)' : ''}`
                                })
                              }
                              return options.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))
                            })()}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-orange-600 mt-1">
                          ⚠️ Cliente configurado para parcelamento em {selectedCustomer.installmentOptions.split(',').length} vezes
                        </p>
                      </div>
                    )}

                    {paymentMethod && (
                      <div className="pt-4 border-t">
                        <Label className="mb-2 block">Pagamento Combinado (Opcional)</Label>
                        <div className="space-y-3">
                          <div>
                            <Label className="text-xs">Valor com {paymentMethod}</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={primaryPaymentAmount}
                              onChange={(e) => setPrimaryPaymentAmount(e.target.value)}
                              placeholder={formatCurrency(total)}
                            />
                          </div>
                          
                          <Select value={secondaryPaymentMethod} onValueChange={setSecondaryPaymentMethod}>
                            <SelectTrigger>
                              <SelectValue placeholder="+ Outro método" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="NONE">Nenhum</SelectItem>
                              <SelectItem value="CASH">Dinheiro</SelectItem>
                              <SelectItem value="PIX">PIX</SelectItem>
                              <SelectItem value="DEBIT">Débito</SelectItem>
                              <SelectItem value="CREDIT_CARD">Crédito</SelectItem>
                            </SelectContent>
                          </Select>

                          {secondaryPaymentMethod && secondaryPaymentMethod !== 'NONE' && (
                            <div>
                              <Label className="text-xs">Valor com {secondaryPaymentMethod}</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={secondaryPaymentAmount}
                                onChange={(e) => setSecondaryPaymentAmount(e.target.value)}
                                placeholder="R$ 0,00"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Button 
                  onClick={handleProceedToReview}
                  className="w-full h-12 bg-red-600 hover:bg-red-700"
                  disabled={!paymentMethod || !deliveryDate || submitting}
                >
                  Revisar e Confirmar Pedido
                </Button>
              </motion.div>
            </div>

            <div className="lg:sticky lg:top-24 h-fit">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-red-600" />
                    Resumo do Carrinho
                  </CardTitle>
                  <CardDescription>
                    {cart.length} {cart.length === 1 ? 'item' : 'itens'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
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
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Subtotal</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    
                    {customDiscountValue > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span className="flex items-center gap-1">
                          <Percent className="w-3 h-3" />
                          Desconto Cliente
                        </span>
                        <span>-{formatCurrency(customDiscountValue)}</span>
                      </div>
                    )}

                    {cardFee > 0 && (
                      <div className="flex justify-between text-sm text-orange-600">
                        <span className="flex items-center gap-1">
                          <CreditCard className="w-3 h-3" />
                          Taxa de cartão
                        </span>
                        <span>+{formatCurrency(cardFee)}</span>
                      </div>
                    )}

                    <Separator />

                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span className="text-red-600">{formatCurrency(total)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>

      {rulesSummary && (
        <OrderConfirmationDialog
          open={showConfirmDialog}
          onOpenChange={setShowConfirmDialog}
          onConfirm={handleConfirmOrder}
          rulesSummary={rulesSummary}
          totalValue={total}
          isLoading={submitting}
        />
      )}
    </>
  )
}
