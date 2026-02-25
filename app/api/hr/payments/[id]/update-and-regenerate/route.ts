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

// Gerar PDF com os dados corretos do contracheque
async function generatePayslipPDF(employee: any, payment: any, earningsItems: any[], discountItems: any[]): Promise<Buffer> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  doc.setFont('helvetica');
  
  // Cabeçalho
  doc.setFillColor(34, 139, 34);
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

  doc.setTextColor(0, 0, 0);
  
  // Dados do Funcionário
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
  
  // ===== PROVENTOS (VENCIMENTOS) =====
  yPos += 20;
  doc.setFillColor(220, 252, 231);
  doc.rect(15, yPos - 5, 180, 10, 'F');
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 139, 34);
  doc.text('Proventos (Valores Líquidos)', 20, yPos + 2);
  doc.setTextColor(0, 0, 0);
  
  yPos += 12;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  let totalProventos = 0;
  
  // Salário Base
  const salarioBase = payment.salaryAmount || 0;
  if (salarioBase > 0) {
    doc.text('Salário', 20, yPos);
    doc.text(formatCurrency(salarioBase), 190, yPos, { align: 'right' });
    totalProventos += salarioBase;
    yPos += 6;
  }
  
  // Vencimentos adicionais (Hora Extra, DSR, etc.)
  for (const item of earningsItems) {
    if (item.amount && item.amount > 0) {
      doc.text(item.description || 'Vencimento', 20, yPos);
      doc.text(formatCurrency(item.amount), 190, yPos, { align: 'right' });
      totalProventos += item.amount;
      yPos += 6;
    }
  }
  
  // Linha separadora e Total Proventos
  yPos += 3;
  doc.setDrawColor(34, 139, 34);
  doc.line(15, yPos, 195, yPos);
  
  yPos += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Total de Proventos', 20, yPos);
  doc.setTextColor(34, 139, 34);
  doc.text(formatCurrency(totalProventos), 190, yPos, { align: 'right' });
  doc.setTextColor(0, 0, 0);
  
  // ===== DESCONTOS =====
  yPos += 15;
  doc.setFillColor(254, 226, 226);
  doc.rect(15, yPos - 5, 180, 10, 'F');
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(185, 28, 28);
  doc.text('Descontos Aplicados (já deduzidos dos valores acima)', 20, yPos + 2);
  doc.setTextColor(0, 0, 0);
  
  yPos += 12;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  let totalDescontos = 0;
  
  // Descontos individuais
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
    doc.setTextColor(150, 150, 150);
    doc.text('Nenhum desconto especificado', 20, yPos);
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
  
  // ===== VALOR LÍQUIDO A RECEBER =====
  yPos += 15;
  doc.setFillColor(34, 139, 34);
  doc.rect(15, yPos - 5, 180, 18, 'F');
  
  const valorLiquido = totalProventos;
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Valor Líquido a Receber', 20, yPos + 5);
  
  doc.setFontSize(16);
  doc.text(formatCurrency(valorLiquido), 190, yPos + 5, { align: 'right' });
  
  doc.setTextColor(0, 0, 0);
  
  // Data de Pagamento
  yPos += 25;
  if (payment.salaryDueDate) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text(`Datas de Pagamento:`, 15, yPos);
    doc.text(`• Salário: ${new Date(payment.salaryDueDate).toLocaleDateString('pt-BR')}`, 15, yPos + 5);
  }
  
  // Rodapé
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Documento gerado automaticamente pelo sistema [SUA EMPRESA]', 105, 280, { align: 'center' });
  doc.text(`Data de geração: ${new Date().toLocaleString('pt-BR')}`, 105, 285, { align: 'center' });
  
  console.log(`[PDF_REGENERATION] ${employee.name}: Proventos=${formatCurrency(totalProventos)}, Descontos=${formatCurrency(totalDescontos)}, Líquido=${formatCurrency(valorLiquido)}`);

  const pdfArrayBuffer = doc.output('arraybuffer');
  return Buffer.from(pdfArrayBuffer);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('\n🔄 [UPDATE-REGENERATE] Iniciando atualização e regeneração de contracheque...');
    
    const session = await getServerSession(authOptions);
    const userType = (session?.user as any)?.userType;

    if (!session || userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 401 });
    }

    const { id: paymentId } = params;
    const body = await req.json();
    
    const { 
      salaryAmount,
      earningsItems = [],
      discountItems = []
    } = body;

    console.log(`📋 [UPDATE-REGENERATE] Payment ID: ${paymentId}`);
    console.log(`💰 [UPDATE-REGENERATE] Salário: ${salaryAmount}`);
    console.log(`📈 [UPDATE-REGENERATE] Vencimentos:`, earningsItems);
    console.log(`📉 [UPDATE-REGENERATE] Descontos:`, discountItems);

    // Buscar o pagamento existente
    const payment = await prisma.employeePayment.findUnique({
      where: { id: paymentId },
      include: {
        employee: true,
        payrollSheet: true
      }
    });

    if (!payment) {
      return NextResponse.json({ error: 'Pagamento não encontrado' }, { status: 404 });
    }

    // Calcular totais
    const totalEarnings = earningsItems.reduce((sum: number, e: any) => sum + (parseFloat(e.amount) || 0), 0);
    const totalDiscounts = discountItems.reduce((sum: number, d: any) => sum + (parseFloat(d.amount) || 0), 0);
    const salarioNum = parseFloat(salaryAmount) || 0;
    // Fórmula correta: Salário + Vencimentos Adicionais - Descontos = Líquido
    const totalAmount = salarioNum + totalEarnings - totalDiscounts;
    
    console.log(`[UPDATE-REGENERATE] Cálculo: Salário(${salarioNum}) + Earnings(${totalEarnings}) - Descontos(${totalDiscounts}) = Líquido(${totalAmount})`);

    // Atualizar dados no notes como JSON
    const notesData = {
      discountItems: discountItems,
      earningsItems: earningsItems,
      originalNotes: payment.notes || '',
      updatedAt: new Date().toISOString()
    };

    // Atualizar o pagamento
    const updatedPayment = await prisma.employeePayment.update({
      where: { id: paymentId },
      data: {
        salaryAmount: salarioNum,
        salaryGrossAmount: salarioNum + totalEarnings + totalDiscounts,
        totalAmount: totalAmount,
        totalGrossAmount: salarioNum + totalEarnings + totalDiscounts,
        totalDiscounts: totalDiscounts,
        otherDiscounts: totalDiscounts,
        notes: JSON.stringify(notesData)
      },
      include: {
        employee: true,
        payrollSheet: true
      }
    });

    console.log(`✅ [UPDATE-REGENERATE] Pagamento atualizado!`);

    // Gerar novo PDF
    const pdfBuffer = await generatePayslipPDF(
      updatedPayment.employee,
      updatedPayment,
      earningsItems,
      discountItems
    );

    // Upload do PDF para S3
    const month = updatedPayment.month;
    const year = updatedPayment.year;
    const employeeName = updatedPayment.employee.name.replace(/\s+/g, '-');
    const fileName = `${Date.now()}-contracheque-${employeeName}-${month}-${year}.pdf`;
    const s3Path = `payroll-sheets/individual/${year}/${month}/${fileName}`;

    console.log(`📤 [UPDATE-REGENERATE] Fazendo upload do PDF para: ${s3Path}`);

    const fileUrl = await uploadFileWithCustomPath(
      pdfBuffer,
      s3Path,
      'application/pdf'
    );

    console.log(`✅ [UPDATE-REGENERATE] PDF enviado: ${fileUrl}`);

    // Atualizar signedPayslipUrl no pagamento
    await prisma.employeePayment.update({
      where: { id: paymentId },
      data: { signedPayslipUrl: fileUrl }
    });

    // Atualizar a despesa vinculada (Expense) se existir
    if (updatedPayment.salaryExpenseId) {
      await prisma.expense.update({
        where: { id: updatedPayment.salaryExpenseId },
        data: { amount: totalAmount }
      });
      console.log(`✅ [UPDATE-REGENERATE] Despesa atualizada (ID: ${updatedPayment.salaryExpenseId}) com valor: R$ ${totalAmount.toFixed(2)}`);
    }

    // Atualizar documento EmployeeDocument se existir
    const existingDoc = await prisma.employeeDocument.findFirst({
      where: {
        employeeId: updatedPayment.employeeId,
        documentType: 'CONTRACHEQUE',
        title: { contains: `${month}/${year}` }
      }
    });

    if (existingDoc) {
      await prisma.employeeDocument.update({
        where: { id: existingDoc.id },
        data: { fileUrl: fileUrl }
      });
      console.log(`✅ [UPDATE-REGENERATE] Documento atualizado: ${existingDoc.id}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Pagamento atualizado e PDF regenerado com sucesso!',
      payment: {
        id: updatedPayment.id,
        salaryAmount: updatedPayment.salaryAmount,
        totalAmount: updatedPayment.totalAmount,
        totalDiscounts: updatedPayment.totalDiscounts,
        signedPayslipUrl: fileUrl
      }
    });

  } catch (error: any) {
    console.error('[UPDATE-REGENERATE] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar e regenerar contracheque', details: error.message },
      { status: 500 }
    );
  }
}
