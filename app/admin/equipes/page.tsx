'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Plus, Edit, Trash2, Users, Home, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function EquipesPage() {
  const router = useRouter()
  const [teams, setTeams] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingTeam, setEditingTeam] = useState<any>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    leaderId: '',
    memberIds: [] as string[]
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      const [teamsRes, empRes] = await Promise.all([
        fetch('/api/production/teams'),
        fetch('/api/hr/employees')
      ])

      const teamsData = await teamsRes.json()
      const empData = await empRes.json()

      setTeams(teamsData.teams || [])
      setEmployees(empData.employees || [])
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name) {
      toast.error('Nome da equipe é obrigatório')
      return
    }

    try {
      const url = editingTeam 
        ? `/api/production/teams/${editingTeam.id}`
        : '/api/production/teams'
      
      const method = editingTeam ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!res.ok) throw new Error('Erro ao salvar')

      toast.success(editingTeam ? 'Equipe atualizada!' : 'Equipe criada!')
      setShowDialog(false)
      resetForm()
      fetchData()
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao salvar equipe')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta equipe?')) return

    try {
      const res = await fetch(`/api/production/teams/${id}`, {
        method: 'DELETE'
      })

      if (!res.ok) throw new Error('Erro ao excluir')

      toast.success('Equipe excluída!')
      fetchData()
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao excluir equipe')
    }
  }

  const openEditDialog = (team: any) => {
    setEditingTeam(team)
    setFormData({
      name: team.name,
      description: team.description || '',
      leaderId: team.leaderId || '',
      memberIds: team.members?.map((m: any) => m.employeeId) || []
    })
    setShowDialog(true)
  }

  const resetForm = () => {
    setEditingTeam(null)
    setFormData({
      name: '',
      description: '',
      leaderId: '',
      memberIds: []
    })
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
            <Users className="h-8 w-8 text-blue-600" />
            Equipes de Produção
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie equipes e seus membros
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
              <CardTitle>Equipes Cadastradas</CardTitle>
              <CardDescription>
                Total: {teams.length} equipes
              </CardDescription>
            </div>
            <Button onClick={() => { resetForm(); setShowDialog(true) }}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Equipe
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome da Equipe</TableHead>
                <TableHead>Líder</TableHead>
                <TableHead className="text-center">Membros</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhuma equipe cadastrada
                  </TableCell>
                </TableRow>
              ) : (
                teams.map((team) => (
                  <TableRow key={team.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{team.name}</p>
                        <p className="text-xs text-muted-foreground">{team.description}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {team.leader ? team.leader.name : <span className="text-muted-foreground">Sem líder</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">
                        {team._count?.members || 0} membros
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={team.isActive ? 'default' : 'secondary'}>
                        {team.isActive ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex gap-2 justify-center">
                        <Button size="sm" variant="outline" onClick={() => openEditDialog(team)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(team.id)}>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTeam ? 'Editar Equipe' : 'Nova Equipe'}</DialogTitle>
            <DialogDescription>Preencha os dados da equipe</DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Equipe *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="Ex: Equipe Manhã"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Descrição da equipe..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingTeam ? 'Salvar Alterações' : 'Criar Equipe'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
