'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  Target,
  Star,
  CheckCircle2,
  XCircle,
  Clock,
  Save,
  Users,
  Calendar,
  MessageSquare,
  Plus,
  Edit,
  Trash2,
  AlertTriangle,
  Bell
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface Employee {
  id: string
  name: string
  employeeNumber: number
  position: string
  isSupervisor: boolean
  supervisorId: string | null
}

interface DailyGoal {
  id: string
  employeeId: string
  date: string
  description: string
  targetQuantity: number | null
  category: string
  bonusAmount: number | null
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

interface SupervisorEvaluationsProps {
  employeeId: string
  employeeName: string
}

export function SupervisorEvaluations({ employeeId, employeeName }: SupervisorEvaluationsProps) {
  const [supervisees, setSupervisees] = useState<Employee[]>([])
  const [goals, setGoals] = useState<DailyGoal[]>([])
  const [evaluations, setEvaluations] = useState<GoalEvaluation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  
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
    loadData()
  }, [selectedDate, employeeId])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Carregar subordinados do encarregado
      const empRes = await fetch('/api/employee/subordinates')
      if (empRes.ok) {
        const empData = await empRes.json()
        const employees = Array.isArray(empData) ? empData : empData.employees || []
        setSupervisees(employees)
        console.log('[SupervisorEvaluations] Subordinados carregados:', employees.length)
      } else {
        console.error('[SupervisorEvaluations] Erro ao carregar subordinados:', await empRes.text())
      }

      // Carregar metas do dia para os subordinados
      const goalsRes = await fetch(`/api/hr/daily-goals?date=${selectedDate}&supervisorId=${employeeId}`)
      if (goalsRes.ok) {
        const goalsData = await goalsRes.json()
        setGoals(goalsData.goals || [])
      }

      // Carregar avaliações do dia
      const evalsRes = await fetch(`/api/hr/evaluations?date=${selectedDate}&evaluatorId=${employeeId}`)
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

    // Buscar meta do funcionário para o dia
    const employeeGoal = goals.find(g => g.employeeId === evaluatingEmployee.id)

    try {
      const res = await fetch('/api/hr/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: evaluatingEmployee.id,
          evaluatorId: employeeId,
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

  const getEmployeeGoal = (empId: string) => goals.find(g => g.employeeId === empId)
  const getEmployeeEvaluation = (empId: string) => evaluations.find(e => e.employeeId === empId)

  const renderStars = (rating: number, onChange?: (r: number) => void) => {
    const absRating = Math.abs(rating)
    const isNegative = rating < 0
    
    return (
      <div className="flex flex-col gap-2">
        <div className="flex gap-1 items-center">
          {/* Estrelas negativas (vermelhas) - de -5 a -1 */}
          {onChange && (
            <div className="flex gap-0.5 items-center mr-2 pr-2 border-r border-gray-300">
              {[-5, -4, -3, -2, -1].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => onChange(star)}
                  className="cursor-pointer hover:scale-110 transition-transform"
                  title={`Nota ${star}`}
                >
                  <Star
                    className={`w-5 h-5 ${
                      isNegative && star >= rating 
                        ? 'fill-red-500 text-red-500' 
                        : 'text-gray-300 hover:text-red-400'
                    }`}
                  />
                </button>
              ))}
            </div>
          )}
          
          {/* Botão X para marcar 0 estrelas (Péssimo) */}
          {onChange && (
            <button
              type="button"
              onClick={() => onChange(0)}
              className={`cursor-pointer hover:scale-110 transition-transform mr-1 ${rating === 0 ? 'bg-red-100 rounded-full p-0.5' : ''}`}
              title="Péssimo (0 estrelas)"
            >
              <XCircle
                className={`w-5 h-5 ${rating === 0 ? 'text-red-500' : 'text-gray-300 hover:text-red-400'}`}
              />
            </button>
          )}
          
          {/* Estrelas positivas (amarelas) - de 1 a 5 */}
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onChange?.(star)}
              className={`${onChange ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform`}
            >
              <Star
                className={`w-6 h-6 ${
                  !isNegative && star <= rating 
                    ? 'fill-yellow-400 text-yellow-400' 
                    : 'text-gray-300'
                }`}
              />
            </button>
          ))}
        </div>
        
        {/* Indicador textual */}
        <div className="text-xs">
          {rating < -2 && <span className="text-red-600 font-semibold">Muito Ruim ({rating})</span>}
          {rating >= -2 && rating < 0 && <span className="text-red-500">Ruim ({rating})</span>}
          {rating === 0 && <span className="text-red-500">Péssimo</span>}
          {rating >= 1 && rating <= 2 && <span className="text-orange-500">Regular ({rating})</span>}
          {rating >= 3 && rating <= 4 && <span className="text-yellow-600">Bom ({rating})</span>}
          {rating === 5 && <span className="text-green-600 font-semibold">Excelente ({rating})</span>}
        </div>
        
        {/* Display para visualização sem onChange (mostra estrelas negativas também) */}
        {!onChange && isNegative && (
          <div className="flex gap-0.5 items-center">
            {Array.from({ length: absRating }, (_, i) => (
              <Star key={i} className="w-4 h-4 fill-red-500 text-red-500" />
            ))}
            <span className="text-xs text-red-500 ml-1">({rating})</span>
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <Card className="border-purple-200 bg-purple-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <span className="ml-2">Carregando equipe...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (supervisees.length === 0) {
    return (
      <Card className="border-purple-200 bg-purple-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-purple-800">
            <Users className="w-5 h-5" />
            Área do Encarregado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">Nenhum funcionário está sob sua supervisão no momento.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-purple-300 bg-gradient-to-r from-purple-50 to-indigo-50">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-purple-800">
                <Users className="w-5 h-5" />
                Área do Encarregado
              </CardTitle>
              <CardDescription>
                Gerencie metas e avalie sua equipe ({supervisees.length} funcionário{supervisees.length > 1 ? 's' : ''})
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="date" className="text-sm whitespace-nowrap">Data:</Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-40"
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Alerta de Avaliações Pendentes */}
      {(() => {
        const today = format(new Date(), 'yyyy-MM-dd')
        const isToday = selectedDate === today
        const pendingEvaluations = supervisees.filter(emp => !getEmployeeEvaluation(emp.id))
        
        if (isToday && pendingEvaluations.length > 0) {
          return (
            <Alert variant="destructive" className="border-orange-500 bg-orange-50">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <AlertTitle className="text-orange-800 font-bold flex items-center gap-2">
                <Bell className="h-4 w-4" /> Avaliações Pendentes Hoje!
              </AlertTitle>
              <AlertDescription className="text-orange-700">
                <p className="mb-2">
                  Você ainda não avaliou <strong>{pendingEvaluations.length}</strong> funcionário(s) hoje:
                </p>
                <div className="flex flex-wrap gap-2">
                  {pendingEvaluations.map(emp => (
                    <Badge 
                      key={emp.id} 
                      variant="outline" 
                      className="border-orange-400 text-orange-700 cursor-pointer hover:bg-orange-100"
                      onClick={() => openEvaluationDialog(emp)}
                    >
                      {emp.name}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs mt-2 text-orange-600">
                  💡 A avaliação diária é obrigatória para todos os funcionários da sua equipe.
                </p>
              </AlertDescription>
            </Alert>
          )
        }
        
        if (isToday && pendingEvaluations.length === 0 && supervisees.length > 0) {
          return (
            <Alert className="border-green-500 bg-green-50">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <AlertTitle className="text-green-800 font-bold">
                ✅ Todas as avaliações do dia foram feitas!
              </AlertTitle>
              <AlertDescription className="text-green-700">
                Parabéns! Você avaliou todos os {supervisees.length} funcionários da sua equipe hoje.
              </AlertDescription>
            </Alert>
          )
        }
        
        return null
      })()}

      {/* Lista de Funcionários */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {supervisees.map((emp) => {
          const goal = getEmployeeGoal(emp.id)
          const evaluation = getEmployeeEvaluation(emp.id)
          
          return (
            <Card key={emp.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{emp.name}</CardTitle>
                    <p className="text-sm text-gray-500">#{emp.employeeNumber} • {emp.position}</p>
                  </div>
                  {evaluation ? (
                    <Badge className={evaluation.achieved ? 'bg-green-500' : 'bg-gray-500'}>
                      {evaluation.achieved ? 'Atingiu' : 'Não atingiu'}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Pendente</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Meta do dia */}
                {goal ? (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 text-blue-800 font-medium mb-1">
                      <Target className="w-4 h-4" />
                      Meta do Dia
                    </div>
                    <p className="text-sm">{goal.description}</p>
                    {goal.targetQuantity && (
                      <p className="text-xs text-gray-600 mt-1">Quantidade: {goal.targetQuantity}</p>
                    )}
                    <div className="flex gap-1 mt-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingGoal(goal)
                          setGoalForm({
                            employeeId: goal.employeeId,
                            description: goal.description,
                            targetQuantity: goal.targetQuantity?.toString() || '',
                            category: goal.category,
                            bonusAmount: goal.bonusAmount?.toString() || '',
                            notes: goal.notes || ''
                          })
                          setShowGoalDialog(true)
                        }}
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600"
                        onClick={() => handleDeleteGoal(goal.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-2">
                    <p className="text-sm text-gray-500 mb-2">Sem meta definida</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setGoalForm({ ...goalForm, employeeId: emp.id })
                        setShowGoalDialog(true)
                      }}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Definir Meta
                    </Button>
                  </div>
                )}

                {/* Avaliação */}
                {evaluation && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Avaliação</span>
                      {renderStars(evaluation.rating)}
                    </div>
                    {evaluation.observations && (
                      <p className="text-xs text-gray-600">{evaluation.observations}</p>
                    )}
                  </div>
                )}

                {/* Botão Avaliar */}
                <Button
                  className="w-full"
                  variant={evaluation ? 'outline' : 'default'}
                  onClick={() => openEvaluationDialog(emp)}
                >
                  <Star className="w-4 h-4 mr-2" />
                  {evaluation ? 'Editar Avaliação' : 'Avaliar Funcionário'}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Dialog - Nova Meta */}
      <Dialog open={showGoalDialog} onOpenChange={setShowGoalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600" />
              {editingGoal ? 'Editar Meta' : 'Nova Meta Diária'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Funcionário *</Label>
              <Select
                value={goalForm.employeeId}
                onValueChange={(v) => setGoalForm({ ...goalForm, employeeId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {supervisees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name} (#{emp.employeeNumber})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Descrição da Meta *</Label>
              <Textarea
                value={goalForm.description}
                onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })}
                placeholder="Ex: Montar 100 espetos de frango"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Quantidade Alvo</Label>
                <Input
                  type="number"
                  value={goalForm.targetQuantity}
                  onChange={(e) => setGoalForm({ ...goalForm, targetQuantity: e.target.value })}
                  placeholder="Ex: 100"
                />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select
                  value={goalForm.category}
                  onValueChange={(v) => setGoalForm({ ...goalForm, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRODUCTION">Produção</SelectItem>
                    <SelectItem value="SALES">Vendas</SelectItem>
                    <SelectItem value="DELIVERY">Entrega</SelectItem>
                    <SelectItem value="CLEANING">Limpeza</SelectItem>
                    <SelectItem value="OTHER">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Bônus (R$) - opcional</Label>
              <Input
                type="number"
                step="0.01"
                value={goalForm.bonusAmount}
                onChange={(e) => setGoalForm({ ...goalForm, bonusAmount: e.target.value })}
                placeholder="Ex: 10.00"
              />
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea
                value={goalForm.notes}
                onChange={(e) => setGoalForm({ ...goalForm, notes: e.target.value })}
                placeholder="Observações adicionais..."
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowGoalDialog(false); resetGoalForm() }}>
                Cancelar
              </Button>
              <Button onClick={handleSaveGoal}>
                <Save className="w-4 h-4 mr-2" />
                Salvar Meta
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog - Avaliar Funcionário */}
      <Dialog open={showEvaluationDialog} onOpenChange={setShowEvaluationDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" />
              Avaliar {evaluatingEmployee?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Meta do funcionário (se houver) */}
            {evaluatingEmployee && getEmployeeGoal(evaluatingEmployee.id) && (
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm font-medium text-blue-800">Meta do Dia:</p>
                <p className="text-sm">{getEmployeeGoal(evaluatingEmployee.id)?.description}</p>
              </div>
            )}

            {/* Atingiu a meta? */}
            <div className="flex items-center gap-3">
              <Checkbox
                id="achieved"
                checked={evalForm.achieved}
                onCheckedChange={(checked) => setEvalForm({ ...evalForm, achieved: checked as boolean })}
              />
              <Label htmlFor="achieved" className="text-base font-medium cursor-pointer">
                Atingiu a meta do dia
              </Label>
              {evalForm.achieved ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-gray-400" />
              )}
            </div>

            {/* Quantidade atingida */}
            <div>
              <Label>Quantidade Realizada</Label>
              <Input
                type="number"
                value={evalForm.achievedQuantity}
                onChange={(e) => setEvalForm({ ...evalForm, achievedQuantity: e.target.value })}
                placeholder="Ex: 95"
              />
            </div>

            {/* Nota (estrelas) */}
            <div>
              <Label className="mb-2 block">Nota Geral</Label>
              {renderStars(evalForm.rating, (r) => setEvalForm({ ...evalForm, rating: r }))}
            </div>

            {/* Pontualidade */}
            <div className="flex items-center gap-3">
              <Checkbox
                id="punctuality"
                checked={evalForm.punctuality}
                onCheckedChange={(checked) => setEvalForm({ ...evalForm, punctuality: checked as boolean })}
              />
              <Label htmlFor="punctuality" className="cursor-pointer flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Pontual no horário
              </Label>
            </div>

            {/* Atitude */}
            <div>
              <Label>Atitude / Comportamento</Label>
              <Select
                value={evalForm.attitude}
                onValueChange={(v) => setEvalForm({ ...evalForm, attitude: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXCELLENT">Excelente</SelectItem>
                  <SelectItem value="GOOD">Bom</SelectItem>
                  <SelectItem value="REGULAR">Regular</SelectItem>
                  <SelectItem value="NEEDS_IMPROVEMENT">Precisa Melhorar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Qualidade */}
            <div>
              <Label>Qualidade do Trabalho</Label>
              <Select
                value={evalForm.quality}
                onValueChange={(v) => setEvalForm({ ...evalForm, quality: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXCELLENT">Excelente</SelectItem>
                  <SelectItem value="GOOD">Bom</SelectItem>
                  <SelectItem value="REGULAR">Regular</SelectItem>
                  <SelectItem value="NEEDS_IMPROVEMENT">Precisa Melhorar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Observações */}
            <div>
              <Label>Observações</Label>
              <Textarea
                value={evalForm.observations}
                onChange={(e) => setEvalForm({ ...evalForm, observations: e.target.value })}
                placeholder="Comentários adicionais sobre o desempenho..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setShowEvaluationDialog(false); resetEvalForm() }}>
                Cancelar
              </Button>
              <Button onClick={handleSaveEvaluation}>
                <Save className="w-4 h-4 mr-2" />
                Salvar Avaliação
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
