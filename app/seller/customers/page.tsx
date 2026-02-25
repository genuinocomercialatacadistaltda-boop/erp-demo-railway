
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
import { Plus, Search, Mail, Phone, MapPin, Edit, Home, Trash2, Package } from 'lucide-react'
import { toast } from 'sonner'
import { HomeButton } from '@/components/home-button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

export default function SellerCustomersPage() {
  const { data: session, status } = useSession() || {}
  const router = useRouter()
  const [customers, setCustomers] = useState<any[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [customerToDelete, setCustomerToDelete] = useState<any>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    cpfCnpj: '',
    city: '',
    address: '',
    creditLimit: '0',
    customDiscount: '0',
    paymentTerms: '30',
    password: '',
    isActive: true,
    allowInstallments: false,
    installmentOptions: '',
    birthDate: ''
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    } else if (session && (session.user as any)?.userType !== 'SELLER') {
      router.push('/dashboard')
    } else if (session && (session.user as any)?.userType === 'SELLER') {
      fetchCustomers()
    }
  }, [session, status, router])

  useEffect(() => {
    const filtered = customers.filter(customer =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.cpfCnpj.includes(searchTerm)
    )
    setFilteredCustomers(filtered)
  }, [searchTerm, customers])

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/sellers/customers')
      const data = await res.json()
      setCustomers(data)
      setFilteredCustomers(data)
    } catch (error) {
      console.error('Error fetching customers:', error)
      toast.error('Erro ao buscar clientes')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenEdit = async (customer: any) => {
    setIsEditMode(true)
    setEditingCustomerId(customer.id)
    setFormData({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      cpfCnpj: customer.cpfCnpj,
      city: customer.city,
      address: customer.address || '',
      creditLimit: customer.creditLimit?.toString() || '0',
      customDiscount: customer.customDiscount?.toString() || '0',
      paymentTerms: customer.paymentTerms?.toString() || '30',
      password: '',
      isActive: customer.isActive,
      allowInstallments: customer.allowInstallments || false,
      installmentOptions: customer.installmentOptions || '',
      birthDate: customer.birthDate ? new Date(customer.birthDate).toISOString().split('T')[0] : ''
    })
    setIsDialogOpen(true)
  }

  const handleOpenCreate = () => {
    setIsEditMode(false)
    setEditingCustomerId(null)
    setFormData({
      name: '',
      email: '',
      phone: '',
      cpfCnpj: '',
      city: '',
      address: '',
      creditLimit: '0',
      customDiscount: '0',
      paymentTerms: '30',
      password: '',
      isActive: true,
      allowInstallments: false,
      installmentOptions: '',
      birthDate: ''
    })
    setIsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    console.log('📝 [SUBMIT] Iniciando envio do formulário')
    console.log('   - Modo:', isEditMode ? 'EDIÇÃO' : 'CRIAÇÃO')
    console.log('   - Cliente ID:', editingCustomerId)

    try {
      const url = isEditMode 
        ? `/api/sellers/customers/${editingCustomerId}`
        : '/api/sellers/customers'
      
      const method = isEditMode ? 'PATCH' : 'POST'

      const payload: any = {
        ...formData,
        creditLimit: parseFloat(formData.creditLimit),
        customDiscount: parseFloat(formData.customDiscount),
        paymentTerms: parseInt(formData.paymentTerms),
        allowInstallments: formData.allowInstallments,
        installmentOptions: formData.allowInstallments && formData.installmentOptions ? formData.installmentOptions.trim() : null,
        birthDate: formData.birthDate || null
      }

      // Remover password do payload se estiver vazio (para não resetar senha na edição)
      if (!payload.password || payload.password.trim() === '') {
        delete payload.password
        console.log('   ⏭️ Campo senha vazio - não será enviado (senha atual será mantida)')
      } else {
        console.log('   🔐 Campo senha preenchido - será enviado para atualização')
      }

      console.log('🚀 [SUBMIT] Enviando requisição')
      console.log('   - URL:', url)
      console.log('   - Método:', method)
      console.log('   - Payload:', { ...payload, password: payload.password ? '[OCULTO]' : '[VAZIO]' })

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      console.log('📬 [SUBMIT] Resposta recebida')
      console.log('   - Status:', res.status)
      console.log('   - Status Text:', res.statusText)

      const data = await res.json()
      console.log('📦 [SUBMIT] Dados da resposta:', data)

      if (!res.ok) {
        console.error('❌ [SUBMIT] Erro na resposta:', data.error)
        toast.error(data.error || `Erro ao ${isEditMode ? 'atualizar' : 'cadastrar'} cliente`)
        return
      }

      console.log('✅ [SUBMIT] Cliente salvo com sucesso!')
      
      // Mostrar mensagem com informação sobre senha padrão
      toast.success(data.message || `Cliente ${isEditMode ? 'atualizado' : 'cadastrado'} com sucesso!`, {
        duration: data.defaultPassword ? 6000 : 3000
      })

      setIsDialogOpen(false)
      setIsEditMode(false)
      setEditingCustomerId(null)
      setFormData({
        name: '',
        email: '',
        phone: '',
        cpfCnpj: '',
        city: '',
        address: '',
        creditLimit: '0',
        customDiscount: '0',
        paymentTerms: '30',
        password: '',
        isActive: true,
        allowInstallments: false,
        installmentOptions: '',
        birthDate: ''
      })
      fetchCustomers()
    } catch (error) {
      console.error('❌ [SUBMIT] Erro ao salvar cliente:', error)
      toast.error(`Erro ao ${isEditMode ? 'atualizar' : 'cadastrar'} cliente`)
    }
  }

  const handleOpenDeleteDialog = (customer: any) => {
    setCustomerToDelete(customer)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!customerToDelete) return

    try {
      const res = await fetch(`/api/sellers/customers/${customerToDelete.id}`, {
        method: 'DELETE'
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Erro ao excluir cliente')
        return
      }

      toast.success('Cliente excluído com sucesso!')
      setDeleteDialogOpen(false)
      setCustomerToDelete(null)
      fetchCustomers()
    } catch (error) {
      console.error('Error deleting customer:', error)
      toast.error('Erro ao excluir cliente')
    }
  }

  const handleManageCatalog = (customer: any) => {
    // Navegar para a página de gerenciamento de catálogo do cliente
    router.push(`/seller/customers/${customer.id}/catalog`)
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

  if (!session || (session.user as any)?.userType !== 'SELLER') {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Meus Clientes
            </h1>
            <p className="text-gray-600">
              Gerencie seus clientes cadastrados
            </p>
          </div>
          <HomeButton />
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>Lista de Clientes</CardTitle>
                <CardDescription>
                  Total de {customers.length} clientes cadastrados
                </CardDescription>
              </div>
              <Button onClick={handleOpenCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Cliente
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, email ou CPF/CNPJ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {filteredCustomers.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {searchTerm ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado ainda'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>CPF/CNPJ</TableHead>
                      <TableHead>Cidade</TableHead>
                      <TableHead>Limite Total</TableHead>
                      <TableHead>Limite Disponível</TableHead>
                      <TableHead>Status Pagamento</TableHead>
                      <TableHead>Pedidos</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1 text-sm">
                              <Mail className="h-3 w-3" />
                              {customer.email}
                            </div>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {customer.phone}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{customer.cpfCnpj}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {customer.city}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-green-600">
                            R$ {(customer.creditLimit || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`font-medium ${(customer.availableCredit || 0) > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            R$ {(customer.availableCredit || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={(customer as any).paymentStatus === 'ATRASADO' ? 'destructive' : 'default'}>
                            {(customer as any).paymentStatus === 'ATRASADO' ? '⚠️ Atrasado' : '✓ Em dia'}
                          </Badge>
                          {(customer as any).overdueBoletos > 0 && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {(customer as any).overdueBoletos} boleto(s) vencido(s)
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{customer._count?.Order || 0}</TableCell>
                        <TableCell>
                          <Badge variant={customer.isActive ? 'default' : 'secondary'}>
                            {customer.isActive ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleManageCatalog(customer)}
                              title="Gerenciar Catálogo"
                            >
                              <Package className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEdit(customer)}
                              title="Editar Cliente"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDeleteDialog(customer)}
                              className="text-destructive hover:text-destructive"
                              title="Excluir Cliente"
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

        {/* Dialog de Cadastro/Edição */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {isEditMode ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}
              </DialogTitle>
              <DialogDescription>
                {isEditMode ? 'Atualize os dados do cliente' : 'Preencha os dados do novo cliente'}
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
                        <Label htmlFor="cpfCnpj">CPF/CNPJ *</Label>
                        <Input
                          id="cpfCnpj"
                          value={formData.cpfCnpj}
                          onChange={(e) => setFormData({ ...formData, cpfCnpj: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="city">Cidade *</Label>
                        <Input
                          id="city"
                          value={formData.city}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="address">Endereço</Label>
                        <Input
                          id="address"
                          value={formData.address}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="birthDate">Data de Nascimento (opcional) 🎂</Label>
                        <Input
                          id="birthDate"
                          type="date"
                          value={formData.birthDate}
                          onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                          placeholder="Usado para enviar cupons de aniversário"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Para enviar cupons de desconto no aniversário do cliente
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="creditLimit">Limite de Crédito</Label>
                        <Input
                          id="creditLimit"
                          type="number"
                          step="0.01"
                          value={formData.creditLimit}
                          onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="customDiscount">Desconto Personalizado (%)</Label>
                        <Input
                          id="customDiscount"
                          type="number"
                          step="0.01"
                          value={formData.customDiscount}
                          onChange={(e) => setFormData({ ...formData, customDiscount: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="paymentTerms">Prazo de Pagamento (dias)</Label>
                        <Input
                          id="paymentTerms"
                          type="number"
                          value={formData.paymentTerms}
                          onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                        />
                      </div>

                      <div className="space-y-4 border-t pt-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <Label className="text-base font-medium">Permitir Boletos Parcelados</Label>
                            <p className="text-sm text-muted-foreground">
                              Habilite para permitir que o cliente parcele boletos em múltiplas parcelas
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant={formData.allowInstallments ? "default" : "outline"}
                            size="sm"
                            onClick={() => setFormData({ ...formData, allowInstallments: !formData.allowInstallments })}
                            className={formData.allowInstallments ? "bg-green-600 hover:bg-green-700" : ""}
                          >
                            {formData.allowInstallments ? "Habilitado" : "Desabilitado"}
                          </Button>
                        </div>

                        {formData.allowInstallments && (
                          <div className="space-y-2">
                            <Label>Opções de Parcelamento (prazos em dias)</Label>
                            <Input 
                              placeholder="Ex: 7,14,21,28 ou 3,7,14"
                              value={formData.installmentOptions} 
                              onChange={(e) => setFormData({ ...formData, installmentOptions: e.target.value })} 
                            />
                            <p className="text-xs text-muted-foreground">
                              Configure os prazos de vencimento separados por vírgula.<br />
                              <strong>Exemplos:</strong><br />
                              • <strong>7,14,21</strong> = 3 parcelas (vence em 7, 14 e 21 dias)<br />
                              • <strong>7,14,21,28</strong> = 4 parcelas (vence em 7, 14, 21 e 28 dias)<br />
                              • <strong>3,7</strong> = 2 parcelas (vence em 3 e 7 dias)
                            </p>
                          </div>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="password">
                          {isEditMode ? 'Nova Senha (opcional)' : 'Senha para Login'}
                        </Label>
                        <Input
                          id="password"
                          type="password"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          placeholder={isEditMode ? "Deixe em branco para não alterar" : "Deixe em branco para senha padrão: 123456"}
                          autoComplete="new-password"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {isEditMode 
                            ? 'Deixe em branco para manter a senha atual' 
                            : 'Se deixar em branco, a senha padrão será: 123456'}
                        </p>
                      </div>
                      {isEditMode && (
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="isActive"
                            checked={formData.isActive}
                            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          <Label htmlFor="isActive">Cliente Ativo</Label>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit">
                        {isEditMode ? 'Atualizar Cliente' : 'Cadastrar Cliente'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>

        {/* Dialog de Confirmação de Exclusão */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o cliente <strong>{customerToDelete?.name}</strong>?
                <br /><br />
                <span className="text-destructive font-semibold">⚠️ Esta ação não pode ser desfeita!</span>
                <br /><br />
                Todos os dados relacionados ao cliente serão removidos permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir Cliente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
