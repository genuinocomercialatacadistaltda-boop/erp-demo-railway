export const dynamic = 'force-dynamic';


import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { uploadFile } from "@/lib/s3";

// GET - Listar despesas com filtros
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
    const status = searchParams.get("status");
    const categoryId = searchParams.get("categoryId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const bankAccountId = searchParams.get("bankAccountId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "1000"); // Aumentado para 1000 para carregar todas as despesas

    const where: any = {};
    
    if (status) where.status = status;
    if (categoryId) where.categoryId = categoryId;
    if (bankAccountId) where.bankAccountId = bankAccountId;
    
    if (startDate && endDate) {
      where.dueDate = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const [expenses, total, creditCardExpenses] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: {
          Category: {
            select: {
              name: true,
              color: true
            }
          },
          BankAccount: {
            select: {
              name: true,
              color: true
            }
          }
        },
        orderBy: { dueDate: "asc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.expense.count({ where }),
      // Buscar despesas de cartão de crédito com Invoice relacionada
      prisma.creditCardExpense.findMany({
        include: {
          Category: true,
          CreditCard: true,
          Invoice: true
        },
        orderBy: { purchaseDate: "desc" },
        take: 100 // Limitar para performance
      })
    ]);

    // Mapear despesas de cartão para formato compatível
    const mappedCreditCardExpenses = creditCardExpenses.map((exp: any) => ({
      id: exp.id,
      description: `${exp.description} (${exp.CreditCard.name} ${exp.CreditCard.cardNumber || ''})`,
      amount: exp.amount,
      dueDate: exp.Invoice?.dueDate || exp.purchaseDate,
      status: exp.Invoice?.status === "PAID" ? "PAID" : "PENDING",
      Category: exp.Category || { name: "Sem Categoria", color: "#6B7280" },
      BankAccount: null,
      paymentDate: exp.Invoice?.status === "PAID" ? exp.Invoice.dueDate : null,
      type: "CREDIT_CARD" as const,
      creditCardInfo: {
        cardName: exp.CreditCard.name,
        cardDigits: exp.CreditCard.cardNumber,
        invoiceMonth: exp.Invoice?.referenceMonth,
        invoiceStatus: exp.Invoice?.status
      }
    }));

    return NextResponse.json({ 
      expenses,
      creditCardExpenses: mappedCreditCardExpenses,
      total,
      page,
      pages: Math.ceil(total / limit)
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error("Erro ao buscar despesas:", error);
    return NextResponse.json(
      { error: "Erro ao buscar despesas" },
      { status: 500 }
    );
  }
}

// POST - Criar despesa (com upload de arquivo opcional)
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
    
    console.log('[EXPENSE_CREATE] Iniciando criação de despesa...');
    
    const description = formData.get("description") as string;
    const amount = parseFloat(formData.get("amount") as string);
    const categoryId = formData.get("categoryId") as string;
    const bankAccountId = formData.get("bankAccountId") as string || null;
    const supplierName = formData.get("supplierName") as string || null;
    const supplierDocument = formData.get("supplierDocument") as string || null;
    const dueDate = formData.get("dueDate") as string;
    const competenceDate = formData.get("competenceDate") as string || null;
    const notes = formData.get("notes") as string || null;
    const referenceNumber = formData.get("referenceNumber") as string || null;
    const feeAmount = formData.get("feeAmount") as string ? parseFloat(formData.get("feeAmount") as string) : null;
    const file = formData.get("file") as File | null;
    
    console.log('[EXPENSE_CREATE] Dados recebidos:', {
      description,
      amount,
      categoryId,
      dueDate,
      competenceDate,
      hasFile: !!file
    });

    // Validações
    if (!description || !amount || !categoryId || !dueDate) {
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
      const fileName = `expenses/${Date.now()}-${file.name}`;
      attachmentUrl = await uploadFile(buffer, fileName);
      attachmentName = file.name;
    }

    // Buscar a categoria para pegar o expenseType
    const category = await prisma.expenseCategory.findUnique({
      where: { id: categoryId },
      select: { expenseType: true }
    });

    if (!category) {
      return NextResponse.json(
        { error: "Categoria não encontrada" },
        { status: 404 }
      );
    }

    console.log('[EXPENSE_CREATE] Criando no banco...');
    
    const expense = await prisma.expense.create({
      data: {
        description,
        amount,
        categoryId,
        bankAccountId,
        supplierName,
        supplierDocument,
        dueDate: new Date(dueDate),
        competenceDate: competenceDate ? new Date(competenceDate) : null,
        notes,
        referenceNumber,
        feeAmount,
        attachmentUrl,
        attachmentName,
        status: "PENDING",
        expenseType: category.expenseType, // Setar automaticamente baseado na categoria
        createdBy: session.user?.email || undefined
      },
      include: {
        Category: true,
        BankAccount: true
      }
    });
    
    console.log('[EXPENSE_CREATE] ✅ Despesa criada com sucesso:', expense.id);

    return NextResponse.json({ expense }, { status: 201 });
  } catch (error: any) {
    console.error("[EXPENSE_CREATE] ❌ Erro ao criar despesa:", error);
    console.error("[EXPENSE_CREATE] Stack:", error.stack);
    console.error("[EXPENSE_CREATE] Mensagem:", error.message);
    
    return NextResponse.json(
      { 
        error: "Erro ao criar despesa",
        details: error.message,
        code: error.code 
      },
      { status: 500 }
    );
  }
}
