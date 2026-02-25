import { PrismaClient } from '@prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { jsPDF } from 'jspdf';

const prisma = new PrismaClient();

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value || 0);
}

async function main() {
  const s3Client = new S3Client({});
  const bucketName = process.env.AWS_BUCKET_NAME || '';
  const folderPrefix = process.env.AWS_FOLDER_PREFIX || '';

  // Get all payments for month 2/2026
  const payments = await prisma.employeePayment.findMany({
    where: { month: 2, year: 2026 },
    include: { employee: true }
  });

  console.log(`Found ${payments.length} payments to regenerate\n`);

  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  for (const payment of payments) {
    try {
      console.log(`Regenerating PDF for ${payment.employee.name}...`);
      
      // Create PDF
      const doc = new jsPDF();
      
      // Header
      doc.setFillColor(41, 128, 185);
      doc.rect(0, 0, 210, 35, 'F');
      
      const mesNome = meses[payment.month - 1];
      const isAdvance = payment.salaryGrossAmount === 0 && payment.advanceGrossAmount > 0;
      const tipoDoc = isAdvance ? 'Adiantamento Salarial' : 'Contracheque';
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('ESPETOS GENUÍNO', 105, 15, { align: 'center' });
      
      doc.setFontSize(14);
      doc.text(`${tipoDoc} - ${mesNome}/${payment.year}`, 105, 28, { align: 'center' });
      
      // Employee info
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('DADOS DO FUNCIONÁRIO', 15, 50);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Nome: ${payment.employee.name}`, 15, 60);
      doc.text(`CPF: ${payment.employee.cpf || 'Não informado'}`, 15, 68);
      doc.text(`Cargo: ${payment.employee.position || 'Não informado'}`, 15, 76);
      doc.text(`Período: ${mesNome}/${payment.year}`, 15, 84);
      
      // Earnings section
      let yPos = 100;
      doc.setFillColor(46, 204, 113);
      doc.rect(15, yPos - 6, 180, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text('VENCIMENTOS', 105, yPos, { align: 'center' });
      
      yPos += 15;
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      
      let totalEarnings = 0;
      
      if (isAdvance) {
        doc.text('Adiantamento Salarial', 15, yPos);
        doc.text(formatCurrency(payment.advanceGrossAmount), 180, yPos, { align: 'right' });
        totalEarnings += payment.advanceGrossAmount;
        yPos += 8;
      } else {
        if (payment.salaryGrossAmount > 0) {
          doc.text('Salário', 15, yPos);
          doc.text(formatCurrency(payment.salaryGrossAmount), 180, yPos, { align: 'right' });
          totalEarnings += payment.salaryGrossAmount;
          yPos += 8;
        }
      }
      
      if (payment.foodVoucherGrossAmount > 0) {
        doc.text('Vale Alimentação', 15, yPos);
        doc.text(formatCurrency(payment.foodVoucherGrossAmount), 180, yPos, { align: 'right' });
        totalEarnings += payment.foodVoucherGrossAmount;
        yPos += 8;
      }
      
      if (payment.bonusGrossAmount > 0) {
        doc.text('Bônus', 15, yPos);
        doc.text(formatCurrency(payment.bonusGrossAmount), 180, yPos, { align: 'right' });
        totalEarnings += payment.bonusGrossAmount;
        yPos += 8;
      }
      
      doc.setFont('helvetica', 'bold');
      doc.text('Total Vencimentos:', 15, yPos + 5);
      doc.text(formatCurrency(totalEarnings), 180, yPos + 5, { align: 'right' });
      
      // Discounts section
      yPos += 25;
      doc.setFillColor(231, 76, 60);
      doc.rect(15, yPos - 6, 180, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text('DESCONTOS', 105, yPos, { align: 'center' });
      
      yPos += 15;
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      
      let totalDiscounts = 0;
      
      if (payment.inssDiscount > 0) {
        doc.text('INSS', 15, yPos);
        doc.text(formatCurrency(payment.inssDiscount), 180, yPos, { align: 'right' });
        totalDiscounts += payment.inssDiscount;
        yPos += 8;
      }
      
      if (payment.irpfDiscount > 0) {
        doc.text('IRPF', 15, yPos);
        doc.text(formatCurrency(payment.irpfDiscount), 180, yPos, { align: 'right' });
        totalDiscounts += payment.irpfDiscount;
        yPos += 8;
      }
      
      if (payment.otherDiscounts > 0) {
        doc.text('Outros Descontos', 15, yPos);
        doc.text(formatCurrency(payment.otherDiscounts), 180, yPos, { align: 'right' });
        totalDiscounts += payment.otherDiscounts;
        yPos += 8;
      }
      
      if (totalDiscounts === 0) {
        doc.text('Sem descontos', 15, yPos);
        doc.text(formatCurrency(0), 180, yPos, { align: 'right' });
        yPos += 8;
      }
      
      doc.setFont('helvetica', 'bold');
      doc.text('Total Descontos:', 15, yPos + 5);
      doc.text(formatCurrency(totalDiscounts), 180, yPos + 5, { align: 'right' });
      
      // Net amount
      yPos += 25;
      doc.setFillColor(52, 73, 94);
      doc.rect(15, yPos - 6, 180, 15, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      const netAmount = totalEarnings - totalDiscounts;
      doc.text(`VALOR LÍQUIDO: ${formatCurrency(netAmount)}`, 105, yPos + 2, { align: 'center' });
      
      // Footer
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(8);
      doc.text(`Documento gerado em ${new Date().toLocaleDateString('pt-BR')}`, 105, 285, { align: 'center' });
      
      // Get PDF buffer
      const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
      
      // Upload to S3
      const safeName = payment.employee.name.replace(/\s+/g, '-').replace(/[^\w-]/g, '');
      const fileName = `${isAdvance ? 'adiantamento-salarial' : 'contracheque'}-${safeName}-${payment.month}-${payment.year}.pdf`;
      const s3Key = `${folderPrefix}payroll-sheets/individual/${payment.year}/${payment.month}/${Date.now()}-${fileName}`;
      
      await s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        Body: pdfBuffer,
        ContentType: 'application/pdf'
      }));
      
      // Update EmployeeDocument with new URL
      const nextMonthDate = payment.month === 12 
        ? new Date(`${payment.year + 1}-01-01`)
        : new Date(`${payment.year}-${String(payment.month + 1).padStart(2, '0')}-01`);
        
      await prisma.employeeDocument.updateMany({
        where: {
          employeeId: payment.employeeId,
          documentType: 'CONTRACHEQUE',
          referenceDate: {
            gte: new Date(`${payment.year}-${String(payment.month).padStart(2, '0')}-01`),
            lt: nextMonthDate
          }
        },
        data: {
          fileUrl: s3Key,
          title: `${tipoDoc} ${payment.month}/${payment.year}`
        }
      });
      
      console.log(`  ✓ PDF saved: ${s3Key}`);
    } catch (err: any) {
      console.log(`  ✗ ERROR: ${err.message}`);
    }
  }
  
  console.log('\n✅ Done!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
