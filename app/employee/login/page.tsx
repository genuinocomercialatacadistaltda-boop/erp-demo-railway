
'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserCircle2, Lock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';

export default function EmployeeLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Por favor, preencha todos os campos');
      return;
    }

    try {
      setLoading(true);
      
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl: '/employee/dashboard',
      });

      if (result?.error) {
        toast.error('E-mail ou senha incorretos');
      } else if (result?.ok) {
        toast.success('Login realizado com sucesso!');
        router.push('/employee/dashboard');
      }
    } catch (error: any) {
      console.error('Erro no login:', error);
      toast.error('Erro ao fazer login. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <div className="relative w-24 h-24 rounded-full bg-orange-500 flex items-center justify-center shadow-lg">
              <UserCircle2 className="w-16 h-16 text-white" />
            </div>
          </div>
          <CardTitle className="text-center text-2xl font-bold text-gray-900">
            Portal do Funcionário
          </CardTitle>
          <p className="text-center text-gray-600 text-sm">
            [SUA EMPRESA] - Acesso Exclusivo para Funcionários
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-700 font-medium">
                E-mail
              </Label>
              <div className="relative">
                <UserCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                  disabled={loading}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-700 font-medium">
                Senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                  disabled={loading}
                  autoComplete="current-password"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-6 text-lg"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>

            <div className="text-center text-sm text-gray-500 mt-4">
              <p>Esqueceu sua senha? Entre em contato com o RH.</p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
