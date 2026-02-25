
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { 
  ArrowLeft, 
  CheckCircle, 
  FileText, 
  Receipt, 
  Printer,
  Download,
  ExternalLink,
  Calendar,
  MapPin,
  Phone,
  CreditCard,
  Package
} from 'lucide-react'
import { PaymentTracker } from '../_components/payment-tracker'

interface Order {
  id: string
  orderNumber: string
  customerName: string
  customerPhone: string | null
  customerEmail: string | null
  address: string | null
  city: string | null
  orderType: string
  deliveryType: string
  deliveryDate: string | null
  deliveryTime: string | null
  paymentMethod: string
  secondaryPaymentMethod: string | null
  primaryPaymentAmount: number | null
  secondaryPaymentAmount: number | null
  status: string
  subtotal: number
  discount: number
  discountPercent: number
  cardFee: number
  total: number
  notes: string | null
  createdAt: string
  orderItems: Array<{
    id: string
    quantity: number
    unitPrice: number
    total: number
    isGift: boolean
    product: {
      id: string
      name: string
      description: string
    }
  }>
}

interface Boleto {
  id: string
  boletoNumber: string
  amount: number
  dueDate: string
  status: string
  isInstallment: boolean
  installmentNumber: number | null
  totalInstallments: number | null
  pixQrCode: string | null
  pixQrCodeBase64: string | null
}

