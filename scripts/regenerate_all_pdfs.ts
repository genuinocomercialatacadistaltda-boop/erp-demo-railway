import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import jsPDF from 'jspdf';
import { uploadFileWithCustomPath } from '../lib/s3';

dotenv.config();

const prisma = new PrismaClient();

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

async function generatePayslipPDF(employee: any, payment: any): Promise<Buffer> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  doc.setFont('helvetica');
  
  // Cabeçalho verde
  doc.setFillColor(34, 139, 34);
  doc.rect(0, 0, 210, 35, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('INDUSTRIA DE ESPETOS GENUINO LTDA', 105, 12, { align: 'center' });
  
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
  
  // Valor Líquido a Receber
  yPos += 25;
  doc.setFillColor(34, 139, 34);
  doc.rect(15, yPos - 5, 180, 25, 'F');
  
  const valorLiquido = payment.salaryAmount || 0;
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Valor Líquido a Receber', 20, yPos + 5);
  
  doc.setFontSize(20);
  doc.text(formatCurrency(valorLiquido), 190, yPos + 8, { align: 'right' });
  
  doc.setTextColor(0, 0, 0);
  
  // Nota informativa
  yPos += 35;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 100, 100);
  doc.text('Valor correspondente ao pagamento líquido do período de referência.', 105, yPos, { align: 'center' });
  doc.text('Para detalhes de vencimentos e descontos, consulte a folha de pagamento completa.', 105, yPos + 5, { align: 'center' });
  
  // Data de Pagamento
  yPos += 20;
  if (payment.salaryDueDate) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(`Data de Pagamento: ${new Date(payment.salaryDueDate).toLocaleDateString('pt-BR')}`, 105, yPos, { align: 'center' });
  }
  
  // Rodapé
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Documento gerado automaticamente pelo sistema Espetos Genuíno', 105, 280, { align: 'center' });
  doc.text(`Data de geração: ${new Date().toLocaleString('pt-BR')}`, 105, 285, { align: 'center' });

  const pdfArrayBuffer = doc.output('arraybuffer');
  return Buffer.from(pdfArrayBuffer);
}

async function main() {
  console.log('🔄 Iniciando regeneração de todos os contracheques...\n');
  
  const payments = await prisma.employeePayment.findMany({
    include: {
      employee: true
    },
    orderBy: { createdAt: 'desc' }
  });
  
  console.log(`📋 Total de pagamentos encontrados: ${payments.length}\n`);
  
  let success = 0;
  let errors = 0;
  
  for (const payment of payments) {
    try {
      console.log(`\n📄 Processando: ${payment.employee.name}`);
      console.log(`   Valor: ${formatCurrency(payment.salaryAmount)}`);
      
      // Gerar PDF
      const pdfBuffer = await generatePayslipPDF(payment.employee, payment);
      
      // Upload para S3
      const month = payment.month;
      const year = payment.year;
      const employeeName = payment.employee.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
      const fileName = `${Date.now()}-contracheque-${employeeName}-${month}-${year}.pdf`;
      const s3Path = `payroll-sheets/individual/${year}/${month}/${fileName}`;
      
      console.log(`   📤 Upload: ${s3Path}`);
      
      const fileUrl = await uploadFileWithCustomPath(pdfBuffer, s3Path, 'application/pdf');
      
      // Atualizar EmployeePayment
      await prisma.employeePayment.update({
        where: { id: payment.id },
        data: { signedPayslipUrl: fileUrl }
      });
      
      // Atualizar EmployeeDocument
      const doc = await prisma.employeeDocument.findFirst({
        where: {
          employeeId: payment.employeeId,
          documentType: 'CONTRACHEQUE',
          title: { contains: `${month}/${year}` }
        }
      });
      
      if (doc) {
        await prisma.employeeDocument.update({
          where: { id: doc.id },
          data: { fileUrl: fileUrl }
        });
        console.log(`   ✅ Documento atualizado: ${doc.id}`);
      } else {
        console.log(`   ⚠️ Documento não encontrado`);
      }
      
      success++;
      
    } catch (error: any) {
      console.error(`   ❌ Erro: ${error.message}`);
      errors++;
    }
  }
  
  console.log(`\n\n========== RESUMO ==========`);
  console.log(`✅ Sucesso: ${success}`);
  console.log(`❌ Erros: ${errors}`);
  console.log(`📊 Total: ${payments.length}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
