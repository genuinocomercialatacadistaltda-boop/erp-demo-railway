'use client'

import { useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { 
  Award, 
  ShoppingBag, 
  Package, 
  Bell, 
  LogOut, 
  User,
  TrendingUp,
  Calendar,
  DollarSign
} from 'lucide-react'

interface CustomerData {
  id: string
  name: string
  email: string | null
  phone: string
  customerType: string
  pointsBalance: number
  pointsMultiplier: number
  totalPointsEarned: number
  totalPointsRedeemed: number
  createdAt: string
}

interface Stats {
  totalOrders: number
  totalSpent: number
  recentOrders: any[]
}

export default function VarejoDashboardPage() {
  const { data: session, status } = useSession() || {}
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [customer, setCustomer] = useState<CustomerData | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    if (status === 'loading') return
    
    if (!session) {
      router.push('/auth/login')
      return
    }

    loadCustomerData()
  }, [session, status, router])

  const loadCustomerData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/varejo/me')
      const data = await response.json()
      
      if (data.success) {
        setCustomer(data.customer)
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await signOut({ redirect: false })
    router.push('/')
  }

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-red-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-orange-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <ShoppingBag className="w-8 h-8 text-white animate-pulse" />
          </div>
          <p className="text-lg text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!customer) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-red-50">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto max-w-6xl flex h-16 items-center justify-between px-4">
          <div className="flex items-center space-x-3">
            <Image 
              src="/logo.jpg" 
              alt="[SUA EMPRESA]" 
              width={40} 
              height={40}
              className="rounded-lg"
            />
            <div>
              <h1 className="text-lg font-bold text-gray-900">Meu Painel Varejo</h1>
              <p className="text-xs text-gray-600">{customer.name}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </Button>
        </div>
      </header>

      <div className="container mx-auto max-w-6xl px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-orange-600 to-red-600 text-white border-0">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90 mb-1">Pontos Disponíveis</p>
                  <p className="text-3xl font-bold">{customer.pointsBalance.toFixed(0)}</p>
                </div>
                <Award className="w-12 h-12 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total de Pedidos</p>
                  <p className="text-3xl font-bold text-gray-900">{stats?.totalOrders || 0}</p>
                </div>
                <ShoppingBag className="w-10 h-10 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Gasto</p>
                  <p className="text-2xl font-bold text-gray-900">
                    R$ {(stats?.totalSpent || 0).toFixed(2)}
                  </p>
                </div>
                <DollarSign className="w-10 h-10 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Multiplicador</p>
                  <p className="text-3xl font-bold text-gray-900">{customer.pointsMultiplier}x</p>
                </div>
                <TrendingUp className="w-10 h-10 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="catalog" className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="catalog">
              <Package className="w-4 h-4 mr-2" />
              Catálogo
            </TabsTrigger>
            <TabsTrigger value="orders">
              <ShoppingBag className="w-4 h-4 mr-2" />
              Pedidos
            </TabsTrigger>
            <TabsTrigger value="points">
              <Award className="w-4 h-4 mr-2" />
              Pontos
            </TabsTrigger>
            <TabsTrigger value="investir">
              <TrendingUp className="w-4 h-4 mr-2" />
              💰 Investir
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="w-4 h-4 mr-2" />
              Notificações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="catalog">
            <Card>
              <CardHeader>
                <CardTitle>Catálogo de Produtos</CardTitle>
                <CardDescription>
                  Navegue pelos nossos produtos e faça seu pedido
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full bg-orange-600 hover:bg-orange-700"
                  onClick={() => router.push('/retail')}
                >
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  Fazer Novo Pedido
                </Button>
                <p className="text-sm text-gray-600 text-center mt-4">
                  Clique no botão acima para ver o catálogo completo e fazer seu pedido
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Pedidos</CardTitle>
                <CardDescription>
                  Acompanhe todos os seus pedidos
                </CardDescription>
              </CardHeader>
              <CardContent>
                {stats?.recentOrders && stats.recentOrders.length > 0 ? (
                  <div className="space-y-4">
                    {stats.recentOrders.map((order) => (
                      <div 
                        key={order.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <p className="font-semibold">#{order.orderNumber}</p>
                            <Badge variant={order.status === 'DELIVERED' ? 'default' : 'secondary'}>
                              {order.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">
                            {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">R$ {order.total.toFixed(2)}</p>
                          <p className="text-xs text-gray-600">{order.orderType}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 mb-4">Você ainda não fez nenhum pedido</p>
                    <Button
                      className="bg-orange-600 hover:bg-orange-700"
                      onClick={() => router.push('/retail')}
                    >
                      Fazer Meu Primeiro Pedido
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="points">
            <Card>
              <CardHeader>
                <CardTitle>Sistema de Pontos</CardTitle>
                <CardDescription>
                  Acumule pontos e troque por recompensas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="bg-gradient-to-br from-orange-100 to-amber-100 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm text-gray-700 mb-1">Saldo Atual</p>
                        <p className="text-4xl font-bold text-orange-600">
                          {customer.pointsBalance.toFixed(0)} pts
                        </p>
                      </div>
                      <Award className="w-16 h-16 text-orange-600 opacity-50" />
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-orange-200">
                      <div>
                        <p className="text-xs text-gray-600">Total Ganho</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {customer.totalPointsEarned.toFixed(0)} pts
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Total Resgatado</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {customer.totalPointsRedeemed.toFixed(0)} pts
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 mb-2">Como Funciona?</h4>
                    <ul className="space-y-2 text-sm text-blue-800">
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5"></div>
                        <span>Ganhe {customer.pointsMultiplier} ponto para cada R$ 1,00 gasto</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5"></div>
                        <span>Acumule pontos em todos os seus pedidos</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5"></div>
                        <span>Troque por descontos e recompensas exclusivas</span>
                      </li>
                    </ul>
                  </div>

                  <Button 
                    className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-semibold py-6"
                    onClick={() => router.push('/dashboard/rewards')}
                  >
                    <Award className="w-5 h-5 mr-2" />
                    Ver Prêmios Disponíveis e Trocar Pontos
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="investir">
            <Card className="border-2 border-emerald-100 bg-gradient-to-br from-green-50 to-emerald-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-emerald-600" />
                  Invista na Nossa Empresa
                </CardTitle>
                <CardDescription>
                  Multiplique seu capital investindo no Grupo [SUA EMPRESA]
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                      <div className="text-3xl mb-2">💰</div>
                      <div className="font-semibold text-gray-900">Rentabilidade Mensal</div>
                      <div className="text-sm text-gray-600 mt-1">Receba dividendos</div>
                    </div>
                    <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                      <div className="text-3xl mb-2">📈</div>
                      <div className="font-semibold text-gray-900">Valorização</div>
                      <div className="text-sm text-gray-600 mt-1">Ações se valorizam</div>
                    </div>
                    <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                      <div className="text-3xl mb-2">🏆</div>
                      <div className="font-semibold text-gray-900">Participe dos Lucros</div>
                      <div className="text-sm text-gray-600 mt-1">Seja sócio</div>
                    </div>
                  </div>

                  <Button 
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-6"
                    onClick={() => router.push('/investir/dashboard')}
                  >
                    <TrendingUp className="w-5 h-5 mr-2" />
                    Acessar Plataforma de Investimentos
                  </Button>

                  <div className="text-center text-sm text-gray-600 bg-white p-4 rounded-lg">
                    💡 <strong className="text-emerald-700">Multiplique seu capital</strong> investindo em uma empresa sólida e em crescimento
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notificações</CardTitle>
                <CardDescription>
                  Mantenha-se atualizado sobre promoções e novidades
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">Nenhuma notificação no momento</p>
                  <p className="text-sm text-gray-500">
                    Você será notificado sobre promoções e novidades
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Profile Card */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Informações da Conta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Nome</p>
                <p className="font-semibold">{customer.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Telefone</p>
                <p className="font-semibold">{customer.phone}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Email</p>
                <p className="font-semibold">{customer.email || 'Não informado'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Tipo de Conta</p>
                <Badge variant="secondary">{customer.customerType}</Badge>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Membro desde</p>
                <p className="font-semibold">
                  {new Date(customer.createdAt).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
