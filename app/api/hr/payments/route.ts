export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import jsPDF from 'jspdf';
import { uploadFileWithCustomPath } from '@/lib/s3';

// Função auxiliar para formatar moeda
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

// Função para gerar PDF visual do contracheque
async function generatePayslipPDF(employee: any, payment: any): Promise<Buffer> {
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
  
  if (payment.foodVoucherGrossAmount && payment.foodVoucherGrossAmount > 0) {
    doc.text('Vale Alimentação', 20, yPos);
    doc.text(formatCurrency(payment.foodVoucherGrossAmount), 190, yPos, { align: 'right' });
    totalVencimentos += payment.foodVoucherGrossAmount;
    yPos += 6;
  }
  
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
  
  if (totalDescontos === 0) {
    doc.setTextColor(150, 150, 150);
    doc.text('Nenhum desconto aplicado', 20, yPos);
    doc.setTextColor(0, 0, 0);
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
  doc.setFillColor(34, 139, 34);
  doc.rect(15, yPos - 5, 180, 18, 'F');
  
  const valorLiquido = totalVencimentos - totalDescontos;
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('VALOR LÍQUIDO A RECEBER', 20, yPos + 5);
  
  doc.setFontSize(16);
  doc.text(formatCurrency(valorLiquido), 190, yPos + 5, { align: 'right' });
  
  doc.setTextColor(0, 0, 0);
  
  // Data de Pagamento
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

  const pdfArrayBuffer = doc.output('arraybuffer');
  return Buffer.from(pdfArrayBuffer);
}

/**
 * API para gerenciar pagamentos de funcionários
 */

export async function GET(req: NextRequest) {
  try {
    console.log("[PAYMENTS_GET] Iniciando busca de pagamentos");
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).userType !== "ADMIN") {
      console.log("[PAYMENTS_GET] Acesso negado - usuário não é admin");
      return NextResponse.json(
        { error: "Acesso negado" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId");
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const isPaid = searchParams.get("isPaid");

    console.log("[PAYMENTS_GET] Filtros:", {
      employeeId,
      month,
      year,
      isPaid,
    });

    const where: any = {};
    
    if (employeeId) where.employeeId = employeeId;
    if (month) where.month = parseInt(month);
    if (year) where.year = parseInt(year);
    if (isPaid !== null && isPaid !== undefined) where.isPaid = isPaid === "true";

    const payments = await prisma.employeePayment.findMany({
      where,
      include: {
        employee: true,
        payrollSheet: true,
      },
      orderBy: [
        { year: "desc" },
        { month: "desc" },
        { employee: { name: "asc" } },
      ],
    });

    console.log("[PAYMENTS_GET] Pagamentos encontrados:", payments.length);

    return NextResponse.json(payments);
  } catch (error: any) {
    console.error("[PAYMENTS_GET] Error completo:", {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
    });
    return NextResponse.json(
      { error: `Erro ao buscar pagamentos: ${error?.message || "Erro desconhecido"}` },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    console.log("[PAYMENTS_POST] Iniciando criação de pagamentos");
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).userType !== "ADMIN") {
      console.log("[PAYMENTS_POST] Acesso negado - usuário não é admin");
      return NextResponse.json(
        { error: "Acesso negado" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      payrollSheetId,
      payments: paymentsData,
      generateExpenses = true,
    } = body;

    console.log("[PAYMENTS_POST] Lançando pagamentos:", {
      payrollSheetId,
      count: paymentsData?.length,
      generateExpenses,
      firstPayment: paymentsData?.[0],
    });

    if (!Array.isArray(paymentsData) || paymentsData.length === 0) {
      console.log("[PAYMENTS_POST] Lista de pagamentos inválida");
      return NextResponse.json(
        { error: "Lista de pagamentos inválida" },
        { status: 400 }
      );
    }

    // Buscar funcionários para validação
    const employeeIds = paymentsData.map((p: any) => p.employeeId);
    const employees = await prisma.employee.findMany({
      where: { id: { in: employeeIds } },
    });

    if (employees.length !== employeeIds.length) {
      return NextResponse.json(
        { error: "Alguns funcionários não foram encontrados" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const createdPayments = [];
      const createdExpenses = [];

      for (const paymentData of paymentsData) {
        const {
          employeeId,
          month,
          year,
          // Valores brutos
          salaryGrossAmount = 0,
          advanceGrossAmount = 0,
          foodVoucherGrossAmount = 0,
          bonusGrossAmount = 0,
          // Descontos
          inssDiscount = 0,
          irpfDiscount = 0,
          otherDiscounts = 0,
          notes,
        } = paymentData;

        // Calcular total de descontos
        const totalDiscounts = inssDiscount + irpfDiscount + otherDiscounts;
        
        // Calcular total de vencimentos adicionais (earningsItems) a partir do notes
        let totalEarningsAdicionais = 0;
        try {
          if (notes) {
            const notesObj = typeof notes === 'string' ? JSON.parse(notes) : notes;
            if (notesObj.earningsItems && Array.isArray(notesObj.earningsItems)) {
              totalEarningsAdicionais = notesObj.earningsItems.reduce(
                (sum: number, item: { amount?: number }) => sum + (item.amount || 0), 
                0
              );
            }
          }
        } catch (e) {
          console.log('[PAYMENTS_POST] Erro ao extrair earningsItems do notes:', e);
        }
        
        // Calcular total bruto (inclui vencimentos adicionais como Salário Família, etc)
        const totalGrossAmount = salaryGrossAmount + advanceGrossAmount + foodVoucherGrossAmount + bonusGrossAmount + totalEarningsAdicionais;
        
        // Calcular valores líquidos (proporcionalmente aos brutos, excluindo earningsItems que vão direto)
        const grossAmountSemEarnings = salaryGrossAmount + advanceGrossAmount + foodVoucherGrossAmount + bonusGrossAmount;
        const discountRate = grossAmountSemEarnings > 0 ? totalDiscounts / grossAmountSemEarnings : 0;
        
        const salaryAmount = Math.round((salaryGrossAmount * (1 - discountRate)) * 100) / 100;
        const advanceAmount = Math.round((advanceGrossAmount * (1 - discountRate)) * 100) / 100;
        const foodVoucherAmount = Math.round((foodVoucherGrossAmount * (1 - discountRate)) * 100) / 100;
        const bonusAmount = Math.round((bonusGrossAmount * (1 - discountRate)) * 100) / 100;
        
        // Total líquido = bruto base - descontos + vencimentos adicionais
        // Fórmula: Salário Bruto + Vencimentos Adicionais - Descontos = Líquido
        const totalAmount = grossAmountSemEarnings - totalDiscounts + totalEarningsAdicionais;

        console.log(`[PAYMENTS_POST] Calculando valores para funcionário ${employeeId}:`, {
          grossAmountSemEarnings,
          totalEarningsAdicionais,
          totalGrossAmount,
          totalDiscounts,
          totalAmount,
          discountRate: `${(discountRate * 100).toFixed(2)}%`,
          valores: {
            salario: { bruto: salaryGrossAmount, liquido: salaryAmount },
            antecipacao: { bruto: advanceGrossAmount, liquido: advanceAmount },
            vale: { bruto: foodVoucherGrossAmount, liquido: foodVoucherAmount },
            bonus: { bruto: bonusGrossAmount, liquido: bonusAmount },
            earningsAdicionais: totalEarningsAdicionais,
          }
        });

        // Calcular datas de vencimento
        const salaryDueDate = salaryAmount > 0 ? new Date(year, month - 1, 5) : null;
        const foodVoucherDueDate = foodVoucherAmount > 0 ? new Date(year, month - 1, 15) : null;
        const advanceDueDate = advanceAmount > 0 ? new Date(year, month - 1, 20) : null;
        const bonusDueDate = bonusAmount > 0 ? new Date(year, month - 1, 10) : null;

        // Criar pagamento
        const payment = await tx.employeePayment.create({
          data: {
            employeeId,
            payrollSheetId: payrollSheetId || undefined,
            month,
            year,
            // Valores brutos
            salaryGrossAmount,
            advanceGrossAmount,
            foodVoucherGrossAmount,
            bonusGrossAmount,
            totalGrossAmount,
            // Valores líquidos
            salaryAmount,
            advanceAmount,
            foodVoucherAmount,
            bonusAmount,
            totalAmount,
            // Descontos
            inssDiscount,
            irpfDiscount,
            otherDiscounts,
            totalDiscounts,
            // Datas
            salaryDueDate,
            foodVoucherDueDate,
            advanceDueDate,
            bonusDueDate,
            notes,
          },
        });

        createdPayments.push(payment);

        // Gerar contas a pagar se solicitado
        if (generateExpenses) {
          const employee = employees.find((e) => e.id === employeeId);
          const employeeName = employee?.name || "Funcionário";

          // Categoria de despesa "Salario/Funcionarios/Beneficios"
          let category = await tx.expenseCategory.findFirst({
            where: { name: "Salario/Funcionarios/Beneficios" },
          });

          if (!category) {
            // Tentar encontrar categoria similar
            category = await tx.expenseCategory.findFirst({
              where: { 
                OR: [
                  { name: { contains: 'Salario', mode: 'insensitive' } },
                  { name: { contains: 'Funcionário', mode: 'insensitive' } }
                ]
              },
            });
          }

          if (!category) {
            category = await tx.expenseCategory.create({
              data: {
                name: "Salario/Funcionarios/Beneficios",
                expenseType: "OPERATIONAL",
                isActive: true,
              },
            });
          }

          // Criar despesa de salário (usa totalAmount que é o valor líquido real)
          // O totalAmount já inclui: Salário Bruto + Vencimentos Adicionais - Descontos
          // A competência é a DATA DE VENCIMENTO para aparecer corretamente no card diário
          if (totalAmount > 0) {
            const expenseDueDate = salaryDueDate || new Date(year, month - 1, 20);
            const expense = await tx.expense.create({
              data: {
                description: `Salário - ${employeeName} (${month}/${year})`,
                amount: totalAmount, // Valor líquido correto (inclui earningsItems e descontos)
                dueDate: expenseDueDate,
                competenceDate: expenseDueDate, // Competência = data de vencimento
                categoryId: category.id,
                expenseType: "OPERATIONAL",
                status: "PENDING",
                notes: `Ref: Pagamento ${payment.id}`,
              },
            });
            createdExpenses.push(expense);

            // Vincular despesa ao pagamento
            await tx.employeePayment.update({
              where: { id: payment.id },
              data: { salaryExpenseId: expense.id },
            });
          }

          // Criar despesa de vale alimentação
          if (foodVoucherAmount > 0) {
            const expense = await tx.expense.create({
              data: {
                description: `Vale Alimentação - ${employeeName} (${month}/${year})`,
                amount: foodVoucherAmount,
                dueDate: foodVoucherDueDate!,
                competenceDate: foodVoucherDueDate!, // Competência = data de vencimento
                categoryId: category.id,
                expenseType: "OPERATIONAL",
                status: "PENDING",
                notes: `Ref: Pagamento ${payment.id}`,
              },
            });
            createdExpenses.push(expense);

            await tx.employeePayment.update({
              where: { id: payment.id },
              data: { foodVoucherExpenseId: expense.id },
            });
          }

          // Criar despesa de antecipação / décimo terceiro
          if (advanceAmount > 0) {
            // Detectar tipo pelo notes ou pelo contexto
            const isDecimoTerceiro = notes && (
              notes.toLowerCase().includes('décimo') ||
              notes.toLowerCase().includes('13º') ||
              notes.toLowerCase().includes('gratificação')
            );
            
            const description = isDecimoTerceiro 
              ? `Décimo Terceiro - ${employeeName} (${month}/${year})`
              : `Adiantamento Salarial - ${employeeName} (${month}/${year})`;
            
            const expense = await tx.expense.create({
              data: {
                description,
                amount: advanceAmount,
                dueDate: advanceDueDate!,
                competenceDate: advanceDueDate!, // Competência = data de vencimento
                categoryId: category.id,
                expenseType: "OPERATIONAL",
                status: "PENDING",
                notes: `Ref: Pagamento ${payment.id}`,
              },
            });
            createdExpenses.push(expense);

            await tx.employeePayment.update({
              where: { id: payment.id },
              data: { advanceExpenseId: expense.id },
            });
          }

          // Criar despesa de premiação
          if (bonusAmount > 0) {
            const expense = await tx.expense.create({
              data: {
                description: `Premiação - ${employeeName} (${month}/${year})`,
                amount: bonusAmount,
                dueDate: bonusDueDate!,
                competenceDate: bonusDueDate!, // Competência = data de vencimento
                categoryId: category.id,
                expenseType: "OPERATIONAL",
                status: "PENDING",
                notes: `Ref: Pagamento ${payment.id}`,
              },
            });
            createdExpenses.push(expense);

            await tx.employeePayment.update({
              where: { id: payment.id },
              data: { bonusExpenseId: expense.id },
            });
          }
        }
      }

      // Marcar folha como processada
      if (payrollSheetId) {
        await tx.payrollSheet.update({
          where: { id: payrollSheetId },
          data: {
            isProcessed: true,
            processedAt: new Date(),
          },
        });
      }

      return {
        payments: createdPayments,
        expenses: createdExpenses,
      };
    });

    console.log("[PAYMENTS_POST] Sucesso:", {
      payments: result.payments.length,
      expenses: result.expenses.length,
    });

    // 🆕 GERAR CONTRACHEQUES PARA LANÇAMENTOS MANUAIS (sem payrollSheetId)
    const generatedDocuments = [];
    if (!payrollSheetId && result.payments.length > 0) {
      console.log("[PAYMENTS_POST] 📄 Gerando contracheques para lançamento manual...");
      
      for (const payment of result.payments) {
        try {
          // Buscar dados do funcionário
          const employee = await prisma.employee.findUnique({
            where: { id: payment.employeeId }
          });
          
          if (!employee) {
            console.log(`[PAYMENTS_POST] ⚠️ Funcionário não encontrado: ${payment.employeeId}`);
            continue;
          }

          // Verificar se já existe contracheque para este período
          const existingDoc = await prisma.employeeDocument.findFirst({
            where: {
              employeeId: employee.id,
              documentType: 'CONTRACHEQUE',
              referenceDate: {
                gte: new Date(payment.year, payment.month - 1, 1),
                lt: new Date(payment.year, payment.month, 1)
              }
            }
          });

          if (existingDoc) {
            console.log(`[PAYMENTS_POST] ℹ️ Contracheque já existe para ${employee.name} em ${payment.month}/${payment.year}`);
            continue;
          }

          // Gerar PDF do contracheque
          console.log(`[PAYMENTS_POST] 🎨 Gerando PDF para ${employee.name}...`);
          const pdfBuffer = await generatePayslipPDF(employee, payment);

          // Upload para S3
          const fileName = `${Date.now()}-contracheque-${employee.name.replace(/\s+/g, '-')}-${payment.month}-${payment.year}.pdf`;
          const s3Key = `payroll-sheets/manual/${payment.year}/${payment.month}/${fileName}`;
          
          console.log(`[PAYMENTS_POST] ☁️ Enviando para S3: ${s3Key}`);
          const fullS3Key = await uploadFileWithCustomPath(pdfBuffer, s3Key, 'application/pdf');

          // Criar documento no banco
          const document = await prisma.employeeDocument.create({
            data: {
              employeeId: employee.id,
              documentType: 'CONTRACHEQUE',
              title: `Contracheque ${payment.month}/${payment.year}`,
              fileUrl: fullS3Key,
              fileName: fileName,
              fileSize: pdfBuffer.length,
              referenceDate: new Date(payment.year, payment.month - 1, 1),
              uploadedBy: 'Lançamento Manual',
              notes: 'Contracheque gerado via lançamento manual'
            }
          });

          generatedDocuments.push({
            employeeName: employee.name,
            documentId: document.id
          });
          
          console.log(`[PAYMENTS_POST] ✅ Contracheque gerado para ${employee.name}: ${document.id}`);
        } catch (docError: any) {
          console.error(`[PAYMENTS_POST] ❌ Erro ao gerar contracheque:`, docError);
        }
      }
      
      console.log(`[PAYMENTS_POST] 📊 Total de contracheques gerados: ${generatedDocuments.length}`);
    }

    return NextResponse.json({
      ...result,
      documents: generatedDocuments
    });
  } catch (error) {
    console.error("[PAYMENTS_POST] Error:", error);
    return NextResponse.json(
      { error: "Erro ao criar pagamentos" },
      { status: 500 }
    );
  }
}
