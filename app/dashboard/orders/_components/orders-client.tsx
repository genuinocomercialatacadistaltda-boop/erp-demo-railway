
'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Package, 
  Calendar, 
  Clock, 
  MapPin, 
  DollarSign,
  ArrowLeft,
  LogOut,
  Bell,
  Home,
  ChevronDown,
  ChevronUp,
  FileText,
  Copy,
  Download,
  QrCode,
  Barcode,
  MessageCircle,
  PhoneCall
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { HomeButton } from '@/components/home-button'

interface OrdersClientProps {
  customer: any
  orders: any[]
  userName: string
}

export function OrdersClient({ customer, orders, userName }: OrdersClientProps) {
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  }

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getOrderStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      CONFIRMED: 'bg-blue-100 text-blue-800 border-blue-200',
      PREPARING: 'bg-orange-100 text-orange-800 border-orange-200',
      READY: 'bg-green-100 text-green-800 border-green-200',
      DELIVERING: 'bg-purple-100 text-purple-800 border-purple-200',
      DELIVERED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      CANCELLED: 'bg-red-100 text-red-800 border-red-200'
    }
    return statusColors[status] || 'bg-gray-100 text-gray-800 border-gray-200'
  }

  const getOrderStatusText = (status: string) => {
    const statusText: Record<string, string> = {
      PENDING: 'Pendente',
      CONFIRMED: 'Confirmado',
      PREPARING: 'Preparando',
      READY: 'Pronto',
      DELIVERING: 'Entregando',
      DELIVERED: 'Entregue',
      CANCELLED: 'Cancelado'
    }
    return statusText[status] || status
  }

  const getDeliveryTypeText = (type: string) => {
    return type === 'DELIVERY' ? 'Entrega' : 'Retirada'
  }

  const getPaymentMethodText = (method: string) => {
    const methods: Record<string, string> = {
      CASH: 'Dinheiro',
      CARD: 'Cartão',
      CREDIT_CARD: 'Cartão de Crédito',
      DEBIT: 'Débito',
      PIX: 'PIX',
      BOLETO: 'Boleto',
      CREDIT: 'Crédito (30 dias)'
    }
    return methods[method] || method
  }

  const toggleOrderExpansion = (orderId: string) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId)
  }

  const copyPixCode = (pixCode: string) => {
    navigator.clipboard.writeText(pixCode)
    toast.success('Código PIX copiado!', {
      description: 'Cole no app do seu banco para pagar'
    })
  }

  const downloadBoletoBarcode = (barcode: string, boletoNumber: string) => {
    navigator.clipboard.writeText(barcode)
    toast.success('Código de barras copiado!', {
      description: 'Cole no app do seu banco para pagar o boleto'
    })
  }

  const openWhatsApp = (orderNumber: string) => {
    const phoneNumber = '55[SEU-DDD][SEU-NUMERO]'
    const message = `Olá! Gostaria de solicitar o cancelamento do pedido #${orderNumber}.`
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, '_blank')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-amber-50">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto max-w-7xl flex h-16 items-center justify-between px-4">
          <Link href="/dashboard" className="flex items-center space-x-3">
            <div className="relative w-12 h-12 rounded-lg overflow-hidden">
              <Image 
                src="/logo.jpg" 
                alt="[SUA EMPRESA]" 
                fill 
                className="object-contain"
                priority
              />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">[SUA EMPRESA]</h1>
              <p className="text-xs text-gray-600">Meus Pedidos</p>
            </div>
          </Link>
          
          <div className="flex items-center space-x-4">
            <HomeButton />
            
            <Link href="/dashboard/notifications">
              <Button variant="ghost" size="sm">
                <Bell className="w-5 h-5" />
              </Button>
            </Link>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => signOut({ callbackUrl: '/' })}
              className="flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto max-w-7xl px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="mb-4">
            <HomeButton />
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Meus Pedidos
          </h1>
          <p className="text-lg text-gray-600">
            Acompanhe todos os seus pedidos realizados
          </p>
        </div>

        {/* Orders List */}
        {orders.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Nenhum pedido encontrado
              </h3>
              <p className="text-gray-600 mb-6">
                Você ainda não fez nenhum pedido. Que tal fazer o primeiro?
              </p>
              <Link href="/dashboard/catalog">
                <Button className="bg-red-600 hover:bg-red-700">
                  Fazer Pedido
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="shadow-lg hover:shadow-xl transition-shadow">
                  <CardHeader className="cursor-pointer" onClick={() => toggleOrderExpansion(order.id)}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <CardTitle className="text-xl">
                            Pedido #{order.orderNumber}
                          </CardTitle>
                          <Badge className={getOrderStatusColor(order.status) + ' border'}>
                            {getOrderStatusText(order.status)}
                          </Badge>
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>{formatDate(order.createdAt)}</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span>{formatTime(order.createdAt)}</span>
                          </div>
                          
                          {order.deliveryDate && (
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4" />
                              <span>
                                {getDeliveryTypeText(order.deliveryType)} - {formatDate(order.deliveryDate)}
                                {order.deliveryTime && ` às ${order.deliveryTime}`}
                              </span>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4" />
                            <span className="font-semibold text-gray-900">
                              {formatCurrency(Number(order.total))}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <Button variant="ghost" size="sm">
                        {expandedOrder === order.id ? (
                          <ChevronUp className="w-5 h-5" />
                        ) : (
                          <ChevronDown className="w-5 h-5" />
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  
                  <AnimatePresence>
                    {expandedOrder === order.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <CardContent className="border-t pt-6">
                          {/* Order Details */}
                          <div className="space-y-6">
                            {/* Items */}
                            <div>
                              <h4 className="font-semibold text-gray-900 mb-3">Itens do Pedido</h4>
                              <div className="space-y-2">
                                {order.OrderItem && order.OrderItem.map((item: any) => (
                                  <div 
                                    key={item.id} 
                                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="relative w-12 h-12 rounded overflow-hidden">
                                        <Image
                                          src={item.Product.imageUrl || '/logo.jpg'}
                                          alt={item.Product.name}
                                          fill
                                          className="object-cover"
                                        />
                                      </div>
                                      <div>
                                        <p className="font-medium text-gray-900">{item.Product.name}</p>
                                        <p className="text-sm text-gray-600">
                                          {item.quantity}x {formatCurrency(Number(item.unitPrice))}
                                        </p>
                                      </div>
                                    </div>
                                    <p className="font-semibold text-gray-900">
                                      {formatCurrency(Number(item.total))}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                            
                            {/* Payment & Delivery Info */}
                            <div className="grid md:grid-cols-2 gap-6">
                              <div className="space-y-2">
                                <h4 className="font-semibold text-gray-900">Informações de Pagamento</h4>
                                <div className="p-3 bg-gray-50 rounded-lg space-y-1 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Subtotal:</span>
                                    <span className="font-medium">{formatCurrency(Number(order.subtotal))}</span>
                                  </div>
                                  {Number(order.discount) > 0 && (
                                    <div className="flex justify-between text-green-600">
                                      <span>Desconto:</span>
                                      <span className="font-medium">-{formatCurrency(Number(order.discount))}</span>
                                    </div>
                                  )}
                                  {Number(order.cardFee) > 0 && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Taxa do Cartão:</span>
                                      <span className="font-medium">{formatCurrency(Number(order.cardFee))}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between pt-2 border-t border-gray-200">
                                    <span className="font-semibold text-gray-900">Total:</span>
                                    <span className="font-bold text-gray-900">{formatCurrency(Number(order.total))}</span>
                                  </div>
                                  <div className="flex justify-between pt-2">
                                    <span className="text-gray-600">Forma de Pagamento:</span>
                                    <span className="font-medium">{getPaymentMethodText(order.paymentMethod)}</span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <h4 className="font-semibold text-gray-900">Informações de Entrega</h4>
                                <div className="p-3 bg-gray-50 rounded-lg space-y-1 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Tipo:</span>
                                    <span className="font-medium">{getDeliveryTypeText(order.deliveryType)}</span>
                                  </div>
                                  {order.deliveryDate && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Data:</span>
                                      <span className="font-medium">{formatDate(order.deliveryDate)}</span>
                                    </div>
                                  )}
                                  {order.deliveryTime && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Horário:</span>
                                      <span className="font-medium">{order.deliveryTime}</span>
                                    </div>
                                  )}
                                  {order.address && (
                                    <div className="pt-2 border-t border-gray-200">
                                      <p className="text-gray-600 mb-1">Endereço:</p>
                                      <p className="font-medium">{order.address}, {order.city}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {/* Cancelamento / Suporte */}
                            <div className="mt-6 pt-6 border-t">
                              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-orange-200 rounded-lg p-5">
                                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                                  <div className="flex-1 text-center md:text-left">
                                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center justify-center md:justify-start gap-2">
                                      <MessageCircle className="w-5 h-5 text-orange-600" />
                                      Precisa cancelar este pedido?
                                    </h4>
                                    <p className="text-sm text-gray-600 mb-1">
                                      Entre em contato com nosso suporte pelo WhatsApp
                                    </p>
                                    <p className="text-xs text-gray-500 flex items-center justify-center md:justify-start gap-1">
                                      <PhoneCall className="w-3 h-3" />
                                      <span className="font-medium">[SEU TELEFONE]</span>
                                    </p>
                                  </div>
                                  <Button
                                    onClick={() => openWhatsApp(order.orderNumber)}
                                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 h-auto"
                                  >
                                    <MessageCircle className="w-5 h-5 mr-2" />
                                    Falar com Suporte
                                  </Button>
                                </div>
                              </div>
                            </div>
                            
                            {/* Boletos / PIX Payment */}
                            {order.Boleto && order.Boleto.length > 0 && (
                              <div className="mt-6 pt-6 border-t">
                                <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                  <FileText className="w-5 h-5 text-green-600" />
                                  Boleto(s) / PIX Gerados
                                </h4>
                                
                                <div className="space-y-4">
                                  {order.Boleto.map((boleto: any) => (
                                    <div key={boleto.id} className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-2 border-green-200">
                                      <div className="flex items-start justify-between mb-3">
                                        <div>
                                          <h5 className="font-semibold text-gray-900">
                                            Boleto {boleto.boletoNumber}
                                            {boleto.isInstallment && (
                                              <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                                                Parcela {boleto.installmentNumber}/{boleto.totalInstallments}
                                              </span>
                                            )}
                                          </h5>
                                          <div className="mt-1 space-y-1 text-sm">
                                            <p className="text-gray-600">
                                              <span className="font-medium">Valor:</span> {formatCurrency(Number(boleto.amount))}
                                            </p>
                                            <p className="text-gray-600">
                                              <span className="font-medium">Vencimento:</span> {formatDate(boleto.dueDate)}
                                            </p>
                                            <p className="text-gray-600">
                                              <span className="font-medium">Status:</span>{' '}
                                              <Badge variant={boleto.status === 'PAID' ? 'default' : 'outline'}>
                                                {boleto.status === 'PENDING' ? 'Pendente' : 
                                                 boleto.status === 'PAID' ? 'Pago' : 
                                                 boleto.status === 'OVERDUE' ? 'Vencido' : 
                                                 boleto.status}
                                              </Badge>
                                            </p>
                                          </div>
                                        </div>
                                      </div>

                                      {/* PIX QR Code */}
                                      {boleto.pixQrCode && boleto.pixQrCodeBase64 && (
                                        <div className="mt-4 p-4 bg-white rounded-lg border border-green-300">
                                          <div className="flex items-center gap-2 mb-3">
                                            <QrCode className="w-5 h-5 text-green-600" />
                                            <h6 className="font-semibold text-gray-900">Pagar com PIX</h6>
                                          </div>
                                          
                                          <div className="flex flex-col md:flex-row gap-4 items-center">
                                            {/* QR Code Image */}
                                            <div className="relative w-48 h-48 bg-white p-2 rounded border-2 border-green-500">
                                              <Image
                                                src={`data:image/png;base64,${boleto.pixQrCodeBase64}`}
                                                alt="QR Code PIX"
                                                fill
                                                className="object-contain"
                                              />
                                            </div>
                                            
                                            {/* PIX Code */}
                                            <div className="flex-1">
                                              <p className="text-sm text-gray-600 mb-2">
                                                📱 <strong>Opção 1:</strong> Escaneie o QR Code acima com o app do seu banco
                                              </p>
                                              <p className="text-sm text-gray-600 mb-3">
                                                📋 <strong>Opção 2:</strong> Copie o código PIX abaixo (PIX Copia e Cola)
                                              </p>
                                              
                                              <div className="relative">
                                                <textarea
                                                  readOnly
                                                  value={boleto.pixQrCode}
                                                  className="w-full h-24 p-3 text-xs font-mono bg-gray-50 border border-gray-300 rounded resize-none"
                                                />
                                              </div>
                                              
                                              <Button
                                                onClick={() => copyPixCode(boleto.pixQrCode)}
                                                className="w-full mt-3 bg-green-600 hover:bg-green-700"
                                              >
                                                <Copy className="w-4 h-4 mr-2" />
                                                Copiar Código PIX
                                              </Button>
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      {/* Barcode / Boleto */}
                                      {boleto.barcodeNumber && (
                                        <div className="mt-4 p-4 bg-white rounded-lg border border-blue-300">
                                          <div className="flex items-center gap-2 mb-3">
                                            <Barcode className="w-5 h-5 text-blue-600" />
                                            <h6 className="font-semibold text-gray-900">Pagar com Código de Barras</h6>
                                          </div>
                                          
                                          <div className="space-y-3">
                                            <div>
                                              <p className="text-sm text-gray-600 mb-2">Linha digitável:</p>
                                              <div className="p-3 bg-gray-50 rounded border font-mono text-sm break-all">
                                                {boleto.digitableLine || boleto.barcodeNumber}
                                              </div>
                                            </div>
                                            
                                            <Button
                                              onClick={() => downloadBoletoBarcode(boleto.digitableLine || boleto.barcodeNumber, boleto.boletoNumber)}
                                              variant="outline"
                                              className="w-full border-blue-600 text-blue-600 hover:bg-blue-50"
                                            >
                                              <Copy className="w-4 h-4 mr-2" />
                                              Copiar Código de Barras
                                            </Button>
                                          </div>
                                        </div>
                                      )}

                                      {/* URL do Boleto Asaas */}
                                      {boleto.boletoUrl && (
                                        <div className="mt-3">
                                          <Button
                                            onClick={() => window.open(boleto.boletoUrl, '_blank')}
                                            className="w-full bg-red-600 hover:bg-red-700"
                                          >
                                            <Download className="w-4 h-4 mr-2" />
                                            Visualizar/Imprimir Boleto Completo
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>

                                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                  <p className="text-sm text-blue-800">
                                    💡 <strong>Dica:</strong> Você pode pagar via PIX (instantâneo) ou usar o código de barras no app do seu banco. 
                                    Após o pagamento, envie o comprovante pelo WhatsApp para confirmação mais rápida!
                                  </p>
                                </div>
                              </div>
                            )}
                            
                            {/* Notes */}
                            {order.notes && (
                              <div>
                                <h4 className="font-semibold text-gray-900 mb-2">Observações</h4>
                                <p className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-gray-700">
                                  {order.notes}
                                </p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
