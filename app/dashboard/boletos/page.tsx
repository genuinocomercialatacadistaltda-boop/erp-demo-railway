
'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  ArrowLeft,
  FileText,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Download,
  Loader2
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { HomeButton } from '@/components/home-button'

interface Boleto {
  id: string
  boletoNumber: string
  amount: number
  dueDate: string
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED'
  paidDate?: string
  notes?: string
  createdAt: string
  isInstallment?: boolean
  installmentNumber?: number
  totalInstallments?: number
  pixQrCode?: string
  pixQrCodeBase64?: string
  pixPaymentId?: string
  order?: {
    id: string
    orderNumber: string
    total: number
    createdAt: string
  }
}

interface Receivable {
  id: string
  description: string
  amount: number
  dueDate: string
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED'
  paymentDate?: string
  paymentMethod?: string
  notes?: string
  createdAt: string
  isInstallment?: boolean
  installmentNumber?: number
  totalInstallments?: number
  boletoId?: string | null // ✅ NOVO: ID do boleto vinculado (se houver)
  Order?: {
    id: string
    orderNumber: string
    paymentMethod: string
    createdAt: string
    total: number
  }
}

interface FinancialItem {
  id: string
  type: 'BOLETO' | 'NOTINHA'
  number: string
  amount: number
  dueDate: string
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED'
  paidDate?: string
  notes?: string
  createdAt: string
  isInstallment?: boolean
  installmentNumber?: number
  totalInstallments?: number
  pixQrCode?: string
  pixQrCodeBase64?: string
  pixPaymentId?: string
  paymentMethod?: string
  order?: {
    id: string
    orderNumber: string
    total: number
    createdAt: string
  }
}

interface Customer {
  id: string
  name: string
  creditLimit: number
  availableCredit: number
  paymentTerms: number
}

