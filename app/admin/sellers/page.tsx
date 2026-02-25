'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Users, DollarSign, ShoppingCart, Edit, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export default function AdminSellersPage() {
  const { data: session, status } = useSession() || {}
  const router = useRouter()
  const [sellers, setSellers] = useState<any[]>([])
  const [filteredSellers, setFilteredSellers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingSeller, setEditingSeller] = useState<any>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    cpf: '',
    password: '',
    commissionRate: '1.0',
    maxDiscountRate: '10.0'
  })
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    phone: '',
    cpf: '',
    password: '',
    commissionRate: '1.0',
    maxDiscountRate: '10.0',
    isActive: true
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    } else if (session && (session.user as any)?.userType !== 'ADMIN') {
      router.push('/dashboard')
    } else if (session && (session.user as any)?.userType === 'ADMIN') {
      fetchSellers()
    }
  }, [session, status, router])

  useEffect(() => {
    const filtered = sellers.filter(seller =>
      seller.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      seller.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      seller.cpf.includes(searchTerm)
    )
    setFilteredSellers(filtered)
  }, [searchTerm, sellers])

  const fetchSellers = async () => {
    try {
      const res = await fetch('/api/sellers')
      const data = await res.json()
      setSellers(data)
      setFilteredSellers(data)
    } catch (error) {
      console.error('Error fetching sellers:', error)
      toast.error('Erro ao buscar vendedores')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const res = await fetch('/api/sellers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          commissionRate: parseFloat(formData.commissionRate),
          maxDiscountRate: parseFloat(formData.maxDiscountRate)
        })
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Erro ao criar vendedor')
        return
      }

      toast.success('Vendedor criado com sucesso!')
      setIsDialogOpen(false)
      setFormData({
        name: '',
        email: '',
        phone: '',
        cpf: '',
        password: '',
        commissionRate: '1.0',
        maxDiscountRate: '10.0'
      })
      fetchSellers()
    } catch (error) {
      console.error('Error creating seller:', error)
      toast.error('Erro ao criar vendedor')
    }
  }

  const handleEditSeller = (seller: any) => {
    setEditingSeller(seller)
    setEditFormData({
      name: seller.name,
      email: seller.email,
      phone: seller.phone,
      cpf: seller.cpf,
      password: '',
      commissionRate: seller.commissionRate?.toString() || '1.0',
      maxDiscountRate: seller.maxDiscountRate?.toString() || '10.0',
      isActive: seller.isActive
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdateSeller = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!editingSeller) return

    try {
      const updateData: any = {
        name: editFormData.name,
        email: editFormData.email,
        phone: editFormData.phone,
        cpf: editFormData.cpf,
        commissionRate: parseFloat(editFormData.commissionRate),
        maxDiscountRate: parseFloat(editFormData.maxDiscountRate),
        isActive: editFormData.isActive
      }

      // Só envia senha se foi preenchida
      if (editFormData.password.trim()) {
        updateData.password = editFormData.password
      }

      const res = await fetch(`/api/sellers/${editingSeller.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Erro ao atualizar vendedor')
        return
      }

      toast.success('Vendedor atualizado com sucesso!')
      setIsEditDialogOpen(false)
      setEditingSeller(null)
      fetchSellers()
    } catch (error) {
      console.error('Error updating seller:', error)
      toast.error('Erro ao atualizar vendedor')
    }
  }

  const handleDeleteSeller = async (sellerId: string, sellerName: string) => {
    if (!confirm(`Tem certeza que deseja EXCLUIR PERMANENTEMENTE o vendedor "${sellerName}"?\n\nEsta ação irá:\n- Remover o vendedor do sistema\n- Desassociar todos os clientes\n- Excluir todas as comissões\n- Excluir o usuário associado\n\nEsta ação NÃO PODE SER DESFEITA!`)) {
      return
    }

    try {
      const res = await fetch(`/api/sellers/${sellerId}`, {
        method: 'DELETE'
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Erro ao excluir vendedor')
        return
      }

      toast.success('Vendedor excluído com sucesso!')
      fetchSellers()
    } catch (error) {
      console.error('Error deleting seller:', error)
      toast.error('Erro ao excluir vendedor')
    }
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

  if (!session || (session.user as any)?.userType !== 'ADMIN') {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Gerenciar Vendedores
          </h1>
          <p className="text-gray-600">
            Administração de vendedores e suas comissões
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>Lista de Vendedores</CardTitle>
                <CardDescription>
                  Total de {sellers.length} vendedores cadastrados
                </CardDescription>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Cadastrar Vendedor
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Cadastrar Novo Vendedor</DialogTitle>
                    <DialogDescription>
                      Preencha os dados do novo vendedor
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">Nome *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone">Telefone *</Label>
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="cpf">CPF *</Label>
                        <Input
                          id="cpf"
                          value={formData.cpf}
                          onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="password">Senha *</Label>
                        <Input
                          id="password"
                          type="password"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="commissionRate">Taxa de Comissão (%)</Label>
                        <Input
                          id="commissionRate"
                          type="number"
                          step="0.1"
                          value={formData.commissionRate}
                          onChange={(e) => setFormData({ ...formData, commissionRate: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="maxDiscountRate">Desconto Máximo (%)</Label>
                        <Input
                          id="maxDiscountRate"
                          type="number"
                          step="0.1"
                          value={formData.maxDiscountRate}
                          onChange={(e) => setFormData({ ...formData, maxDiscountRate: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit">
                        Cadastrar Vendedor
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, email ou CPF..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {filteredSellers.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {searchTerm ? 'Nenhum vendedor encontrado' : 'Nenhum vendedor cadastrado ainda'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Clientes</TableHead>
                      <TableHead>Pedidos</TableHead>
                      <TableHead>Comissões</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSellers.map((seller) => (
                      <TableRow key={seller.id}>
                        <TableCell className="font-medium">{seller.name}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="text-sm">{seller.email}</div>
                            <div className="text-sm text-muted-foreground">{seller.phone}</div>
                          </div>
                        </TableCell>
                        <TableCell>{seller.cpf}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            <Users className="h-3 w-3 mr-1" />
                            {seller._count?.customers || 0}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            <ShoppingCart className="h-3 w-3 mr-1" />
                            {seller._count?.Order || 0}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="text-sm font-medium text-green-600">
                              Total: R$ {seller.totalCommissions?.toFixed(2) || '0.00'}
                            </div>
                            <div className="text-xs text-amber-600">
                              Pendente: R$ {seller.pendingCommissions?.toFixed(2) || '0.00'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={seller.isActive ? 'default' : 'secondary'}>
                            {seller.isActive ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleEditSeller(seller)}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Editar
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={() => handleDeleteSeller(seller.id, seller.name)}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Excluir
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

        {/* Dialog de Edição */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Editar Vendedor</DialogTitle>
              <DialogDescription>
                Altere os dados do vendedor {editingSeller?.name}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateSeller} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-name">Nome *</Label>
                  <Input
                    id="edit-name"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-email">Email *</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-phone">Telefone *</Label>
                  <Input
                    id="edit-phone"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-cpf">CPF *</Label>
                  <Input
                    id="edit-cpf"
                    value={editFormData.cpf}
                    onChange={(e) => setEditFormData({ ...editFormData, cpf: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-password">Nova Senha (deixe em branco para manter)</Label>
                  <Input
                    id="edit-password"
                    type="password"
                    value={editFormData.password}
                    onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                    placeholder="Digite apenas se quiser alterar"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-commissionRate">Taxa de Comissão (%)</Label>
                  <Input
                    id="edit-commissionRate"
                    type="number"
                    step="0.1"
                    value={editFormData.commissionRate}
                    onChange={(e) => setEditFormData({ ...editFormData, commissionRate: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-maxDiscountRate">Desconto Máximo (%)</Label>
                  <Input
                    id="edit-maxDiscountRate"
                    type="number"
                    step="0.1"
                    value={editFormData.maxDiscountRate}
                    onChange={(e) => setEditFormData({ ...editFormData, maxDiscountRate: e.target.value })}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="edit-isActive"
                    checked={editFormData.isActive}
                    onChange={(e) => setEditFormData({ ...editFormData, isActive: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="edit-isActive" className="cursor-pointer">
                    Vendedor Ativo
                  </Label>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsEditDialogOpen(false)
                    setEditingSeller(null)
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit">
                  Salvar Alterações
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
