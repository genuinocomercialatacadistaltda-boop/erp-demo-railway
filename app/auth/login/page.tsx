
'use client'

import { useState, useEffect } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Flame, LogIn, ArrowLeft, Mail, Lock } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function LoginPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const returnTo = searchParams.get('returnTo')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false
      })

      if (result?.error) {
        setError('E-mail ou senha incorretos')
        toast({
          title: "Erro no login",
          description: "Verifique suas credenciais e tente novamente.",
          variant: "destructive",
        })
      } else {
        // Get session to determine redirect
        const session = await getSession()
        const user = session?.user as any
        
        console.log('[LOGIN] User Type:', user?.userType);
        console.log('[LOGIN] Customer Type:', user?.customerType);
        
        toast({
          title: "Login realizado com sucesso!",
          description: "Redirecionando...",
        })

        // Redirecionamento por tipo de usuário
        if (user?.userType === 'ADMIN') {
          router.push('/admin')
        } else if (user?.userType === 'SELLER') {
          router.push('/seller')
        } else if (user?.userType === 'EMPLOYEE') {
          router.push('/employee/dashboard')
        } else if (user?.userType === 'CUSTOMER') {
          // 🔥 VERIFICAR customerType para clientes
          if (user?.customerType === 'VAREJO') {
            console.log('[LOGIN] ✅ Cliente VAREJO detectado! Redirecionando para /varejo/dashboard');
            router.push('/varejo/dashboard')
          } else {
            console.log('[LOGIN] Cliente de atacado/normal. Redirecionando para /dashboard');
            router.push('/dashboard')
          }
        } else {
          router.push('/dashboard')
        }
      }
    } catch (error) {
      console.error('Login error:', error)
      setError('Erro interno. Tente novamente.')
      toast({
        title: "Erro no sistema",
        description: "Ocorreu um erro interno. Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-amber-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4">
            <ArrowLeft className="w-4 h-4" />
            Voltar ao início
          </Link>
          <div className="flex items-center justify-center space-x-3 mb-6">
            <div className="relative w-14 h-14 rounded-xl overflow-hidden">
              <Image 
                src="/logo.jpg" 
                alt="[SUA EMPRESA]" 
                fill 
                className="object-contain"
                priority
              />
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
              <LogIn className="w-8 h-8 text-red-600" />
            </div>
            <CardTitle className="text-2xl text-gray-900">
              Entrar na sua conta
            </CardTitle>
            <CardDescription className="text-gray-600">
              Acesse sua área personalizada com preços especiais
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                  E-mail
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    className="pl-11 h-12 border-gray-200 focus:border-red-500 focus:ring-red-500"
                    placeholder="seu@email.com"
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                  Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    className="pl-11 h-12 border-gray-200 focus:border-red-500 focus:ring-red-500"
                    placeholder="Sua senha"
                    value={formData.password}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={isLoading}
                className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-medium"
              >
                {isLoading ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-600 text-center mb-3">
                Ainda não tem cadastro?
              </p>
              <div className="p-3 bg-red-50 rounded-lg text-center border border-red-100">
                <p className="text-xs text-gray-600 mb-2">Entre em contato pelo WhatsApp</p>
                <a 
                  href="https://wa.me/55[SEU-DDD][SEU-NUMERO]?text=Olá!%20Gostaria%20de%20me%20cadastrar%20como%20cliente." 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm font-bold text-red-600 hover:text-red-700 flex items-center justify-center gap-2 transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  [SEU TELEFONE]
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
