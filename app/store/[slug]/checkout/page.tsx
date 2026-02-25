'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { 
  ShoppingCart, 
  ArrowLeft, 
  Loader2,
  CreditCard,
  Banknote,
  Wallet,
  Star,
  CheckCircle2,
  Package
} from 'lucide-react'
import { toast } from 'sonner'

interface Product {
  id: string
  name: string
  description: string | null
  unitPrice: number
  imageUrl: string | null
  measurementUnit: string
}

interface CartItem {
  product: Product
  quantity: number
}

interface ClientCustomer {
  id: string
  name: string
  phone: string
  email: string | null
  pointsBalance: number
  pointsMultiplier: number
}

export default function CheckoutPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [customer, setCustomer] = useState<ClientCustomer | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [orderCreated, setOrderCreated] = useState(false)

  // Dados do pedido
  const [paymentMethod, setPaymentMethod] = useState('PIX')
  const [notes, setNotes] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')

  // 🎟️ Estados do Cupom de Desconto
  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null)
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [isCouponValidating, setIsCouponValidating] = useState(false)

  useEffect(() => {
    loadData()
  }, [slug])

  const loadData = async () => {
    try {
      setIsLoading(true)

      // Verificar autenticação
      const authData = localStorage.getItem(`publicAuth_${slug}`)
      if (!authData) {
        toast.error('Faça login para continuar')
        router.push(`/store/${slug}/auth`)
        return
      }

      const customerData = JSON.parse(authData)
      setCustomer(customerData)

      // Carregar produtos do catálogo
      const response = await fetch(`/api/public/store/${slug}/catalog`)
      if (!response.ok) {
        throw new Error('Erro ao carregar produtos')
      }

      const data = await response.json()
      setProducts(data.products || [])

      // Carregar carrinho
      const cartData = localStorage.getItem(`publicCart_${slug}`)
      console.log('[CHECKOUT] CartData do localStorage:', cartData)
      
      if (!cartData) {
        toast.error('Carrinho vazio')
        router.push(`/store/${slug}`)
        return
      }

      const cart = JSON.parse(cartData)
      console.log('[CHECKOUT] Cart parseado:', cart)
      console.log('[CHECKOUT] Produtos carregados da API:', data.products?.length || 0)
      
      const items: CartItem[] = Object.entries(cart)
        .map(([productId, quantity]) => {
          const product = data.products.find((p: Product) => p.id === productId)
          if (!product) {
            console.warn('[CHECKOUT] Produto não encontrado na API:', productId)
            return null
          }
          console.log('[CHECKOUT] Produto encontrado:', product.name, 'quantidade:', quantity)
          return { product, quantity: quantity as number }
        })
        .filter((item): item is CartItem => item !== null)

      console.log('[CHECKOUT] Items mapeados:', items.length)

      if (items.length === 0) {
        toast.error('Os produtos do carrinho não estão mais disponíveis. Por favor, adicione novos produtos.')
        router.push(`/store/${slug}`)
        return
      }

      setCartItems(items)

    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      toast.error('Erro ao carregar dados do checkout')
    } finally {
      setIsLoading(false)
    }
  }

  const calculateSubtotal = () => {
    return cartItems.reduce((sum, item) => {
      return sum + (item.product.unitPrice * item.quantity)
    }, 0)
  }

  const calculatePointsToEarn = () => {
    const subtotal = calculateSubtotal()
    const multiplier = customer?.pointsMultiplier || 1
    // 1 ponto para cada R$ 1 gasto
    return Math.floor(subtotal * multiplier)
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
      const subtotal = calculateSubtotal()

      const response = await fetch('/api/admin/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.toUpperCase(),
          customerId: customer?.id || null,
          orderTotal: subtotal,
          orderItems: cartItems.map(item => ({
            productId: item.product.id,
            quantity: item.quantity
          }))
        })
      })

      const data = await response.json()

      if (data.valid) {
        setAppliedCoupon(data.coupon)
        setCouponDiscount(data.discountAmount)
        toast.success(`✅ Cupom aplicado! Desconto de ${formatCurrency(data.discountAmount)}`)
      } else {
        setAppliedCoupon(null)
        setCouponDiscount(0)
        toast.error(data.error || "Cupom inválido")
      }
    } catch (error) {
      console.error('Error validating coupon:', error)
      setAppliedCoupon(null)
      setCouponDiscount(0)
      toast.error("Não foi possível validar o cupom")
    } finally {
      setIsCouponValidating(false)
    }
  }

  // 🎟️ Remover Cupom de Desconto
  const removeCoupon = () => {
    setCouponCode('')
    setAppliedCoupon(null)
    setCouponDiscount(0)
    toast.success("Cupom removido")
  }

  const handleSubmitOrder = async () => {
    if (!customer) {
      toast.error('Dados do cliente não encontrados')
      return
    }

    if (!paymentMethod) {
      toast.error('Selecione uma forma de pagamento')
      return
    }

    setIsSubmitting(true)

    try {
      const orderData: any = {
        clientCustomerId: customer.id,
        items: cartItems.map(item => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: item.product.unitPrice
        })),
        paymentMethod,
        notes: notes || undefined,
        deliveryAddress: deliveryAddress || undefined
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

      const response = await fetch(`/api/public/store/${slug}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || 'Erro ao criar pedido')
        return
      }

      // Limpar carrinho
      localStorage.removeItem(`publicCart_${slug}`)

      // Atualizar pontos do cliente no localStorage
      if (customer) {
        const updatedCustomer = {
          ...customer,
          pointsBalance: customer.pointsBalance + calculatePointsToEarn()
        }
        localStorage.setItem(`publicAuth_${slug}`, JSON.stringify(updatedCustomer))
      }

      setOrderCreated(true)
      toast.success('Pedido realizado com sucesso!')

    } catch (error) {
      console.error('Erro ao criar pedido:', error)
      toast.error('Erro ao processar pedido. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-orange-600 animate-spin mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-700">Carregando checkout...</p>
        </div>
      </div>
    )
  }

  if (orderCreated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50 p-4">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <div className="bg-green-100 p-4 rounded-full">
                <CheckCircle2 className="w-16 h-16 text-green-600" />
              </div>
            </div>
            <CardTitle className="text-2xl text-green-700">Pedido Realizado!</CardTitle>
            <CardDescription>
              Seu pedido foi recebido e está sendo processado
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="flex items-center justify-center gap-2 text-orange-700">
                <Star className="w-5 h-5 fill-current" />
                <span className="font-bold text-lg">
                  +{calculatePointsToEarn()} pontos ganhos!
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Saldo atual: {customer ? customer.pointsBalance + calculatePointsToEarn() : 0} pontos
              </p>
            </div>

            <div className="space-y-2">
              <Button
                onClick={() => router.push(`/store/${slug}`)}
                className="w-full bg-orange-600 hover:bg-orange-700"
              >
                Voltar para a loja
              </Button>
              <Button
                onClick={() => router.push(`/store/${slug}/account`)}
                variant="outline"
                className="w-full"
              >
                Ver meus pedidos
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Button
            onClick={() => router.push(`/store/${slug}`)}
            variant="ghost"
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para a loja
          </Button>
          <h1 className="text-3xl font-bold text-gray-800">Finalizar Pedido</h1>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Coluna Principal - Formulário */}
          <div className="lg:col-span-2 space-y-6">
            {/* Informações do Cliente */}
            <Card>
              <CardHeader>
                <CardTitle>Dados do Cliente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-sm text-gray-600">Nome</p>
                  <p className="font-medium">{customer?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Telefone</p>
                  <p className="font-medium">{customer?.phone}</p>
                </div>
                {customer?.email && (
                  <div>
                    <p className="text-sm text-gray-600">E-mail</p>
                    <p className="font-medium">{customer.email}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Forma de Pagamento */}
            <Card>
              <CardHeader>
                <CardTitle>Forma de Pagamento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>Selecione o método de pagamento</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PIX">
                        <div className="flex items-center gap-2">
                          <Wallet className="w-4 h-4" />
                          PIX
                        </div>
                      </SelectItem>
                      <SelectItem value="DINHEIRO">
                        <div className="flex items-center gap-2">
                          <Banknote className="w-4 h-4" />
                          Dinheiro
                        </div>
                      </SelectItem>
                      <SelectItem value="CARTAO_CREDITO">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4" />
                          Cartão de Crédito
                        </div>
                      </SelectItem>
                      <SelectItem value="CARTAO_DEBITO">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4" />
                          Cartão de Débito
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* 🎟️ Cupom de Desconto */}
            <Card>
              <CardHeader>
                <CardTitle>Cupom de Desconto (Opcional)</CardTitle>
              </CardHeader>
              <CardContent>
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
                    >
                      {isCouponValidating ? 'Validando...' : 'Aplicar'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Endereço de Entrega (Opcional) */}
            <Card>
              <CardHeader>
                <CardTitle>Endereço de Entrega (Opcional)</CardTitle>
                <CardDescription>
                  Informe o endereço se desejar entrega
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Rua, número, bairro, complemento..."
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  rows={3}
                />
              </CardContent>
            </Card>

            {/* Observações */}
            <Card>
              <CardHeader>
                <CardTitle>Observações (Opcional)</CardTitle>
                <CardDescription>
                  Adicione informações adicionais sobre o pedido
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Exemplo: retirada às 18h, sem cebola, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </CardContent>
            </Card>
          </div>

          {/* Coluna Lateral - Resumo */}
          <div className="lg:col-span-1">
            <div className="sticky top-4 space-y-6">
              {/* Resumo do Pedido */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5" />
                    Resumo do Pedido
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Lista de Produtos */}
                  <div className="space-y-3">
                    {cartItems.map((item) => (
                      <div key={item.product.id} className="flex gap-3">
                        <div className="relative w-16 h-16 flex-shrink-0 rounded-md overflow-hidden bg-gray-100">
                          <Image
                            src={item.product.imageUrl || '/placeholder-product.jpg'}
                            alt={item.product.name}
                            fill
                            className="object-cover"
                            sizes="64px"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.product.name}</p>
                          <p className="text-xs text-gray-500">
                            {item.quantity}x R$ {item.product.unitPrice.toFixed(2)}
                          </p>
                          <p className="text-sm font-bold text-orange-600">
                            R$ {(item.product.unitPrice * item.quantity).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  {/* Totais */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="font-medium">R$ {calculateSubtotal().toFixed(2)}</span>
                    </div>
                    
                    {/* Mostrar desconto do cupom se aplicado */}
                    {appliedCoupon && couponDiscount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600">🎟️ Desconto (Cupom)</span>
                        <span className="font-semibold text-green-600">-{formatCurrency(couponDiscount)}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span className="text-orange-600">
                        R$ {(calculateSubtotal() - couponDiscount).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <Separator />

                  {/* Pontos */}
                  <div className="bg-orange-50 p-3 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Star className="w-5 h-5 text-orange-600 fill-current" />
                        <span className="text-sm font-medium">Pontos a ganhar</span>
                      </div>
                      <span className="text-lg font-bold text-orange-600">
                        +{calculatePointsToEarn()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      Saldo atual: {customer?.pointsBalance || 0} pontos
                    </p>
                  </div>

                  {/* Botão Finalizar */}
                  <Button
                    onClick={handleSubmitOrder}
                    disabled={isSubmitting}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white h-12 text-base"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5 mr-2" />
                        Finalizar Pedido
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
