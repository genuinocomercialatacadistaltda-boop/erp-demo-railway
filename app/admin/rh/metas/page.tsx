'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Home,
  Target,
  Plus,
  Star,
  StarOff,
  CheckCircle2,
  XCircle,
  Users,
  Calendar,
  Trophy,
  MessageSquare,
  Clock,
  TrendingUp,
  Save,
  Search,
  Edit,
  Trash2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface Employee {
  id: string
  name: string
  employeeNumber: number
  position: string
  isSupervisor: boolean
  supervisorId: string | null
  supervisor?: { id: string; name: string }
  supervisees?: Employee[]
  status?: string
}

interface DailyGoal {
  id: string
  employeeId: string
  date: string
  description: string
  targetQuantity: number | null
  category: string
  bonusAmount: number | null
  isRecurring: boolean
  notes: string | null
  employee: Employee
  evaluations: GoalEvaluation[]
}

interface GoalEvaluation {
  id: string
  employeeId: string
  evaluatorId: string
  dailyGoalId: string | null
  date: string
  achieved: boolean
  achievedQuantity: number | null
  rating: number
  observations: string | null
  attitude: string | null
  punctuality: boolean
  quality: string | null
  bonusEarned: number | null
  employee: Employee
  evaluator: Employee
  dailyGoal?: DailyGoal
}

