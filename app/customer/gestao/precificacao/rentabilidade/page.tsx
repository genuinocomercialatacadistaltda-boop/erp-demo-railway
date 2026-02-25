'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { TrendingUp, Home, ArrowLeft, TrendingDown, AlertCircle, CheckCircle2, DollarSign } from 'lucide-react'

interface ProductProfitability {
  recipeId: string
  recipeName: string
  productName: string
  totalCost: number
  totalCostPerUnit: number
  salePrice: number
  profitPerUnit: number
  profitMargin: number
  status: 'low' | 'medium' | 'high'
}

interface ProfitabilityData {
  products: ProductProfitability[]
  stats: {
    totalRecipes: number
    averageMargin: number
    lowMarginCount: number
    mediumMarginCount: number
    highMarginCount: number
  }
}

export default function ClientRentabilidadePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ProfitabilityData | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }

    if (status === 'authenticated' && session?.user) {
      const userType = (session.user as any)?.userType
      if (userType !== 'CUSTOMER') {
        toast.error('Acesso não autorizado')
        router.push('/customer/gestao')
        return
      }

      loadData()
    }
  }, [status, session, router])

  const loadData = async () => {
    try {
      setLoading(true)

      const response = await fetch('/api/client-management/pricing/profitability')
      if (response.ok) {
        const profitabilityData = await response.json()
        setData(profitabilityData)
      } else {
        toast.error('Erro ao carregar dados de rentabilidade')
      }

      setLoading(false)
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      toast.error('Erro ao carregar dados')
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`
  }

  const getStatusBadge = (status: string, margin: number) => {
    switch (status) {
      case 'high':
        return (
          <Badge className="bg-green-600 hover:bg-green-700">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Ótima Margem ({formatPercent(margin)})
          </Badge>
        )
      case 'medium':
        return (
          <Badge className="bg-blue-600 hover:bg-blue-700">
            <TrendingUp className="h-3 w-3 mr-1" />
            Boa Margem ({formatPercent(margin)})
          </Badge>
        )
      case 'low':
        return (
          <Badge className="bg-orange-600 hover:bg-orange-700">
            <AlertCircle className="h-3 w-3 mr-1" />
            Margem Baixa ({formatPercent(margin)})
          </Badge>
        )
      default:
        return null
    }
  }

  const filteredProducts = data?.products?.filter(p => {
    if (filterStatus === 'all') return true
    return p.status === filterStatus
  }) || []

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando análise de rentabilidade...</p>
        </div>
      </div>
    )
  }

  if (!data || !data.products || data.products.length === 0) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <Card>
          <CardContent className="py-12 text-center">
            <TrendingUp className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg mb-4">Nenhum dado de rentabilidade disponível</p>
            <p className="text-gray-500 mb-4">Crie receitas e produtos para visualizar a análise de rentabilidade</p>
            <Button
              onClick={() => router.push('/customer/gestao/precificacao/receitas')}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Ir para Receitas
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-orange-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard de Rentabilidade</h1>
              <p className="text-gray-600">Análise detalhada de custos e margens de lucro</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => router.push('/customer/gestao')}
            >
              <Home className="mr-2 h-4 w-4" />
              Página Inicial
            </Button>
            <Button
              variant="outline"
              onClick={() => router.back()}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Produtos Analisados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{data.stats.totalRecipes}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Margem Média</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {formatPercent(data.stats.averageMargin)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Alta Margem</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {data.stats.highMarginCount}
            </div>
            <p className="text-xs text-gray-600 mt-1">&gt; 40% de margem</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Margem Baixa</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              {data.stats.lowMarginCount}
            </div>
            <p className="text-xs text-gray-600 mt-1">&lt; 20% de margem</p>
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card className="bg-green-50 border-green-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Top 5 Mais Rentáveis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.products
                .sort((a, b) => b.profitMargin - a.profitMargin)
                .slice(0, 5)
                .map((product, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-white rounded">
                    <div>
                      <p className="font-semibold text-sm">{product.recipeName}</p>
                      <p className="text-xs text-gray-600">Margem: {formatPercent(product.profitMargin)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-green-600">
                        {formatCurrency(product.profitPerUnit)}
                      </p>
                      <p className="text-xs text-gray-600">por unidade</p>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-orange-50 border-orange-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              Top 5 Menos Rentáveis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.products
                .sort((a, b) => a.profitMargin - b.profitMargin)
                .slice(0, 5)
                .map((product, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-white rounded">
                    <div>
                      <p className="font-semibold text-sm">{product.recipeName}</p>
                      <p className="text-xs text-gray-600">Margem: {formatPercent(product.profitMargin)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-orange-600">
                        {formatCurrency(product.profitPerUnit)}
                      </p>
                      <p className="text-xs text-gray-600">por unidade</p>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Filtrar por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={filterStatus === 'all' ? 'default' : 'outline'}
                onClick={() => setFilterStatus('all')}
                size="sm"
              >
                Todos ({data.products.length})
              </Button>
              <Button
                variant={filterStatus === 'high' ? 'default' : 'outline'}
                onClick={() => setFilterStatus('high')}
                size="sm"
                className={filterStatus === 'high' ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                Alta Margem ({data.stats.highMarginCount})
              </Button>
              <Button
                variant={filterStatus === 'medium' ? 'default' : 'outline'}
                onClick={() => setFilterStatus('medium')}
                size="sm"
                className={filterStatus === 'medium' ? 'bg-blue-600 hover:bg-blue-700' : ''}
              >
                Boa Margem ({data.stats.mediumMarginCount})
              </Button>
              <Button
                variant={filterStatus === 'low' ? 'default' : 'outline'}
                onClick={() => setFilterStatus('low')}
                size="sm"
                className={filterStatus === 'low' ? 'bg-orange-600 hover:bg-orange-700' : ''}
              >
                Margem Baixa ({data.stats.lowMarginCount})
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Produto</CardTitle>
          <CardDescription>
            Análise completa de custos, preços e margens de lucro
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Produto</th>
                  <th className="text-right p-2">Custo Total</th>
                  <th className="text-right p-2">Preço Venda</th>
                  <th className="text-right p-2">Lucro</th>
                  <th className="text-right p-2">Margem</th>
                  <th className="text-center p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="p-2">
                      <div>
                        <p className="font-semibold">{product.recipeName}</p>
                        {product.productName && (
                          <p className="text-xs text-gray-600">{product.productName}</p>
                        )}
                      </div>
                    </td>
                    <td className="text-right p-2">
                      <div>
                        <p className="font-semibold">{formatCurrency(product.totalCostPerUnit)}</p>
                        <p className="text-xs text-gray-600">por unidade</p>
                      </div>
                    </td>
                    <td className="text-right p-2">
                      <p className="font-semibold text-blue-600">{formatCurrency(product.salePrice)}</p>
                    </td>
                    <td className="text-right p-2">
                      <p className="font-semibold text-green-600">
                        {formatCurrency(product.profitPerUnit)}
                      </p>
                    </td>
                    <td className="text-right p-2">
                      <p className="text-lg font-bold">
                        {formatPercent(product.profitMargin)}
                      </p>
                    </td>
                    <td className="text-center p-2">
                      {getStatusBadge(product.status, product.profitMargin)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