export default function MeusBoletosPage() {
  const { data: session, status } = useSession() || {}
  const user = session?.user as any
  const [financialItems, setFinancialItems] = useState<FinancialItem[]>([])
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'PAID' | 'OVERDUE'>('ALL')
  const [generatingPix, setGeneratingPix] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()

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
      setIsLoading(true)

      console.log('🔍 [FINANCEIRO_CLIENTE] Buscando dados financeiros...')
      console.log('   - Customer ID:', user?.customerId)

      // Fetch customer data
      const customerResponse = await fetch(`/api/customers/${user?.customerId}`)
      if (customerResponse.ok) {
        const customerData = await customerResponse.json()
        setCustomer(customerData)
        console.log('   ✅ Cliente carregado:', customerData.name)
      }

      // Fetch boletos
      const boletosResponse = await fetch('/api/boletos')
      const boletosData: Boleto[] = boletosResponse.ok ? await boletosResponse.json() : []
      console.log('   📄 Boletos encontrados:', boletosData.length)

      // Fetch receivables (noninhas/contas a receber)
      const receivablesResponse = await fetch(`/api/customer-receivables?customerId=${user?.customerId}`)
      let receivablesData: Receivable[] = []
      
      if (receivablesResponse.ok) {
        const data = await receivablesResponse.json()
        receivablesData = data.receivables || []
        console.log('   📝 Receivables (notinhas) encontrados:', receivablesData.length)
      }

      // Combinar boletos e receivables em um único array
      const combinedItems: FinancialItem[] = [
        // Mapear boletos (TODOS, incluindo pagos para histórico)
        ...boletosData.map(boleto => ({
          id: boleto.id,
          type: 'BOLETO' as const,
          number: boleto.boletoNumber,
          amount: boleto.amount,
          dueDate: boleto.dueDate,
          status: boleto.status,
          paidDate: boleto.paidDate,
          notes: boleto.notes,
          createdAt: boleto.createdAt,
          isInstallment: boleto.isInstallment,
          installmentNumber: boleto.installmentNumber,
          totalInstallments: boleto.totalInstallments,
          pixQrCode: boleto.pixQrCode,
          pixQrCodeBase64: boleto.pixQrCodeBase64,
          pixPaymentId: boleto.pixPaymentId,
          paymentMethod: 'BOLETO',
          order: boleto.order
        })),
        // Mapear receivables (EXCLUIR os que têm boleto vinculado para evitar duplicatas)
        ...receivablesData
          .filter(receivable => !receivable.boletoId) // ✅ Filtrar receivables SEM boleto vinculado
          .map(receivable => ({
            id: receivable.id,
            type: 'NOTINHA' as const,
            number: receivable.Order?.orderNumber || receivable.description,
            amount: receivable.amount,
            dueDate: receivable.dueDate,
            status: receivable.status,
            paidDate: receivable.paymentDate,
            notes: receivable.notes,
            createdAt: receivable.createdAt,
            isInstallment: receivable.isInstallment,
            installmentNumber: receivable.installmentNumber,
            totalInstallments: receivable.totalInstallments,
            paymentMethod: receivable.Order?.paymentMethod || receivable.paymentMethod || 'CREDIT',
            order: receivable.Order ? {
              id: receivable.Order.id,
              orderNumber: receivable.Order.orderNumber,
              total: receivable.Order.total,
              createdAt: receivable.Order.createdAt
            } : undefined
          }))
      ]

      // Ordenar por data de vencimento (mais antigos primeiro)
      combinedItems.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())

      console.log('   💰 Total de itens financeiros:', combinedItems.length)
      console.log('   - Boletos:', combinedItems.filter(i => i.type === 'BOLETO').length)
      console.log('   - Notinhas:', combinedItems.filter(i => i.type === 'NOTINHA').length)

      setFinancialItems(combinedItems)
    } catch (error) {
      console.error('❌ [FINANCEIRO_CLIENTE] Erro ao buscar dados:', error)
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar suas informações.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewBoleto = async (boletoId: string) => {
    try {
      setGeneratingPix(boletoId)
      
      // Generate or retrieve PIX payment
      const response = await fetch('/api/boletos/generate-pix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ boletoId })
      })

      if (!response.ok) {
        const error = await response.json()
        
        // Check for specific error codes
        if (error.code === 'MERCADOPAGO_CREDENTIALS_ERROR') {
          throw new Error('Problema com as credenciais do Mercado Pago. Entre em contato com o administrador.')
        } else if (error.code === 'QR_CODE_NOT_GENERATED') {
          throw new Error('O QR Code PIX não foi gerado. Isso pode acontecer se a conta do Mercado Pago não estiver completamente verificada. Entre em contato conosco para resolver.')
        } else {
          throw new Error(error.error || error.details || 'Failed to generate boleto')
        }
      }

      const data = await response.json()

      // Open PDF in new window
      if (data.pdfHtml) {
        const newWindow = window.open('', '_blank')
        if (newWindow) {
          newWindow.document.write(data.pdfHtml)
          newWindow.document.close()
        }
      }

      // Refresh boletos to get updated data
      fetchData()

      toast({
        title: "Boleto gerado!",
        description: "O boleto foi aberto em uma nova janela.",
      })
    } catch (error) {
      console.error('Error viewing boleto:', error)
      toast({
        title: "Erro ao gerar boleto",
        description: error instanceof Error ? error.message : "Não foi possível gerar o boleto.",
        variant: "destructive",
        duration: 10000 // Show error for 10 seconds
      })
    } finally {
      setGeneratingPix(null)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    // 🔧 CORREÇÃO: Parse manual para evitar problemas de timezone
    // Extrai ano, mês e dia da string ISO
    const [year, month, day] = dateString.split('T')[0].split('-').map(Number)
    // Cria Date no timezone local (meio-dia para evitar DST issues)
    const date = new Date(year, month - 1, day, 12, 0, 0)
    return date.toLocaleDateString('pt-BR')
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
          <Clock className="w-3 h-3 mr-1" />
          Pendente
        </Badge>
      case 'PAID':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle className="w-3 h-3 mr-1" />
          Pago
        </Badge>
      case 'OVERDUE':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          <AlertCircle className="w-3 h-3 mr-1" />
          Vencido
        </Badge>
      case 'CANCELLED':
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
          <XCircle className="w-3 h-3 mr-1" />
          Cancelado
        </Badge>
      default:
        return null
    }
  }

  const filteredItems = financialItems.filter(item => {
    if (filter === 'ALL') return true
    return item.status === filter
  })

  const openItems = financialItems.filter(b => b.status === 'PENDING' || b.status === 'OVERDUE')
  const totalOpenAmount = openItems.reduce((sum, b) => sum + b.amount, 0)
  const overdueCount = financialItems.filter(b => b.status === 'OVERDUE').length

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <FileText className="w-8 h-8 text-white animate-pulse" />
          </div>
          <p className="text-lg text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-amber-50">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto max-w-7xl flex h-16 items-center justify-between px-4">
          <HomeButton />
          
          <h1 className="text-lg font-semibold text-gray-900">
            Financeiro
          </h1>
          
          <div className="w-24"></div>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl px-4 py-8">
        {/* Summary Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Limite Total</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(customer?.creditLimit || 0)}
                  </p>
                </div>
                <DollarSign className="w-10 h-10 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Crédito Disponível</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(customer?.availableCredit || 0)}
                  </p>
                </div>
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total em Aberto</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {formatCurrency(totalOpenAmount)}
                  </p>
                </div>
                <FileText className="w-10 h-10 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Boletos Vencidos</p>
                  <p className="text-2xl font-bold text-red-600">
                    {overdueCount}
                  </p>
                </div>
                <AlertCircle className="w-10 h-10 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={filter === 'ALL' ? 'default' : 'outline'}
            onClick={() => setFilter('ALL')}
            size="sm"
          >
            Todos ({financialItems.length})
          </Button>
          <Button
            variant={filter === 'PENDING' ? 'default' : 'outline'}
            onClick={() => setFilter('PENDING')}
            size="sm"
          >
            Pendentes ({financialItems.filter(b => b.status === 'PENDING').length})
          </Button>
          <Button
            variant={filter === 'OVERDUE' ? 'default' : 'outline'}
            onClick={() => setFilter('OVERDUE')}
            size="sm"
          >
            Vencidos ({overdueCount})
          </Button>
          <Button
            variant={filter === 'PAID' ? 'default' : 'outline'}
            onClick={() => setFilter('PAID')}
            size="sm"
          >
            Pagos ({financialItems.filter(b => b.status === 'PAID').length})
          </Button>
        </div>

        {/* Financial Items List */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico Financeiro</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredItems.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Nenhum registro encontrado</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className={`border rounded-lg p-4 hover:bg-gray-50 transition-colors ${
                      item.type === 'NOTINHA' ? 'border-l-4 border-l-blue-500' : 'border-l-4 border-l-purple-500'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                          {item.type === 'BOLETO' ? (
                            <>
                              <FileText className="w-4 h-4 text-purple-600" />
                              <span>Boleto {item.number}</span>
                            </>
                          ) : (
                            <>
                              <FileText className="w-4 h-4 text-blue-600" />
                              <span>Notinha {item.number}</span>
                            </>
                          )}
                          {item.isInstallment && (
                            <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                              Parcela {item.installmentNumber}/{item.totalInstallments}
                            </span>
                          )}
                        </h4>
                        {item.order && (
                          <div className="mt-1 p-2 bg-blue-50 rounded-md border border-blue-200">
                            <p className="text-sm font-medium text-blue-900 mb-1">
                              📦 Referente ao Pedido: {item.order.orderNumber}
                            </p>
                            <div className="flex gap-4 text-xs text-blue-700">
                              <span>Total do Pedido: {formatCurrency(item.order.total)}</span>
                              <span>Data: {formatDate(item.order.createdAt)}</span>
                            </div>
                          </div>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {item.type === 'BOLETO' ? 'Pagamento via Boleto' : `Pagamento: ${
                            item.paymentMethod === 'PIX' ? 'PIX' :
                            item.paymentMethod === 'CREDIT' ? 'A Prazo (Notinha)' :
                            item.paymentMethod === 'CARD' ? 'Cartão' :
                            item.paymentMethod === 'CASH' ? 'Dinheiro' :
                            'A Prazo (Notinha)'
                          }`}
                        </p>
                      </div>
                      {getStatusBadge(item.status)}
                    </div>

                    <div className="grid sm:grid-cols-3 gap-4 mb-3">
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Valor</p>
                        <p className="font-semibold text-gray-900">
                          {formatCurrency(item.amount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Vencimento</p>
                        <p className="font-semibold text-gray-900">
                          {formatDate(item.dueDate)}
                        </p>
                      </div>
                      {item.paidDate && (
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Data de Pagamento</p>
                          <p className="font-semibold text-gray-900">
                            {formatDate(item.paidDate)}
                          </p>
                        </div>
                      )}
                    </div>

                    {item.notes && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-gray-600 mb-1">Observações</p>
                        <p className="text-sm text-gray-900">{item.notes}</p>
                      </div>
                    )}

                    {/* Action buttons - apenas para boletos */}
                    {item.type === 'BOLETO' && (item.status === 'PENDING' || item.status === 'OVERDUE') && (
                      <div className="mt-4 pt-4 border-t flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleViewBoleto(item.id)}
                          disabled={generatingPix === item.id}
                          className="flex-1"
                        >
                          {generatingPix === item.id ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Gerando...
                            </>
                          ) : (
                            <>
                              <Eye className="w-4 h-4 mr-2" />
                              {item.pixQrCode ? 'Ver Boleto' : 'Gerar Boleto PIX'}
                            </>
                          )}
                        </Button>
                        {item.pixQrCode && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (item.pixQrCode) {
                                navigator.clipboard.writeText(item.pixQrCode)
                                toast({
                                  title: "Código copiado!",
                                  description: "Código PIX copia e cola copiado para área de transferência.",
                                })
                              }
                            }}
                            className="flex-1"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Copiar PIX
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Informação para notinhas */}
                    {item.type === 'NOTINHA' && (item.status === 'PENDING' || item.status === 'OVERDUE') && (
                      <div className="mt-4 pt-4 border-t">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-sm text-blue-800">
                            💰 <strong>Pagamento a Prazo:</strong> Entre em contato pelo WhatsApp para realizar o pagamento.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Information Box */}
        <Card className="mt-6 bg-blue-50 border-blue-200">
          <CardContent className="p-6">
            <h3 className="font-semibold text-blue-900 mb-2">
              ℹ️ Informações sobre seu financeiro
            </h3>
            <ul className="text-sm text-blue-800 space-y-1 ml-4 list-disc">
              <li><strong>Boletos:</strong> Gerados automaticamente para pagamentos via boleto. Você pode gerar o QR Code PIX aqui mesmo.</li>
              <li><strong>Notinhas (Pagamento a Prazo):</strong> Registros de pedidos feitos "na notinha" com pagamento a prazo.</li>
              <li>Seu prazo de pagamento: {customer?.paymentTerms || 30} dias</li>
              <li>O valor é descontado do seu limite de crédito disponível</li>
              <li>Após o pagamento confirmado, o crédito é restaurado automaticamente</li>
              <li>Entre em contato pelo WhatsApp para enviar comprovantes de pagamento</li>
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