export default function MetasDiariasPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [employees, setEmployees] = useState<Employee[]>([])
  const [supervisors, setSupervisors] = useState<Employee[]>([])
  const [goals, setGoals] = useState<DailyGoal[]>([])
  const [evaluations, setEvaluations] = useState<GoalEvaluation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>('')
  
  // Dialog states
  const [showGoalDialog, setShowGoalDialog] = useState(false)
  const [showEvaluationDialog, setShowEvaluationDialog] = useState(false)
  const [editingGoal, setEditingGoal] = useState<DailyGoal | null>(null)
  const [evaluatingEmployee, setEvaluatingEmployee] = useState<Employee | null>(null)
  
  // Form states
  const [goalForm, setGoalForm] = useState({
    employeeId: '',
    description: '',
    targetQuantity: '',
    category: 'PRODUCTION',
    bonusAmount: '',
    notes: ''
  })
  
  const [evalForm, setEvalForm] = useState({
    achieved: false,
    achievedQuantity: '',
    rating: 3,
    observations: '',
    attitude: '',
    punctuality: true,
    quality: ''
  })

  useEffect(() => {
    if (status === 'authenticated') {
      loadData()
    }
  }, [status, selectedDate, selectedSupervisor])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Carregar funcionários
      const empRes = await fetch('/api/hr/employees')
      if (empRes.ok) {
        const empData = await empRes.json()
        const allEmployees = Array.isArray(empData) ? empData : empData.employees || []
        setEmployees(allEmployees)
        setSupervisors(allEmployees.filter((e: Employee) => e.isSupervisor))
      }

      // Carregar metas do dia
      let goalsUrl = `/api/hr/daily-goals?date=${selectedDate}`
      if (selectedSupervisor) {
        goalsUrl += `&supervisorId=${selectedSupervisor}`
      }
      const goalsRes = await fetch(goalsUrl)
      if (goalsRes.ok) {
        const goalsData = await goalsRes.json()
        setGoals(goalsData.goals || [])
      }

      // Carregar avaliações do dia
      let evalsUrl = `/api/hr/evaluations?date=${selectedDate}`
      if (selectedSupervisor) {
        evalsUrl += `&evaluatorId=${selectedSupervisor}`
      }
      const evalsRes = await fetch(evalsUrl)
      if (evalsRes.ok) {
        const evalsData = await evalsRes.json()
        setEvaluations(evalsData.evaluations || [])
      }

    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveGoal = async () => {
    if (!goalForm.employeeId || !goalForm.description) {
      toast.error('Preencha os campos obrigatórios')
      return
    }

    try {
      const url = editingGoal 
        ? `/api/hr/daily-goals/${editingGoal.id}`
        : '/api/hr/daily-goals'
      
      const res = await fetch(url, {
        method: editingGoal ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...goalForm,
          date: selectedDate
        })
      })

      if (res.ok) {
        toast.success(editingGoal ? 'Meta atualizada!' : 'Meta criada!')
        setShowGoalDialog(false)
        resetGoalForm()
        loadData()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erro ao salvar meta')
      }
    } catch (error) {
      toast.error('Erro ao salvar meta')
    }
  }

  const handleSaveEvaluation = async () => {
    if (!evaluatingEmployee) return

    // Buscar encarregado logado ou primeiro supervisor
    const evaluatorId = supervisors[0]?.id || session?.user?.id
    if (!evaluatorId) {
      toast.error('Nenhum encarregado encontrado')
      return
    }

    // Buscar meta do funcionário para o dia
    const employeeGoal = goals.find(g => g.employeeId === evaluatingEmployee.id)

    try {
      const res = await fetch('/api/hr/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: evaluatingEmployee.id,
          evaluatorId,
          dailyGoalId: employeeGoal?.id || null,
          date: selectedDate,
          ...evalForm
        })
      })

      if (res.ok) {
        toast.success('Avaliação salva!')
        setShowEvaluationDialog(false)
        resetEvalForm()
        loadData()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erro ao salvar avaliação')
      }
    } catch (error) {
      toast.error('Erro ao salvar avaliação')
    }
  }

  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm('Deseja excluir esta meta?')) return

    try {
      const res = await fetch(`/api/hr/daily-goals/${goalId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        toast.success('Meta excluída!')
        loadData()
      } else {
        toast.error('Erro ao excluir meta')
      }
    } catch (error) {
      toast.error('Erro ao excluir meta')
    }
  }

  const resetGoalForm = () => {
    setGoalForm({
      employeeId: '',
      description: '',
      targetQuantity: '',
      category: 'PRODUCTION',
      bonusAmount: '',
      notes: ''
    })
    setEditingGoal(null)
  }

  const resetEvalForm = () => {
    setEvalForm({
      achieved: false,
      achievedQuantity: '',
      rating: 3,
      observations: '',
      attitude: '',
      punctuality: true,
      quality: ''
    })
    setEvaluatingEmployee(null)
  }

  const openEvaluationDialog = (employee: Employee) => {
    setEvaluatingEmployee(employee)
    
    // Carregar avaliação existente se houver
    const existingEval = evaluations.find(e => e.employeeId === employee.id)
    if (existingEval) {
      setEvalForm({
        achieved: existingEval.achieved,
        achievedQuantity: existingEval.achievedQuantity?.toString() || '',
        rating: existingEval.rating,
        observations: existingEval.observations || '',
        attitude: existingEval.attitude || '',
        punctuality: existingEval.punctuality,
        quality: existingEval.quality || ''
      })
    } else {
      resetEvalForm()
      setEvaluatingEmployee(employee)
    }
    
    setShowEvaluationDialog(true)
  }

  const renderStars = (rating: number, onSelect?: (r: number) => void) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            onClick={() => onSelect?.(star)}
            className={`transition-colors ${onSelect ? 'cursor-pointer hover:text-yellow-400' : ''}`}
          >
            {star <= rating ? (
              <Star className="w-6 h-6 fill-yellow-400 text-yellow-400" />
            ) : (
              <StarOff className="w-6 h-6 text-gray-300" />
            )}
          </button>
        ))}
      </div>
    )
  }

  const getEmployeesWithGoals = () => {
    // Funcionários que têm metas para o dia selecionado
    const employeeIdsWithGoals = new Set(goals.map(g => g.employeeId))
    
    // Se há supervisor selecionado, filtrar apenas supervisees
    if (selectedSupervisor) {
      const supervisor = employees.find(e => e.id === selectedSupervisor)
      const superviseeIds = employees
        .filter(e => e.supervisorId === selectedSupervisor)
        .map(e => e.id)
      
      return employees.filter(e => 
        superviseeIds.includes(e.id) || employeeIdsWithGoals.has(e.id)
      )
    }
    
    return employees.filter(e => e.status !== 'INACTIVE')
  }

  const getEvaluationForEmployee = (employeeId: string) => {
    return evaluations.find(e => e.employeeId === employeeId)
  }

  const getGoalForEmployee = (employeeId: string) => {
    return goals.find(g => g.employeeId === employeeId)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <p className="text-orange-600">Carregando...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-orange-800 flex items-center gap-2">
              <Target className="w-8 h-8" />
              Metas Diárias e Avaliações
            </h1>
            <p className="text-orange-600 mt-1">
              Gerencie metas e avalie o desempenho dos funcionários
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => router.push('/admin/rh')}
              className="border-orange-300"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/admin')}
              className="border-orange-300"
            >
              <Home className="w-4 h-4 mr-2" />
              Início
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Data</Label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Filtrar por Encarregado</Label>
                <Select
                  value={selectedSupervisor}
                  onValueChange={setSelectedSupervisor}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Todos os funcionários" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos os funcionários</SelectItem>
                    {supervisors.map(sup => (
                      <SelectItem key={sup.id} value={sup.id}>
                        {sup.name} (Encarregado)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() => {
                    resetGoalForm()
                    setShowGoalDialog(true)
                  }}
                  className="bg-orange-600 hover:bg-orange-700 w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Meta
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-full">
                  <Target className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Metas do Dia</p>
                  <p className="text-2xl font-bold">{goals.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-full">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Metas Batidas</p>
                  <p className="text-2xl font-bold text-green-600">
                    {evaluations.filter(e => e.achieved).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-yellow-100 rounded-full">
                  <Star className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Média Estrelas</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {evaluations.length > 0 
                      ? (evaluations.reduce((acc, e) => acc + e.rating, 0) / evaluations.length).toFixed(1)
                      : '-'
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 rounded-full">
                  <Trophy className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Bônus Total</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {formatCurrency(evaluations.reduce((acc, e) => acc + (e.bonusEarned || 0), 0))}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Funcionários para Avaliar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Checklist de Avaliação - {format(new Date(selectedDate + 'T12:00:00'), "dd 'de' MMMM", { locale: ptBR })}
            </CardTitle>
            <CardDescription>
              Clique no funcionário para avaliar o desempenho do dia
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {getEmployeesWithGoals().map(employee => {
                const evaluation = getEvaluationForEmployee(employee.id)
                const goal = getGoalForEmployee(employee.id)
                const isEvaluated = !!evaluation

                return (
                  <div
                    key={employee.id}
                    className={`p-4 rounded-lg border-2 transition-all cursor-pointer hover:shadow-md ${
                      isEvaluated
                        ? evaluation.achieved
                          ? 'border-green-300 bg-green-50'
                          : 'border-red-300 bg-red-50'
                        : 'border-gray-200 bg-white hover:border-orange-300'
                    }`}
                    onClick={() => openEvaluationDialog(employee)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                          isEvaluated
                            ? evaluation.achieved ? 'bg-green-500' : 'bg-red-500'
                            : 'bg-gray-400'
                        }`}>
                          {isEvaluated
                            ? evaluation.achieved ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />
                            : employee.name.charAt(0).toUpperCase()
                          }
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {employee.name}
                            <span className="text-gray-500 font-normal ml-2">(#{employee.employeeNumber})</span>
                          </h3>
                          <p className="text-sm text-gray-600">{employee.position}</p>
                          {goal && (
                            <p className="text-sm text-orange-600 mt-1">
                              <Target className="w-3 h-3 inline mr-1" />
                              {goal.description}
                              {goal.targetQuantity && ` - Meta: ${goal.targetQuantity} un`}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {isEvaluated && (
                          <>
                            <div className="text-right">
                              {renderStars(evaluation.rating)}
                              {evaluation.bonusEarned && evaluation.bonusEarned > 0 && (
                                <p className="text-sm text-green-600 mt-1">
                                  Bônus: {formatCurrency(evaluation.bonusEarned)}
                                </p>
                              )}
                            </div>
                            <Badge variant={evaluation.achieved ? 'default' : 'destructive'}>
                              {evaluation.achieved ? 'Bateu' : 'Não Bateu'}
                            </Badge>
                          </>
                        )}
                        {!isEvaluated && (
                          <Badge variant="outline" className="text-gray-500">
                            Pendente
                          </Badge>
                        )}
                      </div>
                    </div>
                    {isEvaluated && evaluation.observations && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-sm text-gray-600">
                          <MessageSquare className="w-4 h-4 inline mr-1" />
                          {evaluation.observations}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}

              {getEmployeesWithGoals().length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Nenhum funcionário com meta para este dia</p>
                  <p className="text-sm mt-2">Clique em "Nova Meta" para adicionar</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Dialog Nova Meta */}
        <Dialog open={showGoalDialog} onOpenChange={setShowGoalDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                {editingGoal ? 'Editar Meta' : 'Nova Meta Diária'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Funcionário *</Label>
                <Select
                  value={goalForm.employeeId}
                  onValueChange={(value) => setGoalForm({ ...goalForm, employeeId: value })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o funcionário" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.filter(e => e.status !== 'INACTIVE').map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name} (#{emp.employeeNumber})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Descrição da Meta *</Label>
                <Input
                  value={goalForm.description}
                  onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })}
                  placeholder="Ex: Produzir 750 espetos"
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Quantidade Alvo</Label>
                  <Input
                    type="number"
                    value={goalForm.targetQuantity}
                    onChange={(e) => setGoalForm({ ...goalForm, targetQuantity: e.target.value })}
                    placeholder="Ex: 750"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select
                    value={goalForm.category}
                    onValueChange={(value) => setGoalForm({ ...goalForm, category: value })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PRODUCTION">Produção</SelectItem>
                      <SelectItem value="QUALITY">Qualidade</SelectItem>
                      <SelectItem value="TASK">Tarefa</SelectItem>
                      <SelectItem value="OTHER">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Valor do Bônus (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={goalForm.bonusAmount}
                  onChange={(e) => setGoalForm({ ...goalForm, bonusAmount: e.target.value })}
                  placeholder="Ex: 50.00"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea
                  value={goalForm.notes}
                  onChange={(e) => setGoalForm({ ...goalForm, notes: e.target.value })}
                  placeholder="Observações adicionais..."
                  className="mt-1"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowGoalDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveGoal} className="bg-orange-600 hover:bg-orange-700">
                  <Save className="w-4 h-4 mr-2" />
                  Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog Avaliação */}
        <Dialog open={showEvaluationDialog} onOpenChange={setShowEvaluationDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500" />
                Avaliar Funcionário
              </DialogTitle>
            </DialogHeader>
            {evaluatingEmployee && (
              <div className="space-y-4">
                <div className="p-4 bg-orange-50 rounded-lg">
                  <h3 className="font-semibold text-lg">{evaluatingEmployee.name}</h3>
                  <p className="text-gray-600">{evaluatingEmployee.position} - #{evaluatingEmployee.employeeNumber}</p>
                  {getGoalForEmployee(evaluatingEmployee.id) && (
                    <p className="text-orange-600 mt-2">
                      <Target className="w-4 h-4 inline mr-1" />
                      Meta: {getGoalForEmployee(evaluatingEmployee.id)?.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <Checkbox
                    id="achieved"
                    checked={evalForm.achieved}
                    onCheckedChange={(checked) => setEvalForm({ ...evalForm, achieved: !!checked })}
                  />
                  <Label htmlFor="achieved" className="text-lg cursor-pointer">
                    Bateu a meta do dia?
                  </Label>
                </div>

                {getGoalForEmployee(evaluatingEmployee.id)?.targetQuantity && (
                  <div>
                    <Label>Quantidade Produzida</Label>
                    <Input
                      type="number"
                      value={evalForm.achievedQuantity}
                      onChange={(e) => setEvalForm({ ...evalForm, achievedQuantity: e.target.value })}
                      placeholder="Ex: 720"
                      className="mt-1"
                    />
                  </div>
                )}

                <div>
                  <Label className="text-lg">Avaliação (Estrelas)</Label>
                  <div className="mt-2">
                    {renderStars(evalForm.rating, (r) => setEvalForm({ ...evalForm, rating: r }))}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {evalForm.rating === 5 && '⭐ Excelente - Bônus 100%'}
                    {evalForm.rating === 4 && '⭐ Muito Bom - Bônus 80%'}
                    {evalForm.rating === 3 && '⭐ Bom - Bônus 60%'}
                    {evalForm.rating === 2 && '⭐ Regular - Bônus 40%'}
                    {evalForm.rating === 1 && '⭐ Precisa Melhorar - Bônus 20%'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Atitude</Label>
                    <Select
                      value={evalForm.attitude}
                      onValueChange={(value) => setEvalForm({ ...evalForm, attitude: value })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EXCELLENT">Excelente</SelectItem>
                        <SelectItem value="GOOD">Boa</SelectItem>
                        <SelectItem value="REGULAR">Regular</SelectItem>
                        <SelectItem value="BAD">Ruim</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Qualidade</Label>
                    <Select
                      value={evalForm.quality}
                      onValueChange={(value) => setEvalForm({ ...evalForm, quality: value })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HIGH">Alta</SelectItem>
                        <SelectItem value="MEDIUM">Média</SelectItem>
                        <SelectItem value="LOW">Baixa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <Checkbox
                    id="punctuality"
                    checked={evalForm.punctuality}
                    onCheckedChange={(checked) => setEvalForm({ ...evalForm, punctuality: !!checked })}
                  />
                  <Label htmlFor="punctuality" className="cursor-pointer">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Foi pontual hoje?
                  </Label>
                </div>

                <div>
                  <Label>Observações do Encarregado</Label>
                  <Textarea
                    value={evalForm.observations}
                    onChange={(e) => setEvalForm({ ...evalForm, observations: e.target.value })}
                    placeholder="Comentários sobre o desempenho..."
                    className="mt-1"
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setShowEvaluationDialog(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveEvaluation} className="bg-green-600 hover:bg-green-700">
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Avaliação
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
