
'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { HomeButton } from '@/components/home-button'
import {
  Calendar,
  DollarSign,
  Users,
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Banknote,
  X,
  Lock,
  Edit,
  Trash2
} from 'lucide-react'
import { toast } from 'sonner'

interface Seller {
  id: string
  name: string
  email: string
  phone: string
}

interface Closure {
  id: string
  sellerId: string
  referenceMonth: string
  totalAmount: number
  status: 'PENDING' | 'PAID' | 'CANCELLED'
  closedAt: string
  paidAt?: string | null
  paymentMethod?: string | null
  notes?: string | null
  Seller: Seller
  Commissions: any[]
}

export default function AdminCommissionsPage() {
  const { data: session, status } = useSession() || {}
  const router = useRouter()
  const [closures, setClosures] = useState<Closure[]>([])
  const [sellers, setSellers] = useState<Seller[]>([])
  const [pendingCommissions, setPendingCommissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedClosures, setExpandedClosures] = useState<Set<string>>(new Set())
  
  // Estados para fechamento
  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const [referenceMonth, setReferenceMonth] = useState('')
  const [selectedSellerId, setSelectedSellerId] = useState<string>('ALL')
  const [closingMonth, setClosingMonth] = useState(false)
  
  // Estados para pagamento
  const [showPayDialog, setShowPayDialog] = useState(false)
  const [selectedClosure, setSelectedClosure] = useState<Closure | null>(null)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [processing, setProcessing] = useState(false)
  
  // Estados para editar comissão
  const [editingCommission, setEditingCommission] = useState<any>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editAmount, setEditAmount] = useState('')
  const [editDescription, setEditDescription] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    } else if (session && (session.user as any)?.userType !== 'ADMIN') {
      router.push('/admin')
    } else if (session && (session.user as any)?.userType === 'ADMIN') {
      fetchData()
    }
  }, [session, status, router])

  useEffect(() => {
    // Define mês atual automaticamente
    const now = new Date()
    const brasiliaOffset = -3 * 60
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000)
    const brasiliaDate = new Date(utcTime + (brasiliaOffset * 60000))
    
    const year = brasiliaDate.getFullYear()
    const month = String(brasiliaDate.getMonth() + 1).padStart(2, '0')
    setReferenceMonth(`${year}-${month}`)
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [closuresRes, sellersRes, commissionsRes] = await Promise.all([
        fetch('/api/admin/commissions/closures'),
        fetch('/api/sellers'),
        fetch('/api/admin/commissions')
      ])
      
      const closuresData = await closuresRes.json()
      const sellersData = await sellersRes.json()
      const commissionsData = await commissionsRes.json()
      
      setClosures(closuresData.closures || [])
      // A API /api/sellers retorna diretamente o array, não um objeto com propriedade sellers
      setSellers(Array.isArray(sellersData) ? sellersData : [])
      
      // Filtra comissões que ainda não foram fechadas (sem closureId)
      const pending = (commissionsData.commissions || []).filter((c: any) => !c.closureId)
      setPendingCommissions(pending)
      
      // Log para debug
      console.log('📊 Fechamentos:', closuresData.closures?.length || 0)
      console.log('💰 Comissões totais:', commissionsData.commissions?.length || 0)
      console.log('⏳ Comissões pendentes (não fechadas):', pending.length)
      
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  const handleCloseMonth = async () => {
    if (!referenceMonth) {
      toast.error('Selecione o mês de referência')
      return
    }

    try {
      setClosingMonth(true)
      const res = await fetch('/api/admin/commissions/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceMonth,
          sellerId: selectedSellerId === 'ALL' ? null : selectedSellerId
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao fechar comissões')
      }

      toast.success(data.message)
      setShowCloseDialog(false)
      fetchData()
    } catch (error: any) {
      console.error('Error closing month:', error)
      toast.error(error.message || 'Erro ao fechar comissões')
    } finally {
      setClosingMonth(false)
    }
  }

  const handlePayClosure = async () => {
    if (!selectedClosure || !paymentMethod) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }

    try {
      setProcessing(true)
      const res = await fetch('/api/admin/commissions/closures', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          closureId: selectedClosure.id,
          action: 'PAY',
          paymentMethod,
          notes: paymentNotes
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao processar pagamento')
      }

      toast.success('Pagamento registrado com sucesso!')
      setShowPayDialog(false)
      setSelectedClosure(null)
      setPaymentMethod('')
      setPaymentNotes('')
      fetchData()
    } catch (error: any) {
      console.error('Error processing payment:', error)
      toast.error(error.message || 'Erro ao processar pagamento')
    } finally {
      setProcessing(false)
    }
  }

  const handleCancelClosure = async (closure: Closure) => {
    if (!confirm(`Tem certeza que deseja cancelar o fechamento de ${closure.Seller.name}?`)) {
      return
    }

    try {
      const res = await fetch('/api/admin/commissions/closures', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          closureId: closure.id,
          action: 'CANCEL'
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao cancelar fechamento')
      }

      toast.success('Fechamento cancelado com sucesso!')
      fetchData()
    } catch (error: any) {
      console.error('Error canceling closure:', error)
      toast.error(error.message || 'Erro ao cancelar fechamento')
    }
  }

  const handleDeleteClosure = async (closure: Closure) => {
    if (!confirm(`Tem certeza que deseja EXCLUIR permanentemente o fechamento de ${closure.Seller.name} (${formatMonthYear(closure.referenceMonth)})?`)) {
      return
    }

    try {
      const res = await fetch(`/api/admin/commissions/closures/${closure.id}`, {
        method: 'DELETE'
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao excluir fechamento')
      }

      toast.success('Fechamento excluído com sucesso!')
      fetchData()
    } catch (error: any) {
      console.error('Error deleting closure:', error)
      toast.error(error.message || 'Erro ao excluir fechamento')
    }
  }

  const toggleClosure = (closureId: string) => {
    const newExpanded = new Set(expandedClosures)
    if (newExpanded.has(closureId)) {
      newExpanded.delete(closureId)
    } else {
      newExpanded.add(closureId)
    }
    setExpandedClosures(newExpanded)
  }

  const handleEditCommission = (commission: any) => {
    setEditingCommission(commission)
    setEditAmount(commission.amount.toString())
    setEditDescription(commission.description || '')
    setShowEditDialog(true)
  }

  const handleSaveEdit = async () => {
    if (!editingCommission) return
    
    try {
      setProcessing(true)
      
      const res = await fetch(`/api/admin/commissions/${editingCommission.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(editAmount),
          description: editDescription
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao atualizar comissão')
      }

      toast.success('Comissão atualizada com sucesso!')
      setShowEditDialog(false)
      setEditingCommission(null)
      fetchData()
    } catch (error: any) {
      console.error('Error updating commission:', error)
      toast.error(error.message || 'Erro ao atualizar comissão')
    } finally {
      setProcessing(false)
    }
  }

  const handleDeleteCommission = async (commission: any) => {
    if (!confirm(`Tem certeza que deseja excluir a comissão de R$ ${commission.amount.toFixed(2)} de ${commission.Seller?.name}?`)) {
      return
    }

    try {
      const res = await fetch(`/api/admin/commissions/${commission.id}`, {
        method: 'DELETE'
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao excluir comissão')
      }

      toast.success('Comissão excluída com sucesso!')
      fetchData()
    } catch (error: any) {
      console.error('Error deleting commission:', error)
      toast.error(error.message || 'Erro ao excluir comissão')
    }
  }

  const formatMonthYear = (monthStr: string) => {
    const [year, month] = monthStr.split('-')
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ]
    return `${months[parseInt(month) - 1]} ${year}`
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="secondary" className="bg-amber-100 text-amber-700"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>
      case 'PAID':
        return <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Pago</Badge>
      case 'CANCELLED':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Cancelado</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  // Cálculos de totais
  // Comissões pendentes que ainda não foram fechadas
  const totalPendingNotClosed = pendingCommissions.reduce((sum, c) => sum + c.amount, 0)
  
  // Fechamentos pendentes de pagamento
  const totalPendingClosures = closures
    .filter(c => c.status === 'PENDING')
    .reduce((sum, c) => sum + c.totalAmount, 0)
  
  // Total de pendentes = comissões não fechadas + fechamentos aguardando pagamento
  const totalPending = totalPendingNotClosed + totalPendingClosures
  
  const totalPaid = closures
    .filter(c => c.status === 'PAID')
    .reduce((sum, c) => sum + c.totalAmount, 0)
  
  const totalAll = totalPending + totalPaid
  const pendingCount = closures.filter(c => c.status === 'PENDING').length + (pendingCommissions.length > 0 ? 1 : 0)

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

  if (!session || (session.user as any)?.userType !== 'ADMIN') {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <HomeButton />
          <Button
            onClick={() => setShowCloseDialog(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Lock className="h-4 w-4 mr-2" />
            Fechar Mês
          </Button>
        </div>

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Gestão de Comissões
          </h1>
          <p className="text-gray-600">
            Gerencie o fechamento e pagamento de comissões dos vendedores
          </p>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Geral</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {totalAll.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                Todas as comissões
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">A Fechar/Pendentes</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {totalPending.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                {pendingCommissions.length > 0 && `${pendingCommissions.length} comissão(ões) a fechar`}
                {pendingCommissions.length > 0 && pendingCount > 1 && ' + '}
                {pendingCount > 1 && `${pendingCount - 1} aguardando pagamento`}
                {pendingCommissions.length === 0 && pendingCount === 0 && 'Nenhuma pendência'}
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pago</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {totalPaid.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                Comissões já pagas
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vendedores</CardTitle>
              <Users className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{sellers.length}</div>
              <p className="text-xs text-muted-foreground">
                Total de vendedores
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Aviso */}
        <Alert className="mb-6 bg-blue-50 border-blue-200">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-900">
            <strong>Importante:</strong> As comissões devem ser fechadas no último dia de cada mês. 
            Após o fechamento, você pode registrar o pagamento para cada vendedor.
          </AlertDescription>
        </Alert>

        {/* Comissões Pendentes (Não Fechadas) */}
        {pendingCommissions.length > 0 && (
          <Card className="mb-6 border-amber-200">
            <CardHeader className="bg-amber-50">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-600" />
                Comissões Pendentes - Aguardando Fechamento
              </CardTitle>
              <CardDescription>
                Comissões geradas este mês que ainda não foram fechadas
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {pendingCommissions.map((commission: any) => (
                  <div 
                    key={commission.id}
                    className="flex items-center justify-between p-4 bg-white border rounded-lg hover:bg-amber-50 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <Users className="h-5 w-5 text-amber-600" />
                      <div>
                        <p className="font-semibold">{commission.Seller?.name || 'Vendedor'}</p>
                        <p className="text-sm text-muted-foreground">
                          {commission.description}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Pedido: {commission.orderId ? commission.orderId.substring(0, 8) : 'N/A'} • 
                          {' '}{new Date(commission.createdAt).toLocaleDateString('pt-BR')} •
                          {' '}{commission.Seller?.phone || commission.Seller?.email || ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-xl font-bold text-green-600">
                          R$ {commission.amount.toFixed(2)}
                        </div>
                        <Badge variant="secondary" className="mt-1">
                          <Clock className="h-3 w-3 mr-1" />
                          A fechar
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditCommission(commission)}
                          className="h-8"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteCommission(commission)}
                          className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  {pendingCommissions.length} comissão(ões) pendente(s)
                </p>
                <p className="text-lg font-bold">
                  Total: R$ {totalPendingNotClosed.toFixed(2)}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lista de Fechamentos */}
        <Card>
          <CardHeader>
            <CardTitle>Fechamentos Mensais</CardTitle>
            <CardDescription>
              Histórico de fechamentos e pagamentos de comissões
            </CardDescription>
          </CardHeader>
          <CardContent>
            {closures.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Nenhum fechamento registrado ainda
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Clique em "Fechar Mês" para criar o primeiro fechamento
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {closures.map((closure) => (
                  <div 
                    key={closure.id}
                    className="border rounded-lg overflow-hidden transition-all hover:shadow-md"
                  >
                    {/* Cabeçalho */}
                    <div 
                      className={`p-4 cursor-pointer flex items-center justify-between ${
                        closure.status === 'PENDING' 
                          ? 'bg-amber-50 hover:bg-amber-100' 
                          : closure.status === 'PAID'
                          ? 'bg-green-50 hover:bg-green-100'
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                      onClick={() => toggleClosure(closure.id)}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <Calendar className={`h-5 w-5 ${
                          closure.status === 'PENDING' ? 'text-amber-600' : 
                          closure.status === 'PAID' ? 'text-green-600' : 'text-gray-600'
                        }`} />
                        <div>
                          <h3 className="font-semibold text-lg">
                            {closure.Seller.name} - {formatMonthYear(closure.referenceMonth)}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {closure.Commissions.length} comissão(ões) • {closure.Seller.phone}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-2xl font-bold text-green-600">
                            R$ {closure.totalAmount.toFixed(2)}
                          </div>
                          {closure.paidAt && (
                            <p className="text-xs text-muted-foreground">
                              Pago em {new Date(closure.paidAt).toLocaleDateString('pt-BR')}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {closure.status === 'PENDING' && (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedClosure(closure)
                                setShowPayDialog(true)
                              }}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Banknote className="h-4 w-4 mr-1" />
                              Pagar
                            </Button>
                          )}
                          {getStatusBadge(closure.status)}
                          {expandedClosures.has(closure.id) ? (
                            <ChevronUp className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Detalhes Expandidos */}
                    {expandedClosures.has(closure.id) && (
                      <div className="p-4 bg-white border-t">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <span className="text-sm text-muted-foreground">Vendedor:</span>
                            <p className="font-medium">{closure.Seller.name}</p>
                          </div>
                          <div>
                            <span className="text-sm text-muted-foreground">E-mail:</span>
                            <p className="font-medium">{closure.Seller.email}</p>
                          </div>
                          <div>
                            <span className="text-sm text-muted-foreground">Fechado em:</span>
                            <p className="font-medium">
                              {new Date(closure.closedAt).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          {closure.paymentMethod && (
                            <div>
                              <span className="text-sm text-muted-foreground">Forma de pagamento:</span>
                              <p className="font-medium">{closure.paymentMethod}</p>
                            </div>
                          )}
                        </div>

                        {closure.notes && (
                          <div className="mb-4 p-3 bg-gray-50 rounded">
                            <span className="text-sm text-muted-foreground">Observações:</span>
                            <p className="mt-1">{closure.notes}</p>
                          </div>
                        )}

                        {closure.status === 'PENDING' && (
                          <div className="flex gap-2 mt-4">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCancelClosure(closure)
                              }}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Cancelar Fechamento
                            </Button>
                          </div>
                        )}
                        
                        {closure.status === 'CANCELLED' && (
                          <div className="flex gap-2 mt-4">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteClosure(closure)
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Excluir Fechamento
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog: Fechar Mês */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fechar Mês de Comissões</DialogTitle>
            <DialogDescription>
              Selecione o mês e vendedor(es) para fechar as comissões
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Mês de Referência *</Label>
              <Input
                type="month"
                value={referenceMonth}
                onChange={(e) => setReferenceMonth(e.target.value)}
                max={new Date().toISOString().slice(0, 7)}
              />
            </div>

            <div>
              <Label>Vendedor</Label>
              <Select value={selectedSellerId} onValueChange={setSelectedSellerId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os Vendedores</SelectItem>
                  {sellers.map((seller) => (
                    <SelectItem key={seller.id} value={seller.id}>
                      {seller.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCloseDialog(false)}
              disabled={closingMonth}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCloseMonth}
              disabled={closingMonth || !referenceMonth}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {closingMonth ? 'Fechando...' : 'Fechar Mês'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Registrar Pagamento */}
      <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
            <DialogDescription>
              Registre o pagamento da comissão de {selectedClosure?.Seller.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Valor a pagar:</span>
                <span className="text-2xl font-bold text-green-600">
                  R$ {selectedClosure?.totalAmount.toFixed(2)}
                </span>
              </div>
            </div>

            <div>
              <Label>Forma de Pagamento *</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="TED">TED</SelectItem>
                  <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                  <SelectItem value="Outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Adicione observações sobre o pagamento..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPayDialog(false)
                setSelectedClosure(null)
                setPaymentMethod('')
                setPaymentNotes('')
              }}
              disabled={processing}
            >
              Cancelar
            </Button>
            <Button
              onClick={handlePayClosure}
              disabled={processing || !paymentMethod}
              className="bg-green-600 hover:bg-green-700"
            >
              {processing ? 'Processando...' : 'Confirmar Pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Edição de Comissão */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Comissão</DialogTitle>
            <DialogDescription>
              Altere o valor ou descrição da comissão de {editingCommission?.Seller?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-amount">Valor (R$)</Label>
              <Input
                id="edit-amount"
                type="number"
                step="0.01"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="edit-description">Descrição</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>

            {editingCommission && (
              <div className="bg-gray-50 p-3 rounded-lg text-sm">
                <p className="text-gray-600">
                  <strong>Pedido:</strong> {editingCommission.orderId?.substring(0, 8) || 'N/A'}
                </p>
                <p className="text-gray-600 mt-1">
                  <strong>Data:</strong> {new Date(editingCommission.createdAt).toLocaleDateString('pt-BR')}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              disabled={processing}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={processing || !editAmount}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {processing ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
