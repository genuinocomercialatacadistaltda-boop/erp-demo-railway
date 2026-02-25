import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { DocumentType } from '@prisma/client';
import jsPDF from 'jspdf';
import { uploadFileWithCustomPath } from '@/lib/s3';

// Função auxiliar para formatar minutos em horas
function formatMinutesToHours(minutes: number): string {
  if (!minutes || minutes === 0) return '-';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h${mins.toString().padStart(2, '0')}`;
}

// Interface para os dados de análise recebidos do frontend
interface AnalysisDay {
  date: string;
  dayOfWeek: string;
  status: string;
  entryTime?: string;
  snackBreakStart?: string;
  snackBreakEnd?: string;
  lunchStart?: string;
  lunchEnd?: string;
  exitTime?: string;
  totalMinutes: number;
  timeOffType?: string;
  timeOffReason?: string;
}

interface AnalysisTotals {
  daysWorked: number;
  daysAbsent: number;
  workableDays?: number;
  sundaysAndHolidays?: number;
  totalWorkedFormatted: string;
  totalExpectedFormatted: string;
  totalOvertimeNormalFormatted?: string;
  totalOvertimeHolidayFormatted?: string;
  totalOvertimeFormatted: string;
  totalUndertimeFormatted: string;
  dsrDiscounts?: number;
  dsrDiscountsList?: any[];
  balanceFormatted: string;
}

interface AnalysisData {
  employee: {
    id: string;
    name: string;
    employeeNumber?: string;
  };
  period: {
    startDate: string;
    endDate: string;
  };
  days: AnalysisDay[];
  totals: AnalysisTotals;
}

// Função para gerar PDF usando os MESMOS DADOS do print-only (1 página, formato simples)
async function generateTimesheetPDF(
  employee: any, 
  timesheet: any, 
  analysisData: AnalysisData
): Promise<Buffer> {
  const doc = new jsPDF({
    orientation: 'portrait', // Retrato para caber em 1 página
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const margin = 10;
  
  // Configurações de fonte
  doc.setFont('helvetica');
  
  // Cabeçalho
  let yPos = 15;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('[SUA EMPRESA] - A Essência do Espetinho Perfeito', pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const startDate = new Date(analysisData.period.startDate + 'T12:00:00');
  const endDate = new Date(analysisData.period.endDate + 'T12:00:00');
  const periodText = `Funcionário: ${employee.name} (${employee.employeeNumber || '-'}) | Período: ${startDate.toLocaleDateString('pt-BR')} a ${endDate.toLocaleDateString('pt-BR')}`;
  doc.text(periodText, pageWidth / 2, yPos, { align: 'center' });
  
  // Tabela
  yPos += 8;
  
  // Colunas: Data, Dia, Entrada 1, Saída 1, Entrada 2, Saída 2, Entrada 3, Saída 3, Total
  const colWidths = [18, 16, 20, 20, 20, 20, 20, 20, 18];
  const headers = ['Data', 'Dia', 'Entrada 1', 'Saída 1', 'Entrada 2', 'Saída 2', 'Entrada 3', 'Saída 3', 'Total'];
  
  // Cabeçalho da tabela
  doc.setFillColor(230, 230, 230);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 6, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  
  let xPos = margin;
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], xPos + colWidths[i] / 2, yPos + 4, { align: 'center' });
    xPos += colWidths[i];
  }
  
  yPos += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  
  // Linhas da tabela - usando os dados de analysisData (mesmos do print-only)
  for (const day of analysisData.days) {
    const statusSpecial = day.status === 'HOLIDAY' || day.status === 'TIME_OFF' || day.status === 'ABSENT' || day.status === 'BIRTHDAY';
    
    // Borda da linha
    doc.setDrawColor(200, 200, 200);
    doc.rect(margin, yPos, pageWidth - 2 * margin, 5, 'S');
    
    xPos = margin;
    
    // Data (DD/MM)
    const dateObj = new Date(day.date + 'T12:00:00');
    const dateStr = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    doc.text(dateStr, xPos + colWidths[0] / 2, yPos + 3.5, { align: 'center' });
    xPos += colWidths[0];
    
    // Dia da semana
    doc.text(day.dayOfWeek || '', xPos + colWidths[1] / 2, yPos + 3.5, { align: 'center' });
    xPos += colWidths[1];
    
    // Entrada 1 (ou status especial)
    let entry1 = '';
    if (statusSpecial) {
      if (day.status === 'HOLIDAY') entry1 = 'Feriado';
      else if (day.status === 'TIME_OFF') entry1 = 'Atestado';
      else if (day.status === 'BIRTHDAY') entry1 = 'Aniver.';
      else if (day.status === 'ABSENT') entry1 = 'Falta';
    } else {
      entry1 = day.entryTime || '';
    }
    doc.text(entry1, xPos + colWidths[2] / 2, yPos + 3.5, { align: 'center' });
    xPos += colWidths[2];
    
    // Saída 1 (snackBreakStart)
    doc.text(statusSpecial ? '' : (day.snackBreakStart || ''), xPos + colWidths[3] / 2, yPos + 3.5, { align: 'center' });
    xPos += colWidths[3];
    
    // Entrada 2 (snackBreakEnd)
    doc.text(statusSpecial ? '' : (day.snackBreakEnd || ''), xPos + colWidths[4] / 2, yPos + 3.5, { align: 'center' });
    xPos += colWidths[4];
    
    // Saída 2 (lunchStart)
    doc.text(statusSpecial ? '' : (day.lunchStart || ''), xPos + colWidths[5] / 2, yPos + 3.5, { align: 'center' });
    xPos += colWidths[5];
    
    // Entrada 3 (lunchEnd)
    doc.text(statusSpecial ? '' : (day.lunchEnd || ''), xPos + colWidths[6] / 2, yPos + 3.5, { align: 'center' });
    xPos += colWidths[6];
    
    // Saída 3 (exitTime)
    doc.text(statusSpecial ? '' : (day.exitTime || ''), xPos + colWidths[7] / 2, yPos + 3.5, { align: 'center' });
    xPos += colWidths[7];
    
    // Total
    const totalStr = formatMinutesToHours(day.totalMinutes);
    doc.text(totalStr, xPos + colWidths[8] / 2, yPos + 3.5, { align: 'center' });
    
    yPos += 5;
  }
  
  // Resumo do período
  yPos += 5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo do Período:', margin, yPos);
  
  yPos += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  
  const totals = analysisData.totals;
  doc.text(`• Dias Trabalhados: ${totals.daysWorked} | Faltas: ${totals.daysAbsent} | Dias Úteis: ${totals.workableDays || 0} | Domingos/Feriados: ${totals.sundaysAndHolidays || 0}`, margin, yPos);
  
  yPos += 4;
  doc.text(`• Total Trabalhado: ${totals.totalWorkedFormatted} | Esperado: ${totals.totalExpectedFormatted}`, margin, yPos);
  
  yPos += 4;
  doc.text(`• Horas Extras Normais (50%): ${totals.totalOvertimeNormalFormatted || '0h00min'} | Horas Extras Feriado (100%): ${totals.totalOvertimeHolidayFormatted || '0h00min'}`, margin, yPos);
  
  yPos += 4;
  doc.text(`• Total Horas Extras: ${totals.totalOvertimeFormatted} | Horas Falta: ${totals.totalUndertimeFormatted}`, margin, yPos);
  
  yPos += 4;
  doc.setTextColor(220, 38, 38);
  doc.text(`• DSRs a Descontar: ${totals.dsrDiscounts || 0}`, margin, yPos);
  doc.setTextColor(0, 0, 0);
  
  yPos += 4;
  doc.setFont('helvetica', 'bold');
  doc.text(`• Saldo Final: ${totals.balanceFormatted}`, margin, yPos);
  
  // Ocorrências (se houver)
  const occurrences = analysisData.days.filter(d => 
    d.status !== 'NORMAL' && d.status !== 'OVERTIME' && d.status !== 'UNDERTIME'
  );
  
  if (occurrences.length > 0) {
    yPos += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Ocorrências:', margin, yPos);
    
    yPos += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    
    for (const day of occurrences) {
      const dateObj = new Date(day.date + 'T12:00:00');
      const dateStr = dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
      
      let occText = '';
      if (day.status === 'HOLIDAY') {
        occText = `• ${dateStr}: FERIADO`;
      } else if (day.status === 'TIME_OFF') {
        const tipo = day.timeOffType === 'MEDICAL_LEAVE' ? 'Atestado Médico' : 
                    day.timeOffType === 'VACATION' ? 'Férias' : 
                    day.timeOffType === 'UNPAID_LEAVE' ? 'Licença' : 'Afastamento';
        occText = `• ${dateStr}: ${tipo.toUpperCase()}${day.timeOffReason ? ` - ${day.timeOffReason}` : ''}`;
      } else if (day.status === 'ABSENT') {
        occText = `• ${dateStr}: FALTA`;
      } else if (day.status === 'BIRTHDAY') {
        const trabalhado = day.totalMinutes > 0 ? '(TRABALHOU - 100% H.E.)' : '(ABONO)';
        occText = `• ${dateStr}: ANIVERSÁRIO ${trabalhado}`;
      }
      
      if (occText) {
        doc.text(occText, margin, yPos);
        yPos += 3;
      }
    }
  }
  
  // DSRs a descontar (se houver)
  if (totals.dsrDiscountsList && totals.dsrDiscountsList.length > 0) {
    yPos += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(153, 27, 27);
    doc.text('DSRs a Descontar (Domingos):', margin, yPos);
    
    yPos += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    
    for (let idx = 0; idx < totals.dsrDiscountsList.length; idx++) {
      const dsr = totals.dsrDiscountsList[idx];
      const absenceDate = new Date(dsr.absenceDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const dsrDate = new Date(dsr.dsrDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const absenceTypeLabel = dsr.absenceType === 'FULL_DAY' ? 'Dia Inteiro' : 
                               dsr.absenceType === 'HALF_DAY_MORNING' ? 'Meio Período (Manhã)' : 'Meio Período (Tarde)';
      
      doc.text(`${idx + 1}. Falta ${absenceDate} (${absenceTypeLabel} - ${dsr.hoursLost?.toFixed(1) || 0}h) -> DSR descontado: Domingo ${dsrDate}`, margin, yPos);
      yPos += 3;
    }
    doc.setTextColor(0, 0, 0);
  }
  
  // Área de assinatura
  yPos = Math.max(yPos + 15, 250);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.line(margin, yPos, margin + 80, yPos);
  doc.line(pageWidth - margin - 80, yPos, pageWidth - margin, yPos);
  yPos += 4;
  doc.text('Assinatura do Funcionário', margin + 20, yPos);
  doc.text('Assinatura da Empresa', pageWidth - margin - 60, yPos);
  yPos += 4;
  doc.setFontSize(7);
  doc.text('Data: ____/____/______', margin + 20, yPos);
  doc.text('Data: ____/____/______', pageWidth - margin - 60, yPos);
  
  // Rodapé
  yPos += 10;
  doc.setFontSize(6);
  doc.setTextColor(150, 150, 150);
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pageWidth / 2, yPos, { align: 'center' });

  return Buffer.from(doc.output('arraybuffer'));
}

// POST: Gerar PDF da folha de ponto e criar documento para o funcionário
// AGORA RECEBE analysisData do frontend para usar os MESMOS DADOS do print-only
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Await params (Next.js 14+ requirement)
    const { id } = await params;
    console.log('🔄 Iniciando geração de PDF da folha de ponto:', id);
    
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      console.log('❌ Acesso negado - usuário não autorizado');
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Receber analysisData do body da requisição
    let analysisData: AnalysisData | null = null;
    try {
      const body = await request.json();
      analysisData = body.analysisData;
      console.log('📊 Dados de análise recebidos do frontend');
    } catch {
      console.log('⚠️ Nenhum dado de análise recebido, será usado fallback');
    }

    const timesheetId = id;

    // Buscar a folha de ponto
    const timesheet = await prisma.timesheet.findUnique({
      where: { id: timesheetId },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            cpf: true,
            employeeNumber: true,
            position: true,
          }
        }
      }
    });

    if (!timesheet) {
      console.log('❌ Folha de ponto não encontrada:', timesheetId);
      return NextResponse.json(
        { error: 'Folha de ponto não encontrada' },
        { status: 404 }
      );
    }

    console.log('✅ Folha de ponto encontrada para:', timesheet.employee.name);

    // Se não recebeu analysisData, criar um fallback básico
    if (!analysisData) {
      console.log('⚠️ Criando analysisData fallback...');
      analysisData = {
        employee: {
          id: timesheet.employee.id,
          name: timesheet.employee.name,
          employeeNumber: timesheet.employee.employeeNumber?.toString() || undefined
        },
        period: {
          startDate: timesheet.startDate.toISOString().split('T')[0],
          endDate: timesheet.endDate.toISOString().split('T')[0]
        },
        days: [],
        totals: {
          daysWorked: timesheet.workedDays,
          daysAbsent: timesheet.absentDays,
          totalWorkedFormatted: `${Math.floor(timesheet.totalMinutesWorked / 60)}h${(timesheet.totalMinutesWorked % 60).toString().padStart(2, '0')}min`,
          totalExpectedFormatted: `${Math.floor(timesheet.totalMinutesExpected / 60)}h${(timesheet.totalMinutesExpected % 60).toString().padStart(2, '0')}min`,
          totalOvertimeFormatted: '0h00min',
          totalUndertimeFormatted: '0h00min',
          balanceFormatted: `${Math.floor(timesheet.balanceMinutes / 60)}h${Math.abs(timesheet.balanceMinutes % 60).toString().padStart(2, '0')}min`
        }
      };
    }

    // Gerar PDF usando os dados de analysisData (mesmos do print-only)
    console.log('📄 Gerando PDF da folha de ponto usando dados de análise...');
    const pdfBuffer = await generateTimesheetPDF(
      timesheet.employee, 
      timesheet, 
      analysisData
    );
    console.log('✅ PDF gerado com sucesso, tamanho:', pdfBuffer.length, 'bytes');

    // Fazer upload para S3
    const startMonth = (timesheet.startDate.getMonth() + 1).toString().padStart(2, '0');
    const endMonth = (timesheet.endDate.getMonth() + 1).toString().padStart(2, '0');
    const fileName = `folha-ponto-${timesheet.employee.name.replace(/\s+/g, '-')}-${timesheet.startDate.getFullYear()}-${startMonth}-a-${endMonth}.pdf`;
    const s3Path = `timesheet-pdfs/${timesheet.employee.id}/${fileName}`;

    console.log('☁️ Fazendo upload do PDF para S3:', s3Path);
    const pdfUrl = await uploadFileWithCustomPath(pdfBuffer, s3Path, 'application/pdf');
    console.log('✅ PDF salvo em S3:', pdfUrl);

    if (!pdfUrl || typeof pdfUrl !== 'string') {
      throw new Error('URL do PDF inválida retornada pelo S3');
    }

    // Atualizar a folha de ponto com a URL do PDF
    console.log('📝 Atualizando folha de ponto com URL do PDF...');
    await prisma.timesheet.update({
      where: { id: timesheetId },
      data: { pdfUrl }
    });
    console.log('✅ Folha de ponto atualizada com sucesso');

    // Criar EmployeeDocument para que o funcionário possa visualizar
    // Usar endDate como referência (representa o mês de competência da folha)
    // Formatar datas com timezone fixo para evitar problemas UTC->local
    const formatDateBR = (date: Date) => {
      const d = new Date(date);
      d.setHours(d.getHours() + 12); // Ajustar para evitar mudança de dia por timezone
      return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    };
    const documentData = {
      employeeId: timesheet.employee.id,
      documentType: 'FOLHA_PONTO' as const,
      title: `Folha de Ponto - ${formatDateBR(timesheet.startDate)} a ${formatDateBR(timesheet.endDate)}`,
      description: `Folha de ponto do período de ${formatDateBR(timesheet.startDate)} a ${formatDateBR(timesheet.endDate)}`,
      fileUrl: pdfUrl,
      fileName: fileName,
      fileSize: Math.floor(pdfBuffer.length),
      referenceDate: timesheet.endDate, // Usar mês FINAL como referência de competência
      uploadedBy: session.user?.email || 'admin',
      notes: `Gerado automaticamente em ${new Date().toLocaleString('pt-BR')}`
    };

    console.log('📝 Criando EmployeeDocument com os dados:', documentData);

    const employeeDocument = await prisma.employeeDocument.create({
      data: {
        ...documentData,
        documentType: DocumentType.FOLHA_PONTO
      }
    });

    console.log('✅ EmployeeDocument criado:', employeeDocument.id);
    console.log('🎉 PDF da folha de ponto gerado e documento criado com sucesso!');

    return NextResponse.json({
      success: true,
      timesheet: {
        id: timesheet.id,
        pdfUrl
      },
      document: {
        id: employeeDocument.id,
        title: employeeDocument.title,
        fileUrl: employeeDocument.fileUrl
      }
    });
  } catch (error: any) {
    console.error('❌ ERRO ao gerar PDF da folha de ponto:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    
    // Retornar erro mais detalhado
    return NextResponse.json(
      { 
        error: 'Erro ao gerar PDF da folha de ponto', 
        details: error.message,
        errorType: error.name || 'UnknownError'
      },
      { status: 500 }
    );
  }
}
