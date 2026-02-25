"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Plus, Edit, Trash2, Eye, EyeOff, GripVertical, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface Highlight {
  id: string
  title: string
  description: string
  imageUrl: string | null
  buttonText: string | null
  buttonUrl: string | null
  isActive: boolean
  order: number
}

export default function DestaquesPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [editingHighlight, setEditingHighlight] = useState<Highlight | null>(null)
  const [deletingHighlight, setDeletingHighlight] = useState<Highlight | null>(null)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    imageUrl: "",
    buttonText: "",
    buttonUrl: "",
    isActive: true,
    order: 0,
  })

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login")
    } else if (status === "authenticated" && (session?.user as any)?.userType !== "ADMIN") {
      router.push("/")
    }
  }, [status, session, router])

  useEffect(() => {
    fetchHighlights()
  }, [])

  const fetchHighlights = async () => {
    try {
      const response = await fetch("/api/admin/highlights")
      if (response.ok) {
        const data = await response.json()
        setHighlights(data)
      }
    } catch (error) {
      console.error("Erro ao buscar destaques:", error)
      toast.error("Erro ao carregar destaques")
    } finally {
      setLoading(false)
    }
  }

  const handleNew = () => {
    setEditingHighlight(null)
    setFormData({
      title: "",
      description: "",
      imageUrl: "",
      buttonText: "",
      buttonUrl: "",
      isActive: true,
      order: highlights.length,
    })
    setShowDialog(true)
  }

  const handleEdit = (highlight: Highlight) => {
    setEditingHighlight(highlight)
    setFormData({
      title: highlight.title,
      description: highlight.description,
      imageUrl: highlight.imageUrl || "",
      buttonText: highlight.buttonText || "",
      buttonUrl: highlight.buttonUrl || "",
      isActive: highlight.isActive,
      order: highlight.order,
    })
    setShowDialog(true)
  }

  const handleSave = async () => {
    if (!formData.title || !formData.description) {
      toast.error("Título e descrição são obrigatórios")
      return
    }

    setSaving(true)
    try {
      const url = editingHighlight
        ? `/api/admin/highlights/${editingHighlight.id}`
        : "/api/admin/highlights"
      const method = editingHighlight ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast.success(editingHighlight ? "Destaque atualizado" : "Destaque criado")
        setShowDialog(false)
        fetchHighlights()
      } else {
        toast.error("Erro ao salvar destaque")
      }
    } catch (error) {
      console.error("Erro ao salvar:", error)
      toast.error("Erro ao salvar destaque")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingHighlight) return

    try {
      const response = await fetch(`/api/admin/highlights/${deletingHighlight.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast.success("Destaque excluído")
        setDeletingHighlight(null)
        fetchHighlights()
      } else {
        toast.error("Erro ao excluir destaque")
      }
    } catch (error) {
      console.error("Erro ao excluir:", error)
      toast.error("Erro ao excluir destaque")
    }
  }

  const toggleActive = async (highlight: Highlight) => {
    try {
      const response = await fetch(`/api/admin/highlights/${highlight.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...highlight, isActive: !highlight.isActive }),
      })

      if (response.ok) {
        toast.success(highlight.isActive ? "Destaque desativado" : "Destaque ativado")
        fetchHighlights()
      }
    } catch (error) {
      console.error("Erro ao alternar status:", error)
      toast.error("Erro ao alterar status")
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => router.push("/admin")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Destaques da Página Inicial</h1>
                <p className="text-sm text-gray-600">Gerencie os destaques exibidos na página inicial</p>
              </div>
            </div>
            <Button onClick={handleNew} className="bg-red-600 hover:bg-red-700">
              <Plus className="w-4 h-4 mr-2" />
              Novo Destaque
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {highlights.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500 mb-4">Nenhum destaque cadastrado</p>
              <Button onClick={handleNew}>
                <Plus className="w-4 h-4 mr-2" />
                Criar primeiro destaque
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {highlights.map((highlight) => (
              <Card key={highlight.id} className={!highlight.isActive ? "opacity-60" : ""}>
                <CardContent className="py-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 text-gray-400">
                      <GripVertical className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">{highlight.title}</h3>
                        <Badge variant={highlight.isActive ? "default" : "secondary"}>
                          {highlight.isActive ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      <p className="text-gray-600 text-sm mb-2">{highlight.description}</p>
                      {highlight.buttonText && (
                        <p className="text-xs text-gray-500">
                          Botão: {highlight.buttonText} → {highlight.buttonUrl || "Sem link"}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActive(highlight)}
                        title={highlight.isActive ? "Desativar" : "Ativar"}
                      >
                        {highlight.isActive ? (
                          <Eye className="w-4 h-4 text-green-600" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-gray-400" />
                        )}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(highlight)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingHighlight(highlight)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialog de Edição/Criação */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingHighlight ? "Editar Destaque" : "Novo Destaque"}
            </DialogTitle>
            <DialogDescription>
              Preencha as informações do destaque que aparecerá na página inicial
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Churrasqueira em Comodato"
              />
            </div>
            <div>
              <Label htmlFor="description">Descrição *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ex: Emprestamos uma churrasqueira para você começar a assar seus espetinhos hoje mesmo!"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="imageUrl">URL da Imagem (opcional)</Label>
              <Input
                id="imageUrl"
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                placeholder="https://wpmanageninja.com/wp-content/uploads/2023/03/Editor-Fluentform-19.png"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="buttonText">Texto do Botão (opcional)</Label>
                <Input
                  id="buttonText"
                  value={formData.buttonText}
                  onChange={(e) => setFormData({ ...formData, buttonText: e.target.value })}
                  placeholder="Ex: Saiba mais"
                />
              </div>
              <div>
                <Label htmlFor="buttonUrl">Link do Botão (opcional)</Label>
                <Input
                  id="buttonUrl"
                  value={formData.buttonUrl}
                  onChange={(e) => setFormData({ ...formData, buttonUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label>Destaque ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-red-600 hover:bg-red-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editingHighlight ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={!!deletingHighlight} onOpenChange={() => setDeletingHighlight(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Destaque</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o destaque "{deletingHighlight?.title}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
