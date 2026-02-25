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
import { Textarea } from '@/components/ui/textarea'
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
import { Plus, Edit, Trash2, Target, Home, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function MetasPage() {
  const router = useRouter()
  const [goals, setGoals] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [teams, setTeams] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingGoal, setEditingGoal] = useState<any>(null)
  
  const [formData, setFormData] = useState({
    goalType: 'INDIVIDUAL',
    employeeId: '',
    teamId: '',
    productId: '',
    targetQuantity: '',
    period: 'DAILY',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    bonusAmount: '',
    bonusType: '',
    notes: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      const [goalsRes, empRes, teamsRes, prodRes] = await Promise.all([
        fetch('/api/production/goals'),
        fetch('/api/hr/employees'),
        fetch('/api/production/teams'),
        fetch('/api/products')
      ])

      const goalsData = await goalsRes.json()
      const empData = await empRes.json()
      const teamsData = await teamsRes.json()
      const prodData = await prodRes.json()

      setGoals(goalsData.goals || [])
      setEmployees(empData.employees || [])
      setTeams(teamsData.teams || [])
      setProducts(prodData || [])
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao carregar dados')
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

    if (formData.goalType === 'INDIVIDUAL' && !formData.employeeId) {
      toast.error('Selecione um funcionário para meta individual')
      return
    }

    if (formData.goalType === 'TEAM' && !formData.teamId) {
      toast.error('Selecione uma equipe para meta de equipe')
      return
    }

    try {
      const url = editingGoal 
        ? `/api/production/goals/${editingGoal.id}`
        : '/api/production/goals'
      
      const method = editingGoal ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!res.ok) throw new Error('Erro ao salvar')

      toast.success(editingGoal ? 'Meta atualizada!' : 'Meta criada!')
      setShowDialog(false)
      resetForm()
      fetchData()
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao salvar meta')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta meta?')) return

    try {
      const res = await fetch(`/api/production/goals/${id}`, {
        method: 'DELETE'
      })

      if (!res.ok) throw new Error('Erro ao excluir')

      toast.success('Meta excluída!')
      fetchData()
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao excluir meta')
    }
  }

  const openEditDialog = (goal: any) => {
    setEditingGoal(goal)
    setFormData({
      goalType: goal.goalType,
      employeeId: goal.employeeId || '',
      teamId: goal.teamId || '',
      productId: goal.productId || '',
      targetQuantity: goal.targetQuantity.toString(),
      period: goal.period,
      startDate: goal.startDate.split('T')[0],
      endDate: goal.endDate ? goal.endDate.split('T')[0] : '',
      bonusAmount: goal.bonusAmount?.toString() || '',
      bonusType: goal.bonusType || '',
      notes: goal.notes || ''
    })
    setShowDialog(true)
  }

  const resetForm = () => {
    setEditingGoal(null)
    setFormData({
      goalType: 'INDIVIDUAL',
      employeeId: '',
      teamId: '',
      productId: '',
      targetQuantity: '',
      period: 'DAILY',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      bonusAmount: '',
      bonusType: '',
      notes: ''
    })
  }

  const getPeriodLabel = (period: string) => {
    const labels: any = {
      DAILY: 'Diário',
      WEEKLY: 'Semanal',
      MONTHLY: 'Mensal',
      QUARTERLY: 'Trimestral',
      CUSTOM: 'Personalizado'
    }
    return labels[period] || period
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Target className="h-8 w-8 text-blue-600" />
            Metas de Produção
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie metas individuais e por equipe
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/admin')}>
            <Home className="h-4 w-4 mr-2" />
            Página Inicial
          </Button>
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Metas Cadastradas</CardTitle>
              <CardDescription>
                Total: {goals.length} metas
              </CardDescription>
            </div>
            <Button onClick={() => { resetForm(); setShowDialog(true) }}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Meta
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Alvo</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Meta</TableHead>
                <TableHead>Período</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {goals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhuma meta cadastrada
                  </TableCell>
                </TableRow>
              ) : (
                goals.map((goal) => (
                  <TableRow key={goal.id}>
                    <TableCell>
                      <Badge variant={goal.goalType === 'INDIVIDUAL' ? 'default' : 'secondary'}>
                        {goal.goalType === 'INDIVIDUAL' ? 'Individual' : 'Equipe'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {goal.employee?.name || goal.team?.name || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {goal.product?.name || <span className="text-muted-foreground">Geral</span>}
                    </TableCell>
                    <TableCell className="text-right font-bold text-blue-600">
                      {goal.targetQuantity} un
                    </TableCell>
                    <TableCell>
                      {getPeriodLabel(goal.period)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={goal.isActive ? 'default' : 'secondary'}>
                        {goal.isActive ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex gap-2 justify-center">
                        <Button size="sm" variant="outline" onClick={() => openEditDialog(goal)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(goal.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingGoal ? 'Editar Meta' : 'Nova Meta'}</DialogTitle>
            <DialogDescription>Preencha os dados da meta de produção</DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Meta *</Label>
                <Select
                  value={formData.goalType}
                  onValueChange={(value) => setFormData({...formData, goalType: value, employeeId: '', teamId: ''})}
                  disabled={!!editingGoal}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                    <SelectItem value="TEAM">Equipe</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.goalType === 'INDIVIDUAL' && (
                <div className="space-y-2">
                  <Label>Funcionário *</Label>
                  <Select
                    value={formData.employeeId}
                    onValueChange={(value) => setFormData({...formData, employeeId: value})}
                    disabled={!!editingGoal}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.goalType === 'TEAM' && (
                <div className="space-y-2">
                  <Label>Equipe *</Label>
                  <Select
                    value={formData.teamId}
                    onValueChange={(value) => setFormData({...formData, teamId: value})}
                    disabled={!!editingGoal}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map(team => (
                        <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Produto (opcional)</Label>
                <Select
                  value={formData.productId}
                  onValueChange={(value) => setFormData({...formData, productId: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os produtos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos os produtos</SelectItem>
                    {products.map(prod => (
                      <SelectItem key={prod.id} value={prod.id}>{prod.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Meta de Quantidade *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.targetQuantity}
                  onChange={(e) => setFormData({...formData, targetQuantity: e.target.value})}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label>Período *</Label>
                <Select
                  value={formData.period}
                  onValueChange={(value) => setFormData({...formData, period: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAILY">Diário</SelectItem>
                    <SelectItem value="WEEKLY">Semanal</SelectItem>
                    <SelectItem value="MONTHLY">Mensal</SelectItem>
                    <SelectItem value="QUARTERLY">Trimestral</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data de Início *</Label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label>Data de Término</Label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="Observações sobre a meta..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingGoal ? 'Salvar Alterações' : 'Criar Meta'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
