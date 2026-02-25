
'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, ArrowLeft, Flame } from 'lucide-react'

export default function AuthErrorPage() {
  const searchParams = useSearchParams()
  const error = searchParams?.get('error')

  const getErrorMessage = (error: string | null) => {
    switch (error) {
      case 'CredentialsSignin':
        return 'E-mail ou senha incorretos. Verifique suas credenciais.'
      case 'EmailSignin':
        return 'Erro ao enviar email de verificação.'
      case 'OAuthSignin':
        return 'Erro ao fazer login com provedor OAuth.'
      case 'OAuthCallback':
        return 'Erro no callback do provedor OAuth.'
      case 'OAuthCreateAccount':
        return 'Erro ao criar conta com provedor OAuth.'
      case 'EmailCreateAccount':
        return 'Erro ao criar conta com email.'
      case 'Callback':
        return 'Erro no callback de autenticação.'
      case 'OAuthAccountNotLinked':
        return 'Esta conta OAuth já está vinculada a outro usuário.'
      case 'EmailNotLinked':
        return 'Este email já está vinculado a outro usuário.'
      case 'SessionRequired':
        return 'Sessão necessária para acessar esta página.'
      case 'AccessDenied':
        return 'Acesso negado. Você não tem permissão para acessar este recurso.'
      default:
        return 'Ocorreu um erro durante a autenticação. Tente novamente.'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-amber-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center">
              <Flame className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">[SUA EMPRESA]</h1>
              <p className="text-sm text-gray-600">A Essência do Espetinho Perfeito</p>
            </div>
          </div>
        </div>

        <Card className="shadow-2xl border-0">
          <CardHeader className="text-center pb-4">
            <div className="w-16 h-16 bg-red-100 rounded-2xl mx-auto mb-4 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <CardTitle className="text-2xl text-gray-900">Erro de Autenticação</CardTitle>
            <CardDescription className="text-gray-600">
              Não foi possível completar o login
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">
                {getErrorMessage(error)}
              </p>
            </div>

            <div className="space-y-3">
              <Link href="/auth/login">
                <Button className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-medium">
                  Tentar Novamente
                </Button>
              </Link>
              
              <Link href="/">
                <Button variant="outline" className="w-full h-12 flex items-center gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Voltar ao Início
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
