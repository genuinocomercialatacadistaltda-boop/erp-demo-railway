'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  User,
  ShoppingBag,
  Package,
  Award,
  Lock,
  Plus,
  Edit,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface SubCliente {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  document: string | null;
  creditLimit: number;
  currentDebt: number;
  pointsBalance: number;
  totalPointsEarned: number;
  pointsMultiplier: number;
  isActive: boolean;
}

interface CatalogItem {
  id: string;
  productName: string;
  productDescription: string | null;
  productImage: string | null;
  defaultPrice: number;
  customPrice: number | null;
  isVisible: boolean;
  isAvailable: boolean;
  pointsPerUnit: number;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  total: number;
  createdAt: string;
  Items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export default function SubClienteDetailPage({ params }: { params: { id: string } }) {
  const { data: session } = useSession() || {};
  const router = useRouter();
  const [subCliente, setSubCliente] = useState<SubCliente | null>(null);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Password dialog
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [settingPassword, setSettingPassword] = useState(false);
  
  // Catalog dialog
  const [showCatalogDialog, setShowCatalogDialog] = useState(false);
  const [catalogForm, setCatalogForm] = useState({
    productName: '',
    productDescription: '',
    defaultPrice: 0,
    customPrice: 0,
    pointsPerUnit: 0,
  });
  const [savingCatalog, setSavingCatalog] = useState(false);

  useEffect(() => {
    const user = session?.user as any;
    if (user?.customerId) {
      loadData();
    }
  }, [session, params.id]);

  const loadData = async () => {
    try {
      const [subClienteRes, catalogRes, ordersRes] = await Promise.all([
        fetch(`/api/customer/sub-clientes/${params.id}`),
        fetch(`/api/customer/sub-clientes/${params.id}/catalogo`),
        fetch(`/api/customer/sub-clientes/${params.id}/pedidos`),
      ]);

      const [subClienteData, catalogData, ordersData] = await Promise.all([
        subClienteRes.json(),
        catalogRes.json(),
        ordersRes.json(),
      ]);

      if (subClienteData.success) {
        setSubCliente(subClienteData.subCliente);
      }

      if (catalogData.success) {
        setCatalogItems(catalogData.items);
      }

      if (ordersData.success) {
        setOrders(ordersData.orders);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setSettingPassword(true);
    try {
      const res = await fetch(`/api/customer/sub-clientes/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Senha definida com sucesso');
        setShowPasswordDialog(false);
        setNewPassword('');
      } else {
        toast.error(data.message || 'Erro ao definir senha');
      }
    } catch (error) {
      toast.error('Erro ao definir senha');
    } finally {
      setSettingPassword(false);
    }
  };

  const handleAddCatalogItem = async () => {
    if (!catalogForm.productName || catalogForm.defaultPrice <= 0) {
      toast.error('Nome e preço são obrigatórios');
      return;
    }

    setSavingCatalog(true);
    try {
      const res = await fetch(`/api/customer/sub-clientes/${params.id}/catalogo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(catalogForm),
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Item adicionado ao catálogo');
        setShowCatalogDialog(false);
        setCatalogForm({
          productName: '',
          productDescription: '',
          defaultPrice: 0,
          customPrice: 0,
          pointsPerUnit: 0,
        });
        loadData();
      } else {
        toast.error(data.message || 'Erro ao adicionar item');
      }
    } catch (error) {
      toast.error('Erro ao adicionar item');
    } finally {
      setSavingCatalog(false);
    }
  };

  const handleDeleteCatalogItem = async (itemId: string) => {
    if (!confirm('Deseja remover este item do catálogo?')) return;

    try {
      const res = await fetch(
        `/api/customer/sub-clientes/${params.id}/catalogo/${itemId}`,
        { method: 'DELETE' }
      );

      const data = await res.json();

      if (data.success) {
        toast.success('Item removido');
        loadData();
      } else {
        toast.error(data.message || 'Erro ao remover item');
      }
    } catch (error) {
      toast.error('Erro ao remover item');
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    try {
      const res = await fetch(
        `/api/customer/sub-clientes/${params.id}/pedidos/${orderId}/status`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        }
      );

      const data = await res.json();

      if (data.success) {
        toast.success('Status atualizado');
        loadData();
      } else {
        toast.error(data.message || 'Erro ao atualizar status');
      }
    } catch (error) {
      toast.error('Erro ao atualizar status');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!subCliente) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p>Sub-cliente não encontrado</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{subCliente.name}</h1>
          <p className="text-gray-600">{subCliente.email || 'Sem email'}</p>
        </div>
        <Badge variant={subCliente.isActive ? 'default' : 'secondary'}>
          {subCliente.isActive ? 'Ativo' : 'Inativo'}
        </Badge>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Pontos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{Math.floor(subCliente.pointsBalance)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Pedidos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{orders.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Catálogo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{catalogItems.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Crédito</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              R$ {subCliente.creditLimit.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="info">
            <User className="h-4 w-4 mr-2" />
            Informações
          </TabsTrigger>
          <TabsTrigger value="catalog">
            <ShoppingBag className="h-4 w-4 mr-2" />
            Catálogo
          </TabsTrigger>
          <TabsTrigger value="orders">
            <Package className="h-4 w-4 mr-2" />
            Pedidos
          </TabsTrigger>
          <TabsTrigger value="points">
            <Award className="h-4 w-4 mr-2" />
            Pontos
          </TabsTrigger>
        </TabsList>

        {/* Info Tab */}
        <TabsContent value="info" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dados do Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Nome</p>
                  <p className="font-medium">{subCliente.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-medium">{subCliente.email || 'Não informado'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Telefone</p>
                  <p className="font-medium">{subCliente.phone || 'Não informado'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">CPF/CNPJ</p>
                  <p className="font-medium">{subCliente.document || 'Não informado'}</p>
                </div>
              </div>
              {subCliente.address && (
                <div>
                  <p className="text-sm text-gray-600">Endereço</p>
                  <p className="font-medium">{subCliente.address}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Acesso ao Portal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Configure uma senha para que este cliente possa acessar o portal e fazer
                  pedidos online.
                </p>
                <Button onClick={() => setShowPasswordDialog(true)}>
                  <Lock className="h-4 w-4 mr-2" />
                  Definir/Alterar Senha
                </Button>
                {subCliente.email && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm font-medium">Link de acesso:</p>
                    <p className="text-sm text-blue-600 break-all">
                      {window.location.origin}/client-customer/login
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Catalog Tab */}
        <TabsContent value="catalog" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Catálogo Personalizado</CardTitle>
                <Button onClick={() => setShowCatalogDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {catalogItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <ShoppingBag className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>Nenhum item no catálogo</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Preço Padrão</TableHead>
                      <TableHead>Preço Especial</TableHead>
                      <TableHead>Pontos/Unid</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {catalogItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.productName}</TableCell>
                        <TableCell>R$ {item.defaultPrice.toFixed(2)}</TableCell>
                        <TableCell>
                          {item.customPrice
                            ? `R$ ${item.customPrice.toFixed(2)}`
                            : '-'}
                        </TableCell>
                        <TableCell>{Math.floor(item.pointsPerUnit)}</TableCell>
                        <TableCell>
                          <Badge variant={item.isAvailable ? 'default' : 'secondary'}>
                            {item.isAvailable ? 'Disponível' : 'Indisponível'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteCatalogItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pedidos Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Package className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>Nenhum pedido realizado</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Itens</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pagamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.orderNumber}</TableCell>
                        <TableCell>
                          {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell>{order.Items.length} itens</TableCell>
                        <TableCell>R$ {order.total.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge>{order.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={order.paymentStatus === 'PAID' ? 'default' : 'secondary'}>
                            {order.paymentStatus === 'PAID' ? 'Pago' : 'Pendente'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Points Tab */}
        <TabsContent value="points" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Programa de Fidelidade</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Saldo Atual</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {Math.floor(subCliente.pointsBalance)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Ganho</p>
                  <p className="text-2xl font-bold">
                    {Math.floor(subCliente.totalPointsEarned)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Multiplicador</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {subCliente.pointsMultiplier}x
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Definir Senha de Acesso</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova Senha</Label>
              <Input
                id="password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                minLength={6}
              />
            </div>
            <Button
              onClick={handleSetPassword}
              disabled={settingPassword}
              className="w-full"
            >
              {settingPassword ? 'Salvando...' : 'Salvar Senha'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Catalog Dialog */}
      <Dialog open={showCatalogDialog} onOpenChange={setShowCatalogDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Item ao Catálogo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="productName">Nome do Produto *</Label>
              <Input
                id="productName"
                value={catalogForm.productName}
                onChange={(e) =>
                  setCatalogForm({ ...catalogForm, productName: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="productDescription">Descrição</Label>
              <Input
                id="productDescription"
                value={catalogForm.productDescription}
                onChange={(e) =>
                  setCatalogForm({ ...catalogForm, productDescription: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="defaultPrice">Preço Padrão *</Label>
                <Input
                  id="defaultPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={catalogForm.defaultPrice}
                  onChange={(e) =>
                    setCatalogForm({
                      ...catalogForm,
                      defaultPrice: parseFloat(e.target.value) || 0,
                    })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customPrice">Preço Especial</Label>
                <Input
                  id="customPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={catalogForm.customPrice}
                  onChange={(e) =>
                    setCatalogForm({
                      ...catalogForm,
                      customPrice: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pointsPerUnit">Pontos por Unidade</Label>
              <Input
                id="pointsPerUnit"
                type="number"
                step="0.01"
                min="0"
                value={catalogForm.pointsPerUnit}
                onChange={(e) =>
                  setCatalogForm({
                    ...catalogForm,
                    pointsPerUnit: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
            <Button
              onClick={handleAddCatalogItem}
              disabled={savingCatalog}
              className="w-full"
            >
              {savingCatalog ? 'Adicionando...' : 'Adicionar ao Catálogo'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
