'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LogIn, UserPlus, ArrowLeft, Flame, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function StoreAuthPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('login')

  // Login States
  const [loginData, setLoginData] = useState({
    phone: '',
    password: ''
  })

  // Cadastro States
  const [registerData, setRegisterData] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: ''
  })

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!loginData.phone || !loginData.password) {
      toast.error('Preencha todos os campos')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch(`/api/public/store/${slug}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || 'Erro ao fazer login')
        return
      }

      // Salvar dados de autenticação no localStorage
      localStorage.setItem(`publicAuth_${slug}`, JSON.stringify(data.customer))
      
      toast.success('Login realizado com sucesso!')
      
      // Redirecionar de volta para a loja
      setTimeout(() => {
        router.push(`/store/${slug}`)
      }, 500)

    } catch (error) {
      console.error('Erro ao fazer login:', error)
      toast.error('Erro ao fazer login. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validações
    if (!registerData.name || !registerData.phone || !registerData.password) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }

    if (registerData.password !== registerData.confirmPassword) {
      toast.error('As senhas não coincidem')
      return
    }

    if (registerData.password.length < 4) {
      toast.error('A senha deve ter no mínimo 4 caracteres')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch(`/api/public/store/${slug}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: registerData.name,
          phone: registerData.phone,
          email: registerData.email || undefined,
          password: registerData.password
        })
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || 'Erro ao criar conta')
        return
      }

      // Salvar dados de autenticação no localStorage
      localStorage.setItem(`publicAuth_${slug}`, JSON.stringify(data.customer))
      
      toast.success('Conta criada com sucesso!')
      
      // Redirecionar de volta para a loja
      setTimeout(() => {
        router.push(`/store/${slug}`)
      }, 500)

    } catch (error) {
      console.error('Erro ao criar conta:', error)
      toast.error('Erro ao criar conta. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Botão Voltar */}
        <Button
          onClick={() => router.push(`/store/${slug}`)}
          variant="ghost"
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar para a loja
        </Button>

        <Card className="border-2 border-orange-100 shadow-xl">
          <CardHeader className="text-center space-y-2">
            <div className="flex justify-center">
              <div className="bg-gradient-to-br from-orange-600 to-red-600 p-3 rounded-full">
                <Flame className="w-8 h-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-gray-800">
              Minha Conta
            </CardTitle>
            <CardDescription>
              Entre ou crie sua conta para continuar
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="register">Criar Conta</TabsTrigger>
              </TabsList>

              {/* Aba de Login */}
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-phone">Telefone</Label>
                    <Input
                      id="login-phone"
                      type="tel"
                      placeholder="(XX) XXXXX-XXXX"
                      value={loginData.phone}
                      onChange={(e) => setLoginData({ ...loginData, phone: e.target.value })}
                      disabled={isLoading}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password">Senha</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="Sua senha"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      disabled={isLoading}
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-orange-600 hover:bg-orange-700"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Entrando...
                      </>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4 mr-2" />
                        Entrar
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* Aba de Cadastro */}
              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-name">Nome Completo *</Label>
                    <Input
                      id="register-name"
                      type="text"
                      placeholder="Seu nome completo"
                      value={registerData.name}
                      onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                      disabled={isLoading}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-phone">Telefone *</Label>
                    <Input
                      id="register-phone"
                      type="tel"
                      placeholder="(XX) XXXXX-XXXX"
                      value={registerData.phone}
                      onChange={(e) => setRegisterData({ ...registerData, phone: e.target.value })}
                      disabled={isLoading}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-email">E-mail (opcional)</Label>
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={registerData.email}
                      onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-password">Senha *</Label>
                    <Input
                      id="register-password"
                      type="password"
                      placeholder="Mínimo 4 caracteres"
                      value={registerData.password}
                      onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                      disabled={isLoading}
                      required
                      minLength={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-confirm-password">Confirmar Senha *</Label>
                    <Input
                      id="register-confirm-password"
                      type="password"
                      placeholder="Digite a senha novamente"
                      value={registerData.confirmPassword}
                      onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                      disabled={isLoading}
                      required
                      minLength={4}
                    />
                  </div>

                  <div className="text-xs text-gray-500">
                    * Campos obrigatórios
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-orange-600 hover:bg-orange-700"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Criando conta...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Criar Conta
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Informação sobre Segurança */}
        <p className="text-center text-sm text-gray-500 mt-4">
          Seus dados estão protegidos e serão usados apenas para processar seus pedidos
        </p>
      </div>
    </div>
  )
}
