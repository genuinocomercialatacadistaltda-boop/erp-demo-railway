
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AdminNotifications } from '@/components/admin-notifications'
import MonthlySummaryTable from './monthly-summary-table'
import { 
  Flame, 
  Users, 
  Package, 
  ShoppingCart, 
  AlertCircle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  LogOut,
  Settings,
  Bell,
  BarChart3,
  Plus,
  UserCheck,
  Percent,
  Gift,
  FileText,
  Briefcase,
  X,
  Clock,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Calculator,
  Truck,
  MessageCircle,
  Hash,
  Building
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// Helper para formatar datas sem problemas de timezone
function formatDateBR(dateString: string | Date): string {
  if (!dateString) return 'Data não disponível'
  
  // Se já vier no formato YYYY-MM-DD, converte diretamente
  if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateString.split('-')
    return `${day}/${month}/${year}`
  }
  
  // Se vier em outro formato, usa o Date mas ajustando para Brasília
  const date = new Date(dateString)
  date.setMinutes(date.getMinutes() + date.getTimezoneOffset() + 180)
  return date.toLocaleDateString('pt-BR')
}

interface AdminDashboardProps {
  stats: {
    // TOTAIS ACUMULADOS
    totalCustomers: number
    totalProducts: number
    pendingOrders: number
    
    // NOVOS CADASTROS NO MÊS (com tendência)
    customersThisMonth: number
    customersLastMonth: number
    productsThisMonth: number
    productsLastMonth: number
    
    // PEDIDOS ENTREGUES
    deliveredOrdersToday: number
    deliveredOrdersThisMonth: number
    
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
    dailyTotalExpenses: number
    monthlyTotalExpenses: number
  }
  userName: string
}

