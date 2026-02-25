'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

import { toast } from 'sonner'
import { Plus, Edit, Trash2, Target, Users } from 'lucide-react'

interface Employee {
  id: string
  name: string
  employeeNumber: number
  position: string
}

interface Product {
  id: string
  name: string
  category: string
}

interface Team {
  id: string
  name: string
  description?: string
}

interface Goal {
  id: string
  goalType: 'INDIVIDUAL' | 'TEAM' | 'PRODUCT'
  targetQuantity: number
  period: string
  startDate: string
  endDate?: string
  isActive: boolean
  employee?: {
    id: string
    name: string
  }
  product?: {
    id: string
    name: string
  }
  team?: {
    id: string
    name: string
  }
}

export function GoalsTab() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    type: 'INDIVIDUAL',
    employeeId: '',
    productId: '',
    teamId: '',
    targetQuantity: '',
    period: 'DAILY',
    startDate: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [goalsRes, employeesRes, productsRes, teamsRes] = await Promise.all([
        fetch('/api/production/goals'),
        fetch('/api/hr/employees'),
        fetch('/api/products'),
        fetch('/api/production/teams')
      ])

      if (goalsRes.ok) {
        const data = await goalsRes.json()
        setGoals(data.goals || [])
      }
      if (employeesRes.ok) {
        const data = await employeesRes.json()
        // A API /api/hr/employees retorna array diretamente
        setEmployees(Array.isArray(data) ? data : data.employees || [])
      }
      if (productsRes.ok) {
        const data = await productsRes.json()
        setProducts(data || [])
      }
      if (teamsRes.ok) {
        const data = await teamsRes.json()
        setTeams(data.teams || [])
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      toast.error('Erro ao carregar dados de metas')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.targetQuantity || !formData.startDate) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }

    if (formData.type === 'INDIVIDUAL' && !formData.employeeId) {
      toast.error('Selecione um funcionário para meta individual')
      return
    }

    if (formData.type === 'TEAM' && !formData.teamId) {
      toast.error('Selecione uma equipe para meta de equipe')
      return
    }

    if (formData.type === 'PRODUCT' && !formData.productId) {
      toast.error('Selecione um produto para meta de produto')
      return
    }

    try {
      const url = editingId
        ? `/api/production/goals/${editingId}`
        : '/api/production/goals'

      const method = editingId ? 'PUT' : 'POST'

      const payload: any = {
        goalType: formData.type,
        targetQuantity: parseInt(formData.targetQuantity),
        period: formData.period === 'DAILY' ? 'Diária' : formData.period === 'WEEKLY' ? 'Semanal' : 'Mensal',
        startDate: formData.startDate
      }

      if (formData.type === 'INDIVIDUAL' && formData.employeeId) {
        payload.employeeId = formData.employeeId
      }

      if (formData.type === 'TEAM' && formData.teamId) {
        payload.teamId = formData.teamId
      }

      if (formData.type === 'PRODUCT' && formData.productId) {
        payload.productId = formData.productId
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (res.ok) {
        toast.success(data.message || 'Meta salva com sucesso!')
        setShowDialog(false)
        resetForm()
        fetchData()
      } else {
        toast.error(data.error || 'Erro ao salvar meta')
      }
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao salvar meta')
    }
  }

  const handleEdit = (goal: Goal) => {
    setEditingId(goal.id)
    // Mapear período do banco para o frontend
    let periodValue = 'DAILY'
    if (goal.period === 'Semanal' || goal.period === 'WEEKLY') periodValue = 'WEEKLY'
    else if (goal.period === 'Mensal' || goal.period === 'MONTHLY') periodValue = 'MONTHLY'
    
    setFormData({
      type: goal.goalType,
      employeeId: goal.employee?.id || '',
      productId: goal.product?.id || '',
      teamId: goal.team?.id || '',
      targetQuantity: goal.targetQuantity.toString(),
      period: periodValue,
      startDate: goal.startDate.split('T')[0]
    })
    setShowDialog(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta meta?')) return

    try {
      const res = await fetch(`/api/production/goals/${id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        toast.success('Meta excluída com sucesso!')
        fetchData()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erro ao excluir meta')
      }
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao excluir meta')
    }
  }

  const resetForm = () => {
    setEditingId(null)
    setFormData({
      type: 'INDIVIDUAL',
      employeeId: '',
      productId: '',
      teamId: '',
      targetQuantity: '',
      period: 'DAILY',
      startDate: new Date().toISOString().split('T')[0]
    })
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Botão Nova Meta */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Metas de Produção</h2>
        <Button onClick={() => {
          resetForm()
          setShowDialog(true)
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Meta
        </Button>
      </div>

      {/* Lista de Metas */}
      <div className="grid gap-4">
        {goals.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              Nenhuma meta cadastrada
            </CardContent>
          </Card>
        ) : (
          goals.map((goal) => {
            // Calcular período display
            const periodDisplay = goal.period === 'Diária' || goal.period === 'DAILY' ? 'Diária' : 
                                  goal.period === 'Semanal' || goal.period === 'WEEKLY' ? 'Semanal' : 'Mensal'
            
            return (
              <Card key={goal.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-purple-100 rounded-full">
                        {goal.goalType === 'INDIVIDUAL' ? (
                          <Users className="h-6 w-6 text-purple-600" />
                        ) : goal.goalType === 'TEAM' ? (
                          <Users className="h-6 w-6 text-blue-600" />
                        ) : (
                          <Target className="h-6 w-6 text-green-600" />
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-lg">
                          {goal.goalType === 'INDIVIDUAL' && (goal.employee?.name || 'Funcionário não definido')}
                          {goal.goalType === 'TEAM' && (goal.team?.name || 'Meta de Equipe')}
                          {goal.goalType === 'PRODUCT' && (goal.product?.name || 'Produto não definido')}
                        </CardTitle>
                        <CardDescription>
                          {periodDisplay} - {goal.targetQuantity} unidades
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {goal.isActive ? (
                        <Badge variant="default">Ativa</Badge>
                      ) : (
                        <Badge variant="secondary">Inativa</Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(goal)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(goal.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    Meta: {goal.targetQuantity} unidades ({periodDisplay})
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Dialog Nova/Editar Meta */}
      <Dialog open={showDialog} onOpenChange={(open) => {
        setShowDialog(open)
        if (!open) resetForm()
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Meta' : 'Nova Meta de Produção'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Atualize os dados da meta' : 'Defina uma nova meta de produção'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Tipo de Meta *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value, employeeId: '', productId: '', teamId: '' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                    <SelectItem value="TEAM">Equipe</SelectItem>
                    <SelectItem value="PRODUCT">Por Produto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="period">Período *</Label>
                <Select
                  value={formData.period}
                  onValueChange={(value) => setFormData({ ...formData, period: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAILY">Diária</SelectItem>
                    <SelectItem value="WEEKLY">Semanal</SelectItem>
                    <SelectItem value="MONTHLY">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.type === 'INDIVIDUAL' && (
              <div className="space-y-2">
                <Label htmlFor="employeeId">Funcionário *</Label>
                <Select
                  value={formData.employeeId}
                  onValueChange={(value) => setFormData({ ...formData, employeeId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o funcionário" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.name} (#{employee.employeeNumber})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.type === 'TEAM' && (
              <div className="space-y-2">
                <Label htmlFor="teamId">Equipe *</Label>
                <Select
                  value={formData.teamId}
                  onValueChange={(value) => setFormData({ ...formData, teamId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a equipe" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.type === 'PRODUCT' && (
              <div className="space-y-2">
                <Label htmlFor="productId">Produto *</Label>
                <Select
                  value={formData.productId}
                  onValueChange={(value) => setFormData({ ...formData, productId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="targetQuantity">Meta de Quantidade *</Label>
                <Input
                  id="targetQuantity"
                  type="number"
                  min="1"
                  value={formData.targetQuantity}
                  onChange={(e) => setFormData({ ...formData, targetQuantity: e.target.value })}
                  placeholder="Ex: 750"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="startDate">Data de Início *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowDialog(false)
                  resetForm()
                }}
              >
                Cancelar
              </Button>
              <Button type="submit">
                {editingId ? 'Atualizar' : 'Salvar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
