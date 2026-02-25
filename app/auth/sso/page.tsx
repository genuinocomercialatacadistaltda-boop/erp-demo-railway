'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn, useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function SSOCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(true)

  useEffect(() => {
    const processSSO = async () => {
      try {
        // Verificar se já está autenticado
        if (status === 'authenticated' && session) {
          console.log('[SSO_CALLBACK] Usuário já autenticado, redirecionando...')
          router.push('/investir/dashboard')
          return
        }

        // Aguardar o status ser determinado
        if (status === 'loading') {
          console.log('[SSO_CALLBACK] Aguardando status de autenticação...')
          return
        }

        // Extrair token da URL
        const token = searchParams.get('token')
        
        if (!token) {
          console.error('[SSO_CALLBACK] Token não fornecido')
          setError('Token de autenticação não fornecido')
          setIsProcessing(false)
          return
        }

        console.log('[SSO_CALLBACK] Token recebido, processando...')

        // Validar token e criar sessão
        const response = await fetch('/api/auth/validate-sso-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        })

        if (!response.ok) {
          const errorData = await response.json()
          console.error('[SSO_CALLBACK] Erro ao validar token:', errorData)
          setError(errorData.error || 'Token inválido ou expirado')
          setIsProcessing(false)
          return
        }

        const { userData } = await response.json()
        console.log('[SSO_CALLBACK] Token validado, usuário:', userData.email)

        // Fazer login via NextAuth
        console.log('[SSO_CALLBACK] Fazendo login automático...')
        const result = await signIn('credentials', {
          email: userData.email,
          customerId: userData.customerId,
          ssoToken: token,
          redirect: false
        })

        if (result?.error) {
          console.error('[SSO_CALLBACK] Erro ao fazer login:', result.error)
          setError('Erro ao autenticar: ' + result.error)
          setIsProcessing(false)
          return
        }

        if (result?.ok) {
          console.log('[SSO_CALLBACK] Login bem-sucedido, redirecionando...')
          // Aguardar um momento para a sessão ser estabelecida
          setTimeout(() => {
            router.push('/investir/dashboard')
          }, 500)
        }
      } catch (error: any) {
        console.error('[SSO_CALLBACK] Erro inesperado:', error)
        setError('Erro ao processar autenticação: ' + error.message)
        setIsProcessing(false)
      }
    }

    processSSO()
  }, [searchParams, router, status, session])

  if (isProcessing && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-green-600 to-emerald-600 rounded-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
            <CardTitle className="text-2xl">Autenticando...</CardTitle>
            <CardDescription>
              Aguarde enquanto validamos sua conta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
              <span>Validando credenciais</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
              <span>Criando perfil de investidor</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
              <span>Preparando dashboard</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-4">
        <Card className="w-full max-w-md border-red-200">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <CardTitle className="text-2xl text-red-900">Erro de Autenticação</CardTitle>
            <CardDescription className="text-red-700">
              {error}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-gray-600 space-y-2">
              <p><strong>Possíveis causas:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>Token expirado (válido por 5 minutos)</li>
                <li>Sessão inválida</li>
                <li>Conta não encontrada</li>
              </ul>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => router.push('/')}
              >
                Voltar ao Início
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                onClick={() => router.push('/auth/login')}
              >
                Fazer Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}
