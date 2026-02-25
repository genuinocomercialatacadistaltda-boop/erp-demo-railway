'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  MessageCircle,
  Phone,
  CheckCircle2,
  XCircle,
  Trash2,
  RefreshCw,
  Plus,
  AlertCircle,
  Home,
  Copy,
  ArrowLeft,
  Calendar,
  Clock,
  Users,
  Filter,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  customerType: string;
  city: string;
  manuallyUnblocked?: boolean;
  lastContact?: {
    date: string;
    frequency?: string;
    nextContactDate?: string;
    description?: string;
  } | null;
  pendingCommunication?: {
    id: string;
    type: string;
    description: string;
    frequency?: string;
    nextContactDate?: string;
    priority: string;
  } | null;
}

interface Communication {
  id: string;
  customerId: string;
  customer: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    manuallyUnblocked?: boolean;
  };
  type: string;
  description: string;
  priority: string;
  status: string;
  amount: number | null;
  frequency?: string | null;
  nextContactDate?: string | null;
  createdAt: string;
}

interface GroupedCommunications {
  OVERDUE_BOLETO: Communication[];
  INACTIVE_CLIENT: Communication[];
  ORDER_FOLLOWUP: Communication[];
  CUSTOM: Communication[];
}

export default function WhatsAppChecklistPage() {
  const router = useRouter();
  const { data: session } = useSession() || {};
  const [activeTab, setActiveTab] = useState('checklist');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Estados para checklist automático
  const [communications, setcommunications] = useState<GroupedCommunications>({
    OVERDUE_BOLETO: [],
    INACTIVE_CLIENT: [],
    ORDER_FOLLOWUP: [],
    CUSTOM: [],
  });
  const [summary, setSummary] = useState({
    overdueBoletos: 0,
    inactiveClients: 0,
    orderFollowup: 0,
    custom: 0,
  });

  // Estados para lista de todos os clientes
  const [allClients, setAllClients] = useState<Customer[]>([]);
  const [filteredClients, setFilteredClients] = useState<Customer[]>([]);
  const [clientFilter, setClientFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Estados para diálogos
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Customer | null>(null);
  const [scheduleFrequency, setScheduleFrequency] = useState('DAILY');
  const [scheduleDescription, setScheduleDescription] = useState('');

  useEffect(() => {
    if (session?.user?.userType !== 'ADMIN') {
      router.push('/admin');
      return;
    }
    fetchChecklist();
    fetchAllClients();
  }, [session]);

  useEffect(() => {
    // Aplicar filtros
    let filtered = allClients;

    // Filtro por tipo
    if (clientFilter !== 'ALL') {
      filtered = filtered.filter(c => c.customerType === clientFilter);
    }

    // Filtro por busca
    if (searchTerm) {
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone.includes(searchTerm) ||
        c.city?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredClients(filtered);
  }, [allClients, clientFilter, searchTerm]);

  const fetchChecklist = async () => {
    try {
      setLoading(true);
      console.log('[WHATSAPP_PAGE] Buscando checklist...');

      const response = await fetch('/api/admin/whatsapp/checklist');
      if (!response.ok) {
        throw new Error('Erro ao buscar checklist');
      }

      const result = await response.json();
      console.log('[WHATSAPP_PAGE] Checklist recebido:', result.data.summary);

      setcommunications(result.data.grouped);
      setSummary(result.data.summary);
    } catch (error: any) {
      console.error('[WHATSAPP_PAGE] Erro ao buscar checklist:', error);
      toast.error('Erro ao carregar checklist: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllClients = async () => {
    try {
      setLoading(true);
      console.log('[WHATSAPP_PAGE] Buscando todos os clientes...');

      const response = await fetch('/api/admin/whatsapp/clients');
      if (!response.ok) {
        throw new Error('Erro ao buscar clientes');
      }

      const result = await response.json();
      console.log('[WHATSAPP_PAGE] Clientes carregados:', result.total);

      setAllClients(result.data || []);
      setFilteredClients(result.data || []);
    } catch (error: any) {
      console.error('[WHATSAPP_PAGE] Erro ao buscar clientes:', error);
      toast.error('Erro ao carregar clientes: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'checklist') {
      await fetchChecklist();
    } else {
      await fetchAllClients();
    }
    setRefreshing(false);
    toast.success('✅ Lista atualizada!');
  };

  const handleMarkAsSent = async (commId: string) => {
    try {
      const response = await fetch(`/api/admin/whatsapp/checklist/${commId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'SENT' }),
      });

      if (!response.ok) throw new Error('Erro ao marcar como enviado');

      toast.success('✅ Marcado como enviado!');
      await fetchChecklist();
      await fetchAllClients(); // Atualizar também a lista de clientes
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    }
  };

  const handleIgnore = async (commId: string) => {
    try {
      const response = await fetch(`/api/admin/whatsapp/checklist/${commId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'IGNORED' }),
      });

      if (!response.ok) throw new Error('Erro ao ignorar');

      toast.success('⛔ Comunicação ignorada');
      await fetchChecklist();
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    }
  };

  const handleDelete = async (commId: string) => {
    if (!confirm('Deseja realmente remover esta comunicação da lista?')) return;

    try {
      const response = await fetch(`/api/admin/whatsapp/checklist/${commId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Erro ao remover');

      toast.success('🗑️ Comunicação removida');
      await fetchChecklist();
      await fetchAllClients();
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    }
  };

  const handleScheduleContact = (client: Customer) => {
    setSelectedClient(client);
    setScheduleFrequency(client.pendingCommunication?.frequency || 'DAILY');
    setScheduleDescription(client.pendingCommunication?.description || '');
    setShowScheduleDialog(true);
  };

  const handleSaveSchedule = async () => {
    if (!selectedClient) return;

    try {
      const response = await fetch('/api/admin/whatsapp/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedClient.id,
          frequency: scheduleFrequency,
          description: scheduleDescription || `Follow-up programado`,
        }),
      });

      if (!response.ok) throw new Error('Erro ao programar follow-up');

      toast.success('📅 Follow-up programado com sucesso!');
      setShowScheduleDialog(false);
      await fetchAllClients();
      await fetchChecklist();
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    }
  };

  const handleCancelSchedule = async (client: Customer) => {
    if (!confirm('Deseja cancelar o follow-up programado para este cliente?')) return;

    try {
      const response = await fetch(`/api/admin/whatsapp/schedule?customerId=${client.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Erro ao cancelar');

      toast.success('❌ Follow-up cancelado');
      await fetchAllClients();
      await fetchChecklist();
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    }
  };

  const copyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    toast.success('📋 Telefone copiado!');
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, { color: string; label: string }> = {
      HIGH: { color: 'bg-red-500 text-white', label: '🔴 Alta' },
      MEDIUM: { color: 'bg-yellow-500 text-black', label: '🟡 Média' },
      LOW: { color: 'bg-green-500 text-white', label: '🟢 Baixa' },
    };
    const variant = variants[priority] || variants.MEDIUM;
    return <Badge className={variant.color}>{variant.label}</Badge>;
  };

  const getFrequencyLabel = (freq: string) => {
    const labels: Record<string, string> = {
      DAILY: '📅 Diário',
      EVERY_3_DAYS: '📅 A cada 3 dias',
      WEEKLY: '📅 Semanal',
    };
    return labels[freq] || freq;
  };

  const getCustomerTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      NORMAL: 'Atacado',
      CONSUMIDOR_FINAL: 'Consumidor Final',
      CASUAL: 'Casual',
      VAREJO: 'Varejo',
    };
    return labels[type] || type;
  };

  const renderCommunicationCard = (comm: Communication) => (
    <Card key={comm.id} className="mb-4 border-l-4 border-l-blue-500">
      <CardContent className="pt-6">
        <div className="space-y-3">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h3 className="font-bold text-lg">{comm.customer.name}</h3>
              {comm.customer.manuallyUnblocked && (
                <Badge className="bg-green-100 text-green-800 mt-1">
                  🔓 Liberado Manualmente
                </Badge>
              )}
            </div>
            {getPriorityBadge(comm.priority)}
          </div>

          <div className="flex items-center gap-2 bg-gray-100 p-3 rounded">
            <Phone className="h-5 w-5 text-blue-600" />
            <span className="font-mono font-bold text-lg flex-1">
              {comm.customer.phone}
            </span>
            <Button size="sm" variant="outline" onClick={() => copyPhone(comm.customer.phone)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>

          <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
            <p className="text-sm font-medium text-gray-700">
              <AlertCircle className="inline h-4 w-4 mr-1 text-yellow-600" />
              {comm.description}
            </p>
          </div>

          {comm.frequency && (
            <div className="bg-blue-50 p-2 rounded border border-blue-200">
              <p className="text-sm font-medium text-blue-700">
                <Calendar className="inline h-4 w-4 mr-1" />
                {getFrequencyLabel(comm.frequency)}
                {comm.nextContactDate && (
                  <span className="ml-2">
                    • Próximo: {format(new Date(comm.nextContactDate), 'dd/MM/yyyy', { locale: ptBR })}
                  </span>
                )}
              </p>
            </div>
          )}

          {comm.amount && (
            <div className="bg-red-50 p-2 rounded border border-red-200">
              <p className="text-sm font-bold text-red-700">
                💰 Valor: R$ {comm.amount.toFixed(2)}
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button onClick={() => handleMarkAsSent(comm.id)} className="flex-1 bg-green-600 hover:bg-green-700">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Enviado
            </Button>
            <Button onClick={() => handleIgnore(comm.id)} variant="outline" className="border-orange-500 text-orange-600">
              <XCircle className="h-4 w-4 mr-2" />
              Ignorar
            </Button>
            <Button onClick={() => handleDelete(comm.id)} variant="destructive" size="icon">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderClientRow = (client: Customer) => {
    const hasPending = !!client.pendingCommunication;
    const lastContactDate = client.lastContact?.date
      ? format(new Date(client.lastContact.date), 'dd/MM/yyyy HH:mm', { locale: ptBR })
      : 'Nunca';
    const nextContactDate = client.pendingCommunication?.nextContactDate
      ? format(new Date(client.pendingCommunication.nextContactDate), 'dd/MM/yyyy', { locale: ptBR })
      : '-';

    return (
      <Card key={client.id} className={`mb-3 ${hasPending ? 'border-l-4 border-l-green-500' : ''}`}>
        <CardContent className="pt-4">
          <div className="space-y-3">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg">{client.name}</h3>
                  <Badge variant="outline" className="text-xs">
                    {getCustomerTypeLabel(client.customerType)}
                  </Badge>
                  {client.manuallyUnblocked && (
                    <Badge className="bg-green-100 text-green-800 text-xs">🔓 Liberado</Badge>
                  )}
                </div>
                <p className="text-sm text-gray-600">{client.city}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-gray-50 p-3 rounded">
                <div className="flex items-center gap-2 mb-2">
                  <Phone className="h-4 w-4 text-blue-600" />
                  <span className="font-mono font-medium">{client.phone}</span>
                  <Button size="sm" variant="ghost" onClick={() => copyPhone(client.phone)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                {client.email && (
                  <p className="text-xs text-gray-600">📧 {client.email}</p>
                )}
              </div>

              <div className="bg-blue-50 p-3 rounded">
                <p className="text-xs font-medium text-gray-700 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Último contato: <span className="font-bold">{lastContactDate}</span>
                </p>
                {hasPending && (
                  <p className="text-xs font-medium text-blue-700 flex items-center gap-1 mt-1">
                    <Calendar className="h-3 w-3" />
                    Próximo: <span className="font-bold">{nextContactDate}</span>
                  </p>
                )}
              </div>
            </div>

            {hasPending && (
              <div className="bg-green-50 p-3 rounded border border-green-200">
                <p className="text-sm font-medium text-green-800 mb-1">
                  ✅ Follow-up Programado: {getFrequencyLabel(client.pendingCommunication!.frequency || '')}
                </p>
                <p className="text-xs text-gray-700">{client.pendingCommunication!.description}</p>
              </div>
            )}

            <div className="flex gap-2">
              {hasPending ? (
                <>
                  <Button
                    onClick={() => handleScheduleContact(client)}
                    variant="outline"
                    className="flex-1 border-blue-500 text-blue-600"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Editar Frequência
                  </Button>
                  <Button
                    onClick={() => handleCancelSchedule(client)}
                    variant="outline"
                    className="border-red-500 text-red-600"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => handleScheduleContact(client)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Programar Follow-up
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const totalPending = summary.overdueBoletos + summary.inactiveClients + summary.orderFollowup + summary.custom;

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <RefreshCw className="h-12 w-12 animate-spin mx-auto text-blue-600 mb-4" />
            <p className="text-lg">Carregando...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Cabeçalho */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="outline" onClick={() => router.push('/admin')} className="flex items-center gap-2">
            <Home className="h-4 w-4" />
            Página Inicial
          </Button>
          <Button variant="outline" onClick={() => router.back()} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </div>

        <Card className="bg-gradient-to-r from-green-500 to-blue-600 text-white">
          <CardHeader>
            <CardTitle className="text-3xl flex items-center gap-3">
              <MessageCircle className="h-8 w-8" />
              Checklist de WhatsApp
            </CardTitle>
            <CardDescription className="text-white/90 text-lg">
              Gerencie comunicações com clientes • Envie mensagens pelo celular
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Botão Atualizar */}
      <div className="mb-6 flex justify-end">
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Atualizando...' : 'Atualizar Lista'}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="checklist" className="text-lg">
            📋 Checklist Automático
            {totalPending > 0 && (
              <Badge className="ml-2 bg-red-500 text-white">{totalPending}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="all-clients" className="text-lg">
            <Users className="h-5 w-5 mr-2" />
            Todos os Clientes
            <Badge className="ml-2" variant="outline">{allClients.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Checklist Automático */}
        <TabsContent value="checklist" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>📊 Resumo</CardTitle>
              <CardDescription>
                Comunicações geradas automaticamente pelo sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-red-50 rounded">
                  <p className="text-2xl font-bold text-red-600">{summary.overdueBoletos}</p>
                  <p className="text-sm text-gray-600">Pagamentos Atrasados</p>
                  <p className="text-xs text-gray-500 mt-1">(Boletos, PIX, etc)</p>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded">
                  <p className="text-2xl font-bold text-yellow-600">{summary.inactiveClients}</p>
                  <p className="text-sm text-gray-600">Clientes Inativos</p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded">
                  <p className="text-2xl font-bold text-blue-600">{summary.orderFollowup}</p>
                  <p className="text-sm text-gray-600">Follow-up</p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded">
                  <p className="text-2xl font-bold text-purple-600">{summary.custom}</p>
                  <p className="text-sm text-gray-600">Personalizadas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {totalPending === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <CheckCircle2 className="h-16 w-16 mx-auto text-green-500 mb-4" />
                <h3 className="text-2xl font-bold mb-2">🎉 Tudo em dia!</h3>
                <p className="text-gray-600">Não há comunicações automáticas pendentes no momento.</p>
                <p className="text-sm text-gray-500 mt-2">
                  Veja a aba "Todos os Clientes" para programar follow-ups personalizados.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div>
              {communications.OVERDUE_BOLETO.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    💳 Pagamentos Atrasados
                    <Badge variant="outline">{communications.OVERDUE_BOLETO.length}</Badge>
                  </h2>
                  <p className="text-sm text-gray-600 mb-4">Boletos, PIX, Transferências, Dinheiro e outros</p>
                  {communications.OVERDUE_BOLETO.map(renderCommunicationCard)}
                </div>
              )}

              {communications.INACTIVE_CLIENT.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    😴 Clientes Inativos
                    <Badge variant="outline">{communications.INACTIVE_CLIENT.length}</Badge>
                  </h2>
                  {communications.INACTIVE_CLIENT.map(renderCommunicationCard)}
                </div>
              )}

              {communications.ORDER_FOLLOWUP.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    📦 Follow-up de Pedidos
                    <Badge variant="outline">{communications.ORDER_FOLLOWUP.length}</Badge>
                  </h2>
                  {communications.ORDER_FOLLOWUP.map(renderCommunicationCard)}
                </div>
              )}

              {communications.CUSTOM.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    ✏️ Personalizadas
                    <Badge variant="outline">{communications.CUSTOM.length}</Badge>
                  </h2>
                  {communications.CUSTOM.map(renderCommunicationCard)}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: Todos os Clientes */}
        <TabsContent value="all-clients" className="space-y-4">
          {/* Filtros */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Buscar</Label>
                  <Input
                    placeholder="Nome, telefone ou cidade..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Tipo de Cliente</Label>
                  <Select value={clientFilter} onValueChange={setClientFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos</SelectItem>
                      <SelectItem value="NORMAL">Atacado</SelectItem>
                      <SelectItem value="CONSUMIDOR_FINAL">Consumidor Final</SelectItem>
                      <SelectItem value="CASUAL">Casual</SelectItem>
                      <SelectItem value="VAREJO">Varejo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resumo */}
          <Card className="bg-blue-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-blue-600">{filteredClients.length}</p>
                  <p className="text-sm text-gray-600">clientes encontrados</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-green-600">
                    {filteredClients.filter(c => c.pendingCommunication).length}
                  </p>
                  <p className="text-sm text-gray-600">com follow-up programado</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Clientes */}
          {filteredClients.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Users className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-xl font-bold mb-2">Nenhum cliente encontrado</h3>
                <p className="text-gray-600">Tente ajustar os filtros de busca.</p>
              </CardContent>
            </Card>
          ) : (
            <div>{filteredClients.map(renderClientRow)}</div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog: Programar Follow-up */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>📅 Programar Follow-up</DialogTitle>
            <DialogDescription>
              Configure a frequência de contato para {selectedClient?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Frequência de Contato</Label>
              <Select value={scheduleFrequency} onValueChange={setScheduleFrequency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAILY">📅 Diário (todo dia)</SelectItem>
                  <SelectItem value="EVERY_3_DAYS">📅 A cada 3 dias</SelectItem>
                  <SelectItem value="WEEKLY">📅 Semanal (7 dias)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                O sistema vai lembrar quando chegar a data do próximo contato
              </p>
            </div>

            <div>
              <Label>Descrição/Motivo (opcional)</Label>
              <Textarea
                placeholder="Ex: Verificar se vai fazer pedido essa semana"
                value={scheduleDescription}
                onChange={(e) => setScheduleDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveSchedule} className="bg-blue-600">
              <Calendar className="h-4 w-4 mr-2" />
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
