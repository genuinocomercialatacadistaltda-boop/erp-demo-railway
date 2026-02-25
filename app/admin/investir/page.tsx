'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { 
  TrendingUp, 
  Users, 
  Building2, 
  ArrowLeftRight, 
  DollarSign,
  Plus,
  Edit,
  Trash2,
  Gift,
  Home,
  ArrowLeft
} from 'lucide-react'
import { toast } from 'sonner'

export default function AdminInvestirPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>(null)
  const [companies, setCompanies] = useState<any[]>([])
  const [investors, setInvestors] = useState<any[]>([])
  const [giftedShares, setGiftedShares] = useState<any[]>([])
  
  // Diálogos
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false)
  const [giftDialogOpen, setGiftDialogOpen] = useState(false)
  const [editingCompany, setEditingCompany] = useState<any>(null)
  
  // Formulários
  const [companyForm, setCompanyForm] = useState({
    name: '',
    description: '',
    logoUrl: '',
    totalShares: '1000000',
    currentPrice: '',
    valuation: ''
  })
  
  const [giftForm, setGiftForm] = useState({
    investorId: '',
    companyId: '',
    shares: '',
    vestingDate: '',
    description: ''
  })

  useEffect(() => {
    if (status === 'loading') return
    if (!session || (session.user as any).userType !== 'ADMIN') {
      router.push('/auth/login')
      return
    }
    loadData()
  }, [session, status])

  const loadData = async () => {
    try {
      const [statsRes, companiesRes, investorsRes, giftedRes] = await Promise.all([
        fetch('/api/investir/admin/stats'),
        fetch('/api/investir/admin/companies'),
        fetch('/api/investir/admin/investors'),
        fetch('/api/investir/admin/gifted-shares')
      ])

      setStats(await statsRes.json())
      setCompanies(await companiesRes.json())
      setInvestors(await investorsRes.json())
      setGiftedShares(await giftedRes.json())
      setLoading(false)
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      toast.error('Erro ao carregar dados')
    }
  }

  const handleCreateCompany = async () => {
    try {
      const res = await fetch('/api/investir/admin/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...companyForm,
          totalShares: parseInt(companyForm.totalShares),
          currentPrice: parseFloat(companyForm.currentPrice),
          valuation: parseFloat(companyForm.valuation)
        })
      })

      if (res.ok) {
        toast.success('Empresa criada com sucesso!')
        setCompanyDialogOpen(false)
        setCompanyForm({
          name: '',
          description: '',
          logoUrl: '',
          totalShares: '1000000',
          currentPrice: '',
          valuation: ''
        })
        loadData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Erro ao criar empresa')
      }
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao criar empresa')
    }
  }

  const handleUpdateCompany = async () => {
    try {
      const res = await fetch(`/api/investir/admin/companies/${editingCompany.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...companyForm,
          totalShares: parseInt(companyForm.totalShares),
          currentPrice: parseFloat(companyForm.currentPrice),
          valuation: parseFloat(companyForm.valuation)
        })
      })

      if (res.ok) {
        toast.success('Empresa atualizada com sucesso!')
        setEditingCompany(null)
        setCompanyDialogOpen(false)
        loadData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Erro ao atualizar empresa')
      }
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao atualizar empresa')
    }
  }

  const handleDeleteCompany = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar esta empresa?')) return

    try {
      const res = await fetch(`/api/investir/admin/companies/${id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        toast.success('Empresa deletada com sucesso!')
        loadData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Erro ao deletar empresa')
      }
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao deletar empresa')
    }
  }

  const handleGiftShares = async () => {
    try {
      const res = await fetch('/api/investir/admin/gifted-shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...giftForm,
          shares: parseInt(giftForm.shares)
        })
      })

      if (res.ok) {
        toast.success('Ações doadas com sucesso!')
        setGiftDialogOpen(false)
        setGiftForm({
          investorId: '',
          companyId: '',
          shares: '',
          vestingDate: '',
          description: ''
        })
        loadData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Erro ao doar ações')
      }
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao doar ações')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
              <TrendingUp className="w-10 h-10 text-red-600" />
              Admin - Bolsa de Investimentos
            </h1>
            <p className="text-gray-600 mt-2">Gerencie empresas, investidores e ações</p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin">
              <Button variant="outline" className="flex items-center gap-2">
                <Home className="w-4 h-4" />
                Início
              </Button>
            </Link>
            <Button
              onClick={() => router.back()}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Investidores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-900">{stats.totalInvestors}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="w-5 h-5 text-purple-600" />
                Empresas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-purple-900">{stats.totalCompanies}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-green-600" />
                Transações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-900">{stats.totalTransactions}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-600" />
                Capital Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-amber-900">
                R$ {stats.totalCapital.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="companies" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto">
          <TabsTrigger value="companies">Empresas</TabsTrigger>
          <TabsTrigger value="investors">Investidores</TabsTrigger>
          <TabsTrigger value="gifted">Ações Doadas</TabsTrigger>
          <TabsTrigger value="transactions">Transações</TabsTrigger>
        </TabsList>

        {/* Empresas */}
        <TabsContent value="companies">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Empresas Listadas</CardTitle>
                  <CardDescription>Gerencie as empresas disponíveis para investimento</CardDescription>
                </div>
                <Dialog open={companyDialogOpen} onOpenChange={setCompanyDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-red-600 hover:bg-red-700">
                      <Plus className="w-4 h-4 mr-2" />
                      Nova Empresa
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>
                        {editingCompany ? 'Editar Empresa' : 'Nova Empresa'}
                      </DialogTitle>
                      <DialogDescription>
                        Preencha os dados da empresa
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Nome da Empresa</Label>
                        <Input
                          value={companyForm.name}
                          onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                          placeholder="Ex: [SUA EMPRESA]"
                        />
                      </div>
                      <div>
                        <Label>Descrição</Label>
                        <Textarea
                          value={companyForm.description}
                          onChange={(e) => setCompanyForm({ ...companyForm, description: e.target.value })}
                          placeholder="Descreva a empresa..."
                          rows={3}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Total de Ações</Label>
                          <Input
                            type="number"
                            value={companyForm.totalShares}
                            onChange={(e) => setCompanyForm({ ...companyForm, totalShares: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Preço Atual (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={companyForm.currentPrice}
                            onChange={(e) => setCompanyForm({ ...companyForm, currentPrice: e.target.value })}
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Valuation (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={companyForm.valuation}
                          onChange={(e) => setCompanyForm({ ...companyForm, valuation: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Logo URL (opcional)</Label>
                        <Input
                          value={companyForm.logoUrl}
                          onChange={(e) => setCompanyForm({ ...companyForm, logoUrl: e.target.value })}
                          placeholder="https://i.pinimg.com/736x/cb/90/1c/cb901c6392512c9186cd55caf5e00d5f.jpg"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={editingCompany ? handleUpdateCompany : handleCreateCompany}
                          className="flex-1 bg-red-600 hover:bg-red-700"
                        >
                          {editingCompany ? 'Atualizar' : 'Criar'} Empresa
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setCompanyDialogOpen(false)
                            setEditingCompany(null)
                            setCompanyForm({
                              name: '',
                              description: '',
                              logoUrl: '',
                              totalShares: '1000000',
                              currentPrice: '',
                              valuation: ''
                            })
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {companies.map((company) => (
                  <Card key={company.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold">{company.name}</h3>
                        <p className="text-sm text-gray-600 mt-1">{company.description}</p>
                        <div className="flex gap-4 mt-3">
                          <div>
                            <p className="text-xs text-gray-500">Preço Atual</p>
                            <p className="font-semibold text-green-600">
                              R$ {company.currentPrice.toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Valuation</p>
                            <p className="font-semibold">
                              R$ {company.valuation.toLocaleString('pt-BR')}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Total de Ações</p>
                            <p className="font-semibold">
                              {parseInt(company.totalShares).toLocaleString('pt-BR')}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Investidores</p>
                            <p className="font-semibold">{company._count.portfolios}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Transações</p>
                            <p className="font-semibold">{company._count.transactions}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingCompany(company)
                            setCompanyForm({
                              name: company.name,
                              description: company.description || '',
                              logoUrl: company.logoUrl || '',
                              totalShares: company.totalShares,
                              currentPrice: company.currentPrice.toString(),
                              valuation: company.valuation.toString()
                            })
                            setCompanyDialogOpen(true)
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteCompany(company.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
                {companies.length === 0 && (
                  <p className="text-center text-gray-500 py-8">Nenhuma empresa cadastrada</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Investidores */}
        <TabsContent value="investors">
          <Card>
            <CardHeader>
              <CardTitle>Investidores</CardTitle>
              <CardDescription>Lista de todos os investidores cadastrados</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {investors.map((investor) => (
                  <Card key={investor.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold">{investor.Customer?.name}</h3>
                        <p className="text-sm text-gray-600">{investor.Customer?.email}</p>
                        <div className="flex gap-4 mt-3">
                          <div>
                            <p className="text-xs text-gray-500">Saldo</p>
                            <p className="font-semibold text-green-600">
                              R$ {investor.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Valor do Portfolio</p>
                            <p className="font-semibold text-blue-600">
                              R$ {investor.portfolioValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Empresas</p>
                            <p className="font-semibold">{investor.portfolios.length}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Transações</p>
                            <p className="font-semibold">{investor._count.transactions}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
                {investors.length === 0 && (
                  <p className="text-center text-gray-500 py-8">Nenhum investidor cadastrado</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ações Doadas */}
        <TabsContent value="gifted">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Ações Doadas</CardTitle>
                  <CardDescription>Histórico de ações doadas pelo admin</CardDescription>
                </div>
                <Dialog open={giftDialogOpen} onOpenChange={setGiftDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-green-600 hover:bg-green-700">
                      <Gift className="w-4 h-4 mr-2" />
                      Doar Ações
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Doar Ações</DialogTitle>
                      <DialogDescription>
                        Doe ações para um investidor
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Investidor</Label>
                        <select
                          className="w-full border rounded-md p-2"
                          value={giftForm.investorId}
                          onChange={(e) => setGiftForm({ ...giftForm, investorId: e.target.value })}
                        >
                          <option value="">Selecione um investidor</option>
                          {investors.map((inv) => (
                            <option key={inv.id} value={inv.id}>
                              {inv.Customer?.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label>Empresa</Label>
                        <select
                          className="w-full border rounded-md p-2"
                          value={giftForm.companyId}
                          onChange={(e) => setGiftForm({ ...giftForm, companyId: e.target.value })}
                        >
                          <option value="">Selecione uma empresa</option>
                          {companies.map((comp) => (
                            <option key={comp.id} value={comp.id}>
                              {comp.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label>Quantidade de Ações</Label>
                        <Input
                          type="number"
                          value={giftForm.shares}
                          onChange={(e) => setGiftForm({ ...giftForm, shares: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Data de Liberação (Vesting)</Label>
                        <Input
                          type="date"
                          value={giftForm.vestingDate}
                          onChange={(e) => setGiftForm({ ...giftForm, vestingDate: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Descrição</Label>
                        <Textarea
                          value={giftForm.description}
                          onChange={(e) => setGiftForm({ ...giftForm, description: e.target.value })}
                          placeholder="Motivo da doação..."
                        />
                      </div>
                      <Button
                        onClick={handleGiftShares}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        Doar Ações
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {giftedShares.map((gift) => (
                  <Card key={gift.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Gift className="w-5 h-5 text-green-600" />
                          <h3 className="font-bold">{gift.company.name}</h3>
                          <Badge variant={new Date(gift.vestingDate) <= new Date() ? "default" : "secondary"}>
                            {new Date(gift.vestingDate) <= new Date() ? 'Liberado' : 'Bloqueado'}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">Investidor: {gift.investor.Customer?.name}</p>
                        <div className="flex gap-4 mt-2">
                          <div>
                            <p className="text-xs text-gray-500">Quantidade</p>
                            <p className="font-semibold">{parseInt(gift.shares).toLocaleString('pt-BR')} ações</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Data de Liberação</p>
                            <p className="font-semibold">
                              {new Date(gift.vestingDate).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        </div>
                        {gift.description && (
                          <p className="text-sm text-gray-600 mt-2 italic">{gift.description}</p>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
                {giftedShares.length === 0 && (
                  <p className="text-center text-gray-500 py-8">Nenhuma ação doada</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transações */}
        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle>Transações Recentes</CardTitle>
              <CardDescription>Últimas transações realizadas na plataforma</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats?.recentTransactions?.map((tx: any) => (
                  <Card key={tx.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={tx.type === 'BUY' ? 'default' : 'secondary'}>
                            {tx.type === 'BUY' ? 'COMPRA' : 'VENDA'}
                          </Badge>
                          <h3 className="font-bold">{tx.company.name}</h3>
                        </div>
                        <p className="text-sm text-gray-600">
                          Investidor: {tx.investor.Customer?.name}
                        </p>
                        <div className="flex gap-4 mt-2">
                          <div>
                            <p className="text-xs text-gray-500">Quantidade</p>
                            <p className="font-semibold">{parseInt(tx.shares).toLocaleString('pt-BR')} ações</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Preço Unitário</p>
                            <p className="font-semibold">R$ {tx.price.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Valor Total</p>
                            <p className="font-semibold text-green-600">
                              R$ {tx.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Data</p>
                            <p className="font-semibold">
                              {new Date(tx.createdAt).toLocaleString('pt-BR')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
                {(!stats?.recentTransactions || stats.recentTransactions.length === 0) && (
                  <p className="text-center text-gray-500 py-8">Nenhuma transação recente</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
