export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import jsPDF from 'jspdf';
import { uploadFileWithCustomPath } from '@/lib/s3';

// Função auxiliar para formatar moeda
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

// Função para gerar PDF visual do contracheque (formato completo igual ao da contabilidade)
async function generatePayslipPDF(employee: any, payment: any): Promise<Buffer> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Configurações de fonte
  doc.setFont('helvetica');
  
  // Cabeçalho
  doc.setFillColor(34, 139, 34); // verde escuro
  doc.rect(0, 0, 210, 35, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('INDUSTRIA DE [SUA EMPRESA] LTDA', 105, 12, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('CNPJ: 46.773.900/0001-72', 105, 19, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('RECIBO DE CONTRACHEQUE', 105, 28, { align: 'center' });
  
  // Período de referência
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const mesNome = meses[(payment.month - 1)] || payment.month;
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.text(`${mesNome} de ${payment.year}`, 195, 28, { align: 'right' });

  // Resetar cor do texto
  doc.setTextColor(0, 0, 0);
  
  // Dados do Funcionário - Box
  let yPos = 45;
  doc.setFillColor(245, 245, 245);
  doc.rect(15, yPos - 5, 180, 30, 'F');
  doc.setDrawColor(200, 200, 200);
  doc.rect(15, yPos - 5, 180, 30, 'S');
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Dados do Funcionário', 20, yPos);
  
  yPos += 7;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nome: ${employee.name}`, 20, yPos);
  doc.text(`CPF: ${employee.cpf || '000.000.000-00'}`, 120, yPos);
  
  yPos += 6;
  doc.text(`Matrícula: ${employee.employeeNumber || '-'}`, 20, yPos);
  doc.text(`Cargo: ${employee.position || 'Não informado'}`, 120, yPos);
  
  // ===== VENCIMENTOS (BRUTOS) =====
  yPos += 20;
  doc.setFillColor(220, 252, 231); // verde claro
  doc.rect(15, yPos - 5, 180, 10, 'F');
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 139, 34);
  doc.text('VENCIMENTOS (Valores Brutos)', 20, yPos + 2);
  doc.setTextColor(0, 0, 0);
  
  yPos += 12;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  let totalVencimentos = 0;
  
  // Salário Base (valor bruto)
  const salarioBase = payment.salaryGrossAmount || payment.salaryAmount || 0;
  if (salarioBase > 0) {
    doc.text('Salário Base', 20, yPos);
    doc.text(formatCurrency(salarioBase), 190, yPos, { align: 'right' });
    totalVencimentos += salarioBase;
    yPos += 6;
  }
  
  // Vencimentos extras do notes (earningsItems em JSON)
  let earningsItems: any[] = [];
  if (payment.notes) {
    try {
      const notesData = JSON.parse(payment.notes);
      if (notesData.earningsItems && Array.isArray(notesData.earningsItems)) {
        earningsItems = notesData.earningsItems;
      }
    } catch (e) {
      // Notes não é JSON, ignorar
    }
  }
  
  for (const item of earningsItems) {
    if (item.amount && item.amount > 0) {
      doc.text(item.description || 'Vencimento', 20, yPos);
      doc.text(formatCurrency(item.amount), 190, yPos, { align: 'right' });
      totalVencimentos += item.amount;
      yPos += 6;
    }
  }
  
  // Adiantamento Salarial (IMPORTANTE: deve aparecer nos vencimentos)
  const advanceAmount = payment.advanceGrossAmount || payment.advanceAmount || 0;
  if (advanceAmount > 0) {
    doc.text('Adiantamento Salarial', 20, yPos);
    doc.text(formatCurrency(advanceAmount), 190, yPos, { align: 'right' });
    totalVencimentos += advanceAmount;
    yPos += 6;
  }
  
  // Vale Alimentação (se houver)
  if (payment.foodVoucherGrossAmount && payment.foodVoucherGrossAmount > 0) {
    doc.text('Vale Alimentação', 20, yPos);
    doc.text(formatCurrency(payment.foodVoucherGrossAmount), 190, yPos, { align: 'right' });
    totalVencimentos += payment.foodVoucherGrossAmount;
    yPos += 6;
  }
  
  // Bônus (se houver)
  if (payment.bonusGrossAmount && payment.bonusGrossAmount > 0) {
    const isDecimoTerceiro = payment.notes && (
      payment.notes.includes('Décimo Terceiro') || 
      payment.notes.includes('13º')
    );
    doc.text(isDecimoTerceiro ? 'Décimo Terceiro Salário' : 'Bônus/Premiação', 20, yPos);
    doc.text(formatCurrency(payment.bonusGrossAmount), 190, yPos, { align: 'right' });
    totalVencimentos += payment.bonusGrossAmount;
    yPos += 6;
  }
  
  // Linha separadora e Total Vencimentos
  yPos += 3;
  doc.setDrawColor(34, 139, 34);
  doc.line(15, yPos, 195, yPos);
  
  yPos += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Total de Vencimentos', 20, yPos);
  doc.setTextColor(34, 139, 34);
  doc.text(formatCurrency(totalVencimentos), 190, yPos, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  
  // ===== DESCONTOS =====
  yPos += 15;
  doc.setFillColor(254, 226, 226); // vermelho claro
  doc.rect(15, yPos - 5, 180, 10, 'F');
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(185, 28, 28);
  doc.text('DESCONTOS', 20, yPos + 2);
  doc.setTextColor(0, 0, 0);
  
  yPos += 12;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  let totalDescontos = 0;
  
  // Descontos individuais do notes (discountItems em JSON)
  let discountItems: any[] = [];
  if (payment.notes) {
    try {
      const notesData = JSON.parse(payment.notes);
      if (notesData.discountItems && Array.isArray(notesData.discountItems)) {
        discountItems = notesData.discountItems;
      }
    } catch (e) {
      // Se não é JSON, usar os campos padrão
    }
  }
  
  // Se temos discountItems do JSON, usar eles
  if (discountItems.length > 0) {
    for (const item of discountItems) {
      if (item.amount && item.amount > 0) {
        doc.text(item.description || 'Desconto', 20, yPos);
        doc.text(formatCurrency(item.amount), 190, yPos, { align: 'right' });
        totalDescontos += item.amount;
        yPos += 6;
      }
    }
  } else {
    // Fallback: usar campos individuais
    if (payment.inssDiscount && payment.inssDiscount > 0) {
      doc.text('INSS', 20, yPos);
      doc.text(formatCurrency(payment.inssDiscount), 190, yPos, { align: 'right' });
      totalDescontos += payment.inssDiscount;
      yPos += 6;
    }
    
    if (payment.irpfDiscount && payment.irpfDiscount > 0) {
      doc.text('IRPF', 20, yPos);
      doc.text(formatCurrency(payment.irpfDiscount), 190, yPos, { align: 'right' });
      totalDescontos += payment.irpfDiscount;
      yPos += 6;
    }
    
    if (payment.otherDiscounts && payment.otherDiscounts > 0) {
      doc.text('Outros Descontos', 20, yPos);
      doc.text(formatCurrency(payment.otherDiscounts), 190, yPos, { align: 'right' });
      totalDescontos += payment.otherDiscounts;
      yPos += 6;
    }
  }
  
  if (totalDescontos === 0) {
    doc.setTextColor(150, 150, 150);
    doc.text('Nenhum desconto aplicado', 20, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 6;
  }
  
  // Linha separadora e Total Descontos
  yPos += 3;
  doc.setDrawColor(185, 28, 28);
  doc.line(15, yPos, 195, yPos);
  
  yPos += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Total de Descontos', 20, yPos);
  doc.setTextColor(185, 28, 28);
  doc.text(formatCurrency(totalDescontos), 190, yPos, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  
  // ===== VALOR LÍQUIDO =====
  yPos += 15;
  doc.setFillColor(34, 139, 34);
  doc.rect(15, yPos - 5, 180, 18, 'F');
  
  const valorLiquido = totalVencimentos - totalDescontos;
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('VALOR LÍQUIDO A RECEBER', 20, yPos + 5);
  
  doc.setFontSize(16);
  doc.text(formatCurrency(valorLiquido), 190, yPos + 5, { align: 'right' });
  
  // Resetar cor
  doc.setTextColor(0, 0, 0);
  
  // Datas de Pagamento
  yPos += 25;
  if (payment.salaryDueDate) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text(`Data para pagamento: ${new Date(payment.salaryDueDate).toLocaleDateString('pt-BR')}`, 15, yPos);
  }
  
  // Rodapé
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Documento gerado automaticamente pelo sistema [SUA EMPRESA]', 105, 280, { align: 'center' });
  doc.text(`Data de geração: ${new Date().toLocaleString('pt-BR')}`, 105, 285, { align: 'center' });
  
  console.log(`[PDF_GENERATION] ${employee.name}: Vencimentos=${formatCurrency(totalVencimentos)}, Descontos=${formatCurrency(totalDescontos)}, Líquido=${formatCurrency(valorLiquido)}`);

  // Converter para Buffer
  const pdfArrayBuffer = doc.output('arraybuffer');
  return Buffer.from(pdfArrayBuffer);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('\n🎨 [GENERATE-PAYSLIPS] Iniciando geração de contracheques visuais...');
    
    const session = await getServerSession(authOptions);
    const userType = (session?.user as any)?.userType;

    if (!session || userType !== 'ADMIN') {
      console.log('❌ [GENERATE-PAYSLIPS] Acesso negado');
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 401 }
      );
    }

    const { id: payrollSheetId } = params;
    console.log(`📋 [GENERATE-PAYSLIPS] Payroll Sheet ID: ${payrollSheetId}`);

    // Buscar a folha de pagamento
    const payrollSheet = await prisma.payrollSheet.findUnique({
      where: { id: payrollSheetId },
      include: {
        payments: {
          include: {
            employee: true
          }
        }
      }
    });

    if (!payrollSheet) {
      console.log('❌ [GENERATE-PAYSLIPS] Folha não encontrada');
      return NextResponse.json(
        { error: 'Folha de pagamento não encontrada' },
        { status: 404 }
      );
    }

    console.log(`✅ [GENERATE-PAYSLIPS] Folha encontrada: ${payrollSheet.month}/${payrollSheet.year}`);
    console.log(`👥 [GENERATE-PAYSLIPS] Pagamentos vinculados: ${payrollSheet.payments.length}`);

    // Buscar TODOS os funcionários ativos
    console.log(`🔍 [GENERATE-PAYSLIPS] Buscando todos os funcionários ativos...`);
    const allEmployees = await prisma.employee.findMany({
      where: {
        isActive: true
      },
      orderBy: {
        name: 'asc'
      }
    });
    console.log(`✅ [GENERATE-PAYSLIPS] Encontrados ${allEmployees.length} funcionários ativos`);

    const results = {
      processed: 0,
      skipped: 0,
      errors: 0,
      details: [] as Array<{
        employeeName: string;
        status: 'success' | 'skipped' | 'error';
        message: string;
        documentId?: string;
      }>
    };

    // Processar cada funcionário ativo
    for (const employee of allEmployees) {
      console.log(`\n👤 [GENERATE-PAYSLIPS] Processando: ${employee.name}`);

      try {
        // Verificar se o funcionário tem pagamento para este mês/ano
        const payment = await prisma.employeePayment.findFirst({
          where: {
            employeeId: employee.id,
            month: payrollSheet.month,
            year: payrollSheet.year
          }
        });

        if (!payment) {
          console.log(`⚠️  [GENERATE-PAYSLIPS] ${employee.name} não tem pagamento lançado para ${payrollSheet.month}/${payrollSheet.year}`);
          results.skipped++;
          results.details.push({
            employeeName: employee.name,
            status: 'skipped',
            message: 'Sem pagamento lançado para este período'
          });
          continue;
        }

        console.log(`💰 [GENERATE-PAYSLIPS] Pagamento encontrado para ${employee.name}`);

        // Verificar se já existe documento
        const existingDocument = await prisma.employeeDocument.findFirst({
          where: {
            employeeId: employee.id,
            documentType: 'CONTRACHEQUE',
            referenceDate: {
              gte: new Date(payrollSheet.year, payrollSheet.month - 1, 1),
              lt: new Date(payrollSheet.year, payrollSheet.month, 1)
            }
          }
        });

        if (existingDocument) {
          console.log(`ℹ️  [GENERATE-PAYSLIPS] ${employee.name} já possui contracheque individual`);
          results.skipped++;
          results.details.push({
            employeeName: employee.name,
            status: 'skipped',
            message: 'Contracheque já existe',
            documentId: existingDocument.id
          });
          continue;
        }

        // GERAR PDF VISUAL
        console.log(`🎨 [GENERATE-PAYSLIPS] Gerando PDF visual para ${employee.name}...`);
        const pdfBuffer = await generatePayslipPDF(employee, payment);

        // Fazer upload para S3
        const fileName = `${Date.now()}-contracheque-${employee.name.replace(/\s+/g, '-')}-${payrollSheet.month}-${payrollSheet.year}.pdf`;
        const s3Key = `payroll-sheets/individual/${payrollSheet.year}/${payrollSheet.month}/${fileName}`;
        
        console.log(`☁️  [GENERATE-PAYSLIPS] Enviando para S3: ${s3Key}`);
        const fullS3Key = await uploadFileWithCustomPath(pdfBuffer, s3Key, 'application/pdf');
        console.log(`☁️  [GENERATE-PAYSLIPS] Key completa retornada: ${fullS3Key}`);

        // Criar documento no banco
        const document = await prisma.employeeDocument.create({
          data: {
            employeeId: employee.id,
            documentType: 'CONTRACHEQUE',
            title: `Contracheque ${payrollSheet.month}/${payrollSheet.year}`,
            fileUrl: fullS3Key,
            fileName: fileName,
            fileSize: pdfBuffer.length,
            referenceDate: new Date(payrollSheet.year, payrollSheet.month - 1, 1),
            uploadedBy: 'Sistema Automático',
            notes: 'Contracheque gerado automaticamente pelo sistema'
          }
        });

        console.log(`✅ [GENERATE-PAYSLIPS] Documento criado: ${document.id}`);
        results.processed++;
        results.details.push({
          employeeName: employee.name,
          status: 'success',
          message: 'Contracheque gerado com sucesso',
          documentId: document.id
        });

      } catch (error: any) {
        console.error(`❌ [GENERATE-PAYSLIPS] Erro ao processar ${employee.name}:`, error);
        results.errors++;
        results.details.push({
          employeeName: employee.name,
          status: 'error',
          message: error.message || 'Erro desconhecido'
        });
      }
    }

    // Marcar folha como processada se teve sucesso
    if (results.processed > 0) {
      await prisma.payrollSheet.update({
        where: { id: payrollSheetId },
        data: { isProcessed: true }
      });
      console.log(`✅ [GENERATE-PAYSLIPS] Folha marcada como processada`);
    }

    console.log(`\n📊 [GENERATE-PAYSLIPS] RESUMO:`);
    console.log(`   ✅ Processados: ${results.processed}`);
    console.log(`   ⏭️  Pulados: ${results.skipped}`);
    console.log(`   ❌ Erros: ${results.errors}`);

    return NextResponse.json({
      success: true,
      message: `Processamento concluído: ${results.processed} contracheques gerados`,
      results
    });

  } catch (error: any) {
    console.error('❌ [GENERATE-PAYSLIPS] Erro fatal:', error);
    return NextResponse.json(
      { error: 'Erro ao processar contracheques', details: error.message },
      { status: 500 }
    );
  }
}
