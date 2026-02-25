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
import { Plus, Edit, Trash2, TrendingUp, Users, Package, BarChart3 } from 'lucide-react'

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
  date: string
  shift?: string
  quantity: number
  notes?: string
  employee?: {
    id: string
    name: string
    employeeNumber: number
  }
  product?: {
    id: string
    name: string
    category: string
    imageUrl?: string
  }
}

interface ProductionStats {
  totalProduction: number
  totalEmployees: number
  averagePerEmployee: number
  topProducts: Array<{
    productId: string
    productName: string
    totalQuantity: number
  }>
}

export function ProductionTab() {
  const [records, setRecords] = useState<ProductionRecord[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [stats, setStats] = useState<ProductionStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    employeeId: '',
    productId: '',
    quantity: '',
    date: '', // Inicializado vazio para evitar hidratação mismatch
    shift: 'MORNING',
    notes: ''
  })

  // Inicializar data apenas no client-side
  useEffect(() => {
    // Definir data atual apenas no cliente
    if (!formData.date) {
      const today = new Date().toISOString().split('T')[0]
      setFormData(prev => ({ ...prev, date: today }))
    }
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      // Usar data do cliente de forma segura
      const today = typeof window !== 'undefined' ? new Date().toISOString().split('T')[0] : '2025-01-01'
      
      const [recordsRes, employeesRes, productsRes, statsRes] = await Promise.all([
        fetch('/api/production/records'),
        fetch('/api/hr/employees'), // Rota correta de funcionários
        fetch('/api/products'),
        fetch(`/api/production/stats?period=DAILY&date=${today}`)
      ])

      if (recordsRes.ok) {
        const data = await recordsRes.json()
        console.log('[PRODUCTION] Registros carregados:', data.records?.length || 0)
        setRecords(data.records || [])
      } else {
        console.error('[PRODUCTION] Erro ao buscar registros:', employeesRes.status)
      }
      
      if (employeesRes.ok) {
        const data = await employeesRes.json()
        console.log('[PRODUCTION] Funcionários carregados:', data.length)
        setEmployees(data || []) // API retorna array direto, não objeto com .employees
      } else {
        console.error('[PRODUCTION] Erro ao buscar funcionários:', employeesRes.status)
      }
      
      if (productsRes.ok) {
        const data = await productsRes.json()
        console.log('[PRODUCTION] Produtos carregados:', data.length)
        setProducts(data || [])
      } else {
        console.error('[PRODUCTION] Erro ao buscar produtos:', productsRes.status)
      }
      
      if (statsRes.ok) {
        const data = await statsRes.json()
        console.log('[PRODUCTION] Stats carregadas:', !!data.stats)
        setStats(data.stats)
      } else {
        console.error('[PRODUCTION] Erro ao buscar stats:', statsRes.status)
      }
    } catch (error) {
      console.error('[PRODUCTION] Erro ao carregar dados:', error)
      toast.error('Erro ao carregar dados de produção')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.employeeId || !formData.productId || !formData.quantity) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }

    try {
      const url = editingId
        ? `/api/production/records/${editingId}`
        : '/api/production/records'

      const method = editingId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          quantity: parseInt(formData.quantity)
        })
      })

      const data = await res.json()

      if (res.ok) {
        toast.success(data.message || 'Registro salvo com sucesso!')
        setShowDialog(false)
        resetForm()
        fetchData()
      } else {
        // Mostrar erro detalhado se disponível
        const errorMessage = data.error || 'Erro ao salvar registro'
        const errorDetails = data.details ? `\n\n${data.details}` : ''
        toast.error(errorMessage + errorDetails, {
          duration: 8000, // 8 segundos para dar tempo de ler
          style: { maxWidth: '500px' }
        })
      }
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao salvar registro')
    }
  }

  const handleEdit = (record: ProductionRecord) => {
    setEditingId(record.id)
    setFormData({
      employeeId: record.employee?.id || '',
      productId: record.product?.id || '',
      quantity: record.quantity.toString(),
      date: record.date.split('T')[0],
      shift: record.shift || 'MORNING',
      notes: record.notes || ''
    })
    setShowDialog(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este registro?')) return

    try {
      const res = await fetch(`/api/production/records/${id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        toast.success('Registro excluído com sucesso!')
        fetchData()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erro ao excluir registro')
      }
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao excluir registro')
    }
  }

  const resetForm = () => {
    setEditingId(null)
    // Usar data do cliente de forma segura
    const today = typeof window !== 'undefined' ? new Date().toISOString().split('T')[0] : ''
    setFormData({
      employeeId: '',
      productId: '',
      quantity: '',
      date: today,
      shift: 'MORNING',
      notes: ''
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
      {/* Estatísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Produção Hoje</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Package className="h-8 w-8 text-blue-600" />
                <span className="text-3xl font-bold">{stats.totalProduction}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Funcionários Ativos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-8 w-8 text-green-600" />
                <span className="text-3xl font-bold">{stats.totalEmployees}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Média por Funcionário</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-8 w-8 text-purple-600" />
                <span className="text-3xl font-bold">{Math.round(stats.averagePerEmployee)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Botão Novo Registro */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Registros de Produção</h2>
        <Button onClick={() => {
          resetForm()
          setShowDialog(true)
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Registro
        </Button>
      </div>

      {/* Tabela de Registros */}
      <Card>
        <CardContent className="p-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Funcionário</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Quantidade</TableHead>
                <TableHead>Turno</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nenhum registro encontrado
                  </TableCell>
                </TableRow>
              ) : (
                records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{new Date(record.date).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>{record.employee?.name || 'N/A'}</TableCell>
                    <TableCell>{record.product?.name || 'N/A'}</TableCell>
                    <TableCell className="font-semibold">{record.quantity}</TableCell>
                    <TableCell>
                      {record.shift === 'MORNING' ? 'Manhã' : 
                       record.shift === 'AFTERNOON' ? 'Tarde' : 
                       record.shift === 'NIGHT' ? 'Noite' : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(record)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(record.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog Novo/Editar Registro */}
      <Dialog open={showDialog} onOpenChange={(open) => {
        setShowDialog(open)
        if (!open) resetForm()
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Registro' : 'Novo Registro de Produção'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Atualize os dados do registro' : 'Registre a produção de um funcionário'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
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
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantidade *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  placeholder="Ex: 500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Data *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="shift">Turno</Label>
                <Select
                  value={formData.shift}
                  onValueChange={(value) => setFormData({ ...formData, shift: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MORNING">Manhã</SelectItem>
                    <SelectItem value="AFTERNOON">Tarde</SelectItem>
                    <SelectItem value="NIGHT">Noite</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Observações adicionais"
                rows={3}
              />
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
