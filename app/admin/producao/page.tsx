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
import { Plus, Edit, Trash2, TrendingUp, Users, Package, BarChart3, Home, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

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
  imageUrl?: string
}

interface ProductionRecord {
  id: string
  employee: Employee
  product: Product
  quantity: number
  date: string
  shift: string
  notes?: string
  qualityScore?: number
  rejectedQty?: number
}

export default function ProducaoPage() {
  const router = useRouter()
  const [records, setRecords] = useState<ProductionRecord[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingRecord, setEditingRecord] = useState<ProductionRecord | null>(null)
  
  const [formData, setFormData] = useState({
    employeeId: '',
    productId: '',
    quantity: '',
    date: new Date().toISOString().split('T')[0],
    shift: 'FULL_DAY',
    notes: '',
    qualityScore: '',
    rejectedQty: ''
  })

  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    fetchData()
    fetchStats()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Buscar funcionários
      const empRes = await fetch('/api/hr/employees')
      const empData = await empRes.json()
      setEmployees(empData.employees || [])

      // Buscar produtos
      const prodRes = await fetch('/api/products')
      const prodData = await prodRes.json()
      setProducts(prodData || [])

      // Buscar registros de produção (últimos 7 dias)
      const today = new Date()
      const weekAgo = new Date(today)
      weekAgo.setDate(weekAgo.getDate() - 7)
      
      const recordsRes = await fetch(
        `/api/production/records?startDate=${weekAgo.toISOString().split('T')[0]}&endDate=${today.toISOString().split('T')[0]}&limit=100`
      )
      const recordsData = await recordsRes.json()
      setRecords(recordsData.records || [])

    } catch (error) {
      console.error('Erro ao buscar dados:', error)
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const res = await fetch(`/api/production/stats?period=DAILY&date=${today}`)
      const data = await res.json()
      setStats(data)
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.employeeId || !formData.productId || !formData.quantity) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }

    try {
      const url = editingRecord 
        ? `/api/production/records/${editingRecord.id}`
        : '/api/production/records'
      
      const method = editingRecord ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!res.ok) throw new Error('Erro ao salvar registro')

      toast.success(editingRecord ? 'Registro atualizado!' : 'Registro criado!')
      setShowDialog(false)
      resetForm()
      fetchData()
      fetchStats()
    } catch (error) {
      console.error('Erro ao salvar registro:', error)
      toast.error('Erro ao salvar registro')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este registro?')) return

    try {
      const res = await fetch(`/api/production/records/${id}`, {
        method: 'DELETE'
      })

      if (!res.ok) throw new Error('Erro ao excluir')

      toast.success('Registro excluído!')
      fetchData()
      fetchStats()
    } catch (error) {
      console.error('Erro ao excluir:', error)
      toast.error('Erro ao excluir registro')
    }
  }

  const openEditDialog = (record: ProductionRecord) => {
    setEditingRecord(record)
    setFormData({
      employeeId: record.employee.id,
      productId: record.product.id,
      quantity: record.quantity.toString(),
      date: record.date.split('T')[0],
      shift: record.shift,
      notes: record.notes || '',
      qualityScore: record.qualityScore?.toString() || '',
      rejectedQty: record.rejectedQty?.toString() || ''
    })
    setShowDialog(true)
  }

  const resetForm = () => {
    setEditingRecord(null)
    setFormData({
      employeeId: '',
      productId: '',
      quantity: '',
      date: new Date().toISOString().split('T')[0],
      shift: 'FULL_DAY',
      notes: '',
      qualityScore: '',
      rejectedQty: ''
    })
  }

  const getShiftLabel = (shift: string) => {
    const labels: any = {
      MORNING: '☀️ Manhã',
      AFTERNOON: '🌤️ Tarde',
      NIGHT: '🌙 Noite',
      FULL_DAY: '📅 Dia Completo'
    }
    return labels[shift] || shift
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Package className="h-8 w-8 text-blue-600" />
            Controle de Produção
          </h1>
          <p className="text-muted-foreground mt-1">
            Registre e acompanhe a produção diária dos funcionários
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/admin')}
          >
            <Home className="h-4 w-4 mr-2" />
            Página Inicial
          </Button>
          <Button
            variant="outline"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>
      </div>

      {/* Estatísticas do Dia */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Produção Hoje</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.summary.totalProduced}</div>
              <p className="text-xs text-muted-foreground">unidades produzidas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Funcionários Ativos</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.byEmployee.length}</div>
              <p className="text-xs text-muted-foreground">trabalhando hoje</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Média por Funcionário</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.byEmployee.length > 0 
                  ? Math.round(stats.summary.totalProduced / stats.byEmployee.length)
                  : 0}
              </div>
              <p className="text-xs text-muted-foreground">unidades/funcionário</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Qualidade Média</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.summary.averageQuality ? stats.summary.averageQuality.toFixed(1) : 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground">de 0 a 10</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Botão Novo Registro */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Registros de Produção</CardTitle>
              <CardDescription>Últimos 7 dias de produção</CardDescription>
            </div>
            <Button onClick={() => { resetForm(); setShowDialog(true) }}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Registro
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead>Turno</TableHead>
                  <TableHead className="text-center">Qualidade</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum registro encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        {new Date(record.date).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{record.employee.name}</p>
                          <p className="text-xs text-muted-foreground">
                            #{record.employee.employeeNumber} - {record.employee.position}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{record.product.name}</p>
                          <p className="text-xs text-muted-foreground">{record.product.category}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-green-600">
                        {record.quantity} un
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getShiftLabel(record.shift)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {record.qualityScore ? (
                          <Badge 
                            variant={record.qualityScore >= 8 ? 'default' : record.qualityScore >= 6 ? 'secondary' : 'destructive'}
                          >
                            {record.qualityScore.toFixed(1)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex gap-2 justify-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDialog(record)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(record.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Registro */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRecord ? 'Editar Registro de Produção' : 'Novo Registro de Produção'}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados da produção realizada
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Funcionário */}
              <div className="space-y-2">
                <Label htmlFor="employeeId">Funcionário *</Label>
                <Select
                  value={formData.employeeId}
                  onValueChange={(value) => setFormData({...formData, employeeId: value})}
                  disabled={!!editingRecord}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o funcionário" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name} (#{emp.employeeNumber})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Produto */}
              <div className="space-y-2">
                <Label htmlFor="productId">Produto *</Label>
                <Select
                  value={formData.productId}
                  onValueChange={(value) => setFormData({...formData, productId: value})}
                  disabled={!!editingRecord}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map(prod => (
                      <SelectItem key={prod.id} value={prod.id}>
                        {prod.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Quantidade */}
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantidade Produzida *</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.quantity}
                  onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                  placeholder="0"
                />
              </div>

              {/* Data */}
              <div className="space-y-2">
                <Label htmlFor="date">Data *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                />
              </div>

              {/* Turno */}
              <div className="space-y-2">
                <Label htmlFor="shift">Turno</Label>
                <Select
                  value={formData.shift}
                  onValueChange={(value) => setFormData({...formData, shift: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FULL_DAY">📅 Dia Completo</SelectItem>
                    <SelectItem value="MORNING">☀️ Manhã</SelectItem>
                    <SelectItem value="AFTERNOON">🌤️ Tarde</SelectItem>
                    <SelectItem value="NIGHT">🌙 Noite</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Qualidade */}
              <div className="space-y-2">
                <Label htmlFor="qualityScore">Pontuação de Qualidade (0-10)</Label>
                <Input
                  id="qualityScore"
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={formData.qualityScore}
                  onChange={(e) => setFormData({...formData, qualityScore: e.target.value})}
                  placeholder="0.0"
                />
              </div>

              {/* Quantidade Rejeitada */}
              <div className="space-y-2">
                <Label htmlFor="rejectedQty">Quantidade Rejeitada</Label>
                <Input
                  id="rejectedQty"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.rejectedQty}
                  onChange={(e) => setFormData({...formData, rejectedQty: e.target.value})}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="Adicione observações sobre a produção..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDialog(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">
                {editingRecord ? 'Salvar Alterações' : 'Criar Registro'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
