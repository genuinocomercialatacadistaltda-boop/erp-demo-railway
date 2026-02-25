'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Home, ShoppingBag, Award, User, LogOut } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';

interface ClientCustomerSession {
  id: string;
  name: string;
  email: string | null;
  customerId: string;
  customerName: string;
}

export default function ClientCustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<ClientCustomerSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    if (pathname === '/client-customer/login') {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/client-customer/auth/session');
      const data = await res.json();

      if (data.authenticated) {
        setSession(data.clientCustomer);
      } else {
        router.push('/client-customer/login');
      }
    } catch (error) {
      router.push('/client-customer/login');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/client-customer/auth/logout', { method: 'POST' });
      toast.success('Logout realizado com sucesso');
      router.push('/client-customer/login');
    } catch (error) {
      toast.error('Erro ao fazer logout');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  // Página de login não precisa do layout
  if (pathname === '/client-customer/login') {
    return <>{children}</>;
  }

  const navigation = [
    { name: 'Início', href: '/client-customer/dashboard', icon: Home },
    { name: 'Catálogo', href: '/client-customer/catalog', icon: ShoppingBag },
    { name: 'Meus Pedidos', href: '/client-customer/orders', icon: ShoppingBag },
    { name: 'Pontos', href: '/client-customer/points', icon: Award },
    { name: 'Perfil', href: '/client-customer/profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {session?.customerName || 'Portal do Cliente'}
              </h1>
              <p className="text-sm text-gray-600">Olá, {session?.name}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b sticky top-16 z-40">
        <div className="container mx-auto px-4">
          <div className="flex space-x-1 overflow-x-auto">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={
                    isActive
                      ? 'flex items-center px-4 py-3 text-sm font-medium border-b-2 border-green-600 text-green-600'
                      : 'flex items-center px-4 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 hover:border-b-2 hover:border-gray-300'
                  }
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
