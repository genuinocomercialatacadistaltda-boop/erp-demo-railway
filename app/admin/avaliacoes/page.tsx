'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { HomeButton } from '@/components/home-button'
import { toast } from 'sonner'
import { 
  Star, StarOff, Calendar, User, Users, TrendingUp, TrendingDown, 
  AlertTriangle, CheckCircle, XCircle, Edit2, ArrowLeft, RefreshCw,
  ChevronLeft, ChevronRight, Minus, Plus, Bell, Clock, Crown, UserCheck
} from 'lucide-react'

interface Employee {
  id: string
  name: string
  employeeNumber: string
  role: string
  isSupervisor: boolean
  isManager: boolean
  isCEO: boolean
}

interface Evaluation {
  id: string
  date: string
  rating: number
  achieved: boolean
  observations: string | null
  attitude: string | null
  punctuality: boolean
  quality: string | null
  bonusEarned: number
  employee: {
    id: string
    name: string
    employeeNumber: string
  }
  evaluator: {
    id: string
    name: string
  }
}

interface MonthlySummary {
  employeeId: string
  employeeName: string
  employeeNumber: string
  totalEvaluations: number
  totalStars: number
  averageStars: number
  positiveCount: number
  negativeCount: number
  neutralCount: number
  performanceLevel: 'EXCELENTE' | 'BOM' | 'REGULAR' | 'NECESSITA_ATENCAO' | 'CRITICO'
}

interface PendingEvaluation {
  evaluator: { id: string; name: string; role: string }
  missing: Array<{ id: string; name: string; role: string }>
  type: 'DIARIA' | 'SEMANAL'
  description: string
}

interface PendingStats {
  totalPending: number
  dailyPending: number
  weeklyPending: number
  byRole: {
    ceo: number
    gerente: number
    encarregado: number
    funcionario: number
  }
  weekRange: { start: string; end: string }
  date: string
}

