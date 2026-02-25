
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  Package,
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
  Users,
  FileText,
  Plus,
  Home,
  ArrowLeft,
  BoxIcon,
  BookOpen,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface DashboardData {
  totalPurchases: number;
  pendingPurchases: number;
  totalRawMaterials: number;
  lowStockItems: number;
  totalSuppliers: number;
  monthlySpending: number;
}

export default function ComprasPage() {
  const router = useRouter();
  const { data: session, status } = useSession() || {};
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    totalPurchases: 0,
    pendingPurchases: 0,
    totalRawMaterials: 0,
    lowStockItems: 0,
    totalSuppliers: 0,
    monthlySpending: 0,
  });
  const [recentPurchases, setRecentPurchases] = useState<any[]>([]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    } else if (status === 'authenticated') {
      if ((session?.user as any)?.userType !== 'ADMIN') {
        router.push('/dashboard');
      } else {
        loadDashboard();
      }
    }
  }, [status, session, router]);

  const loadDashboard = async () => {
    try {
      setLoading(true);

      // Carregar dados do dashboard
      const [purchasesRes, rawMaterialsRes, suppliersRes] = await Promise.all([
        fetch('/api/purchases'),
        fetch('/api/raw-materials'),
        fetch('/api/purchases/suppliers'),
      ]);

      const purchases = await purchasesRes.json();
      const rawMaterials = await rawMaterialsRes.json();
      const suppliers = await suppliersRes.json();

      // Calcular métricas
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthlyPurchases = purchases.filter((p: any) => 
        new Date(p.purchaseDate) >= firstDayOfMonth && p.status === 'PAID'
      );
      
      const monthlySpending = monthlyPurchases.reduce(
        (sum: number, p: any) => sum + p.totalAmount, 
        0
      );

      const lowStockItems = rawMaterials.filter((rm: any) => 
        rm.minStock && rm.currentStock <= rm.minStock
      );

      setDashboardData({
        totalPurchases: purchases.length,
        pendingPurchases: purchases.filter((p: any) => p.status === 'PENDING').length,
        totalRawMaterials: rawMaterials.length,
        lowStockItems: lowStockItems.length,
        totalSuppliers: suppliers.length,
        monthlySpending,
      });

      // Últimas 5 compras
      setRecentPurchases(purchases.slice(0, 5));
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => window.location.href = '/admin'}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Compras</h1>
            <p className="text-muted-foreground">Gerencie compras, matérias-primas e fornecedores</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => window.location.href = '/admin'}
          >
            <Home className="h-4 w-4 mr-2" />
            Página Inicial
          </Button>
          <Button onClick={() => window.location.href = '/admin/compras/nova'}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Compra
          </Button>
        </div>
      </div>

      {/* Cards de métricas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Compras</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.totalPurchases}</div>
            <p className="text-xs text-muted-foreground">
              {dashboardData.pendingPurchases} pendentes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Matérias-Primas</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.totalRawMaterials}</div>
            {dashboardData.lowStockItems > 0 && (
              <p className="text-xs text-orange-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {dashboardData.lowStockItems} com estoque baixo
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fornecedores</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.totalSuppliers}</div>
            <p className="text-xs text-muted-foreground">cadastrados</p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gastos do Mês</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {dashboardData.monthlySpending.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Menu de navegação */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/admin/compras/nova">
          <Card className="cursor-pointer hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Nova Compra
              </CardTitle>
              <CardDescription>Registrar uma nova compra</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/compras/materias-primas">
          <Card className="cursor-pointer hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Matérias-Primas
              </CardTitle>
              <CardDescription>Gerenciar estoque</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/compras/insumos">
          <Card className="cursor-pointer hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BoxIcon className="h-5 w-5 text-blue-600" />
                Insumos
              </CardTitle>
              <CardDescription>Gerenciar insumos de produção</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/compras/fornecedores">
          <Card className="cursor-pointer hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Fornecedores
              </CardTitle>
              <CardDescription>Cadastro de fornecedores</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/compras/historico">
          <Card className="cursor-pointer hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Histórico
              </CardTitle>
              <CardDescription>Ver todas as compras</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {/* Últimas compras */}
      {recentPurchases.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Últimas Compras</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentPurchases.map((purchase) => (
                <div
                  key={purchase.id}
                  className="flex items-center justify-between border-b pb-4 last:border-0"
                >
                  <div>
                    <p className="font-medium">{purchase.purchaseNumber}</p>
                    <p className="text-sm text-muted-foreground">
                      {purchase.Supplier?.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(purchase.purchaseDate).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">R$ {purchase.totalAmount.toFixed(2)}</p>
                    <Badge
                      variant={
                        purchase.status === 'PAID'
                          ? 'default'
                          : purchase.status === 'PENDING'
                          ? 'secondary'
                          : 'destructive'
                      }
                    >
                      {purchase.status === 'PAID'
                        ? 'Pago'
                        : purchase.status === 'PENDING'
                        ? 'Pendente'
                        : 'Vencido'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
