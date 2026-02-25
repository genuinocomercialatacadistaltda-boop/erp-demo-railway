'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Upload, Clock, ArrowLeft, Download, FileUp, CheckCircle2, XCircle, 
  FileText, Calendar, User, Trash2, Settings, TrendingUp, TrendingDown, 
  AlertTriangle, CheckCircle, X, Home, Edit, Plus, CalendarDays, Zap 
} from 'lucide-react';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

// Função helper para formatar data sem conversão de timezone
const formatDateWithoutTimezone = (dateString: string | Date) => {
  const date = new Date(dateString);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${day}/${month}/${year}`;
};

export default function AttendancePage() {
  const router = useRouter();
  const { data: session, status } = useSession() || {};
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('import');
  
  // Importação
  const [autoImporting, setAutoImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  
  // Registros
  const [timeRecords, setTimeRecords] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>('all');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  
  // Exclusão
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteStartDate, setDeleteStartDate] = useState('');
  const [deleteEndDate, setDeleteEndDate] = useState('');
  const [deleteEmployeeId, setDeleteEmployeeId] = useState<string>('all');
  
  // Análise de Jornada
  const [analysisEmployeeId, setAnalysisEmployeeId] = useState<string>('');
  const [analysisStartDate, setAnalysisStartDate] = useState('');
  const [analysisEndDate, setAnalysisEndDate] = useState('');
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  
  // Configuração de Jornada
  const [scheduleEmployeeId, setScheduleEmployeeId] = useState<string>('');
  const [workSchedule, setWorkSchedule] = useState<any>(null);
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Edição de Ponto
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingDay, setEditingDay] = useState<any>(null);
  const [editEntryTime, setEditEntryTime] = useState('');
  const [editSnackBreakStart, setEditSnackBreakStart] = useState('');
  const [editSnackBreakEnd, setEditSnackBreakEnd] = useState('');
  const [editLunchStart, setEditLunchStart] = useState('');
  const [editLunchEnd, setEditLunchEnd] = useState('');
  const [editExitTime, setEditExitTime] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Feriados

  // Folhas de Ponto Salvas
  const [savedTimesheets, setSavedTimesheets] = useState<any[]>([]);
  const [loadingTimesheets, setLoadingTimesheets] = useState(false);
  
  // Upload Manual de Folha de Ponto
  const [showUploadTimesheetDialog, setShowUploadTimesheetDialog] = useState(false);
  const [uploadEmployeeId, setUploadEmployeeId] = useState('');
  const [uploadMonth, setUploadMonth] = useState('');
  const [uploadYear, setUploadYear] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadingTimesheet, setUploadingTimesheet] = useState(false);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [showHolidayDialog, setShowHolidayDialog] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<any>(null);
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const [holidayIsRecurring, setHolidayIsRecurring] = useState(false);
  const [holidayNotes, setHolidayNotes] = useState('');
  const [savingHoliday, setSavingHoliday] = useState(false);

  // Afastamentos
  const [timeOffs, setTimeOffs] = useState<any[]>([]);
  const [showTimeOffDialog, setShowTimeOffDialog] = useState(false);
  const [editingTimeOff, setEditingTimeOff] = useState<any>(null);
  const [timeOffEmployeeId, setTimeOffEmployeeId] = useState('');
  const [timeOffType, setTimeOffType] = useState('MEDICAL_LEAVE');
  const [timeOffStartDate, setTimeOffStartDate] = useState('');
  const [timeOffEndDate, setTimeOffEndDate] = useState('');
  const [timeOffReason, setTimeOffReason] = useState('');
  const [timeOffNotes, setTimeOffNotes] = useState('');
  const [savingTimeOff, setSavingTimeOff] = useState(false);
  
  // Estados para upload de documento
  const [timeOffDocument, setTimeOffDocument] = useState<File | null>(null);
  const [timeOffDocumentPreview, setTimeOffDocumentPreview] = useState<string>('');
  const [uploadingDocument, setUploadingDocument] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }
    if ((session?.user as any)?.userType !== 'ADMIN') {
      router.push('/');
      return;
    }
    loadEmployees();
    
    // Define datas padrão (mês atual)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setStartDateFilter(startOfMonth.toISOString().split('T')[0]);
    setEndDateFilter(endOfMonth.toISOString().split('T')[0]);
    setAnalysisStartDate(startOfMonth.toISOString().split('T')[0]);
    setAnalysisEndDate(endOfMonth.toISOString().split('T')[0]);
  }, [session, status, router]);

  const loadEmployees = async () => {
    try {
      const res = await fetch('/api/hr/employees');
      const data = await res.json();
      setEmployees(data);
    } catch (error) {
      console.error('Erro ao carregar funcionários:', error);
    }
  };

  const loadTimeRecords = async () => {
    try {
      setLoading(true);
      let url = '/api/hr/attendance?';
      
      if (startDateFilter) {
        url += `startDate=${new Date(startDateFilter).toISOString()}&`;
      }
      if (endDateFilter) {
        const endDate = new Date(endDateFilter);
        endDate.setHours(23, 59, 59, 999);
        url += `endDate=${endDate.toISOString()}&`;
      }
      if (selectedEmployeeFilter && selectedEmployeeFilter !== 'all') {
        url += `employeeId=${selectedEmployeeFilter}&`;
      }

      const res = await fetch(url);
      const data = await res.json();
      setTimeRecords(data);
    } catch (error) {
      toast.error('Erro ao carregar registros');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setAutoImporting(true);
      setImportResult(null);
      
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/hr/attendance/auto-import', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Erro ao importar arquivo');
        console.error('Erro na importação:', result);
        return;
      }

      setImportResult(result);
      
      if (result.imported > 0) {
        toast.success(`${result.imported} registro(s) importado(s) com sucesso!`);
        loadTimeRecords();
      } else {
        toast.warning('Nenhum registro novo foi importado');
      }
      
    } catch (error: any) {
      console.error('Erro ao importar:', error);
      toast.error('Erro ao processar importação');
    } finally {
      setAutoImporting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!deleteStartDate) {
      toast.error('Selecione ao menos a data inicial');
      return;
    }

    try {
      setLoading(true);
      
      const body: any = {
        startDate: deleteStartDate,
        ...(deleteEndDate && { endDate: deleteEndDate }),
        ...(deleteEmployeeId && deleteEmployeeId !== 'all' && { employeeId: deleteEmployeeId }),
      };

      const response = await fetch('/api/hr/attendance/bulk-delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Erro ao excluir registros');
        return;
      }

      toast.success(result.message);
      setShowDeleteDialog(false);
      loadTimeRecords();
      
      // Limpa os campos
      setDeleteStartDate('');
      setDeleteEndDate('');
      setDeleteEmployeeId('all');
    } catch (error) {
      console.error('Erro ao excluir:', error);
      toast.error('Erro ao excluir registros');
    } finally {
      setLoading(false);
    }
  };

  const loadAnalysis = async () => {
    if (!analysisEmployeeId || !analysisStartDate || !analysisEndDate) {
      toast.error('Selecione funcionário e período');
      return;
    }

    try {
      setLoadingAnalysis(true);
      const url = `/api/hr/attendance/analysis?employeeId=${analysisEmployeeId}&startDate=${analysisStartDate}&endDate=${analysisEndDate}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Erro ao gerar análise');
        return;
      }

      setAnalysisData(data);
    } catch (error) {
      console.error('Erro ao carregar análise:', error);
      toast.error('Erro ao gerar análise');
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handleGenerateTimesheet = async () => {
    if (!analysisData) {
      toast.error('Por favor, clique em "Gerar Análise" antes de gerar a folha de ponto', {
        duration: 5000,
      });
      return;
    }

    setLoading(true);
    try {
      console.log('📝 Dados da análise para folha de ponto:', {
        employee: analysisData.employee,
        period: analysisData.period,
        totals: analysisData.totals,
      });

      // Corrigir período para usar primeiro e último dia do mês
      // Adicionar T12:00:00 para evitar problemas de timezone (UTC->local pode mudar o dia)
      const originalStart = new Date(analysisData.period.startDate + 'T12:00:00');
      const originalEnd = new Date(analysisData.period.endDate + 'T12:00:00');
      
      // Primeiro dia do mês
      const correctedStart = new Date(originalStart.getFullYear(), originalStart.getMonth(), 1, 12, 0, 0);
      // Último dia do mês
      const correctedEnd = new Date(originalEnd.getFullYear(), originalEnd.getMonth() + 1, 0, 12, 0, 0);
      
      // Formatar datas para string YYYY-MM-DD
      const startDateStr = correctedStart.toISOString().split('T')[0];
      const endDateStr = correctedEnd.toISOString().split('T')[0];

      // Calcular total de dias no período
      const totalDays = Math.ceil((correctedEnd.getTime() - correctedStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      // Calcular dias de afastamento (baseado nos registros TIME_OFF)
      const timeOffDays = analysisData.days.filter((d: any) => d.status === 'TIME_OFF').length;

      // Calcular feriados (baseado nos registros HOLIDAY)
      const holidayDays = analysisData.days.filter((d: any) => d.status === 'HOLIDAY').length;

      const payload = {
        employeeId: analysisData.employee.id,
        employeeName: analysisData.employee.name,
        employeeNumber: analysisData.employee.employeeNumber,
        startDate: startDateStr,
        endDate: endDateStr,
        totalDays: totalDays,
        workedDays: analysisData.totals.daysWorked,
        absentDays: analysisData.totals.daysAbsent,
        timeOffDays: timeOffDays,
        holidayDays: holidayDays,
        totalMinutesWorked: analysisData.totals.totalWorkedMinutes,
        totalMinutesExpected: analysisData.totals.totalExpectedMinutes,
        balanceMinutes: analysisData.totals.balance,
        pdfUrl: null, // Será preenchido após geração do PDF
      };

      console.log('📤 Enviando payload para API:', payload);

      // Salvar folha de ponto no banco
      const response = await fetch('/api/hr/timesheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('❌ Erro na resposta da API:', result);
        toast.error(result.error || 'Erro ao salvar folha de ponto');
        return;
      }

      console.log('✅ Folha de ponto salva:', result);
      
      // Gerar PDF e criar documento para o funcionário
      // IMPORTANTE: Enviar analysisData para que o PDF use os MESMOS dados da tela
      console.log('📄 Gerando PDF e enviando para o perfil do funcionário...');
      const pdfResponse = await fetch(`/api/hr/timesheets/${result.id}/generate-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisData }),
      });
      
      const pdfResult = await pdfResponse.json();
      
      if (!pdfResponse.ok) {
        console.error('❌ Erro ao gerar PDF:', pdfResult);
        toast.error('Folha de ponto salva, mas houve erro ao gerar PDF');
        return;
      }
      
      console.log('✅ PDF gerado e documento criado:', pdfResult);
      toast.success(`✅ Folha de ponto gerada e enviada para ${analysisData.employee.name} assinar digitalmente!`, {
        duration: 5000,
      });
      
      // Aguarda um pouco para garantir que o toast apareça antes de imprimir
      setTimeout(() => {
        window.print();
      }, 500);
    } catch (error) {
      console.error('❌ Erro ao gerar folha de ponto:', error);
      toast.error('Erro ao gerar folha de ponto');
    } finally {
      setLoading(false);
    }
  };

  const loadWorkSchedule = async (empId: string) => {
    if (!empId) return;

    try {
      const response = await fetch(`/api/hr/work-schedule?employeeId=${empId}`);
      const data = await response.json();
      
      if (data) {
        setWorkSchedule(data);
      } else {
        // Jornada padrão (seg-sex 8h48min)
        setWorkSchedule({
          employeeId: empId,
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: false,
          sunday: false,
          dailyMinutes: 528,
          weeklyMinutes: 2640,
          lunchBreakMinutes: 60,
          hasFlexibleSchedule: false,
          notes: '',
        });
      }
    } catch (error) {
      console.error('Erro ao carregar jornada:', error);
    }
  };

  const handleSaveSchedule = async () => {
    if (!workSchedule) return;

    try {
      setSavingSchedule(true);
      
      const response = await fetch('/api/hr/work-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workSchedule),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Erro ao salvar jornada');
        return;
      }

      toast.success('Jornada de trabalho salva com sucesso!');
      setWorkSchedule(result);
    } catch (error) {
      console.error('Erro ao salvar jornada:', error);
      toast.error('Erro ao salvar jornada');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleEditDay = (day: any) => {
    setEditingDay(day);
    setEditEntryTime(day.entryTime || '');
    setEditSnackBreakStart(day.snackBreakStart || '');
    setEditSnackBreakEnd(day.snackBreakEnd || '');
    setEditLunchStart(day.lunchStart || '');
    setEditLunchEnd(day.lunchEnd || '');
    setEditExitTime(day.exitTime || '');
    setEditNotes('');
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!editingDay || !analysisEmployeeId) return;

    try {
      setSavingEdit(true);

      const response = await fetch('/api/hr/attendance/day-edit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: analysisEmployeeId,
          date: editingDay.date,
          entryTime: editEntryTime,
          snackBreakStart: editSnackBreakStart,
          snackBreakEnd: editSnackBreakEnd,
          lunchStart: editLunchStart,
          lunchEnd: editLunchEnd,
          exitTime: editExitTime,
          notes: editNotes,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Erro ao salvar alterações');
        return;
      }

      toast.success('Ponto atualizado com sucesso!');
      setShowEditDialog(false);
      loadAnalysis(); // Recarrega a análise
    } catch (error) {
      console.error('Erro ao salvar edição:', error);
      toast.error('Erro ao salvar alterações');
    } finally {
      setSavingEdit(false);
    }
  };

  // 🆕 PREENCHIMENTO AUTOMÁTICO - Jornada Padrão
  const handleQuickFill = async (day: any) => {
    if (!analysisEmployeeId) return;

    // Horários padrão da jornada
    const defaultSchedule = {
      entryTime: '07:00',
      snackBreakStart: '09:00',
      snackBreakEnd: '09:15',
      lunchStart: '12:00',
      lunchEnd: '14:00',
      exitTime: '18:00',
    };

    try {
      const response = await fetch('/api/hr/attendance/day-edit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: analysisEmployeeId,
          date: day.date,
          ...defaultSchedule,
          notes: 'Preenchimento automático - Jornada padrão',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Erro ao preencher jornada');
        return;
      }

      toast.success('Jornada padrão preenchida com sucesso!');
      loadAnalysis(); // Recarrega a análise
    } catch (error) {
      console.error('Erro ao preencher jornada:', error);
      toast.error('Erro ao preencher jornada');
    }
  };

  const loadHolidays = async () => {
    try {
      const year = new Date().getFullYear();
      const response = await fetch(`/api/hr/holidays?year=${year}`);
      const data = await response.json();
      setHolidays(data);
    } catch (error) {
      console.error('Erro ao carregar feriados:', error);
    }
  };

  const loadSavedTimesheets = async () => {
    try {
      setLoadingTimesheets(true);
      console.log('[LOAD_TIMESHEETS] Carregando folhas salvas...');
      
      // Buscar documentos de folha de ponto (FOLHA_PONTO e CONTRACHEQUE)
      const response = await fetch('/api/hr/employee-documents?types=FOLHA_PONTO,CONTRACHEQUE');
      
      if (!response.ok) {
        throw new Error('Erro ao buscar folhas');
      }
      
      const data = await response.json();
      console.log('[LOAD_TIMESHEETS] Folhas carregadas:', data.length);
      setSavedTimesheets(data);
    } catch (error) {
      console.error('[LOAD_TIMESHEETS] Erro ao carregar folhas:', error);
      toast.error('Erro ao carregar folhas de ponto');
    } finally {
      setLoadingTimesheets(false);
    }
  };

  const handleUploadTimesheet = async () => {
    if (!uploadEmployeeId || !uploadMonth || !uploadYear || !uploadFile) {
      toast.error('Por favor, preencha todos os campos e selecione um arquivo');
      return;
    }

    try {
      setUploadingTimesheet(true);
      console.log('📤 [UPLOAD] Iniciando upload de folha de ponto...');
      console.log('📋 [UPLOAD] Funcionário:', uploadEmployeeId);
      console.log('📅 [UPLOAD] Mês/Ano:', uploadMonth, '/', uploadYear);
      console.log('📄 [UPLOAD] Arquivo:', uploadFile.name);

      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('month', uploadMonth);
      formData.append('year', uploadYear);

      const response = await fetch(`/api/hr/employees/${uploadEmployeeId}/upload-payslip`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('❌ [UPLOAD] Erro na resposta:', result);
        toast.error(result.error || 'Erro ao fazer upload da folha de ponto');
        return;
      }

      console.log('✅ [UPLOAD] Upload concluído:', result);
      toast.success('Folha de ponto enviada com sucesso! O funcionário já pode acessá-la.');
      
      // Resetar formulário
      setShowUploadTimesheetDialog(false);
      setUploadEmployeeId('');
      setUploadMonth('');
      setUploadYear('');
      setUploadFile(null);
      
      // Recarregar lista se necessário
      await loadSavedTimesheets();
    } catch (error) {
      console.error('❌ [UPLOAD] Erro:', error);
      toast.error('Erro ao fazer upload da folha de ponto');
    } finally {
      setUploadingTimesheet(false);
    }
  };

  const handleDeleteTimesheet = async (timesheetId: string, employeeName: string) => {
    if (!confirm(`Tem certeza que deseja excluir a folha de ponto de ${employeeName}?`)) {
      return;
    }

    try {
      console.log('[DELETE_TIMESHEET] Excluindo folha:', timesheetId);
      
      const response = await fetch(`/api/hr/timesheets/${timesheetId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao excluir folha');
      }

      const result = await response.json();
      console.log('[DELETE_TIMESHEET] Folha excluída com sucesso:', result);
      
      toast.success('Folha de ponto excluída com sucesso!');
      
      // Recarregar a lista de folhas
      await loadSavedTimesheets();
    } catch (error: any) {
      console.error('[DELETE_TIMESHEET] Erro ao excluir:', error);
      toast.error(error.message || 'Erro ao excluir folha de ponto');
    }
  };

  // Carregar folhas salvas quando a aba estiver ativa
  useEffect(() => {
    if (activeTab === 'timesheets' && (session?.user as any)?.userType === 'ADMIN') {
      loadSavedTimesheets();
    }
  }, [activeTab, session]);

  const handleEditHoliday = (holiday: any) => {
    setEditingHoliday(holiday);
    setHolidayDate(new Date(holiday.date).toISOString().split('T')[0]);
    setHolidayName(holiday.name);
    setHolidayIsRecurring(holiday.isRecurring);
    setHolidayNotes(holiday.notes || '');
    setShowHolidayDialog(true);
  };

  const handleSaveHoliday = async () => {
    if (!holidayDate || !holidayName) {
      toast.error('Data e nome do feriado são obrigatórios');
      return;
    }

    try {
      setSavingHoliday(true);

      const url = editingHoliday 
        ? `/api/hr/holidays/${editingHoliday.id}`
        : '/api/hr/holidays';
      
      const method = editingHoliday ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: holidayDate,
          name: holidayName,
          isRecurring: holidayIsRecurring,
          notes: holidayNotes,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || `Erro ao ${editingHoliday ? 'atualizar' : 'criar'} feriado`);
        return;
      }

      toast.success(`Feriado ${editingHoliday ? 'atualizado' : 'criado'} com sucesso!`);
      setShowHolidayDialog(false);
      setEditingHoliday(null);
      setHolidayDate('');
      setHolidayName('');
      setHolidayIsRecurring(false);
      setHolidayNotes('');
      loadHolidays();
    } catch (error) {
      console.error('Erro ao salvar feriado:', error);
      toast.error(`Erro ao ${editingHoliday ? 'atualizar' : 'criar'} feriado`);
    } finally {
      setSavingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    if (!confirm('Deseja realmente excluir este feriado?')) return;

    try {
      const response = await fetch(`/api/hr/holidays/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Erro ao excluir feriado');
        return;
      }

      toast.success('Feriado excluído com sucesso!');
      loadHolidays();
    } catch (error) {
      console.error('Erro ao excluir feriado:', error);
      toast.error('Erro ao excluir feriado');
    }
  };

  const loadTimeOffs = async () => {
    try {
      const url = analysisEmployeeId 
        ? `/api/hr/time-off?employeeId=${analysisEmployeeId}`
        : '/api/hr/time-off';
      const response = await fetch(url);
      const data = await response.json();
      setTimeOffs(data);
    } catch (error) {
      console.error('Erro ao carregar afastamentos:', error);
    }
  };

  const handleEditTimeOff = (timeOff: any) => {
    setEditingTimeOff(timeOff);
    setTimeOffEmployeeId(timeOff.employeeId);
    setTimeOffType(timeOff.type);
    setTimeOffStartDate(new Date(timeOff.startDate).toISOString().split('T')[0]);
    setTimeOffEndDate(new Date(timeOff.endDate).toISOString().split('T')[0]);
    setTimeOffReason(timeOff.reason || '');
    setTimeOffNotes(timeOff.notes || '');
    setShowTimeOffDialog(true);
  };

  const handleTimeOffDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setTimeOffDocument(file);
      
      // Criar preview apenas para imagens
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setTimeOffDocumentPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setTimeOffDocumentPreview(''); // PDF não tem preview
      }
    }
  };

  const uploadTimeOffDocument = async (): Promise<string | null> => {
    if (!timeOffDocument) return null;

    try {
      setUploadingDocument(true);
      const formData = new FormData();
      formData.append('file', timeOffDocument);

      const response = await fetch('/api/hr/time-off/upload-document', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao fazer upload');
      }

      const data = await response.json();
      return data.cloudStoragePath;
    } catch (error: any) {
      console.error('Erro ao fazer upload do documento:', error);
      toast.error(error.message || 'Erro ao fazer upload do documento');
      return null;
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleSaveTimeOff = async () => {
    if (!timeOffEmployeeId || !timeOffStartDate || !timeOffEndDate) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      setSavingTimeOff(true);

      // Fazer upload do documento se houver
      let documentUrl = editingTimeOff?.documentUrl || null;
      if (timeOffDocument) {
        const uploadedPath = await uploadTimeOffDocument();
        if (!uploadedPath) {
          setSavingTimeOff(false);
          return; // Parar se o upload falhar
        }
        documentUrl = uploadedPath;
      }

      // 🆕 LÓGICA PARA "TODOS OS FUNCIONÁRIOS"
      if (timeOffEmployeeId === 'ALL_EMPLOYEES' && !editingTimeOff) {
        console.log('🔄 Criando afastamento para TODOS os funcionários...');
        
        let successCount = 0;
        let errorCount = 0;

        // Criar afastamento para cada funcionário
        for (const employee of employees) {
          try {
            const response = await fetch('/api/hr/time-off', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                employeeId: employee.id,
                type: timeOffType,
                startDate: timeOffStartDate,
                endDate: timeOffEndDate,
                reason: timeOffReason,
                notes: timeOffNotes,
                documentUrl,
                isApproved: true,
              }),
            });

            if (response.ok) {
              successCount++;
              console.log(`✅ Afastamento criado para: ${employee.name}`);
            } else {
              errorCount++;
              console.error(`❌ Erro ao criar para ${employee.name}:`, await response.text());
            }
          } catch (err) {
            errorCount++;
            console.error(`❌ Erro ao criar para ${employee.name}:`, err);
          }
        }

        if (successCount > 0) {
          toast.success(`✅ ${successCount} afastamento(s) criado(s) com sucesso!${errorCount > 0 ? ` (${errorCount} falha(s))` : ''}`);
        } else {
          toast.error('❌ Falha ao criar afastamentos');
        }

        setShowTimeOffDialog(false);
        setEditingTimeOff(null);
        setTimeOffEmployeeId('');
        setTimeOffType('MEDICAL_LEAVE');
        setTimeOffStartDate('');
        setTimeOffEndDate('');
        setTimeOffReason('');
        setTimeOffNotes('');
        setTimeOffDocument(null);
        setTimeOffDocumentPreview('');
        loadTimeOffs();
        if (analysisEmployeeId) {
          loadAnalysis();
        }
        return;
      }

      // 🔵 LÓGICA ORIGINAL PARA UM ÚNICO FUNCIONÁRIO
      const url = editingTimeOff 
        ? `/api/hr/time-off/${editingTimeOff.id}`
        : '/api/hr/time-off';
      
      const method = editingTimeOff ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: timeOffEmployeeId,
          type: timeOffType,
          startDate: timeOffStartDate,
          endDate: timeOffEndDate,
          reason: timeOffReason,
          notes: timeOffNotes,
          documentUrl,
          isApproved: true,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || `Erro ao ${editingTimeOff ? 'atualizar' : 'criar'} afastamento`);
        return;
      }

      toast.success(`Afastamento ${editingTimeOff ? 'atualizado' : 'criado'} com sucesso!`);
      setShowTimeOffDialog(false);
      setEditingTimeOff(null);
      setTimeOffEmployeeId('');
      setTimeOffType('MEDICAL_LEAVE');
      setTimeOffStartDate('');
      setTimeOffEndDate('');
      setTimeOffReason('');
      setTimeOffNotes('');
      setTimeOffDocument(null);
      setTimeOffDocumentPreview('');
      loadTimeOffs();
      if (analysisEmployeeId) {
        loadAnalysis(); // Recarrega se estiver vendo um funcionário
      }
    } catch (error) {
      console.error('Erro ao salvar afastamento:', error);
      toast.error(`Erro ao ${editingTimeOff ? 'atualizar' : 'criar'} afastamento`);
    } finally {
      setSavingTimeOff(false);
    }
  };

  const handleDeleteTimeOff = async (id: string) => {
    if (!confirm('Deseja realmente excluir este afastamento?')) return;

    try {
      const response = await fetch(`/api/hr/time-off/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Erro ao excluir afastamento');
        return;
      }

      toast.success('Afastamento excluído com sucesso!');
      loadTimeOffs();
      if (analysisEmployeeId) {
        loadAnalysis(); // Recarrega se estiver vendo um funcionário
      }
    } catch (error) {
      console.error('Erro ao excluir afastamento:', error);
      toast.error('Erro ao excluir afastamento');
    }
  };

  const getStatusBadge = (status: string, isBirthday?: boolean) => {
    const badges: Record<string, { label: string; color: string }> = {
      NORMAL: { label: 'Normal', color: 'bg-green-100 text-green-800' },
      OVERTIME: { label: 'Hora Extra', color: 'bg-blue-100 text-blue-800' },
      UNDERTIME: { label: 'Hora Falta', color: 'bg-orange-100 text-orange-800' },
      ABSENT: { label: 'Falta', color: 'bg-red-100 text-red-800' },
      TIME_OFF: { label: 'Afastamento', color: 'bg-purple-100 text-purple-800' },
      HOLIDAY: { label: 'Feriado', color: 'bg-gray-100 text-gray-800' },
      BIRTHDAY: { label: '🎂 Aniversário', color: 'bg-pink-100 text-pink-800' },
    };

    const badge = badges[status] || badges.NORMAL;
    return <Badge className={badge.color}>{badge.label}</Badge>;
  };

  return (
    <>
      <style jsx global>{`
        .print-only {
          display: none;
        }
        
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
          
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            overflow: hidden !important;
          }
          
          /* Oculta todos os elementos da página */
          body * {
            visibility: hidden !important;
            height: 0 !important;
            overflow: hidden !important;
          }
          
          /* Mostra apenas o relatório */
          .print-only,
          .print-only * {
            visibility: visible !important;
            height: auto !important;
            overflow: visible !important;
          }
          
          .print-only {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
            page-break-before: avoid !important;
          }
          
          .print-only table {
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
          }
          
          /* Força cores e bordas */
          .print-only table,
          .print-only th,
          .print-only td,
          .print-only div {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
        }
      `}</style>
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = '/admin'}
            >
              <Home className="h-4 w-4 mr-2" />
              Página Inicial
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </div>
          <h1 className="text-2xl font-bold">Controle de Ponto</h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="import">
              <FileUp className="h-4 w-4 mr-2" />
              Importar
            </TabsTrigger>
            <TabsTrigger value="records">
              <Clock className="h-4 w-4 mr-2" />
              Registros
            </TabsTrigger>
            <TabsTrigger value="analysis">
              <TrendingUp className="h-4 w-4 mr-2" />
              Análise de Jornada
            </TabsTrigger>
            <TabsTrigger value="timesheets">
              <FileText className="h-4 w-4 mr-2" />
              Folhas Salvas
            </TabsTrigger>
            <TabsTrigger value="holidays">
              <CalendarDays className="h-4 w-4 mr-2" />
              Feriados
            </TabsTrigger>
            <TabsTrigger value="timeoff">
              <Calendar className="h-4 w-4 mr-2" />
              Afastamentos
            </TabsTrigger>
            <TabsTrigger value="schedule">
              <Settings className="h-4 w-4 mr-2" />
              Configurar Jornada
            </TabsTrigger>
          </TabsList>

          {/* TAB: IMPORTAR */}
          <TabsContent value="import">
            <Card>
              <CardHeader>
                <CardTitle>Importação Automática de Ponto</CardTitle>
                <CardDescription>
                  Importe o arquivo CSV do relógio Kenup. O sistema criará automaticamente os funcionários e registrará os pontos.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="file">Selecione o arquivo CSV</Label>
                  <Input
                    id="file"
                    type="file"
                    accept=".csv"
                    onChange={handleAutoImport}
                    disabled={autoImporting}
                  />
                </div>

                {autoImporting && (
                  <div className="flex items-center gap-2 text-blue-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span>Processando arquivo...</span>
                  </div>
                )}

                {importResult && (
                  <Card className="bg-green-50 border-green-200">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-green-900 mb-2">
                            Importação Concluída!
                          </h4>
                          <div className="text-sm text-green-800 space-y-1">
                            <p>📊 Total de registros no arquivo: {importResult.totalRecords}</p>
                            <p>👥 Funcionários encontrados: {importResult.employeesFound}</p>
                            <p>✅ Funcionários criados: {importResult.employeesCreated}</p>
                            <p>📝 Registros importados: {importResult.imported}</p>
                            <p>⚠️  Duplicados ignorados: {importResult.duplicates}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: REGISTROS */}
          <TabsContent value="records">
            <Card>
              <CardHeader>
                <CardTitle>Registros de Ponto</CardTitle>
                <CardDescription>
                  Visualize e gerencie os registros de ponto importados
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filtros */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label>Funcionário</Label>
                    <Select
                      value={selectedEmployeeFilter}
                      onValueChange={setSelectedEmployeeFilter}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os funcionários</SelectItem>
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.name} (Nº {emp.employeeNumber})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Data Inicial</Label>
                    <Input
                      type="date"
                      value={startDateFilter}
                      onChange={(e) => setStartDateFilter(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Data Final</Label>
                    <Input
                      type="date"
                      value={endDateFilter}
                      onChange={(e) => setEndDateFilter(e.target.value)}
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <Button onClick={loadTimeRecords} disabled={loading}>
                      <FileText className="h-4 w-4 mr-2" />
                      Buscar
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={() => setShowDeleteDialog(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </Button>
                  </div>
                </div>

                {/* Tabela */}
                {loading ? (
                  <div className="text-center py-8">Carregando...</div>
                ) : timeRecords.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Nenhum registro encontrado
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Funcionário</TableHead>
                          <TableHead>Nº</TableHead>
                          <TableHead>Departamento</TableHead>
                          <TableHead>Data/Hora</TableHead>
                          <TableHead>Máquina</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {timeRecords.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell>{record.employee.name}</TableCell>
                            <TableCell>{record.employeeNumber}</TableCell>
                            <TableCell>{record.employee.department?.name || '-'}</TableCell>
                            <TableCell>
                              {new Date(record.dateTime).toLocaleString('pt-BR', {
                                timeZone: 'America/Sao_Paulo'
                              })}
                            </TableCell>
                            <TableCell>{record.machineNumber || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: ANÁLISE DE JORNADA */}
          <TabsContent value="analysis">
            <Card>
              <CardHeader>
                <CardTitle>Análise de Jornada de Trabalho</CardTitle>
                <CardDescription>
                  Visualize horas trabalhadas, horas extras, faltas e outros detalhes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Filtros */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label>Funcionário *</Label>
                    <Select
                      value={analysisEmployeeId}
                      onValueChange={setAnalysisEmployeeId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.name} (Nº {emp.employeeNumber})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Data Inicial *</Label>
                    <Input
                      type="date"
                      value={analysisStartDate}
                      onChange={(e) => setAnalysisStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Data Final *</Label>
                    <Input
                      type="date"
                      value={analysisEndDate}
                      onChange={(e) => setAnalysisEndDate(e.target.value)}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button 
                      onClick={loadAnalysis} 
                      disabled={loadingAnalysis}
                      className="w-full"
                    >
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Gerar Análise
                    </Button>
                  </div>
                </div>

                {loadingAnalysis && (
                  <div className="text-center py-8">Gerando análise...</div>
                )}

                {analysisData && (
                  <div className="space-y-6">
                    {/* Resumo */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">
                              {analysisData.totals.daysWorked}
                            </div>
                            <div className="text-sm text-gray-600">Dias Trabalhados</div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-red-600">
                              {analysisData.totals.daysAbsent}
                            </div>
                            <div className="text-sm text-gray-600">Faltas</div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">
                              {analysisData.totals.totalOvertimeNormalFormatted || '0h00min'}
                            </div>
                            <div className="text-sm text-gray-600">H. Extras 50%</div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-emerald-600">
                              {analysisData.totals.totalOvertimeHolidayFormatted || '0h00min'}
                            </div>
                            <div className="text-sm text-gray-600">H. Extras 100%</div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="border-red-200 bg-red-50">
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <div className="text-xl font-bold text-red-700">
                              {analysisData.totals.dsrDiscounts || 0}
                            </div>
                            <div className="text-xs text-red-600">DSRs a Descontar</div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-orange-600">
                              {analysisData.totals.totalUndertimeFormatted}
                            </div>
                            <div className="text-sm text-gray-600">Horas Falta</div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Detalhes por Dia */}
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <h3 className="text-lg font-semibold">Detalhes Diários - Folha de Ponto</h3>
                          <p className="text-sm text-gray-600">
                            Clique no botão para gerar o PDF, imprimir e enviar automaticamente para o funcionário assinar digitalmente
                          </p>
                        </div>
                        <Button
                          onClick={handleGenerateTimesheet}
                          disabled={loading || !analysisData}
                          className="bg-green-600 hover:bg-green-700"
                          title="Gera o PDF para impressão e envia automaticamente para o funcionário assinar digitalmente"
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          {loading ? 'Gerando e Enviando...' : '📄 Gerar Folha e Enviar para Assinatura'}
                        </Button>
                      </div>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Data</TableHead>
                              <TableHead>Dia</TableHead>
                              <TableHead>Entrada 1</TableHead>
                              <TableHead>Saída 1</TableHead>
                              <TableHead>Entrada 2</TableHead>
                              <TableHead>Saída 2</TableHead>
                              <TableHead>Entrada 3</TableHead>
                              <TableHead>Saída 3</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Trabalhado</TableHead>
                              <TableHead>Esperado</TableHead>
                              <TableHead>Extra</TableHead>
                              <TableHead>Falta</TableHead>
                              <TableHead className="no-print">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {analysisData.days.map((day: any) => (
                              <TableRow key={day.date}>
                                <TableCell>
                                  {new Date(day.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                </TableCell>
                                <TableCell>{day.dayOfWeek}</TableCell>
                                <TableCell className="font-mono">{day.entryTime || '-'}</TableCell>
                                <TableCell className="font-mono">{day.snackBreakStart || '-'}</TableCell>
                                <TableCell className="font-mono">{day.snackBreakEnd || '-'}</TableCell>
                                <TableCell className="font-mono">{day.lunchStart || '-'}</TableCell>
                                <TableCell className="font-mono">{day.lunchEnd || '-'}</TableCell>
                                <TableCell className="font-mono">{day.exitTime || '-'}</TableCell>
                                <TableCell>{getStatusBadge(day.status)}</TableCell>
                                <TableCell>
                                  {day.totalMinutes > 0 
                                    ? `${Math.floor(day.totalMinutes / 60)}h${(day.totalMinutes % 60).toString().padStart(2, '0')}min`
                                    : '-'}
                                </TableCell>
                                <TableCell>
                                  {day.expectedMinutes > 0 
                                    ? `${Math.floor(day.expectedMinutes / 60)}h${(day.expectedMinutes % 60).toString().padStart(2, '0')}min`
                                    : '-'}
                                </TableCell>
                                <TableCell className="text-green-600 font-semibold">
                                  {day.overtime > 0 
                                    ? `${Math.floor(day.overtime / 60)}h${(day.overtime % 60).toString().padStart(2, '0')}min`
                                    : '-'}
                                </TableCell>
                                <TableCell className="text-orange-600 font-semibold">
                                  {day.undertime > 0 
                                    ? `${Math.floor(day.undertime / 60)}h${(day.undertime % 60).toString().padStart(2, '0')}min`
                                    : '-'}
                                </TableCell>
                                <TableCell className="no-print">
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleQuickFill(day)}
                                      title="Preencher jornada padrão (07:00-18:00)"
                                      className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                    >
                                      <Zap className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleEditDay(day)}
                                      title="Editar ponto manualmente"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>

                    {/* Saldo Final */}
                    <Card className={analysisData.totals.balanceStatus === 'positive' ? 'bg-green-50' : 'bg-orange-50'}>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-3xl font-bold mb-2">
                            {analysisData.totals.balanceFormatted}
                          </div>
                          <div className="text-lg">
                            {analysisData.totals.balanceStatus === 'positive' ? (
                              <span className="text-green-700">Banco de Horas Positivo</span>
                            ) : (
                              <span className="text-orange-700">Banco de Horas Negativo</span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* VERSÃO SIMPLIFICADA PARA IMPRESSÃO */}
                    <div className="print-only">
                      <div style={{ textAlign: 'center', marginBottom: '8px', borderBottom: '2px solid #000', paddingBottom: '6px' }}>
                        <h1 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '2px' }}>ESPETOS GENUÍNO</h1>
                        <h2 style={{ fontSize: '11px', marginBottom: '2px' }}>FOLHA DE PONTO</h2>
                        <p style={{ fontSize: '9px', marginTop: '4px' }}>
                          <strong>Funcionário:</strong> {analysisData.employee?.name} ({analysisData.employee?.employeeNumber})
                          {' | '}
                          <strong>Período:</strong> {new Date(analysisData.period.startDate + 'T12:00:00').toLocaleDateString('pt-BR')} a {new Date(analysisData.period.endDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </p>
                      </div>

                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7px', marginBottom: '8px' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #000' }}>
                            <th style={{ border: '1px solid #000', padding: '3px', textAlign: 'center', fontWeight: 'bold', fontSize: '7px' }}>Data</th>
                            <th style={{ border: '1px solid #000', padding: '3px', textAlign: 'center', fontWeight: 'bold', fontSize: '7px' }}>Dia</th>
                            <th style={{ border: '1px solid #000', padding: '3px', textAlign: 'center', fontWeight: 'bold', fontSize: '7px' }}>Entrada 1</th>
                            <th style={{ border: '1px solid #000', padding: '3px', textAlign: 'center', fontWeight: 'bold', fontSize: '7px' }}>Saída 1</th>
                            <th style={{ border: '1px solid #000', padding: '3px', textAlign: 'center', fontWeight: 'bold', fontSize: '7px' }}>Entrada 2</th>
                            <th style={{ border: '1px solid #000', padding: '3px', textAlign: 'center', fontWeight: 'bold', fontSize: '7px' }}>Saída 2</th>
                            <th style={{ border: '1px solid #000', padding: '3px', textAlign: 'center', fontWeight: 'bold', fontSize: '7px' }}>Entrada 3</th>
                            <th style={{ border: '1px solid #000', padding: '3px', textAlign: 'center', fontWeight: 'bold', fontSize: '7px' }}>Saída 3</th>
                            <th style={{ border: '1px solid #000', padding: '3px', textAlign: 'center', fontWeight: 'bold', fontSize: '7px' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analysisData.days.map((day: any) => {
                            // Lógica simplificada: mostra os 6 horários conforme existem
                            const statusSpecial = day.status === 'HOLIDAY' || day.status === 'TIME_OFF' || day.status === 'ABSENT' || day.status === 'BIRTHDAY';
                            
                            return (
                              <tr key={day.date}>
                                <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontSize: '7px' }}>
                                  {new Date(day.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                </td>
                                <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontSize: '7px' }}>{day.dayOfWeek}</td>
                                <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontFamily: 'monospace', fontSize: '7px' }}>
                                  {statusSpecial ? (day.status === 'HOLIDAY' ? 'Feriado' : day.status === 'TIME_OFF' ? 'Atestado' : day.status === 'BIRTHDAY' ? '🎂 Aniver.' : 'Falta') : (day.entryTime || '')}
                                </td>
                                <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontFamily: 'monospace', fontSize: '7px' }}>
                                  {statusSpecial ? '' : (day.snackBreakStart || '')}
                                </td>
                                <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontFamily: 'monospace', fontSize: '7px' }}>
                                  {statusSpecial ? '' : (day.snackBreakEnd || '')}
                                </td>
                                <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontFamily: 'monospace', fontSize: '7px' }}>
                                  {statusSpecial ? '' : (day.lunchStart || '')}
                                </td>
                                <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontFamily: 'monospace', fontSize: '7px' }}>
                                  {statusSpecial ? '' : (day.lunchEnd || '')}
                                </td>
                                <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontFamily: 'monospace', fontSize: '7px' }}>
                                  {statusSpecial ? '' : (day.exitTime || '')}
                                </td>
                                <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontSize: '7px' }}>
                                  {day.totalMinutes > 0 ? `${Math.floor(day.totalMinutes / 60)}h${(day.totalMinutes % 60).toString().padStart(2, '0')}` : '-'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      <div style={{ marginTop: '10px', padding: '6px', border: '1px solid #000', backgroundColor: '#f9fafb' }}>
                        <div style={{ fontSize: '8px' }}>
                          <strong>Resumo do Período:</strong>
                          <div style={{ marginTop: '4px', lineHeight: '1.4' }}>
                            • Dias Trabalhados: <strong>{analysisData.totals.daysWorked}</strong> | 
                            Faltas: <strong>{analysisData.totals.daysAbsent}</strong> | 
                            Dias Úteis: <strong>{analysisData.totals.workableDays || 0}</strong> | 
                            Domingos/Feriados: <strong>{analysisData.totals.sundaysAndHolidays || 0}</strong>
                            <br />
                            • Total Trabalhado: <strong>{analysisData.totals.totalWorkedFormatted}</strong> | 
                            Esperado: <strong>{analysisData.totals.totalExpectedFormatted}</strong>
                            <br />
                            • Horas Extras Normais (50%): <strong>{analysisData.totals.totalOvertimeNormalFormatted || '0h00min'}</strong> | 
                            Horas Extras Feriado (100%): <strong>{analysisData.totals.totalOvertimeHolidayFormatted || '0h00min'}</strong>
                            <br />
                            • Total Horas Extras: <strong>{analysisData.totals.totalOvertimeFormatted}</strong> | 
                            Horas Falta: <strong>{analysisData.totals.totalUndertimeFormatted}</strong>
                            <br />
                            • <strong style={{ color: '#dc2626' }}>DSRs a Descontar:</strong> <strong>{analysisData.totals.dsrDiscounts || 0}</strong>
                            <br />
                            • Saldo Final: <strong style={{ fontSize: '10px' }}>{analysisData.totals.balanceFormatted}</strong>
                          </div>
                          <div style={{ marginTop: '6px', fontSize: '7px', color: '#666', fontStyle: 'italic' }}>
                            * DSR (Descanso Semanal Remunerado): Descontado quando há falta na semana (dia inteiro ou meio período ≥3h)
                          </div>
                        </div>
                      </div>

                      {/* Lista de Faltas, Feriados e Atestados */}
                      {analysisData.days.filter((d: any) => d.status !== 'NORMAL' && d.status !== 'OVERTIME' && d.status !== 'UNDERTIME').length > 0 && (
                        <div style={{ marginTop: '8px', padding: '6px', border: '1px solid #000', backgroundColor: '#fff3cd' }}>
                          <strong style={{ fontSize: '8px' }}>Ocorrências:</strong>
                          <div style={{ marginTop: '4px', fontSize: '7px', lineHeight: '1.3' }}>
                            {analysisData.days
                              .filter((d: any) => d.status !== 'NORMAL' && d.status !== 'OVERTIME' && d.status !== 'UNDERTIME')
                              .map((day: any) => {
                                const dateStr = new Date(day.date + 'T12:00:00').toLocaleDateString('pt-BR', { 
                                  weekday: 'long', 
                                  day: '2-digit', 
                                  month: 'long' 
                                });
                                
                                if (day.status === 'HOLIDAY') {
                                  return `• ${dateStr}: FERIADO`;
                                } else if (day.status === 'TIME_OFF') {
                                  const tipo = day.timeOffType === 'MEDICAL_LEAVE' ? 'Atestado Médico' : 
                                              day.timeOffType === 'VACATION' ? 'Férias' : 
                                              day.timeOffType === 'UNPAID_LEAVE' ? 'Licença' : 'Afastamento';
                                  return `• ${dateStr}: ${tipo.toUpperCase()}${day.timeOffReason ? ` - ${day.timeOffReason}` : ''}`;
                                } else if (day.status === 'ABSENT') {
                                  return `• ${dateStr}: FALTA`;
                                } else if (day.status === 'BIRTHDAY') {
                                  const trabalhado = day.totalMinutes > 0 ? '(TRABALHOU - 100% H.E.)' : '(ABONO - Sem desconto)';
                                  return `• ${dateStr}: 🎂 ANIVERSÁRIO ${trabalhado}`;
                                }
                                return '';
                              })
                              .filter(Boolean)
                              .join('\n')}
                          </div>
                        </div>
                      )}

                      {/* Lista de DSRs a Descontar */}
                      {analysisData.totals.dsrDiscountsList && analysisData.totals.dsrDiscountsList.length > 0 && (
                        <div style={{ marginTop: '8px', padding: '6px', border: '1px solid #000', backgroundColor: '#fee2e2' }}>
                          <strong style={{ fontSize: '8px', color: '#991b1b' }}>DSRs a Descontar (Domingos):</strong>
                          <div style={{ marginTop: '4px', fontSize: '7px', lineHeight: '1.4', color: '#7f1d1d' }}>
                            {analysisData.totals.dsrDiscountsList.map((dsr: any, idx: number) => {
                              const absenceDate = new Date(dsr.absenceDate + 'T12:00:00').toLocaleDateString('pt-BR', { 
                                day: '2-digit', 
                                month: '2-digit' 
                              });
                              const dsrDate = new Date(dsr.dsrDate + 'T12:00:00').toLocaleDateString('pt-BR', { 
                                day: '2-digit', 
                                month: '2-digit' 
                              });
                              
                              const absenceTypeLabel = dsr.absenceType === 'FULL_DAY' ? 'Dia Inteiro' : 
                                                       dsr.absenceType === 'HALF_DAY_MORNING' ? 'Meio Período (Manhã)' : 
                                                       'Meio Período (Tarde)';
                              
                              return `${idx + 1}. Falta ${absenceDate} (${absenceTypeLabel} - ${dsr.hoursLost.toFixed(1)}h) → DSR descontado: Domingo ${dsrDate}`;
                            }).join('\n')}
                          </div>
                          <div style={{ marginTop: '4px', fontSize: '6px', color: '#991b1b', fontStyle: 'italic' }}>
                            * Conforme legislação: falta de dia inteiro ou meio período (≥3h) desconta o descanso semanal remunerado (domingo posterior)
                          </div>
                        </div>
                      )}

                      <div style={{ marginTop: '15px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px' }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ borderTop: '1px solid #000', paddingTop: '4px', marginTop: '30px' }}>
                            <strong style={{ fontSize: '8px' }}>Assinatura do Funcionário</strong>
                            <br />
                            <span style={{ fontSize: '7px' }}>Data: ____/____/______</span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ borderTop: '1px solid #000', paddingTop: '4px', marginTop: '30px' }}>
                            <strong style={{ fontSize: '8px' }}>Assinatura da Empresa</strong>
                            <br />
                            <span style={{ fontSize: '7px' }}>Data: ____/____/______</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ marginTop: '15px', fontSize: '6px', textAlign: 'center', color: '#666' }}>
                        <p style={{ margin: '0' }}>Gerado em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: CONFIGURAR JORNADA */}
          <TabsContent value="schedule">
            <Card>
              <CardHeader>
                <CardTitle>Configurar Jornada de Trabalho</CardTitle>
                <CardDescription>
                  Defina a jornada de trabalho, dias úteis e horários
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Seleção de Funcionário */}
                <div>
                  <Label>Funcionário *</Label>
                  <Select
                    value={scheduleEmployeeId}
                    onValueChange={(value) => {
                      setScheduleEmployeeId(value);
                      loadWorkSchedule(value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um funcionário" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name} (Nº {emp.employeeNumber})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {workSchedule && (
                  <div className="space-y-6">
                    {/* Dias de Trabalho */}
                    <div>
                      <Label className="mb-3 block">Dias de Trabalho</Label>
                      <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                        {[
                          { key: 'monday', label: 'Seg' },
                          { key: 'tuesday', label: 'Ter' },
                          { key: 'wednesday', label: 'Qua' },
                          { key: 'thursday', label: 'Qui' },
                          { key: 'friday', label: 'Sex' },
                          { key: 'saturday', label: 'Sáb' },
                          { key: 'sunday', label: 'Dom' },
                        ].map((day) => (
                          <div
                            key={day.key}
                            className={`p-3 border-2 rounded-lg text-center cursor-pointer transition-colors ${
                              workSchedule[day.key]
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 bg-white'
                            }`}
                            onClick={() =>
                              setWorkSchedule({
                                ...workSchedule,
                                [day.key]: !workSchedule[day.key],
                              })
                            }
                          >
                            <div className="font-medium">{day.label}</div>
                            <div className="text-xs mt-1">
                              {workSchedule[day.key] ? '✓' : '-'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Jornada Personalizada por Dia (NOVO) */}
                    <div>
                      <Label className="mb-3 block">
                        Jornada Personalizada por Dia (Opcional)
                        <span className="text-xs text-gray-500 block mt-1">
                          Configure minutos diferentes para cada dia. Se não preencher, usará a jornada diária padrão.
                        </span>
                      </Label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { key: 'mondayMinutes', label: 'Segunda', placeholder: '480' },
                          { key: 'tuesdayMinutes', label: 'Terça', placeholder: '480' },
                          { key: 'wednesdayMinutes', label: 'Quarta', placeholder: '480' },
                          { key: 'thursdayMinutes', label: 'Quinta', placeholder: '480' },
                          { key: 'fridayMinutes', label: 'Sexta', placeholder: '480' },
                          { key: 'saturdayMinutes', label: 'Sábado', placeholder: '240' },
                          { key: 'sundayMinutes', label: 'Domingo', placeholder: '0' },
                        ].map((day) => (
                          <div key={day.key}>
                            <Label className="text-xs">{day.label}</Label>
                            <Input
                              type="number"
                              placeholder={day.placeholder}
                              value={workSchedule[day.key] ?? ''}
                              onChange={(e) =>
                                setWorkSchedule({
                                  ...workSchedule,
                                  [day.key]: e.target.value ? parseInt(e.target.value) : null,
                                })
                              }
                              className="text-sm"
                            />
                            <p className="text-xs text-gray-400 mt-0.5">
                              {day.placeholder === '480' && 'Ex: 480 = 8h'}
                              {day.placeholder === '240' && 'Ex: 240 = 4h'}
                              {day.placeholder === '0' && 'Ex: 0 = folga'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Jornada Diária */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Jornada Diária Padrão (em minutos)</Label>
                        <Input
                          type="number"
                          value={workSchedule.dailyMinutes}
                          onChange={(e) =>
                            setWorkSchedule({
                              ...workSchedule,
                              dailyMinutes: parseInt(e.target.value) || 0,
                            })
                          }
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Ex: 480 = 8h (usado quando não há jornada personalizada)
                        </p>
                      </div>
                      <div>
                        <Label>Jornada Semanal (em minutos)</Label>
                        <Input
                          type="number"
                          value={workSchedule.weeklyMinutes}
                          onChange={(e) =>
                            setWorkSchedule({
                              ...workSchedule,
                              weeklyMinutes: parseInt(e.target.value) || 0,
                            })
                          }
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Ex: 2640 = 44h semanais (padrão CLT)
                        </p>
                      </div>
                    </div>

                    {/* Intervalo de Almoço */}
                    <div>
                      <Label>Intervalo de Almoço (em minutos)</Label>
                      <Input
                        type="number"
                        value={workSchedule.lunchBreakMinutes}
                        onChange={(e) =>
                          setWorkSchedule({
                            ...workSchedule,
                            lunchBreakMinutes: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>

                    {/* Observações */}
                    <div>
                      <Label>Observações</Label>
                      <Input
                        value={workSchedule.notes || ''}
                        onChange={(e) =>
                          setWorkSchedule({
                            ...workSchedule,
                            notes: e.target.value,
                          })
                        }
                        placeholder="Ex: Horário flexível, jornada especial, etc."
                      />
                    </div>

                    {/* Botão Salvar */}
                    <Button 
                      onClick={handleSaveSchedule} 
                      disabled={savingSchedule}
                      className="w-full"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Salvar Jornada
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>


          {/* TAB: FOLHAS DE PONTO SALVAS */}
          <TabsContent value="timesheets">
            <Card>
              <CardHeader>
                <CardTitle>Folhas de Ponto Salvas</CardTitle>
                <CardDescription>
                  Gerencie as folhas de ponto que foram geradas e salvas no sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center gap-4">
                    <Button
                      onClick={() => setShowUploadTimesheetDialog(true)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <FileUp className="mr-2 h-4 w-4" />
                      Upload de Folha de Ponto
                    </Button>
                    <Button
                      onClick={loadSavedTimesheets}
                      disabled={loadingTimesheets}
                      variant="outline"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {loadingTimesheets ? 'Carregando...' : 'Atualizar Lista'}
                    </Button>
                  </div>

                  {loadingTimesheets ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">Carregando folhas de ponto...</p>
                    </div>
                  ) : savedTimesheets.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">Nenhuma folha de ponto salva ainda</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Vá para a aba "Análise de Jornada" para gerar folhas de ponto
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Funcionário</TableHead>
                            <TableHead>Matrícula</TableHead>
                            <TableHead>Período</TableHead>
                            <TableHead>Dias Trabalhados</TableHead>
                            <TableHead>Dias Ausentes</TableHead>
                            <TableHead>Afastamentos</TableHead>
                            <TableHead>Feriados</TableHead>
                            <TableHead>Saldo (horas)</TableHead>
                            <TableHead>Gerado em</TableHead>
                            <TableHead>Gerado por</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {savedTimesheets.map((timesheet) => {
                            const balanceHours = (timesheet.balanceMinutes / 60).toFixed(2);
                            const isNegative = timesheet.balanceMinutes < 0;
                            
                            return (
                              <TableRow key={timesheet.id}>
                                <TableCell className="font-medium">
                                  {timesheet.employeeName}
                                </TableCell>
                                <TableCell>{timesheet.employeeNumber}</TableCell>
                                <TableCell>
                                  <div className="text-sm">
                                    <div>{formatDateWithoutTimezone(timesheet.startDate)}</div>
                                    <div className="text-muted-foreground">
                                      até {formatDateWithoutTimezone(timesheet.endDate)}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-green-50">
                                    {timesheet.workedDays} dias
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {timesheet.absentDays > 0 ? (
                                    <Badge variant="outline" className="bg-red-50">
                                      {timesheet.absentDays} dias
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {timesheet.timeOffDays > 0 ? (
                                    <Badge variant="outline" className="bg-blue-50">
                                      {timesheet.timeOffDays} dias
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {timesheet.holidayDays > 0 ? (
                                    <Badge variant="outline" className="bg-purple-50">
                                      {timesheet.holidayDays} dias
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className={`font-medium ${isNegative ? 'text-red-600' : 'text-green-600'}`}>
                                    {isNegative ? (
                                      <span className="flex items-center gap-1">
                                        <TrendingDown className="h-4 w-4" />
                                        {balanceHours}h
                                      </span>
                                    ) : (
                                      <span className="flex items-center gap-1">
                                        <TrendingUp className="h-4 w-4" />
                                        +{balanceHours}h
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="text-sm text-muted-foreground">
                                    {new Date(timesheet.generatedAt).toLocaleString('pt-BR')}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="text-sm text-muted-foreground">
                                    {timesheet.generatedBy}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteTimesheet(timesheet.id, timesheet.employeeName)}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: FERIADOS */}
          <TabsContent value="holidays">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Gerenciar Feriados</CardTitle>
                    <CardDescription>
                      Configure os feriados para cálculo correto de ponto
                    </CardDescription>
                  </div>
                  <Button onClick={() => {
                    setEditingHoliday(null);
                    setHolidayDate('');
                    setHolidayName('');
                    setHolidayIsRecurring(false);
                    setHolidayNotes('');
                    setShowHolidayDialog(true);
                    loadHolidays();
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Feriado
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Recorrente</TableHead>
                        <TableHead>Observações</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {holidays.map((holiday) => (
                        <TableRow key={holiday.id}>
                          <TableCell>
                            {formatDateWithoutTimezone(holiday.date)}
                          </TableCell>
                          <TableCell className="font-medium">{holiday.name}</TableCell>
                          <TableCell>
                            {holiday.isRecurring ? (
                              <Badge variant="secondary">Anual</Badge>
                            ) : (
                              <Badge variant="outline">Único</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {holiday.notes || '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditHoliday(holiday)}
                                title="Editar feriado"
                              >
                                <Edit className="h-4 w-4 text-blue-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteHoliday(holiday.id)}
                                title="Excluir feriado"
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: AFASTAMENTOS */}
          <TabsContent value="timeoff">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Gerenciar Afastamentos</CardTitle>
                    <CardDescription>
                      Registre atestados, férias e outros afastamentos
                    </CardDescription>
                  </div>
                  <Button onClick={() => {
                    setEditingTimeOff(null);
                    setTimeOffEmployeeId('');
                    setTimeOffType('MEDICAL_LEAVE');
                    setTimeOffStartDate('');
                    setTimeOffEndDate('');
                    setTimeOffReason('');
                    setTimeOffNotes('');
                    setShowTimeOffDialog(true);
                    loadTimeOffs();
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Afastamento
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Funcionário</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Início</TableHead>
                        <TableHead>Fim</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {timeOffs.map((timeOff) => (
                        <TableRow key={timeOff.id}>
                          <TableCell className="font-medium">
                            {timeOff.employee.name}
                          </TableCell>
                          <TableCell>
                            <Badge>
                              {timeOff.type === 'MEDICAL_LEAVE' && 'Atestado'}
                              {timeOff.type === 'VACATION' && 'Férias'}
                              {timeOff.type === 'PERSONAL_LEAVE' && 'Licença'}
                              {timeOff.type === 'MATERNITY_LEAVE' && 'Maternidade'}
                              {timeOff.type === 'OTHER' && 'Outro'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {formatDateWithoutTimezone(timeOff.startDate)}
                          </TableCell>
                          <TableCell>
                            {formatDateWithoutTimezone(timeOff.endDate)}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {timeOff.reason || '-'}
                          </TableCell>
                          <TableCell>
                            {timeOff.isApproved ? (
                              <Badge variant="secondary" className="bg-green-100 text-green-800">
                                Aprovado
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                                Pendente
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditTimeOff(timeOff)}
                                title="Editar afastamento"
                              >
                                <Edit className="h-4 w-4 text-blue-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteTimeOff(timeOff.id)}
                                title="Excluir afastamento"
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dialog de Edição de Ponto */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Editar Ponto do Dia</DialogTitle>
              <DialogDescription>
                {editingDay && `${new Date(editingDay.date + 'T12:00:00').toLocaleDateString('pt-BR')} - ${editingDay.dayOfWeek}`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>1️⃣ Entrada</Label>
                  <Input
                    type="time"
                    value={editEntryTime}
                    onChange={(e) => setEditEntryTime(e.target.value)}
                  />
                </div>
                <div>
                  <Label>2️⃣ Saída para Lanche</Label>
                  <Input
                    type="time"
                    value={editSnackBreakStart}
                    onChange={(e) => setEditSnackBreakStart(e.target.value)}
                  />
                </div>
                <div>
                  <Label>3️⃣ Volta do Lanche</Label>
                  <Input
                    type="time"
                    value={editSnackBreakEnd}
                    onChange={(e) => setEditSnackBreakEnd(e.target.value)}
                  />
                </div>
                <div>
                  <Label>4️⃣ Saída para Almoço</Label>
                  <Input
                    type="time"
                    value={editLunchStart}
                    onChange={(e) => setEditLunchStart(e.target.value)}
                  />
                </div>
                <div>
                  <Label>5️⃣ Volta do Almoço</Label>
                  <Input
                    type="time"
                    value={editLunchEnd}
                    onChange={(e) => setEditLunchEnd(e.target.value)}
                  />
                </div>
                <div>
                  <Label>6️⃣ Saída Final</Label>
                  <Input
                    type="time"
                    value={editExitTime}
                    onChange={(e) => setEditExitTime(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label>Observações</Label>
                <Input
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Ex: Ajuste manual, esqueceu de bater ponto..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowEditDialog(false)}
                disabled={savingEdit}
              >
                Cancelar
              </Button>
              <Button onClick={handleSaveEdit} disabled={savingEdit}>
                {savingEdit ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Novo Feriado */}
        <Dialog open={showHolidayDialog} onOpenChange={(open) => {
          setShowHolidayDialog(open);
          if (!open) {
            setEditingHoliday(null);
            setHolidayDate('');
            setHolidayName('');
            setHolidayIsRecurring(false);
            setHolidayNotes('');
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingHoliday ? 'Editar Feriado' : 'Novo Feriado'}</DialogTitle>
              <DialogDescription>
                {editingHoliday ? 'Atualize as informações do feriado' : 'Adicione um feriado para o cálculo de ponto'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Data *</Label>
                <Input
                  type="date"
                  value={holidayDate}
                  onChange={(e) => setHolidayDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Nome *</Label>
                <Input
                  value={holidayName}
                  onChange={(e) => setHolidayName(e.target.value)}
                  placeholder="Ex: Natal, Ano Novo..."
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={holidayIsRecurring}
                  onCheckedChange={(checked) => setHolidayIsRecurring(checked as boolean)}
                />
                <Label>Feriado recorrente (todos os anos)</Label>
              </div>
              <div>
                <Label>Observações</Label>
                <Input
                  value={holidayNotes}
                  onChange={(e) => setHolidayNotes(e.target.value)}
                  placeholder="Informações adicionais..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowHolidayDialog(false)}
                disabled={savingHoliday}
              >
                Cancelar
              </Button>
              <Button onClick={handleSaveHoliday} disabled={savingHoliday}>
                {savingHoliday ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Novo Afastamento */}
        <Dialog open={showTimeOffDialog} onOpenChange={(open) => {
          setShowTimeOffDialog(open);
          if (!open) {
            setEditingTimeOff(null);
            setTimeOffEmployeeId('');
            setTimeOffType('MEDICAL_LEAVE');
            setTimeOffStartDate('');
            setTimeOffEndDate('');
            setTimeOffReason('');
            setTimeOffNotes('');
            setTimeOffDocument(null);
            setTimeOffDocumentPreview('');
          }
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingTimeOff ? 'Editar Afastamento' : 'Novo Afastamento'}</DialogTitle>
              <DialogDescription>
                {editingTimeOff ? 'Atualize as informações do afastamento' : 'Registre um afastamento (atestado, férias, etc)'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Funcionário *</Label>
                <Select value={timeOffEmployeeId} onValueChange={setTimeOffEmployeeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um funcionário" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL_EMPLOYEES" className="font-bold text-blue-600">
                      ✅ Todos os Funcionários ({employees.length})
                    </SelectItem>
                    <div className="border-t my-1"></div>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name} (Nº {emp.employeeNumber})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {timeOffEmployeeId === 'ALL_EMPLOYEES' && (
                  <p className="text-sm text-blue-600 mt-1">
                    ℹ️ O afastamento será criado para todos os {employees.length} funcionários
                  </p>
                )}
              </div>
              <div>
                <Label>Tipo *</Label>
                <Select value={timeOffType} onValueChange={setTimeOffType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MEDICAL_LEAVE">Atestado Médico</SelectItem>
                    <SelectItem value="VACATION">Férias</SelectItem>
                    <SelectItem value="PERSONAL_LEAVE">Licença Pessoal</SelectItem>
                    <SelectItem value="MATERNITY_LEAVE">Licença Maternidade</SelectItem>
                    <SelectItem value="OTHER">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data Início *</Label>
                  <Input
                    type="date"
                    value={timeOffStartDate}
                    onChange={(e) => setTimeOffStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Data Fim *</Label>
                  <Input
                    type="date"
                    value={timeOffEndDate}
                    onChange={(e) => setTimeOffEndDate(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label>Motivo</Label>
                <Input
                  value={timeOffReason}
                  onChange={(e) => setTimeOffReason(e.target.value)}
                  placeholder="Descreva o motivo do afastamento..."
                />
              </div>
              <div>
                <Label>Observações</Label>
                <Input
                  value={timeOffNotes}
                  onChange={(e) => setTimeOffNotes(e.target.value)}
                  placeholder="Informações adicionais..."
                />
              </div>
              
              {/* Campo de upload de documento - apenas para Atestado Médico */}
              {timeOffType === 'MEDICAL_LEAVE' && (
                <div className="space-y-2">
                  <Label htmlFor="timeOffDocument">Foto do Atestado</Label>
                  <div className="space-y-2">
                    <Input
                      id="timeOffDocument"
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                      onChange={handleTimeOffDocumentChange}
                    />
                    <p className="text-xs text-gray-500">
                      Formatos aceitos: JPEG, PNG, WEBP, PDF (máx. 10MB)
                    </p>
                    
                    {/* Preview da imagem */}
                    {timeOffDocumentPreview && (
                      <div className="mt-2 border rounded-lg p-2 bg-gray-50">
                        <p className="text-xs text-gray-600 mb-1">Preview:</p>
                        <img 
                          src={timeOffDocumentPreview} 
                          alt="Preview do atestado" 
                          className="max-h-40 rounded object-contain"
                        />
                      </div>
                    )}
                    
                    {/* Indicação de PDF */}
                    {timeOffDocument && timeOffDocument.type === 'application/pdf' && (
                      <div className="mt-2 border rounded-lg p-2 bg-gray-50">
                        <p className="text-xs text-gray-600">
                          📄 Arquivo PDF selecionado: {timeOffDocument.name}
                        </p>
                      </div>
                    )}
                    
                    {/* Mostrar documento existente ao editar */}
                    {editingTimeOff?.documentUrl && !timeOffDocument && (
                      <div className="mt-2 border rounded-lg p-2 bg-blue-50">
                        <p className="text-xs text-gray-600 mb-1">Documento atual:</p>
                        <a 
                          href={editingTimeOff.documentUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-sm"
                        >
                          📎 Ver documento anexado
                        </a>
                        <p className="text-xs text-gray-500 mt-1">
                          Selecione um novo arquivo para substituir
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowTimeOffDialog(false)}
                disabled={savingTimeOff || uploadingDocument}
              >
                Cancelar
              </Button>
              <Button onClick={handleSaveTimeOff} disabled={savingTimeOff || uploadingDocument}>
                {uploadingDocument ? 'Enviando documento...' : (savingTimeOff ? 'Salvando...' : 'Salvar')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Upload de Folha de Ponto */}
        <Dialog open={showUploadTimesheetDialog} onOpenChange={setShowUploadTimesheetDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Upload de Folha de Ponto</DialogTitle>
              <DialogDescription>
                Envie um PDF de folha de ponto para um funcionário assinar digitalmente
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Funcionário *</Label>
                <Select value={uploadEmployeeId} onValueChange={setUploadEmployeeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o funcionário" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name} (Nº {emp.employeeNumber})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Mês *</Label>
                  <Select value={uploadMonth} onValueChange={setUploadMonth}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Janeiro</SelectItem>
                      <SelectItem value="2">Fevereiro</SelectItem>
                      <SelectItem value="3">Março</SelectItem>
                      <SelectItem value="4">Abril</SelectItem>
                      <SelectItem value="5">Maio</SelectItem>
                      <SelectItem value="6">Junho</SelectItem>
                      <SelectItem value="7">Julho</SelectItem>
                      <SelectItem value="8">Agosto</SelectItem>
                      <SelectItem value="9">Setembro</SelectItem>
                      <SelectItem value="10">Outubro</SelectItem>
                      <SelectItem value="11">Novembro</SelectItem>
                      <SelectItem value="12">Dezembro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Ano *</Label>
                  <Select value={uploadYear} onValueChange={setUploadYear}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2023">2023</SelectItem>
                      <SelectItem value="2024">2024</SelectItem>
                      <SelectItem value="2025">2025</SelectItem>
                      <SelectItem value="2026">2026</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Arquivo PDF *</Label>
                <Input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="cursor-pointer"
                />
                {uploadFile && (
                  <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" />
                    {uploadFile.name}
                  </p>
                )}
              </div>
              <div className="rounded-lg bg-blue-50 p-3 border border-blue-200">
                <p className="text-sm text-blue-900">
                  <strong>Atenção:</strong> O arquivo será enviado como um contracheque para o funcionário assinar digitalmente através do painel dele.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowUploadTimesheetDialog(false);
                  setUploadEmployeeId('');
                  setUploadMonth('');
                  setUploadYear('');
                  setUploadFile(null);
                }}
                disabled={uploadingTimesheet}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleUploadTimesheet} 
                disabled={uploadingTimesheet}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {uploadingTimesheet ? (
                  <>
                    <Upload className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <FileUp className="mr-2 h-4 w-4" />
                    Enviar
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Exclusão */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Excluir Registros de Ponto</DialogTitle>
              <DialogDescription>
                Selecione o período e/ou funcionário para excluir os registros.
                Esta ação não pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Funcionário (opcional)</Label>
                <Select
                  value={deleteEmployeeId}
                  onValueChange={setDeleteEmployeeId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os funcionários</SelectItem>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name} (Nº {emp.employeeNumber})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data Inicial *</Label>
                <Input
                  type="date"
                  value={deleteStartDate}
                  onChange={(e) => setDeleteStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Data Final (opcional)</Label>
                <Input
                  type="date"
                  value={deleteEndDate}
                  onChange={(e) => setDeleteEndDate(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Deixe em branco para excluir apenas da data inicial
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleBulkDelete}
                disabled={loading}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir Registros
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
    </>
  );
}
