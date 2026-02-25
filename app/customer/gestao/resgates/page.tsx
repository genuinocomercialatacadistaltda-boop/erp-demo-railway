'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { 
  Award, 
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Package,
  User,
  Phone,
  Mail,
  Star,
  Image as ImageIcon
} from 'lucide-react'
import { toast } from 'sonner'

interface Redemption {
  id: string
  pointsUsed: number
  status: string
  requestedAt: string
  processedAt: string | null
  deliveredAt: string | null
  notes: string | null
  adminNotes: string | null
  rejectionReason: string | null
  ClientCustomer: {
    id: string
    name: string
    phone: string | null
    email: string | null
  }
  Prize: {
    name: string
    description: string | null
    imageUrl: string | null
    pointsCost: number
  }
}

export default function RedemptionsManagementPage() {
  const router = useRouter()
  
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedRedemption, setSelectedRedemption] = useState<Redemption | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [actionType, setActionType] = useState<'APPROVED' | 'REJECTED' | 'DELIVERED' | null>(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [activeTab, setActiveTab] = useState('PENDING')

  useEffect(() => {
    loadRedemptions()
  }, [])

  const loadRedemptions = async (status?: string) => {
    try {
      setIsLoading(true)
      
      const url = status 
        ? `/api/customer/redemptions?status=${status}`
        : '/api/customer/redemptions'
      
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error('Erro ao carregar resgates')
      }

      const data = await response.json()
      setRedemptions(data.redemptions || [])

    } catch (error) {
      console.error('Erro ao carregar resgates:', error)
      toast.error('Erro ao carregar resgates')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenDialog = (redemption: Redemption, action: 'APPROVED' | 'REJECTED' | 'DELIVERED') => {
    setSelectedRedemption(redemption)
    setActionType(action)
    setAdminNotes(redemption.adminNotes || '')
    setRejectionReason(redemption.rejectionReason || '')
    setDialogOpen(true)
  }

  const handleProcessRedemption = async () => {
    try {
      if (!selectedRedemption || !actionType) return

      if (actionType === 'REJECTED' && !rejectionReason.trim()) {
        toast.error('Motivo da rejeição é obrigatório')
        return
      }

      setIsProcessing(true)

      const response = await fetch(`/api/customer/redemptions/${selectedRedemption.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: actionType,
          adminNotes: adminNotes || null,
          rejectionReason: actionType === 'REJECTED' ? rejectionReason : null
        })
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || 'Erro ao processar resgate')
        return
      }

      const actionMessages = {
        APPROVED: 'Resgate aprovado com sucesso!',
        REJECTED: 'Resgate rejeitado. Pontos devolvidos ao cliente.',
        DELIVERED: 'Resgate marcado como entregue!'
      }

      toast.success(actionMessages[actionType])
      setDialogOpen(false)
      loadRedemptions(activeTab === 'all' ? undefined : activeTab)

    } catch (error) {
      console.error('Erro ao processar resgate:', error)
      toast.error('Erro ao processar resgate')
    } finally {
      setIsProcessing(false)
    }
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return 'Data inválida'
    }
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
      PENDING: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800', icon: <Clock className="w-3 h-3" /> },
      APPROVED: { label: 'Aprovado', color: 'bg-blue-100 text-blue-800', icon: <CheckCircle2 className="w-3 h-3" /> },
      DELIVERED: { label: 'Entregue', color: 'bg-green-500 text-white', icon: <CheckCircle2 className="w-3 h-3" /> },
      REJECTED: { label: 'Rejeitado', color: 'bg-red-100 text-red-800', icon: <XCircle className="w-3 h-3" /> }
    }

    const statusInfo = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800', icon: null }

    return (
      <Badge className={`${statusInfo.color} flex items-center gap-1`}>
        {statusInfo.icon}
        {statusInfo.label}
      </Badge>
    )
  }

  const filteredRedemptions = activeTab === 'all' 
    ? redemptions 
    : redemptions.filter(r => r.status === activeTab)

  const pendingCount = redemptions.filter(r => r.status === 'PENDING').length
  const approvedCount = redemptions.filter(r => r.status === 'APPROVED').length

  useEffect(() => {
    loadRedemptions(activeTab === 'all' ? undefined : activeTab)
  }, [activeTab])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-orange-600 mx-auto" />
          <p className="text-gray-600">Carregando resgates...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Award className="w-8 h-8 text-orange-600" />
          Gestão de Resgates
        </h1>
        <p className="text-gray-600 mt-2">
          Gerencie os resgates de prêmios dos seus clientes
        </p>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pendentes</p>
                <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Aprovados</p>
                <p className="text-2xl font-bold text-blue-600">{approvedCount}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Entregues</p>
                <p className="text-2xl font-bold text-green-600">
                  {redemptions.filter(r => r.status === 'DELIVERED').length}
                </p>
              </div>
              <Package className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-600">{redemptions.length}</p>
              </div>
              <Award className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs de Filtro */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="PENDING">
            Pendentes {pendingCount > 0 && `(${pendingCount})`}
          </TabsTrigger>
          <TabsTrigger value="APPROVED">
            Aprovados {approvedCount > 0 && `(${approvedCount})`}
          </TabsTrigger>
          <TabsTrigger value="DELIVERED">Entregues</TabsTrigger>
          <TabsTrigger value="REJECTED">Rejeitados</TabsTrigger>
          <TabsTrigger value="all">Todos</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4 mt-6">
          {filteredRedemptions.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center space-y-4">
                  <Package className="w-16 h-16 text-gray-300 mx-auto" />
                  <div>
                    <p className="text-gray-600 font-medium">Nenhum resgate encontrado</p>
                    <p className="text-sm text-gray-500">Não há resgates nesta categoria</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredRedemptions.map((redemption) => (
                <Card key={redemption.id} className="border-l-4 border-l-orange-500">
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      {/* Imagem do Prêmio */}
                      <div className="lg:col-span-2">
                        {redemption.Prize.imageUrl ? (
                          <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
                            <Image
                              src={redemption.Prize.imageUrl}
                              alt={redemption.Prize.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="aspect-square bg-gradient-to-br from-orange-100 to-red-100 rounded-lg flex items-center justify-center">
                            <ImageIcon className="w-12 h-12 text-orange-400" />
                          </div>
                        )}
                      </div>

                      {/* Informações do Prêmio */}
                      <div className="lg:col-span-4 space-y-3">
                        <div>
                          <h3 className="font-bold text-lg text-gray-900">{redemption.Prize.name}</h3>
                          {redemption.Prize.description && (
                            <p className="text-sm text-gray-600 mt-1">{redemption.Prize.description}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-1 text-orange-600">
                          <Star className="w-5 h-5 fill-current" />
                          <span className="font-bold">{redemption.pointsUsed}</span>
                          <span className="text-sm">pontos</span>
                        </div>

                        <div className="space-y-1 text-sm">
                          <p className="text-gray-600">
                            <span className="font-medium">Solicitado em:</span> {formatDate(redemption.requestedAt)}
                          </p>
                          {redemption.processedAt && (
                            <p className="text-gray-600">
                              <span className="font-medium">Processado em:</span> {formatDate(redemption.processedAt)}
                            </p>
                          )}
                          {redemption.deliveredAt && (
                            <p className="text-gray-600">
                              <span className="font-medium">Entregue em:</span> {formatDate(redemption.deliveredAt)}
                            </p>
                          )}
                        </div>

                        {redemption.notes && (
                          <div className="text-sm">
                            <p className="font-medium text-gray-700">Observação do cliente:</p>
                            <p className="text-gray-600 italic">"{redemption.notes}"</p>
                          </div>
                        )}
                      </div>

                      {/* Informações do Cliente */}
                      <div className="lg:col-span-3 space-y-3">
                        <div>
                          <p className="text-sm font-medium text-gray-500 mb-2">CLIENTE</p>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                              <User className="w-4 h-4 text-gray-400" />
                              <span className="text-gray-900">{redemption.ClientCustomer.name}</span>
                            </div>
                            {redemption.ClientCustomer.phone && (
                              <div className="flex items-center gap-2 text-sm">
                                <Phone className="w-4 h-4 text-gray-400" />
                                <span className="text-gray-600">{redemption.ClientCustomer.phone}</span>
                              </div>
                            )}
                            {redemption.ClientCustomer.email && (
                              <div className="flex items-center gap-2 text-sm">
                                <Mail className="w-4 h-4 text-gray-400" />
                                <span className="text-gray-600">{redemption.ClientCustomer.email}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {redemption.adminNotes && (
                          <div className="text-sm p-3 bg-blue-50 rounded-lg">
                            <p className="font-medium text-blue-900">Suas observações:</p>
                            <p className="text-blue-700 mt-1">{redemption.adminNotes}</p>
                          </div>
                        )}

                        {redemption.rejectionReason && (
                          <div className="text-sm p-3 bg-red-50 rounded-lg">
                            <p className="font-medium text-red-900">Motivo da rejeição:</p>
                            <p className="text-red-700 mt-1">{redemption.rejectionReason}</p>
                          </div>
                        )}
                      </div>

                      {/* Status e Ações */}
                      <div className="lg:col-span-3 space-y-3">
                        <div>
                          <p className="text-sm font-medium text-gray-500 mb-2">STATUS</p>
                          {getStatusBadge(redemption.status)}
                        </div>

                        {redemption.status === 'PENDING' && (
                          <div className="space-y-2">
                            <Button
                              onClick={() => handleOpenDialog(redemption, 'APPROVED')}
                              className="w-full bg-blue-600 hover:bg-blue-700"
                              size="sm"
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              Aprovar
                            </Button>
                            <Button
                              onClick={() => handleOpenDialog(redemption, 'REJECTED')}
                              variant="outline"
                              className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                              size="sm"
                            >
                              <XCircle className="w-4 h-4 mr-2" />
                              Rejeitar
                            </Button>
                          </div>
                        )}

                        {redemption.status === 'APPROVED' && (
                          <Button
                            onClick={() => handleOpenDialog(redemption, 'DELIVERED')}
                            className="w-full bg-green-600 hover:bg-green-700"
                            size="sm"
                          >
                            <Package className="w-4 h-4 mr-2" />
                            Marcar como Entregue
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Diálogo de Confirmação */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'APPROVED' && 'Aprovar Resgate'}
              {actionType === 'REJECTED' && 'Rejeitar Resgate'}
              {actionType === 'DELIVERED' && 'Confirmar Entrega'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'APPROVED' && 'O cliente será notificado sobre a aprovação'}
              {actionType === 'REJECTED' && 'Os pontos serão devolvidos ao cliente'}
              {actionType === 'DELIVERED' && 'Confirme que o prêmio foi entregue ao cliente'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {actionType === 'REJECTED' && (
              <div>
                <Label>Motivo da Rejeição *</Label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explique o motivo da rejeição..."
                  rows={3}
                />
              </div>
            )}

            <div>
              <Label>Observações (opcional)</Label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Adicione observações internas..."
                rows={3}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={() => setDialogOpen(false)}
                variant="outline"
                className="flex-1"
                disabled={isProcessing}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleProcessRedemption}
                className={`flex-1 ${
                  actionType === 'APPROVED' ? 'bg-blue-600 hover:bg-blue-700' :
                  actionType === 'REJECTED' ? 'bg-red-600 hover:bg-red-700' :
                  'bg-green-600 hover:bg-green-700'
                }`}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  'Confirmar'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
