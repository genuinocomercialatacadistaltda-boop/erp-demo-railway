
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Flame, ArrowLeft, TrendingUp, DollarSign, ShoppingCart, Users, Package, UserX, Calendar, Phone, Mail, MapPin, ChevronDown, ChevronUp, Search, Filter, RefreshCw, X } from 'lucide-react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface ReportsPageProps {
  stats: {
    totalRevenue: number
    totalOrders: number
    totalCustomers: number
    averageOrderValue: number
  }
  salesByMonth: Array<{
    month: string
    revenue: number
    orders: number
  }>
  salesByDay: Array<{
    day: string
    revenue: number
    orders: number
  }>
  allCustomersRanked: Array<{
    id: string
    name: string
    email: string | null
    city: string
    totalSpent: number
    orderCount: number
  }>
  allProductsRanked: Array<{
    id: string
    name: string
    quantitySold: number
    revenue: number
    orderCount: number
  }>
  inactiveCustomers: Array<{
    id: string
    name: string
    email: string | null
    phone: string
    city: string
    lastOrderDate: Date | null
    daysSinceLastOrder: number | null
  }>
}

const COLORS = ['#dc2626', '#ea580c', '#ca8a04', '#65a30d', '#059669', '#0891b2', '#2563eb', '#7c3aed', '#c026d3', '#db2777']

