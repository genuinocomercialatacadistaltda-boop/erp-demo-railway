'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import {
  FileText,
  Home,
  ArrowLeft,
  Trash2,
  Eye,
  Search,
  Users,
  CheckCircle2,
  Clock,
  Calendar,
  Filter,
  RefreshCw,
  AlertTriangle,
  X,
  FileCheck,
} from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  employeeNumber: number;
  position: string;
  isActive: boolean;
}

interface Timesheet {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: number;
  startDate: string;
  endDate: string;
  totalDays: number;
  workedDays: number;
  pdfUrl: string | null;
  generatedAt: string;
  acknowledgments: any[];
}

interface EmployeeDocument {
  id: string;
  employeeId: string;
  documentType: string;
  title: string;
  description: string | null;
  fileUrl: string;
  fileName: string;
  referenceDate: string | null;
  createdAt: string;
  acknowledgment: any | null;
}

// Gerar opções de mês/ano (apenas de janeiro 2026 para frente)
const generateMonthOptions = () => {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  const startDate = new Date(2026, 0, 1); // Janeiro 2026
  
  // Calcular quantos meses desde janeiro 2026 até agora
  let current = new Date(now.getFullYear(), now.getMonth(), 1);
  
  while (current >= startDate) {
    const value = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
    const label = current.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
    current = new Date(current.getFullYear(), current.getMonth() - 1, 1);
  }
  
  return options;
};

