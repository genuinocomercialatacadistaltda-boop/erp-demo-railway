'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  Package,
  ChefHat,
  TrendingUp,
  Calculator,
  Layers,
  Home,
  ArrowLeft
} from 'lucide-react'

export default function ClientPrecificacaoPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }

    if (status === 'authenticated') {
      const user = session?.user as any
      if (user?.userType !== 'CUSTOMER') {
        toast.error('Acesso negado')
        router.push('/customer/gestao')
        return
      }
    }
  }, [status, session, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Calculator className="w-12 h-12 text-amber-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-amber-600 to-yellow-600 text-white py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Button
                onClick={() => window.location.href = '/customer/gestao'}
                variant="outline"
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
              >
                <Home className="w-4 h-4 mr-2" />
                Página Inicial
              </Button>
              <Button
                onClick={() => window.history.back()}
                variant="outline"
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Calculator className="w-8 h-8" />
              Precificação
            </h1>
            <p className="text-white/90 mt-2">
              Gerencie seus custos, receitas e calcule a precificação ideal
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Catálogo de Insumos */}
          <Card
            className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50"
            onClick={() => router.push('/customer/gestao/precificacao/insumos')}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <Package className="w-10 h-10 text-amber-600" />
              </div>
              <CardTitle className="text-xl text-amber-900">Catálogo de Insumos</CardTitle>
              <CardDescription>
                Gerencie palitos, embalagens, temperos e outros insumos de produção
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>Acessar catálogo</span>
                <ArrowLeft className="w-4 h-4 rotate-180" />
              </div>
            </CardContent>
          </Card>

          {/* Receitas */}
          <Card
            className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50"
            onClick={() => router.push('/customer/gestao/precificacao/receitas')}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <ChefHat className="w-10 h-10 text-green-600" />
              </div>
              <CardTitle className="text-xl text-green-900">Receitas</CardTitle>
              <CardDescription>
                Cadastre receitas, ingredientes e calcule custos de produção
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>Acessar receitas</span>
                <ArrowLeft className="w-4 h-4 rotate-180" />
              </div>
            </CardContent>
          </Card>

          {/* Rentabilidade */}
          <Card
            className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50"
            onClick={() => router.push('/customer/gestao/precificacao/rentabilidade')}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <TrendingUp className="w-10 h-10 text-blue-600" />
              </div>
              <CardTitle className="text-xl text-blue-900">Rentabilidade</CardTitle>
              <CardDescription>
                Analise margens de lucro e identifique produtos mais rentáveis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>Ver análise</span>
                <ArrowLeft className="w-4 h-4 rotate-180" />
              </div>
            </CardContent>
          </Card>

          {/* Simulador de Preços */}
          <Card
            className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50"
            onClick={() => router.push('/customer/gestao/precificacao/simulador')}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <Calculator className="w-10 h-10 text-purple-600" />
              </div>
              <CardTitle className="text-xl text-purple-900">Simulador de Preços</CardTitle>
              <CardDescription>
                Simule diferentes cenários de preço e margem de lucro
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>Abrir simulador</span>
                <ArrowLeft className="w-4 h-4 rotate-180" />
              </div>
            </CardContent>
          </Card>

          {/* Calculadora de Insumos */}
          <Card
            className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-cyan-200 bg-gradient-to-br from-cyan-50 to-teal-50"
            onClick={() => router.push('/customer/gestao/precificacao/calculadora-insumos')}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <Layers className="w-10 h-10 text-cyan-600" />
              </div>
              <CardTitle className="text-xl text-cyan-900">Calculadora de Insumos</CardTitle>
              <CardDescription>
                Calcule o custo unitário de cada insumo por produto final
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>Abrir calculadora</span>
                <ArrowLeft className="w-4 h-4 rotate-180" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Card de Informação */}
        <Card className="mt-8 bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200">
          <CardHeader>
            <CardTitle className="text-amber-900">💡 Sobre o Módulo de Precificação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-gray-700">
            <p>
              <strong className="text-amber-700">Precificação Industrial</strong> é o processo de calcular com precisão o custo de produção e definir preços competitivos.
            </p>
            <p>
              Com este módulo, você consegue gerenciar todos os custos envolvidos (ingredientes, insumos, mão de obra) e simular diferentes cenários de preço.
            </p>
            <p className="text-sm text-gray-600 mt-4">
              ✅ <strong>Catálogo de Insumos:</strong> Já está 100% funcional!<br />
              🚧 <strong>Receitas, Rentabilidade, Simulador e Calculadora:</strong> Em desenvolvimento
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
