'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingBag, Award, Package, DollarSign } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface Stats {
  pointsBalance: number;
  totalOrders: number;
  pendingOrders: number;
  totalSpent: number;
}

export default function ClientCustomerDashboard() {
  const [stats, setStats] = useState<Stats>({
    pointsBalance: 0,
    totalOrders: 0,
    pendingOrders: 0,
    totalSpent: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [profileRes, ordersRes] = await Promise.all([
        fetch('/api/client-customer/profile'),
        fetch('/api/client-customer/orders?limit=100'),
      ]);

      const profileData = await profileRes.json();
      const ordersData = await ordersRes.json();

      if (profileData.success && ordersData.success) {
        const totalOrders = ordersData.orders?.length || 0;
        const pendingOrders =
          ordersData.orders?.filter((o: any) => o.status === 'PENDING').length || 0;
        const totalSpent = ordersData.orders
          ?.filter((o: any) => o.paymentStatus === 'PAID')
          .reduce((sum: number, o: any) => sum + o.total, 0) || 0;

        setStats({
          pointsBalance: profileData.profile.pointsBalance || 0,
          totalOrders,
          pendingOrders,
          totalSpent,
        });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Pontos Disponíveis',
      value: Math.floor(stats.pointsBalance),
      icon: Award,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
    {
      title: 'Total de Pedidos',
      value: stats.totalOrders,
      icon: ShoppingBag,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Pedidos Pendentes',
      value: stats.pendingOrders,
      icon: Package,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      title: 'Total Gasto',
      value: `R$ ${stats.totalSpent.toFixed(2)}`,
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Bem-vindo ao seu portal de pedidos</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {stat.title}
                </CardTitle>
                <div className={`${stat.bgColor} p-2 rounded-lg`}>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/client-customer/catalog">
              <Button className="w-full" size="lg">
                <ShoppingBag className="h-5 w-5 mr-2" />
                Ver Catálogo
              </Button>
            </Link>
            <Link href="/client-customer/orders">
              <Button variant="outline" className="w-full" size="lg">
                <Package className="h-5 w-5 mr-2" />
                Meus Pedidos
              </Button>
            </Link>
            <Link href="/client-customer/points">
              <Button variant="outline" className="w-full" size="lg">
                <Award className="h-5 w-5 mr-2" />
                Meus Pontos
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
