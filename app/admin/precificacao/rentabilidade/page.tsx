'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Home, 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Package,
  AlertTriangle,
  CheckCircle,
  MinusCircle,
  XCircle,
  Calculator,
  ShoppingCart,
  Calendar,
  Info,
  Search,
  Users,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';

// Interfaces para Rentabilidade Teórica
interface ProfitabilityData {
  productId: string;
  productName: string;
  recipeId: string;
  recipeName: string;
  costs: {
    ingredients: number;
    supplies: number;
    total: number;
  };
  pricing: {
    cost: number;
    sellingPrice: number;
    profit: number;
    profitMargin: number;
  };
  status: 'profitable' | 'lowMargin' | 'breakeven' | 'unprofitable';
  lastCostUpdate: string;
  isProductActive: boolean;
  isRawMaterial?: boolean; // 🆕 Flag para matérias-primas
}

interface TheoreticalSummary {
  totalProducts: number;
  averageCost: number;
  averageMargin: number;
  profitableCount: number;
  lowMarginCount: number;
  breakevenCount: number;
  unprofitableCount: number;
}

interface TheoreticalApiResponse {
  summary: TheoreticalSummary;
  products: ProfitabilityData[];
  insights: {
    mostProfitable: ProfitabilityData[];
    leastProfitable: ProfitabilityData[];
  };
}

// Interfaces para Rentabilidade Real
interface RealProductMetrics {
  productId: string;
  productName: string;
  hasRecipe: boolean;
  recipeName: string | null;
  costPerUnit: number;
  totalQuantitySold: number;
  totalRevenue: number;
  totalCost: number;
  avgPriceSold: number;
  realProfit: number;
  realMargin: number;
  priceWholesale: number;
  salesByPrice: Record<string, { qty: number; revenue: number }>;
}

interface RealSummary {
  period: { start: string; end: string };
  totalProducts: number;
  totalQuantitySold: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  avgMargin: number;
  productsWithRecipe: number;
  productsWithoutRecipe: number;
  topByProfit: RealProductMetrics[];
  topByMargin: RealProductMetrics[];
  lowMarginProducts: RealProductMetrics[];
}

interface RealApiResponse {
  summary: RealSummary;
  products: RealProductMetrics[];
}

// Interfaces para Rentabilidade por Cliente
interface CustomerProductMetric {
  productId: string;
  productName: string;
  hasRecipe: boolean;
  costPerUnit: number;
  totalQuantity: number;
  totalRevenue: number;
  totalCost: number;
  avgPrice: number;
  profit: number;
  margin: number;
}

interface CustomerMetric {
  customerId: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  totalOrders: number;
  totalQuantity: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  avgMargin: number;
  products: CustomerProductMetric[];
}

interface CustomerSummary {
  period: { start: string; end: string };
  totalCustomers: number;
  totalOrders: number;
  totalQuantitySold: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  avgMargin: number;
  topByRevenue: CustomerMetric[];
  topByProfit: CustomerMetric[];
  lowMarginCustomers: CustomerMetric[];
}

interface CustomerApiResponse {
  summary: CustomerSummary;
  customers: CustomerMetric[];
}

