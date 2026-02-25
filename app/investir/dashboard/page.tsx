'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TrendingUp, TrendingDown, DollarSign, ArrowUpCircle, ArrowDownCircle, Wallet } from 'lucide-react'
import { toast } from 'sonner'

export default function InvestirDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [companies, setCompanies] = useState<any[]>([])
  const [portfolio, setPortfolio] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Estados para compra/venda
  const [selectedCompany, setSelectedCompany] = useState<string>('')
  const [shares, setShares] = useState('')
  const [depositAmount, setDepositAmount] = useState('')

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/login')
      return
    }
    loadData()
  }, [session, status])

  const loadData = async () => {
    try {
      const [profileRes, companiesRes, portfolioRes, transactionsRes] = await Promise.all([
        fetch('/api/investir/profile'),
        fetch('/api/investir/companies'),
        fetch('/api/investir/user/portfolio'),
        fetch('/api/investir/user/transactions')
      ])

      setProfile(await profileRes.json())
      setCompanies(await companiesRes.json())
      setPortfolio(await portfolioRes.json())
      setTransactions(await transactionsRes.json())
      setLoading(false)
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      toast.error('Erro ao carregar dados')
    }
  }

  const handleDeposit = async () => {
    try {
      const res = await fetch('/api/investir/deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(depositAmount) })
      })

      const data = await res.json()
      if (data.initPoint) {
        window.location.href = data.initPoint
      } else {
        toast.error('Erro ao criar depósito')
      }
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao processar depósito')
    }
  }

  const handleBuy = async () => {
    try {
      const res = await fetch('/api/investir/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: selectedCompany,
          shares: parseInt(shares),
          type: 'BUY'
        })
      })

      if (res.ok) {
        toast.success('Ações compradas com sucesso!')
        loadData()
        setShares('')
      } else {
        const error = await res.json()
        toast.error(error.error || 'Erro ao comprar ações')
      }
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao processar compra')
    }
  }

  const handleSell = async () => {
    try {
      const res = await fetch('/api/investir/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: selectedCompany,
          shares: parseInt(shares),
          type: 'SELL'
        })
      })

      if (res.ok) {
        toast.success('Ações vendidas com sucesso!')
        loadData()
        setShares('')
      } else {
        const error = await res.json()
        toast.error(error.error || 'Erro ao vender ações')
      }
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao processar venda')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p>Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-orange-600">
            🍖 [SUA EMPRESA]
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="outline">Dashboard Principal</Button>
            </Link>
            <Link href="/varejo/dashboard">
              <Button variant="outline">Dashboard Varejo</Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Dashboard do Investidor</h1>

        {/* Resumo */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-gray-600">Saldo Disponível</div>
              <Wallet className="text-blue-600" />
            </div>
            <div className="text-3xl font-bold">R$ {profile?.balance?.toFixed(2) || '0.00'}</div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-gray-600">Total em Ações</div>
              <TrendingUp className="text-green-600" />
            </div>
            <div className="text-3xl font-bold">
              {portfolio.reduce((sum, p) => sum + p.shares, 0)}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-gray-600">Valor do Portfolio</div>
              <DollarSign className="text-orange-600" />
            </div>
            <div className="text-3xl font-bold">
              R$ {portfolio.reduce((sum, p) => {
                const company = companies.find(c => c.id === p.companyId)
                return sum + (p.shares * (company?.currentPrice || 0))
              }, 0).toFixed(2)}
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="comprar" className="space-y-6">
          <TabsList>
            <TabsTrigger value="comprar">Comprar Ações</TabsTrigger>
            <TabsTrigger value="vender">Vender Ações</TabsTrigger>
            <TabsTrigger value="deposito">Depositar Saldo</TabsTrigger>
            <TabsTrigger value="portfolio">Meu Portfolio</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="comprar">
            <Card className="p-6">
              <h3 className="text-xl font-bold mb-4">Comprar Ações</h3>
              <div className="space-y-4">
                <div>
                  <Label>Empresa</Label>
                  <select
                    className="w-full border rounded-md p-2"
                    value={selectedCompany}
                    onChange={(e) => setSelectedCompany(e.target.value)}
                  >
                    <option value="">Selecione uma empresa</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} - R$ {c.currentPrice.toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Quantidade de Ações</Label>
                  <Input
                    type="number"
                    value={shares}
                    onChange={(e) => setShares(e.target.value)}
                    placeholder="Ex: 100"
                  />
                </div>
                {selectedCompany && shares && (
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">Valor Total</div>
                    <div className="text-2xl font-bold text-orange-600">
                      R$ {(
                        parseInt(shares) * 
                        (companies.find(c => c.id === selectedCompany)?.currentPrice || 0)
                      ).toFixed(2)}
                    </div>
                  </div>
                )}
                <Button onClick={handleBuy} disabled={!selectedCompany || !shares} className="w-full">
                  <ArrowUpCircle className="mr-2" /> Comprar Ações
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="vender">
            <Card className="p-6">
              <h3 className="text-xl font-bold mb-4">Vender Ações</h3>
              <div className="space-y-4">
                <div>
                  <Label>Empresa</Label>
                  <select
                    className="w-full border rounded-md p-2"
                    value={selectedCompany}
                    onChange={(e) => setSelectedCompany(e.target.value)}
                  >
                    <option value="">Selecione uma empresa</option>
                    {portfolio.map(p => (
                      <option key={p.companyId} value={p.companyId}>
                        {p.company.name} - {p.sellableShares} ações disponíveis
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Quantidade de Ações</Label>
                  <Input
                    type="number"
                    value={shares}
                    onChange={(e) => setShares(e.target.value)}
                    placeholder="Ex: 50"
                  />
                </div>
                {selectedCompany && shares && (
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600">Valor a Receber</div>
                    <div className="text-2xl font-bold text-green-600">
                      R$ {(
                        parseInt(shares) * 
                        (companies.find(c => c.id === selectedCompany)?.currentPrice || 0)
                      ).toFixed(2)}
                    </div>
                  </div>
                )}
                <Button onClick={handleSell} disabled={!selectedCompany || !shares} className="w-full" variant="outline">
                  <ArrowDownCircle className="mr-2" /> Vender Ações
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="deposito">
            <Card className="p-6">
              <h3 className="text-xl font-bold mb-4">Depositar Saldo</h3>
              <div className="space-y-4">
                <div>
                  <Label>Valor do Depósito</Label>
                  <Input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="Ex: 1000.00"
                  />
                </div>
                <Button onClick={handleDeposit} disabled={!depositAmount} className="w-full">
                  Depositar via Mercado Pago
                </Button>
                <p className="text-sm text-gray-600">
                  Você será redirecionado para o Mercado Pago para concluir o pagamento.
                </p>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="portfolio">
            <Card className="p-6">
              <h3 className="text-xl font-bold mb-4">Meu Portfolio</h3>
              <div className="space-y-4">
                {portfolio.length === 0 ? (
                  <p className="text-gray-600 text-center py-8">Você ainda não possui ações.</p>
                ) : (
                  portfolio.map(p => (
                    <div key={p.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-bold">{p.company.name}</h4>
                          <div className="text-sm text-gray-600">
                            {p.shares} ações ({p.sellableShares} disponíveis para venda)
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">R$ {p.avgPrice.toFixed(2)}</div>
                          <div className="text-sm text-gray-600">Preço médio</div>
                        </div>
                      </div>
                      {p.giftedShares > 0 && (
                        <div className="mt-2 text-sm">
                          <div className="text-green-600">✓ {p.vestedShares} ações doadas (liberadas)</div>
                          {p.unvestedShares > 0 && (
                            <div className="text-orange-600">⏳ {p.unvestedShares} ações doadas (bloqueadas)</div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="historico">
            <Card className="p-6">
              <h3 className="text-xl font-bold mb-4">Histórico de Transações</h3>
              <div className="space-y-2">
                {transactions.length === 0 ? (
                  <p className="text-gray-600 text-center py-8">Nenhuma transação ainda.</p>
                ) : (
                  transactions.map(t => (
                    <div key={t.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-medium">{t.company.name}</div>
                          <div className="text-sm text-gray-600">
                            {new Date(t.createdAt).toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-bold ${
                            t.type === 'BUY' ? 'text-orange-600' : 
                            t.type === 'SELL' ? 'text-green-600' : 
                            'text-blue-600'
                          }`}>
                            {t.type === 'BUY' && 'Compra'}
                            {t.type === 'SELL' && 'Venda'}
                            {t.type === 'GIFTED' && 'Doação'}
                          </div>
                          <div className="text-sm text-gray-600">
                            {t.shares} ações
                            {t.totalValue > 0 && ` - R$ ${t.totalValue.toFixed(2)}`}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