export default function OrderConfirmationPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params?.id as string

  const [order, setOrder] = useState<Order | null>(null)
  const [boletos, setBoletos] = useState<Boleto[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (orderId) {
      fetchOrderData()
    }
  }, [orderId])

  const fetchOrderData = async () => {
    try {
      // Buscar pedido
      const orderRes = await fetch(`/api/orders/${orderId}`)
      if (!orderRes.ok) throw new Error('Erro ao buscar pedido')
      const orderData = await orderRes.json()
      setOrder(orderData)

      // Buscar boletos relacionados ao pedido
      if (orderData.paymentMethod === 'BOLETO' || orderData.secondaryPaymentMethod === 'BOLETO') {
        const boletosRes = await fetch(`/api/boletos?orderId=${orderId}`)
        if (boletosRes.ok) {
          const boletosData = await boletosRes.json()
          setBoletos(boletosData)
        }
      }
    } catch (error) {
      console.error('Error fetching order:', error)
      toast.error('Erro ao carregar dados do pedido')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getPaymentMethodText = (method: string) => {
    const methods: Record<string, string> = {
      CASH: 'Dinheiro',
      PIX: 'PIX',
      DEBIT: 'Débito',
      CREDIT_CARD: 'Crédito',
      BOLETO: 'Boleto'
    }
    return methods[method] || method
  }

  const handlePrintReceipt = () => {
    window.open(`/api/orders/${orderId}/receipt`, '_blank')
  }

  const handleViewBoleto = (boletoId: string) => {
    window.open(`/api/boletos/${boletoId}/view`, '_blank')
  }

  const handleSendWhatsApp = () => {
    if (!order) return
    
    const phone = order.customerPhone?.replace(/\D/g, '') || ''
    let message = `🍢 *[SUA EMPRESA]*\n\n✅ Pedido Confirmado!\n\n📋 *Número:* ${order.orderNumber}\n💰 *Total:* ${formatCurrency(order.total)}`
    
    if (order.deliveryDate) {
      message += `\n📅 *${order.deliveryType === 'DELIVERY' ? 'Entrega' : 'Retirada'}:* ${new Date(order.deliveryDate).toLocaleDateString('pt-BR')}`
    }
    
    if (boletos.length > 0) {
      message += `\n\n📄 *Boleto(s) gerado(s):*`
      boletos.forEach(boleto => {
        message += `\n• ${boleto.boletoNumber}`
        if (boleto.isInstallment) {
          message += ` (Parcela ${boleto.installmentNumber}/${boleto.totalInstallments})`
        }
        message += ` - ${formatCurrency(boleto.amount)}`
        message += `\n  Vence em: ${new Date(boleto.dueDate).toLocaleDateString('pt-BR')}`
      })
    }
    
    message += `\n\nObrigado pela preferência! 🙏`
    
    const whatsappUrl = `https://wa.me/55${phone}?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, '_blank')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg text-muted-foreground">Pedido não encontrado</p>
          <Link href="/admin/orders">
            <Button className="mt-4">Voltar para Pedidos</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <Link href="/admin/orders">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </Link>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/admin/orders/new')}>
              Criar Novo Pedido
            </Button>
            <Link href="/admin">
              <Button variant="outline">Dashboard</Button>
            </Link>
          </div>
        </div>

        {/* Success Message */}
        <Card className="mb-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0">
          <CardContent className="pt-6 pb-6">
            <div className="flex items-center gap-4">
              <CheckCircle className="h-16 w-16" />
              <div>
                <h1 className="text-3xl font-bold mb-2">Pedido Criado com Sucesso!</h1>
                <p className="text-green-50 text-lg">
                  Número do Pedido: <strong>#{order.orderNumber}</strong>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Ações Rápidas */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Printer className="h-5 w-5" />
                  Ações Rápidas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  className="w-full" 
                  variant="default"
                  onClick={handlePrintReceipt}
                >
                  <Receipt className="h-4 w-4 mr-2" />
                  Imprimir Cupom
                </Button>
                
                {boletos.length > 0 && (
                  <>
                    <Separator />
                    <p className="text-sm text-muted-foreground">Boletos disponíveis:</p>
                    {boletos.map((boleto) => (
                      <Button
                        key={boleto.id}
                        className="w-full"
                        variant="outline"
                        onClick={() => handleViewBoleto(boleto.id)}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        {boleto.isInstallment 
                          ? `Parcela ${boleto.installmentNumber}/${boleto.totalInstallments}`
                          : 'Ver Boleto'
                        }
                      </Button>
                    ))}
                  </>
                )}
                
                <Separator />
                
                {order.customerPhone && (
                  <Button 
                    className="w-full" 
                    variant="outline"
                    onClick={handleSendWhatsApp}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Enviar por WhatsApp
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Informações do Cliente */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Cliente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="font-semibold">{order.customerName}</p>
                {order.customerPhone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {order.customerPhone}
                  </div>
                )}
                {order.city && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {order.city}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Detalhes do Pedido */}
          <div className="lg:col-span-2 space-y-4">
            {/* Informações Gerais */}
            <Card>
              <CardHeader>
                <CardTitle>Detalhes do Pedido</CardTitle>
                <CardDescription>
                  Criado em {formatDate(order.createdAt)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Tipo de Pedido</p>
                    <p className="font-medium">
                      {order.orderType === 'WHOLESALE' ? 'Atacado' : 'Varejo'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tipo de Entrega</p>
                    <p className="font-medium">
                      {order.deliveryType === 'DELIVERY' ? 'Entrega' : 'Retirada'}
                    </p>
                  </div>
                  {order.deliveryDate && (
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Data de {order.deliveryType === 'DELIVERY' ? 'Entrega' : 'Retirada'}
                      </p>
                      <p className="font-medium">
                        {new Date(order.deliveryDate).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  )}
                  {order.deliveryTime && (
                    <div>
                      <p className="text-sm text-muted-foreground">Horário</p>
                      <p className="font-medium">{order.deliveryTime}</p>
                    </div>
                  )}
                </div>
                
                {order.deliveryType === 'DELIVERY' && order.address && (
                  <div>
                    <p className="text-sm text-muted-foreground">Endereço de Entrega</p>
                    <p className="font-medium">{order.address}</p>
                  </div>
                )}
                
                {order.notes && (
                  <div>
                    <p className="text-sm text-muted-foreground">Observações</p>
                    <p className="font-medium">{order.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Controle de Pagamentos - apenas para Crediário */}
            {order.paymentMethod === 'CREDIT' && (
              <PaymentTracker orderId={order.id} />
            )}

            {/* Itens do Pedido */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Itens do Pedido
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {order.orderItems.map((item) => (
                    <div key={item.id} className="flex justify-between items-start p-3 bg-muted/50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{item.product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.quantity}x {formatCurrency(item.unitPrice)}
                          {item.isGift && <Badge className="ml-2" variant="secondary">Brinde</Badge>}
                        </p>
                      </div>
                      <p className="font-bold">{formatCurrency(item.total)}</p>
                    </div>
                  ))}
                </div>

                <Separator className="my-4" />

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>{formatCurrency(order.subtotal)}</span>
                  </div>
                  {order.discount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Desconto {order.discountPercent ? `(${order.discountPercent}%)` : ''}:</span>
                      <span>- {formatCurrency(order.discount)}</span>
                    </div>
                  )}
                  {order.cardFee > 0 && (
                    <div className="flex justify-between text-sm text-orange-600">
                      <span>Taxa de Cartão:</span>
                      <span>+ {formatCurrency(order.cardFee)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span className="text-green-600">{formatCurrency(order.total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pagamento */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Pagamento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Método Principal:</span>
                  <span className="font-medium">{getPaymentMethodText(order.paymentMethod)}</span>
                </div>
                {order.secondaryPaymentMethod && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Método Secundário:</span>
                      <span className="font-medium">{getPaymentMethodText(order.secondaryPaymentMethod)}</span>
                    </div>
                    {order.primaryPaymentAmount !== null && (
                      <div className="flex justify-between text-sm">
                        <span>Valor Método 1:</span>
                        <span>{formatCurrency(order.primaryPaymentAmount)}</span>
                      </div>
                    )}
                    {order.secondaryPaymentAmount !== null && (
                      <div className="flex justify-between text-sm">
                        <span>Valor Método 2:</span>
                        <span>{formatCurrency(order.secondaryPaymentAmount)}</span>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Informações dos Boletos */}
            {boletos.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Boletos Gerados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {boletos.map((boleto) => (
                      <div key={boleto.id} className="p-3 bg-muted/50 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-medium">{boleto.boletoNumber}</p>
                            {boleto.isInstallment && (
                              <Badge variant="secondary" className="mt-1">
                                Parcela {boleto.installmentNumber}/{boleto.totalInstallments}
                              </Badge>
                            )}
                          </div>
                          <p className="font-bold text-green-600">
                            {formatCurrency(boleto.amount)}
                          </p>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">
                            Vencimento: {new Date(boleto.dueDate).toLocaleDateString('pt-BR')}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewBoleto(boleto.id)}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Ver/Imprimir
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
