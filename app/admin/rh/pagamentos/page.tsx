'use client';

import { useState, useEffect } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  Upload,
  FileText,
  DollarSign,
  Calendar,
  CheckCircle2,
  XCircle,
  Eye,
  Home,
  ArrowLeft,
  Plus,
  Download,
  Edit,
  Save,
  Trash2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

interface ExtractedEmployee {
  name: string;
  cpf: string;
  salaryAmount: number;
  advanceAmount: number;
  foodVoucherAmount: number;
  bonusAmount: number;
  deductions: number;
  netAmount: number;
  notes: string;
  rawData?: string[];
  discountItems?: Array<{description: string, amount: number}>; // Descontos individuais editáveis
  earningsItems?: Array<{description: string, amount: number}>; // Vencimentos adicionais (Hora Extra, DSR, etc.)
  employeeId?: string; // Será preenchido ao associar com funcionário cadastrado
  matched?: boolean; // Se foi encontrado no cadastro
}

interface PayrollSheet {
  id: string;
  month: number;
  year: number;
  fileName: string;
  fileUrl: string;
  uploadedBy: string;
  isProcessed: boolean;
  processedAt: string | null;
  notes: string | null;
  createdAt: string;
  payments: Payment[];
}

interface Payment {
  id: string;
  employeeId: string;
  employee: {
    id: string;
    name: string;
    employeeNumber: string;
  };
  salaryAmount: number;
  advanceAmount: number;
  foodVoucherAmount: number;
  bonusAmount: number;
  isPaid: boolean;
  month: number;
  year: number;
  createdAt: string;
  notes: string | null;
}

interface Employee {
  id: string;
  name: string;
  employeeNumber: string;
  cpf: string;
  email: string | null;
  phone: string | null;
}

