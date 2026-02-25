
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { uploadFile } from "@/lib/s3";

// GET - Listar despesas do cartão
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const creditCardId = searchParams.get("creditCardId");
    const invoiceId = searchParams.get("invoiceId");
    const pending = searchParams.get("pending") === "true";

    const where: any = {};
    if (creditCardId) where.creditCardId = creditCardId;
    if (invoiceId) where.invoiceId = invoiceId;
    if (pending) where.invoiceId = null;

    const expenses = await prisma.creditCardExpense.findMany({
      where,
      include: {
        CreditCard: {
          select: {
            name: true
          }
        },
        Category: true,
        Invoice: {
          select: {
            referenceMonth: true,
            status: true
          }
        }
      },
      orderBy: { purchaseDate: "desc" }
    });

    return NextResponse.json({ expenses });
  } catch (error) {
    console.error("Erro ao buscar despesas:", error);
    return NextResponse.json(
      { error: "Erro ao buscar despesas" },
      { status: 500 }
    );
  }
}

// POST - Lançar despesa no cartão
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    
    const creditCardId = formData.get("creditCardId") as string;
    const description = formData.get("description") as string;
    const amount = parseFloat(formData.get("amount") as string);
    const purchaseDate = formData.get("purchaseDate") as string;
    const categoryId = formData.get("categoryId") as string || null;
    const supplierName = formData.get("supplierName") as string || null;
    const referenceNumber = formData.get("referenceNumber") as string || null;
    const installments = formData.get("installments") ? parseInt(formData.get("installments") as string) : 1;
    const notes = formData.get("notes") as string || null;
    const file = formData.get("file") as File | null;

    // Validações
    if (!creditCardId || !description || !amount || !purchaseDate) {
      return NextResponse.json(
        { error: "Dados incompletos" },
        { status: 400 }
      );
    }

    // Upload do arquivo se fornecido
    let attachmentUrl = null;
    let attachmentName = null;

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const fileName = `credit-card-expenses/${Date.now()}-${file.name}`;
      attachmentUrl = await uploadFile(buffer, fileName);
      attachmentName = file.name;
    }

    // Buscar cartão e fatura aberta do mês
    const card = await prisma.creditCard.findUnique({
      where: { id: creditCardId }
    });

    if (!card) {
      return NextResponse.json(
        { error: "Cartão não encontrado" },
        { status: 404 }
      );
    }

    // 🔧 Corrigir timezone: criar data no meio-dia local para evitar problemas
    // Formato esperado: "YYYY-MM-DD"
    const [yearStr, monthStr, dayStr] = purchaseDate.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr) - 1; // JavaScript usa 0-11 para meses
    const purchaseDay = parseInt(dayStr);
    
    // Criar Date object no meio-dia para evitar mudanças de dia por timezone
    const purchaseDateObj = new Date(year, month, purchaseDay, 12, 0, 0);
    
    // Determinar mês de referência da fatura baseado no dia de fechamento
    let invoiceMonth = month;
    let invoiceYear = year;
    
    // Se a compra foi DEPOIS do dia de fechamento, vai para a fatura do mês seguinte
    if (purchaseDay > card.closingDay) {
      invoiceMonth = month + 1;
      if (invoiceMonth > 11) {
        invoiceMonth = 0;
        invoiceYear = year + 1;
      }
    }
    
    const referenceMonth = new Date(invoiceYear, invoiceMonth, 1);

    // Buscar ou criar fatura aberta para o mês
    let invoice = await prisma.creditCardInvoice.findFirst({
      where: {
        creditCardId,
        referenceMonth,
        status: "OPEN"
      }
    });

    if (!invoice) {
      // Criar fatura aberta
      const closingDate = new Date(invoiceYear, invoiceMonth, card.closingDay);
      
      // Data de vencimento: dia do vencimento no mês seguinte ao fechamento
      let dueYear = invoiceYear;
      let dueMonth = invoiceMonth + 1;
      if (dueMonth > 11) {
        dueMonth = 0;
        dueYear = invoiceYear + 1;
      }
      
      const dueDate = new Date(dueYear, dueMonth, card.dueDay);

      console.log(`📅 Criando fatura: Fecha ${closingDate.toLocaleDateString('pt-BR')}, Vence ${dueDate.toLocaleDateString('pt-BR')}`);

      invoice = await prisma.creditCardInvoice.create({
        data: {
          creditCardId,
          referenceMonth,
          closingDate,
          dueDate,
          totalAmount: 0,
          status: "OPEN"
        }
      });
    }

    // Buscar a categoria para pegar o expenseType
    let expenseType = "OTHER" as any; // Valor padrão
    if (categoryId) {
      const category = await prisma.expenseCategory.findUnique({
        where: { id: categoryId },
        select: { expenseType: true }
      });
      if (category) {
        expenseType = category.expenseType;
      }
    }

    // Criar despesa(s) parceladas em faturas MENSAIS SEPARADAS
    const expenses = [];
    const expenseAmount = amount / installments;
    
    // Descontar do limite do cartão (apenas se o cartão tiver limite configurado)
    if (card.limit && card.limit > 0) {
      const currentAvailable = card.availableLimit || card.limit;
      const newAvailable = currentAvailable - amount;
      
      await prisma.creditCard.update({
        where: { id: creditCardId },
        data: {
          availableLimit: newAvailable
        }
      });
    }
    
    for (let i = 1; i <= installments; i++) {
      // Calcular o mês de referência da fatura para esta parcela
      // Primeira parcela: baseada no mês da compra + lógica de fechamento
      // Demais parcelas: meses subsequentes
      let parcelaInvoiceMonth = invoiceMonth + (i - 1);
      let parcelaInvoiceYear = invoiceYear;
      
      // Ajustar ano se passar de dezembro
      while (parcelaInvoiceMonth > 11) {
        parcelaInvoiceMonth -= 12;
        parcelaInvoiceYear += 1;
      }
      
      const parcelaReferenceMonth = new Date(parcelaInvoiceYear, parcelaInvoiceMonth, 1);
      
      
      // Buscar ou criar fatura para o mês desta parcela
      let parcelaInvoice = await prisma.creditCardInvoice.findFirst({
        where: {
          creditCardId,
          referenceMonth: parcelaReferenceMonth,
          status: "OPEN"
        }
      });

      if (!parcelaInvoice) {
        const parcelaClosingDate = new Date(parcelaInvoiceYear, parcelaInvoiceMonth, card.closingDay);
        
        // Data de vencimento: dia do vencimento no mês seguinte ao fechamento
        let parcelaDueYear = parcelaInvoiceYear;
        let parcelaDueMonth = parcelaInvoiceMonth + 1;
        if (parcelaDueMonth > 11) {
          parcelaDueMonth = 0;
          parcelaDueYear = parcelaInvoiceYear + 1;
        }
        
        const parcelaDueDate = new Date(parcelaDueYear, parcelaDueMonth, card.dueDay);


        parcelaInvoice = await prisma.creditCardInvoice.create({
          data: {
            creditCardId,
            referenceMonth: parcelaReferenceMonth,
            closingDate: parcelaClosingDate,
            dueDate: parcelaDueDate,
            totalAmount: 0,
            status: "OPEN"
          }
        });
      }

      const expense = await prisma.creditCardExpense.create({
        data: {
          creditCardId,
          invoiceId: parcelaInvoice.id,
          description: installments > 1 ? `${description} (${i}/${installments})` : description,
          amount: expenseAmount,
          purchaseDate: purchaseDateObj,
          categoryId,
          supplierName,
          referenceNumber,
          installments,
          installmentNumber: i,
          notes,
          attachmentUrl: i === 1 ? attachmentUrl : null,
          attachmentName: i === 1 ? attachmentName : null,
          expenseType,
          createdBy: session.user?.email
        }
      });

      // Atualizar o total da fatura
      await prisma.creditCardInvoice.update({
        where: { id: parcelaInvoice.id },
        data: {
          totalAmount: {
            increment: expenseAmount
          }
        }
      });


      expenses.push(expense);
    }

    return NextResponse.json({ expenses }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar despesa:", error);
    return NextResponse.json(
      { error: "Erro ao criar despesa" },
      { status: 500 }
    );
  }
}