export function ReportsPage({ stats: initialStats, salesByMonth: initialSalesByMonth, salesByDay: initialSalesByDay, allCustomersRanked: initialCustomersRanked, allProductsRanked: initialProductsRanked, inactiveCustomers: initialInactiveCustomers }: ReportsPageProps) {
  // 🔧 Estados para controlar exibição completa
  const [showAllCustomers, setShowAllCustomers] = useState(false)
  const [showAllProducts, setShowAllProducts] = useState(false)
  
  // 🔧 Estados para filtro de busca
  const [productSearchTerm, setProductSearchTerm] = useState('')
  const [customerSearchTerm, setCustomerSearchTerm] = useState('')
  
  // 🔧 Estado para indicar se filtro está aplicado
  const [isFiltered, setIsFiltered] = useState(false)
  
  // 🔧 NOVO: Estados para filtro de data
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  
  // Estados para dados (começa com dados iniciais)
  const [stats, setStats] = useState(initialStats)
  const [salesByMonth, setSalesByMonth] = useState(initialSalesByMonth)
  const [salesByDay, setSalesByDay] = useState(initialSalesByDay)
  const [allCustomersRanked, setAllCustomersRanked] = useState(initialCustomersRanked)
  const [allProductsRanked, setAllProductsRanked] = useState(initialProductsRanked)
  const [inactiveCustomers, setInactiveCustomers] = useState(initialInactiveCustomers)
  
  // Estado para indicar o período filtrado
  const [filteredPeriod, setFilteredPeriod] = useState<string>('Todos os tempos')
  
  // Inicializa datas (hoje)
  useEffect(() => {
    const now = new Date()
    setStartDate(format(now, 'yyyy-MM-dd'))
    setEndDate(format(now, 'yyyy-MM-dd'))
  }, [])
  
  // Função para definir atalhos de período
  const setQuickPeriod = (period: 'today' | 'week' | 'month' | 'year') => {
    const now = new Date()
    let start: Date
    let end: Date = now
    
    switch (period) {
      case 'today':
        start = now
        break
      case 'week':
        start = new Date(now)
        start.setDate(now.getDate() - 7)
        break
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'year':
        start = new Date(now.getFullYear(), 0, 1)
        break
    }
    
    setStartDate(format(start, 'yyyy-MM-dd'))
    setEndDate(format(end, 'yyyy-MM-dd'))
  }
  
  // Formatar período para exibição
  const formatPeriodDisplay = (start: string, end: string): string => {
    if (!start || !end) return 'Todos os tempos'
    
    const startDate = new Date(start + 'T12:00:00')
    const endDate = new Date(end + 'T12:00:00')
    
    // Se mesmo dia
    if (start === end) {
      return startDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    }
    
    return `${startDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })} a ${endDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
  }
  
  // Função para aplicar filtro de data
  const applyFilter = async () => {
    if (!startDate || !endDate) {
      toast.error('Selecione um período válido')
      return
    }
    
    try {
      setLoading(true)
      const params = new URLSearchParams({
        startDate,
        endDate
      })
      
      const response = await fetch(`/api/reports/filtered?${params}`)
      
      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
        setSalesByMonth(data.salesByMonth)
        setSalesByDay(data.salesByDay || [])
        setAllCustomersRanked(data.allCustomersRanked)
        setAllProductsRanked(data.allProductsRanked)
        setInactiveCustomers(data.inactiveCustomers)
        setFilteredPeriod(formatPeriodDisplay(startDate, endDate))
        setIsFiltered(true)
        toast.success('Relatório atualizado!')
      } else {
        toast.error('Erro ao carregar relatório')
      }
    } catch (error) {
      console.error('Erro ao filtrar:', error)
      toast.error('Erro ao aplicar filtro')
    } finally {
      setLoading(false)
    }
  }
  
  // 🔧 Filtra clientes por nome ou cidade
  const filteredCustomers = allCustomersRanked.filter(customer =>
    customer.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
    customer.city?.toLowerCase().includes(customerSearchTerm.toLowerCase())
  )
  const displayedCustomers = showAllCustomers ? filteredCustomers : filteredCustomers.slice(0, 10)
  
  // 🔧 Filtra produtos por nome de busca
  const filteredProducts = allProductsRanked.filter(product =>
    product.name.toLowerCase().includes(productSearchTerm.toLowerCase())
  )
  const displayedProducts = showAllProducts ? filteredProducts : filteredProducts.slice(0, 10)
  
  // 🔧 Função para limpar filtro de data
  const clearDateFilter = () => {
    setStats(initialStats)
    setSalesByMonth(initialSalesByMonth)
    setSalesByDay(initialSalesByDay)
    setAllCustomersRanked(initialCustomersRanked)
    setAllProductsRanked(initialProductsRanked)
    setInactiveCustomers(initialInactiveCustomers)
    setFilteredPeriod('Todos os tempos')
    setIsFiltered(false)
    // Reset datas para hoje
    const now = new Date()
    setStartDate(format(now, 'yyyy-MM-dd'))
    setEndDate(format(now, 'yyyy-MM-dd'))
    toast.success('Filtro limpo! Exibindo todos os dados.')
  }
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatCompactCurrency = (value: number) => {
    if (value >= 1000000) {
      return `R$ ${(value / 1000000).toFixed(1)}M`
    }
    if (value >= 1000) {
      return `R$ ${(value / 1000).toFixed(1)}K`
    }
    return formatCurrency(value)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-amber-50">
      {/* Header */}
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
              <h1 className="text-xl font-bold text-gray-900">Relatórios</h1>
              <p className="text-xs text-gray-600">[SUA EMPRESA]</p>
            </div>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto max-w-7xl px-4 py-8">
        {/* Filtro de Data */}
        <Card className="mb-6 bg-white/80 backdrop-blur-sm border-2 border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="h-5 w-5 text-red-600" />
              Filtrar por Período
            </CardTitle>
            <CardDescription>
              Selecione o período para visualizar os dados do relatório. Para ver um dia específico, coloque a mesma data nos dois campos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Atalhos de Período */}
            <div className="flex flex-wrap gap-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuickPeriod('today')}
                disabled={loading}
                className="border-red-300 text-red-600 hover:bg-red-50"
              >
                📅 Hoje
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuickPeriod('week')}
                disabled={loading}
                className="border-blue-300 text-blue-600 hover:bg-blue-50"
              >
                📆 Últimos 7 dias
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuickPeriod('month')}
                disabled={loading}
                className="border-green-300 text-green-600 hover:bg-green-50"
              >
                🗓️ Este Mês
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuickPeriod('year')}
                disabled={loading}
                className="border-purple-300 text-purple-600 hover:bg-purple-50"
              >
                📊 Este Ano
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="startDate" className="text-sm font-medium mb-2 block">
                  Data Inicial
                </Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full"
                  disabled={loading}
                />
              </div>
              
              <div>
                <Label htmlFor="endDate" className="text-sm font-medium mb-2 block">
                  Data Final
                </Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full"
                  disabled={loading}
                />
              </div>
              
              <div className="flex items-end gap-2">
                <Button
                  onClick={applyFilter}
                  disabled={loading || !startDate || !endDate}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Carregando...
                    </>
                  ) : (
                    <>
                      <Calendar className="h-4 w-4 mr-2" />
                      Aplicar Filtro
                    </>
                  )}
                </Button>
                
                {isFiltered && (
                  <Button
                    onClick={clearDateFilter}
                    disabled={loading}
                    variant="outline"
                    className="border-gray-300 text-gray-600 hover:bg-gray-50"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Limpar
                  </Button>
                )}
              </div>
            </div>
            
            {/* Indicador do Período Atual */}
            {isFiltered && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
                <p className="text-sm text-red-700 font-medium">
                  📊 Exibindo dados de: <span className="font-bold">{filteredPeriod}</span>
                </p>
                <Button
                  onClick={clearDateFilter}
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-100"
                >
                  <X className="h-4 w-4 mr-1" />
                  Ver Tudo
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Summary Stats */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-emerald-500/10"></div>
            <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Faturamento
              </CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent className="relative">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(stats.totalRevenue)}
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {filteredPeriod}
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/10"></div>
            <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Pedidos
              </CardTitle>
              <ShoppingCart className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent className="relative">
              <div className="text-2xl font-bold text-blue-600">
                {stats.totalOrders}
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {filteredPeriod}
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10"></div>
            <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Clientes (compras)
              </CardTitle>
              <Users className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent className="relative">
              <div className="text-2xl font-bold text-purple-600">
                {allCustomersRanked.length}
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {filteredPeriod}
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-amber-500/10"></div>
            <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Ticket Médio
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent className="relative">
              <div className="text-2xl font-bold text-orange-600">
                {formatCurrency(stats.averageOrderValue)}
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {filteredPeriod}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Sales by Month */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                Faturamento Mensal
              </CardTitle>
              <CardDescription>
                {filteredPeriod}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={salesByMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={formatCompactCurrency} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Line type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={2} name="Faturamento" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Orders by Month */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-blue-600" />
                Pedidos por Mês
              </CardTitle>
              <CardDescription>
                {filteredPeriod}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={salesByMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="orders" fill="#2563eb" name="Pedidos" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Daily Charts */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Revenue by Day */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                Faturamento Diário
              </CardTitle>
              <CardDescription>
                Últimos 30 dias
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={salesByDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="day" 
                    tick={{ fontSize: 10 }}
                    interval={4}
                  />
                  <YAxis tickFormatter={formatCompactCurrency} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#059669" 
                    strokeWidth={2} 
                    name="Faturamento"
                    dot={{ r: 3 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Orders by Day */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-cyan-600" />
                Pedidos Diários
              </CardTitle>
              <CardDescription>
                Últimos 30 dias
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={salesByDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="day" 
                    tick={{ fontSize: 10 }}
                    interval={4}
                  />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="orders" fill="#0891b2" name="Pedidos" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Top Customers and Products */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Top Customers */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-600" />
                    {showAllCustomers ? `Todos os Clientes (${filteredCustomers.length})` : 'Top 10 Clientes'}
                  </CardTitle>
                  <CardDescription>
                    Maiores compradores
                  </CardDescription>
                </div>
                {filteredCustomers.length > 10 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAllCustomers(!showAllCustomers)}
                    className="flex items-center gap-1"
                  >
                    {showAllCustomers ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        Ver Top 10
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        Ver Todos ({filteredCustomers.length})
                      </>
                    )}
                  </Button>
                )}
              </div>
              
              {/* 🔧 Campo de busca por nome de cliente */}
              <div className="mt-4 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="Buscar cliente por nome ou cidade..."
                  value={customerSearchTerm}
                  onChange={(e) => setCustomerSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {/* 🔧 Contador de resultados filtrados */}
              {customerSearchTerm && (
                <p className="text-sm text-gray-600 mt-2">
                  {filteredCustomers.length === 0 
                    ? 'Nenhum cliente encontrado' 
                    : `${filteredCustomers.length} cliente${filteredCustomers.length > 1 ? 's' : ''} encontrado${filteredCustomers.length > 1 ? 's' : ''}`
                  }
                </p>
              )}
            </CardHeader>
            <CardContent>
              <div className={`space-y-4 ${showAllCustomers ? 'max-h-[600px] overflow-y-auto pr-2' : ''}`}>
                {displayedCustomers.map((customer, index) => (
                  <div key={customer.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <span className="text-purple-600 font-bold text-sm">
                          #{index + 1}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{customer.name}</p>
                        <p className="text-sm text-gray-600">{customer.city}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-purple-600">
                        {formatCurrency(customer.totalSpent)}
                      </p>
                      <p className="text-xs text-gray-600">
                        {customer.orderCount} pedidos
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {displayedCustomers.length === 0 && (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Nenhum cliente encontrado</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Products */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-orange-600" />
                    {showAllProducts ? `Todos os Produtos (${filteredProducts.length})` : 'Top 10 Produtos'}
                  </CardTitle>
                  <CardDescription>
                    Mais vendidos
                  </CardDescription>
                </div>
                {allProductsRanked.length > 10 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAllProducts(!showAllProducts)}
                    className="flex items-center gap-1"
                  >
                    {showAllProducts ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        Ver Top 10
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        Ver Todos ({allProductsRanked.length})
                      </>
                    )}
                  </Button>
                )}
              </div>
              
              {/* 🔧 NOVO: Campo de busca por nome de produto */}
              <div className="mt-4 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="Buscar produto por nome..."
                  value={productSearchTerm}
                  onChange={(e) => setProductSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {/* 🔧 Contador de resultados filtrados */}
              {productSearchTerm && (
                <p className="text-sm text-gray-600 mt-2">
                  {filteredProducts.length === 0 
                    ? 'Nenhum produto encontrado' 
                    : `${filteredProducts.length} produto${filteredProducts.length > 1 ? 's' : ''} encontrado${filteredProducts.length > 1 ? 's' : ''}`
                  }
                </p>
              )}
            </CardHeader>
            <CardContent>
              <div className={`space-y-4 ${showAllProducts ? 'max-h-[600px] overflow-y-auto pr-2' : ''}`}>
                {displayedProducts.map((product, index) => (
                  <div key={product.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                        <span className="text-orange-600 font-bold text-sm">
                          #{index + 1}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{product.name}</p>
                        <p className="text-sm text-gray-600">
                          {product.quantitySold} unidades
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-orange-600">
                        {formatCurrency(product.revenue)}
                      </p>
                      <p className="text-xs text-gray-600">
                        {product.orderCount} pedidos
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {displayedProducts.length === 0 && (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Nenhum produto vendido</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Inactive Customers */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <UserX className="w-5 h-5 text-red-600" />
                    Clientes Inativos
                  </CardTitle>
                  <CardDescription>
                    Clientes sem compras há mais de 7 dias
                  </CardDescription>
                </div>
                <div className="bg-red-100 px-4 py-2 rounded-lg">
                  <span className="text-2xl font-bold text-red-600">
                    {inactiveCustomers.length}
                  </span>
                  <p className="text-xs text-red-700 mt-1">
                    clientes inativos
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {inactiveCustomers.length > 0 ? (
                <div className="space-y-3">
                  {inactiveCustomers.map((customer) => (
                    <div 
                      key={customer.id} 
                      className="flex items-center justify-between p-4 bg-gradient-to-r from-red-50 to-orange-50 rounded-lg border border-red-100 hover:shadow-md transition-shadow"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                            <UserX className="w-5 h-5 text-red-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{customer.name}</p>
                            <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                              {customer.city && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {customer.city}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-6 ml-13 text-sm">
                          {customer.phone && (
                            <span className="flex items-center gap-1 text-gray-600">
                              <Phone className="w-3 h-3" />
                              {customer.phone}
                            </span>
                          )}
                          {customer.email && (
                            <span className="flex items-center gap-1 text-gray-600">
                              <Mail className="w-3 h-3" />
                              {customer.email}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="flex items-center gap-2 justify-end mb-1">
                          <Calendar className="w-4 h-4 text-red-600" />
                          {customer.daysSinceLastOrder !== null ? (
                            <span className="font-bold text-red-600 text-lg">
                              {customer.daysSinceLastOrder} dias
                            </span>
                          ) : (
                            <span className="font-bold text-red-600 text-lg">
                              Nunca comprou
                            </span>
                          )}
                        </div>
                        {customer.lastOrderDate && (
                          <p className="text-xs text-gray-600">
                            Última compra: {new Date(customer.lastOrderDate).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <UserX className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 font-medium">Ótimas notícias!</p>
                  <p className="text-gray-500 text-sm mt-2">
                    Todos os clientes fizeram compras nos últimos 7 dias
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