export default function DocumentosPage() {
  const router = useRouter();
  const { data: session, status } = useSession() || {};
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  
  // Filtros
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [documentTypeFilter, setDocumentTypeFilter] = useState<string>('all'); // Padrão: Todos os tipos
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all'); // Padrão: Todos os meses
  
  // Opções de mês
  const monthOptions = useMemo(() => generateMonthOptions(), []);
  
  // Dialog de confirmação
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'timesheet' | 'document'; id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }

    if ((session?.user as any)?.userType !== 'ADMIN') {
      router.push('/');
      return;
    }

    loadData();
  }, [session, status]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Carregar funcionários
      const empRes = await fetch('/api/hr/employees');
      if (empRes.ok) {
        const empData = await empRes.json();
        setEmployees(Array.isArray(empData) ? empData : []);
      }

      // Carregar folhas de ponto
      const tsRes = await fetch('/api/hr/timesheets');
      if (tsRes.ok) {
        const tsData = await tsRes.json();
        setTimesheets(Array.isArray(tsData) ? tsData : []);
      }

      // Carregar documentos
      const docRes = await fetch('/api/hr/employee-documents');
      if (docRes.ok) {
        const docData = await docRes.json();
        setDocuments(Array.isArray(docData) ? docData : []);
      }

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (type: 'timesheet' | 'document', id: string, title: string) => {
    setItemToDelete({ type, id, title });
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;

    try {
      setDeleting(true);
      
      const endpoint = itemToDelete.type === 'timesheet' 
        ? `/api/hr/timesheets/${itemToDelete.id}`
        : `/api/hr/employee-documents/${itemToDelete.id}`;
      
      const res = await fetch(endpoint, { method: 'DELETE' });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao excluir');
      }

      toast.success(`${itemToDelete.type === 'timesheet' ? 'Folha de ponto' : 'Documento'} excluído com sucesso!`);
      
      // Atualizar listas
      if (itemToDelete.type === 'timesheet') {
        setTimesheets(prev => prev.filter(t => t.id !== itemToDelete.id));
      } else {
        setDocuments(prev => prev.filter(d => d.id !== itemToDelete.id));
      }
      
    } catch (error: any) {
      console.error('Erro ao excluir:', error);
      toast.error(error.message || 'Erro ao excluir');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      // Adicionar T12:00:00 para evitar problemas de timezone UTC->local
      const date = new Date(dateString);
      date.setHours(date.getHours() + 12);
      return date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    } catch {
      return '-';
    }
  };

  // Função para formatar período corretamente (primeiro ao último dia do mês)
  const formatPeriod = (startDate: string, endDate: string) => {
    try {
      // Adicionar 12h para evitar problemas de timezone
      const start = new Date(startDate);
      start.setHours(start.getHours() + 12);
      const end = new Date(endDate);
      end.setHours(end.getHours() + 12);
      
      // Corrigir para mostrar dia 01 até último dia do mês
      const firstDay = new Date(start.getFullYear(), start.getMonth(), 1, 12, 0, 0);
      const lastDay = new Date(end.getFullYear(), end.getMonth() + 1, 0, 12, 0, 0);
      
      return `${firstDay.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} até ${lastDay.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;
    } catch {
      return `${formatDate(startDate)} até ${formatDate(endDate)}`;
    }
  };

  // Função para verificar se data está no mês selecionado
  const isInSelectedMonth = (dateStr: string) => {
    if (monthFilter === 'all') return true;
    try {
      // Adicionar 12h para evitar problemas de timezone
      const date = new Date(dateStr);
      date.setHours(date.getHours() + 12);
      const [year, month] = monthFilter.split('-').map(Number);
      return date.getFullYear() === year && date.getMonth() + 1 === month;
    } catch {
      return true;
    }
  };

  // Função para verificar se documento de folha de ponto está no mês selecionado
  // Verifica se o mês selecionado está dentro do período do documento
  const isDocumentInSelectedMonth = (doc: EmployeeDocument) => {
    if (monthFilter === 'all') return true;
    try {
      const [yearFilter, monthNumFilter] = monthFilter.split('-').map(Number);
      
      // Para FOLHA_PONTO, extrair as datas do título "Folha de Ponto - DD/MM/YYYY a DD/MM/YYYY"
      if (doc.documentType === 'FOLHA_PONTO' && doc.title) {
        const match = doc.title.match(/(\d{2})\/(\d{2})\/(\d{4})\s+a\s+(\d{2})\/(\d{2})\/(\d{4})/);
        if (match) {
          const startMonth = parseInt(match[2]);
          const startYear = parseInt(match[3]);
          const endMonth = parseInt(match[5]);
          const endYear = parseInt(match[6]);
          
          // Verificar se o mês filtrado está entre o início e fim do período
          const filterDate = new Date(yearFilter, monthNumFilter - 1, 15, 12, 0, 0);
          const startDate = new Date(startYear, startMonth - 1, 1, 12, 0, 0);
          const endDate = new Date(endYear, endMonth, 0, 12, 0, 0); // último dia do mês
          
          return filterDate >= startDate && filterDate <= endDate;
        }
      }
      
      // Fallback: usar referenceDate ou createdAt
      const dateToCheck = doc.referenceDate || doc.createdAt;
      const date = new Date(dateToCheck);
      date.setHours(date.getHours() + 12); // Evitar problemas de timezone
      return date.getFullYear() === yearFilter && date.getMonth() + 1 === monthNumFilter;
    } catch {
      return true;
    }
  };

  // Filtrar folhas de ponto (apenas se tipo for TIMESHEET ou all)
  const filteredTimesheets = useMemo(() => {
    // Mostrar timesheets apenas para TIMESHEET ou all (não para FOLHA_PONTO que são documentos)
    if (documentTypeFilter !== 'TIMESHEET' && documentTypeFilter !== 'all') {
      return [];
    }
    
    return timesheets.filter(ts => {
      if (selectedEmployee !== 'all' && ts.employeeId !== selectedEmployee) return false;
      if (searchTerm && !ts.employeeName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (statusFilter === 'signed' && ts.acknowledgments.length === 0) return false;
      if (statusFilter === 'pending' && ts.acknowledgments.length > 0) return false;
      // Filtro de mês - usa startDate da folha de ponto
      if (monthFilter !== 'all' && !isInSelectedMonth(ts.startDate)) return false;
      return true;
    });
  }, [timesheets, selectedEmployee, searchTerm, statusFilter, monthFilter, documentTypeFilter]);

  // Filtrar documentos (FOLHA_PONTO são os PDFs que vão para o funcionário assinar)
  const filteredDocuments = useMemo(() => {
    // Quando filtro é TIMESHEET, não mostrar documentos
    if (documentTypeFilter === 'TIMESHEET') {
      return [];
    }
    
    return documents.filter(doc => {
      if (selectedEmployee !== 'all' && doc.employeeId !== selectedEmployee) return false;
      if (searchTerm) {
        const emp = employees.find(e => e.id === doc.employeeId);
        if (!emp?.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
            !doc.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      }
      // Filtrar por tipo de documento específico
      if (documentTypeFilter !== 'all') {
        // FOLHA_PONTO filtra apenas documentos com documentType = FOLHA_PONTO
        if (doc.documentType !== documentTypeFilter) return false;
      }
      if (statusFilter === 'signed' && !doc.acknowledgment) return false;
      if (statusFilter === 'pending' && doc.acknowledgment) return false;
      // Filtro de mês - usa lógica inteligente para FOLHA_PONTO
      if (monthFilter !== 'all') {
        if (!isDocumentInSelectedMonth(doc)) return false;
      }
      return true;
    });
  }, [documents, employees, selectedEmployee, searchTerm, documentTypeFilter, statusFilter, monthFilter]);
  
  // Limpar todos os filtros
  const clearAllFilters = () => {
    setSelectedEmployee('all');
    setSearchTerm('');
    setDocumentTypeFilter('all');
    setStatusFilter('all');
    setMonthFilter('all');
  };
  
  // Verificar se há filtros ativos (comparado com valores padrão)
  const hasActiveFilters = selectedEmployee !== 'all' || searchTerm !== '' || 
    documentTypeFilter !== 'all' || statusFilter !== 'all' || monthFilter !== 'all';

  const getEmployeeName = (employeeId: string) => {
    const emp = employees.find(e => e.id === employeeId);
    return emp?.name || 'Funcionário não encontrado';
  };

  const getEmployeeNumber = (employeeId: string) => {
    const emp = employees.find(e => e.id === employeeId);
    return emp?.employeeNumber || 0;
  };

  const getDocumentTypeName = (type: string) => {
    const types: Record<string, string> = {
      'TIMESHEET': 'Folha de Ponto',
      'FOLHA_PONTO': 'Folha de Ponto',
      'PAYSLIP': 'Contracheque',
      'CONTRACHEQUE': 'Contracheque',
      'CONTRACT': 'Contrato',
      'CERTIFICATE': 'Certificado',
      'WARNING': 'Advertência',
      'VACATION': 'Férias',
      'OTHER': 'Outro',
    };
    return types[type] || type;
  };

  // Estatísticas filtradas pelo mês selecionado
  const stats = useMemo(() => {
    const tsInMonth = timesheets.filter(ts => isInSelectedMonth(ts.startDate));
    // Usar lógica inteligente para documentos (especialmente FOLHA_PONTO)
    const docsInMonth = documents.filter(doc => isDocumentInSelectedMonth(doc));
    
    return {
      totalTimesheets: tsInMonth.length,
      pendingTimesheets: tsInMonth.filter(t => t.acknowledgments.length === 0).length,
      totalDocuments: docsInMonth.length,
      pendingDocuments: docsInMonth.filter(d => !d.acknowledgment).length,
      employeesWithDocs: new Set([...tsInMonth.map(t => t.employeeId), ...docsInMonth.map(d => d.employeeId)]).size,
    };
  }, [timesheets, documents, monthFilter]);

  // Função para visualizar documento/folha de ponto
  const handleViewDocument = async (type: 'timesheet' | 'document', item: Timesheet | EmployeeDocument) => {
    try {
      if (type === 'timesheet') {
        const ts = item as Timesheet;
        if (ts.pdfUrl) {
          // Verificar se é uma URL assinada ou um S3 key
          if (ts.pdfUrl.startsWith('http')) {
            window.open(ts.pdfUrl, '_blank');
          } else {
            // Buscar URL assinada
            const res = await fetch(`/api/hr/timesheets/${ts.id}/pdf`);
            if (res.ok) {
              const data = await res.json();
              window.open(data.url, '_blank');
            } else {
              toast.error('Erro ao carregar PDF da folha de ponto');
            }
          }
        } else {
          toast.error('PDF não disponível para esta folha de ponto');
        }
      } else {
        const doc = item as EmployeeDocument;
        if (doc.fileUrl) {
          if (doc.fileUrl.startsWith('http')) {
            window.open(doc.fileUrl, '_blank');
          } else {
            // Buscar URL assinada
            const res = await fetch(`/api/hr/employee-documents/${doc.id}/view`);
            if (res.ok) {
              const data = await res.json();
              window.open(data.url, '_blank');
            } else {
              toast.error('Erro ao carregar documento');
            }
          }
        } else {
          toast.error('Arquivo não disponível');
        }
      }
    } catch (error) {
      console.error('Erro ao visualizar:', error);
      toast.error('Erro ao abrir documento');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-8 h-8 text-purple-600" />
            Gerenciar Documentos
          </h1>
          <p className="text-gray-500 mt-1">
            Controle total sobre documentos e folhas de ponto dos funcionários
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/admin/rh')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao RH
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push('/admin')}
          >
            <Home className="w-4 h-4 mr-2" />
            Página Inicial
          </Button>
        </div>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Folhas de Ponto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTimesheets}</div>
            <p className="text-xs text-orange-600 mt-1">
              {stats.pendingTimesheets} pendentes de assinatura
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Documentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDocuments}</div>
            <p className="text-xs text-orange-600 mt-1">
              {stats.pendingDocuments} pendentes de assinatura
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Funcionários</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.employeesWithDocs}</div>
            <p className="text-xs text-gray-500 mt-1">
              Com documentos no período
            </p>
          </CardContent>
        </Card>

        <Card className="bg-orange-50 border-orange-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Atenção
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-orange-700">
              Excluir documentos remove permanentemente do perfil do funcionário.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <Label>Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Nome do funcionário..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label>Funcionário</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os funcionários</SelectItem>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name} (#{emp.employeeNumber})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tipo de Documento</Label>
              <Select value={documentTypeFilter} onValueChange={setDocumentTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="FOLHA_PONTO">📋 Folha de Ponto</SelectItem>
                  <SelectItem value="CONTRACHEQUE">💰 Contracheque</SelectItem>
                  <SelectItem value="CONTRACT">📄 Contrato</SelectItem>
                  <SelectItem value="CERTIFICATE">🎓 Certificado</SelectItem>
                  <SelectItem value="WARNING">⚠️ Advertência</SelectItem>
                  <SelectItem value="VACATION">🏖️ Férias</SelectItem>
                  <SelectItem value="OTHER">📎 Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Status de Assinatura</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">⏳ Pendente</SelectItem>
                  <SelectItem value="signed">✅ Assinado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Mês de Referência</Label>
              <Select value={monthFilter} onValueChange={setMonthFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o mês" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os meses</SelectItem>
                  {monthOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Botões de ação dos filtros */}
          <div className="flex items-center gap-3 mt-4">
            <Button onClick={loadData} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
            
            <Button onClick={clearAllFilters} variant="outline" className="text-red-600 border-red-300 hover:bg-red-50">
              <X className="w-4 h-4 mr-2" />
              Limpar Filtros
            </Button>
          </div>
          
          {/* Indicador de filtros ativos */}
          {hasActiveFilters && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">Filtros ativos:</span>
                {monthFilter !== '2026-01' && monthFilter !== 'all' && (
                  <Badge variant="secondary" className="bg-blue-100">
                    {monthOptions.find(m => m.value === monthFilter)?.label || monthFilter}
                  </Badge>
                )}
                {selectedEmployee !== 'all' && (
                  <Badge variant="secondary" className="bg-blue-100">
                    {employees.find(e => e.id === selectedEmployee)?.name}
                  </Badge>
                )}
                {documentTypeFilter !== 'TIMESHEET' && (
                  <Badge variant="secondary" className="bg-blue-100">
                    {getDocumentTypeName(documentTypeFilter)}
                  </Badge>
                )}
                {statusFilter !== 'all' && (
                  <Badge variant="secondary" className="bg-blue-100">
                    {statusFilter === 'pending' ? 'Pendente' : 'Assinado'}
                  </Badge>
                )}
                {searchTerm && (
                  <Badge variant="secondary" className="bg-blue-100">
                    Busca: "{searchTerm}"
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumo do que está sendo exibido */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
        <p className="text-sm text-gray-600">
          Exibindo: <strong>{getDocumentTypeName(documentTypeFilter)}</strong>
          {monthFilter !== 'all' && (
            <> • Período: <strong>{monthOptions.find(m => m.value === monthFilter)?.label}</strong></>
          )}
          {documentTypeFilter === 'TIMESHEET' || documentTypeFilter === 'all' ? (
            <> • <strong>{filteredTimesheets.length}</strong> folha(s) de ponto</>
          ) : null}
          {documentTypeFilter !== 'TIMESHEET' ? (
            <> • <strong>{filteredDocuments.length}</strong> documento(s)</>
          ) : null}
        </p>
      </div>

      {/* Tabela de Folhas de Ponto (só mostra se tipo for TIMESHEET ou all) */}
      {(documentTypeFilter === 'TIMESHEET' || documentTypeFilter === 'all') && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-green-600" />
              Folhas de Ponto ({filteredTimesheets.length})
            </CardTitle>
            <CardDescription>
              Gerencie as folhas de ponto que aparecem para os funcionários assinarem
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredTimesheets.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Nenhuma folha de ponto encontrada para o período selecionado</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Dias Trabalhados</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Gerado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTimesheets.map((ts) => (
                    <TableRow key={ts.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-gray-400" />
                          <div>
                            <p>{ts.employeeName}</p>
                            <p className="text-xs text-gray-500">#{ts.employeeNumber}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{formatPeriod(ts.startDate, ts.endDate)}</TableCell>
                      <TableCell>{ts.workedDays}/{ts.totalDays} dias</TableCell>
                      <TableCell>
                        {ts.acknowledgments.length > 0 ? (
                          <Badge className="bg-green-100 text-green-700">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Assinado
                          </Badge>
                        ) : (
                          <Badge className="bg-orange-100 text-orange-700">
                            <Clock className="w-3 h-3 mr-1" />
                            Pendente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(ts.generatedAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewDocument('timesheet', ts)}
                            title="Visualizar PDF"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteClick('timesheet', ts.id, `Folha de ${ts.employeeName} (${formatPeriod(ts.startDate, ts.endDate)})`)} 
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabela de Documentos (só mostra se tipo NÃO for TIMESHEET) */}
      {documentTypeFilter !== 'TIMESHEET' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-blue-600" />
              {getDocumentTypeName(documentTypeFilter)} ({filteredDocuments.length})
            </CardTitle>
            <CardDescription>
              Gerencie contracheques, contratos e outros documentos dos funcionários
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredDocuments.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Nenhum documento encontrado para o período selecionado</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Referência</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocuments.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-gray-400" />
                          <div>
                            <p>{getEmployeeName(doc.employeeId)}</p>
                            <p className="text-xs text-gray-500">#{getEmployeeNumber(doc.employeeId)}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getDocumentTypeName(doc.documentType)}
                        </Badge>
                      </TableCell>
                      <TableCell>{doc.title}</TableCell>
                      <TableCell>
                        {doc.referenceDate ? formatDate(doc.referenceDate) : '-'}
                      </TableCell>
                      <TableCell>
                        {doc.acknowledgment ? (
                          <Badge className="bg-green-100 text-green-700">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Assinado
                          </Badge>
                        ) : (
                          <Badge className="bg-orange-100 text-orange-700">
                            <Clock className="w-3 h-3 mr-1" />
                            Pendente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(doc.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewDocument('document', doc)}
                            title="Visualizar documento"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteClick('document', doc.id, `${getDocumentTypeName(doc.documentType)}: ${doc.title}`)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a excluir:
              <br />
              <strong className="text-gray-900">{itemToDelete?.title}</strong>
              <br /><br />
              Esta ação é <strong>irreversível</strong>. O documento será removido permanentemente do perfil do funcionário e ele não poderá mais assiná-lo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Excluindo...' : 'Excluir Permanentemente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
