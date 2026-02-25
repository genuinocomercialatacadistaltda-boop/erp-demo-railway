import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { jsPDF } from 'jspdf';
import { uploadFileWithCustomPath } from '@/lib/s3';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value || 0);
}

// POST: Regenerar PDFs de contracheques de um mês específico
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { month, year } = await request.json();

    if (!month || !year) {
      return NextResponse.json({ error: 'Mês e ano são obrigatórios' }, { status: 400 });
    }

    // Buscar todos os pagamentos do mês
    const payments = await prisma.employeePayment.findMany({
      where: { month, year },
      include: { employee: true }
    });

    console.log(`[REGENERATE] Processando ${payments.length} pagamentos de ${month}/${year}`);

    const results = [];

    for (const payment of payments) {
      try {
        // Gerar novo PDF
        const doc = new jsPDF();
        
        // Cabeçalho
        doc.setFillColor(41, 128, 185);
        doc.rect(0, 0, 210, 35, 'F');
        
        const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                       'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        const mesNome = meses[(payment.month - 1)] || payment.month;
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('ESPETOS GENUÍNO', 15, 18);
        doc.setFontSize(12);
        doc.text('Contracheque', 15, 28);
        doc.text(`${mesNome} de ${payment.year}`, 195, 28, { align: 'right' });
        
        // Dados do funcionário
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        let yPos = 48;
        doc.setFont('helvetica', 'bold');
        doc.text('Dados do Funcionário', 15, yPos);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        yPos += 8;
        doc.text(`Nome: ${payment.employee.name}`, 20, yPos);
        doc.text(`CPF: ${payment.employee.cpf || '000.000.000-00'}`, 120, yPos);
        yPos += 6;
        doc.text(`Matrícula: ${payment.employee.employeeNumber || '-'}`, 20, yPos);
        doc.text(`Cargo: ${payment.employee.position || 'Não informado'}`, 120, yPos);
        
        // VENCIMENTOS
        yPos += 20;
        doc.setFillColor(220, 252, 231);
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
        
        const salarioBase = payment.salaryGrossAmount || payment.salaryAmount || 0;
        if (salarioBase > 0) {
          doc.text('Salário Base', 20, yPos);
          doc.text(formatCurrency(salarioBase), 190, yPos, { align: 'right' });
          totalVencimentos += salarioBase;
          yPos += 6;
        }
        
        // Vencimentos extras do notes
        let earningsItems: any[] = [];
        if (payment.notes) {
          try {
            const notesData = JSON.parse(payment.notes);
            if (notesData.earningsItems && Array.isArray(notesData.earningsItems)) {
              earningsItems = notesData.earningsItems;
            }
          } catch (e) {}
        }
        
        for (const item of earningsItems) {
          if (item.amount && item.amount > 0) {
            doc.text(item.description || 'Vencimento', 20, yPos);
            doc.text(formatCurrency(item.amount), 190, yPos, { align: 'right' });
            totalVencimentos += item.amount;
            yPos += 6;
          }
        }
        
        // Adiantamento Salarial
        const advanceAmount = payment.advanceGrossAmount || payment.advanceAmount || 0;
        if (advanceAmount > 0) {
          doc.text('Adiantamento Salarial', 20, yPos);
          doc.text(formatCurrency(advanceAmount), 190, yPos, { align: 'right' });
          totalVencimentos += advanceAmount;
          yPos += 6;
        }
        
        // Vale Alimentação
        if (payment.foodVoucherGrossAmount && payment.foodVoucherGrossAmount > 0) {
          doc.text('Vale Alimentação', 20, yPos);
          doc.text(formatCurrency(payment.foodVoucherGrossAmount), 190, yPos, { align: 'right' });
          totalVencimentos += payment.foodVoucherGrossAmount;
          yPos += 6;
        }
        
        // Bônus
        if (payment.bonusGrossAmount && payment.bonusGrossAmount > 0) {
          doc.text('Bônus/Premiação', 20, yPos);
          doc.text(formatCurrency(payment.bonusGrossAmount), 190, yPos, { align: 'right' });
          totalVencimentos += payment.bonusGrossAmount;
          yPos += 6;
        }
        
        // Total Vencimentos
        yPos += 3;
        doc.setDrawColor(34, 139, 34);
        doc.line(15, yPos, 195, yPos);
        yPos += 7;
        doc.setFont('helvetica', 'bold');
        doc.text('Total de Vencimentos', 20, yPos);
        doc.setTextColor(34, 139, 34);
        doc.text(formatCurrency(totalVencimentos), 190, yPos, { align: 'right' });
        doc.setTextColor(0, 0, 0);
        
        // DESCONTOS
        yPos += 15;
        doc.setFillColor(254, 226, 226);
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
        
        // Descontos do notes
        let discountItems: any[] = [];
        if (payment.notes) {
          try {
            const notesData = JSON.parse(payment.notes);
            if (notesData.discountItems && Array.isArray(notesData.discountItems)) {
              discountItems = notesData.discountItems;
            }
          } catch (e) {}
        }
        
        for (const item of discountItems) {
          if (item.amount && item.amount > 0) {
            doc.text(item.description || 'Desconto', 20, yPos);
            doc.text(formatCurrency(item.amount), 190, yPos, { align: 'right' });
            totalDescontos += item.amount;
            yPos += 6;
          }
        }
        
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
        
        if (totalDescontos === 0) {
          doc.text('Nenhum desconto aplicado', 20, yPos);
          yPos += 6;
        }
        
        // Total Descontos
        yPos += 3;
        doc.setDrawColor(185, 28, 28);
        doc.line(15, yPos, 195, yPos);
        yPos += 7;
        doc.setFont('helvetica', 'bold');
        doc.text('Total de Descontos', 20, yPos);
        doc.setTextColor(185, 28, 28);
        doc.text(formatCurrency(totalDescontos), 190, yPos, { align: 'right' });
        doc.setTextColor(0, 0, 0);
        
        // VALOR LÍQUIDO
        yPos += 15;
        doc.setFillColor(41, 128, 185);
        doc.rect(15, yPos - 3, 180, 14, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('VALOR LÍQUIDO A RECEBER', 20, yPos + 7);
        doc.text(formatCurrency(payment.totalAmount || (totalVencimentos - totalDescontos)), 190, yPos + 7, { align: 'right' });
        
        // Converter para buffer
        const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
        
        // Criar nome do arquivo
        const employeeName = payment.employee.name.replace(/[^a-zA-Z0-9]/g, '-');
        const fileName = `contracheque-${employeeName}-${month}-${year}.pdf`;
        const cloudPath = `8647/payroll-sheets/individual/${year}/${month}/${Date.now()}-${fileName}`;
        
        // Upload do PDF
        await uploadFileWithCustomPath(pdfBuffer, cloudPath, 'application/pdf');
        
        // Atualizar documento existente ou criar novo
        const existingDoc = await prisma.employeeDocument.findFirst({
          where: {
            employeeId: payment.employeeId,
            documentType: 'CONTRACHEQUE',
            title: `Contracheque ${month}/${year}`
          }
        });
        
        if (existingDoc) {
          await prisma.employeeDocument.update({
            where: { id: existingDoc.id },
            data: { fileUrl: cloudPath }
          });
        }
        
        results.push({
          employeeName: payment.employee.name,
          success: true,
          totalVencimentos,
          totalDescontos,
          valorLiquido: payment.totalAmount
        });
        
        console.log(`   ✅ ${payment.employee.name}: PDF regenerado`);
        
      } catch (error: any) {
        console.error(`   ❌ ${payment.employee.name}: Erro - ${error.message}`);
        results.push({
          employeeName: payment.employee.name,
          success: false,
          error: error.message
        });
      }
    }

    return NextResponse.json({
      message: `${results.filter(r => r.success).length}/${payments.length} PDFs regenerados`,
      results
    });
    
  } catch (error: any) {
    console.error('Erro ao regenerar PDFs:', error);
    return NextResponse.json({ error: 'Erro ao regenerar PDFs', details: error.message }, { status: 500 });
  }
}
