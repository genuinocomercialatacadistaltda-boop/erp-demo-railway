
'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Edit2, Trash2, DollarSign, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'

interface Seller {
  id: string
  name: string
  email: string
}

interface Commission {
  id: string
  sellerId: string
  orderId: string | null
  amount: number
  description: string
  status: string
  releaseDate: string | null
  releasedBy: string | null
  createdAt: string
  updatedAt: string
  seller: Seller
}

export default function AdminCommissionsPage() {
  const { data: session, status } = useSession() || {}
  const router = useRouter()
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [filteredCommissions, setFilteredCommissions] = useState<Commission[]>([])
  const [sellers, setSellers] = useState<Seller[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSeller, setFilterSeller] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  
  const [selectedCommission, setSelectedCommission] = useState<Commission | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isCleanupDialogOpen, setIsCleanupDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const [editAmount, setEditAmount] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editStatus, setEditStatus] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    } else if (session && (session.user as any)?.userType !== 'ADMIN') {
      router.push('/dashboard')
    } else if (session && (session.user as any)?.userType === 'ADMIN') {
      fetchData()
    }
  }, [session, status, router])

  useEffect(() => {
    applyFilters()
  }, [searchTerm, filterSeller, filterStatus, commissions])

  const fetchData = async () => {
    try {
      console.log('🔍 Buscando dados de comissões e vendedores...')
      
      const [commissionsRes, sellersRes] = await Promise.all([
        fetch('/api/admin/commissions'),
        fetch('/api/sellers')
      ])
      
      console.log('📊 Status das respostas:', {
        commissions: commissionsRes.status,
        sellers: sellersRes.status
      })
      
      const commissionsData = await commissionsRes.json()
      const sellersData = await sellersRes.json()
      
      console.log('✅ Dados recebidos:', {
        commissionsData,
        sellersData
      })
      
      // A API retorna { commissions: [...] }, então acessamos a propriedade correta
      setCommissions(commissionsData.commissions || commissionsData || [])
      setSellers(sellersData || [])
    } catch (error) {
      console.error('❌ Erro ao buscar dados:', error)
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = commissions

    // Filtro por vendedor
    if (filterSeller !== 'all') {
      filtered = filtered.filter(c => c.sellerId === filterSeller)
    }

    // Filtro por status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(c => c.status === filterStatus)
    }

    // Filtro por busca
    if (searchTerm) {
      filtered = filtered.filter(c =>
        c.seller.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.orderId && c.orderId.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    setFilteredCommissions(filtered)
  }

  const handleEditCommission = (commission: Commission) => {
    setSelectedCommission(commission)
    setEditAmount(commission.amount.toString())
    setEditDescription(commission.description)
    setEditStatus(commission.status)
    setIsEditDialogOpen(true)
  }

  const handleDeleteCommission = (commission: Commission) => {
    setSelectedCommission(commission)
    setIsDeleteDialogOpen(true)
  }

  const confirmEdit = async () => {
    if (!selectedCommission) return

    setIsSubmitting(true)

    try {
      const res = await fetch(`/api/admin/commissions/${selectedCommission.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(editAmount),
          description: editDescription,
          status: editStatus
        })
      })

      if (!res.ok) throw new Error('Erro ao atualizar comissão')

      toast.success('Comissão atualizada com sucesso!')
      setIsEditDialogOpen(false)
      fetchData()
    } catch (error) {
      console.error('Error updating commission:', error)
      toast.error('Erro ao atualizar comissão')
    } finally {
      setIsSubmitting(false)
    }
  }

  const confirmDelete = async () => {
    if (!selectedCommission) return

    setIsSubmitting(true)

    try {
      const res = await fetch(`/api/admin/commissions/${selectedCommission.id}`, {
        method: 'DELETE'
      })

      if (!res.ok) throw new Error('Erro ao excluir comissão')

      toast.success('Comissão excluída com sucesso!')
      setIsDeleteDialogOpen(false)
      fetchData()
    } catch (error) {
      console.error('Error deleting commission:', error)
      toast.error('Erro ao excluir comissão')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCleanupOrphans = async () => {
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/admin/commissions/cleanup', {
        method: 'POST'
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Erro ao limpar comissões órfãs')

      toast.success(data.message)
      setIsCleanupDialogOpen(false)
      fetchData()
    } catch (error: any) {
      console.error('Error cleaning up orphan commissions:', error)
      toast.error(error.message || 'Erro ao limpar comissões órfãs')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any } } = {
      PENDING: { label: 'Pendente', variant: 'secondary', icon: Clock },
      RELEASED: { label: 'Liberada', variant: 'default', icon: CheckCircle },
      PAID: { label: 'Paga', variant: 'default', icon: DollarSign }
    }
    const { label, variant, icon: Icon } = statusMap[status] || { label: status, variant: 'outline', icon: AlertTriangle }
    return (
      <Badge variant={variant} className="flex items-center gap-1 w-fit">
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    )
  }

  const calculateStats = () => {
    const total = filteredCommissions.reduce((sum, c) => sum + c.amount, 0)
    const pending = filteredCommissions.filter(c => c.status === 'PENDING').reduce((sum, c) => sum + c.amount, 0)
    const released = filteredCommissions.filter(c => c.status === 'RELEASED').reduce((sum, c) => sum + c.amount, 0)
    const paid = filteredCommissions.filter(c => c.status === 'PAID').reduce((sum, c) => sum + c.amount, 0)

    return { total, pending, released, paid }
  }

  const stats = calculateStats()

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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Gestão de Comissões
            </h1>
            <p className="text-gray-600">
              Gerencie valores e status das comissões dos vendedores
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setIsCleanupDialogOpen(true)}
            className="border-orange-600 text-orange-600 hover:bg-orange-50"
          >
            <AlertTriangle className="h-5 w-5 mr-2" />
            Limpar Órfãs
          </Button>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                R$ {stats.total.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {filteredCommissions.length} comissões
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                R$ {stats.pending.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Liberadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                R$ {stats.released.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pagas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                R$ {stats.paid.toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Comissões</CardTitle>
            <CardDescription>
              Visualize, edite e gerencie todas as comissões dos vendedores
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Filtros */}
            <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Buscar</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Vendedor, descrição ou pedido..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label>Vendedor</Label>
                <Select value={filterSeller} onValueChange={setFilterSeller}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {sellers.map(seller => (
                      <SelectItem key={seller.id} value={seller.id}>
                        {seller.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="PENDING">Pendente</SelectItem>
                    <SelectItem value="RELEASED">Liberada</SelectItem>
                    <SelectItem value="PAID">Paga</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {filteredCommissions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {searchTerm || filterSeller !== 'all' || filterStatus !== 'all'
                    ? 'Nenhuma comissão encontrada'
                    : 'Nenhuma comissão cadastrada'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendedor</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCommissions.map((commission) => (
                      <TableRow key={commission.id}>
                        <TableCell className="font-medium">
                          {commission.seller.name}
                        </TableCell>
                        <TableCell>{commission.description}</TableCell>
                        <TableCell>
                          {commission.orderId ? (
                            <Badge variant="outline">{commission.orderId.substring(0, 8)}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="font-bold text-green-600">
                          R$ {commission.amount.toFixed(2)}
                        </TableCell>
                        <TableCell>{getStatusBadge(commission.status)}</TableCell>
                        <TableCell>
                          {format(new Date(commission.createdAt), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditCommission(commission)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteCommission(commission)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Edição */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Comissão</DialogTitle>
            <DialogDescription>
              Altere o valor, descrição ou status da comissão
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Vendedor</Label>
              <Input value={selectedCommission?.seller.name} disabled className="mt-1" />
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">Pendente</SelectItem>
                  <SelectItem value="RELEASED">Liberada</SelectItem>
                  <SelectItem value="PAID">Paga</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button onClick={confirmEdit} disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir permanentemente esta comissão de <strong>{selectedCommission?.seller.name}</strong> no valor de <strong>R$ {selectedCommission?.amount.toFixed(2)}</strong>?
              <br /><br />
              <span className="text-red-600 font-semibold">
                Esta ação não pode ser desfeita.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isSubmitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? 'Excluindo...' : 'Sim, excluir permanentemente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Limpeza de Órfãs */}
      <AlertDialog open={isCleanupDialogOpen} onOpenChange={setIsCleanupDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar Comissões Órfãs</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá excluir todas as comissões cujos pedidos associados já não existem mais no sistema.
              <br /><br />
              Isso é útil para limpar comissões de pedidos que foram excluídos anteriormente mas cujas comissões permaneceram no banco de dados.
              <br /><br />
              <span className="text-orange-600 font-semibold">
                Esta ação não pode ser desfeita.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCleanupOrphans}
              disabled={isSubmitting}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isSubmitting ? 'Limpando...' : 'Sim, limpar comissões órfãs'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
