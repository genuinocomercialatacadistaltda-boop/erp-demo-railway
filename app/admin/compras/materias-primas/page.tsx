
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
// Dialog substituído por modal customizado
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
import { ArrowLeft, Plus, Edit, Trash2, Package, AlertTriangle } from "lucide-react"
import { toast } from "sonner"

interface RawMaterial {
  id: string
  name: string
  sku: string | null
  description: string | null
  measurementUnit: string
  currentStock: number
  minStock: number | null
  costPerUnit: number | null
  categoryId: string | null
  isActive: boolean
  Category?: {
    id: string
    name: string
    color: string
  }
  createdAt: string
}

interface Category {
  id: string
  name: string
  color: string
}

export default function MateriasPrimasPage() {
  const router = useRouter()
  const { data: session, status } = useSession() || {}
  
  const [materials, setMaterials] = useState<RawMaterial[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState<RawMaterial | null>(null)
  const [deletingMaterial, setDeletingMaterial] = useState<RawMaterial | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterCategory, setFilterCategory] = useState("all")
  const [filterStock, setFilterStock] = useState("all")

  const [formData, setFormData] = useState<{
    name: string
    sku: string
    description: string
    measurementUnit: string
    currentStock: number
    minStock: number
    costPerUnit: number
    categoryId: string | null
    isActive: boolean
    showInCatalog: boolean
    priceWholesale: number
    soldByWeight: boolean
    icmsRate: number
    imageUrl: string
  }>({
    name: "",
    sku: "",
    description: "",
    measurementUnit: "KG",
    currentStock: 0,
    minStock: 0,
    costPerUnit: 0,
    categoryId: null,
    isActive: true,
    showInCatalog: false,
    priceWholesale: 0,
    soldByWeight: false,
    icmsRate: 0,
    imageUrl: ""
  })

  // Estados para upload de imagem
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login")
    } else if (status === "authenticated") {
      loadData()
    }
  }, [status, router])

  const loadData = async () => {
    setLoading(true)
    try {
      const [materialsRes, categoriesRes] = await Promise.all([
        fetch("/api/raw-materials?includeInactive=true"),
        fetch("/api/financial/categories")
      ])

      if (materialsRes.ok) {
        const data = await materialsRes.json()
        setMaterials(Array.isArray(data) ? data : [])
      } else {
        setMaterials([])
      }

      if (categoriesRes.ok) {
        const data = await categoriesRes.json()
        setCategories(Array.isArray(data) ? data : [])
      } else {
        setCategories([])
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error)
      toast.error("Erro ao carregar matérias-primas")
      setMaterials([])
      setCategories([])
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDialog = (material?: RawMaterial) => {
    console.log("ABRINDO MODAL", material)
    if (material) {
      setEditingMaterial(material)
      setFormData({
        name: material.name,
        sku: material.sku || "",
        description: material.description || "",
        measurementUnit: material.measurementUnit,
        currentStock: material.currentStock,
        minStock: material.minStock || 0,
        costPerUnit: material.costPerUnit || 0,
        categoryId: material.categoryId || null,
        isActive: true, // Sempre manter como ativo ao editar
        showInCatalog: (material as any).showInCatalog || false,
        priceWholesale: (material as any).priceWholesale || 0,
        soldByWeight: (material as any).soldByWeight || false,
        icmsRate: (material as any).icmsRate || 0,
        imageUrl: (material as any).imageUrl || ""
      })
      // Limpar arquivo selecionado e preview ao abrir para edição
      setSelectedFile(null)
      setPreviewUrl(null)
    } else {
      setEditingMaterial(null)
      setFormData({
        name: "",
        sku: "",
        description: "",
        measurementUnit: "KG",
        currentStock: 0,
        minStock: 0,
        costPerUnit: 0,
        categoryId: null,
        isActive: true,
        showInCatalog: false,
        priceWholesale: 0,
        soldByWeight: false,
        icmsRate: 0,
        imageUrl: ""
      })
      // Limpar arquivo selecionado e preview ao abrir para criar novo
      setSelectedFile(null)
      setPreviewUrl(null)
    }
    console.log("SETANDO SHOWDIALOG TRUE")
    setShowDialog(true)
    console.log("MODAL DEVE ESTAR ABERTO AGORA")
  }

  // Função para manipular seleção de arquivo
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      
      // Gerar preview para imagens
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  // Função para fazer upload da imagem
  const uploadImage = async (): Promise<string | null> => {
    if (!selectedFile) return null

    try {
      setIsUploading(true)
      const formData = new FormData()
      formData.append('image', selectedFile)

      const response = await fetch('/api/raw-materials/upload-image', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao fazer upload')
      }

      const data = await response.json()
      return data.cloudStoragePath
    } catch (error) {
      console.error('Erro ao fazer upload:', error)
      toast.error('Erro ao fazer upload da imagem')
      return null
    } finally {
      setIsUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Fazer upload da imagem se houver arquivo selecionado
    let imageUrl = formData.imageUrl
    if (selectedFile) {
      const uploadedPath = await uploadImage()
      if (uploadedPath) {
        imageUrl = uploadedPath
      }
    }
    
    // Preparar dados - REMOVER categoryId se for null ou vazio
    const submitData: any = {
      name: formData.name,
      sku: formData.sku,
      description: formData.description,
      measurementUnit: formData.measurementUnit,
      currentStock: formData.currentStock,
      minStock: formData.minStock,
      costPerUnit: formData.costPerUnit,
      imageUrl: imageUrl, // 🔧 Adicionar imageUrl
      isActive: true,
      showInCatalog: formData.showInCatalog,
      priceWholesale: formData.priceWholesale,
      soldByWeight: formData.soldByWeight,
      icmsRate: formData.icmsRate // Taxa de ICMS em porcentagem
    }
    
    // APENAS adicionar categoryId se for uma string válida (não vazia)
    if (formData.categoryId && formData.categoryId.trim() !== '') {
      submitData.categoryId = formData.categoryId
    }
    
    console.log("DADOS PREPARADOS PARA ENVIO:", submitData)

    try {
      const url = editingMaterial
        ? `/api/raw-materials/${editingMaterial.id}`
        : "/api/raw-materials"
      
      const method = editingMaterial ? "PUT" : "POST"

      console.log("ENVIANDO PARA:", url, "METODO:", method)
      console.log("PAYLOAD COMPLETO:", JSON.stringify(submitData, null, 2))
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitData)
      })

      console.log("RESPOSTA STATUS:", response.status)
      console.log("RESPOSTA OK:", response.ok)
      
      if (response.ok) {
        toast.success(editingMaterial ? "Matéria-prima atualizada!" : "Matéria-prima criada!")
        setShowDialog(false)
        loadData()
      } else {
        // Tentar ler a resposta como JSON
        let errorMessage = "Erro ao salvar matéria-prima"
        try {
          const errorData = await response.json()
          console.error("❌ ERRO DA API (JSON):", errorData)
          console.error("❌ Tipo do error:", typeof errorData.error)
          console.error("❌ Tipo do details:", typeof errorData.details)
          
          // Garantir que sempre mostramos uma string
          if (typeof errorData.error === 'string') {
            errorMessage = errorData.error
          } else if (typeof errorData.details === 'string') {
            errorMessage = errorData.details
          } else if (errorData.message) {
            errorMessage = errorData.message
          } else {
            errorMessage = `Erro ${response.status}: ${JSON.stringify(errorData)}`
          }
          
          // Se houver detalhes adicionais, anexar
          if (errorData.details && typeof errorData.details === 'string') {
            errorMessage += `\n\nDetalhes: ${errorData.details}`
          }
        } catch (jsonError) {
          // Se não for JSON, tentar ler como texto
          console.error("❌ Erro ao parsear JSON:", jsonError)
          try {
            const textError = await response.text()
            console.error("❌ ERRO DA API (TEXT):", textError)
            errorMessage = textError || errorMessage
          } catch (textError) {
            console.error("❌ Erro ao ler texto:", textError)
          }
        }
        
        console.error("❌ MENSAGEM FINAL EXIBIDA:", errorMessage)
        toast.error(errorMessage)
      }
    } catch (error) {
      console.error("Erro ao salvar:", error)
      toast.error("Erro ao salvar matéria-prima")
    }
  }

  const handleDelete = async () => {
    if (!deletingMaterial) return

    try {
      const response = await fetch(`/api/raw-materials/${deletingMaterial.id}`, {
        method: "DELETE"
      })

      if (response.ok) {
        toast.success("Matéria-prima excluída!")
        setDeletingMaterial(null)
        loadData()
      } else {
        const error = await response.json()
        toast.error(error.error || "Erro ao excluir matéria-prima")
      }
    } catch (error) {
      console.error("Erro ao excluir:", error)
      toast.error("Erro ao excluir matéria-prima")
    }
  }

  const filteredMaterials = materials.filter((material) => {
    const matchesSearch = material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (material.sku && material.sku.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesCategory = filterCategory === "all" || material.categoryId === filterCategory
    
    const matchesStock = 
      filterStock === "all" ||
      (filterStock === "low" && material.minStock && material.currentStock <= material.minStock) ||
      (filterStock === "ok" && (!material.minStock || material.currentStock > material.minStock))
    
    return matchesSearch && matchesCategory && matchesStock
  })

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => window.location.href = "/admin/compras"}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <h1 className="text-3xl font-bold">Matérias-Primas</h1>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Matéria-Prima
        </Button>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Buscar</Label>
              <Input
                placeholder="Nome ou SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Estoque</Label>
              <Select value={filterStock} onValueChange={setFilterStock}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="low">Estoque Baixo</SelectItem>
                  <SelectItem value="ok">Estoque OK</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Matérias-Primas */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMaterials.map((material) => (
          <Card key={material.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{material.name}</CardTitle>
                    {!material.isActive && (
                      <Badge variant="destructive">Inativo</Badge>
                    )}
                  </div>
                  <CardDescription>SKU: {material.sku}</CardDescription>
                </div>
                {material.minStock && material.currentStock <= material.minStock && (
                  <Badge variant="destructive" className="ml-2">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Baixo
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                {material.Category && (
                  <Badge style={{ backgroundColor: material.Category.color }}>
                    {material.Category.name}
                  </Badge>
                )}
                {(material as any).showInCatalog && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                    No Catálogo
                  </Badge>
                )}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estoque Atual:</span>
                  <span className="font-medium">
                    {material.currentStock} {material.measurementUnit}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estoque Mínimo:</span>
                  <span className="font-medium">
                    {material.minStock || 0} {material.measurementUnit}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Custo:</span>
                  <span className="font-medium">
                    R$ {(material.costPerUnit || 0).toFixed(2)}/{material.measurementUnit}
                  </span>
                </div>
              </div>

              {material.description && (
                <p className="text-sm text-muted-foreground border-t pt-2">
                  {material.description}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleOpenDialog(material)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeletingMaterial(material)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredMaterials.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Nenhuma matéria-prima encontrada</p>
            <p className="text-sm text-muted-foreground">
              {searchTerm || filterCategory !== "all" || filterStock !== "all"
                ? "Tente ajustar os filtros"
                : "Comece cadastrando sua primeira matéria-prima"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Dialog de Criação/Edição */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowDialog(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 m-4" onClick={(e) => e.stopPropagation()}>
          <div className="mb-4">
            <h2 className="text-2xl font-bold mb-2">
              {editingMaterial ? "Editar Matéria-Prima" : "Nova Matéria-Prima"}
            </h2>
            <p className="text-sm text-gray-500">
              Preencha as informações da matéria-prima
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Carne Bovina"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sku">SKU *</Label>
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="Ex: CB-001"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição opcional..."
                rows={3}
              />
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="measurementUnit">Unidade</Label>
                <Select
                  value={formData.measurementUnit}
                  onValueChange={(value) => setFormData({ ...formData, measurementUnit: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="KG">KG</SelectItem>
                    <SelectItem value="G">Gramas</SelectItem>
                    <SelectItem value="L">Litros</SelectItem>
                    <SelectItem value="ML">ML</SelectItem>
                    <SelectItem value="UN">Unidade</SelectItem>
                    <SelectItem value="CX">Caixa</SelectItem>
                    <SelectItem value="PC">Pacote</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="currentStock">Estoque Atual</Label>
                <Input
                  id="currentStock"
                  type="number"
                  step="0.01"
                  value={formData.currentStock}
                  onChange={(e) => setFormData({ ...formData, currentStock: parseFloat(e.target.value) || 0 })}
                />
                <p className="text-xs text-muted-foreground">
                  ⚠️ Valores negativos são permitidos para indicar estoque em falta
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="minStock">Estoque Mínimo</Label>
                <Input
                  id="minStock"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.minStock}
                  onChange={(e) => setFormData({ ...formData, minStock: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="costPerUnit">Custo por Unidade (R$)</Label>
                <Input
                  id="costPerUnit"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.costPerUnit}
                  onChange={(e) => setFormData({ ...formData, costPerUnit: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Select
                  value={formData.categoryId || "no-category"}
                  onValueChange={(value) => {
                    console.log("Categoria selecionada:", value)
                    setFormData({ 
                      ...formData, 
                      categoryId: value === "no-category" ? null : value 
                    })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no-category">Sem categoria</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="showInCatalog"
                  checked={formData.showInCatalog}
                  onCheckedChange={(checked) => setFormData({ ...formData, showInCatalog: checked as boolean })}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label
                    htmlFor="showInCatalog"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Disponibilizar no catálogo para venda
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Marque esta opção se esta matéria-prima também pode ser vendida como produto final
                  </p>
                </div>
              </div>

              {/* Upload de Imagem */}
              <div className="space-y-2 pl-6">
                <Label htmlFor="image">Foto do Produto</Label>
                <Input
                  id="image"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground">
                  Formatos aceitos: JPEG, PNG, WEBP, GIF (Máx: 5MB)
                </p>

                {/* Preview da imagem */}
                {(previewUrl || (editingMaterial && formData.imageUrl)) && (
                  <div className="mt-2">
                    <Label className="text-sm font-medium">Preview:</Label>
                    <div className="mt-1 relative w-32 h-32 border rounded overflow-hidden bg-gray-50">
                      <img
                        src={previewUrl || formData.imageUrl}
                        alt="Preview"
                        className="object-cover w-full h-full"
                      />
                    </div>
                  </div>
                )}
              </div>

              {formData.showInCatalog && (
                <div className="space-y-4 pl-6">
                  <div className="space-y-2">
                    <Label htmlFor="priceWholesale">Preço de Venda (R$) *</Label>
                    <Input
                      id="priceWholesale"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.priceWholesale}
                      onChange={(e) => setFormData({ ...formData, priceWholesale: parseFloat(e.target.value) || 0 })}
                      placeholder="Ex: 50.00"
                      required={formData.showInCatalog}
                    />
                    <p className="text-xs text-muted-foreground">
                      Preço pelo qual esta matéria-prima será vendida aos clientes
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="soldByWeight"
                      checked={formData.soldByWeight}
                      onCheckedChange={(checked) => setFormData({ ...formData, soldByWeight: checked as boolean })}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label
                        htmlFor="soldByWeight"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        Vendido por Peso (kg)
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Permite especificar quantidades decimais como 1,350 kg
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Campo ICMS - Checkbox */}
              <div className="space-y-2 pt-4 border-t">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="hasIcms"
                    checked={formData.icmsRate > 0}
                    onChange={(e) => setFormData({ ...formData, icmsRate: e.target.checked ? 3.6 : 0 })}
                    className="w-5 h-5 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                  />
                  <Label htmlFor="hasIcms" className="text-sm font-semibold text-orange-700 cursor-pointer">
                    💰 Aplicar ICMS 3,6%
                  </Label>
                </div>
                {formData.icmsRate > 0 && (
                  <p className="text-xs text-green-600 font-medium">
                    ✅ ICMS de 3,6% será aplicado automaticamente ao custo desta matéria-prima nas receitas.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)} disabled={isUploading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isUploading}>
                {isUploading ? "Enviando imagem..." : editingMaterial ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </form>
          </div>
        </div>
      )}

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={!!deletingMaterial} onOpenChange={() => setDeletingMaterial(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deletingMaterial?.name}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}