
'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Calendar,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react'
import { HomeButton } from '@/components/home-button'

interface MonthlyCommission {
  referenceMonth: string
  totalAmount: number
  status: 'PENDING' | 'PAID' | 'CANCELLED'
  commissionsCount: number
  commissions: any[]
  closedAt?: string
  paidAt?: string | null
  paymentMethod?: string | null
  notes?: string | null
}

export default function SellerCommissionsPage() {
  const { data: session, status } = useSession() || {}
  const router = useRouter()
  const [monthlyData, setMonthlyData] = useState<MonthlyCommission[]>([])
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())
  const [seller, setSeller] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    } else if (session && (session.user as any)?.userType !== 'SELLER') {
      router.push('/dashboard')
    } else if (session && (session.user as any)?.userType === 'SELLER') {
      fetchMonthlyCommissions()
    }
  }, [session, status, router])

  const fetchMonthlyCommissions = async () => {
    try {
      const res = await fetch('/api/sellers/commissions/monthly')
      const data = await res.json()
      setMonthlyData(data.monthlyCommissions || [])
      setSeller(data.seller)
    } catch (error) {
      console.error('Error fetching monthly commissions:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleMonth = (month: string) => {
    const newExpanded = new Set(expandedMonths)
    if (newExpanded.has(month)) {
      newExpanded.delete(month)
    } else {
      newExpanded.add(month)
    }
    setExpandedMonths(newExpanded)
  }

  const formatMonthYear = (monthStr: string) => {
    const [year, month] = monthStr.split('-')
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ]
    return `${months[parseInt(month) - 1]} ${year}`
  }

  // Calcula totais
  const totalPending = monthlyData
    .filter(m => m.status === 'PENDING')
    .reduce((sum, m) => sum + m.totalAmount, 0)
  
  const totalPaid = monthlyData
    .filter(m => m.status === 'PAID')
    .reduce((sum, m) => sum + m.totalAmount, 0)
  
  const totalAll = monthlyData.reduce((sum, m) => sum + m.totalAmount, 0)

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

  if (!session || (session.user as any)?.userType !== 'SELLER') {
    return null
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="secondary" className="bg-amber-100 text-amber-700"><Clock className="h-3 w-3 mr-1" />A Fechar</Badge>
      case 'PAID':
        return <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Pago</Badge>
      case 'CANCELLED':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Cancelado</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <HomeButton />
        </div>
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Minhas Comissões
          </h1>
          <p className="text-gray-600">
            Acompanhe suas comissões mensais e pagamentos
          </p>
        </div>

        {/* Resumo de Comissões */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Histórico</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {totalAll.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                Todas as comissões geradas
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">A Fechar (Mês Atual)</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {totalPending.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                Aguardando fechamento do mês
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Pago</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {totalPaid.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                Comissões já recebidas
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Aviso sobre Fechamento Mensal */}
        <Alert className="mb-6 bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-900">
            <strong>Como funciona:</strong> As comissões são fechadas no último dia de cada mês e pagas pela administração. 
            Você pode visualizar o histórico completo abaixo, incluindo status de pagamento de cada mês.
          </AlertDescription>
        </Alert>

        {/* Comissões Mensais */}
        <Card>
          <CardHeader>
            <CardTitle>Comissões por Mês</CardTitle>
            <CardDescription>
              Histórico mensal de comissões e pagamentos
            </CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyData.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Nenhuma comissão registrada ainda
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Suas comissões aparecerão aqui conforme você realiza vendas
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {monthlyData.map((month) => (
                  <div 
                    key={month.referenceMonth} 
                    className="border rounded-lg overflow-hidden transition-all hover:shadow-md"
                  >
                    {/* Cabeçalho do Mês */}
                    <div 
                      className={`p-4 cursor-pointer flex items-center justify-between ${
                        month.status === 'PENDING' 
                          ? 'bg-amber-50 hover:bg-amber-100' 
                          : month.status === 'PAID'
                          ? 'bg-green-50 hover:bg-green-100'
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                      onClick={() => toggleMonth(month.referenceMonth)}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <Calendar className={`h-5 w-5 ${
                          month.status === 'PENDING' ? 'text-amber-600' : 
                          month.status === 'PAID' ? 'text-green-600' : 'text-gray-600'
                        }`} />
                        <div>
                          <h3 className="font-semibold text-lg">
                            {formatMonthYear(month.referenceMonth)}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {month.commissionsCount} {month.commissionsCount === 1 ? 'comissão' : 'comissões'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-2xl font-bold text-green-600">
                            R$ {month.totalAmount.toFixed(2)}
                          </div>
                          {month.paidAt && (
                            <p className="text-xs text-muted-foreground">
                              Pago em {new Date(month.paidAt).toLocaleDateString('pt-BR')}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {getStatusBadge(month.status)}
                          {expandedMonths.has(month.referenceMonth) ? (
                            <ChevronUp className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Detalhes Expandidos */}
                    {expandedMonths.has(month.referenceMonth) && (
                      <div className="p-4 bg-white border-t">
                        {/* Informações de Pagamento */}
                        {month.status === 'PAID' && (
                          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                            <div className="flex items-center gap-2 mb-2">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <span className="font-semibold text-green-900">Pagamento Realizado</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-muted-foreground">Data do pagamento:</span>
                                <span className="ml-2 font-medium">
                                  {month.paidAt ? new Date(month.paidAt).toLocaleDateString('pt-BR') : '-'}
                                </span>
                              </div>
                              {month.paymentMethod && (
                                <div>
                                  <span className="text-muted-foreground">Forma de pagamento:</span>
                                  <span className="ml-2 font-medium">{month.paymentMethod}</span>
                                </div>
                              )}
                            </div>
                            {month.notes && (
                              <div className="mt-2 text-sm">
                                <span className="text-muted-foreground">Observações:</span>
                                <span className="ml-2">{month.notes}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {month.status === 'PENDING' && (
                          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-amber-600" />
                              <span className="font-semibold text-amber-900">
                                Aguardando fechamento do mês
                              </span>
                            </div>
                            <p className="text-sm text-amber-700 mt-1">
                              As comissões serão fechadas no último dia do mês e processadas para pagamento.
                            </p>
                          </div>
                        )}

                        {/* Lista de Comissões */}
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Data</TableHead>
                                <TableHead>Descrição</TableHead>
                                <TableHead className="text-right">Valor</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {month.commissions.map((commission) => (
                                <TableRow key={commission.id}>
                                  <TableCell className="text-sm">
                                    {new Date(commission.createdAt).toLocaleDateString('pt-BR', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric'
                                    })}
                                  </TableCell>
                                  <TableCell className="text-sm">{commission.description}</TableCell>
                                  <TableCell className="text-right font-semibold text-green-600">
                                    R$ {commission.amount.toFixed(2)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