export default function AvaliacoesPage() {
  const { data: session, status } = useSession() || {}
  const router = useRouter()
  
  const [employees, setEmployees] = useState<Employee[]>([])
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [monthlySummaries, setMonthlySummaries] = useState<MonthlySummary[]>([])
  const [pendingEvaluations, setPendingEvaluations] = useState<PendingEvaluation[]>([])
  const [pendingStats, setPendingStats] = useState<PendingStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('pendentes')
  
  // Filtros
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  })
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all')
  
  // Edit dialog
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingEval, setEditingEval] = useState<Evaluation | null>(null)
  const [editRating, setEditRating] = useState(0)
  const [editObservations, setEditObservations] = useState('')
  
  // Verificar autenticação
  useEffect(() => {
    if (status === 'loading') return
    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      router.push('/auth/login')
    }
  }, [session, status, router])
  
  // Buscar funcionários
  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch('/api/hr/employees')
      if (res.ok) {
        const data = await res.json()
        setEmployees(data.filter((e: Employee) => !e.isCEO && !e.isManager))
      }
    } catch (error) {
      console.error('Erro ao buscar funcionários:', error)
    }
  }, [])
  
  // Buscar avaliações diárias
  const fetchDailyEvaluations = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('date', selectedDate)
      if (selectedEmployee !== 'all') {
        params.set('employeeId', selectedEmployee)
      }
      
      const res = await fetch(`/api/hr/evaluations?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        // A API retorna { evaluations: [...] }
        setEvaluations(data.evaluations || data || [])
      }
    } catch (error) {
      console.error('Erro ao buscar avaliações:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedDate, selectedEmployee])
  
  // Buscar resumo mensal
  const fetchMonthlySummary = useCallback(async () => {
    try {
      setLoading(true)
      const [year, month] = selectedMonth.split('-')
      const params = new URLSearchParams()
      params.set('month', month)
      params.set('year', year)
      if (selectedEmployee !== 'all') {
        params.set('employeeId', selectedEmployee)
      }
      
      const res = await fetch(`/api/hr/evaluations/summary?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setMonthlySummaries(data)
      }
    } catch (error) {
      console.error('Erro ao buscar resumo mensal:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedMonth, selectedEmployee])
  
  // Buscar avaliações pendentes
  const fetchPendingEvaluations = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/hr/evaluations/pending?date=${selectedDate}`)
      if (res.ok) {
        const data = await res.json()
        setPendingEvaluations(data.pending || [])
        setPendingStats(data.stats || null)
      }
    } catch (error) {
      console.error('Erro ao buscar avaliações pendentes:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedDate])
  
  useEffect(() => {
    fetchEmployees()
  }, [])
  
  useEffect(() => {
    if (activeTab === 'pendentes') {
      fetchPendingEvaluations()
    } else if (activeTab === 'diarias') {
      fetchDailyEvaluations()
    } else {
      fetchMonthlySummary()
    }
  }, [activeTab, fetchDailyEvaluations, fetchMonthlySummary, fetchPendingEvaluations])
  
  // Funções de navegação de data
  const navigateDate = (direction: 'prev' | 'next') => {
    const date = new Date(selectedDate + 'T12:00:00')
    date.setDate(date.getDate() + (direction === 'next' ? 1 : -1))
    setSelectedDate(date.toISOString().split('T')[0])
  }
  
  const navigateMonth = (direction: 'prev' | 'next') => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const date = new Date(year, month - 1 + (direction === 'next' ? 1 : -1), 1)
    setSelectedMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
  }
  
  // Renderizar estrelas
  const renderStars = (rating: number, size: 'sm' | 'md' | 'lg' = 'md') => {
    const sizeClasses = {
      sm: 'w-3 h-3',
      md: 'w-4 h-4',
      lg: 'w-5 h-5'
    }
    
    const absRating = Math.abs(rating)
    const isNegative = rating < 0
    
    return (
      <div className="flex items-center gap-0.5">
        {isNegative && <Minus className={`${sizeClasses[size]} text-red-500`} />}
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className={`${sizeClasses[size]} ${
              i < absRating
                ? isNegative
                  ? 'fill-red-500 text-red-500'
                  : 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300'
            }`}
          />
        ))}
        {isNegative && <span className="text-xs text-red-500 ml-1">({rating})</span>}
        {!isNegative && <span className="text-xs text-gray-500 ml-1">({rating})</span>}
      </div>
    )
  }
  
  // Badge de desempenho
  const getPerformanceBadge = (level: string) => {
    const config: Record<string, { color: string; icon: any; label: string }> = {
      'EXCELENTE': { color: 'bg-green-500', icon: TrendingUp, label: 'Excelente' },
      'BOM': { color: 'bg-blue-500', icon: CheckCircle, label: 'Bom' },
      'REGULAR': { color: 'bg-yellow-500', icon: AlertTriangle, label: 'Regular' },
      'NECESSITA_ATENCAO': { color: 'bg-orange-500', icon: AlertTriangle, label: 'Necessita Atenção' },
      'CRITICO': { color: 'bg-red-500', icon: TrendingDown, label: 'Crítico' }
    }
    const { color, icon: Icon, label } = config[level] || config['REGULAR']
    return (
      <Badge className={`${color} text-white flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {label}
      </Badge>
    )
  }
  
  // Editar avaliação
  const openEditDialog = (evaluation: Evaluation) => {
    setEditingEval(evaluation)
    setEditRating(evaluation.rating)
    setEditObservations(evaluation.observations || '')
    setShowEditDialog(true)
  }
  
  const handleUpdateEvaluation = async () => {
    if (!editingEval) return
    
    try {
      const res = await fetch(`/api/hr/evaluations/${editingEval.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: editRating,
          observations: editObservations
        })
      })
      
      if (res.ok) {
        toast.success('Avaliação atualizada com sucesso!')
        setShowEditDialog(false)
        fetchDailyEvaluations()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Erro ao atualizar avaliação')
      }
    } catch (error) {
      toast.error('Erro ao atualizar avaliação')
    }
  }
  
  // Formatar data
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('pt-BR', { 
      weekday: 'long', 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric' 
    })
  }
  
  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1, 1)
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  }
  
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <HomeButton />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Star className="w-6 h-6 text-yellow-500" />
                  Gestão de Avaliações
                </h1>
                <p className="text-sm text-gray-500">Acompanhe o desempenho da equipe</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar funcionário" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Funcionários</SelectItem>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button variant="outline" onClick={() => {
                if (activeTab === 'pendentes') fetchPendingEvaluations()
                else if (activeTab === 'diarias') fetchDailyEvaluations()
                else fetchMonthlySummary()
              }}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="pendentes" className="flex items-center gap-2 relative">
              <Bell className="w-4 h-4" />
              Pendentes
              {pendingStats && pendingStats.totalPending > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {pendingStats.totalPending > 99 ? '99+' : pendingStats.totalPending}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="diarias" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Avaliações Diárias
            </TabsTrigger>
            <TabsTrigger value="mensais" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Resumo Mensal
            </TabsTrigger>
          </TabsList>
          
          {/* Tab: Avaliações Pendentes */}
          <TabsContent value="pendentes">
            {/* Navegação de Data */}
            <Card className="mb-6">
              <CardContent className="py-4">
                <div className="flex items-center justify-center gap-4">
                  <Button variant="outline" size="icon" onClick={() => navigateDate('prev')}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-orange-500" />
                    <Input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-auto"
                    />
                  </div>
                  
                  <Button variant="outline" size="icon" onClick={() => navigateDate('next')}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                
                <p className="text-center text-sm text-gray-500 mt-2 capitalize">
                  {formatDate(selectedDate)}
                </p>
              </CardContent>
            </Card>
            
            {/* Estatísticas */}
            {pendingStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Card className={pendingStats.dailyPending > 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
                  <CardContent className="p-4 text-center">
                    <Clock className={`w-8 h-8 mx-auto mb-2 ${pendingStats.dailyPending > 0 ? 'text-red-500' : 'text-green-500'}`} />
                    <p className="text-2xl font-bold">{pendingStats.dailyPending}</p>
                    <p className="text-xs text-gray-600">Pendentes Diárias</p>
                  </CardContent>
                </Card>
                
                <Card className={pendingStats.weeklyPending > 0 ? 'border-orange-200 bg-orange-50' : 'border-green-200 bg-green-50'}>
                  <CardContent className="p-4 text-center">
                    <Calendar className={`w-8 h-8 mx-auto mb-2 ${pendingStats.weeklyPending > 0 ? 'text-orange-500' : 'text-green-500'}`} />
                    <p className="text-2xl font-bold">{pendingStats.weeklyPending}</p>
                    <p className="text-xs text-gray-600">Pendentes Semanais</p>
                  </CardContent>
                </Card>
                
                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="p-4 text-center">
                    <Crown className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                    <p className="text-2xl font-bold">{pendingStats.byRole.ceo + pendingStats.byRole.gerente + pendingStats.byRole.encarregado}</p>
                    <p className="text-xs text-gray-600">Líderes Pendentes</p>
                  </CardContent>
                </Card>
                
                <Card className="border-purple-200 bg-purple-50">
                  <CardContent className="p-4 text-center">
                    <Users className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                    <p className="text-2xl font-bold">{pendingStats.byRole.funcionario}</p>
                    <p className="text-xs text-gray-600">Funcionários Pendentes</p>
                  </CardContent>
                </Card>
              </div>
            )}
            
            {/* Legenda de Hierarquia */}
            <Card className="mb-6 border-blue-200 bg-blue-50">
              <CardContent className="p-4">
                <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                  <UserCheck className="w-5 h-5" />
                  Regras de Avaliação
                </h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <p className="flex items-center gap-2">
                      <Badge className="bg-red-500">Diária</Badge>
                      <span>CEO → Gerente</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Badge className="bg-red-500">Diária</Badge>
                      <span>Gerente → Encarregados</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Badge className="bg-red-500">Diária</Badge>
                      <span>Encarregados → Funcionários</span>
                    </p>
                  </div>
                  <div>
                    <p className="flex items-center gap-2">
                      <Badge className="bg-orange-500">Semanal</Badge>
                      <span>Funcionários → Encarregados, Gerente e CEO</span>
                    </p>
                    {pendingStats && (
                      <p className="text-xs text-gray-500 mt-2">
                        Semana: {new Date(pendingStats.weekRange.start).toLocaleDateString('pt-BR')} a {new Date(pendingStats.weekRange.end).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Lista de Pendências */}
            {loading ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
              </div>
            ) : pendingEvaluations.length === 0 ? (
              <Card className="border-green-200 bg-green-50">
                <CardContent className="py-12 text-center">
                  <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4" />
                  <p className="text-green-700 font-semibold">Todas as avaliações estão em dia!</p>
                  <p className="text-green-600 text-sm">Nenhuma avaliação pendente para {formatDate(selectedDate)}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* Avaliações Diárias Pendentes */}
                {pendingEvaluations.filter(p => p.type === 'DIARIA').length > 0 && (
                  <Card className="border-red-200">
                    <CardHeader className="bg-red-50">
                      <CardTitle className="text-red-800 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        Avaliações Diárias Pendentes
                      </CardTitle>
                      <CardDescription className="text-red-600">
                        Devem ser feitas até o final do dia
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Avaliador</TableHead>
                            <TableHead>Cargo</TableHead>
                            <TableHead>Falta Avaliar</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingEvaluations
                            .filter(p => p.type === 'DIARIA')
                            .map((pending, idx) => (
                              <TableRow key={`daily-${idx}`} className="bg-red-50/50">
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-white font-bold text-sm">
                                      {pending.evaluator.name.charAt(0)}
                                    </div>
                                    <span className="font-medium">{pending.evaluator.name}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="border-red-300 text-red-700">
                                    {pending.evaluator.role}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-2">
                                    {pending.missing.map((m, mIdx) => (
                                      <Badge key={mIdx} className="bg-red-100 text-red-800">
                                        {m.name} ({m.role})
                                      </Badge>
                                    ))}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
                
                {/* Avaliações Semanais Pendentes */}
                {pendingEvaluations.filter(p => p.type === 'SEMANAL').length > 0 && (
                  <Card className="border-orange-200">
                    <CardHeader className="bg-orange-50">
                      <CardTitle className="text-orange-800 flex items-center gap-2">
                        <Clock className="w-5 h-5" />
                        Avaliações Semanais Pendentes
                      </CardTitle>
                      <CardDescription className="text-orange-600">
                        Devem ser feitas até o final da semana
                        {pendingStats && (
                          <span className="ml-2">
                            (até {new Date(pendingStats.weekRange.end).toLocaleDateString('pt-BR')})
                          </span>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Funcionário</TableHead>
                            <TableHead>Falta Avaliar</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingEvaluations
                            .filter(p => p.type === 'SEMANAL')
                            .map((pending, idx) => (
                              <TableRow key={`weekly-${idx}`} className="bg-orange-50/50">
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-sm">
                                      {pending.evaluator.name.charAt(0)}
                                    </div>
                                    <span className="font-medium">{pending.evaluator.name}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-2">
                                    {pending.missing.map((m, mIdx) => (
                                      <Badge key={mIdx} className="bg-orange-100 text-orange-800">
                                        {m.name} ({m.role})
                                      </Badge>
                                    ))}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>
          
          {/* Tab: Avaliações Diárias */}
          <TabsContent value="diarias">
            {/* Navegação de Data */}
            <Card className="mb-6">
              <CardContent className="py-4">
                <div className="flex items-center justify-center gap-4">
                  <Button variant="outline" size="icon" onClick={() => navigateDate('prev')}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-orange-500" />
                    <Input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-auto"
                    />
                  </div>
                  
                  <Button variant="outline" size="icon" onClick={() => navigateDate('next')}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                
                <p className="text-center text-sm text-gray-500 mt-2 capitalize">
                  {formatDate(selectedDate)}
                </p>
              </CardContent>
            </Card>
            
            {/* Lista de Avaliações */}
            {loading ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
              </div>
            ) : evaluations.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <StarOff className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">Nenhuma avaliação encontrada para esta data</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {evaluations.map((evaluation) => (
                  <Card key={evaluation.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-bold">
                            {evaluation.employee.name.charAt(0)}
                          </div>
                          
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {evaluation.employee.name}
                            </h3>
                            <p className="text-sm text-gray-500">
                              Avaliado por: {evaluation.evaluator.name}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          {renderStars(evaluation.rating, 'lg')}
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(evaluation)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Detalhes */}
                      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="flex items-center gap-2">
                          {evaluation.punctuality ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                          <span className="text-sm">Pontualidade</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {evaluation.achieved ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                          <span className="text-sm">Meta Atingida</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {evaluation.attitude === 'EXCELLENT' ? 'Excelente' :
                             evaluation.attitude === 'GOOD' ? 'Bom' :
                             evaluation.attitude === 'NEEDS_IMPROVEMENT' ? 'Precisa Melhorar' :
                             evaluation.attitude || 'N/A'}
                          </Badge>
                          <span className="text-sm">Atitude</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {evaluation.quality === 'EXCELLENT' ? 'Excelente' :
                             evaluation.quality === 'GOOD' ? 'Bom' :
                             evaluation.quality === 'NEEDS_IMPROVEMENT' ? 'Precisa Melhorar' :
                             evaluation.quality || 'N/A'}
                          </Badge>
                          <span className="text-sm">Qualidade</span>
                        </div>
                      </div>
                      
                      {evaluation.observations && (
                        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-700">
                            <strong>Observações:</strong> {evaluation.observations}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          
          {/* Tab: Resumo Mensal */}
          <TabsContent value="mensais">
            {/* Navegação de Mês */}
            <Card className="mb-6">
              <CardContent className="py-4">
                <div className="flex items-center justify-center gap-4">
                  <Button variant="outline" size="icon" onClick={() => navigateMonth('prev')}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-orange-500" />
                    <Input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="w-auto"
                    />
                  </div>
                  
                  <Button variant="outline" size="icon" onClick={() => navigateMonth('next')}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                
                <p className="text-center text-sm text-gray-500 mt-2 capitalize">
                  {formatMonth(selectedMonth)}
                </p>
              </CardContent>
            </Card>
            
            {/* Tabela de Resumo */}
            {loading ? (
              <div className="flex justify-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
              </div>
            ) : monthlySummaries.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">Nenhuma avaliação encontrada para este mês</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Desempenho da Equipe - {formatMonth(selectedMonth)}</CardTitle>
                  <CardDescription>
                    Resumo das avaliações do período
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Funcionário</TableHead>
                        <TableHead className="text-center">Avaliações</TableHead>
                        <TableHead className="text-center">Estrelas Totais</TableHead>
                        <TableHead className="text-center">Média</TableHead>
                        <TableHead className="text-center">Positivas</TableHead>
                        <TableHead className="text-center">Negativas</TableHead>
                        <TableHead className="text-center">Desempenho</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlySummaries.map((summary) => (
                        <TableRow key={summary.employeeId}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-bold text-sm">
                                {summary.employeeName.charAt(0)}
                              </div>
                              <div>
                                <p className="font-medium">{summary.employeeName}</p>
                                <p className="text-xs text-gray-500">#{summary.employeeNumber}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{summary.totalEvaluations}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`font-bold ${
                              summary.totalStars > 0 ? 'text-green-600' : 
                              summary.totalStars < 0 ? 'text-red-600' : 'text-gray-600'
                            }`}>
                              {summary.totalStars > 0 ? '+' : ''}{summary.totalStars}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            {renderStars(Math.round(summary.averageStars), 'sm')}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-green-100 text-green-800">
                              {summary.positiveCount}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-red-100 text-red-800">
                              {summary.negativeCount}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {getPerformanceBadge(summary.performanceLevel)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
      
      {/* Dialog de Edição */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Avaliação</DialogTitle>
          </DialogHeader>
          
          {editingEval && (
            <div className="space-y-4">
              <div>
                <Label>Funcionário</Label>
                <p className="text-sm font-medium">{editingEval.employee.name}</p>
              </div>
              
              <div>
                <Label>Estrelas ({editRating})</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditRating(Math.max(-5, editRating - 1))}
                    disabled={editRating <= -5}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  
                  <div className="flex-1 flex justify-center">
                    {renderStars(editRating, 'lg')}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditRating(Math.min(5, editRating + 1))}
                    disabled={editRating >= 5}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-gray-500 text-center mt-1">
                  Intervalo: -5 (crítico) a +5 (excelente)
                </p>
              </div>
              
              <div>
                <Label htmlFor="observations">Observações</Label>
                <Input
                  id="observations"
                  value={editObservations}
                  onChange={(e) => setEditObservations(e.target.value)}
                  placeholder="Observações sobre o desempenho..."
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateEvaluation}>
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
