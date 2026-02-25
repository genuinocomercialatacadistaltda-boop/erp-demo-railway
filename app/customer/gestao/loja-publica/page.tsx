'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'react-hot-toast'
import { 
  Store, 
  Upload, 
  Home, 
  ArrowLeft, 
  Eye,
  Image as ImageIcon,
  ExternalLink
} from 'lucide-react'
import Image from 'next/image'

interface CustomerInfo {
  id: string
  name: string
  storeName: string | null
  storeSlug: string | null
  storeLogo: string | null
}

export default function LojaPublicaPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [customer, setCustomer] = useState<CustomerInfo | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    } else if (status === 'authenticated') {
      const userType = (session.user as any)?.userType
      if (userType !== 'CUSTOMER') {
        router.push('/')
      } else {
        loadCustomer()
      }
    }
  }, [status, session, router])

  const loadCustomer = async () => {
    try {
      setLoading(true)
      const customerId = (session?.user as any)?.customerId

      const response = await fetch(`/api/customers/${customerId}`)
      if (!response.ok) {
        toast.error('Erro ao carregar informações')
        return
      }

      const data = await response.json()
      setCustomer(data)
      console.log('[LOJA_PUBLICA] Cliente carregado:', data)
    } catch (error) {
      console.error('[LOJA_PUBLICA_ERROR]', error)
      toast.error('Erro ao carregar informações')
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar tipo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Tipo de arquivo inválido. Envie apenas imagens (JPEG, PNG, WEBP, GIF)')
      return
    }

    // Validar tamanho (5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error('Arquivo muito grande. Tamanho máximo: 5MB')
      return
    }

    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    console.log('[LOJA_PUBLICA] Arquivo selecionado:', file.name, file.type, file.size)
  }

  const handleUpload = async () => {
    if (!selectedFile || !customer) return

    try {
      setUploading(true)
      console.log('[LOJA_PUBLICA] Iniciando upload da logo...')

      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch(`/api/customers/${customer.id}/upload-store-logo`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao fazer upload')
      }

      const data = await response.json()
      console.log('[LOJA_PUBLICA] Upload concluído:', data)

      toast.success('Logo atualizada com sucesso!')
      
      // Atualizar estado local
      setCustomer({
        ...customer,
        storeLogo: data.cloudStoragePath,
      })
      
      // Limpar seleção
      setSelectedFile(null)
      setPreviewUrl(null)

      // Recarregar dados
      loadCustomer()
    } catch (error) {
      console.error('[LOJA_PUBLICA_UPLOAD_ERROR]', error)
      toast.error((error as Error).message || 'Erro ao fazer upload da logo')
    } finally {
      setUploading(false)
    }
  }

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Erro</CardTitle>
            <CardDescription>Não foi possível carregar as informações</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-green-500 to-green-600 p-3 rounded-xl shadow-lg">
              <Store className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Loja Pública</h1>
              <p className="text-slate-600">Configure sua loja online</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => window.location.href = '/customer/gestao'}
              variant="outline"
              className="gap-2"
            >
              <Home className="h-4 w-4" />
              Página Inicial
            </Button>
            <Button
              onClick={() => window.history.back()}
              variant="outline"
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          </div>
        </div>

        {/* Informações da Loja */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Informações da Loja
            </CardTitle>
            <CardDescription>
              Dados da sua loja pública
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-slate-600">Nome do Negócio</Label>
                <p className="text-lg font-semibold text-slate-900">{customer.name}</p>
              </div>
              <div>
                <Label className="text-sm text-slate-600">Nome da Loja (pública)</Label>
                <p className="text-lg font-semibold text-slate-900">
                  {customer.storeName || customer.name}
                </p>
              </div>
            </div>

            {customer.storeSlug && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <Label className="text-sm text-blue-900 mb-2 block">
                  Link da Sua Loja Pública
                </Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white px-4 py-2 rounded border text-sm text-blue-600 font-mono">
                    {typeof window !== 'undefined' && `${window.location.origin}/loja/${customer.storeSlug}`}
                  </code>
                  <Button
                    size="sm"
                    onClick={() => {
                      window.open(`/loja/${customer.storeSlug}`, '_blank')
                    }}
                    className="gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Abrir
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upload da Logo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Logo da Loja
            </CardTitle>
            <CardDescription>
              Envie a logo que aparecerá na sua loja pública
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Logo Atual */}
            {customer.storeLogo && (
              <div>
                <Label className="text-sm text-slate-600 mb-2 block">Logo Atual</Label>
                <div className="relative w-48 h-48 border-2 border-slate-200 rounded-lg overflow-hidden bg-white">
                  <Image
                    src={customer.storeLogo}
                    alt="Logo atual"
                    fill
                    className="object-contain p-4"
                  />
                </div>
              </div>
            )}

            {/* Preview da Nova Logo */}
            {previewUrl && (
              <div>
                <Label className="text-sm text-slate-600 mb-2 block">Prévia da Nova Logo</Label>
                <div className="relative w-48 h-48 border-2 border-green-200 rounded-lg overflow-hidden bg-white">
                  <Image
                    src={previewUrl}
                    alt="Prévia"
                    fill
                    className="object-contain p-4"
                  />
                </div>
              </div>
            )}

            {/* Input de Arquivo */}
            <div>
              <Label htmlFor="logo-file" className="text-sm text-slate-600 mb-2 block">
                Selecionar Nova Logo
              </Label>
              <div className="flex items-center gap-4">
                <Input
                  id="logo-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleFileChange}
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Formatos aceitos: JPEG, PNG, WEBP, GIF | Tamanho máximo: 5MB
              </p>
            </div>

            {/* Botão de Upload */}
            {selectedFile && (
              <Button
                onClick={handleUpload}
                disabled={uploading}
                className="gap-2"
                size="lg"
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Enviando...
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5" />
                    Fazer Upload da Logo
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
