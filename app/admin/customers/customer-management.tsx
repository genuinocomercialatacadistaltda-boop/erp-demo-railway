'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Flame, ArrowLeft, Plus, Pencil, Trash2, Users, Search, DollarSign, CreditCard, Package, Home, Unlock, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { HomeButton } from '@/components/home-button'

interface Customer {
  id: string
  name: string
  email: string | null
  phone: string
  cpfCnpj: string
  city: string
  address: string | null
  creditLimit: number
  availableCredit: number
  customDiscount: number
  paymentTerms: number
  createdAt: string
  orders: Array<{ id: string; total: number }>
  sellerId: string | null
  Seller: { name: string } | null
  allowInstallments: boolean
  installmentOptions: string | null
  canPayWithBoleto: boolean
  birthDate: string | null
  isActive: boolean                // 🔧 Status ativo/inativo
  manuallyUnblocked?: boolean
  unblockedAt?: string | null
  unblockedBy?: string | null
  isEmployee?: boolean  // Flag para identificar funcionários
  position?: string     // Cargo do funcionário
}

interface CustomerManagementProps {
  customers: Customer[]
}

export function CustomerManagement({ customers: initialCustomers }: CustomerManagementProps) {
  const router = useRouter()
  const [customers, setCustomers] = useState(initialCustomers)
  const [searchTerm, setSearchTerm] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [sellers, setSellers] = useState<Array<{ id: string; name: string }>>([])

  // 🔧 NOVOS ESTADOS: Abas e Filtros
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active')
  const [paymentTermsFilter, setPaymentTermsFilter] = useState<string>('all')
  const [creditLimitFilter, setCreditLimitFilter] = useState<string>('all')
  const [inactivityDaysFilter, setInactivityDaysFilter] = useState<string>('all')
  const [neverOrderedFilter, setNeverOrderedFilter] = useState<boolean>(false)
  const [noCustomCatalogFilter, setNoCustomCatalogFilter] = useState<boolean>(false)
  
  // 🆕 FILTRO DE DATA DE CADASTRO
  const [startDateFilter, setStartDateFilter] = useState<string>('')
  const [endDateFilter, setEndDateFilter] = useState<string>('')
  const [totalCustomers, setTotalCustomers] = useState<number>(initialCustomers.length)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [creditLimit, setCreditLimit] = useState('1000')
  const [customDiscount, setCustomDiscount] = useState('0')
  const [sellerId, setSellerId] = useState<string>('')
  const [paymentTerms, setPaymentTerms] = useState('30')
  const [password, setPassword] = useState('')
  const [allowInstallments, setAllowInstallments] = useState(false)
  const [installmentOptions, setInstallmentOptions] = useState('')
  const [canPayWithBoleto, setCanPayWithBoleto] = useState(true)
  const [birthDate, setBirthDate] = useState('')
  const [referredBy, setReferredBy] = useState('')

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (customer.email && customer.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (customer.city && customer.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (customer.cpfCnpj && customer.cpfCnpj.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (customer.phone && customer.phone.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  // 🔧 Carregar clientes com filtros
  const loadCustomers = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      
      // Aplicar filtro de aba (ativo/inativo)
      params.append('isActive', activeTab === 'active' ? 'true' : 'false')
      
      // Aplicar outros filtros
      if (paymentTermsFilter && paymentTermsFilter !== 'all') params.append('paymentTerms', paymentTermsFilter)
      if (creditLimitFilter && creditLimitFilter !== 'all') params.append('creditLimit', creditLimitFilter)
      if (inactivityDaysFilter && inactivityDaysFilter !== 'all') params.append('inactivityDays', inactivityDaysFilter)
      if (neverOrderedFilter) params.append('neverOrdered', 'true')
      if (noCustomCatalogFilter) params.append('noCustomCatalog', 'true')
      
      // 🆕 Filtro de data de cadastro
      if (startDateFilter) params.append('startDate', startDateFilter)
      if (endDateFilter) params.append('endDate', endDateFilter)
      
      const res = await fetch(`/api/customers?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setCustomers(data)
        console.log('🔄 Clientes recarregados:', data.length)
      }
      
      // 🆕 Buscar total de clientes (sem filtro de data)
      if (!startDateFilter && !endDateFilter) {
        setTotalCustomers(customers.length)
      }
    } catch (error) {
      console.error('Erro ao carregar clientes:', error)
      toast.error('Erro ao carregar clientes')
    }
  }, [activeTab, paymentTermsFilter, creditLimitFilter, inactivityDaysFilter, neverOrderedFilter, noCustomCatalogFilter, startDateFilter, endDateFilter])
  
  // 🆕 Buscar total geral de clientes (uma vez ao montar)
  useEffect(() => {
    const fetchTotalCustomers = async () => {
      try {
        const res = await fetch('/api/customers?isActive=true')
        if (res.ok) {
          const data = await res.json()
          setTotalCustomers(data.length)
        }
      } catch (error) {
        console.error('Erro ao buscar total de clientes:', error)
      }
    }
    fetchTotalCustomers()
  }, [])

  // Recarregar clientes quando filtros mudam
  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  // Buscar vendedores
  useEffect(() => {
    const fetchSellers = async () => {
      try {
        const res = await fetch('/api/sellers')
        if (res.ok) {
          const data = await res.json()
          setSellers(data)
        }
      } catch (error) {
        console.error('Erro ao buscar vendedores:', error)
      }
    }
    fetchSellers()
  }, [])

  // 🔧 NOVA FUNÇÃO: Inativar/Ativar cliente
  const handleToggleActive = async (customer: Customer) => {
    try {
      const newStatus = !customer.isActive
      const res = await fetch(`/api/customers/${customer.id}/toggle-active`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: newStatus })
      })

      if (!res.ok) throw new Error('Falha ao atualizar status')

      toast.success(`Cliente ${newStatus ? 'ativado' : 'inativado'} com sucesso!`)
      await loadCustomers()
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao atualizar status do cliente')
    }
  }

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer)
    // Remover sufixo "(Funcionário)" do nome se existir
    const cleanName = customer.name?.replace(' (Funcionário)', '') || ''
    setName(cleanName)
    setEmail(customer.email || '')
    setPhone(customer.phone || '')
    setCpfCnpj(customer.cpfCnpj || '')
    setCity(customer.city || '')
    setAddress(customer.address || '')
    setCreditLimit((customer.creditLimit ?? 0).toString())
    setCustomDiscount((customer.customDiscount ?? 0).toString())
    setPaymentTerms((customer.paymentTerms ?? 30).toString())
    setSellerId(customer.sellerId || '')
    setAllowInstallments(customer.allowInstallments ?? false)
    setCanPayWithBoleto(customer.canPayWithBoleto ?? true)
    setInstallmentOptions(customer.installmentOptions || '')
    setBirthDate(customer.birthDate ? new Date(customer.birthDate).toISOString().split('T')[0] : '')
    setPassword('')
    setIsDialogOpen(true)
  }

  // Removida função de validação de código de indicação

  const handleAdd = () => {
    setEditingCustomer(null)
    setName('')
    setEmail('')
    setPhone('')
    setCpfCnpj('')
    setCity('')
    setAddress('')
    setCreditLimit('1000')
    setCustomDiscount('0')
    setPaymentTerms('30')
    setSellerId('')
    setAllowInstallments(false)
    setInstallmentOptions('')
    setBirthDate('')
    setReferredBy('')
    setPassword('')
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    try {
      // 🔥 Detectar se é funcionário ou cliente
      const isEmployee = editingCustomer?.isEmployee === true
      
      let url: string
      let method: string
      let payload: any

      if (isEmployee && editingCustomer) {
        // 🧑‍💼 Salvando FUNCIONÁRIO
        url = `/api/hr/employees/${editingCustomer.id}`
        method = 'PUT'
        payload = {
          name: name || 'Funcionário Sem Nome',
          email: email || null,
          phone: phone || '',
          cpf: cpfCnpj || '',
          address: address || null,
          creditLimit: parseFloat(creditLimit) || 0,
        }
        
        console.log('🧑‍💼 [ADMIN] Salvando FUNCIONÁRIO...')
        console.log('   - ID:', editingCustomer.id)
        console.log('   - Nome:', name)
        console.log('   - Limite de Crédito:', creditLimit)
      } else {
        // 👤 Salvando CLIENTE
        url = editingCustomer ? `/api/customers/${editingCustomer.id}` : '/api/customers'
        method = editingCustomer ? 'PUT' : 'POST'
        payload = {
          name: name || 'Cliente Sem Nome',
          email: email || null,
          phone: phone || '',
          cpfCnpj: cpfCnpj || '',
          city: city || '',
          address: address || null,
          creditLimit: parseFloat(creditLimit) || 0,
          customDiscount: parseFloat(customDiscount) || 0,
          paymentTerms: parseInt(paymentTerms) || 30,
          allowInstallments: allowInstallments,
          installmentOptions: allowInstallments && installmentOptions ? installmentOptions.trim() : null,
          canPayWithBoleto: canPayWithBoleto,
          sellerId: sellerId || null,
          birthDate: birthDate || null,
          referredBy: referredBy || null
        }

        console.log('👤 [ADMIN] Salvando CLIENTE...')
        console.log('   - Modo:', editingCustomer ? 'EDIÇÃO' : 'CRIAÇÃO')
        console.log('   - Senha fornecida?', password ? 'SIM (será incluída no payload)' : 'NÃO (senha atual será mantida)')
        
        // Só adicionar senha ao payload se realmente tiver conteúdo
        if (password && password.trim().length > 0) {
          console.log('   ✅ Incluindo senha no payload')
          payload.password = password
        } else {
          console.log('   ⏭️ Senha não será alterada (campo vazio ou em branco)')
        }
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        const savedData = await response.json()
        
        if (isEmployee) {
          toast.success('Funcionário atualizado com sucesso!')
        } else if (referredBy) {
          toast.success('Cliente salvo e indicação registrada!')
        } else {
          toast.success('Cliente salvo com sucesso!')
        }
        
        setIsDialogOpen(false)
        window.location.reload()
      } else {
        const error = await response.json()
        toast.error(error.error || `Erro ao salvar ${isEmployee ? 'funcionário' : 'cliente'}`)
      }
    } catch (error) {
      console.error(error)
      toast.error('Erro ao salvar')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return

    try {
      const response = await fetch(`/api/customers/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Erro ao excluir cliente')

      toast.success('Cliente excluído!')
      setCustomers(customers.filter(c => c.id !== id))
    } catch (error) {
      toast.error('Erro ao excluir cliente')
    }
  }

  const handleUnblockCustomer = async (customerId: string, customerName: string) => {
    if (!confirm(`Liberar cliente ${customerName} para fazer novos pedidos?\n\nEsta ação permite que o cliente faça pedidos mesmo com boletos em atraso (útil quando o cliente enviou comprovante de pagamento).`)) return

    try {
      const response = await fetch(`/api/customers/${customerId}/unblock`, {
        method: 'POST'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao liberar cliente')
      }

      const data = await response.json()
      toast.success(`✅ Cliente ${customerName} liberado com sucesso!`, {
        description: 'O cliente agora pode fazer novos pedidos'
      })

      // Atualizar o estado local do cliente
      setCustomers(customers.map(c => 
        c.id === customerId 
          ? { ...c, manuallyUnblocked: true, unblockedAt: data.customer.unblockedAt } 
          : c
      ))
    } catch (error: any) {
      console.error('[UNBLOCK_ERROR]', error)
      toast.error('Erro ao liberar cliente', {
        description: error.message || 'Tente novamente'
      })
    }
  }

  const handleReblockCustomer = async (customerId: string, customerName: string) => {
    if (!confirm(`Remover liberação manual do cliente ${customerName}?\n\nO cliente voltará a ser bloqueado se tiver boletos em atraso.`)) return

    try {
      const response = await fetch(`/api/customers/${customerId}/unblock`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao remover liberação')
      }

      toast.success(`Cliente ${customerName} voltou ao status normal`, {
        description: 'Liberação manual removida'
      })

      // Atualizar o estado local do cliente
      setCustomers(customers.map(c => 
        c.id === customerId 
          ? { ...c, manuallyUnblocked: false, unblockedAt: null } 
          : c
      ))
    } catch (error: any) {
      console.error('[REBLOCK_ERROR]', error)
      toast.error('Erro ao remover liberação', {
        description: error.message || 'Tente novamente'
      })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-amber-50">
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto max-w-7xl flex h-16 items-center justify-between px-4">
          <Link href="/admin" className="flex items-center space-x-3">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-white">
              <Image 
                src="/logo.jpg" 
                alt="[SUA EMPRESA]" 
                fill 
                className="object-contain"
              />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Gerenciar Clientes</h1>
              <p className="text-xs text-gray-600">[SUA EMPRESA]</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <HomeButton />
            <Button onClick={handleAdd} className="bg-red-600 hover:bg-red-700">
              <Plus className="w-4 h-4 mr-2" />
              Novo Cliente
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl px-4 py-8">
        {/* 🔧 ABAS: Clientes Ativos / Inativos */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={activeTab === 'active' ? 'default' : 'outline'}
            onClick={() => setActiveTab('active')}
            className={activeTab === 'active' ? 'bg-green-600 hover:bg-green-700' : ''}
          >
            <Users className="w-4 h-4 mr-2" />
            Clientes Ativos
          </Button>
          <Button
            variant={activeTab === 'inactive' ? 'default' : 'outline'}
            onClick={() => setActiveTab('inactive')}
            className={activeTab === 'inactive' ? 'bg-gray-600 hover:bg-gray-700' : ''}
          >
            <Users className="w-4 h-4 mr-2" />
            Clientes Inativos
          </Button>
        </div>

        {/* 🔧 FILTROS AVANÇADOS */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Filtros Avançados</CardTitle>
            <CardDescription>Refine sua busca por características específicas</CardDescription>
          </CardHeader>
          <CardContent>
            {/* 🆕 FILTRO DE DATA DE CADASTRO */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div>
                <Label className="text-blue-700">📅 Data Inicial (Cadastro)</Label>
                <Input
                  type="date"
                  value={startDateFilter}
                  onChange={(e) => setStartDateFilter(e.target.value)}
                  className="border-blue-300"
                />
              </div>
              <div>
                <Label className="text-blue-700">📅 Data Final (Cadastro)</Label>
                <Input
                  type="date"
                  value={endDateFilter}
                  onChange={(e) => setEndDateFilter(e.target.value)}
                  className="border-blue-300"
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() => loadCustomers()}
                  disabled={!startDateFilter || !endDateFilter}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  🔍 Filtrar por Data
                </Button>
              </div>
              <div className="flex items-end">
                {(startDateFilter || endDateFilter) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStartDateFilter('')
                      setEndDateFilter('')
                    }}
                    className="w-full border-blue-300 text-blue-600"
                  >
                    ✕ Limpar Data
                  </Button>
                )}
              </div>
            </div>
            
            {/* Indicador de filtro de data ativo */}
            {startDateFilter && endDateFilter && (
              <div className="mb-4 p-3 bg-green-50 border border-green-300 rounded-lg">
                <p className="text-sm text-green-700 font-medium">
                  📊 Mostrando <span className="font-bold">{filteredCustomers.length}</span> clientes cadastrados de{' '}
                  <span className="font-bold">{new Date(startDateFilter + 'T12:00:00').toLocaleDateString('pt-BR')}</span>{' '}
                  até <span className="font-bold">{new Date(endDateFilter + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                </p>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Filtro: Prazo de Pagamento */}
              <div>
                <Label>Prazo de Pagamento</Label>
                <Select value={paymentTermsFilter} onValueChange={setPaymentTermsFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os prazos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os prazos</SelectItem>
                    <SelectItem value="7">7 dias</SelectItem>
                    <SelectItem value="15">15 dias</SelectItem>
                    <SelectItem value="30">30 dias</SelectItem>
                    <SelectItem value="45">45 dias</SelectItem>
                    <SelectItem value="60">60 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro: Limite de Crédito */}
              <div>
                <Label>Limite de Crédito</Label>
                <Select value={creditLimitFilter} onValueChange={setCreditLimitFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os limites" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os limites</SelectItem>
                    <SelectItem value="none">Sem limite (R$ 0)</SelectItem>
                    <SelectItem value="above5000">Acima de R$ 5.000</SelectItem>
                    <SelectItem value="above10000">Acima de R$ 10.000</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro: Dias Sem Comprar */}
              <div>
                <Label>Dias Sem Comprar</Label>
                <Select value={inactivityDaysFilter} onValueChange={setInactivityDaysFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Qualquer período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Qualquer período</SelectItem>
                    <SelectItem value="15">Mais de 15 dias</SelectItem>
                    <SelectItem value="30">Mais de 30 dias</SelectItem>
                    <SelectItem value="60">Mais de 60 dias</SelectItem>
                    <SelectItem value="90">Mais de 90 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro: Nunca Compraram */}
              <div className="flex items-end">
                <Button
                  variant={neverOrderedFilter ? 'default' : 'outline'}
                  onClick={() => setNeverOrderedFilter(!neverOrderedFilter)}
                  className="w-full"
                >
                  {neverOrderedFilter ? '✓ ' : ''}Nunca Compraram
                </Button>
              </div>

              {/* Filtro: Sem Catálogo Personalizado */}
              <div className="flex items-end">
                <Button
                  variant={noCustomCatalogFilter ? 'default' : 'outline'}
                  onClick={() => setNoCustomCatalogFilter(!noCustomCatalogFilter)}
                  className="w-full"
                >
                  {noCustomCatalogFilter ? '✓ ' : ''}Sem Catálogo Personalizado
                </Button>
              </div>
            </div>

            {/* Botão Limpar Filtros */}
            {(paymentTermsFilter !== 'all' || creditLimitFilter !== 'all' || inactivityDaysFilter !== 'all' || neverOrderedFilter || noCustomCatalogFilter || startDateFilter || endDateFilter) && (
              <div className="mt-4">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setPaymentTermsFilter('all')
                    setCreditLimitFilter('all')
                    setInactivityDaysFilter('all')
                    setNeverOrderedFilter(false)
                    setNoCustomCatalogFilter(false)
                    setStartDateFilter('')
                    setEndDateFilter('')
                  }}
                >
                  Limpar Todos os Filtros
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* 🆕 CARD DE TOTAL DE CLIENTES */}
        <Card className="mb-6 bg-gradient-to-r from-purple-500 to-pink-500 text-white">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="w-8 h-8" />
                <div>
                  <p className="text-sm opacity-80">Total de Clientes Cadastrados</p>
                  <p className="text-3xl font-bold">{totalCustomers}</p>
                </div>
              </div>
              {(startDateFilter && endDateFilter) && (
                <div className="text-right">
                  <p className="text-sm opacity-80">Filtrado no Período</p>
                  <p className="text-2xl font-bold">{filteredCustomers.length}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Busca */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Buscar clientes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {filteredCustomers.map((customer) => (
            <Card key={customer.id}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold">{customer.name}</h3>
                      
                      {/* 🔧 Badge de Status (Ativo/Inativo) */}
                      {!customer.isEmployee && (
                        <Badge className={customer.isActive 
                          ? 'bg-green-100 text-green-700 border-green-300' 
                          : 'bg-gray-100 text-gray-700 border-gray-300'
                        }>
                          {customer.isActive ? '● Ativo' : '○ Inativo'}
                        </Badge>
                      )}
                      
                      {customer.manuallyUnblocked && (
                        <Badge className="bg-green-100 text-green-700 border-green-300">
                          <Unlock className="w-3 h-3 mr-1" />
                          Liberado
                        </Badge>
                      )}
                    </div>
                    {customer.email && <p className="text-sm text-gray-600">{customer.email}</p>}
                    <p className="text-sm text-gray-600">{customer.phone}</p>
                    <p className="text-sm text-gray-600">{customer.city}</p>
                    
                    {/* Limites de Crédito */}
                    <div className="flex gap-4 mt-3 mb-2">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-blue-600" />
                        <div>
                          <p className="text-xs text-gray-500">Limite Total</p>
                          <p className="text-sm font-semibold text-blue-600">{formatCurrency(customer.creditLimit)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-green-600" />
                        <div>
                          <p className="text-xs text-gray-500">Limite Disponível</p>
                          <p className="text-sm font-semibold text-green-600">{formatCurrency(customer.availableCredit)}</p>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-gray-500 mt-1">
                      Cadastrado por: {customer.Seller?.name || 'Admin'}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Link href={`/admin/customers/${customer.id}/products`}>
                      <Button size="sm" variant="outline" title="Gerenciar Catálogo">
                        <Package className="w-4 h-4 mr-2" />
                        Catálogo
                      </Button>
                    </Link>
                    
                    {customer.manuallyUnblocked ? (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleReblockCustomer(customer.id, customer.name)} 
                        className="text-orange-600 border-orange-300 hover:bg-orange-50"
                        title="Remover liberação manual"
                      >
                        <Lock className="w-4 h-4 mr-2" />
                        Remover Liberação
                      </Button>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleUnblockCustomer(customer.id, customer.name)} 
                        className="text-green-600 border-green-300 hover:bg-green-50"
                        title="Liberar cliente (comprovante de pagamento recebido)"
                      >
                        <Unlock className="w-4 h-4 mr-2" />
                        Liberar Cliente
                      </Button>
                    )}
                    
                    <Button size="sm" variant="outline" onClick={() => handleEdit(customer)} title="Editar">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    
                    {/* 🔧 Botão Inativar/Ativar (exceto para funcionários) */}
                    {!customer.isEmployee && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleToggleActive(customer)}
                        className={customer.isActive ? 'text-orange-600' : 'text-green-600'}
                        title={customer.isActive ? 'Inativar Cliente' : 'Ativar Cliente'}
                      >
                        {customer.isActive ? (
                          <Lock className="w-4 h-4" />
                        ) : (
                          <Unlock className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                    
                    {/* Excluir apenas para funcionários */}
                    {customer.isEmployee && (
                      <Button size="sm" variant="outline" onClick={() => handleDelete(customer.id)} className="text-red-600" title="Excluir">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredCustomers.length === 0 && (
          <Card className="p-12">
            <div className="text-center">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum cliente encontrado</h3>
              <Button onClick={handleAdd} className="bg-red-600 hover:bg-red-700">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Cliente
              </Button>
            </div>
          </Card>
        )}
      </main>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
            <DialogDescription>Todos os campos são opcionais</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>CPF/CNPJ</Label>
                <Input value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
            </div>

            <div>
              <Label>Endereço</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>

            <div>
              <Label>Data de Nascimento (opcional) 🎂</Label>
              <Input 
                type="date" 
                value={birthDate} 
                onChange={(e) => setBirthDate(e.target.value)}
                placeholder="Usado para enviar cupons de aniversário"
              />
              <p className="text-xs text-gray-500 mt-1">Para enviar cupons de desconto no aniversário do cliente</p>
            </div>

            {!editingCustomer && (
              <div>
                <Label>Indicado por (opcional) 🎁</Label>
                <Select value={referredBy || 'NENHUM'} onValueChange={(value) => setReferredBy(value === 'NENHUM' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NENHUM">Nenhum</SelectItem>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name} - {customer.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  Se o cliente foi indicado por outro cliente, selecione aqui
                </p>
              </div>
            )}

            <div>
              <Label>Cadastrado por</Label>
              <Select value={sellerId || 'ADMIN'} onValueChange={(value) => setSellerId(value === 'ADMIN' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Admin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  {sellers.map((seller) => (
                    <SelectItem key={seller.id} value={seller.id}>
                      {seller.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Limite Crédito (R$)</Label>
                <Input type="number" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} />
              </div>
              <div>
                <Label>Desconto (%)</Label>
                <Input type="number" value={customDiscount} onChange={(e) => setCustomDiscount(e.target.value)} />
              </div>
              <div>
                <Label>Prazo (dias)</Label>
                <Input type="number" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
              </div>
            </div>

            <div className="space-y-4 border-t pt-4">
              {/* Opção de permitir boleto */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base font-medium">Permitir Pagamento com Boleto</Label>
                  <p className="text-sm text-muted-foreground">
                    Se desabilitado, a opção de boleto não aparecerá no checkout
                  </p>
                </div>
                <Button
                  type="button"
                  variant={canPayWithBoleto ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCanPayWithBoleto(!canPayWithBoleto)}
                  className={canPayWithBoleto ? "bg-green-600 hover:bg-green-700" : "bg-red-100 text-red-700 hover:bg-red-200"}
                >
                  {canPayWithBoleto ? "Sim" : "Não"}
                </Button>
              </div>

              {/* Opção de boletos parcelados (só aparece se permitir boleto) */}
              {canPayWithBoleto && (
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-base font-medium">Permitir Boletos Parcelados</Label>
                    <p className="text-sm text-muted-foreground">
                      Habilite para permitir que o cliente parcele boletos em múltiplas parcelas
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant={allowInstallments ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAllowInstallments(!allowInstallments)}
                    className={allowInstallments ? "bg-green-600 hover:bg-green-700" : ""}
                  >
                    {allowInstallments ? "Habilitado" : "Desabilitado"}
                  </Button>
                </div>
              )}

              {canPayWithBoleto && allowInstallments && (
                <div className="space-y-2">
                  <Label>Opções de Parcelamento (prazos em dias)</Label>
                  <Input 
                    placeholder="Ex: 7,14,21,28 ou 3,7,14"
                    value={installmentOptions} 
                    onChange={(e) => setInstallmentOptions(e.target.value)} 
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
              <Label>Senha {editingCustomer && <span className="text-xs text-gray-500">(deixe em branco para manter a atual)</span>}</Label>
              <Input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                placeholder={editingCustomer ? "Deixe em branco para não alterar" : "Digite a senha"}
                autoComplete="new-password"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} className="bg-red-600 hover:bg-red-700">Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
