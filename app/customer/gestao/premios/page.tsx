'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { 
  Gift, 
  Plus, 
  Edit, 
  Trash2, 
  Loader2,
  Image as ImageIcon,
  Award,
  Package,
  AlertCircle,
  Star
} from 'lucide-react'
import { toast } from 'sonner'

interface Prize {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  pointsCost: number
  stockQuantity: number | null
  isActive: boolean
  category: string | null
  displayOrder: number
}

export default function PrizesManagementPage() {
  const router = useRouter()
  
  const [prizes, setPrizes] = useState<Prize[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingPrize, setEditingPrize] = useState<Prize | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    imageUrl: '',
    pointsCost: '',
    stockQuantity: '',
    category: '',
    displayOrder: '0',
    isActive: true
  })

  useEffect(() => {
    loadPrizes()
  }, [])

  const loadPrizes = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/customer/prizes')
      
      if (!response.ok) {
        throw new Error('Erro ao carregar prêmios')
      }

      const data = await response.json()
      setPrizes(data.prizes || [])

    } catch (error) {
      console.error('Erro ao carregar prêmios:', error)
      toast.error('Erro ao carregar prêmios')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenDialog = (prize?: Prize) => {
    if (prize) {
      setEditingPrize(prize)
      setFormData({
        name: prize.name,
        description: prize.description || '',
        imageUrl: prize.imageUrl || '',
        pointsCost: prize.pointsCost.toString(),
        stockQuantity: prize.stockQuantity?.toString() || '',
        category: prize.category || '',
        displayOrder: prize.displayOrder.toString(),
        isActive: prize.isActive
      })
    } else {
      setEditingPrize(null)
      setFormData({
        name: '',
        description: '',
        imageUrl: '',
        pointsCost: '',
        stockQuantity: '',
        category: '',
        displayOrder: '0',
        isActive: true
      })
    }
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingPrize(null)
  }

  const handleSavePrize = async () => {
    try {
      if (!formData.name || !formData.pointsCost) {
        toast.error('Nome e custo em pontos são obrigatórios')
        return
      }

      setIsSaving(true)

      const url = editingPrize 
        ? `/api/customer/prizes/${editingPrize.id}`
        : '/api/customer/prizes'
      
      const method = editingPrize ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          imageUrl: formData.imageUrl || null,
          pointsCost: parseInt(formData.pointsCost),
          stockQuantity: formData.stockQuantity ? parseInt(formData.stockQuantity) : null,
          category: formData.category || null,
          displayOrder: parseInt(formData.displayOrder),
          isActive: formData.isActive
        })
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || 'Erro ao salvar prêmio')
        return
      }

      toast.success(editingPrize ? 'Prêmio atualizado com sucesso!' : 'Prêmio criado com sucesso!')
      handleCloseDialog()
      loadPrizes()

    } catch (error) {
      console.error('Erro ao salvar prêmio:', error)
      toast.error('Erro ao salvar prêmio')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeletePrize = async (prizeId: string) => {
    if (!confirm('Tem certeza que deseja excluir este prêmio?')) {
      return
    }

    try {
      setIsDeleting(prizeId)

      const response = await fetch(`/api/customer/prizes/${prizeId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || 'Erro ao excluir prêmio')
        return
      }

      toast.success('Prêmio excluído com sucesso!')
      loadPrizes()

    } catch (error) {
      console.error('Erro ao excluir prêmio:', error)
      toast.error('Erro ao excluir prêmio')
    } finally {
      setIsDeleting(null)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-orange-600 mx-auto" />
          <p className="text-gray-600">Carregando prêmios...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Gift className="w-8 h-8 text-orange-600" />
            Gestão de Prêmios
          </h1>
          <p className="text-gray-600 mt-2">
            Cadastre prêmios para seus clientes resgatarem com pontos
          </p>
        </div>
        <Button
          onClick={() => handleOpenDialog()}
          className="bg-orange-600 hover:bg-orange-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Prêmio
        </Button>
      </div>

      {/* Lista de Prêmios */}
      {prizes.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <Award className="w-16 h-16 text-gray-300 mx-auto" />
              <div>
                <p className="text-gray-600 font-medium">Nenhum prêmio cadastrado</p>
                <p className="text-sm text-gray-500">Crie seu primeiro prêmio para começar</p>
              </div>
              <Button
                onClick={() => handleOpenDialog()}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Criar Prêmio
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {prizes.map((prize) => (
            <Card key={prize.id} className={`border-2 ${prize.isActive ? 'border-orange-100' : 'border-gray-200 opacity-60'}`}>
              <CardContent className="p-4 space-y-4">
                {/* Imagem */}
                {prize.imageUrl ? (
                  <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
                    <Image
                      src={prize.imageUrl}
                      alt={prize.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-gradient-to-br from-orange-100 to-red-100 rounded-lg flex items-center justify-center">
                    <ImageIcon className="w-12 h-12 text-orange-400" />
                  </div>
                )}

                {/* Informações */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-gray-900 line-clamp-2">{prize.name}</h3>
                    {!prize.isActive && (
                      <Badge variant="secondary" className="text-xs">Inativo</Badge>
                    )}
                  </div>

                  {prize.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">{prize.description}</p>
                  )}

                  {prize.category && (
                    <Badge variant="outline" className="text-xs">{prize.category}</Badge>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-1 text-orange-600">
                      <Star className="w-5 h-5 fill-current" />
                      <span className="font-bold text-lg">{prize.pointsCost}</span>
                      <span className="text-xs">pontos</span>
                    </div>
                    {prize.stockQuantity !== null && (
                      <div className="flex items-center gap-1 text-gray-600 text-sm">
                        <Package className="w-4 h-4" />
                        <span>{prize.stockQuantity}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ações */}
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    onClick={() => handleOpenDialog(prize)}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Editar
                  </Button>
                  <Button
                    onClick={() => handleDeletePrize(prize.id)}
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    disabled={isDeleting === prize.id}
                  >
                    {isDeleting === prize.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Diálogo de Criação/Edição */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPrize ? 'Editar Prêmio' : 'Novo Prêmio'}
            </DialogTitle>
            <DialogDescription>
              Preencha as informações do prêmio que seus clientes poderão resgatar
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Nome */}
            <div>
              <Label>Nome do Prêmio *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Vale R$ 50,00 em produtos"
              />
            </div>

            {/* Descrição */}
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descreva o prêmio..."
                rows={3}
              />
            </div>

            {/* URL da Imagem */}
            <div>
              <Label>URL da Imagem</Label>
              <Input
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                placeholder="https://upload.wikimedia.org/wikipedia/commons/1/16/The_prize_moviep.jpg"
              />
              <p className="text-xs text-gray-500 mt-1">
                Cole a URL de uma imagem do prêmio
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Custo em Pontos */}
              <div>
                <Label>Custo em Pontos *</Label>
                <Input
                  type="number"
                  value={formData.pointsCost}
                  onChange={(e) => setFormData({ ...formData, pointsCost: e.target.value })}
                  placeholder="100"
                  min="1"
                />
              </div>

              {/* Quantidade em Estoque */}
              <div>
                <Label>Quantidade em Estoque</Label>
                <Input
                  type="number"
                  value={formData.stockQuantity}
                  onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })}
                  placeholder="Deixe vazio para ilimitado"
                  min="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Categoria */}
              <div>
                <Label>Categoria</Label>
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="Ex: Produtos, Descontos"
                />
              </div>

              {/* Ordem de Exibição */}
              <div>
                <Label>Ordem de Exibição</Label>
                <Input
                  type="number"
                  value={formData.displayOrder}
                  onChange={(e) => setFormData({ ...formData, displayOrder: e.target.value })}
                  placeholder="0"
                  min="0"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Menor número aparece primeiro
                </p>
              </div>
            </div>

            {/* Ativo */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label>Prêmio Ativo</Label>
                <p className="text-sm text-gray-500">Prêmios inativos não aparecem para os clientes</p>
              </div>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
            </div>

            {/* Botões */}
            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleCloseDialog}
                variant="outline"
                className="flex-1"
                disabled={isSaving}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSavePrize}
                className="flex-1 bg-orange-600 hover:bg-orange-700"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  editingPrize ? 'Atualizar' : 'Criar'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
