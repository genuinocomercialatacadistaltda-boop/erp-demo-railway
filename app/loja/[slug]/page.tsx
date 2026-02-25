'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Store, 
  ShoppingCart,
  Eye,
  LogIn,
  Package,
  MapPin,
  Phone,
  Award
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import Image from 'next/image'

interface StoreInfo {
  id: string
  name: string
  storeName: string | null
  storeSlug: string
  storeLogo: string | null
  phone: string | null
  city: string | null
  address: string | null
}

export default function LojaInicialPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params?.slug as string

  const [loading, setLoading] = useState(true)
  const [store, setStore] = useState<StoreInfo | null>(null)

  useEffect(() => {
    loadStore()
  }, [slug])

  const loadStore = async () => {
    try {
      setLoading(true)
      console.log(`[PUBLIC_STORE_HOME] Carregando informações da loja: ${slug}`)
      
      const response = await fetch(`/api/public/store/${slug}/catalog`)
      
      if (!response.ok) {
        if (response.status === 404) {
          toast.error('Loja não encontrada')
        } else {
          toast.error('Erro ao carregar loja')
        }
        return
      }

      const data = await response.json()
      console.log('[PUBLIC_STORE_HOME] Dados recebidos:', data)
      
      setStore(data.store)
    } catch (error) {
      console.error('[PUBLIC_STORE_HOME_ERROR]', error)
      toast.error('Erro ao carregar loja')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-green-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Carregando loja...</p>
        </div>
      </div>
    )
  }

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-green-50">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle className="text-red-600">Loja não encontrada</CardTitle>
            <CardDescription>
              A loja que você está procurando não existe ou não está mais ativa.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-green-50">
      {/* Badge Oficial Genuíno */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 border-b border-green-800">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="flex items-center justify-center gap-2 text-white">
            <Award className="h-5 w-5" />
            <span className="font-semibold text-sm md:text-base">
              🏆 Loja Oficial [SUA EMPRESA] - Qualidade Garantida
            </span>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-4 py-12 md:py-20">
        <div className="text-center mb-12">
          {/* Logos - Espeto Genuíno + Cliente */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 mb-8">
            {/* Logo da Empresa */}
            <div className="relative w-40 h-40 md:w-48 md:h-48 bg-white rounded-2xl shadow-2xl overflow-hidden border-4 border-green-600">
              <Image
                src="/logo.jpg"
                alt="Logo da Empresa"
                fill
                className="object-contain p-2"
              />
            </div>

            {/* Logo do Cliente (se existir) */}
            {store.storeLogo && (
              <>
                {/* Divisor visual */}
                <div className="hidden md:block text-4xl font-bold text-slate-300">+</div>
                <div className="md:hidden text-3xl font-bold text-slate-300">+</div>

                <div className="relative w-40 h-40 md:w-48 md:h-48 bg-white rounded-2xl shadow-2xl overflow-hidden border-4 border-orange-600">
                  <Image
                    src={store.storeLogo}
                    alt={`Logo ${store.storeName || store.name}`}
                    fill
                    className="object-contain p-2"
                  />
                </div>
              </>
            )}
          </div>

          <h1 className="text-4xl md:text-6xl font-bold text-slate-900 mb-4">
            {store.storeName || store.name}
          </h1>
          
          <p className="text-xl md:text-2xl text-slate-600 mb-6">
            Bem-vindo à nossa loja online!
          </p>

          {/* Informações da Loja */}
          <div className="flex flex-wrap justify-center gap-4 md:gap-6 text-slate-700 mb-8">
            {store.city && (
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm">
                <MapPin className="h-5 w-5 text-orange-600" />
                <span className="font-medium">{store.city}</span>
              </div>
            )}
            {store.phone && (
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm">
                <Phone className="h-5 w-5 text-green-600" />
                <span className="font-medium">{store.phone}</span>
              </div>
            )}
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Faça seu Login */}
          <Card className="hover:shadow-xl transition-shadow cursor-pointer border-2 border-transparent hover:border-blue-500">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="bg-blue-100 p-6 rounded-full">
                  <LogIn className="h-12 w-12 text-blue-600" />
                </div>
              </div>
              <CardTitle className="text-2xl text-blue-600">
                Faça seu Login
              </CardTitle>
              <CardDescription className="text-base">
                Acesse sua conta para ver seus pedidos e histórico
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => router.push(`/loja/${slug}/auth`)}
                className="w-full h-14 text-lg bg-blue-600 hover:bg-blue-700"
              >
                <LogIn className="h-5 w-5 mr-2" />
                Entrar
              </Button>
            </CardContent>
          </Card>

          {/* Faça seu Pedido */}
          <Card className="hover:shadow-xl transition-shadow cursor-pointer border-2 border-transparent hover:border-green-500">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="bg-green-100 p-6 rounded-full">
                  <ShoppingCart className="h-12 w-12 text-green-600" />
                </div>
              </div>
              <CardTitle className="text-2xl text-green-600">
                Faça seu Pedido
              </CardTitle>
              <CardDescription className="text-base">
                Navegue pelo catálogo e adicione produtos ao carrinho
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => router.push(`/loja/${slug}/catalogo`)}
                className="w-full h-14 text-lg bg-green-600 hover:bg-green-700"
              >
                <ShoppingCart className="h-5 w-5 mr-2" />
                Pedir Agora
              </Button>
            </CardContent>
          </Card>

          {/* Ver o Catálogo */}
          <Card className="hover:shadow-xl transition-shadow cursor-pointer border-2 border-transparent hover:border-orange-500">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="bg-orange-100 p-6 rounded-full">
                  <Eye className="h-12 w-12 text-orange-600" />
                </div>
              </div>
              <CardTitle className="text-2xl text-orange-600">
                Ver o Catálogo
              </CardTitle>
              <CardDescription className="text-base">
                Navegue sem compromisso e veja todos os nossos produtos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => router.push(`/loja/${slug}/catalogo`)}
                variant="outline"
                className="w-full h-14 text-lg border-2 border-orange-600 text-orange-600 hover:bg-orange-50"
              >
                <Package className="h-5 w-5 mr-2" />
                Ver Produtos
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Informações Adicionais */}
        <div className="mt-16 text-center max-w-3xl mx-auto">
          <Card className="bg-gradient-to-r from-green-50 to-orange-50 border-2 border-green-200">
            <CardHeader>
              <CardTitle className="text-2xl text-slate-900 flex items-center justify-center gap-2">
                <Award className="h-6 w-6 text-green-600" />
                Por que escolher {store.storeName || store.name}?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                <div>
                  <h3 className="font-bold text-lg text-slate-900 mb-2">🥩 Qualidade Premium</h3>
                  <p className="text-slate-700">
                    Produtos selecionados com o mais alto padrão de qualidade
                  </p>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900 mb-2">🚚 Entrega Rápida</h3>
                  <p className="text-slate-700">
                    Receba seus pedidos no conforto da sua casa
                  </p>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900 mb-2">💯 Satisfação Garantida</h3>
                  <p className="text-slate-700">
                    Sua satisfação é nossa prioridade número 1
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white py-8 mt-12">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-lg font-semibold mb-2">
            {store.storeName || store.name}
          </p>
          <p className="text-slate-400 text-sm">
            Powered by [SUA EMPRESA] - Todos os direitos reservados
          </p>
        </div>
      </div>
    </div>
  )
}