export default function RentabilidadePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'theoretical' | 'real' | 'customer'>('theoretical');
  
  // State para Rentabilidade Teórica
  const [theoreticalData, setTheoreticalData] = useState<TheoreticalApiResponse | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // State para Rentabilidade Real
  const [realData, setRealData] = useState<RealApiResponse | null>(null);
  const [realLoading, setRealLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // State para Rentabilidade por Cliente
  const [customerData, setCustomerData] = useState<CustomerApiResponse | null>(null);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  
  // 🔍 BUSCA E ORDENAÇÃO
  const [searchTermTheoretical, setSearchTermTheoretical] = useState('');
  const [searchTermReal, setSearchTermReal] = useState('');
  const [searchTermCustomer, setSearchTermCustomer] = useState('');
  
  // Filtrar e ordenar produtos teóricos alfabeticamente
  const filteredTheoreticalProducts = theoreticalData?.products
    .filter(product => {
      // Filtro por status
      if (filterStatus !== 'all' && product.status !== filterStatus) return false;
      // Filtro por busca
      if (!searchTermTheoretical) return true;
      const search = searchTermTheoretical.toLowerCase();
      return (
        product.productName.toLowerCase().includes(search) ||
        product.recipeName.toLowerCase().includes(search)
      );
    })
    .sort((a, b) => a.productName.localeCompare(b.productName, 'pt-BR')) || [];
    
  // Filtrar e ordenar produtos reais alfabeticamente
  const filteredRealProducts = realData?.products
    .filter(product => {
      if (!searchTermReal) return true;
      const search = searchTermReal.toLowerCase();
      return (
        product.productName.toLowerCase().includes(search) ||
        (product.recipeName && product.recipeName.toLowerCase().includes(search))
      );
    })
    .sort((a, b) => a.productName.localeCompare(b.productName, 'pt-BR')) || [];
    
  // Filtrar e ordenar clientes alfabeticamente
  const filteredCustomers = customerData?.customers
    .filter(customer => {
      if (!searchTermCustomer) return true;
      const search = searchTermCustomer.toLowerCase();
      return (
        customer.customerName.toLowerCase().includes(search) ||
        (customer.customerEmail && customer.customerEmail.toLowerCase().includes(search)) ||
        (customer.customerPhone && customer.customerPhone.includes(search))
      );
    })
    .sort((a, b) => a.customerName.localeCompare(b.customerName, 'pt-BR')) || [];

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }

    if (status === 'authenticated' && (session?.user as any)?.userType !== 'ADMIN') {
      toast.error('Acesso negado');
      router.push('/');
      return;
    }

    if (status === 'authenticated') {
      loadTheoreticalData();
      // Definir datas padrão (mês atual)
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    }
  }, [status, session, router]);

  const loadTheoreticalData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/pricing/profitability');
      
      if (!response.ok) {
        throw new Error('Erro ao carregar dados');
      }
      
      const result = await response.json();
      setTheoreticalData(result);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar dados de rentabilidade teórica');
    } finally {
      setLoading(false);
    }
  };

  const loadRealData = async () => {
    try {
      setRealLoading(true);
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const response = await fetch(`/api/admin/pricing/real-profitability?${params}`);
      
      if (!response.ok) {
        throw new Error('Erro ao carregar dados');
      }
      
      const result = await response.json();
      setRealData(result);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar dados de rentabilidade real');
    } finally {
      setRealLoading(false);
    }
  };

  // Carregar dados reais quando trocar para a aba
  useEffect(() => {
    if (activeTab === 'real' && !realData && startDate && endDate) {
      loadRealData();
    }
  }, [activeTab, startDate, endDate]);
  
  // Função para carregar dados de rentabilidade por cliente
  const loadCustomerData = async () => {
    try {
      setCustomerLoading(true);
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const response = await fetch(`/api/admin/pricing/customer-profitability?${params}`);
      
      if (!response.ok) {
        throw new Error('Erro ao carregar dados');
      }
      
      const result = await response.json();
      setCustomerData(result);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar dados de rentabilidade por cliente');
    } finally {
      setCustomerLoading(false);
    }
  };

  // Carregar dados de clientes quando trocar para a aba
  useEffect(() => {
    if (activeTab === 'customer' && !customerData && startDate && endDate) {
      loadCustomerData();
    }
  }, [activeTab, startDate, endDate]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string; icon: any }> = {
      profitable: { 
        label: 'Lucrativo', 
        className: 'bg-green-500 text-white', 
        icon: CheckCircle 
      },
      lowMargin: { 
        label: 'Margem Baixa', 
        className: 'bg-yellow-500 text-white', 
        icon: AlertTriangle 
      },
      breakeven: { 
        label: 'Ponto de Equilíbrio', 
        className: 'bg-blue-500 text-white', 
        icon: MinusCircle 
      },
      unprofitable: { 
        label: 'Prejuízo', 
        className: 'bg-red-500 text-white', 
        icon: XCircle 
      },
    };

    const variant = variants[status] || variants.profitable;
    const Icon = variant.icon;

    return (
      <Badge className={variant.className}>
        <Icon className="w-3 h-3 mr-1" />
        {variant.label}
      </Badge>
    );
  };

  // filteredTheoreticalProducts já definido acima com busca e ordenação

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">Carregando dados...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header com Navegação */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard de Rentabilidade</h1>
          <p className="text-gray-600 mt-1">Análise de custos e margens de lucro</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => window.location.href = '/admin'}
          >
            <Home className="w-4 h-4 mr-2" />
            Página Inicial
          </Button>
          <Button
            variant="outline"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={activeTab === 'theoretical' ? 'default' : 'outline'}
          onClick={() => setActiveTab('theoretical')}
          className={activeTab === 'theoretical' ? 'bg-blue-600 hover:bg-blue-700' : ''}
        >
          <Calculator className="w-4 h-4 mr-2" />
          Rentabilidade Teórica
        </Button>
        <Button
          variant={activeTab === 'real' ? 'default' : 'outline'}
          onClick={() => setActiveTab('real')}
          className={activeTab === 'real' ? 'bg-green-600 hover:bg-green-700' : ''}
        >
          <ShoppingCart className="w-4 h-4 mr-2" />
          Rentabilidade Real
        </Button>
        <Button
          variant={activeTab === 'customer' ? 'default' : 'outline'}
          onClick={() => setActiveTab('customer')}
          className={activeTab === 'customer' ? 'bg-purple-600 hover:bg-purple-700' : ''}
        >
          <Users className="w-4 h-4 mr-2" />
          Rentabilidade por Cliente
        </Button>
      </div>

      {/* ===== ABA: RENTABILIDADE TEÓRICA ===== */}
      {activeTab === 'theoretical' && theoreticalData && (
        <>
          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Produtos Analisados
                </CardTitle>
                <Package className="w-4 h-4 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{theoreticalData.summary.totalProducts}</div>
                <p className="text-xs text-gray-500 mt-1">
                  {theoreticalData.summary.profitableCount} lucrativos
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Custo Médio
                </CardTitle>
                <DollarSign className="w-4 h-4 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(theoreticalData.summary.averageCost)}</div>
                <p className="text-xs text-gray-500 mt-1">
                  Por unidade produzida
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Margem Média
                </CardTitle>
                <TrendingUp className="w-4 h-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatPercent(theoreticalData.summary.averageMargin)}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {theoreticalData.summary.averageMargin >= 30 ? 'Ótima margem!' : theoreticalData.summary.averageMargin >= 10 ? 'Margem aceitável' : 'Margem baixa'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Alertas
                </CardTitle>
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {theoreticalData.summary.unprofitableCount + theoreticalData.summary.breakevenCount}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Produtos requerem atenção
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2 text-green-500" />
                  Top 5 Mais Rentáveis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {theoreticalData.insights.mostProfitable.map((product, index) => (
                    <div key={product.productId} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{product.productName}</p>
                          <p className="text-xs text-gray-500">
                            Custo: {formatCurrency(product.costs.total)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">{formatPercent(product.pricing.profitMargin)}</p>
                        <p className="text-xs text-gray-500">{formatCurrency(product.pricing.profit)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingDown className="w-5 h-5 mr-2 text-red-500" />
                  Top 5 Menos Rentáveis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {theoreticalData.insights.leastProfitable.map((product, index) => (
                    <div key={product.productId} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{product.productName}</p>
                          <p className="text-xs text-gray-500">
                            Custo: {formatCurrency(product.costs.total)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-red-600">{formatPercent(product.pricing.profitMargin)}</p>
                        <p className="text-xs text-gray-500">{formatCurrency(product.pricing.profit)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filtros */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Filtrar por Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={filterStatus === 'all' ? 'default' : 'outline'}
                  onClick={() => setFilterStatus('all')}
                >
                  Todos ({theoreticalData.products.length})
                </Button>
                <Button
                  variant={filterStatus === 'profitable' ? 'default' : 'outline'}
                  onClick={() => setFilterStatus('profitable')}
                  className={filterStatus === 'profitable' ? 'bg-green-500 hover:bg-green-600' : ''}
                >
                  Lucrativos ({theoreticalData.summary.profitableCount})
                </Button>
                <Button
                  variant={filterStatus === 'lowMargin' ? 'default' : 'outline'}
                  onClick={() => setFilterStatus('lowMargin')}
                  className={filterStatus === 'lowMargin' ? 'bg-yellow-500 hover:bg-yellow-600' : ''}
                >
                  Margem Baixa ({theoreticalData.summary.lowMarginCount})
                </Button>
                <Button
                  variant={filterStatus === 'breakeven' ? 'default' : 'outline'}
                  onClick={() => setFilterStatus('breakeven')}
                  className={filterStatus === 'breakeven' ? 'bg-blue-500 hover:bg-blue-600' : ''}
                >
                  Ponto de Equilíbrio ({theoreticalData.summary.breakevenCount})
                </Button>
                <Button
                  variant={filterStatus === 'unprofitable' ? 'default' : 'outline'}
                  onClick={() => setFilterStatus('unprofitable')}
                  className={filterStatus === 'unprofitable' ? 'bg-red-500 hover:bg-red-600' : ''}
                >
                  Prejuízo ({theoreticalData.summary.unprofitableCount})
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tabela */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle>Detalhamento por Produto</CardTitle>
                {/* 🔍 Campo de Busca */}
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar produto ou receita..."
                    value={searchTermTheoretical}
                    onChange={(e) => setSearchTermTheoretical(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              {searchTermTheoretical && (
                <p className="text-sm text-gray-500 mt-2">
                  {filteredTheoreticalProducts.length} produto(s) encontrado(s) para "{searchTermTheoretical}"
                </p>
              )}
            </CardHeader>
            <CardContent>
              {filteredTheoreticalProducts.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Search className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Nenhum produto encontrado</p>
                  <p className="text-sm mt-2">Tente buscar com outros termos</p>
                </div>
              ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Produto</th>
                      <th className="text-right py-3 px-4">Custo Produção</th>
                      <th className="text-right py-3 px-4">Preço Venda</th>
                      <th className="text-right py-3 px-4">Lucro</th>
                      <th className="text-right py-3 px-4">Margem</th>
                      <th className="text-center py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTheoreticalProducts.map((product) => (
                      <tr key={product.productId} className={`border-b hover:bg-gray-50 ${product.isRawMaterial ? 'bg-purple-50/50' : ''}`}>
                        <td className="py-3 px-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{product.productName}</p>
                              {product.isRawMaterial && (
                                <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700 border-purple-300">
                                  MP
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">{product.recipeName}</p>
                          </div>
                        </td>
                        <td className="text-right py-3 px-4">
                          <div>
                            <p className="font-medium">{formatCurrency(product.costs.total)}</p>
                            {!product.isRawMaterial && (
                              <p className="text-xs text-gray-500">
                                Ing: {formatCurrency(product.costs.ingredients)} + 
                                Ins: {formatCurrency(product.costs.supplies)}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="text-right py-3 px-4 font-medium">
                          {formatCurrency(product.pricing.sellingPrice)}
                        </td>
                        <td className="text-right py-3 px-4">
                          <span className={product.pricing.profit >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                            {formatCurrency(product.pricing.profit)}
                          </span>
                        </td>
                        <td className="text-right py-3 px-4">
                          <span className={
                            product.pricing.profitMargin >= 30 ? 'text-green-600 font-bold' :
                            product.pricing.profitMargin >= 10 ? 'text-yellow-600 font-bold' :
                            product.pricing.profitMargin >= 0 ? 'text-blue-600 font-bold' :
                            'text-red-600 font-bold'
                          }>
                            {formatPercent(product.pricing.profitMargin)}
                          </span>
                        </td>
                        <td className="text-center py-3 px-4">
                          {getStatusBadge(product.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ===== ABA: RENTABILIDADE REAL ===== */}
      {activeTab === 'real' && (
        <>
          {/* Alerta Informativo */}
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-800">Rentabilidade Real vs Teórica</p>
                  <p className="text-sm text-blue-700 mt-1">
                    Este relatório mostra a margem de lucro <strong>real</strong> baseada nos preços 
                    <strong> efetivamente praticados no checkout</strong> (promoções, descontos progressivos, 
                    descontos manuais). Produtos sem receita cadastrada usam margem fixa estimada de 30%.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Filtro de Data */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                Período de Análise
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <Label htmlFor="startDate">Data Inicial</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-40"
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">Data Final</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-40"
                  />
                </div>
                <Button onClick={loadRealData} disabled={realLoading}>
                  {realLoading ? 'Carregando...' : 'Atualizar'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {realLoading && (
            <div className="flex items-center justify-center min-h-[200px]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Calculando rentabilidade real...</p>
              </div>
            </div>
          )}

          {realData && !realLoading && (
            <>
              {/* Cards de Resumo Geral */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-blue-700">Faturamento Real</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-800">
                      {formatCurrency(realData.summary.totalRevenue)}
                    </div>
                    <p className="text-xs text-blue-600 mt-1">
                      {realData.summary.totalQuantitySold.toLocaleString()} unidades vendidas
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-red-700">Custo Total</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-800">
                      {formatCurrency(realData.summary.totalCost)}
                    </div>
                    <p className="text-xs text-red-600 mt-1">
                      Custo de produção
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-green-700">Lucro Real</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-800">
                      {formatCurrency(realData.summary.totalProfit)}
                    </div>
                    <p className="text-xs text-green-600 mt-1">
                      Faturamento - Custo
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-purple-700">Margem Real</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-800">
                      {formatPercent(realData.summary.avgMargin)}
                    </div>
                    <p className="text-xs text-purple-600 mt-1">
                      Lucro / Faturamento
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-700">Produtos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-800">
                      {realData.summary.totalProducts}
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {realData.summary.productsWithRecipe} c/ receita, {realData.summary.productsWithoutRecipe} s/ receita
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Top Produtos */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <DollarSign className="w-5 h-5 mr-2 text-green-500" />
                      Top 5 por Lucro Real
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {realData.summary.topByProfit.slice(0, 5).map((product, index) => (
                        <div key={product.productId} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{product.productName}</p>
                              <p className="text-xs text-gray-500">
                                {product.totalQuantitySold} un. × {formatCurrency(product.avgPriceSold)} médio
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-green-600">{formatCurrency(product.realProfit)}</p>
                            <p className="text-xs text-gray-500">{formatPercent(product.realMargin)} margem</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Alertas de Margem Baixa */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <AlertTriangle className="w-5 h-5 mr-2 text-yellow-500" />
                      Alertas: Margem Real Baixa (&lt;20%)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {realData.summary.lowMarginProducts.length === 0 ? (
                      <div className="text-center py-6 text-gray-500">
                        <CheckCircle className="w-12 h-12 mx-auto text-green-400 mb-2" />
                        <p>Nenhum produto com margem baixa!</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {realData.summary.lowMarginProducts.slice(0, 5).map((product) => (
                          <div key={product.productId} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                            <div>
                              <p className="font-medium text-sm">{product.productName}</p>
                              <p className="text-xs text-gray-500">
                                {product.totalQuantitySold} un. vendidas
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-yellow-600">{formatPercent(product.realMargin)}</p>
                              <p className="text-xs text-gray-500">Preço médio: {formatCurrency(product.avgPriceSold)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Tabela Detalhada */}
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <CardTitle>Detalhamento por Produto - Rentabilidade Real</CardTitle>
                    {/* 🔍 Campo de Busca */}
                    <div className="relative w-full sm:w-72">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Buscar produto ou receita..."
                        value={searchTermReal}
                        onChange={(e) => setSearchTermReal(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  {searchTermReal && (
                    <p className="text-sm text-gray-500 mt-2">
                      {filteredRealProducts.length} produto(s) encontrado(s) para "{searchTermReal}"
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  {filteredRealProducts.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Search className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p>Nenhum produto encontrado</p>
                      <p className="text-sm mt-2">Tente buscar com outros termos</p>
                    </div>
                  ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="text-left py-3 px-4">Produto</th>
                          <th className="text-right py-3 px-4">Qtd Vendida</th>
                          <th className="text-right py-3 px-4">Custo Unit.</th>
                          <th className="text-right py-3 px-4">Preço Médio</th>
                          <th className="text-right py-3 px-4">Faturamento</th>
                          <th className="text-right py-3 px-4">Lucro Real</th>
                          <th className="text-right py-3 px-4">Margem Real</th>
                          <th className="text-center py-3 px-4">Obs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRealProducts.map((product) => (
                          <tr key={product.productId} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <div>
                                <p className="font-medium">{product.productName}</p>
                                {product.hasRecipe && product.recipeName && (
                                  <p className="text-xs text-gray-500">{product.recipeName}</p>
                                )}
                              </div>
                            </td>
                            <td className="text-right py-3 px-4 font-medium">
                              {product.totalQuantitySold.toLocaleString()}
                            </td>
                            <td className="text-right py-3 px-4">
                              {formatCurrency(product.costPerUnit)}
                            </td>
                            <td className="text-right py-3 px-4">
                              <div>
                                <p className="font-medium">{formatCurrency(product.avgPriceSold)}</p>
                                {product.priceWholesale > 0 && product.avgPriceSold < product.priceWholesale && (
                                  <p className="text-xs text-red-500">
                                    Tabela: {formatCurrency(product.priceWholesale)}
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className="text-right py-3 px-4 font-medium">
                              {formatCurrency(product.totalRevenue)}
                            </td>
                            <td className="text-right py-3 px-4">
                              <span className={product.realProfit >= 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                                {formatCurrency(product.realProfit)}
                              </span>
                            </td>
                            <td className="text-right py-3 px-4">
                              <span className={
                                product.realMargin >= 30 ? 'text-green-600 font-bold' :
                                product.realMargin >= 20 ? 'text-blue-600 font-bold' :
                                product.realMargin >= 10 ? 'text-yellow-600 font-bold' :
                                'text-red-600 font-bold'
                              }>
                                {formatPercent(product.realMargin)}
                              </span>
                            </td>
                            <td className="text-center py-3 px-4">
                              {!product.hasRecipe && (
                                <Badge variant="outline" className="text-xs bg-gray-100">
                                  <Info className="w-3 h-3 mr-1" />
                                  Margem ~30%
                                </Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {!realData && !realLoading && (
            <Card>
              <CardContent className="py-12 text-center">
                <ShoppingCart className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">Clique em "Atualizar" para carregar os dados de rentabilidade real</p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ===== ABA: RENTABILIDADE POR CLIENTE ===== */}
      {activeTab === 'customer' && (
        <>
          {/* Alerta Informativo */}
          <Card className="mb-6 border-purple-200 bg-purple-50">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-purple-800">Rentabilidade por Cliente</p>
                  <p className="text-sm text-purple-700 mt-1">
                    Este relatório mostra o <strong>preço médio praticado</strong> e o <strong>lucro gerado</strong> por cada cliente.
                    Clique em um cliente para ver o detalhamento dos produtos comprados.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Filtros de Data */}
          <Card className="mb-6">
            <CardContent className="pt-4">
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <Label htmlFor="startDate" className="text-sm">Data Inicial</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-40"
                  />
                </div>
                <div>
                  <Label htmlFor="endDate" className="text-sm">Data Final</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-40"
                  />
                </div>
                <Button onClick={loadCustomerData} disabled={customerLoading}>
                  <Calendar className="w-4 h-4 mr-2" />
                  {customerLoading ? 'Carregando...' : 'Atualizar'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {customerLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Carregando dados de clientes...</p>
              </div>
            </div>
          )}

          {customerData && (
            <>
              {/* Cards de Resumo */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">
                      Total de Clientes
                    </CardTitle>
                    <Users className="w-4 h-4 text-purple-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{customerData.summary.totalCustomers}</div>
                    <p className="text-xs text-gray-500">{customerData.summary.totalOrders} pedidos no período</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">
                      Faturamento
                    </CardTitle>
                    <DollarSign className="w-4 h-4 text-green-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(customerData.summary.totalRevenue)}
                    </div>
                    <p className="text-xs text-gray-500">{customerData.summary.totalQuantitySold.toLocaleString()} unidades</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">
                      Lucro Total
                    </CardTitle>
                    <TrendingUp className="w-4 h-4 text-blue-400" />
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${customerData.summary.totalProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      {formatCurrency(customerData.summary.totalProfit)}
                    </div>
                    <p className="text-xs text-gray-500">Custo: {formatCurrency(customerData.summary.totalCost)}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">
                      Margem Média
                    </CardTitle>
                    <Package className="w-4 h-4 text-orange-400" />
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${
                      customerData.summary.avgMargin >= 30 ? 'text-green-600' :
                      customerData.summary.avgMargin >= 20 ? 'text-blue-600' :
                      customerData.summary.avgMargin >= 10 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {formatPercent(customerData.summary.avgMargin)}
                    </div>
                    <p className="text-xs text-gray-500">
                      {customerData.summary.lowMarginCustomers.length} cliente(s) com margem baixa
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Tabela de Clientes */}
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <CardTitle>Detalhamento por Cliente</CardTitle>
                    {/* 🔍 Campo de Busca */}
                    <div className="relative w-full sm:w-72">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Buscar cliente..."
                        value={searchTermCustomer}
                        onChange={(e) => setSearchTermCustomer(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  {searchTermCustomer && (
                    <p className="text-sm text-gray-500 mt-2">
                      {filteredCustomers.length} cliente(s) encontrado(s) para "{searchTermCustomer}"
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  {filteredCustomers.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Search className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p>Nenhum cliente encontrado</p>
                      <p className="text-sm mt-2">Tente buscar com outros termos</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredCustomers.map((customer) => (
                        <div key={customer.customerId} className="border rounded-lg overflow-hidden">
                          {/* Linha do Cliente */}
                          <div 
                            className="p-4 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                            onClick={() => setExpandedCustomer(
                              expandedCustomer === customer.customerId ? null : customer.customerId
                            )}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium">{customer.customerName}</h3>
                                <Badge variant="outline" className="text-xs">
                                  {customer.totalOrders} {customer.totalOrders === 1 ? 'pedido' : 'pedidos'}
                                </Badge>
                              </div>
                              {customer.customerEmail && (
                                <p className="text-xs text-gray-500">{customer.customerEmail}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-6 text-sm">
                              <div className="text-right">
                                <p className="text-xs text-gray-500">Faturamento</p>
                                <p className="font-medium">{formatCurrency(customer.totalRevenue)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-500">Lucro</p>
                                <p className={`font-medium ${customer.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {formatCurrency(customer.totalProfit)}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-500">Margem</p>
                                <p className={`font-bold ${
                                  customer.avgMargin >= 30 ? 'text-green-600' :
                                  customer.avgMargin >= 20 ? 'text-blue-600' :
                                  customer.avgMargin >= 10 ? 'text-yellow-600' :
                                  'text-red-600'
                                }`}>
                                  {formatPercent(customer.avgMargin)}
                                </p>
                              </div>
                              {expandedCustomer === customer.customerId ? (
                                <ChevronUp className="w-5 h-5 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-gray-400" />
                              )}
                            </div>
                          </div>

                          {/* Produtos do Cliente (Expandível) */}
                          {expandedCustomer === customer.customerId && (
                            <div className="border-t bg-gray-50 p-4">
                              <h4 className="font-medium text-sm mb-3 text-gray-700">
                                Produtos comprados por {customer.customerName}
                              </h4>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b bg-gray-100">
                                      <th className="text-left py-2 px-3">Produto</th>
                                      <th className="text-right py-2 px-3">Qtd</th>
                                      <th className="text-right py-2 px-3">Custo Unit.</th>
                                      <th className="text-right py-2 px-3">Preço Médio</th>
                                      <th className="text-right py-2 px-3">Faturamento</th>
                                      <th className="text-right py-2 px-3">Lucro</th>
                                      <th className="text-right py-2 px-3">Margem</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {customer.products.map((product) => (
                                      <tr key={product.productId} className="border-b hover:bg-white">
                                        <td className="py-2 px-3">
                                          <div className="flex items-center gap-2">
                                            <span>{product.productName}</span>
                                            {!product.hasRecipe && (
                                              <Badge variant="outline" className="text-xs bg-gray-100">
                                                <Info className="w-3 h-3 mr-1" />
                                                ~30%
                                              </Badge>
                                            )}
                                          </div>
                                        </td>
                                        <td className="text-right py-2 px-3 font-medium">
                                          {product.totalQuantity}
                                        </td>
                                        <td className="text-right py-2 px-3 text-gray-600">
                                          {formatCurrency(product.costPerUnit)}
                                        </td>
                                        <td className="text-right py-2 px-3 font-medium text-blue-600">
                                          {formatCurrency(product.avgPrice)}
                                        </td>
                                        <td className="text-right py-2 px-3">
                                          {formatCurrency(product.totalRevenue)}
                                        </td>
                                        <td className={`text-right py-2 px-3 font-medium ${
                                          product.profit >= 0 ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                          {formatCurrency(product.profit)}
                                        </td>
                                        <td className={`text-right py-2 px-3 font-bold ${
                                          product.margin >= 30 ? 'text-green-600' :
                                          product.margin >= 20 ? 'text-blue-600' :
                                          product.margin >= 10 ? 'text-yellow-600' :
                                          'text-red-600'
                                        }`}>
                                          {formatPercent(product.margin)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {!customerData && !customerLoading && (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">Clique em "Atualizar" para carregar os dados de rentabilidade por cliente</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
