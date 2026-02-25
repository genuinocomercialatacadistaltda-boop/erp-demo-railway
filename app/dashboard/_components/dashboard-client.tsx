
'use client'

import { useState, useEffect } from 'react'
import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Flame, 
  CreditCard, 
  Calendar, 
  ShoppingCart, 
  History, 
  Bell, 
  LogOut,
  DollarSign,
  Package,
  TrendingUp,
  Clock,
  Gift,
  BarChart3,
  Users
} from 'lucide-react'
import { motion } from 'framer-motion'
import { HomeButton } from '@/components/home-button'
import { redirectToInvestmentApp } from '@/lib/sso-redirect'
import { toast } from 'sonner'

interface DashboardClientProps {
  customer: any
  notifications: any[]
  userName: string
}

export function DashboardClient({ customer, notifications, userName }: DashboardClientProps) {
  const router = useRouter()
  const [animatedCredit, setAnimatedCredit] = useState(0)
  
  useEffect(() => {
    // Animate credit value on load
    const timer = setTimeout(() => {
      setAnimatedCredit(customer?.availableCredit || 0)
    }, 500)
    return () => clearTimeout(timer)
  }, [customer?.availableCredit])

  // Verificação automática de boletos pendentes ao carregar o dashboard
  useEffect(() => {
    const checkPendingBoletos = async () => {
      try {
        const response = await fetch(`/api/customers/${customer?.id}/check-boletos`, {
          method: 'POST',
        });

        if (response.ok) {
          const data = await response.json();
          
          if (data.boletosPagos > 0) {
            // Recarrega a página para atualizar o saldo
            window.location.reload();
          }
        }
      } catch (error) {
        console.error('Erro ao verificar boletos:', error);
        // Não mostra erro para o usuário, é uma verificação silenciosa
      }
    };

    const checkOverdueStatus = async () => {
      try {
        const response = await fetch('/api/customers/notifications/check-overdue', {
          method: 'POST',
        });

        if (response.ok) {
          const data = await response.json();
          
          if (data.hasOverdue && data.notificationCreated) {
            console.log(`⚠️ Você possui ${data.overdueBoletos} boleto(s) em atraso`);
            // Não recarrega a página, mas a notificação será exibida no sino
          }
        }
      } catch (error) {
        console.error('Erro ao verificar status de atraso:', error);
        // Não mostra erro para o usuário, é uma verificação silenciosa
      }
    };

    if (customer?.id) {
      // Verifica após 2 segundos do carregamento
      const timer = setTimeout(() => {
        checkPendingBoletos();
        checkOverdueStatus();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [customer?.id])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) {
        return 'Data inválida'
      }
      return date.toLocaleDateString('pt-BR')
    } catch {
      return 'Data inválida'
    }
  }

  const getOrderStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      CONFIRMED: 'bg-blue-100 text-blue-800',
      PREPARING: 'bg-orange-100 text-orange-800',
      READY: 'bg-green-100 text-green-800',
      DELIVERING: 'bg-purple-100 text-purple-800',
      DELIVERED: 'bg-emerald-100 text-emerald-800',
      CANCELLED: 'bg-red-100 text-red-800'
    }
    return statusColors[status] || 'bg-gray-100 text-gray-800'
  }

  const getOrderStatusText = (status: string) => {
    const statusText: Record<string, string> = {
      PENDING: 'Pendente',
      CONFIRMED: 'Confirmado',
      PREPARING: 'Preparando',
      READY: 'Pronto',
      DELIVERING: 'Entregando',
      DELIVERED: 'Entregue',
      CANCELLED: 'Cancelado'
    }
    return statusText[status] || status
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-amber-50">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto max-w-7xl flex h-16 items-center justify-between px-4">
          <Link href="/dashboard" className="flex items-center space-x-3">
            <div className="relative w-12 h-12 rounded-lg overflow-hidden">
              <Image 
                src="/logo.jpg" 
                alt="[SUA EMPRESA]" 
                fill 
                className="object-contain"
                priority
              />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">[SUA EMPRESA]</h1>
              <p className="text-xs text-gray-600">Dashboard Cliente</p>
            </div>
          </Link>
          
          <div className="flex items-center space-x-4">
            <div className="hidden md:block text-right">
              <p className="text-sm font-medium text-gray-900">Olá, {userName}</p>
              <p className="text-xs text-gray-600">{customer?.name}</p>
            </div>
            
            <Link href="/dashboard/notifications">
              <Button variant="ghost" size="sm" className="relative">
                <Bell className="w-5 h-5" />
                {notifications?.filter(n => !n.isRead).length > 0 && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></div>
                )}
              </Button>
            </Link>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => signOut({ callbackUrl: '/' })}
              className="flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto max-w-7xl px-4 py-8">
        {/* Welcome Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Bem-vindo, {customer?.name}!
          </h1>
          <p className="text-lg text-gray-600">
            Gerencie seus pedidos e aproveite nossos preços especiais
          </p>
        </motion.div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="relative overflow-hidden hover:shadow-lg transition-shadow">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-emerald-500/10"></div>
              <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Crédito Disponível
                </CardTitle>
                <CreditCard className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent className="relative">
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(animatedCredit)}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Limite: {formatCurrency(customer?.creditLimit || 0)}
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="relative overflow-hidden hover:shadow-lg transition-shadow">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10"></div>
              <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Prazo de Pagamento
                </CardTitle>
                <Calendar className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent className="relative">
                <div className="text-2xl font-bold text-blue-600">
                  {customer?.paymentTerms || 0}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Dias para pagamento
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="relative overflow-hidden hover:shadow-lg transition-shadow">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-yellow-500/10"></div>
              <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Pedidos Recentes
                </CardTitle>
                <Package className="h-4 w-4 text-amber-600" />
              </CardHeader>
              <CardContent className="relative">
                <div className="text-2xl font-bold text-amber-600">
                  {customer?.Order?.length || 0}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Últimos 5 pedidos
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="relative overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
              onClick={() => redirectToInvestmentApp()}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-green-500/10 group-hover:from-emerald-500/20 group-hover:to-green-500/20 transition-all duration-300"></div>
              <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  💰 Investimentos
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent className="relative">
                <div className="text-2xl font-bold text-emerald-600">
                  Investir
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Multiplique seu capital
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-8"
        >
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-red-600" />
                Ações Rápidas
              </CardTitle>
              <CardDescription>
                Acesse rapidamente as funcionalidades principais
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <Link href="/dashboard/catalog">
                  <Button className="w-full h-16 bg-red-600 hover:bg-red-700 flex flex-col items-center justify-center gap-2">
                    <Package className="w-6 h-6" />
                    Fazer Pedido
                  </Button>
                </Link>
                
                <Link href="/dashboard/orders">
                  <Button variant="outline" className="w-full h-16 flex flex-col items-center justify-center gap-2 border-orange-200 hover:bg-orange-50">
                    <History className="w-6 h-6 text-orange-600" />
                    Meus Pedidos
                  </Button>
                </Link>
                
                <Link href="/dashboard/notifications">
                  <Button variant="outline" className="w-full h-16 flex flex-col items-center justify-center gap-2 border-blue-200 hover:bg-blue-50">
                    <Bell className="w-6 h-6 text-blue-600" />
                    Notificações
                  </Button>
                </Link>
                
                <Link href="/dashboard/rewards">
                  <Button variant="outline" className="w-full h-16 flex flex-col items-center justify-center gap-2 border-yellow-200 hover:bg-yellow-50">
                    <Gift className="w-6 h-6 text-yellow-600" />
                    Meus Pontos
                  </Button>
                </Link>
                
                <Link href="/dashboard/indicacoes">
                  <Button variant="outline" className="w-full h-16 flex flex-col items-center justify-center gap-2 border-purple-200 hover:bg-purple-50">
                    <Users className="w-6 h-6 text-purple-600" />
                    Indicações
                  </Button>
                </Link>
                
                <Link href="/dashboard/boletos">
                  <Button variant="outline" className="w-full h-16 flex flex-col items-center justify-center gap-2 border-green-200 hover:bg-green-50">
                    <DollarSign className="w-6 h-6 text-green-600" />
                    Financeiro
                  </Button>
                </Link>
                
                <Link href="/customer/gestao">
                  <Button variant="outline" className="w-full h-16 flex flex-col items-center justify-center gap-2 border-purple-200 hover:bg-purple-50">
                    <BarChart3 className="w-6 h-6 text-purple-600" />
                    Meu Negócio
                  </Button>
                </Link>
                
                <Link href="/dashboard/retail-customers">
                  <Button variant="outline" className="w-full h-16 flex flex-col items-center justify-center gap-2 border-orange-200 hover:bg-orange-50">
                    <Users className="w-6 h-6 text-orange-600" />
                    Clientes Finais
                  </Button>
                </Link>
                
                <Button 
                  variant="outline" 
                  className="w-full h-16 flex flex-col items-center justify-center gap-2 border-emerald-200 hover:bg-emerald-50 bg-gradient-to-br from-green-50 to-emerald-50"
                  onClick={() => redirectToInvestmentApp()}
                >
                  <TrendingUp className="w-6 h-6 text-emerald-600" />
                  💰 Investir
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Orders */}
        {customer?.Order && customer.Order.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-600" />
                  Pedidos Recentes
                </CardTitle>
                <CardDescription>
                  Seus últimos pedidos realizados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {customer.Order.map((order: any) => (
                    <div key={order.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div>
                        <p className="font-medium text-gray-900">#{order.orderNumber}</p>
                        <p className="text-sm text-gray-600">
                          {formatDate(order.createdAt)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-gray-600">
                          {order.orderItems?.length || 0} itens
                        </p>
                        <p className="font-medium text-gray-900">
                          {formatCurrency(order.total)}
                        </p>
                      </div>
                      <Badge className={getOrderStatusColor(order.status)}>
                        {getOrderStatusText(order.status)}
                      </Badge>
                    </div>
                  ))}
                </div>
                
                <div className="mt-6 text-center">
                  <Link href="/dashboard/orders">
                    <Button variant="outline">
                      Ver Todos os Pedidos
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </main>
    </div>
  )
}
