'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { TrendingUp, DollarSign, Award, Shield, ArrowRight, BarChart3 } from 'lucide-react'

export default function InvestirPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [company, setCompany] = useState<any>(null)

  useEffect(() => {
    // Buscar empresa
    fetch('/api/investir/companies')
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          setCompany(data[0]) // Primeira empresa ([SUA EMPRESA])
        }
      })
      .catch(console.error)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      {/* Header */}
      <div className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-orange-600">
            🍖 [SUA EMPRESA]
          </Link>
          <div className="flex items-center gap-4">
            {session ? (
              <Button onClick={() => router.push('/investir/dashboard')}>
                Meu Dashboard
              </Button>
            ) : (
              <>
                <Link href="/auth/login">
                  <Button variant="outline">Entrar</Button>
                </Link>
                <Link href="/auth/register">
                  <Button>Cadastrar</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-5xl font-bold mb-6 text-gray-900">
            Invista no Futuro do<br />
            <span className="text-orange-600">Grupo [SUA EMPRESA]</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Faça parte do sucesso de uma das maiores distribuidoras de espetos do Brasil.
            Receba dividendos e veja seu capital crescer junto com a empresa.
          </p>
          {company && (
            <div className="grid grid-cols-3 gap-4 mb-8">
              <Card className="p-4">
                <div className="text-sm text-gray-600">Preço Atual</div>
                <div className="text-2xl font-bold text-orange-600">
                  R$ {company.currentPrice.toFixed(2)}
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-sm text-gray-600">Avaliação</div>
                <div className="text-2xl font-bold text-gray-900">
                  R$ {(company.valuation / 1000000).toFixed(1)}M
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-sm text-gray-600">Ações Disponíveis</div>
                <div className="text-2xl font-bold text-gray-900">
                  {Number(company.totalShares).toLocaleString()}
                </div>
              </Card>
            </div>
          )}
          <Button 
            size="lg" 
            className="text-lg px-8"
            onClick={() => session ? router.push('/investir/dashboard') : router.push('/auth/login')}
          >
            Começar a Investir <ArrowRight className="ml-2" />
          </Button>
        </div>

        {/* Benefícios */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card className="p-6 text-center hover:shadow-lg transition-shadow">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="font-bold text-lg mb-2">Rentabilidade Mensal</h3>
            <p className="text-gray-600 text-sm">
              Receba dividendos mensais baseados nos lucros da empresa
            </p>
          </Card>

          <Card className="p-6 text-center hover:shadow-lg transition-shadow">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="font-bold text-lg mb-2">Valorização</h3>
            <p className="text-gray-600 text-sm">
              Suas ações valorizam conforme a empresa cresce
            </p>
          </Card>

          <Card className="p-6 text-center hover:shadow-lg transition-shadow">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Award className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="font-bold text-lg mb-2">Participe dos Lucros</h3>
            <p className="text-gray-600 text-sm">
              Seja sócio e receba parte dos lucros distribuídos
            </p>
          </Card>

          <Card className="p-6 text-center hover:shadow-lg transition-shadow">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-orange-600" />
            </div>
            <h3 className="font-bold text-lg mb-2">Segurança</h3>
            <p className="text-gray-600 text-sm">
              Empresa consolidada com histórico sólido de crescimento
            </p>
          </Card>
        </div>

        {/* Como Funciona */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">Como Funciona</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="p-6">
              <div className="text-3xl font-bold text-orange-600 mb-4">1</div>
              <h3 className="font-bold mb-2">Faça um Depósito</h3>
              <p className="text-gray-600 text-sm">
                Adicione saldo à sua conta via Mercado Pago de forma segura
              </p>
            </Card>
            <Card className="p-6">
              <div className="text-3xl font-bold text-orange-600 mb-4">2</div>
              <h3 className="font-bold mb-2">Compre Ações</h3>
              <p className="text-gray-600 text-sm">
                Escolha quantas ações deseja comprar e confirme a operação
              </p>
            </Card>
            <Card className="p-6">
              <div className="text-3xl font-bold text-orange-600 mb-4">3</div>
              <h3 className="font-bold mb-2">Receba Dividendos</h3>
              <p className="text-gray-600 text-sm">
                Acompanhe seus ganhos e receba dividendos mensalmente
              </p>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t bg-gray-50 py-8 mt-16">
        <div className="container mx-auto px-4 text-center text-gray-600">
          <p>© 2025 Grupo [SUA EMPRESA]. Todos os direitos reservados.</p>
        </div>
      </div>
    </div>
  )
}