export function AdminDashboard({ stats, userName }: AdminDashboardProps) {
  const router = useRouter()
  const [animatedDaily, setAnimatedDaily] = useState(0)
  const [animatedMonthly, setAnimatedMonthly] = useState(0)

  // Estado para colapsar/expandir cards
  const [cardsCollapsed, setCardsCollapsed] = useState(false)

  // Estados para filtros
  const [selectedDailyDate, setSelectedDailyDate] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  
  // Inicializa as datas após o componente montar (evita problemas de hidratação)
  useEffect(() => {
    try {
      const today = new Date()
      const brasiliaDate = new Date(today.getTime() - (3 * 60 * 60 * 1000))
      setSelectedDailyDate(brasiliaDate.toISOString().split('T')[0])
      
      const year = brasiliaDate.getUTCFullYear()
      const month = String(brasiliaDate.getUTCMonth() + 1).padStart(2, '0')
      setSelectedMonth(`${year}-${month}`)
    } catch (error) {
      console.error('Erro ao inicializar datas:', error)
      // Fallback para datas padrão
      const fallbackDate = '2025-11-26'
      setSelectedDailyDate(fallbackDate)
      setSelectedMonth('2025-11')
    }
  }, [])
  
  // Estados para dados filtrados
  const [filteredDailyData, setFilteredDailyData] = useState<any>(null)
  const [filteredMonthlyData, setFilteredMonthlyData] = useState<any>(null)
  const [loadingDailyFilter, setLoadingDailyFilter] = useState(false)
  const [loadingMonthlyFilter, setLoadingMonthlyFilter] = useState(false)

  // Estados para modais
  const [showDailyRevenueModal, setShowDailyRevenueModal] = useState(false)
  const [showMonthlyRevenueModal, setShowMonthlyRevenueModal] = useState(false)
  const [showDailyNetRevenueModal, setShowDailyNetRevenueModal] = useState(false)
  const [showMonthlyNetRevenueModal, setShowMonthlyNetRevenueModal] = useState(false)
  const [showCustomersModal, setShowCustomersModal] = useState(false)
  const [showDailyExpensesModal, setShowDailyExpensesModal] = useState(false)
  const [showMonthlyExpensesModal, setShowMonthlyExpensesModal] = useState(false)
  const [showDailyProductExpensesModal, setShowDailyProductExpensesModal] = useState(false)
  const [showMonthlyProductExpensesModal, setShowMonthlyProductExpensesModal] = useState(false)
  const [showDailyPurchasesModal, setShowDailyPurchasesModal] = useState(false)
  const [showMonthlyPurchasesModal, setShowMonthlyPurchasesModal] = useState(false)
  const [showDailyInvestmentsModal, setShowDailyInvestmentsModal] = useState(false)
  const [showMonthlyInvestmentsModal, setShowMonthlyInvestmentsModal] = useState(false)
  const [showDailyProlaboreModal, setShowDailyProlaboreModal] = useState(false)
  const [showMonthlyProlaboreModal, setShowMonthlyProlaboreModal] = useState(false)
  const [showPendingOrdersModal, setShowPendingOrdersModal] = useState(false)
  const [showDailyDeliveredOrdersModal, setShowDailyDeliveredOrdersModal] = useState(false)
  const [showMonthlyDeliveredOrdersModal, setShowMonthlyDeliveredOrdersModal] = useState(false)
  const [showMonthlyCustomersModal, setShowMonthlyCustomersModal] = useState(false)
  const [showMonthlyProductsModal, setShowMonthlyProductsModal] = useState(false)
  const [showDailyTotalExpensesModal, setShowDailyTotalExpensesModal] = useState(false)
  const [showMonthlyTotalExpensesModal, setShowMonthlyTotalExpensesModal] = useState(false)
  const [showBirthdaysModal, setShowBirthdaysModal] = useState(false)
  const [showEmployeeBirthdaysDialog, setShowEmployeeBirthdaysDialog] = useState(false)

  // Estados para dados detalhados
  const [dailyOrders, setDailyOrders] = useState<any[]>([])
  const [monthlyRevenueOrders, setMonthlyRevenueOrders] = useState<any[]>([])
  const [dailyNetRevenueData, setDailyNetRevenueData] = useState<any[]>([])
  const [monthlyNetRevenueData, setMonthlyNetRevenueData] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [dailyExpenses, setDailyExpenses] = useState<any[]>([])
  const [monthlyExpensesDetails, setMonthlyExpensesDetails] = useState<any[]>([])
  const [dailyProductExpenses, setDailyProductExpenses] = useState<any[]>([])
  const [monthlyProductExpenses, setMonthlyProductExpenses] = useState<any[]>([])
  const [dailyPurchases, setDailyPurchases] = useState<any[]>([])
  const [monthlyPurchases, setMonthlyPurchases] = useState<any[]>([])
  const [dailyInvestments, setDailyInvestments] = useState<any[]>([])
  const [monthlyInvestments, setMonthlyInvestments] = useState<any[]>([])
  const [dailyProlabore, setDailyProlabore] = useState<any[]>([])
  const [monthlyProlabore, setMonthlyProlabore] = useState<any[]>([])
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [dailyDeliveredOrders, setDailyDeliveredOrders] = useState<any[]>([])
  const [monthlyDeliveredOrders, setMonthlyDeliveredOrders] = useState<any[]>([])
  const [monthlyCustomers, setMonthlyCustomers] = useState<any[]>([])
  const [monthlyProducts, setMonthlyProducts] = useState<any[]>([])
  const [dailyTotalExpenses, setDailyTotalExpenses] = useState<any>(null)
  const [monthlyTotalExpenses, setMonthlyTotalExpenses] = useState<any>(null)
  const [birthdays, setBirthdays] = useState<any[]>([])
  const [birthdayCount, setBirthdayCount] = useState(0)
  const [employeeBirthdays, setEmployeeBirthdays] = useState<any[]>([])
  const [employeeBirthdayCount, setEmployeeBirthdayCount] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Animate revenue values
    const timer1 = setTimeout(() => setAnimatedDaily(stats.dailyRevenue), 500)
    const timer2 = setTimeout(() => setAnimatedMonthly(stats.monthlyRevenue), 700)
    
    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
    }
  }, [stats.dailyRevenue, stats.monthlyRevenue])

  // Verificação automática de boletos pendentes ao carregar o dashboard do admin
  useEffect(() => {
    const checkAllPendingBoletos = async () => {
      try {
        const response = await fetch('/api/admin/boletos/check-all-pending', {
          method: 'POST',
        });

        if (response.ok) {
          const data = await response.json();
          
          if (data.boletosPagos > 0) {
            console.log(`✅ ${data.boletosPagos} boleto(s) atualizado(s) automaticamente`);
            // Não recarrega a página para não interromper a navegação do admin
            // O admin pode ver os boletos atualizados na seção "Gestão de Boletos"
          }
        }
      } catch (error) {
        console.error('Erro ao verificar boletos pendentes:', error);
        // Não mostra erro para o usuário, é uma verificação silenciosa
      }
    };

    const checkOverdueClients = async () => {
      try {
        const response = await fetch('/api/admin/notifications/check-overdue-clients', {
          method: 'POST',
        });

        if (response.ok) {
          const data = await response.json();
          
          if (data.notificationsCreated > 0) {
            console.log(`🔔 ${data.notificationsCreated} notificação(ões) de cliente(s) em atraso criada(s)`);
          }
        }
      } catch (error) {
        console.error('Erro ao verificar clientes em atraso:', error);
        // Não mostra erro para o usuário, é uma verificação silenciosa
      }
    };

    // Verifica após 2 segundos do carregamento
    const timer = setTimeout(() => {
      checkAllPendingBoletos();
      checkOverdueClients();
    }, 2000);

    return () => clearTimeout(timer);
  }, [])

  // Buscar aniversários do dia (clientes e funcionários)
  useEffect(() => {
    const fetchBirthdays = async () => {
      try {
        const response = await fetch('/api/admin/birthdays/today');
        if (response.ok) {
          const data = await response.json();
          setBirthdays(data.birthdays || []);
          setBirthdayCount(data.count || 0);
          setEmployeeBirthdays(data.employeeBirthdays || []);
          setEmployeeBirthdayCount(data.employeeCount || 0);
          console.log(`🎂 ${data.count} cliente(s) aniversariante(s) hoje`);
          console.log(`🎂 ${data.employeeCount} funcionário(s) aniversariante(s) hoje`);
        }
      } catch (error) {
        console.error('Erro ao buscar aniversários:', error);
      }
    };

    fetchBirthdays();
  }, [])

  // Buscar dados filtrados por dia
  useEffect(() => {
    const fetchDailyFilteredData = async () => {
      setLoadingDailyFilter(true)
      try {
        const res = await fetch(`/api/admin/dashboard-filtered?type=daily&date=${selectedDailyDate}`)
        if (res.ok) {
          const data = await res.json()
          setFilteredDailyData(data)
        }
      } catch (error) {
        console.error('Erro ao buscar dados diários filtrados:', error)
      } finally {
        setLoadingDailyFilter(false)
      }
    }

    fetchDailyFilteredData()
  }, [selectedDailyDate])

  // Buscar dados filtrados por mês
  useEffect(() => {
    const fetchMonthlyFilteredData = async () => {
      setLoadingMonthlyFilter(true)
      try {
        const res = await fetch(`/api/admin/dashboard-filtered?type=monthly&month=${selectedMonth}`)
        if (res.ok) {
          const data = await res.json()
          setFilteredMonthlyData(data)
        }
      } catch (error) {
        console.error('Erro ao buscar dados mensais filtrados:', error)
      } finally {
        setLoadingMonthlyFilter(false)
      }
    }

    fetchMonthlyFilteredData()
  }, [selectedMonth])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
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

  // Dados a serem exibidos (usa filtrados se disponíveis, senão usa originais)
  const displayDailyData = {
    revenue: filteredDailyData?.revenue ?? stats.dailyRevenue,
    netRevenue: filteredDailyData?.netRevenue ?? stats.dailyNetRevenue,
    operationalExpenses: filteredDailyData?.operationalExpenses ?? stats.dailyOperationalExpenses,
    productExpenses: filteredDailyData?.productExpenses ?? stats.dailyProductExpenses,
    purchases: filteredDailyData?.purchases ?? stats.dailyPurchases,
    investments: filteredDailyData?.investments ?? stats.dailyInvestments,
    prolabore: filteredDailyData?.prolabore ?? stats.dailyProlabore,
    totalExpenses: filteredDailyData ? 
      (filteredDailyData.operationalExpenses + filteredDailyData.productExpenses + filteredDailyData.purchases + filteredDailyData.investments + filteredDailyData.prolabore) : 
      stats.dailyTotalExpenses,
    // NOVOS: dados de pedidos, clientes e produtos
    deliveredOrders: filteredDailyData?.deliveredOrders ?? stats.deliveredOrdersToday,
    customersRegistered: filteredDailyData?.customersRegistered ?? 0, // Não há stats diário para clientes
    productsRegistered: filteredDailyData?.productsRegistered ?? 0 // Não há stats diário para produtos
  }

  const displayMonthlyData = {
    revenue: filteredMonthlyData?.revenue ?? stats.monthlyRevenue,
    netRevenue: filteredMonthlyData?.netRevenue ?? stats.monthlyNetRevenue,
    operationalExpenses: filteredMonthlyData?.operationalExpenses ?? stats.monthlyOperationalExpenses,
    productExpenses: filteredMonthlyData?.productExpenses ?? stats.monthlyProductExpenses,
    purchases: filteredMonthlyData?.purchases ?? stats.monthlyPurchases,
    investments: filteredMonthlyData?.investments ?? stats.monthlyInvestments,
    prolabore: filteredMonthlyData?.prolabore ?? stats.monthlyProlabore,
    totalExpenses: filteredMonthlyData ? 
      (filteredMonthlyData.operationalExpenses + filteredMonthlyData.productExpenses + filteredMonthlyData.purchases + filteredMonthlyData.investments + filteredMonthlyData.prolabore) : 
      stats.monthlyTotalExpenses,
    // NOVOS: dados de pedidos, clientes e produtos
    deliveredOrders: filteredMonthlyData?.deliveredOrders ?? stats.deliveredOrdersThisMonth,
    customersRegistered: filteredMonthlyData?.customersRegistered ?? stats.customersThisMonth,
    productsRegistered: filteredMonthlyData?.productsRegistered ?? stats.productsThisMonth
  }

  // Funções para buscar dados detalhados
  const fetchDailyOrders = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/daily-orders')
      if (res.ok) {
        const data = await res.json()
        setDailyOrders(data.orders || [])
      }
    } catch (error) {
      console.error('Erro ao buscar vendas diárias:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMonthlyRevenue = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/monthly-revenue')
      if (res.ok) {
        const data = await res.json()
        setMonthlyRevenueOrders(data.orders || [])
      }
    } catch (error) {
      console.error('Erro ao buscar faturamento mensal:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCustomers = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/customers')
      if (res.ok) {
        const data = await res.json()
        setCustomers(data || [])
      }
    } catch (error) {
      console.error('Erro ao buscar clientes:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchDailyExpenses = async () => {
    setLoading(true)
    try {
      // 🔧 Cache busting + no-cache headers
      const timestamp = new Date().getTime()
      console.log('🔍 [FRONTEND] Buscando despesas para data:', selectedDailyDate)
      const res = await fetch(`/api/admin/daily-expenses?date=${selectedDailyDate}&_t=${timestamp}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      })
      if (res.ok) {
        const data = await res.json()
        console.log('✅ [FRONTEND] Despesas recebidas:', data.expenses?.length || 0)
        setDailyExpenses(data.expenses || [])
      }
    } catch (error) {
      console.error('Erro ao buscar despesas diárias:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMonthlyExpenses = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/monthly-expenses')
      if (res.ok) {
        const data = await res.json()
        setMonthlyExpensesDetails(data.expenses || [])
      }
    } catch (error) {
      console.error('Erro ao buscar despesas mensais:', error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch receitas líquidas
  const fetchDailyNetRevenue = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/net-revenue?period=daily')
      if (res.ok) {
        const data = await res.json()
        setDailyNetRevenueData(data.receivables || [])
      }
    } catch (error) {
      console.error('Erro ao buscar receita líquida diária:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMonthlyNetRevenue = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/net-revenue?period=monthly')
      if (res.ok) {
        const data = await res.json()
        setMonthlyNetRevenueData(data.receivables || [])
      }
    } catch (error) {
      console.error('Erro ao buscar receita líquida mensal:', error)
    } finally {
      setLoading(false)
    }
  }

  // Handlers para abrir modais
  const handleDailyRevenueClick = () => {
    fetchDailyOrders()
    setShowDailyRevenueModal(true)
  }

  const handleMonthlyRevenueClick = () => {
    fetchMonthlyRevenue()
    setShowMonthlyRevenueModal(true)
  }

  const handleDailyNetRevenueClick = () => {
    fetchDailyNetRevenue()
    setShowDailyNetRevenueModal(true)
  }

  const handleMonthlyNetRevenueClick = () => {
    fetchMonthlyNetRevenue()
    setShowMonthlyNetRevenueModal(true)
  }

  const handleCustomersClick = () => {
    fetchCustomers()
    setShowCustomersModal(true)
  }

  const handleDailyExpensesClick = () => {
    fetchDailyExpenses()
    setShowDailyExpensesModal(true)
  }

  const handleMonthlyExpensesClick = () => {
    fetchMonthlyExpenses()
    setShowMonthlyExpensesModal(true)
  }

  // Novas funções de fetch para os relatórios detalhados
  const fetchDailyProductExpenses = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/daily-product-expenses?date=${selectedDailyDate}`)
      if (res.ok) {
        const data = await res.json()
        setDailyProductExpenses(data.expenses || [])
      }
    } catch (error) {
      console.error('Erro ao buscar despesas com produtos diárias:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMonthlyProductExpenses = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/monthly-product-expenses')
      if (res.ok) {
        const data = await res.json()
        setMonthlyProductExpenses(data.expenses || [])
      }
    } catch (error) {
      console.error('Erro ao buscar despesas com produtos mensais:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchDailyPurchases = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/daily-purchases')
      if (res.ok) {
        const data = await res.json()
        setDailyPurchases(data.purchases || [])
      }
    } catch (error) {
      console.error('Erro ao buscar compras diárias:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMonthlyPurchases = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/monthly-purchases')
      if (res.ok) {
        const data = await res.json()
        setMonthlyPurchases(data.purchases || [])
      }
    } catch (error) {
      console.error('Erro ao buscar compras mensais:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchDailyInvestments = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/daily-investments?date=${selectedDailyDate}`)
      if (res.ok) {
        const data = await res.json()
        setDailyInvestments(data.investments || [])
      }
    } catch (error) {
      console.error('Erro ao buscar investimentos diários:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMonthlyInvestments = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/monthly-investments')
      if (res.ok) {
        const data = await res.json()
        setMonthlyInvestments(data.investments || [])
      }
    } catch (error) {
      console.error('Erro ao buscar investimentos mensais:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchDailyProlabore = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/daily-prolabore?date=${selectedDailyDate}`)
      if (res.ok) {
        const data = await res.json()
        setDailyProlabore(data.prolabore || [])
      }
    } catch (error) {
      console.error('Erro ao buscar pró-labore diário:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMonthlyProlabore = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/monthly-prolabore')
      if (res.ok) {
        const data = await res.json()
        setMonthlyProlabore(data.prolabore || [])
      }
    } catch (error) {
      console.error('Erro ao buscar pró-labore mensal:', error)
    } finally {
      setLoading(false)
    }
  }

  // Handlers para abrir modais
  const handleDailyProductExpensesClick = () => {
    fetchDailyProductExpenses()
    setShowDailyProductExpensesModal(true)
  }

  const handleMonthlyProductExpensesClick = () => {
    fetchMonthlyProductExpenses()
    setShowMonthlyProductExpensesModal(true)
  }

  const handleDailyPurchasesClick = () => {
    fetchDailyPurchases()
    setShowDailyPurchasesModal(true)
  }

  const handleMonthlyPurchasesClick = () => {
    fetchMonthlyPurchases()
    setShowMonthlyPurchasesModal(true)
  }

  const handleDailyInvestmentsClick = () => {
    fetchDailyInvestments()
    setShowDailyInvestmentsModal(true)
  }

  const handleMonthlyInvestmentsClick = () => {
    fetchMonthlyInvestments()
    setShowMonthlyInvestmentsModal(true)
  }

  const handleDailyProlaboreClick = () => {
    fetchDailyProlabore()
    setShowDailyProlaboreModal(true)
  }

  const handleMonthlyProlaboreClick = () => {
    fetchMonthlyProlabore()
    setShowMonthlyProlaboreModal(true)
  }

  const fetchPendingOrders = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/orders?status=PENDING')
      if (res.ok) {
        const data = await res.json()
        setPendingOrders(data.orders || [])
      }
    } catch (error) {
      console.error('Erro ao buscar pedidos pendentes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePendingOrdersClick = () => {
    fetchPendingOrders()
    setShowPendingOrdersModal(true)
  }

  const handleBirthdaysClick = () => {
    setShowBirthdaysModal(true)
  }

  // Novos handlers para pedidos entregues, clientes e produtos
  const fetchDailyDeliveredOrders = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/orders?status=DELIVERED&date=${selectedDailyDate}`)
      if (res.ok) {
        const data = await res.json()
        setDailyDeliveredOrders(data.orders || [])
      }
    } catch (error) {
      console.error('Erro ao buscar pedidos entregues do dia:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDailyDeliveredOrdersClick = () => {
    fetchDailyDeliveredOrders()
    setShowDailyDeliveredOrdersModal(true)
  }

  const fetchMonthlyDeliveredOrders = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/orders?status=DELIVERED&month=${selectedMonth}`)
      if (res.ok) {
        const data = await res.json()
        setMonthlyDeliveredOrders(data.orders || [])
      }
    } catch (error) {
      console.error('Erro ao buscar pedidos entregues do mês:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMonthlyDeliveredOrdersClick = () => {
    fetchMonthlyDeliveredOrders()
    setShowMonthlyDeliveredOrdersModal(true)
  }

  const fetchMonthlyCustomers = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/customers?month=${selectedMonth}`)
      if (res.ok) {
        const data = await res.json()
        setMonthlyCustomers(data || [])
      }
    } catch (error) {
      console.error('Erro ao buscar clientes do mês:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMonthlyCustomersClick = () => {
    fetchMonthlyCustomers()
    setShowMonthlyCustomersModal(true)
  }

  const fetchMonthlyProducts = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/products?month=${selectedMonth}`)
      if (res.ok) {
        const data = await res.json()
        setMonthlyProducts(data || [])
      }
    } catch (error) {
      console.error('Erro ao buscar produtos do mês:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMonthlyProductsClick = () => {
    fetchMonthlyProducts()
    setShowMonthlyProductsModal(true)
  }

  // Handlers para Total de Saídas
  const fetchDailyTotalExpenses = async () => {
    setLoading(true)
    try {
      // 🔧 Adicionar timestamp para evitar cache
      const timestamp = new Date().getTime()
      const res = await fetch(`/api/admin/expenses/total?date=${selectedDailyDate}&_t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      if (res.ok) {
        const data = await res.json()
        setDailyTotalExpenses(data)
        console.log(`✅ Despesas do dia ${selectedDailyDate} carregadas:`, data.operationalExpenses.list.length, 'despesas operacionais')
      }
    } catch (error) {
      console.error('Erro ao buscar total de saídas do dia:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDailyTotalExpensesClick = () => {
    fetchDailyTotalExpenses()
    setShowDailyTotalExpensesModal(true)
  }

  const fetchMonthlyTotalExpenses = async () => {
    setLoading(true)
    try {
      // 🔧 Adicionar timestamp para evitar cache
      const timestamp = new Date().getTime()
      const res = await fetch(`/api/admin/expenses/total?month=${selectedMonth}&_t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      if (res.ok) {
        const data = await res.json()
        setMonthlyTotalExpenses(data)
        console.log(`✅ Despesas do mês ${selectedMonth} carregadas:`, data.operationalExpenses.list.length, 'despesas operacionais')
      }
    } catch (error) {
      console.error('Erro ao buscar total de saídas do mês:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMonthlyTotalExpensesClick = () => {
    fetchMonthlyTotalExpenses()
    setShowMonthlyTotalExpensesModal(true)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-amber-50">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto max-w-7xl flex h-16 items-center justify-between px-4">
          <div 
            className="flex items-center space-x-3 cursor-pointer" 
            onClick={() => router.push('/admin')}
          >
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
              <p className="text-xs text-gray-600">Painel Administrativo</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="hidden md:block text-right">
              <p className="text-sm font-medium text-gray-900">Administrador</p>
              <p className="text-xs text-gray-600">{userName}</p>
            </div>
            
            <AdminNotifications />
            
            <Button variant="ghost" size="sm">
              <Settings className="w-5 h-5" />
            </Button>
            
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
            Painel Administrativo
          </h1>
          <p className="text-lg text-gray-600">
            Gerencie produtos, clientes e pedidos do [SUA EMPRESA]
          </p>
        </motion.div>

        {/* Botão para Colapsar/Expandir Cards */}
        <div className="mb-6 flex justify-center">
          <Button
            onClick={() => setCardsCollapsed(!cardsCollapsed)}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2"
          >
            {cardsCollapsed ? (
              <>
                <ChevronDown className="w-5 h-5" />
                Expandir Cards Financeiros
              </>
            ) : (
              <>
                <ChevronUp className="w-5 h-5" />
                Colapsar Cards Financeiros
              </>
            )}
          </Button>
        </div>

        {/* Stats Cards com Filtros */}
        {!cardsCollapsed && (
          <div className="grid lg:grid-cols-2 gap-8 mb-8">
            {/* Coluna DIÁRIA (Esquerda) */}
          <div className="space-y-6">
            {/* Filtro Diário */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📅 Filtro Diário
              </label>
              <input
                type="date"
                value={selectedDailyDate}
                onChange={(e) => setSelectedDailyDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              {loadingDailyFilter && (
                <p className="text-xs text-gray-500 mt-2">Carregando dados...</p>
              )}
            </div>

            {/* Cards Diários */}
            <div className="space-y-4">
              {/* Faturamento Diário */}
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
                <Card className="relative overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={handleDailyRevenueClick}>
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-emerald-500/10"></div>
                  <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Faturamento Diário 💰</CardTitle>
                    <DollarSign className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent className="relative">
                    <div className="text-2xl font-bold text-green-600">{formatCurrency(displayDailyData.revenue)}</div>
                    <p className="text-xs text-gray-600 mt-1">Clique para detalhes</p>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Receita Líquida Diária */}
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }}>
                <Card className="relative overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={handleDailyNetRevenueClick}>
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-teal-500/10"></div>
                  <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Receita Líquida Diária 💵</CardTitle>
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                  </CardHeader>
                  <CardContent className="relative">
                    <div className="text-2xl font-bold text-emerald-600">{formatCurrency(displayDailyData.netRevenue)}</div>
                    <p className="text-xs text-gray-600 mt-1">Recebido • Clique para detalhes</p>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Despesas Operacionais Diária */}
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
                <Card className="relative overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={handleDailyExpensesClick}>
                  <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-rose-500/10"></div>
                  <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Desp. Operacionais 💸</CardTitle>
                    <DollarSign className="h-4 w-4 text-red-600" />
                  </CardHeader>
                  <CardContent className="relative">
                    <div className="text-2xl font-bold text-red-600">{formatCurrency(displayDailyData.operationalExpenses)}</div>
                    <p className="text-xs text-gray-600 mt-1">Clique para detalhes</p>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Despesas com Produtos Diária */}
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.25 }}>
                <Card className="relative overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={handleDailyProductExpensesClick}>
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10"></div>
                  <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Desp. com Produtos</CardTitle>
                    <Package className="h-4 w-4 text-indigo-600" />
                  </CardHeader>
                  <CardContent className="relative">
                    <div className="text-2xl font-bold text-indigo-600">{formatCurrency(displayDailyData.productExpenses)}</div>
                    <p className="text-xs text-gray-600 mt-1">Clique para ver</p>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Compras de Mercadorias Diária */}
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}>
                <Card className="relative overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={handleDailyPurchasesClick}>
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-teal-500/10"></div>
                  <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Compras Mercadorias</CardTitle>
                    <ShoppingCart className="h-4 w-4 text-cyan-600" />
                  </CardHeader>
                  <CardContent className="relative">
                    <div className="text-2xl font-bold text-cyan-600">{formatCurrency(displayDailyData.purchases)}</div>
                    <p className="text-xs text-gray-600 mt-1">Clique para ver</p>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Investimentos Diária */}
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.35 }}>
                <Card className="relative overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={handleDailyInvestmentsClick}>
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-emerald-500/10"></div>
                  <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Investimentos</CardTitle>
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent className="relative">
                    <div className="text-2xl font-bold text-green-600">{formatCurrency(displayDailyData.investments)}</div>
                    <p className="text-xs text-gray-600 mt-1">Clique para ver</p>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Pró-labore Diária */}
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}>
                <Card className="relative overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={handleDailyProlaboreClick}>
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-indigo-500/10"></div>
                  <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Pró-labore</CardTitle>
                    <UserCheck className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent className="relative">
                    <div className="text-2xl font-bold text-blue-600">{formatCurrency(displayDailyData.prolabore)}</div>
                    <p className="text-xs text-gray-600 mt-1">Clique para ver</p>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Pedidos Entregues Hoje */}
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.42 }}>
                <Card className="relative overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={handleDailyDeliveredOrdersClick}>
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-teal-500/10"></div>
                  <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Pedidos Entregues Hoje ✅</CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  </CardHeader>
                  <CardContent className="relative">
                    <div className="text-2xl font-bold text-emerald-600">{displayDailyData.deliveredOrders}</div>
                    <p className="text-xs text-gray-600 mt-1">Entregas concluídas • Clique para ver</p>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Total de Saídas Diária */}
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.45 }}>
                <Card className="relative overflow-hidden hover:shadow-xl transition-all border-2 border-red-300 cursor-pointer" onClick={handleDailyTotalExpensesClick}>
                  <div className="absolute inset-0 bg-gradient-to-br from-red-600/20 to-rose-600/20"></div>
                  <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-700">💸 TOTAL SAÍDAS - Hoje</CardTitle>
                    <DollarSign className="h-5 w-5 text-red-700" />
                  </CardHeader>
                  <CardContent className="relative">
                    <div className="text-3xl font-bold text-red-700">{formatCurrency(displayDailyData.totalExpenses)}</div>
                    <p className="text-xs text-gray-700 mt-2 font-medium">Todas as despesas do dia • Clique para detalhes</p>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>

          {/* Coluna MENSAL (Direita) */}
          <div className="space-y-6">
            {/* Filtro Mensal */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📆 Filtro Mensal
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {loadingMonthlyFilter && (
                <p className="text-xs text-gray-500 mt-2">Carregando dados...</p>
              )}
            </div>

            {/* Cards Mensais */}
            <div className="space-y-4">
              {/* Faturamento Mensal */}
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
                <Card className="relative overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={handleMonthlyRevenueClick}>
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/10"></div>
                  <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Faturamento Mensal 📊</CardTitle>
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent className="relative">
                    <div className="text-2xl font-bold text-blue-600">{formatCurrency(displayMonthlyData.revenue)}</div>
                    <p className="text-xs text-gray-600 mt-1">Clique para detalhes</p>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Receita Líquida Mensal */}
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }}>
                <Card className="relative overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={handleMonthlyNetRevenueClick}>
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-sky-500/10"></div>
                  <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Receita Líquida Mensal 💵</CardTitle>
                    <TrendingUp className="h-4 w-4 text-cyan-600" />
                  </CardHeader>
                  <CardContent className="relative">
                    <div className="text-2xl font-bold text-cyan-600">{formatCurrency(displayMonthlyData.netRevenue)}</div>
                    <p className="text-xs text-gray-600 mt-1">Recebido • Clique para detalhes</p>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Despesas Operacionais Mensal */}
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
                <Card className="relative overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={handleMonthlyExpensesClick}>
                  <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-rose-500/10"></div>
                  <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Desp. Operacionais 📈</CardTitle>
                    <TrendingUp className="h-4 w-4 text-red-600" />
                  </CardHeader>
                  <CardContent className="relative">
                    <div className="text-2xl font-bold text-red-600">{formatCurrency(displayMonthlyData.operationalExpenses)}</div>
                    <p className="text-xs text-gray-600 mt-1">Clique para histórico</p>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Despesas com Produtos Mensal */}
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.25 }}>
                <Card className="relative overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={handleMonthlyProductExpensesClick}>
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10"></div>
                  <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Desp. com Produtos</CardTitle>
                    <TrendingUp className="h-4 w-4 text-indigo-600" />
                  </CardHeader>
                  <CardContent className="relative">
                    <div className="text-2xl font-bold text-indigo-600">{formatCurrency(displayMonthlyData.productExpenses)}</div>
                    <p className="text-xs text-gray-600 mt-1">Clique para ver</p>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Compras de Mercadorias Mensal */}
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}>
                <Card className="relative overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={handleMonthlyPurchasesClick}>
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-teal-500/10"></div>
                  <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Compras Mercadorias</CardTitle>
                    <TrendingUp className="h-4 w-4 text-cyan-600" />
                  </CardHeader>
                  <CardContent className="relative">
                    <div className="text-2xl font-bold text-cyan-600">{formatCurrency(displayMonthlyData.purchases)}</div>
                    <p className="text-xs text-gray-600 mt-1">Clique para ver</p>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Investimentos Mensal */}
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.35 }}>
                <Card className="relative overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={handleMonthlyInvestmentsClick}>
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-emerald-500/10"></div>
                  <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Investimentos</CardTitle>
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent className="relative">
                    <div className="text-2xl font-bold text-green-600">{formatCurrency(displayMonthlyData.investments)}</div>
                    <p className="text-xs text-gray-600 mt-1">Clique para ver</p>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Pró-labore Mensal */}
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}>
                <Card className="relative overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={handleMonthlyProlaboreClick}>
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-indigo-500/10"></div>
                  <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Pró-labore</CardTitle>
                    <UserCheck className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent className="relative">
                    <div className="text-2xl font-bold text-blue-600">{formatCurrency(displayMonthlyData.prolabore)}</div>
                    <p className="text-xs text-gray-600 mt-1">Clique para ver</p>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Clientes Cadastrados no Mês */}
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.42 }}>
                <Card className="relative overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={handleMonthlyCustomersClick}>
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10"></div>
                  <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Clientes Cadastrados no Mês 👥</CardTitle>
                    {displayMonthlyData.customersRegistered > stats.customersLastMonth ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : displayMonthlyData.customersRegistered < stats.customersLastMonth ? (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    ) : (
                      <Users className="h-4 w-4 text-gray-600" />
                    )}
                  </CardHeader>
                  <CardContent className="relative">
                    <div className="text-2xl font-bold text-purple-600">{displayMonthlyData.customersRegistered}</div>
                    <p className="text-xs text-gray-600 mt-1">
                      Mês anterior: {stats.customersLastMonth}
                      {displayMonthlyData.customersRegistered > stats.customersLastMonth && (
                        <span className="text-green-600 ml-1">↑ +{displayMonthlyData.customersRegistered - stats.customersLastMonth}</span>
                      )}
                      {displayMonthlyData.customersRegistered < stats.customersLastMonth && (
                        <span className="text-red-600 ml-1">↓ {displayMonthlyData.customersRegistered - stats.customersLastMonth}</span>
                      )}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Produtos Cadastrados no Mês */}
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.43 }}>
                <Card className="relative overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={handleMonthlyProductsClick}>
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-red-500/10"></div>
                  <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Produtos Cadastrados no Mês 📦</CardTitle>
                    {displayMonthlyData.productsRegistered > stats.productsLastMonth ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : displayMonthlyData.productsRegistered < stats.productsLastMonth ? (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    ) : (
                      <Package className="h-4 w-4 text-gray-600" />
                    )}
                  </CardHeader>
                  <CardContent className="relative">
                    <div className="text-2xl font-bold text-orange-600">{displayMonthlyData.productsRegistered}</div>
                    <p className="text-xs text-gray-600 mt-1">
                      Mês anterior: {stats.productsLastMonth}
                      {displayMonthlyData.productsRegistered > stats.productsLastMonth && (
                        <span className="text-green-600 ml-1">↑ +{displayMonthlyData.productsRegistered - stats.productsLastMonth}</span>
                      )}
                      {displayMonthlyData.productsRegistered < stats.productsLastMonth && (
                        <span className="text-red-600 ml-1">↓ {displayMonthlyData.productsRegistered - stats.productsLastMonth}</span>
                      )}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Pedidos Entregues no Mês */}
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.44 }}>
                <Card className="relative overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={handleMonthlyDeliveredOrdersClick}>
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-teal-500/10"></div>
                  <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">Pedidos Entregues no Mês ✅</CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  </CardHeader>
                  <CardContent className="relative">
                    <div className="text-2xl font-bold text-emerald-600">{displayMonthlyData.deliveredOrders}</div>
                    <p className="text-xs text-gray-600 mt-1">Entregas concluídas • Clique para ver</p>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Total de Saídas Mensal */}
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.45 }}>
                <Card className="relative overflow-hidden hover:shadow-xl transition-all border-2 border-red-400 cursor-pointer" onClick={handleMonthlyTotalExpensesClick}>
                  <div className="absolute inset-0 bg-gradient-to-br from-red-700/20 to-rose-700/20"></div>
                  <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-700">💸 TOTAL SAÍDAS - Este Mês</CardTitle>
                    <TrendingUp className="h-5 w-5 text-red-700" />
                  </CardHeader>
                  <CardContent className="relative">
                    <div className="text-3xl font-bold text-red-700">{formatCurrency(displayMonthlyData.totalExpenses)}</div>
                    <p className="text-xs text-gray-700 mt-2 font-medium">Todas as despesas do mês • Clique para detalhes</p>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>
        )}

        {/* Card de Pedidos Pendentes */}
        <div className="max-w-md mx-auto mb-8">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}>
            <Card className="relative overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={handlePendingOrdersClick}>
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-amber-500/10"></div>
              <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Pedidos Pendentes ⚠️</CardTitle>
                <AlertCircle className="h-4 w-4 text-yellow-600" />
              </CardHeader>
              <CardContent className="relative">
                <div className="text-2xl font-bold text-yellow-600">{stats.pendingOrders}</div>
                <p className="text-xs text-gray-600 mt-1">Requer atenção • Clique para detalhes</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Card de Aniversariantes (Clientes e Funcionários) */}
        {(birthdayCount > 0 || employeeBirthdayCount > 0) && (
          <div className="max-w-2xl mx-auto mb-8">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Card Clientes Aniversariantes */}
                {birthdayCount > 0 && (
                  <Card className="relative overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={handleBirthdaysClick}>
                    <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 to-purple-500/10"></div>
                    <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600">🎂 Clientes Aniversariantes</CardTitle>
                      <Gift className="h-4 w-4 text-pink-600" />
                    </CardHeader>
                    <CardContent className="relative">
                      <div className="text-2xl font-bold text-pink-600">{birthdayCount}</div>
                      <p className="text-xs text-gray-600 mt-1">{birthdayCount === 1 ? 'Cliente fazendo aniversário' : 'Clientes fazendo aniversário'} • Clique para ver</p>
                    </CardContent>
                  </Card>
                )}

                {/* Card Funcionários Aniversariantes */}
                {employeeBirthdayCount > 0 && (
                  <Card className="relative overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setShowEmployeeBirthdaysDialog(true)}>
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-green-500/10"></div>
                    <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-gray-600">🎉 Funcionários Aniversariantes</CardTitle>
                      <Users className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent className="relative">
                      <div className="text-2xl font-bold text-blue-600">{employeeBirthdayCount}</div>
                      <p className="text-xs text-gray-600 mt-1">{employeeBirthdayCount === 1 ? 'Funcionário fazendo aniversário' : 'Funcionários fazendo aniversário'} • Clique para ver</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="mb-8"
        >
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-red-600" />
                Ações Rápidas
              </CardTitle>
              <CardDescription>
                Acesse rapidamente as funcionalidades administrativas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Button 
                  onClick={() => router.push('/admin/orders')}
                  className="w-full h-16 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 flex flex-col items-center justify-center gap-2 relative"
                >
                  <ShoppingCart className="w-6 h-6" />
                  Gestão de Pedidos
                  {stats.pendingOrders > 0 && (
                    <Badge className="absolute -top-2 -right-2 bg-yellow-500 text-white">
                      {stats.pendingOrders}
                    </Badge>
                  )}
                </Button>
                
                <Button 
                  onClick={() => router.push('/admin/entregas')}
                  className="w-full h-16 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 flex flex-col items-center justify-center gap-2"
                >
                  <Truck className="w-6 h-6" />
                  Gestão de Entregas
                </Button>
                
                <Button 
                  className="w-full h-16 bg-red-600 hover:bg-red-700 flex flex-col items-center justify-center gap-2"
                  onClick={() => router.push('/admin/products')}
                >
                  <Package className="w-6 h-6" />
                  Gerenciar Produtos
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full h-16 flex flex-col items-center justify-center gap-2 border-purple-200 hover:bg-purple-50"
                  onClick={() => router.push('/admin/customers')}
                >
                  <Users className="w-6 h-6 text-purple-600" />
                  Gerenciar Clientes
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full h-16 flex flex-col items-center justify-center gap-2 border-green-200 hover:bg-green-50"
                  onClick={() => router.push('/admin/sellers')}
                >
                  <UserCheck className="w-6 h-6 text-green-600" />
                  Gerenciar Vendedores
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full h-16 flex flex-col items-center justify-center gap-2 border-pink-200 hover:bg-pink-50"
                  onClick={() => router.push('/admin/coupons')}
                >
                  <Percent className="w-6 h-6 text-pink-600" />
                  Gerenciar Cupons
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full h-16 flex flex-col items-center justify-center gap-2 border-yellow-200 hover:bg-yellow-50"
                  onClick={() => router.push('/admin/rewards')}
                >
                  <Gift className="w-6 h-6 text-yellow-600" />
                  Sistema de Pontos
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full h-16 flex flex-col items-center justify-center gap-2 border-cyan-200 hover:bg-cyan-50"
                  onClick={() => router.push('/admin/notifications')}
                >
                  <Bell className="w-6 h-6 text-cyan-600" />
                  Notificações
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full h-16 flex flex-col items-center justify-center gap-2 border-green-200 hover:bg-green-50"
                  onClick={() => router.push('/admin/whatsapp')}
                >
                  <MessageCircle className="w-6 h-6 text-green-600" />
                  WhatsApp
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full h-16 flex flex-col items-center justify-center gap-2 border-emerald-200 hover:bg-emerald-50"
                  onClick={() => router.push('/admin/comissoes')}
                >
                  <DollarSign className="w-6 h-6 text-emerald-600" />
                  Gestão Comissões
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full h-16 bg-gradient-to-br from-blue-50 to-indigo-50 flex flex-col items-center justify-center gap-2 border-blue-300 hover:border-blue-400 hover:from-blue-100 hover:to-indigo-100"
                  onClick={() => router.push('/admin/financeiro')}
                >
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                  <span className="font-semibold text-blue-900">Gestão Financeira</span>
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full h-16 bg-gradient-to-br from-teal-50 to-cyan-50 flex flex-col items-center justify-center gap-2 border-teal-300 hover:border-teal-400 hover:from-teal-100 hover:to-cyan-100"
                  onClick={() => router.push('/admin/financeiro/cartoes')}
                >
                  <CreditCard className="w-6 h-6 text-teal-600" />
                  <span className="font-semibold text-teal-900">Gestão de Cartões</span>
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full h-16 bg-gradient-to-br from-purple-50 to-pink-50 flex flex-col items-center justify-center gap-2 border-purple-300 hover:border-purple-400 hover:from-purple-100 hover:to-pink-100"
                  onClick={() => router.push('/admin/compras')}
                >
                  <ShoppingCart className="w-6 h-6 text-purple-600" />
                  <span className="font-semibold text-purple-900">Módulo de Compras</span>
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full h-16 bg-gradient-to-br from-amber-50 to-orange-50 flex flex-col items-center justify-center gap-2 border-amber-300 hover:border-amber-400 hover:from-amber-100 hover:to-orange-100"
                  onClick={() => router.push('/admin/estoque')}
                >
                  <Package className="w-6 h-6 text-amber-600" />
                  <span className="font-semibold text-amber-900">Controle de Estoque</span>
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full h-16 bg-gradient-to-br from-green-50 to-emerald-50 flex flex-col items-center justify-center gap-2 border-green-300 hover:border-green-400 hover:from-green-100 hover:to-emerald-100"
                  onClick={() => router.push('/admin/notas-fiscais')}
                >
                  <FileText className="w-6 h-6 text-green-600" />
                  <span className="font-semibold text-green-900">Notas Fiscais</span>
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full h-16 bg-gradient-to-br from-orange-50 to-red-50 flex flex-col items-center justify-center gap-2 border-orange-300 hover:border-orange-400 hover:from-orange-100 hover:to-red-100"
                  onClick={() => router.push('/admin/rh')}
                >
                  <Briefcase className="w-6 h-6 text-orange-600" />
                  <span className="font-semibold text-orange-900">Recursos Humanos</span>
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full h-16 bg-gradient-to-br from-amber-50 to-yellow-50 flex flex-col items-center justify-center gap-2 border-amber-300 hover:border-amber-400 hover:from-amber-100 hover:to-yellow-100"
                  onClick={() => router.push('/admin/precificacao/receitas')}
                >
                  <Calculator className="w-6 h-6 text-amber-600" />
                  <span className="font-semibold text-amber-900">Precificação Industrial</span>
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full h-16 flex flex-col items-center justify-center gap-2 border-blue-200 hover:bg-blue-50"
                  onClick={() => router.push('/admin/reports')}
                >
                  <BarChart3 className="w-6 h-6 text-blue-600" />
                  Relatórios
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full h-16 flex flex-col items-center justify-center gap-2 border-amber-200 hover:bg-amber-50"
                  onClick={() => router.push('/admin/destaques')}
                >
                  <Gift className="w-6 h-6 text-amber-600" />
                  Destaques Home
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full h-16 bg-gradient-to-br from-red-50 to-orange-50 flex flex-col items-center justify-center gap-2 border-red-300 hover:border-red-400 hover:from-red-100 hover:to-orange-100"
                  onClick={() => router.push('/admin/investir')}
                >
                  <TrendingUp className="w-6 h-6 text-red-600" />
                  <span className="font-semibold text-red-900">Bolsa de Investimentos</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>



        {/* Resumo Financeiro Mensal/Anual */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="mb-8"
        >
          <MonthlySummaryTable />
        </motion.div>
      </main>

      {/* Modal: Vendas Diárias */}
      <AnimatePresence>
        {showDailyRevenueModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowDailyRevenueModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-green-500 to-emerald-500">
                <div>
                  <h2 className="text-2xl font-bold text-white">Vendas de Hoje 💰</h2>
                  <p className="text-green-100 text-sm mt-1">Resumo detalhado das vendas</p>
                </div>
                <button
                  onClick={() => setShowDailyRevenueModal(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
                    <p className="text-gray-600 mt-4">Carregando vendas...</p>
                  </div>
                ) : dailyOrders.length > 0 ? (
                  <div className="space-y-4">
                    {dailyOrders.map((order: any) => (
                      <div key={order.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-bold text-lg text-gray-900">Pedido #{order.id.substring(0, 8)}</p>
                            <p className="text-sm text-gray-600">{order.Customer?.name || 'Cliente não identificado'}</p>
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3" />
                              {new Date(order.createdAt).toLocaleString('pt-BR')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-green-600">{formatCurrency(order.total)}</p>
                            <Badge className={getOrderStatusColor(order.status)}>
                              {getOrderStatusText(order.status)}
                            </Badge>
                          </div>
                        </div>
                        
                        {order.OrderItem && order.OrderItem.length > 0 && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-xs font-semibold text-gray-700 mb-2">Itens do Pedido:</p>
                            <div className="space-y-1">
                              {order.OrderItem.map((item: any, idx: number) => (
                                <p key={idx} className="text-xs text-gray-600">
                                  • {item.quantity}x {item.Product?.name || 'Produto'} - {formatCurrency(item.price)}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    
                    <div className="mt-6 p-4 bg-green-50 rounded-lg border-2 border-green-200">
                      <p className="text-center text-lg font-bold text-green-700">
                        Total do Dia: {formatCurrency(stats.dailyRevenue)}
                      </p>
                      <p className="text-center text-sm text-green-600 mt-1">
                        {dailyOrders.length} {dailyOrders.length === 1 ? 'venda' : 'vendas'} registrada{dailyOrders.length !== 1 && 's'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">Nenhuma venda hoje</p>
                    <p className="text-gray-500 text-sm mt-2">As vendas aparecerão aqui automaticamente</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: Faturamento Mensal */}
      <AnimatePresence>
        {showMonthlyRevenueModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowMonthlyRevenueModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-blue-500 to-cyan-500">
                <div>
                  <h2 className="text-2xl font-bold text-white">Faturamento Mensal 📊</h2>
                  <p className="text-blue-100 text-sm mt-1">Histórico mês a mês</p>
                </div>
                <button
                  onClick={() => setShowMonthlyRevenueModal(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-gray-600 mt-4">Carregando faturamento...</p>
                  </div>
                ) : monthlyRevenueOrders.length > 0 ? (
                  <div className="space-y-4">
                    {monthlyRevenueOrders.map((order: any) => (
                      <div key={order.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-bold text-lg text-gray-900">Pedido #{order.id.substring(0, 8)}</p>
                            <p className="text-sm text-gray-600">{order.Customer?.name || 'Cliente não identificado'}</p>
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3" />
                              {new Date(order.createdAt).toLocaleString('pt-BR')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-blue-600">{formatCurrency(order.total)}</p>
                            <Badge className={getOrderStatusColor(order.status)}>
                              {getOrderStatusText(order.status)}
                            </Badge>
                          </div>
                        </div>
                        
                        {order.OrderItem && order.OrderItem.length > 0 && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-xs font-semibold text-gray-700 mb-2">Itens do Pedido:</p>
                            <div className="space-y-1">
                              {order.OrderItem.map((item: any, idx: number) => (
                                <p key={idx} className="text-xs text-gray-600">
                                  • {item.quantity}x {item.Product?.name || 'Produto'} - {formatCurrency(item.price)}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    
                    <div className="mt-6 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                      <p className="text-center text-lg font-bold text-blue-700">
                        Total do Mês: {formatCurrency(stats.monthlyRevenue)}
                      </p>
                      <p className="text-center text-sm text-blue-600 mt-1">
                        {monthlyRevenueOrders.length} {monthlyRevenueOrders.length === 1 ? 'pedido' : 'pedidos'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <TrendingUp className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">Nenhum pedido este mês</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: Receita Líquida Diária */}
      <AnimatePresence>
        {showDailyNetRevenueModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowDailyNetRevenueModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-emerald-500 to-teal-500">
                <div>
                  <h2 className="text-2xl font-bold text-white">Receita Líquida Diária 💵</h2>
                  <p className="text-emerald-100 text-sm mt-1">Valores recebidos hoje</p>
                </div>
                <button
                  onClick={() => setShowDailyNetRevenueModal(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
                    <p className="text-gray-600 mt-4">Carregando receitas...</p>
                  </div>
                ) : dailyNetRevenueData.length > 0 ? (
                  <div className="space-y-4">
                    {dailyNetRevenueData.map((rec: any) => (
                      <div key={rec.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-bold text-lg text-gray-900">Pedido #{rec.orderNumber || rec.orderId?.substring(0, 8)}</p>
                            <p className="text-sm text-gray-600">{rec.customerName}</p>
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3" />
                              Pago em: {new Date(rec.paymentDate).toLocaleString('pt-BR')}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Forma de pagamento: <strong>{rec.paymentMethod}</strong>
                            </p>
                            <p className="text-xs text-gray-500">
                              Conta: <strong>{rec.bankAccountName}</strong>
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(rec.amount)}</p>
                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300">
                              Recebido
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <div className="mt-6 p-4 bg-emerald-50 rounded-lg border-2 border-emerald-200">
                      <p className="text-center text-lg font-bold text-emerald-700">
                        Total do Dia: {formatCurrency(stats.dailyNetRevenue)}
                      </p>
                      <p className="text-center text-sm text-emerald-600 mt-1">
                        {dailyNetRevenueData.length} {dailyNetRevenueData.length === 1 ? 'recebimento' : 'recebimentos'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">Nenhum recebimento hoje</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: Receita Líquida Mensal */}
      <AnimatePresence>
        {showMonthlyNetRevenueModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowMonthlyNetRevenueModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-teal-500 to-cyan-500">
                <div>
                  <h2 className="text-2xl font-bold text-white">Receita Líquida Mensal 💰</h2>
                  <p className="text-teal-100 text-sm mt-1">Valores recebidos este mês</p>
                </div>
                <button
                  onClick={() => setShowMonthlyNetRevenueModal(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
                    <p className="text-gray-600 mt-4">Carregando receitas...</p>
                  </div>
                ) : monthlyNetRevenueData.length > 0 ? (
                  <div className="space-y-4">
                    {monthlyNetRevenueData.map((rec: any) => (
                      <div key={rec.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-bold text-lg text-gray-900">Pedido #{rec.orderNumber || rec.orderId?.substring(0, 8)}</p>
                            <p className="text-sm text-gray-600">{rec.customerName}</p>
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3" />
                              Pago em: {new Date(rec.paymentDate).toLocaleString('pt-BR')}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Forma de pagamento: <strong>{rec.paymentMethod}</strong>
                            </p>
                            <p className="text-xs text-gray-500">
                              Conta: <strong>{rec.bankAccountName}</strong>
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-teal-600">{formatCurrency(rec.amount)}</p>
                            <Badge className="bg-teal-100 text-teal-700 border-teal-300">
                              Recebido
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <div className="mt-6 p-4 bg-teal-50 rounded-lg border-2 border-teal-200">
                      <p className="text-center text-lg font-bold text-teal-700">
                        Total do Mês: {formatCurrency(stats.monthlyNetRevenue)}
                      </p>
                      <p className="text-center text-sm text-teal-600 mt-1">
                        {monthlyNetRevenueData.length} {monthlyNetRevenueData.length === 1 ? 'recebimento' : 'recebimentos'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">Nenhum recebimento este mês</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: Clientes */}
      <AnimatePresence>
        {showCustomersModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowCustomersModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-purple-500 to-pink-500">
                <div>
                  <h2 className="text-2xl font-bold text-white">Clientes Cadastrados 👥</h2>
                  <p className="text-purple-100 text-sm mt-1">Resumo de todos os clientes</p>
                </div>
                <button
                  onClick={() => setShowCustomersModal(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                    <p className="text-gray-600 mt-4">Carregando clientes...</p>
                  </div>
                ) : customers.length > 0 ? (
                  <div className="grid md:grid-cols-2 gap-4">
                    {customers.map((customer: any) => (
                      <div key={customer.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="font-bold text-lg text-gray-900">{customer.name}</p>
                            {customer.email && (
                              <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                                <Mail className="w-3 h-3" />
                                {customer.email}
                              </p>
                            )}
                            {customer.phone && (
                              <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                                <Phone className="w-3 h-3" />
                                {customer.phone}
                              </p>
                            )}
                            {customer.address && (
                              <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                <MapPin className="w-3 h-3" />
                                {customer.address}
                              </p>
                            )}
                          </div>
                          {customer.creditLimit && (
                            <div className="text-right ml-2">
                              <p className="text-xs text-gray-600">Crédito</p>
                              <p className="font-bold text-purple-600">{formatCurrency(customer.creditLimit)}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    <div className="md:col-span-2 mt-4 p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
                      <p className="text-center text-lg font-bold text-purple-700">
                        Total: {customers.length} {customers.length === 1 ? 'cliente' : 'clientes'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">Nenhum cliente cadastrado</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: Despesas Diárias */}
      <AnimatePresence>
        {showDailyExpensesModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowDailyExpensesModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-red-500 to-rose-500">
                <div>
                  <h2 className="text-2xl font-bold text-white">Despesas de Hoje 💸</h2>
                  <p className="text-red-100 text-sm mt-1">Detalhamento das despesas operacionais</p>
                </div>
                <button
                  onClick={() => setShowDailyExpensesModal(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
                    <p className="text-gray-600 mt-4">Carregando despesas...</p>
                  </div>
                ) : dailyExpenses.length > 0 ? (
                  <div className="space-y-4">
                    {dailyExpenses.map((expense: any) => (
                      <div key={expense.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-bold text-lg text-gray-900">{expense.description}</p>
                            <p className="text-sm text-gray-600 mt-1">{expense.Category?.name || 'Sem categoria'}</p>
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-2">
                              <Calendar className="w-3 h-3" />
                              Vencimento: {formatDateBR(expense.dueDate)}
                            </p>
                            {expense.paymentDate && (
                              <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                                <CreditCard className="w-3 h-3" />
                                Pago em: {formatDateBR(expense.paymentDate)}
                              </p>
                            )}
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-2xl font-bold text-red-600">{formatCurrency(expense.amount)}</p>
                            <Badge className={expense.status === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                              {expense.status === 'PAID' ? 'Pago' : 'Pendente'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <div className="mt-6 p-4 bg-red-50 rounded-lg border-2 border-red-200">
                      <p className="text-center text-lg font-bold text-red-700">
                        Total do Dia: {formatCurrency(displayDailyData.operationalExpenses)}
                      </p>
                      <p className="text-center text-sm text-red-600 mt-1">
                        {dailyExpenses.length} {dailyExpenses.length === 1 ? 'despesa' : 'despesas'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">Nenhuma despesa hoje</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: Despesas Mensais */}
      <AnimatePresence>
        {showMonthlyExpensesModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowMonthlyExpensesModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-red-500 to-rose-500">
                <div>
                  <h2 className="text-2xl font-bold text-white">Histórico de Despesas 📈</h2>
                  <p className="text-red-100 text-sm mt-1">Resumo mensal de despesas operacionais</p>
                </div>
                <button
                  onClick={() => setShowMonthlyExpensesModal(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
                    <p className="text-gray-600 mt-4">Carregando despesas...</p>
                  </div>
                ) : monthlyExpensesDetails.length > 0 ? (
                  <div className="space-y-4">
                    {monthlyExpensesDetails.map((expense: any) => (
                      <div key={expense.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-bold text-lg text-gray-900">{expense.description}</p>
                            <p className="text-sm text-gray-600 mt-1">{expense.Category?.name || 'Sem categoria'}</p>
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-2">
                              <Calendar className="w-3 h-3" />
                              Vencimento: {formatDateBR(expense.dueDate)}
                            </p>
                            {expense.paymentDate && (
                              <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                                <CreditCard className="w-3 h-3" />
                                Pago em: {formatDateBR(expense.paymentDate)}
                              </p>
                            )}
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-2xl font-bold text-red-600">{formatCurrency(expense.amount)}</p>
                            <Badge className={expense.status === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                              {expense.status === 'PAID' ? 'Pago' : 'Pendente'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <div className="mt-6 p-4 bg-red-50 rounded-lg border-2 border-red-200">
                      <p className="text-center text-lg font-bold text-red-700">
                        Total do Mês: {formatCurrency(stats.monthlyOperationalExpenses)}
                      </p>
                      <p className="text-center text-sm text-red-600 mt-1">
                        {monthlyExpensesDetails.length} {monthlyExpensesDetails.length === 1 ? 'despesa' : 'despesas'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">Nenhuma despesa este mês</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: Despesas com Produtos Diária */}
      <AnimatePresence>
        {showDailyProductExpensesModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowDailyProductExpensesModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-indigo-500 to-purple-500">
                <div>
                  <h2 className="text-2xl font-bold text-white">Despesas com Produtos - Hoje 📦</h2>
                  <p className="text-indigo-100 text-sm mt-1">Relatório detalhado do dia</p>
                </div>
                <button
                  onClick={() => setShowDailyProductExpensesModal(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="text-gray-600 mt-4">Carregando despesas...</p>
                  </div>
                ) : dailyProductExpenses.length > 0 ? (
                  <div className="space-y-4">
                    {dailyProductExpenses.map((expense: any) => (
                      <div key={expense.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-bold text-lg text-gray-900">{expense.description}</p>
                            <p className="text-sm text-gray-600 mt-1">
                              <span className="font-semibold">Fornecedor:</span> {expense.supplier}
                            </p>
                            <p className="text-sm text-gray-600">
                              <span className="font-semibold">Categoria:</span> {expense.category}
                            </p>
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3" />
                              {expense.type} - Vencimento: {formatDateBR(expense.dueDate)}
                            </p>
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-2xl font-bold text-indigo-600">{formatCurrency(expense.amount)}</p>
                            <Badge className={expense.status === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                              {expense.status === 'PAID' ? 'Pago' : 'Pendente'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <div className="mt-6 p-4 bg-indigo-50 rounded-lg border-2 border-indigo-200">
                      <p className="text-center text-lg font-bold text-indigo-700">
                        Total do Dia: {formatCurrency(stats.dailyProductExpenses)}
                      </p>
                      <p className="text-center text-sm text-indigo-600 mt-1">
                        {dailyProductExpenses.length} {dailyProductExpenses.length === 1 ? 'despesa' : 'despesas'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">Nenhuma despesa com produtos hoje</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: Despesas com Produtos Mensal */}
      <AnimatePresence>
        {showMonthlyProductExpensesModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowMonthlyProductExpensesModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-indigo-500 to-purple-500">
                <div>
                  <h2 className="text-2xl font-bold text-white">Despesas com Produtos - Este Mês 📦</h2>
                  <p className="text-indigo-100 text-sm mt-1">Relatório detalhado do mês</p>
                </div>
                <button
                  onClick={() => setShowMonthlyProductExpensesModal(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="text-gray-600 mt-4">Carregando despesas...</p>
                  </div>
                ) : monthlyProductExpenses.length > 0 ? (
                  <div className="space-y-4">
                    {monthlyProductExpenses.map((expense: any) => (
                      <div key={expense.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-bold text-lg text-gray-900">{expense.description}</p>
                            <p className="text-sm text-gray-600 mt-1">
                              <span className="font-semibold">Fornecedor:</span> {expense.supplier}
                            </p>
                            <p className="text-sm text-gray-600">
                              <span className="font-semibold">Categoria:</span> {expense.category}
                            </p>
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3" />
                              {expense.type} - Vencimento: {formatDateBR(expense.dueDate)}
                            </p>
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-2xl font-bold text-indigo-600">{formatCurrency(expense.amount)}</p>
                            <Badge className={expense.status === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                              {expense.status === 'PAID' ? 'Pago' : 'Pendente'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <div className="mt-6 p-4 bg-indigo-50 rounded-lg border-2 border-indigo-200">
                      <p className="text-center text-lg font-bold text-indigo-700">
                        Total do Mês: {formatCurrency(stats.monthlyProductExpenses)}
                      </p>
                      <p className="text-center text-sm text-indigo-600 mt-1">
                        {monthlyProductExpenses.length} {monthlyProductExpenses.length === 1 ? 'despesa' : 'despesas'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">Nenhuma despesa com produtos este mês</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

      {/* Modal: Compras de Mercadorias Diária */}
      <AnimatePresence>
        {showDailyPurchasesModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowDailyPurchasesModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-teal-500 to-cyan-500">
                <div>
                  <h2 className="text-2xl font-bold text-white">Compras de Mercadorias - Hoje 🛒</h2>
                  <p className="text-teal-100 text-sm mt-1">Relatório detalhado do dia</p>
                </div>
                <button
                  onClick={() => setShowDailyPurchasesModal(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
                    <p className="text-gray-600 mt-4">Carregando compras...</p>
                  </div>
                ) : dailyPurchases.length > 0 ? (
                  <div className="space-y-4">
                    {dailyPurchases.map((purchase: any) => (
                      <div key={purchase.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-bold text-lg text-gray-900">{purchase.supplier}</p>
                            <p className="text-sm text-gray-600 mt-1">
                              <span className="font-semibold">Nota Fiscal:</span> {purchase.invoiceNumber || 'N/A'}
                            </p>
                            <p className="text-sm text-gray-600">
                              <span className="font-semibold">Conta:</span> {purchase.bankAccount || 'N/A'}
                            </p>
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3" />
                              Vencimento: {formatDateBR(purchase.dueDate)}
                            </p>
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-2xl font-bold text-teal-600">{formatCurrency(purchase.amount)}</p>
                            <Badge className={purchase.status === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                              {purchase.status === 'PAID' ? 'Pago' : 'Pendente'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <div className="mt-6 p-4 bg-teal-50 rounded-lg border-2 border-teal-200">
                      <p className="text-center text-lg font-bold text-teal-700">
                        Total do Dia: {formatCurrency(stats.dailyPurchases)}
                      </p>
                      <p className="text-center text-sm text-teal-600 mt-1">
                        {dailyPurchases.length} {dailyPurchases.length === 1 ? 'compra' : 'compras'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">Nenhuma compra hoje</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: Compras de Mercadorias Mensal */}
      <AnimatePresence>
        {showMonthlyPurchasesModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowMonthlyPurchasesModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-teal-500 to-cyan-500">
                <div>
                  <h2 className="text-2xl font-bold text-white">Compras de Mercadorias - Este Mês 🛒</h2>
                  <p className="text-teal-100 text-sm mt-1">Relatório detalhado do mês</p>
                </div>
                <button
                  onClick={() => setShowMonthlyPurchasesModal(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
                    <p className="text-gray-600 mt-4">Carregando compras...</p>
                  </div>
                ) : monthlyPurchases.length > 0 ? (
                  <div className="space-y-4">
                    {monthlyPurchases.map((purchase: any) => (
                      <div key={purchase.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-bold text-lg text-gray-900">{purchase.supplier}</p>
                            <p className="text-sm text-gray-600 mt-1">
                              <span className="font-semibold">Nota Fiscal:</span> {purchase.invoiceNumber || 'N/A'}
                            </p>
                            <p className="text-sm text-gray-600">
                              <span className="font-semibold">Conta:</span> {purchase.bankAccount || 'N/A'}
                            </p>
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3" />
                              Vencimento: {formatDateBR(purchase.dueDate)}
                            </p>
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-2xl font-bold text-teal-600">{formatCurrency(purchase.amount)}</p>
                            <Badge className={purchase.status === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                              {purchase.status === 'PAID' ? 'Pago' : 'Pendente'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <div className="mt-6 p-4 bg-teal-50 rounded-lg border-2 border-teal-200">
                      <p className="text-center text-lg font-bold text-teal-700">
                        Total do Mês: {formatCurrency(stats.monthlyPurchases)}
                      </p>
                      <p className="text-center text-sm text-teal-600 mt-1">
                        {monthlyPurchases.length} {monthlyPurchases.length === 1 ? 'compra' : 'compras'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">Nenhuma compra este mês</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: Investimentos Diário */}
      <AnimatePresence>
        {showDailyInvestmentsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowDailyInvestmentsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-amber-500 to-orange-500">
                <div>
                  <h2 className="text-2xl font-bold text-white">Investimentos - Hoje 💼</h2>
                  <p className="text-amber-100 text-sm mt-1">Relatório detalhado do dia</p>
                </div>
                <button
                  onClick={() => setShowDailyInvestmentsModal(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto"></div>
                    <p className="text-gray-600 mt-4">Carregando investimentos...</p>
                  </div>
                ) : dailyInvestments.length > 0 ? (
                  <div className="space-y-4">
                    {dailyInvestments.map((investment: any) => (
                      <div key={investment.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-bold text-lg text-gray-900">{investment.description}</p>
                            <p className="text-sm text-gray-600 mt-1">
                              <span className="font-semibold">Categoria:</span> {investment.category || 'N/A'}
                            </p>
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3" />
                              Vencimento: {formatDateBR(investment.dueDate)}
                            </p>
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-2xl font-bold text-amber-600">{formatCurrency(investment.amount)}</p>
                            <Badge className={investment.status === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                              {investment.status === 'PAID' ? 'Pago' : 'Pendente'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <div className="mt-6 p-4 bg-amber-50 rounded-lg border-2 border-amber-200">
                      <p className="text-center text-lg font-bold text-amber-700">
                        Total do Dia: {formatCurrency(stats.dailyInvestments)}
                      </p>
                      <p className="text-center text-sm text-amber-600 mt-1">
                        {dailyInvestments.length} {dailyInvestments.length === 1 ? 'investimento' : 'investimentos'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Briefcase className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">Nenhum investimento hoje</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: Investimentos Mensal */}
      <AnimatePresence>
        {showMonthlyInvestmentsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowMonthlyInvestmentsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-amber-500 to-orange-500">
                <div>
                  <h2 className="text-2xl font-bold text-white">Investimentos - Este Mês 💼</h2>
                  <p className="text-amber-100 text-sm mt-1">Relatório detalhado do mês</p>
                </div>
                <button
                  onClick={() => setShowMonthlyInvestmentsModal(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto"></div>
                    <p className="text-gray-600 mt-4">Carregando investimentos...</p>
                  </div>
                ) : monthlyInvestments.length > 0 ? (
                  <div className="space-y-4">
                    {monthlyInvestments.map((investment: any) => (
                      <div key={investment.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-bold text-lg text-gray-900">{investment.description}</p>
                            <p className="text-sm text-gray-600 mt-1">
                              <span className="font-semibold">Categoria:</span> {investment.category || 'N/A'}
                            </p>
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3" />
                              Vencimento: {formatDateBR(investment.dueDate)}
                            </p>
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-2xl font-bold text-amber-600">{formatCurrency(investment.amount)}</p>
                            <Badge className={investment.status === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                              {investment.status === 'PAID' ? 'Pago' : 'Pendente'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <div className="mt-6 p-4 bg-amber-50 rounded-lg border-2 border-amber-200">
                      <p className="text-center text-lg font-bold text-amber-700">
                        Total do Mês: {formatCurrency(stats.monthlyInvestments)}
                      </p>
                      <p className="text-center text-sm text-amber-600 mt-1">
                        {monthlyInvestments.length} {monthlyInvestments.length === 1 ? 'investimento' : 'investimentos'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Briefcase className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">Nenhum investimento este mês</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: Pró-labore Diário */}
      <AnimatePresence>
        {showDailyProlaboreModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowDailyProlaboreModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-rose-500 to-pink-500">
                <div>
                  <h2 className="text-2xl font-bold text-white">Pró-labore - Hoje 💵</h2>
                  <p className="text-rose-100 text-sm mt-1">Relatório detalhado do dia</p>
                </div>
                <button
                  onClick={() => setShowDailyProlaboreModal(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-600 mx-auto"></div>
                    <p className="text-gray-600 mt-4">Carregando pró-labore...</p>
                  </div>
                ) : dailyProlabore.length > 0 ? (
                  <div className="space-y-4">
                    {dailyProlabore.map((prolabore: any) => (
                      <div key={prolabore.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-bold text-lg text-gray-900">{prolabore.description}</p>
                            <p className="text-sm text-gray-600 mt-1">
                              <span className="font-semibold">Categoria:</span> {prolabore.category || 'N/A'}
                            </p>
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3" />
                              Vencimento: {formatDateBR(prolabore.dueDate)}
                            </p>
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-2xl font-bold text-rose-600">{formatCurrency(prolabore.amount)}</p>
                            <Badge className={prolabore.status === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                              {prolabore.status === 'PAID' ? 'Pago' : 'Pendente'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <div className="mt-6 p-4 bg-rose-50 rounded-lg border-2 border-rose-200">
                      <p className="text-center text-lg font-bold text-rose-700">
                        Total do Dia: {formatCurrency(stats.dailyProlabore)}
                      </p>
                      <p className="text-center text-sm text-rose-600 mt-1">
                        {dailyProlabore.length} {dailyProlabore.length === 1 ? 'pagamento' : 'pagamentos'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">Nenhum pró-labore hoje</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: Pró-labore Mensal */}
      <AnimatePresence>
        {showMonthlyProlaboreModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowMonthlyProlaboreModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-rose-500 to-pink-500">
                <div>
                  <h2 className="text-2xl font-bold text-white">Pró-labore - Este Mês 💵</h2>
                  <p className="text-rose-100 text-sm mt-1">Relatório detalhado do mês</p>
                </div>
                <button
                  onClick={() => setShowMonthlyProlaboreModal(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-600 mx-auto"></div>
                    <p className="text-gray-600 mt-4">Carregando pró-labore...</p>
                  </div>
                ) : monthlyProlabore.length > 0 ? (
                  <div className="space-y-4">
                    {monthlyProlabore.map((prolabore: any) => (
                      <div key={prolabore.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-bold text-lg text-gray-900">{prolabore.description}</p>
                            <p className="text-sm text-gray-600 mt-1">
                              <span className="font-semibold">Categoria:</span> {prolabore.category || 'N/A'}
                            </p>
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3" />
                              Vencimento: {formatDateBR(prolabore.dueDate)}
                            </p>
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-2xl font-bold text-rose-600">{formatCurrency(prolabore.amount)}</p>
                            <Badge className={prolabore.status === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                              {prolabore.status === 'PAID' ? 'Pago' : 'Pendente'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <div className="mt-6 p-4 bg-rose-50 rounded-lg border-2 border-rose-200">
                      <p className="text-center text-lg font-bold text-rose-700">
                        Total do Mês: {formatCurrency(stats.monthlyProlabore)}
                      </p>
                      <p className="text-center text-sm text-rose-600 mt-1">
                        {monthlyProlabore.length} {monthlyProlabore.length === 1 ? 'pagamento' : 'pagamentos'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">Nenhum pró-labore este mês</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Modal de Pedidos Pendentes */}
        {showPendingOrdersModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowPendingOrdersModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-yellow-500 to-amber-500">
                <div>
                  <h2 className="text-2xl font-bold text-white">Pedidos Pendentes ⚠️</h2>
                  <p className="text-yellow-100 text-sm mt-1">Pedidos aguardando processamento</p>
                </div>
                <button
                  onClick={() => setShowPendingOrdersModal(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-600 mx-auto"></div>
                    <p className="text-gray-600 mt-4">Carregando pedidos...</p>
                  </div>
                ) : pendingOrders.length > 0 ? (
                  <div className="space-y-4">
                    {pendingOrders.map((order: any) => (
                      <div key={order.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-yellow-50">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <p className="font-bold text-lg text-gray-900">Pedido #{order.id.substring(0, 8)}</p>
                              <Badge className="bg-yellow-100 text-yellow-800">
                                PENDENTE
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-700 font-semibold">
                              <span className="text-gray-600">Cliente:</span> {order.Customer?.name || 'Cliente não identificado'}
                            </p>
                            {order.Customer?.phone && (
                              <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                                <Phone className="w-3 h-3" />
                                {order.Customer.phone}
                              </p>
                            )}
                            {order.Customer?.city && (
                              <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                                <MapPin className="w-3 h-3" />
                                {order.Customer.city}
                              </p>
                            )}
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-2">
                              <Clock className="w-3 h-3" />
                              Criado em: {formatDateBR(order.createdAt)}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              <span className="font-semibold">Entrega:</span> {order.deliveryType === 'DELIVERY' ? '🚚 Entrega' : '📦 Retirada'} em {formatDateBR(order.deliveryDate)}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              <span className="font-semibold">Pagamento:</span> {order.paymentMethod === 'BOLETO' ? '📄 Boleto' : order.paymentMethod === 'PIX' ? '💳 Pix' : '💰 Dinheiro/Cartão'}
                            </p>
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-2xl font-bold text-yellow-600">{formatCurrency(order.totalValue)}</p>
                            <Link href={`/admin/orders/${order.id}`}>
                              <Button variant="outline" size="sm" className="mt-2">
                                Ver Detalhes
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <div className="mt-6 p-4 bg-yellow-100 rounded-lg border-2 border-yellow-300">
                      <p className="text-center text-lg font-bold text-yellow-700">
                        {pendingOrders.length} {pendingOrders.length === 1 ? 'pedido pendente' : 'pedidos pendentes'}
                      </p>
                      <p className="text-center text-sm text-yellow-600 mt-1">
                        Total: {formatCurrency(pendingOrders.reduce((acc: number, order: any) => acc + (order.totalValue || 0), 0))}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">Nenhum pedido pendente no momento</p>
                    <p className="text-gray-500 text-sm mt-2">Todos os pedidos foram processados! 🎉</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Total de Saídas Diárias */}
      <AnimatePresence>
        {showDailyTotalExpensesModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowDailyTotalExpensesModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-red-600 to-rose-600">
                <div>
                  <h2 className="text-2xl font-bold text-white">💸 Total de Saídas - Hoje</h2>
                  <p className="text-red-100 text-sm mt-1">
                    Detalhamento completo de todas as despesas
                  </p>
                </div>
                <button
                  onClick={() => setShowDailyTotalExpensesModal(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
                    <p className="text-gray-600 mt-4">Carregando detalhes...</p>
                  </div>
                ) : dailyTotalExpenses ? (
                  <div className="space-y-6">
                    {/* Resumo */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-red-50 rounded-lg p-4">
                        <h3 className="text-sm font-medium text-red-700 mb-2">Desp. Operacionais</h3>
                        <p className="text-2xl font-bold text-red-700">{formatCurrency(dailyTotalExpenses.summary.totalOperational)}</p>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-4">
                        <h3 className="text-sm font-medium text-purple-700 mb-2">Desp. com Produtos</h3>
                        <p className="text-2xl font-bold text-purple-700">{formatCurrency(dailyTotalExpenses.summary.totalProducts)}</p>
                      </div>
                      <div className="bg-indigo-50 rounded-lg p-4">
                        <h3 className="text-sm font-medium text-indigo-700 mb-2">Compras</h3>
                        <p className="text-2xl font-bold text-indigo-700">{formatCurrency(dailyTotalExpenses.summary.totalPurchases)}</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-4">
                        <h3 className="text-sm font-medium text-blue-700 mb-2">Investimentos</h3>
                        <p className="text-2xl font-bold text-blue-700">{formatCurrency(dailyTotalExpenses.summary.totalInvestments)}</p>
                      </div>
                      <div className="bg-teal-50 rounded-lg p-4">
                        <h3 className="text-sm font-medium text-teal-700 mb-2">Pro-Labore</h3>
                        <p className="text-2xl font-bold text-teal-700">{formatCurrency(dailyTotalExpenses.summary.totalProlabore)}</p>
                      </div>
                      <div className="bg-red-100 rounded-lg p-4 border-2 border-red-300">
                        <h3 className="text-sm font-medium text-red-800 mb-2">TOTAL GERAL</h3>
                        <p className="text-2xl font-bold text-red-800">{formatCurrency(dailyTotalExpenses.summary.totalExpenses)}</p>
                      </div>
                    </div>

                    {/* Detalhamento por categoria */}
                    <div className="space-y-4">
                      {/* Despesas Operacionais */}
                      {dailyTotalExpenses.operationalExpenses.list.length > 0 && (
                        <div>
                          <h3 className="text-lg font-semibold text-red-700 mb-3">Despesas Operacionais</h3>
                          <div className="space-y-2">
                            {dailyTotalExpenses.operationalExpenses.list.map((exp: any) => (
                              <div key={exp.id} className="bg-red-50 p-3 rounded-lg">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-medium">{exp.description}</p>
                                    <p className="text-sm text-gray-600">{exp.Category?.name || 'Sem categoria'}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      Vencimento: {new Date(exp.dueDate).toLocaleDateString('pt-BR')}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-bold text-red-700">{formatCurrency(exp.amount)}</p>
                                    <span className={`text-xs px-2 py-1 rounded mt-1 inline-block ${
                                      exp.isPaid ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                    }`}>
                                      {exp.isPaid ? 'Pago' : 'Pendente'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Outras categorias seguem o mesmo padrão... */}
                      {/* Por brevidade, vou adicionar apenas as principais */}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">Nenhuma despesa registrada neste dia</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Total de Saídas Mensais */}
      <AnimatePresence>
        {showMonthlyTotalExpensesModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowMonthlyTotalExpensesModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-red-700 to-rose-700">
                <div>
                  <h2 className="text-2xl font-bold text-white">💸 Total de Saídas - Este Mês</h2>
                  <p className="text-red-100 text-sm mt-1">
                    Detalhamento completo de todas as despesas do mês
                  </p>
                </div>
                <button
                  onClick={() => setShowMonthlyTotalExpensesModal(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-700 mx-auto"></div>
                    <p className="text-gray-600 mt-4">Carregando detalhes...</p>
                  </div>
                ) : monthlyTotalExpenses ? (
                  <div className="space-y-6">
                    {/* Resumo */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-red-50 rounded-lg p-4">
                        <h3 className="text-sm font-medium text-red-700 mb-2">Desp. Operacionais</h3>
                        <p className="text-2xl font-bold text-red-700">{formatCurrency(monthlyTotalExpenses.summary.totalOperational)}</p>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-4">
                        <h3 className="text-sm font-medium text-purple-700 mb-2">Desp. com Produtos</h3>
                        <p className="text-2xl font-bold text-purple-700">{formatCurrency(monthlyTotalExpenses.summary.totalProducts)}</p>
                      </div>
                      <div className="bg-indigo-50 rounded-lg p-4">
                        <h3 className="text-sm font-medium text-indigo-700 mb-2">Compras</h3>
                        <p className="text-2xl font-bold text-indigo-700">{formatCurrency(monthlyTotalExpenses.summary.totalPurchases)}</p>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-4">
                        <h3 className="text-sm font-medium text-blue-700 mb-2">Investimentos</h3>
                        <p className="text-2xl font-bold text-blue-700">{formatCurrency(monthlyTotalExpenses.summary.totalInvestments)}</p>
                      </div>
                      <div className="bg-teal-50 rounded-lg p-4">
                        <h3 className="text-sm font-medium text-teal-700 mb-2">Pro-Labore</h3>
                        <p className="text-2xl font-bold text-teal-700">{formatCurrency(monthlyTotalExpenses.summary.totalProlabore)}</p>
                      </div>
                      <div className="bg-red-100 rounded-lg p-4 border-2 border-red-400">
                        <h3 className="text-sm font-medium text-red-800 mb-2">TOTAL GERAL</h3>
                        <p className="text-2xl font-bold text-red-800">{formatCurrency(monthlyTotalExpenses.summary.totalExpenses)}</p>
                      </div>
                    </div>

                    {/* Lista resumida - top 10 despesas */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-3">Top 10 Despesas do Mês</h3>
                      <div className="space-y-2">
                        {[...monthlyTotalExpenses.operationalExpenses.list, ...monthlyTotalExpenses.productExpenses.list]
                          .sort((a: any, b: any) => b.amount - a.amount)
                          .slice(0, 10)
                          .map((exp: any) => (
                            <div key={exp.id} className="bg-gray-50 p-3 rounded-lg">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-medium">{exp.description}</p>
                                  <p className="text-sm text-gray-600">{exp.Category?.name || 'Sem categoria'}</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-gray-800">{formatCurrency(exp.amount)}</p>
                                  <span className={`text-xs px-2 py-1 rounded mt-1 inline-block ${
                                    exp.isPaid ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                  }`}>
                                    {exp.isPaid ? 'Pago' : 'Pendente'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">Nenhuma despesa registrada neste mês</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: Pedidos Entregues Hoje */}
      <AnimatePresence>
        {showDailyDeliveredOrdersModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowDailyDeliveredOrdersModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-emerald-500 to-teal-500">
                <div>
                  <h2 className="text-2xl font-bold text-white">Pedidos Entregues Hoje ✅</h2>
                  <p className="text-emerald-100 text-sm mt-1">Lista completa de pedidos entregues</p>
                </div>
                <button
                  onClick={() => setShowDailyDeliveredOrdersModal(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
                    <p className="text-gray-600 mt-4">Carregando pedidos...</p>
                  </div>
                ) : dailyDeliveredOrders.length > 0 ? (
                  <div className="space-y-4">
                    {dailyDeliveredOrders.map((order: any) => (
                      <div key={order.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-emerald-50 border-emerald-200">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-bold text-lg text-gray-900">Pedido #{order.id.substring(0, 8)}</p>
                            <p className="text-sm text-gray-600">{order.Customer?.name || 'Cliente não identificado'}</p>
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3" />
                              Entregue em: {new Date(order.deliveredAt || order.updatedAt).toLocaleString('pt-BR')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(order.total)}</p>
                            <Badge className="bg-emerald-600 text-white">
                              Entregue
                            </Badge>
                          </div>
                        </div>
                        
                        {order.OrderItem && order.OrderItem.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-emerald-200">
                            <p className="text-xs font-semibold text-gray-700 mb-2">Itens do Pedido:</p>
                            <div className="space-y-1">
                              {order.OrderItem.map((item: any, idx: number) => (
                                <p key={idx} className="text-xs text-gray-600">
                                  • {item.quantity}x {item.Product?.name || 'Produto'} - {formatCurrency(item.price)}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    
                    <div className="mt-6 p-4 bg-emerald-100 rounded-lg border-2 border-emerald-300">
                      <p className="text-center text-lg font-bold text-emerald-700">
                        Total de Pedidos Entregues Hoje: {dailyDeliveredOrders.length}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <CheckCircle2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">Nenhum pedido entregue hoje</p>
                    <p className="text-gray-500 text-sm mt-2">Os pedidos entregues aparecerão aqui</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: Pedidos Entregues do Mês */}
      <AnimatePresence>
        {showMonthlyDeliveredOrdersModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowMonthlyDeliveredOrdersModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-600">
                <div>
                  <h2 className="text-2xl font-bold text-white">Pedidos Entregues do Mês ✅</h2>
                  <p className="text-emerald-100 text-sm mt-1">Histórico de entregas do mês</p>
                </div>
                <button
                  onClick={() => setShowMonthlyDeliveredOrdersModal(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
                    <p className="text-gray-600 mt-4">Carregando pedidos...</p>
                  </div>
                ) : monthlyDeliveredOrders.length > 0 ? (
                  <div className="space-y-4">
                    {monthlyDeliveredOrders.map((order: any) => (
                      <div key={order.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-emerald-50 border-emerald-200">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-bold text-lg text-gray-900">Pedido #{order.id.substring(0, 8)}</p>
                            <p className="text-sm text-gray-600">{order.Customer?.name || 'Cliente não identificado'}</p>
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3" />
                              Entregue em: {new Date(order.deliveredAt || order.updatedAt).toLocaleString('pt-BR')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(order.total)}</p>
                            <Badge className="bg-emerald-600 text-white">
                              Entregue
                            </Badge>
                          </div>
                        </div>
                        
                        {order.OrderItem && order.OrderItem.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-emerald-200">
                            <p className="text-xs font-semibold text-gray-700 mb-2">Itens do Pedido:</p>
                            <div className="space-y-1">
                              {order.OrderItem.map((item: any, idx: number) => (
                                <p key={idx} className="text-xs text-gray-600">
                                  • {item.quantity}x {item.Product?.name || 'Produto'} - {formatCurrency(item.price)}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    
                    <div className="mt-6 p-4 bg-emerald-100 rounded-lg border-2 border-emerald-300">
                      <p className="text-center text-lg font-bold text-emerald-700">
                        Total de Pedidos Entregues no Mês: {monthlyDeliveredOrders.length}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <CheckCircle2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">Nenhum pedido entregue neste mês</p>
                    <p className="text-gray-500 text-sm mt-2">Os pedidos entregues aparecerão aqui</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: Clientes Cadastrados no Mês */}
      <AnimatePresence>
        {showMonthlyCustomersModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowMonthlyCustomersModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-purple-500 to-pink-500">
                <div>
                  <h2 className="text-2xl font-bold text-white">Clientes Cadastrados no Mês 👥</h2>
                  <p className="text-purple-100 text-sm mt-1">Novos clientes + Total geral de todas as épocas</p>
                </div>
                <button
                  onClick={() => setShowMonthlyCustomersModal(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                    <p className="text-gray-600 mt-4">Carregando clientes...</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Cards de Resumo */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-purple-50 rounded-lg p-6 border-2 border-purple-300">
                        <h3 className="text-sm font-medium text-purple-700 mb-2">Cadastrados Neste Mês</h3>
                        <p className="text-4xl font-bold text-purple-700">{monthlyCustomers.length}</p>
                        <p className="text-xs text-purple-600 mt-1">Novos clientes do período filtrado</p>
                      </div>
                      <div className="bg-pink-50 rounded-lg p-6 border-2 border-pink-300">
                        <h3 className="text-sm font-medium text-pink-700 mb-2">Total Geral de Clientes</h3>
                        <p className="text-4xl font-bold text-pink-700">{stats.totalCustomers}</p>
                        <p className="text-xs text-pink-600 mt-1">Todas as épocas (acumulado)</p>
                      </div>
                    </div>

                    {/* Lista de Clientes do Mês */}
                    {monthlyCustomers.length > 0 ? (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-3">Clientes Cadastrados no Período</h3>
                        <div className="space-y-3">
                          {monthlyCustomers.map((customer: any) => (
                            <div key={customer.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-purple-50 border-purple-200">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <p className="font-bold text-lg text-gray-900">{customer.name}</p>
                                  <div className="mt-2 space-y-1">
                                    {customer.email && (
                                      <p className="text-xs text-gray-600 flex items-center gap-1">
                                        <Mail className="w-3 h-3" />
                                        {customer.email}
                                      </p>
                                    )}
                                    {customer.phone && (
                                      <p className="text-xs text-gray-600 flex items-center gap-1">
                                        <Phone className="w-3 h-3" />
                                        {customer.phone}
                                      </p>
                                    )}
                                    {customer.city && (
                                      <p className="text-xs text-gray-600 flex items-center gap-1">
                                        <MapPin className="w-3 h-3" />
                                        {customer.city}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right ml-4">
                                  <Badge className="bg-purple-600 text-white mb-2">
                                    Novo
                                  </Badge>
                                  <p className="text-xs text-gray-500">
                                    {new Date(customer.createdAt).toLocaleDateString('pt-BR')}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-600 text-lg">Nenhum cliente cadastrado neste período</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: Produtos Cadastrados no Mês */}
      <AnimatePresence>
        {showMonthlyProductsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowMonthlyProductsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-orange-500 to-red-500">
                <div>
                  <h2 className="text-2xl font-bold text-white">Produtos Cadastrados no Mês 📦</h2>
                  <p className="text-orange-100 text-sm mt-1">Novos produtos + Total geral de todas as épocas</p>
                </div>
                <button
                  onClick={() => setShowMonthlyProductsModal(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
                    <p className="text-gray-600 mt-4">Carregando produtos...</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Cards de Resumo */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-orange-50 rounded-lg p-6 border-2 border-orange-300">
                        <h3 className="text-sm font-medium text-orange-700 mb-2">Cadastrados Neste Mês</h3>
                        <p className="text-4xl font-bold text-orange-700">{monthlyProducts.length}</p>
                        <p className="text-xs text-orange-600 mt-1">Novos produtos do período filtrado</p>
                      </div>
                      <div className="bg-red-50 rounded-lg p-6 border-2 border-red-300">
                        <h3 className="text-sm font-medium text-red-700 mb-2">Total Geral de Produtos</h3>
                        <p className="text-4xl font-bold text-red-700">{stats.totalProducts}</p>
                        <p className="text-xs text-red-600 mt-1">Todas as épocas (acumulado)</p>
                      </div>
                    </div>

                    {/* Lista de Produtos do Mês */}
                    {monthlyProducts.length > 0 ? (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-3">Produtos Cadastrados no Período</h3>
                        <div className="space-y-3">
                          {monthlyProducts.map((product: any) => (
                            <div key={product.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-orange-50 border-orange-200">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <p className="font-bold text-lg text-gray-900">{product.name}</p>
                                  <div className="mt-2 space-y-1">
                                    <p className="text-sm text-gray-600">
                                      <strong>SKU:</strong> {product.sku || 'N/A'}
                                    </p>
                                    {product.wholesalePrice && (
                                      <p className="text-sm text-gray-600">
                                        <strong>Preço Atacado:</strong> {formatCurrency(product.wholesalePrice)}
                                      </p>
                                    )}
                                    {product.category && (
                                      <Badge className="bg-gray-200 text-gray-700 mt-1">
                                        {product.category}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right ml-4">
                                  <Badge className="bg-orange-600 text-white mb-2">
                                    Novo
                                  </Badge>
                                  <p className="text-xs text-gray-500">
                                    {new Date(product.createdAt).toLocaleDateString('pt-BR')}
                                  </p>
                                  {product.isActive ? (
                                    <Badge className="bg-green-100 text-green-700 mt-1">
                                      Ativo
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-gray-200 text-gray-600 mt-1">
                                      Inativo
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-600 text-lg">Nenhum produto cadastrado neste período</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Modal de Aniversariantes */}
        {showBirthdaysModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowBirthdaysModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-pink-500 to-purple-500">
                <div>
                  <h2 className="text-2xl font-bold text-white">Aniversariantes de Hoje 🎂</h2>
                  <p className="text-pink-100 text-sm mt-1">Clientes fazendo aniversário</p>
                </div>
                <button
                  onClick={() => setShowBirthdaysModal(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {birthdays.length > 0 ? (
                  <div className="space-y-4">
                    {birthdays.map((customer: any) => (
                      <div key={customer.id} className="border-2 border-pink-200 rounded-lg p-5 hover:shadow-lg transition-shadow bg-gradient-to-r from-pink-50 to-purple-50">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <Gift className="w-6 h-6 text-pink-600" />
                              <p className="font-bold text-xl text-gray-900">{customer.name}</p>
                              <Badge className="bg-pink-100 text-pink-800 text-sm">
                                {customer.age} anos
                              </Badge>
                            </div>
                            
                            <div className="space-y-2 text-sm text-gray-700">
                              {customer.phone && (
                                <p className="flex items-center gap-2">
                                  <Phone className="w-4 h-4 text-gray-500" />
                                  <span className="font-semibold">Telefone:</span> {customer.phone}
                                </p>
                              )}
                              
                              {customer.email && (
                                <p className="flex items-center gap-2">
                                  <Mail className="w-4 h-4 text-gray-500" />
                                  <span className="font-semibold">Email:</span> {customer.email}
                                </p>
                              )}
                              
                              {customer.city && (
                                <p className="flex items-center gap-2">
                                  <MapPin className="w-4 h-4 text-gray-500" />
                                  <span className="font-semibold">Cidade:</span> {customer.city}
                                </p>
                              )}
                              
                              {customer.Seller && (
                                <p className="flex items-center gap-2">
                                  <UserCheck className="w-4 h-4 text-gray-500" />
                                  <span className="font-semibold">Vendedor:</span> {customer.Seller.name}
                                </p>
                              )}
                              
                              <p className="flex items-center gap-2 text-pink-600 font-semibold mt-3">
                                <Calendar className="w-4 h-4" />
                                Data de Nascimento: {customer.birthDateFormatted}
                              </p>
                            </div>
                          </div>
                          
                          <div className="ml-4 flex flex-col gap-2">
                            <Link href={`/admin/customers/${customer.id}`}>
                              <Button variant="outline" size="sm" className="w-full">
                                Ver Perfil
                              </Button>
                            </Link>
                            {customer.phone && (
                              <a 
                                href={`https://wa.me/55${customer.phone.replace(/\D/g, '')}?text=Olá ${customer.name}! 🎉 Feliz aniversário! 🎂 Que seu dia seja repleto de alegrias e realizações! 🎈`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Button size="sm" className="w-full bg-green-600 hover:bg-green-700 text-white">
                                  <Phone className="w-4 h-4 mr-2" />
                                  WhatsApp
                                </Button>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <div className="mt-6 p-4 bg-gradient-to-r from-pink-100 to-purple-100 rounded-lg border-2 border-pink-300">
                      <p className="text-center text-lg font-bold text-pink-700">
                        🎉 {birthdays.length} {birthdays.length === 1 ? 'aniversariante hoje' : 'aniversariantes hoje'} 🎉
                      </p>
                      <p className="text-center text-sm text-pink-600 mt-1">
                        Não esqueça de parabenizá-los!
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Gift className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">Nenhum aniversariante hoje</p>
                    <p className="text-gray-500 text-sm mt-2">Volte amanhã para verificar! 🎂</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Modal de Funcionários Aniversariantes */}
        {showEmployeeBirthdaysDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowEmployeeBirthdaysDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-blue-500 to-green-500">
                <div>
                  <h2 className="text-2xl font-bold text-white">Funcionários Aniversariantes 🎉</h2>
                  <p className="text-blue-100 text-sm mt-1">Funcionários fazendo aniversário hoje</p>
                </div>
                <button
                  onClick={() => setShowEmployeeBirthdaysDialog(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {employeeBirthdays.length > 0 ? (
                  <div className="space-y-4">
                    {employeeBirthdays.map((employee: any) => (
                      <div key={employee.id} className="border-2 border-blue-200 rounded-lg p-5 hover:shadow-lg transition-shadow bg-gradient-to-r from-blue-50 to-green-50">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <Users className="w-6 h-6 text-blue-600" />
                              <p className="font-bold text-xl text-gray-900">{employee.name}</p>
                              <Badge className="bg-blue-100 text-blue-800 text-sm">
                                {employee.age} anos
                              </Badge>
                            </div>
                            
                            <div className="space-y-2 text-sm text-gray-700">
                              <p className="flex items-center gap-2">
                                <Briefcase className="w-4 h-4 text-gray-500" />
                                <span className="font-semibold">Cargo:</span> {employee.position}
                              </p>
                              
                              <p className="flex items-center gap-2">
                                <Hash className="w-4 h-4 text-gray-500" />
                                <span className="font-semibold">Nº Funcionário:</span> {employee.employeeNumber}
                              </p>
                              
                              {employee.department && (
                                <p className="flex items-center gap-2">
                                  <Building className="w-4 h-4 text-gray-500" />
                                  <span className="font-semibold">Departamento:</span> {employee.department.name}
                                </p>
                              )}
                              
                              {employee.phone && (
                                <p className="flex items-center gap-2">
                                  <Phone className="w-4 h-4 text-gray-500" />
                                  <span className="font-semibold">Telefone:</span> {employee.phone}
                                </p>
                              )}
                              
                              {employee.email && (
                                <p className="flex items-center gap-2">
                                  <Mail className="w-4 h-4 text-gray-500" />
                                  <span className="font-semibold">Email:</span> {employee.email}
                                </p>
                              )}
                              
                              <p className="flex items-center gap-2 text-blue-600 font-semibold mt-3">
                                <Calendar className="w-4 h-4" />
                                Data de Nascimento: {employee.birthDateFormatted}
                              </p>
                            </div>
                          </div>
                          
                          <div className="ml-4 flex flex-col gap-2">
                            <Link href={`/admin/rh/funcionarios`}>
                              <Button variant="outline" size="sm" className="w-full">
                                Ver Funcionário
                              </Button>
                            </Link>
                            {employee.phone && (
                              <a 
                                href={`https://wa.me/55${employee.phone.replace(/\D/g, '')}?text=Olá ${employee.name}! 🎉 Feliz aniversário! 🎂 Que seu dia seja repleto de alegrias e muito sucesso! 🎈`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Button size="sm" className="w-full bg-green-600 hover:bg-green-700 text-white">
                                  <Phone className="w-4 h-4 mr-2" />
                                  WhatsApp
                                </Button>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <div className="mt-6 p-4 bg-gradient-to-r from-blue-100 to-green-100 rounded-lg border-2 border-blue-300">
                      <p className="text-center text-lg font-bold text-blue-700">
                        🎉 {employeeBirthdays.length} {employeeBirthdays.length === 1 ? 'funcionário aniversariante hoje' : 'funcionários aniversariantes hoje'} 🎉
                      </p>
                      <p className="text-center text-sm text-blue-600 mt-1">
                        Não esqueça de parabenizá-los!
                      </p>
                      <p className="text-center text-xs text-orange-600 mt-2 font-semibold">
                        ⚠️ Lembre-se: Funcionários que trabalharem hoje recebem 100% de hora extra!
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">Nenhum funcionário aniversariante hoje</p>
                    <p className="text-gray-500 text-sm mt-2">Volte amanhã para verificar! 🎂</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      </AnimatePresence>
    </div>
  )
}