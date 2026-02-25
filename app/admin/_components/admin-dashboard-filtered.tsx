'use client'

import { useState, useEffect } from 'react'
import { signOut } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { 
  Flame, 
  Users, 
  Package, 
  ShoppingCart, 
  TrendingUp,
  DollarSign,
  Calendar,
  LogOut,
  Bell,
  BarChart3,
  Filter,
  RefreshCw
} from 'lucide-react'

interface FilteredStats {
  totalCustomers: number
  totalProducts: number
  pendingOrders: number
  revenue: number
  netRevenue: number
  operationalExpenses: number
  productExpenses: number
  purchases: number
  investments: number
  prolabore: number
}

interface AdminDashboardFilteredProps {
  userName: string
  initialStats: {
    dailyRevenue: number
    monthlyRevenue: number
    dailyNetRevenue: number
    monthlyNetRevenue: number
    dailyOperationalExpenses: number
    monthlyOperationalExpenses: number
    dailyProductExpenses: number
    monthlyProductExpenses: number
    dailyPurchases: number
    monthlyPurchases: number
    dailyInvestments: number
    monthlyInvestments: number
    dailyProlabore: number
    monthlyProlabore: number
    totalCustomers: number
    totalProducts: number
    pendingOrders: number
  }
}

export function AdminDashboardFiltered({ userName, initialStats }: AdminDashboardFilteredProps) {
  // Estado dos filtros
  const [filterType, setFilterType] = useState<'day' | 'period'>('day')
  const [selectedDate, setSelectedDate] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)

  // Estados dos dados
  const [dailyStats, setDailyStats] = useState<FilteredStats | null>(null)
  const [monthlyStats, setMonthlyStats] = useState<FilteredStats | null>(null)
  
  // Inicializa as datas após o componente montar (evita problemas de hidratação)
  useEffect(() => {
    try {
      const today = new Date().toISOString().split('T')[0]
      setSelectedDate(today)
      setStartDate(today)
      setEndDate(today)
    } catch (error) {
      console.error('Erro ao inicializar datas:', error)
      const fallback = '2025-11-26'
      setSelectedDate(fallback)
      setStartDate(fallback)
      setEndDate(fallback)
    }
  }, [])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  // Buscar dados ao inicializar (dia atual e mês atual)
  useEffect(() => {
    fetchDailyData()
    fetchMonthlyData()
  }, [])

  const fetchDailyData = async (date = selectedDate) => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/dashboard-filtered', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: date,
          endDate: date,
          filterType: 'day'
        })
      })

      if (!response.ok) throw new Error('Erro ao buscar dados')

      const data = await response.json()
      setDailyStats(data.stats)
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao buscar dados diários')
    } finally {
      setLoading(false)
    }
  }

  const fetchMonthlyData = async () => {
    setLoading(true)
    try {
      // Calcular primeiro e último dia do mês
      const today = new Date()
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)

      const response = await fetch('/api/admin/dashboard-filtered', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: firstDay.toISOString().split('T')[0],
          endDate: lastDay.toISOString().split('T')[0],
          filterType: 'month'
        })
      })

      if (!response.ok) throw new Error('Erro ao buscar dados')

      const data = await response.json()
      setMonthlyStats(data.stats)
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao buscar dados mensais')
    } finally {
      setLoading(false)
    }
  }

  const fetchCustomPeriodData = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/dashboard-filtered', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate,
          filterType: 'period'
        })
      })

      if (!response.ok) throw new Error('Erro ao buscar dados')

      const data = await response.json()
      setDailyStats(data.stats)
      toast.success('Dados do período carregados!')
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao buscar dados do período')
    } finally {
      setLoading(false)
    }
  }

  const handleDaySearch = () => {
    fetchDailyData(selectedDate)
  }

  const handlePeriodSearch = () => {
    if (new Date(startDate) > new Date(endDate)) {
      toast.error('Data inicial não pode ser maior que data final')
      return
    }
    fetchCustomPeriodData()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Image
                src="/logo.jpg"
                alt="[SUA EMPRESA]"
                width={50}
                height={50}
                className="rounded-full"
              />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Painel Administrativo</h1>
                <p className="text-sm text-gray-600">Bem-vindo, {userName}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => signOut({ callbackUrl: '/auth/login' })}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Filtros */}
        <Card className="shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-blue-600" />
              Filtros de Busca
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex gap-4 items-end flex-wrap">
              {/* Busca por Dia Específico */}
              <div className="flex-1 min-w-[250px]">
                <Label htmlFor="selectedDate">🗓️ Buscar por Dia Específico</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="selectedDate"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleDaySearch}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Buscar'}
                  </Button>
                </div>
              </div>

              {/* Busca por Período */}
              <div className="flex-1 min-w-[250px]">
                <Label>📅 Buscar por Período</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    placeholder="Data inicial"
                  />
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    placeholder="Data final"
                  />
                  <Button 
                    onClick={handlePeriodSearch}
                    disabled={loading}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Buscar'}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cards Diários */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="h-6 w-6 text-blue-600" />
            📊 Dados Diários
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {dailyStats && (
              <>
                <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-green-700">
                      💰 Faturamento Bruto
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-700">
                      {formatCurrency(dailyStats.revenue)}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-blue-700">
                      💵 Receita Líquida
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-700">
                      {formatCurrency(dailyStats.netRevenue)}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-red-700">
                      📤 Desp. Operacionais
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-700">
                      {formatCurrency(dailyStats.operationalExpenses)}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-purple-700">
                      📦 Desp. com Produtos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-700">
                      {formatCurrency(dailyStats.productExpenses)}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-orange-700">
                      🛒 Compras Mercadorias
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-700">
                      {formatCurrency(dailyStats.purchases)}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-teal-50 to-teal-100 border-teal-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-teal-700">
                      💼 Investimentos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-teal-700">
                      {formatCurrency(dailyStats.investments)}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-pink-50 to-pink-100 border-pink-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-pink-700">
                      👔 Pró-labore
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-pink-700">
                      {formatCurrency(dailyStats.prolabore)}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>

        {/* Cards Mensais */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-purple-600" />
            📈 Dados Mensais
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {monthlyStats && (
              <>
                <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-green-700">
                      💰 Faturamento Bruto
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-700">
                      {formatCurrency(monthlyStats.revenue)}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-blue-700">
                      💵 Receita Líquida
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-700">
                      {formatCurrency(monthlyStats.netRevenue)}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-red-700">
                      📤 Desp. Operacionais
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-700">
                      {formatCurrency(monthlyStats.operationalExpenses)}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-purple-700">
                      📦 Desp. com Produtos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-700">
                      {formatCurrency(monthlyStats.productExpenses)}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-orange-700">
                      🛒 Compras Mercadorias
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-700">
                      {formatCurrency(monthlyStats.purchases)}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-teal-50 to-teal-100 border-teal-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-teal-700">
                      💼 Investimentos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-teal-700">
                      {formatCurrency(monthlyStats.investments)}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-pink-50 to-pink-100 border-pink-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-pink-700">
                      👔 Pró-labore
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-pink-700">
                      {formatCurrency(monthlyStats.prolabore)}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>

        {/* Cards de Informações Gerais */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="h-6 w-6 text-slate-600" />
            ℹ️ Informações Gerais
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-700">
                  👥 Total de Clientes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-700">
                  {initialStats.totalCustomers}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-700">
                  📦 Produtos Ativos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-700">
                  {initialStats.totalProducts}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-yellow-700">
                  ⏳ Pedidos Pendentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-700">
                  {initialStats.pendingOrders}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Ações Rápidas */}
        <Card>
          <CardHeader>
            <CardTitle>⚡ Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              <Link href="/admin/orders">
                <Button className="w-full bg-blue-600 hover:bg-blue-700">
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Gerenciar Pedidos
                </Button>
              </Link>
              <Link href="/admin/customers">
                <Button className="w-full bg-green-600 hover:bg-green-700">
                  <Users className="h-4 w-4 mr-2" />
                  Gerenciar Clientes
                </Button>
              </Link>
              <Link href="/admin/financeiro">
                <Button className="w-full bg-purple-600 hover:bg-purple-700">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Financeiro
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
