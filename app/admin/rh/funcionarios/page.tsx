'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { UserPlus, Edit, Trash2, ArrowLeft, FileText, Upload, X, Download } from 'lucide-react';
import { toast } from 'sonner';

export default function EmployeesPage() {
  const router = useRouter();
  const { data: session, status } = useSession() || {};
  const [employees, setEmployees] = useState<any[]>([]);

  const [sellers, setSellers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [formData, setFormData] = useState({
    employeeNumber: '', name: '', cpf: '', position: '', salary: '',
    admissionDate: '', birthDate: '', departmentName: '', status: 'ACTIVE', email: '', phone: '',
    receivesAdvance: false, password: '', creditLimit: '', sellerId: '', isDeliveryPerson: false,
    isSupervisor: false, isManager: false, isCEO: false, supervisorId: '', managerId: ''
  });

  // Estados para documentos
  const [showDocumentsDialog, setShowDocumentsDialog] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [documentForm, setDocumentForm] = useState({
    documentType: 'ADVERTENCIA',
    title: '',
    description: '',
    referenceDate: new Date().toISOString().split('T')[0],
    file: null as File | null,
  });

  useEffect(() => {
    // Aguardar carregar a sessão antes de fazer qualquer verificação
    if (status === 'loading') {
      return;
    }
    
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }
    
    const userType = (session?.user as any)?.userType;
    if (userType !== 'ADMIN') {
      router.push('/');
      return;
    }
    
    loadData();
  }, [session, status]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [employeesRes, sellersRes] = await Promise.all([
        fetch('/api/hr/employees'),
        fetch('/api/sellers'),
      ]);
      setEmployees(await employeesRes.json());
      const sellersData = await sellersRes.json();
      setSellers(sellersData.sellers || sellersData || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (employee?: any) => {
    if (employee) {
      setEditingEmployee(employee);
      setFormData({
        employeeNumber: employee.employeeNumber.toString(),
        name: employee.name,
        cpf: employee.cpf,
        position: employee.position,
        salary: employee.salary?.toString() || '',
        admissionDate: employee.admissionDate.split('T')[0],
        birthDate: employee.birthDate ? employee.birthDate.split('T')[0] : '',
        departmentName: employee.departmentName || employee.department?.name || '',
        status: employee.status,
        email: employee.email || '',
        phone: employee.phone || '',
        receivesAdvance: employee.receivesAdvance || false,
        password: '', // Nunca mostra senha existente
        creditLimit: employee.creditLimit?.toString() || '0',
        sellerId: employee.sellerId || '',
        isDeliveryPerson: employee.isDeliveryPerson || false,
        isSupervisor: employee.isSupervisor || false,
        isManager: employee.isManager || false,
        isCEO: employee.isCEO || false,
        supervisorId: employee.supervisorId || '',
        managerId: employee.managerId || ''
      });
    } else {
      setEditingEmployee(null);
      setFormData({
        employeeNumber: '', name: '', cpf: '', position: '', salary: '',
        admissionDate: new Date().toISOString().split('T')[0], birthDate: '',
        departmentName: '', status: 'ACTIVE', email: '', phone: '',
        receivesAdvance: false, password: '', creditLimit: '0', sellerId: '', isDeliveryPerson: false,
        isSupervisor: false, isManager: false, isCEO: false, supervisorId: '', managerId: ''
      });
    }
    setShowDialog(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // DEBUG: Log do formData antes de enviar
      console.log('📤 Enviando dados do formulário:', formData);
      console.log('🚀 isDeliveryPerson value:', formData.isDeliveryPerson, 'type:', typeof formData.isDeliveryPerson);
      
      const url = editingEmployee
        ? `/api/hr/employees/${editingEmployee.id}`
        : '/api/hr/employees';
      const method = editingEmployee ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      // DEBUG: Log da resposta
      console.log('📥 Resposta status:', response.status, response.ok ? '✅' : '❌');

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao salvar funcionário');
      }

      toast.success(editingEmployee ? 'Funcionário atualizado!' : 'Funcionário cadastrado!');
      setShowDialog(false);
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar funcionário');
    }
  };

  const handleDelete = async (employee: any) => {
    if (!confirm(`Deseja realmente excluir ${employee.name}?`)) return;

    try {
      const response = await fetch(`/api/hr/employees/${employee.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Erro ao excluir funcionário');

      toast.success('Funcionário excluído!');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir funcionário');
    }
  };

  // Funções para documentos
  const handleOpenDocuments = async (employee: any) => {
    setSelectedEmployee(employee);
    setShowDocumentsDialog(true);
    loadDocuments(employee.id);
  };

  const loadDocuments = async (employeeId: string) => {
    try {
      setLoadingDocuments(true);
      const response = await fetch(`/api/hr/employees/${employeeId}/documents`);
      if (!response.ok) throw new Error('Erro ao carregar documentos');
      const data = await response.json();
      setDocuments(data);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar documentos');
    } finally {
      setLoadingDocuments(false);
    }
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentForm.file || !selectedEmployee) return;

    try {
      setUploadingFile(true);
      const formData = new FormData();
      formData.append('file', documentForm.file);
      formData.append('documentType', documentForm.documentType);
      formData.append('title', documentForm.title);
      formData.append('description', documentForm.description);
      formData.append('referenceDate', documentForm.referenceDate);

      const response = await fetch(`/api/hr/employees/${selectedEmployee.id}/documents`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Erro ao fazer upload');

      toast.success('Documento enviado com sucesso!');
      setDocumentForm({
        documentType: 'ADVERTENCIA',
        title: '',
        description: '',
        referenceDate: new Date().toISOString().split('T')[0],
        file: null,
      });
      loadDocuments(selectedEmployee.id);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao fazer upload');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('Deseja realmente excluir este documento?')) return;
    if (!selectedEmployee) return;

    try {
      const response = await fetch(`/api/hr/employees/${selectedEmployee.id}/documents/${docId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Erro ao excluir documento');

      toast.success('Documento excluído!');
      loadDocuments(selectedEmployee.id);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir documento');
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    const labels: any = {
      CONTRACHEQUE: 'Contracheque',
      ADVERTENCIA: 'Advertência',
      SUSPENSAO: 'Suspensão',
      PREMIACAO: 'Premiação',
      COMPROVANTE: 'Comprovante',
      OUTROS: 'Outros',
    };
    return labels[type] || type;
  };

  const getDocumentTypeBadge = (type: string) => {
    const colors: any = {
      ADVERTENCIA: 'bg-red-500',
      SUSPENSAO: 'bg-orange-500',
      PREMIACAO: 'bg-green-500',
      CONTRACHEQUE: 'bg-blue-500',
      COMPROVANTE: 'bg-gray-500',
      OUTROS: 'bg-purple-500',
    };
    return colors[type] || 'bg-gray-500';
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
    </div>;
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Gerenciamento de Funcionários</h1>
          <p className="text-gray-500 mt-1">Cadastre e gerencie os funcionários</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/admin/rh')}>
            <ArrowLeft className="w-4 h-4 mr-2" />Voltar
          </Button>
          <Button onClick={() => handleOpenDialog()}>
            <UserPlus className="w-4 h-4 mr-2" />Novo Funcionário
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell>{employee.employeeNumber}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => handleOpenDocuments(employee)}
                        className="text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer text-left"
                      >
                        {employee.name}
                      </button>
                      <div className="flex flex-wrap gap-1">
                        {employee.isCEO && <Badge className="bg-red-600 text-[10px] px-1.5">👑 CEO</Badge>}
                        {employee.isManager && <Badge className="bg-amber-500 text-[10px] px-1.5">👔 Gerente</Badge>}
                        {employee.isSupervisor && <Badge className="bg-purple-500 text-[10px] px-1.5">Encarregado</Badge>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{employee.cpf}</TableCell>
                  <TableCell>{employee.position}</TableCell>
                  <TableCell>{employee.departmentName || employee.department?.name || '-'}</TableCell>
                  <TableCell>
                    <Badge className={employee.status === 'ACTIVE' ? 'bg-green-500' : 'bg-red-500'}>
                      {employee.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleOpenDialog(employee)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(employee)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEmployee ? 'Editar Funcionário' : 'Novo Funcionário'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Número *</Label>
                <Input type="number" required value={formData.employeeNumber}
                  onChange={(e) => setFormData({ ...formData, employeeNumber: e.target.value })} />
              </div>
              <div>
                <Label>Nome *</Label>
                <Input required value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div>
                <Label>CPF *</Label>
                <Input required value={formData.cpf}
                  onChange={(e) => setFormData({ ...formData, cpf: e.target.value })} />
              </div>
              <div>
                <Label>Cargo *</Label>
                <Input required value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })} />
              </div>
              <div>
                <Label>Salário</Label>
                <Input type="number" step="0.01" value={formData.salary}
                  onChange={(e) => setFormData({ ...formData, salary: e.target.value })} />
              </div>
              <div>
                <Label>Data de Admissão *</Label>
                <Input type="date" required value={formData.admissionDate}
                  onChange={(e) => setFormData({ ...formData, admissionDate: e.target.value })} />
              </div>
              <div>
                <Label>Data de Aniversário 🎂</Label>
                <Input type="date" value={formData.birthDate}
                  onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })} />
                <p className="text-xs text-orange-600 mt-1 font-medium">
                  Se trabalhar no aniversário, recebe 100% hora extra
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  💡 Apenas dia/mês será usado para verificar o aniversário todo ano (o ano serve apenas para referência).
                </p>
              </div>
              <div>
                <Label>Departamento</Label>
                <Input 
                  value={formData.departmentName}
                  onChange={(e) => setFormData({ ...formData, departmentName: e.target.value })}
                  placeholder="Ex: Produção, Administrativo, Vendas..."
                />
              </div>
              <div>
                <Label>Status *</Label>
                <Select value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Ativo</SelectItem>
                    <SelectItem value="INACTIVE">Inativo</SelectItem>
                    <SelectItem value="ON_LEAVE">De Férias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label>Senha {editingEmployee && '(deixe em branco para manter a atual)'}</Label>
                <Input 
                  type="password" 
                  placeholder={editingEmployee ? "Digite uma nova senha para alterar" : "Digite a senha"}
                  value={formData.password}
                  autoComplete="new-password"
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })} 
                />
                <p className="text-xs text-gray-500 mt-1">
                  {editingEmployee 
                    ? 'A senha será alterada apenas se você preencher este campo.'
                    : 'Esta senha será usada para o funcionário fazer login no sistema.'
                  }
                </p>
              </div>
              <div className="md:col-span-2">
                <div className="flex items-center space-x-2 border rounded-lg p-4 bg-orange-50">
                  <Checkbox 
                    id="receivesAdvance" 
                    checked={formData.receivesAdvance}
                    onCheckedChange={(checked) => setFormData({ ...formData, receivesAdvance: checked as boolean })}
                  />
                  <label
                    htmlFor="receivesAdvance"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Recebe adiantamento de 40% do salário
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Marque esta opção se o funcionário deseja receber 40% do salário adiantado. 
                  Isso será considerado ao processar a folha de pagamento.
                </p>
              </div>
              <div>
                <Label htmlFor="creditLimit">Crédito Disponível (R$)</Label>
                <Input 
                  id="creditLimit" 
                  type="text"
                  inputMode="decimal"
                  value={formData.creditLimit} 
                  onChange={(e) => {
                    // Permite apenas números, vírgula e ponto
                    const value = e.target.value.replace(/[^0-9.,]/g, '');
                    setFormData({ ...formData, creditLimit: value });
                  }} 
                  placeholder="300"
                />
                <p className="text-xs text-blue-600 mt-1 font-medium">
                  💰 O limite base do funcionário é R$ 300,00
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Este valor mostra o crédito disponível atual. Quando o funcionário faz compras, o valor diminui. 
                  Para restaurar para R$ 300, digite 300.
                </p>
              </div>
              <div className="md:col-span-2">
                <Label>Vincular ao Perfil de Vendedor</Label>
                <Select 
                  value={formData.sellerId || "no-seller"}
                  onValueChange={(value) => setFormData({ ...formData, sellerId: value === "no-seller" ? '' : value })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione um vendedor..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no-seller">Nenhum (Apenas funcionário)</SelectItem>
                    {sellers.map((seller) => (
                      <SelectItem key={seller.id} value={seller.id}>
                        {seller.name} - CPF: {seller.cpf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-2">
                  Se você vincular este funcionário a um vendedor, ele poderá fazer login como vendedor e acessar o painel de vendas.
                  Isso permite que o funcionário também atue como vendedor, podendo fazer pedidos para clientes ou para si mesmo.
                </p>
              </div>
              <div className="md:col-span-2">
                <div className="flex items-center space-x-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <input 
                    type="checkbox" 
                    id="isDeliveryPerson"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                    checked={formData.isDeliveryPerson} 
                    onChange={(e) => {
                      console.log('✅ Checkbox alterado! Novo valor:', e.target.checked);
                      setFormData({ ...formData, isDeliveryPerson: e.target.checked });
                    }} 
                  />
                  <div className="flex-1">
                    <Label htmlFor="isDeliveryPerson" className="font-semibold text-blue-900 cursor-pointer">
                      Funcionário é Entregador
                    </Label>
                    <p className="text-xs text-blue-700 mt-1">
                      Ao marcar esta opção, o funcionário terá acesso ao painel de entregas e poderá gerenciar a entrega dos pedidos.
                    </p>
                  </div>
                </div>
              </div>
              {/* Campo Encarregado/Supervisor */}
              <div className="md:col-span-2">
                <div className="flex items-center space-x-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <input 
                    type="checkbox" 
                    id="isSupervisor"
                    className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500" 
                    checked={formData.isSupervisor} 
                    onChange={(e) => setFormData({ ...formData, isSupervisor: e.target.checked })} 
                  />
                  <div className="flex-1">
                    <Label htmlFor="isSupervisor" className="font-semibold text-purple-900 cursor-pointer">
                      É Encarregado/Supervisor
                    </Label>
                    <p className="text-xs text-purple-700 mt-1">
                      Encarregados podem avaliar outros funcionários sob sua supervisão e dar feedback de desempenho.
                    </p>
                  </div>
                </div>
              </div>
              {/* Campo Gerente */}
              <div className="md:col-span-2">
                <div className="flex items-center space-x-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <input 
                    type="checkbox" 
                    id="isManager"
                    className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500" 
                    checked={formData.isManager} 
                    onChange={(e) => setFormData({ ...formData, isManager: e.target.checked })} 
                  />
                  <div className="flex-1">
                    <Label htmlFor="isManager" className="font-semibold text-amber-900 cursor-pointer">
                      👔 É Gerente
                    </Label>
                    <p className="text-xs text-amber-700 mt-1">
                      Gerentes podem avaliar todos os funcionários e supervisores. Também recebem avaliações de todos abaixo na hierarquia.
                    </p>
                  </div>
                </div>
              </div>
              {/* Campo CEO */}
              <div className="md:col-span-2">
                <div className="flex items-center space-x-3 p-4 bg-red-50 rounded-lg border border-red-200">
                  <input 
                    type="checkbox" 
                    id="isCEO"
                    className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500" 
                    checked={formData.isCEO} 
                    onChange={(e) => setFormData({ ...formData, isCEO: e.target.checked })} 
                  />
                  <div className="flex-1">
                    <Label htmlFor="isCEO" className="font-semibold text-red-900 cursor-pointer">
                      👑 É CEO/Proprietário
                    </Label>
                    <p className="text-xs text-red-700 mt-1">
                      CEO pode avaliar toda a organização. Recebe avaliações de todos os funcionários (podem ser anônimas).
                    </p>
                  </div>
                </div>
              </div>
              <div className="md:col-span-2">
                <Label>Encarregado/Supervisor do Funcionário</Label>
                <select
                  className="w-full h-10 px-3 mt-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  value={formData.supervisorId}
                  onChange={(e) => setFormData({ ...formData, supervisorId: e.target.value })}
                >
                  <option value="">Sem supervisor definido</option>
                  {employees
                    .filter((emp: any) => emp.isSupervisor && emp.id !== editingEmployee?.id)
                    .map((emp: any) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} (#{emp.employeeNumber})
                      </option>
                    ))
                  }
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  O supervisor é quem fará a avaliação diária deste funcionário.
                </p>
              </div>
              <div className="md:col-span-2">
                <Label>Gerente Responsável</Label>
                <select
                  className="w-full h-10 px-3 mt-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  value={formData.managerId}
                  onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                >
                  <option value="">Sem gerente definido</option>
                  {employees
                    .filter((emp: any) => (emp.isManager || emp.isCEO) && emp.id !== editingEmployee?.id)
                    .map((emp: any) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} {emp.isCEO ? '(CEO)' : '(Gerente)'} (#{emp.employeeNumber})
                      </option>
                    ))
                  }
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  O gerente é responsável por avaliar este funcionário (se for supervisor) ou por receber avaliações do funcionário.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit">{editingEmployee ? 'Atualizar' : 'Cadastrar'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Documentos */}
      <Dialog open={showDocumentsDialog} onOpenChange={setShowDocumentsDialog}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Documentos de {selectedEmployee?.name}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="upload">
                <Upload className="w-4 h-4 mr-2" />
                Enviar Documento
              </TabsTrigger>
              <TabsTrigger value="advertencias">
                <FileText className="w-4 h-4 mr-2" />
                Advertências & Suspensões
              </TabsTrigger>
              <TabsTrigger value="outros">
                <FileText className="w-4 h-4 mr-2" />
                Outros Documentos
              </TabsTrigger>
            </TabsList>

            {/* Aba de Upload */}
            <TabsContent value="upload" className="space-y-4">
              <form onSubmit={handleUploadDocument} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Tipo de Documento *</Label>
                    <Select
                      value={documentForm.documentType}
                      onValueChange={(value) => setDocumentForm({ ...documentForm, documentType: value })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADVERTENCIA">Advertência</SelectItem>
                        <SelectItem value="SUSPENSAO">Suspensão</SelectItem>
                        <SelectItem value="CONTRACHEQUE">Contracheque</SelectItem>
                        <SelectItem value="PREMIACAO">Premiação</SelectItem>
                        <SelectItem value="COMPROVANTE">Comprovante</SelectItem>
                        <SelectItem value="OUTROS">Outros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Título *</Label>
                    <Input
                      required
                      placeholder="Ex: Advertência por atraso"
                      value={documentForm.title}
                      onChange={(e) => setDocumentForm({ ...documentForm, title: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Data de Referência</Label>
                    <Input
                      type="date"
                      value={documentForm.referenceDate}
                      onChange={(e) => setDocumentForm({ ...documentForm, referenceDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Arquivo * (Imagem ou PDF)</Label>
                    <Input
                      type="file"
                      required
                      accept="image/*,application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setDocumentForm({ ...documentForm, file });
                      }}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Descrição</Label>
                    <Input
                      placeholder="Observações adicionais..."
                      value={documentForm.description}
                      onChange={(e) => setDocumentForm({ ...documentForm, description: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowDocumentsDialog(false)}>
                    Fechar
                  </Button>
                  <Button type="submit" disabled={uploadingFile}>
                    {uploadingFile ? 'Enviando...' : 'Enviar Documento'}
                  </Button>
                </div>
              </form>
            </TabsContent>

            {/* Aba de Advertências & Suspensões */}
            <TabsContent value="advertencias" className="space-y-4">
              {loadingDocuments ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents
                    .filter((doc) => ['ADVERTENCIA', 'SUSPENSAO'].includes(doc.documentType))
                    .map((doc) => (
                      <Card key={doc.id}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge className={getDocumentTypeBadge(doc.documentType)}>
                                  {getDocumentTypeLabel(doc.documentType)}
                                </Badge>
                                <span className="font-medium">{doc.title}</span>
                              </div>
                              {doc.description && (
                                <p className="text-sm text-gray-600 mb-2">{doc.description}</p>
                              )}
                              <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span>Arquivo: {doc.fileName}</span>
                                {doc.referenceDate && (
                                  <span>Data: {new Date(doc.referenceDate).toLocaleDateString('pt-BR')}</span>
                                )}
                                <span>Enviado em: {new Date(doc.createdAt).toLocaleDateString('pt-BR')}</span>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(doc.fileUrl, '_blank')}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteDocument(doc.id)}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  {documents.filter((doc) => ['ADVERTENCIA', 'SUSPENSAO'].includes(doc.documentType)).length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      Nenhuma advertência ou suspensão registrada
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Aba de Outros Documentos */}
            <TabsContent value="outros" className="space-y-4">
              {loadingDocuments ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents
                    .filter((doc) => !['ADVERTENCIA', 'SUSPENSAO'].includes(doc.documentType))
                    .map((doc) => (
                      <Card key={doc.id}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge className={getDocumentTypeBadge(doc.documentType)}>
                                  {getDocumentTypeLabel(doc.documentType)}
                                </Badge>
                                <span className="font-medium">{doc.title}</span>
                              </div>
                              {doc.description && (
                                <p className="text-sm text-gray-600 mb-2">{doc.description}</p>
                              )}
                              <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span>Arquivo: {doc.fileName}</span>
                                {doc.referenceDate && (
                                  <span>Data: {new Date(doc.referenceDate).toLocaleDateString('pt-BR')}</span>
                                )}
                                <span>Enviado em: {new Date(doc.createdAt).toLocaleDateString('pt-BR')}</span>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(doc.fileUrl, '_blank')}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteDocument(doc.id)}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  {documents.filter((doc) => !['ADVERTENCIA', 'SUSPENSAO'].includes(doc.documentType)).length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      Nenhum outro documento registrado
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