export default function PagamentosPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [payrollSheets, setPayrollSheets] = useState<PayrollSheet[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Upload dialog
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadMonth, setUploadMonth] = useState('');
  const [uploadYear, setUploadYear] = useState('');
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploading, setUploading] = useState(false);

  // Extração e conferência
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedEmployee[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [extracting, setExtracting] = useState(false);

  // ✅ useEffect para recalcular valor líquido automaticamente quando dados são carregados ou descontos mudam
  useEffect(() => {
    if (extractedData.length > 0) {
      // ✅ CORREÇÃO CRÍTICA: Sempre recalcular netAmount a partir dos valores brutos e descontos
      // 
      // FUNCIONAMENTO CORRETO:
      // - O backend extrai: Total Vencimentos (BRUTO) = R$ 2.158,18
      // - O backend extrai: Total Descontos = R$ 986,86
      // - O backend extrai: Valor Líquido = R$ 1.171,32
      // - Sistema salva: salaryAmount = 2.158,18 (valor BRUTO)
      // - Sistema salva: deductions = 986,86 (descontos totais)
      // - Sistema salva: discountItems = array com descontos individuais
      // 
      // CÁLCULO CORRETO:
      //   valorBruto = salaryAmount + advanceAmount + foodVoucherAmount + bonusAmount
      //   totalDescontos = soma de todos os discountItems
      //   valorLiquido = valorBruto - totalDescontos
      
      const updated = extractedData.map(emp => {
        // Calcular total de vencimentos adicionais (Hora Extra, DSR, etc.)
        const totalEarningsAdicionais = emp.earningsItems?.reduce((sum: number, e: any) => sum + (parseFloat(e.amount as any) || 0), 0) || 0;
        
        // Calcular valor bruto total (inclui vencimentos adicionais)
        const valorBrutoTotal = (parseFloat(emp.salaryAmount?.toString() || '0') || 0) +
                               (parseFloat(emp.advanceAmount?.toString() || '0') || 0) +
                               (parseFloat(emp.foodVoucherAmount?.toString() || '0') || 0) +
                               (parseFloat(emp.bonusAmount?.toString() || '0') || 0) +
                               totalEarningsAdicionais;
        
        // Calcular total de descontos a partir dos discountItems
        const totalDescontos = emp.discountItems?.reduce((sum: number, d: any) => sum + (parseFloat(d.amount as any) || 0), 0) || 0;
        
        // Calcular valor líquido correto
        const valorLiquidoCalculado = valorBrutoTotal - totalDescontos;
        
        return {
          ...emp,
          deductions: totalDescontos,
          netAmount: valorLiquidoCalculado
        };
      });
      
      // Verificar se houve mudança real antes de atualizar (evitar loop infinito)
      const hasChanged = updated.some((emp, index) => 
        Math.abs(emp.deductions - (extractedData[index].deductions || 0)) > 0.01 || 
        Math.abs(emp.netAmount - (extractedData[index].netAmount || 0)) > 0.01
      );
      
      if (hasChanged) {
        console.log('🔄 [RECALCULO] Valores líquidos recalculados automaticamente');
        setExtractedData(updated);
      }
    }
  }, [extractedData]);

  // Manual payment dialog
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [manualPayment, setManualPayment] = useState({
    employeeId: '',
    salaryAmount: '',
    advanceAmount: '',
    foodVoucherAmount: '',
    bonusAmount: '',
    notes: '',
  });
  const [savingManual, setSavingManual] = useState(false);

  // ✅ NOVO: Dialog para adicionar funcionário manualmente durante extração
  const [showAddManualInReview, setShowAddManualInReview] = useState(false);
  const [manualReviewPayment, setManualReviewPayment] = useState({
    employeeId: '',
    name: '',
    cpf: '',
    salaryAmount: '0',
    advanceAmount: '0',
    foodVoucherAmount: '0',
    bonusAmount: '0',
    notes: '',
  });

  // Details dialog
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedSheet, setSelectedSheet] = useState<PayrollSheet | null>(null);
  // Upload individual payslip dialog
  const [showUploadPayslipDialog, setShowUploadPayslipDialog] = useState(false);
  const [selectedPaymentForUpload, setSelectedPaymentForUpload] = useState<Payment | null>(null);
  const [payslipFile, setPayslipFile] = useState<File | null>(null);
  const [uploadingPayslip, setUploadingPayslip] = useState(false);

  // Processing individual payslips
  const [processingPayslips, setProcessingPayslips] = useState(false);

  // ✅ NOVO: Dialog para editar pagamento e regenerar PDF
  const [showEditPaymentDialog, setShowEditPaymentDialog] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editPaymentData, setEditPaymentData] = useState({
    salaryAmount: '',
    earningsItems: [] as Array<{description: string, amount: number}>,
    discountItems: [] as Array<{description: string, amount: number}>
  });
  const [savingEditPayment, setSavingEditPayment] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }

    if (status === 'authenticated') {
      if ((session?.user as any)?.userType !== 'ADMIN') {
        toast.error('Acesso negado');
        router.push('/');
        return;
      }
      loadData();
    }
  }, [session, status, router]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Carregar folhas de pagamento
      const sheetsRes = await fetch('/api/hr/payroll-sheets');
      if (sheetsRes.ok) {
        const sheetsData = await sheetsRes.json();
        setPayrollSheets(sheetsData);
      }

      // Carregar funcionários
      const empRes = await fetch('/api/hr/employees');
      if (empRes.ok) {
        const empData = await empRes.json();
        setEmployees(empData);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.type === 'application/pdf') {
        setSelectedFile(file);
        toast.success('Arquivo selecionado: ' + file.name);
      } else {
        toast.error('Por favor, selecione um arquivo PDF');
        e.target.value = '';
      }
    }
  };

  const handleExtractAndReview = async () => {
    console.log('🔍 [EXTRACT] Iniciando extração de dados');
    console.log('📄 [EXTRACT] Arquivo:', selectedFile?.name, 'Tamanho:', selectedFile?.size);
    console.log('📅 [EXTRACT] Período:', uploadMonth, '/', uploadYear);
    
    if (!selectedFile) {
      console.error('❌ [EXTRACT] Nenhum arquivo selecionado');
      toast.error('Selecione um arquivo PDF');
      return;
    }

    if (!uploadMonth || !uploadYear) {
      console.error('❌ [EXTRACT] Mês ou ano não informado');
      toast.error('Informe o mês e ano de referência');
      return;
    }

    try {
      setExtracting(true);
      console.log('⏳ [EXTRACT] Setando estado de extração...');
      toast.info('🔄 Extraindo dados do PDF... Por favor aguarde.');

      console.log('📦 [EXTRACT] Criando FormData...');
      const formData = new FormData();
      formData.append('file', selectedFile);
      console.log('✅ [EXTRACT] FormData criado');

      const apiUrl = '/api/hr/payroll-sheets/extract';
      console.log('🌐 [EXTRACT] URL da API:', apiUrl);
      console.log('🌐 [EXTRACT] Enviando requisição POST...');
      
      const extractRes = await fetch(apiUrl, {
        method: 'POST',
        body: formData,
        headers: {
          // Não incluir Content-Type para FormData - o navegador define automaticamente
        },
      });
      
      console.log('📡 [EXTRACT] Resposta recebida:', extractRes.status, extractRes.statusText);

      if (!extractRes.ok) {
        console.error('❌ [EXTRACT] Erro HTTP:', extractRes.status);
        const error = await extractRes.json();
        console.error('❌ [EXTRACT] Detalhes do erro:', error);
        throw new Error(error.details || error.error || 'Erro ao extrair dados');
      }

      const extracted = await extractRes.json();
      console.log('📊 [EXTRACT] Dados extraídos com sucesso!');
      console.log('📋 [EXTRACT] Estrutura completa:', JSON.stringify(extracted, null, 2));
      console.log('👥 [EXTRACT] Funcionários encontrados:', extracted?.data?.employees?.length || 0);
      
      if (extracted.rawText) {
        console.log('📝 [EXTRACT] Primeiros 500 caracteres do texto extraído:', extracted.rawText.substring(0, 500));
      }

      if (!extracted.data || !extracted.data.employees || extracted.data.employees.length === 0) {
        console.warn('⚠️ [EXTRACT] Nenhum funcionário identificado');
        toast.warning('⚠️ Nenhum funcionário identificado no PDF. Verifique o formato do arquivo ou adicione manualmente.');
        setShowUploadDialog(false);
        return;
      }

      console.log('🔗 [EXTRACT] Associando com funcionários cadastrados...');
      // Associar com funcionários cadastrados
      const matched = matchEmployees(extracted.data.employees);
      console.log('✅ [EXTRACT] Associação concluída. Total:', matched.length);
      console.log('📋 [EXTRACT] Dados associados:', matched);
      
      setExtractedData(matched);

      // Fechar dialog de upload e abrir de revisão
      console.log('🔄 [EXTRACT] Abrindo modal de revisão...');
      setShowUploadDialog(false);
      setShowReviewDialog(true);

      toast.success(`✅ ${matched.length} registro(s) extraído(s). Revise os dados antes de confirmar.`);
      console.log('✅ [EXTRACT] Processo concluído com sucesso!');
    } catch (error: any) {
      console.error('❌ [EXTRACT] Erro durante extração:', error);
      console.error('❌ [EXTRACT] Stack:', error.stack);
      toast.error(`❌ ${error.message || 'Erro ao extrair dados do PDF'}`);
    } finally {
      setExtracting(false);
      console.log('🏁 [EXTRACT] Finalizando processo');
    }
  };

  const matchEmployees = (extractedEmployees: ExtractedEmployee[]): ExtractedEmployee[] => {
    return extractedEmployees.map(extracted => {
      // Tentar match por CPF primeiro
      let matched = employees.find(emp => 
        emp.cpf && extracted.cpf && 
        emp.cpf.replace(/\D/g, '') === extracted.cpf.replace(/\D/g, '')
      );

      // Se não encontrou por CPF, tentar por nome (sem considerar case)
      if (!matched) {
        matched = employees.find(emp => 
          emp.name.toLowerCase().trim() === extracted.name.toLowerCase().trim()
        );
      }

      // Se não encontrou por nome exato, tentar similaridade
      if (!matched) {
        matched = employees.find(emp => {
          const empName = emp.name.toLowerCase().replace(/\s+/g, ' ').trim();
          const extName = extracted.name.toLowerCase().replace(/\s+/g, ' ').trim();
          return empName.includes(extName) || extName.includes(empName);
        });
      }

      return {
        ...extracted,
        employeeId: matched?.id,
        matched: !!matched,
        notes: matched ? `Associado automaticamente com: ${matched.name}` : 'Não encontrado no cadastro'
      };
    });
  };

  const handleUpdateExtractedData = (index: number, field: keyof ExtractedEmployee, value: any) => {
    const updated = [...extractedData];
    (updated[index] as any)[field] = value;
    
    // 🎯 RECALCULAR VALOR LÍQUIDO AUTOMATICAMENTE quando valores brutos ou descontos mudam
    if (['salaryAmount', 'advanceAmount', 'foodVoucherAmount', 'bonusAmount', 'deductions'].includes(field)) {
      const emp = updated[index];
      const totalBruto = (parseFloat(emp.salaryAmount?.toString() || '0') || 0) +
                         (parseFloat(emp.advanceAmount?.toString() || '0') || 0) +
                         (parseFloat(emp.foodVoucherAmount?.toString() || '0') || 0) +
                         (parseFloat(emp.bonusAmount?.toString() || '0') || 0);
      const totalDescontos = emp.discountItems?.reduce((sum: number, d: any) => sum + (parseFloat(d.amount) || 0), 0) || 0;
      updated[index].netAmount = totalBruto - totalDescontos;
      console.log(`💰 [RECALCULO] Valor líquido atualizado automaticamente: R$ ${updated[index].netAmount.toFixed(2)}`);
    }
    
    setExtractedData(updated);
  };

  const handleRemoveExtractedData = (index: number) => {
    const updated = extractedData.filter((_, i) => i !== index);
    setExtractedData(updated);
    toast.success('Registro removido');
  };

  const handleConfirmExtraction = async () => {
    try {
      setReviewing(true);
      toast.info('Confirmando lançamentos...');

      // Validar se todos têm funcionário associado
      const unmatched = extractedData.filter(e => !e.employeeId);
      if (unmatched.length > 0) {
        toast.error(`${unmatched.length} registro(s) sem funcionário associado. Associe ou remova antes de continuar.`);
        return;
      }

      console.log('📤 [CONFIRM] Criando nova folha de pagamento para:', uploadMonth, '/', uploadYear);
      console.log('💡 [CONFIRM] Sistema permite múltiplas folhas para o mesmo mês (adiantamento, vale, pagamento, etc.)');

      // SEMPRE criar uma nova folha - permite múltiplas folhas para o mesmo mês/ano
      const uploadFormData = new FormData();
      if (selectedFile) {
        uploadFormData.append('file', selectedFile);
      }
      uploadFormData.append('month', uploadMonth);
      uploadFormData.append('year', uploadYear);
      uploadFormData.append('notes', uploadNotes || 'Folha processada com extração automática');

      const uploadRes = await fetch('/api/hr/payroll-sheets', {
        method: 'POST',
        body: uploadFormData,
      });

      if (!uploadRes.ok) {
        const error = await uploadRes.json();
        throw new Error(error.error || 'Erro ao fazer upload');
      }

      const uploadedSheet = await uploadRes.json();
      console.log('✅ [CONFIRM] Nova folha criada:', uploadedSheet);
      const payrollSheetId = uploadedSheet.id;

      // 2. Criar pagamentos vinculados à nova folha
      const payments = extractedData.map(emp => {
        // ✅ CALCULAR DESCONTOS A PARTIR DOS discountItems
        const totalDescontosAdicionados = emp.discountItems?.reduce((sum: number, d: any) => sum + (parseFloat(d.amount) || 0), 0) || 0;
        
        console.log(`[CONFIRM] Funcionário ${emp.name}:`, {
          brutos: {
            salario: emp.salaryAmount,
            antecipacao: emp.advanceAmount,
            vale: emp.foodVoucherAmount,
            bonus: emp.bonusAmount
          },
          descontosAdicionados: totalDescontosAdicionados,
          discountItems: emp.discountItems
        });

        // ✅ Salvar discountItems e earningsItems no notes como JSON para uso no PDF
        const notesData = {
          discountItems: emp.discountItems || [],
          earningsItems: emp.earningsItems || [],
          originalNotes: emp.notes || ''
        };
        
        return {
          employeeId: emp.employeeId,
          salaryGrossAmount: parseFloat(emp.salaryAmount.toString()) || 0,
          advanceGrossAmount: parseFloat(emp.advanceAmount.toString()) || 0,
          foodVoucherGrossAmount: parseFloat(emp.foodVoucherAmount.toString()) || 0,
          bonusGrossAmount: parseFloat(emp.bonusAmount.toString()) || 0,
          // ✅ ENVIAR OS DESCONTOS REAIS PARA O BACKEND
          inssDiscount: 0, // Pode ser editado manualmente se necessário
          irpfDiscount: 0,
          otherDiscounts: totalDescontosAdicionados, // ✅ SOMA TODOS OS DESCONTOS ADICIONADOS PELO USUÁRIO
          month: parseInt(uploadMonth),
          year: parseInt(uploadYear),
          notes: JSON.stringify(notesData), // ✅ Salvar como JSON para o PDF usar
          payrollSheetId: payrollSheetId
        };
      });

      console.log('📤 [CONFIRM] Enviando', payments.length, 'pagamentos vinculados à folha', payrollSheetId);

      const paymentsRes = await fetch('/api/hr/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          payrollSheetId: payrollSheetId, // ✅ VINCULA À FOLHA
          payments: payments,
          generateExpenses: true // ✅ GERA CONTAS A PAGAR
        }),
      });

      if (!paymentsRes.ok) {
        const error = await paymentsRes.json();
        throw new Error(error.error || 'Erro ao criar pagamentos');
      }

      toast.success(`✅ ${payments.length} lançamento(s) confirmado(s) com sucesso!`);
      console.log('✅ [CONFIRM] Processo concluído!');
      
      // Limpar e recarregar
      setShowReviewDialog(false);
      setExtractedData([]);
      setSelectedFile(null);
      setUploadMonth('');
      setUploadYear('');
      setUploadNotes('');
      await loadData();

    } catch (error: any) {
      console.error('❌ [CONFIRM] Erro:', error);
      toast.error(error.message || 'Erro ao confirmar lançamentos');
    } finally {
      setReviewing(false);
    }
  };

  const handleManualPayment = async () => {
    if (!manualPayment.employeeId) {
      toast.error('Selecione um funcionário');
      return;
    }

    try {
      setSavingManual(true);

      const currentDate = new Date();
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();

      const payments = [
        {
          employeeId: manualPayment.employeeId,
          // A API espera valores BRUTOS (*GrossAmount), não líquidos
          salaryGrossAmount: parseFloat(manualPayment.salaryAmount) || 0,
          advanceGrossAmount: parseFloat(manualPayment.advanceAmount) || 0,
          foodVoucherGrossAmount: parseFloat(manualPayment.foodVoucherAmount) || 0,
          bonusGrossAmount: parseFloat(manualPayment.bonusAmount) || 0,
          // Sem descontos no lançamento manual (valores já são líquidos)
          inssDiscount: 0,
          irpfDiscount: 0,
          otherDiscounts: 0,
          month,
          year,
          notes: manualPayment.notes || '',
        },
      ];

      const res = await fetch('/api/hr/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payments }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }

      toast.success('Pagamento registrado com sucesso!');
      setShowManualDialog(false);
      setManualPayment({
        employeeId: '',
        salaryAmount: '',
        advanceAmount: '',
        foodVoucherAmount: '',
        bonusAmount: '',
        notes: '',
      });
      await loadData();
    } catch (error: any) {
      console.error('Erro ao salvar pagamento:', error);
      toast.error(error.message || 'Erro ao registrar pagamento');
    } finally {
      setSavingManual(false);
    }
  };

  // ✅ NOVO: Adicionar funcionário manualmente durante a revisão
  const handleAddManualToReview = () => {
    console.log('➕ [ADD_MANUAL] Adicionando funcionário manual à revisão');
    
    if (!manualReviewPayment.employeeId) {
      toast.error('Selecione um funcionário');
      return;
    }

    // Buscar dados do funcionário selecionado
    const selectedEmployee = employees.find(e => e.id === manualReviewPayment.employeeId);
    if (!selectedEmployee) {
      toast.error('Funcionário não encontrado');
      return;
    }

    // Verificar se já existe na lista
    const alreadyExists = extractedData.some(e => e.employeeId === manualReviewPayment.employeeId);
    if (alreadyExists) {
      toast.error('Este funcionário já está na lista de contracheques');
      return;
    }

    // Criar novo registro para adicionar à lista
    const newEmployee: ExtractedEmployee = {
      name: selectedEmployee.name,
      cpf: manualReviewPayment.cpf || selectedEmployee.cpf,
      salaryAmount: parseFloat(manualReviewPayment.salaryAmount) || 0,
      advanceAmount: parseFloat(manualReviewPayment.advanceAmount) || 0,
      foodVoucherAmount: parseFloat(manualReviewPayment.foodVoucherAmount) || 0,
      bonusAmount: parseFloat(manualReviewPayment.bonusAmount) || 0,
      deductions: 0,
      netAmount: (parseFloat(manualReviewPayment.salaryAmount) || 0) + 
                 (parseFloat(manualReviewPayment.advanceAmount) || 0) + 
                 (parseFloat(manualReviewPayment.foodVoucherAmount) || 0) + 
                 (parseFloat(manualReviewPayment.bonusAmount) || 0),
      notes: manualReviewPayment.notes || 'Adicionado manualmente pelo usuário',
      employeeId: selectedEmployee.id,
      matched: true,
      discountItems: [],
    };

    console.log('✅ [ADD_MANUAL] Novo funcionário criado:', newEmployee);

    // Adicionar à lista de extraídos
    setExtractedData([...extractedData, newEmployee]);

    // Limpar formulário
    setManualReviewPayment({
      employeeId: '',
      name: '',
      cpf: '',
      salaryAmount: '0',
      advanceAmount: '0',
      foodVoucherAmount: '0',
      bonusAmount: '0',
      notes: '',
    });

    // Fechar dialog
    setShowAddManualInReview(false);

    toast.success(`✅ ${selectedEmployee.name} adicionado à lista de contracheques!`);
  };

  const handleDeleteSheet = async (sheetId: string, sheetName: string) => {
    if (!confirm(
      `⚠️ ATENÇÃO: EXCLUSÃO COMPLETA!\n\n` +
      `Deseja DELETAR TUDO relacionado à folha "${sheetName}"?\n\n` +
      `Será excluído:\n` +
      `• Todos os contracheques (PDFs individuais)\n` +
      `• Todos os pagamentos registrados\n` +
      `• Todas as despesas financeiras associadas\n` +
      `• A folha de pagamento completa\n\n` +
      `✅ Você poderá fazer o upload novamente e reprocessar tudo!\n\n` +
      `Confirma a EXCLUSÃO COMPLETA?`
    )) {
      return;
    }

    try {
      console.log('🗑️ [DELETE_SHEET] Excluindo TUDO da folha:', sheetId);

      const res = await fetch(`/api/hr/payroll-sheets/${sheetId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao excluir folha');
      }

      const counts = data.deletedCounts || {};
      toast.success(
        `Exclusão completa realizada!\n` +
        `📄 ${counts.documents || 0} contracheque(s)\n` +
        `💳 ${counts.payments || 0} pagamento(s)\n` +
        `💰 ${counts.expenses || 0} despesa(s)`,
        { duration: 5000 }
      );
      await loadData();
    } catch (error: any) {
      console.error('❌ [DELETE_SHEET] Erro:', error);
      toast.error(error.message || 'Erro ao excluir folha de pagamento');
    }
  };

  const handleDeletePayslips = async (sheetId: string, sheetName: string) => {
    if (!confirm(
      `Deseja LIMPAR todos os contracheques gerados para "${sheetName}"?\n\n` +
      `⚠️ ATENÇÃO:\n` +
      `• Isso vai DELETAR todos os PDFs individuais de contracheques\n` +
      `• A folha de pagamento será MANTIDA\n` +
      `• Os registros de pagamento serão MANTIDOS\n` +
      `• Você poderá clicar em "Processar" novamente para gerar novos contracheques\n\n` +
      `Confirma a exclusão?`
    )) {
      return;
    }

    try {
      console.log('🗑️ [DELETE_PAYSLIPS] Limpando contracheques da folha:', sheetId);

      const res = await fetch(`/api/hr/payroll-sheets/${sheetId}/delete-payslips`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao limpar contracheques');
      }

      toast.success(`${data.deletedCount} contracheque(s) deletado(s)! Você pode processar novamente.`);
      await loadData();
    } catch (error: any) {
      console.error('❌ [DELETE_PAYSLIPS] Erro:', error);
      toast.error(error.message || 'Erro ao limpar contracheques');
    }
  };

  const handleCleanupOrphans = async () => {
    if (!confirm(
      `🧹 LIMPAR PAGAMENTOS ÓRFÃOS\n\n` +
      `Esta ação vai DELETAR todos os pagamentos que não estão vinculados a nenhuma folha de pagamento.\n\n` +
      `Isso inclui:\n` +
      `• Pagamentos sem folha vinculada\n` +
      `• Contracheques gerados para esses pagamentos\n` +
      `• Despesas financeiras associadas\n\n` +
      `⚠️ Isso geralmente ocorre quando tentativas de confirmação falharam.\n\n` +
      `Confirma a limpeza?`
    )) {
      return;
    }

    try {
      console.log('🧹 [CLEANUP_ORPHANS] Iniciando limpeza de órfãos...');

      const res = await fetch('/api/hr/payments/cleanup-orphans', {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao limpar pagamentos órfãos');
      }

      if (data.deleted === 0) {
        toast.info('Nenhum pagamento órfão encontrado! ✅');
      } else {
        toast.success(
          `Limpeza concluída!\n` +
          `🗑️ ${data.deletedPayments} pagamento(s)\n` +
          `💰 ${data.deletedExpenses} despesa(s)\n` +
          `📄 ${data.deletedDocuments} contracheque(s)`,
          { duration: 5000 }
        );
      }
      
      await loadData();
    } catch (error: any) {
      console.error('❌ [CLEANUP_ORPHANS] Erro:', error);
      toast.error(error.message || 'Erro ao limpar pagamentos órfãos');
    }
  };

  const handleUploadIndividualPayslip = async () => {
    if (!payslipFile || !selectedPaymentForUpload) {
      toast.error('Selecione um arquivo PDF');
      return;
    }

    console.log('\n📄 [UPLOAD-INDIVIDUAL-PAYSLIP] Iniciando upload...');
    console.log('   Funcionário:', selectedPaymentForUpload.employee.name);
    console.log('   Arquivo:', payslipFile.name);
    console.log('   Mês/Ano:', selectedPaymentForUpload.month, '/', selectedPaymentForUpload.year);

    setUploadingPayslip(true);

    try {
      const formData = new FormData();
      formData.append('file', payslipFile);
      formData.append('month', selectedPaymentForUpload.month.toString());
      formData.append('year', selectedPaymentForUpload.year.toString());

      const res = await fetch(`/api/hr/employees/${selectedPaymentForUpload.employeeId}/upload-payslip`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao fazer upload');
      }

      console.log('✅ [UPLOAD-INDIVIDUAL-PAYSLIP] Upload concluído!');
      console.log('   Documento ID:', data.document.id);

      toast.success('Contracheque individual salvo com sucesso!');
      setShowUploadPayslipDialog(false);
      setPayslipFile(null);
      setSelectedPaymentForUpload(null);
      await loadData();
    } catch (error: any) {
      console.error('❌ [UPLOAD-INDIVIDUAL-PAYSLIP] Erro:', error);
      toast.error(error.message || 'Erro ao fazer upload do contracheque');
    } finally {
      setUploadingPayslip(false);
    }
  };

  // ✅ NOVO: Função para abrir dialog de edição de pagamento
  const handleOpenEditPayment = (payment: Payment) => {
    // Tentar parsear os dados do notes
    let earningsItems: Array<{description: string, amount: number}> = [];
    let discountItems: Array<{description: string, amount: number}> = [];
    
    if ((payment as any).notes) {
      try {
        const notesData = JSON.parse((payment as any).notes);
        if (notesData.earningsItems) earningsItems = notesData.earningsItems;
        if (notesData.discountItems) discountItems = notesData.discountItems;
      } catch (e) {
        // Notes não é JSON, ignorar
      }
    }
    
    setEditingPayment(payment);
    setEditPaymentData({
      salaryAmount: payment.salaryAmount.toString(),
      earningsItems: earningsItems.length > 0 ? earningsItems : [],
      discountItems: discountItems.length > 0 ? discountItems : []
    });
    setShowEditPaymentDialog(true);
  };

  // ✅ NOVO: Função para salvar edição e regenerar PDF
  const handleSaveEditPayment = async () => {
    if (!editingPayment) return;
    
    setSavingEditPayment(true);
    
    try {
      console.log('📝 [EDIT-PAYMENT] Salvando alterações e regenerando PDF...');
      console.log('   Payment ID:', editingPayment.id);
      console.log('   Salário:', editPaymentData.salaryAmount);
      console.log('   Vencimentos:', editPaymentData.earningsItems);
      console.log('   Descontos:', editPaymentData.discountItems);
      
      const res = await fetch(`/api/hr/payments/${editingPayment.id}/update-and-regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salaryAmount: parseFloat(editPaymentData.salaryAmount) || 0,
          earningsItems: editPaymentData.earningsItems,
          discountItems: editPaymentData.discountItems
        })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao atualizar pagamento');
      }
      
      console.log('✅ [EDIT-PAYMENT] Atualização concluída!');
      toast.success('Pagamento atualizado e PDF regenerado com sucesso!');
      
      setShowEditPaymentDialog(false);
      setEditingPayment(null);
      await loadData();
      
    } catch (error: any) {
      console.error('❌ [EDIT-PAYMENT] Erro:', error);
      toast.error(error.message || 'Erro ao atualizar pagamento');
    } finally {
      setSavingEditPayment(false);
    }
  };

  const handleProcessIndividualPayslips = async (sheetId: string, sheetName: string) => {
    if (!confirm(`Deseja processar automaticamente os contracheques individuais da folha "${sheetName}"?\n\nO sistema irá extrair uma página para cada funcionário e criar documentos individuais.`)) {
      return;
    }

    console.log('\n🔄 [PROCESS-PAYSLIPS-UI] Iniciando processamento...');
    console.log('   Folha ID:', sheetId);
    console.log('   Folha Nome:', sheetName);

    setProcessingPayslips(true);

    try {
      const res = await fetch(`/api/hr/payroll-sheets/${sheetId}/process-individual-payslips`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao processar contracheques');
      }

      console.log('✅ [PROCESS-PAYSLIPS-UI] Processamento concluído!');
      console.log('   Resultados:', data.results);

      const { processed, skipped, errors } = data.results;
      
      if (errors > 0) {
        toast.warning(`Processamento concluído com avisos!\n${processed} processados, ${skipped} pulados, ${errors} com erro.`);
      } else {
        toast.success(`${processed} contracheque(s) individual(is) criado(s) com sucesso!`);
      }

      // Recarregar dados
      await loadData();
    } catch (error: any) {
      console.error('❌ [PROCESS-PAYSLIPS-UI] Erro:', error);
      toast.error(error.message || 'Erro ao processar contracheques');
    } finally {
      setProcessingPayslips(false);
    }
  };


  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const getMonthName = (month: number) => {
    const months = [
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ];
    return months[month - 1] || '';
  };

  if (loading || status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-orange-500 mx-auto"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Pagamentos de Funcionários
            </h1>
            <p className="mt-1 text-gray-600">
              Gerencie folhas de pagamento e pagamentos individuais
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => router.push('/admin')}
              className="gap-2"
            >
              <Home className="h-4 w-4" />
              Página Inicial
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/admin/rh')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button
            onClick={() => setShowUploadDialog(true)}
            className="gap-2 bg-gradient-to-r from-blue-600 to-blue-700"
          >
            <Upload className="h-4 w-4" />
            Upload de Folha de Pagamento (PDF)
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowManualDialog(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Lançamento Manual de Pagamento
          </Button>
          <Button
            variant="destructive"
            onClick={handleCleanupOrphans}
            className="gap-2 bg-orange-600 hover:bg-orange-700"
          >
            <RefreshCw className="h-4 w-4" />
            Limpar Pagamentos Órfãos
          </Button>
        </div>

        {/* Payroll Sheets List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Folhas de Pagamento Enviadas
            </CardTitle>
            <CardDescription>
              Histórico de folhas de pagamento e seus status
            </CardDescription>
          </CardHeader>
          <CardContent>
            {payrollSheets.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <FileText className="mx-auto mb-2 h-12 w-12 text-gray-400" />
                <p>Nenhuma folha de pagamento enviada ainda</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Período</TableHead>
                      <TableHead>Arquivo</TableHead>
                      <TableHead>Enviado em</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pagamentos</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrollSheets.map((sheet) => (
                      <TableRow key={sheet.id}>
                        <TableCell className="font-medium">
                          {getMonthName(sheet.month)}/{sheet.year}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {sheet.fileName}
                        </TableCell>
                        <TableCell>{formatDate(sheet.createdAt)}</TableCell>
                        <TableCell>
                          {sheet.isProcessed ? (
                            <Badge className="gap-1 bg-green-100 text-green-800">
                              <CheckCircle2 className="h-3 w-3" />
                              Processado
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              <XCircle className="h-3 w-3" />
                              Pendente
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {sheet.payments?.length || 0} pagamento(s)
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedSheet(sheet);
                                setShowDetailsDialog(true);
                              }}
                              className="gap-1"
                            >
                              <Eye className="h-4 w-4" />
                              Ver Detalhes
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(sheet.fileUrl, '_blank')}
                              className="gap-1"
                            >
                              <Download className="h-4 w-4" />
                              PDF
                            </Button>
                            {(!sheet.payments || sheet.payments.length === 0) ? (
                              <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                                <AlertCircle className="h-4 w-4" />
                                <span className="font-medium">Aguardando confirmação de lançamentos</span>
                              </div>
                            ) : (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleProcessIndividualPayslips(sheet.id, `${getMonthName(sheet.month)}/${sheet.year}`)}
                                  disabled={processingPayslips}
                                  className="gap-1 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                >
                                  {processingPayslips ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <FileText className="h-4 w-4" />
                                  )}
                                  Processar
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeletePayslips(sheet.id, `${getMonthName(sheet.month)}/${sheet.year}`)}
                                  disabled={!sheet.isProcessed}
                                  className="gap-1 text-orange-600 hover:text-orange-700 hover:bg-orange-50 disabled:opacity-50"
                                  title={!sheet.isProcessed ? "Nenhum contracheque gerado ainda" : "Limpar contracheques para reprocessar"}
                                >
                                  <RefreshCw className="h-4 w-4" />
                                  Limpar
                                </Button>
                              </>
                            )}
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteSheet(sheet.id, `${getMonthName(sheet.month)}/${sheet.year}`)}
                              className="gap-1"
                              title="Excluir TUDO (folha + pagamentos + despesas + contracheques)"
                            >
                              <Trash2 className="h-4 w-4" />
                              Excluir Tudo
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upload Dialog */}
        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Upload de Folha de Pagamento</DialogTitle>
              <DialogDescription>
                Envie o contracheque em PDF. O sistema irá extrair automaticamente as informações dos funcionários para conferência.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Fluxo:</strong> 1) Selecione o PDF → 2) Informe mês/ano → 3) Clique em "Extrair e Conferir" → 4) Revise os dados extraídos → 5) Confirme os lançamentos
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="file">Arquivo PDF *</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  disabled={uploading || extracting}
                />
                {selectedFile && (
                  <p className="text-sm text-green-600">
                    ✓ {selectedFile.name}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="month">Mês de Referência *</Label>
                  <Select
                    value={uploadMonth}
                    onValueChange={setUploadMonth}
                    disabled={uploading || extracting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o mês" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                        <SelectItem key={month} value={month.toString()}>
                          {getMonthName(month)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="year">Ano de Referência *</Label>
                  <Input
                    id="year"
                    type="number"
                    placeholder="2025"
                    value={uploadYear}
                    onChange={(e) => setUploadYear(e.target.value)}
                    disabled={uploading || extracting}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  placeholder="Notas adicionais sobre esta folha de pagamento..."
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  rows={3}
                  disabled={uploading || extracting}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowUploadDialog(false);
                  setSelectedFile(null);
                  setUploadMonth('');
                  setUploadYear('');
                  setUploadNotes('');
                }}
                disabled={uploading || extracting}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleExtractAndReview}
                disabled={!selectedFile || uploading || extracting}
                className="gap-2 bg-gradient-to-r from-orange-600 to-orange-700"
              >
                {extracting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Extraindo...
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4" />
                    Extrair e Conferir
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Review Dialog */}
        <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Conferência de Dados Extraídos</DialogTitle>
              <DialogDescription>
                Revise e edite os dados extraídos do contracheque antes de confirmar os lançamentos. Você pode associar manualmente funcionários não identificados automaticamente.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {extractedData.filter(e => e.matched).length} de {extractedData.length} funcionário(s) associado(s) automaticamente. 
                  {extractedData.filter(e => !e.matched).length > 0 && (
                    <strong className="text-orange-600"> {extractedData.filter(e => !e.matched).length} registro(s) necessitam de associação manual.</strong>
                  )}
                </AlertDescription>
              </Alert>

              <Alert className="bg-blue-50 border-blue-200">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  <strong>💡 IMPORTANTE - Valores LÍQUIDOS vs BRUTOS:</strong>
                  <br /><br />
                  <strong className="text-green-700">✅ Se o PDF já tem valores LÍQUIDOS (após descontos):</strong>
                  <br />
                  • Os valores mostrados acima JÁ SÃO os valores finais (líquidos) que serão pagos
                  <br />
                  • <strong>Clique em "Confirmar" AGORA</strong> - não precisa adicionar descontos
                  <br />
                  • As contas a pagar serão criadas com estes valores líquidos
                  <br />
                  <br />
                  <strong className="text-orange-700">⚠️ Se o PDF tem valores BRUTOS (antes dos descontos):</strong>
                  <br />
                  • Confirme agora e adicione os descontos (INSS, IRPF, etc.) depois
                  <br />
                  • O sistema calculará os valores líquidos automaticamente
                </AlertDescription>
              </Alert>

              {/* ✅ NOVO: Botão para adicionar funcionário manualmente */}
              <div className="flex justify-between items-center p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-green-800">
                    📝 Funcionário não está na lista ou a contabilidade mandou um contracheque extra?
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    Adicione manualmente e ele será incluído junto com os demais
                  </p>
                </div>
                <Button
                  onClick={() => setShowAddManualInReview(true)}
                  className="gap-2 bg-green-600 hover:bg-green-700"
                  size="sm"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar Funcionário Manualmente
                </Button>
              </div>

              <div className="space-y-4">
                {extractedData.map((emp, index) => (
                  <Card key={index} className={!emp.matched ? 'border-orange-300 bg-orange-50' : 'border-green-300 bg-green-50'}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Badge variant={emp.matched ? 'default' : 'destructive'}>
                            {emp.matched ? 'Associado' : 'Não Encontrado'}
                          </Badge>
                          <span className="font-semibold text-lg">{emp.name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveExtractedData(index)}
                          className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          Remover
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Funcionário Associado *</Label>
                          <Select
                            value={emp.employeeId || ''}
                            onValueChange={(value) => {
                              handleUpdateExtractedData(index, 'employeeId', value);
                              const selected = employees.find(e => e.id === value);
                              if (selected) {
                                handleUpdateExtractedData(index, 'matched', true);
                                handleUpdateExtractedData(index, 'notes', `Associado manualmente com: ${selected.name}`);
                              }
                            }}
                          >
                            <SelectTrigger className={!emp.employeeId ? 'border-red-300' : ''}>
                              <SelectValue placeholder="Selecione o funcionário" />
                            </SelectTrigger>
                            <SelectContent>
                              {employees.map((employee) => (
                                <SelectItem key={employee.id} value={employee.id}>
                                  {employee.name} - {employee.employeeNumber}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>CPF Extraído</Label>
                          <Input
                            value={emp.cpf}
                            onChange={(e) => handleUpdateExtractedData(index, 'cpf', e.target.value)}
                            placeholder="000.000.000-00"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Salário (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={emp.salaryAmount}
                            onChange={(e) => handleUpdateExtractedData(index, 'salaryAmount', parseFloat(e.target.value) || 0)}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Antecipação (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={emp.advanceAmount}
                            onChange={(e) => handleUpdateExtractedData(index, 'advanceAmount', parseFloat(e.target.value) || 0)}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Vale Alimentação (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={emp.foodVoucherAmount}
                            onChange={(e) => handleUpdateExtractedData(index, 'foodVoucherAmount', parseFloat(e.target.value) || 0)}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Bônus (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={emp.bonusAmount}
                            onChange={(e) => handleUpdateExtractedData(index, 'bonusAmount', parseFloat(e.target.value) || 0)}
                          />
                        </div>

                        {/* ⭐ Seção de Vencimentos Adicionais (Hora Extra, DSR, Salário Família, etc.) - SEMPRE VISÍVEL */}
                        <div className="col-span-2 space-y-3 p-4 bg-green-50 border-2 border-green-300 rounded-lg">
                          <div className="flex items-center justify-between">
                            <Label className="text-green-700 font-semibold">📈 Vencimentos Adicionais (Hora Extra, DSR, Salário Família, etc.)</Label>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const updated = [...extractedData];
                                if (!updated[index].earningsItems) {
                                  updated[index].earningsItems = [];
                                }
                                updated[index].earningsItems.push({
                                  description: '',
                                  amount: 0
                                });
                                
                                // ✅ Recalcular valor líquido após adicionar vencimento
                                const totalEarnings = updated[index].earningsItems.reduce((sum: number, e: any) => sum + (parseFloat(e.amount) || 0), 0);
                                const totalDescontos = updated[index].discountItems?.reduce((sum: number, d: any) => sum + (parseFloat(d.amount) || 0), 0) || 0;
                                const valorBruto = (updated[index].salaryAmount || 0) + (updated[index].advanceAmount || 0) + (updated[index].foodVoucherAmount || 0) + (updated[index].bonusAmount || 0) + totalEarnings;
                                updated[index].netAmount = valorBruto - totalDescontos;
                                
                                setExtractedData(updated);
                              }}
                              className="text-xs h-7 border-green-500 text-green-700 hover:bg-green-100"
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              + Adicionar Vencimento
                            </Button>
                          </div>

                          {/* Lista de vencimentos adicionais */}
                          {emp.earningsItems && emp.earningsItems.length > 0 ? (
                            <div className="space-y-2">
                              {emp.earningsItems.map((item: any, itemIndex: number) => (
                                <div key={itemIndex} className="flex items-center gap-2 bg-white p-2 rounded border border-green-200">
                                  <Input
                                    placeholder="Ex: Hora Extra 50%, DSR, Salário Família"
                                    value={item.description || ''}
                                    onChange={(e) => {
                                      const updated = [...extractedData];
                                      if (!updated[index].earningsItems) updated[index].earningsItems = [];
                                      updated[index].earningsItems[itemIndex].description = e.target.value;
                                      setExtractedData(updated);
                                    }}
                                    className="flex-1 text-sm h-8"
                                  />
                                  <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={item.amount || 0}
                                    onChange={(e) => {
                                      const updated = [...extractedData];
                                      if (!updated[index].earningsItems) updated[index].earningsItems = [];
                                      updated[index].earningsItems[itemIndex].amount = parseFloat(e.target.value) || 0;
                                      
                                      // ✅ Recalcular valor líquido após editar vencimento
                                      const totalEarnings = updated[index].earningsItems.reduce((sum: number, e: any) => sum + (parseFloat(e.amount) || 0), 0);
                                      const totalDescontos = updated[index].discountItems?.reduce((sum: number, d: any) => sum + (parseFloat(d.amount) || 0), 0) || 0;
                                      const valorBruto = (updated[index].salaryAmount || 0) + (updated[index].advanceAmount || 0) + (updated[index].foodVoucherAmount || 0) + (updated[index].bonusAmount || 0) + totalEarnings;
                                      updated[index].netAmount = valorBruto - totalDescontos;
                                      
                                      setExtractedData(updated);
                                    }}
                                    className="w-28 text-sm h-8"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const updated = [...extractedData];
                                      if (!updated[index].earningsItems) updated[index].earningsItems = [];
                                      updated[index].earningsItems.splice(itemIndex, 1);
                                      
                                      // ✅ Recalcular valor líquido após remover vencimento
                                      const totalEarnings = updated[index].earningsItems.reduce((sum: number, e: any) => sum + (parseFloat(e.amount) || 0), 0);
                                      const totalDescontos = updated[index].discountItems?.reduce((sum: number, d: any) => sum + (parseFloat(d.amount) || 0), 0) || 0;
                                      const valorBruto = (updated[index].salaryAmount || 0) + (updated[index].advanceAmount || 0) + (updated[index].foodVoucherAmount || 0) + (updated[index].bonusAmount || 0) + totalEarnings;
                                      updated[index].netAmount = valorBruto - totalDescontos;
                                      
                                      setExtractedData(updated);
                                    }}
                                    className="text-red-500 hover:text-red-700 h-8 w-8 p-0"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-green-600 italic">Nenhum vencimento adicional registrado. Clique em "+ Adicionar Vencimento" para incluir Hora Extra, DSR, Salário Família, etc.</p>
                          )}

                          {/* Total de vencimentos adicionais */}
                          <div className="flex justify-between items-center pt-2 border-t border-green-300">
                            <span className="text-green-800 font-medium">Total Vencimentos Adicionais:</span>
                            <span className="text-green-700 font-bold">
                              R$ {(emp.earningsItems?.reduce((sum: number, e: any) => sum + (parseFloat(e.amount) || 0), 0) || 0).toFixed(2).replace('.', ',')}
                            </span>
                          </div>
                        </div>

                        {/* Seção de Descontos - EDITÁVEL COM MÚLTIPLOS DESCONTOS */}
                        <div className="col-span-2 space-y-3 p-4 bg-orange-50 border-2 border-orange-300 rounded-lg">
                          <div className="flex items-center justify-between">
                            <Label className="text-orange-700 font-semibold">📉 Descontos Individuais</Label>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const updated = [...extractedData];
                                if (!updated[index].discountItems) {
                                  updated[index].discountItems = [];
                                }
                                
                                // ✅ CORREÇÃO DEFINITIVA: Calcular valor bruto CORRETO a partir dos valores individuais
                                const totalEarningsAdicionais = updated[index].earningsItems?.reduce((sum: number, e: any) => sum + (parseFloat(e.amount) || 0), 0) || 0;
                                const valorBrutoAtual = updated[index].salaryAmount + updated[index].advanceAmount + updated[index].foodVoucherAmount + updated[index].bonusAmount + totalEarningsAdicionais;
                                
                                updated[index].discountItems.push({
                                  description: 'Novo Desconto',
                                  amount: 0
                                });
                                
                                // Recalcular total de descontos
                                const totalDescontos = updated[index].discountItems.reduce((sum: number, d: any) => sum + (parseFloat(d.amount) || 0), 0);
                                updated[index].deductions = totalDescontos;
                                
                                // ✅ CORREÇÃO DEFINITIVA: Recalcular valor líquido CORRETO
                                updated[index].netAmount = valorBrutoAtual - totalDescontos;
                                
                                console.log(`✅ [ADD_DESCONTO] ${updated[index].name}: Bruto=R$ ${valorBrutoAtual.toFixed(2)}, Descontos=R$ ${totalDescontos.toFixed(2)}, Líquido=R$ ${updated[index].netAmount.toFixed(2)}`);
                                
                                setExtractedData(updated);
                              }}
                              className="text-xs h-7"
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Adicionar Desconto
                            </Button>
                          </div>

                          {/* Lista de descontos individuais */}
                          {emp.discountItems && emp.discountItems.length > 0 ? (
                            <div className="space-y-2">
                              {emp.discountItems.map((item: any, itemIndex: number) => (
                                <div key={itemIndex} className="flex items-center gap-2 bg-white p-2 rounded border">
                                  <Input
                                    placeholder="Ex: eConsignado"
                                    value={item.description || ''}
                                    onChange={(e) => {
                                      const updated = [...extractedData];
                                      if (!updated[index].discountItems) updated[index].discountItems = [];
                                      updated[index].discountItems[itemIndex].description = e.target.value;
                                      setExtractedData(updated);
                                    }}
                                    className="flex-1 text-sm h-8"
                                  />
                                  <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={item.amount || 0}
                                    onChange={(e) => {
                                      const updated = [...extractedData];
                                      if (!updated[index].discountItems) updated[index].discountItems = [];
                                      
                                      // ✅ CORREÇÃO DEFINITIVA: Calcular valor bruto CORRETO a partir dos valores individuais + vencimentos adicionais
                                      const totalEarningsAdicionais = updated[index].earningsItems?.reduce((sum: number, item: any) => sum + (parseFloat(item.amount) || 0), 0) || 0;
                                      const valorBrutoAtual = updated[index].salaryAmount + updated[index].advanceAmount + updated[index].foodVoucherAmount + updated[index].bonusAmount + totalEarningsAdicionais;
                                      
                                      updated[index].discountItems[itemIndex].amount = parseFloat(e.target.value) || 0;
                                      
                                      // Recalcular total de descontos
                                      const totalDescontos = updated[index].discountItems.reduce((sum: number, d: any) => sum + (parseFloat(d.amount) || 0), 0);
                                      updated[index].deductions = totalDescontos;
                                      
                                      // ✅ CORREÇÃO DEFINITIVA: Recalcular valor líquido CORRETO
                                      updated[index].netAmount = valorBrutoAtual - totalDescontos;
                                      
                                      console.log(`✅ [EDIT_DESCONTO] ${updated[index].name}: Bruto=R$ ${valorBrutoAtual.toFixed(2)}, Descontos=R$ ${totalDescontos.toFixed(2)}, Líquido=R$ ${updated[index].netAmount.toFixed(2)}`);
                                      
                                      setExtractedData(updated);
                                    }}
                                    className="w-32 text-sm h-8"
                                  />
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      const updated = [...extractedData];
                                      if (!updated[index].discountItems) updated[index].discountItems = [];
                                      
                                      // ✅ CORREÇÃO DEFINITIVA: Calcular valor bruto CORRETO a partir dos valores individuais + vencimentos adicionais
                                      const totalEarningsAdicionais = updated[index].earningsItems?.reduce((sum: number, item: any) => sum + (parseFloat(item.amount) || 0), 0) || 0;
                                      const valorBrutoAtual = updated[index].salaryAmount + updated[index].advanceAmount + updated[index].foodVoucherAmount + updated[index].bonusAmount + totalEarningsAdicionais;
                                      
                                      updated[index].discountItems.splice(itemIndex, 1);
                                      
                                      // Recalcular total de descontos
                                      const totalDescontos = updated[index].discountItems.reduce((sum: number, d: any) => sum + (parseFloat(d.amount) || 0), 0);
                                      updated[index].deductions = totalDescontos;
                                      
                                      // ✅ CORREÇÃO DEFINITIVA: Recalcular valor líquido CORRETO
                                      updated[index].netAmount = valorBrutoAtual - totalDescontos;
                                      
                                      console.log(`✅ [REMOVE_DESCONTO] ${updated[index].name}: Bruto=R$ ${valorBrutoAtual.toFixed(2)}, Descontos=R$ ${totalDescontos.toFixed(2)}, Líquido=R$ ${updated[index].netAmount.toFixed(2)}`);
                                      
                                      setExtractedData(updated);
                                    }}
                                    className="text-red-600 hover:text-red-700 h-8 w-8 p-0"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 italic">Nenhum desconto registrado. Clique em "Adicionar Desconto" para incluir.</p>
                          )}

                          {/* Total de Descontos - Calculado Automaticamente */}
                          <div className="pt-3 border-t-2 border-orange-300">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-orange-700 text-base">Total de Descontos:</span>
                              <span className="font-bold text-orange-700 text-lg">
                                R$ {(emp.discountItems?.reduce((sum: number, d: any) => sum + (parseFloat(d.amount) || 0), 0) || 0).toFixed(2).replace('.', ',')}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-green-700 font-semibold">Valor Líquido (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={emp.netAmount}
                            onChange={(e) => handleUpdateExtractedData(index, 'netAmount', parseFloat(e.target.value) || 0)}
                            className="border-green-300 focus:border-green-500 font-semibold"
                          />
                          <p className="text-xs text-green-600">
                            ✏️ Editável - Ajuste se necessário
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        <Label>Observações</Label>
                        <Textarea
                          value={emp.notes}
                          onChange={(e) => handleUpdateExtractedData(index, 'notes', e.target.value)}
                          rows={2}
                          placeholder="Notas sobre este lançamento..."
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <strong>IMPORTANTE:</strong> Os valores acima são BRUTOS. Depois de confirmar, você poderá adicionar os descontos (INSS, IRPF, etc.) na próxima tela. 
                As despesas financeiras serão criadas com os valores LÍQUIDOS (após descontos).
              </AlertDescription>
            </Alert>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowReviewDialog(false);
                  setExtractedData([]);
                  setShowUploadDialog(true);
                }}
                disabled={reviewing}
              >
                Voltar
              </Button>
              <Button
                onClick={handleConfirmExtraction}
                disabled={reviewing || extractedData.some(e => !e.employeeId)}
                className="gap-2 bg-gradient-to-r from-green-600 to-green-700"
              >
                {reviewing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Confirmando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Confirmar {extractedData.length} Lançamento(s)
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Manual Payment Dialog */}
        <Dialog open={showManualDialog} onOpenChange={setShowManualDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Lançamento Manual de Pagamento</DialogTitle>
              <DialogDescription>
                Registre um pagamento individual para um funcionário
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="employee">Funcionário *</Label>
                <Select
                  value={manualPayment.employeeId}
                  onValueChange={(value) =>
                    setManualPayment({ ...manualPayment, employeeId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o funcionário" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name} - Nº {emp.employeeNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="salary">Salário (R$)</Label>
                  <Input
                    id="salary"
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={manualPayment.salaryAmount}
                    onChange={(e) =>
                      setManualPayment({
                        ...manualPayment,
                        salaryAmount: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="advance">Antecipação (R$)</Label>
                  <Input
                    id="advance"
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={manualPayment.advanceAmount}
                    onChange={(e) =>
                      setManualPayment({
                        ...manualPayment,
                        advanceAmount: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="food">Vale Alimentação (R$)</Label>
                  <Input
                    id="food"
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={manualPayment.foodVoucherAmount}
                    onChange={(e) =>
                      setManualPayment({
                        ...manualPayment,
                        foodVoucherAmount: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bonus">Bônus (R$)</Label>
                  <Input
                    id="bonus"
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={manualPayment.bonusAmount}
                    onChange={(e) =>
                      setManualPayment({
                        ...manualPayment,
                        bonusAmount: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="manual-notes">Observações</Label>
                <Textarea
                  id="manual-notes"
                  placeholder="Notas sobre este pagamento..."
                  value={manualPayment.notes}
                  onChange={(e) =>
                    setManualPayment({ ...manualPayment, notes: e.target.value })
                  }
                  rows={3}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowManualDialog(false);
                  setManualPayment({
                    employeeId: '',
                    salaryAmount: '',
                    advanceAmount: '',
                    foodVoucherAmount: '',
                    bonusAmount: '',
                    notes: '',
                  });
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleManualPayment}
                disabled={savingManual}
                className="gap-2"
              >
                {savingManual ? 'Salvando...' : 'Salvar Pagamento'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ✅ NOVO: Dialog para adicionar funcionário manualmente durante a revisão */}
        <Dialog open={showAddManualInReview} onOpenChange={setShowAddManualInReview}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>➕ Adicionar Funcionário Manualmente</DialogTitle>
              <DialogDescription>
                Adicione um funcionário que não foi encontrado automaticamente ou que a contabilidade mandou separadamente
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="manual-employee">Funcionário *</Label>
                <Select
                  value={manualReviewPayment.employeeId}
                  onValueChange={(value) => {
                    const selected = employees.find(e => e.id === value);
                    setManualReviewPayment({ 
                      ...manualReviewPayment, 
                      employeeId: value,
                      name: selected?.name || '',
                      cpf: selected?.cpf || '',
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o funcionário" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees
                      .filter(emp => !extractedData.some(e => e.employeeId === emp.id))
                      .map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name} - Nº {emp.employeeNumber}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {employees.filter(emp => !extractedData.some(e => e.employeeId === emp.id)).length === 0 && (
                  <p className="text-xs text-orange-600">
                    Todos os funcionários cadastrados já estão na lista de contracheques
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="manual-cpf">CPF</Label>
                  <Input
                    id="manual-cpf"
                    placeholder="000.000.000-00"
                    value={manualReviewPayment.cpf}
                    onChange={(e) =>
                      setManualReviewPayment({
                        ...manualReviewPayment,
                        cpf: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manual-salary">Salário (R$)</Label>
                  <Input
                    id="manual-salary"
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={manualReviewPayment.salaryAmount}
                    onChange={(e) =>
                      setManualReviewPayment({
                        ...manualReviewPayment,
                        salaryAmount: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manual-advance">Antecipação (R$)</Label>
                  <Input
                    id="manual-advance"
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={manualReviewPayment.advanceAmount}
                    onChange={(e) =>
                      setManualReviewPayment({
                        ...manualReviewPayment,
                        advanceAmount: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manual-food">Vale Alimentação (R$)</Label>
                  <Input
                    id="manual-food"
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={manualReviewPayment.foodVoucherAmount}
                    onChange={(e) =>
                      setManualReviewPayment({
                        ...manualReviewPayment,
                        foodVoucherAmount: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manual-bonus">Bônus (R$)</Label>
                  <Input
                    id="manual-bonus"
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={manualReviewPayment.bonusAmount}
                    onChange={(e) =>
                      setManualReviewPayment({
                        ...manualReviewPayment,
                        bonusAmount: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="manual-review-notes">Observações</Label>
                <Textarea
                  id="manual-review-notes"
                  placeholder="Ex: Contracheque enviado pela contabilidade, não estava no PDF principal"
                  value={manualReviewPayment.notes}
                  onChange={(e) =>
                    setManualReviewPayment({ ...manualReviewPayment, notes: e.target.value })
                  }
                  rows={3}
                />
              </div>

              <Alert className="bg-blue-50 border-blue-200">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-sm text-blue-800">
                  💡 <strong>Dica:</strong> Após adicionar, o funcionário aparecerá na lista de contracheques e você poderá editar os valores ou adicionar descontos antes de confirmar.
                </AlertDescription>
              </Alert>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddManualInReview(false);
                  setManualReviewPayment({
                    employeeId: '',
                    name: '',
                    cpf: '',
                    salaryAmount: '0',
                    advanceAmount: '0',
                    foodVoucherAmount: '0',
                    bonusAmount: '0',
                    notes: '',
                  });
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleAddManualToReview}
                className="gap-2 bg-green-600 hover:bg-green-700"
              >
                <Plus className="h-4 w-4" />
                Adicionar à Lista
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Details Dialog */}
        <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>
                Detalhes da Folha - {selectedSheet && getMonthName(selectedSheet.month)}/
                {selectedSheet?.year}
              </DialogTitle>
              <DialogDescription>
                Informações completas da folha de pagamento
              </DialogDescription>
            </DialogHeader>

            {selectedSheet && (
              <div className="space-y-4 py-4">
                <div className="rounded-lg border p-4 space-y-2 bg-gray-50">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-600">
                      Arquivo:
                    </span>
                    <span className="text-sm text-gray-900">
                      {selectedSheet.fileName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-600">
                      Enviado em:
                    </span>
                    <span className="text-sm text-gray-900">
                      {formatDate(selectedSheet.createdAt)}
                    </span>
                  </div>
                  {selectedSheet.notes && (
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-600">
                        Observações:
                      </span>
                      <span className="text-sm text-gray-900">
                        {selectedSheet.notes}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Pagamentos Registrados ({selectedSheet.payments?.length || 0})
                  </h3>

                  {selectedSheet.payments && selectedSheet.payments.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Funcionário</TableHead>
                            <TableHead className="text-right">Salário</TableHead>
                            <TableHead className="text-right">
                              Antecipação
                            </TableHead>
                            <TableHead className="text-right">
                              Vale Alimentação
                            </TableHead>
                            <TableHead className="text-right">Bônus</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedSheet.payments.map((payment) => (
                            <TableRow key={payment.id}>
                              <TableCell className="font-medium">
                                {payment.employee.name}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(payment.salaryAmount)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(payment.advanceAmount)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(payment.foodVoucherAmount)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(payment.bonusAmount)}
                              </TableCell>
                              <TableCell>
                                {payment.isPaid ? (
                                  <Badge className="bg-green-100 text-green-800">
                                    Pago
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">Pendente</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleOpenEditPayment(payment)}
                                    className="gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    title="Editar dados e regenerar PDF"
                                  >
                                    <Edit className="h-4 w-4" />
                                    Editar
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedPaymentForUpload(payment);
                                      setShowUploadPayslipDialog(true);
                                    }}
                                    className="gap-1"
                                    title="Upload contracheque individual"
                                  >
                                    <Upload className="h-4 w-4" />
                                    Contracheque
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-center text-gray-500 py-4">
                      Nenhum pagamento registrado para esta folha
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDetailsDialog(false);
                  setSelectedSheet(null);
                }}
              >
                Fechar
              </Button>
              {selectedSheet && (
                <Button
                  onClick={() => window.open(selectedSheet.fileUrl, '_blank')}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Baixar PDF
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Upload Individual Payslip Dialog */}
        <Dialog open={showUploadPayslipDialog} onOpenChange={setShowUploadPayslipDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Upload de Contracheque Individual</DialogTitle>
              <DialogDescription>
                Envie o contracheque individual do funcionário em PDF
              </DialogDescription>
            </DialogHeader>

            {selectedPaymentForUpload && (
              <div className="space-y-4 py-4">
                <Alert>
                  <FileText className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Funcionário:</strong> {selectedPaymentForUpload.employee.name}<br />
                    <strong>Período:</strong> {getMonthName(selectedPaymentForUpload.month)}/{selectedPaymentForUpload.year}
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label htmlFor="payslip-file">Arquivo PDF do Contracheque *</Label>
                  <Input
                    id="payslip-file"
                    type="file"
                    accept=".pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setPayslipFile(file);
                        console.log('📁 Arquivo selecionado:', file.name, file.size, 'bytes');
                      }
                    }}
                  />
                  {payslipFile && (
                    <p className="text-sm text-gray-600">
                      Arquivo selecionado: {payslipFile.name}
                    </p>
                  )}
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Importante:</strong> Este PDF deve conter apenas o contracheque deste funcionário.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowUploadPayslipDialog(false);
                  setPayslipFile(null);
                  setSelectedPaymentForUpload(null);
                }}
                disabled={uploadingPayslip}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleUploadIndividualPayslip}
                disabled={!payslipFile || uploadingPayslip}
                className="gap-2"
              >
                {uploadingPayslip ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Enviar Contracheque
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ✅ NOVO: Dialog para Editar Pagamento e Regenerar PDF */}
        <Dialog open={showEditPaymentDialog} onOpenChange={setShowEditPaymentDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Contracheque e Regenerar PDF</DialogTitle>
              <DialogDescription>
                Edite os dados do contracheque e clique em salvar para regenerar o PDF correto
              </DialogDescription>
            </DialogHeader>

            {editingPayment && (
              <div className="space-y-6 py-4">
                <Alert className="bg-blue-50 border-blue-200">
                  <FileText className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Funcionário:</strong> {editingPayment.employee.name}<br />
                    <strong>Período:</strong> {getMonthName(editingPayment.month)}/{editingPayment.year}
                  </AlertDescription>
                </Alert>

                {/* Salário Líquido */}
                <div className="space-y-2">
                  <Label className="font-semibold text-lg">💰 Salário (Valor Líquido)</Label>
                  <p className="text-sm text-gray-500">O valor que o funcionário receberá após descontos</p>
                  <Input
                    type="number"
                    step="0.01"
                    value={editPaymentData.salaryAmount}
                    onChange={(e) => setEditPaymentData(prev => ({ ...prev, salaryAmount: e.target.value }))}
                    placeholder="Ex: 1895.40"
                  />
                </div>

                {/* Vencimentos Adicionais */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-semibold text-lg text-green-700">📈 Vencimentos Adicionais</Label>
                      <p className="text-sm text-gray-500">Hora Extra, DSR, Adicional Noturno, etc.</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditPaymentData(prev => ({
                        ...prev,
                        earningsItems: [...prev.earningsItems, { description: '', amount: 0 }]
                      }))}
                      className="gap-1 border-green-300 text-green-700"
                    >
                      <Plus className="h-4 w-4" />
                      Adicionar
                    </Button>
                  </div>
                  
                  {editPaymentData.earningsItems.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">Nenhum vencimento adicional</p>
                  ) : (
                    <div className="space-y-2">
                      {editPaymentData.earningsItems.map((item, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <Input
                            placeholder="Descrição (ex: Hora Extra 50%)"
                            value={item.description}
                            onChange={(e) => {
                              const updated = [...editPaymentData.earningsItems];
                              updated[index].description = e.target.value;
                              setEditPaymentData(prev => ({ ...prev, earningsItems: updated }));
                            }}
                            className="flex-1"
                          />
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Valor"
                            value={item.amount}
                            onChange={(e) => {
                              const updated = [...editPaymentData.earningsItems];
                              updated[index].amount = parseFloat(e.target.value) || 0;
                              setEditPaymentData(prev => ({ ...prev, earningsItems: updated }));
                            }}
                            className="w-32"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const updated = editPaymentData.earningsItems.filter((_, i) => i !== index);
                              setEditPaymentData(prev => ({ ...prev, earningsItems: updated }));
                            }}
                            className="text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Descontos */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-semibold text-lg text-red-700">📉 Descontos</Label>
                      <p className="text-sm text-gray-500">INSS, IRPF, Adiantamento, Vale, etc.</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditPaymentData(prev => ({
                        ...prev,
                        discountItems: [...prev.discountItems, { description: '', amount: 0 }]
                      }))}
                      className="gap-1 border-red-300 text-red-700"
                    >
                      <Plus className="h-4 w-4" />
                      Adicionar
                    </Button>
                  </div>
                  
                  {editPaymentData.discountItems.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">Nenhum desconto cadastrado</p>
                  ) : (
                    <div className="space-y-2">
                      {editPaymentData.discountItems.map((item, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <Input
                            placeholder="Descrição (ex: INSS)"
                            value={item.description}
                            onChange={(e) => {
                              const updated = [...editPaymentData.discountItems];
                              updated[index].description = e.target.value;
                              setEditPaymentData(prev => ({ ...prev, discountItems: updated }));
                            }}
                            className="flex-1"
                          />
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Valor"
                            value={item.amount}
                            onChange={(e) => {
                              const updated = [...editPaymentData.discountItems];
                              updated[index].amount = parseFloat(e.target.value) || 0;
                              setEditPaymentData(prev => ({ ...prev, discountItems: updated }));
                            }}
                            className="w-32"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const updated = editPaymentData.discountItems.filter((_, i) => i !== index);
                              setEditPaymentData(prev => ({ ...prev, discountItems: updated }));
                            }}
                            className="text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Resumo */}
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <h4 className="font-semibold">Resumo do Contracheque:</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Salário (Líquido):</div>
                    <div className="text-right font-mono">{formatCurrency(parseFloat(editPaymentData.salaryAmount) || 0)}</div>
                    
                    <div className="text-green-700">+ Vencimentos Adicionais:</div>
                    <div className="text-right font-mono text-green-700">
                      {formatCurrency(editPaymentData.earningsItems.reduce((sum, e) => sum + (e.amount || 0), 0))}
                    </div>
                    
                    <div className="text-red-700">- Descontos (já deduzidos):</div>
                    <div className="text-right font-mono text-red-700">
                      {formatCurrency(editPaymentData.discountItems.reduce((sum, d) => sum + (d.amount || 0), 0))}
                    </div>
                    
                    <div className="border-t pt-2 font-bold">Total a Receber:</div>
                    <div className="border-t pt-2 text-right font-mono font-bold text-green-600">
                      {formatCurrency(
                        (parseFloat(editPaymentData.salaryAmount) || 0) +
                        editPaymentData.earningsItems.reduce((sum, e) => sum + (e.amount || 0), 0)
                      )}
                    </div>
                  </div>
                </div>

                {/* Botões */}
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowEditPaymentDialog(false);
                      setEditingPayment(null);
                    }}
                    disabled={savingEditPayment}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSaveEditPayment}
                    disabled={savingEditPayment}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {savingEditPayment ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Salvar e Regenerar PDF
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}