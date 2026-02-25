export const dynamic = 'force-dynamic';


import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { uploadFile, deleteFile } from "@/lib/s3";

// GET - Buscar despesa específica
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
    }

    const expense = await prisma.expense.findUnique({
      where: { id: params.id },
      include: {
        Category: true,
        BankAccount: true
      }
    });

    if (!expense) {
      return NextResponse.json(
        { error: "Despesa não encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({ expense });
  } catch (error) {
    console.error("Erro ao buscar despesa:", error);
    return NextResponse.json(
      { error: "Erro ao buscar despesa" },
      { status: 500 }
    );
  }
}

// PUT - Atualizar despesa
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('[EXPENSE_PUT] Iniciando atualização de despesa:', params.id);
    
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    
    const description = formData.get("description") as string;
    const amount = formData.get("amount") as string ? parseFloat(formData.get("amount") as string) : undefined;
    const categoryId = formData.get("categoryId") as string;
    const bankAccountId = formData.get("bankAccountId") as string || undefined;
    const supplierName = formData.get("supplierName") as string || undefined;
    const supplierDocument = formData.get("supplierDocument") as string || undefined;
    const dueDate = formData.get("dueDate") as string;
    const competenceDate = formData.get("competenceDate") as string || undefined;
    const notes = formData.get("notes") as string || undefined;
    const referenceNumber = formData.get("referenceNumber") as string || undefined;
    const feeAmount = formData.get("feeAmount") as string ? parseFloat(formData.get("feeAmount") as string) : undefined;
    const file = formData.get("file") as File | null;
    const removeAttachment = formData.get("removeAttachment") === "true";
    
    // NOVO: Permitir alterar status de pagamento
    const status = formData.get("status") as string || undefined;
    const paymentDate = formData.get("paymentDate") as string || undefined;

    console.log('[EXPENSE_PUT] Dados recebidos:', {
      description,
      amount,
      dueDate,
      competenceDate: competenceDate || 'não fornecido',
      status,
      paymentDate: paymentDate ? 'fornecido' : 'não fornecido'
    });

    // Buscar despesa atual
    const currentExpense = await prisma.expense.findUnique({
      where: { id: params.id }
    });

    if (!currentExpense) {
      return NextResponse.json(
        { error: "Despesa não encontrada" },
        { status: 404 }
      );
    }

    let attachmentUrl = currentExpense.attachmentUrl;
    let attachmentName = currentExpense.attachmentName;

    // Remover anexo se solicitado
    if (removeAttachment && currentExpense.attachmentUrl) {
      await deleteFile(currentExpense.attachmentUrl);
      attachmentUrl = null;
      attachmentName = null;
    }

    // Upload de novo arquivo se fornecido
    if (file) {
      // Deletar arquivo antigo se existir
      if (currentExpense.attachmentUrl) {
        await deleteFile(currentExpense.attachmentUrl);
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const fileName = `expenses/${Date.now()}-${file.name}`;
      attachmentUrl = await uploadFile(buffer, fileName);
      attachmentName = file.name;
    }

    // Buscar a categoria para pegar o expenseType
    let expenseType = currentExpense.expenseType; // Manter o atual
    if (categoryId && categoryId !== currentExpense.categoryId) {
      const category = await prisma.expenseCategory.findUnique({
        where: { id: categoryId },
        select: { expenseType: true }
      });
      if (category) {
        expenseType = category.expenseType;
      }
    }

    // Preparar dados de atualização
    const updateData: any = {
      description,
      amount,
      categoryId,
      bankAccountId: bankAccountId || null,
      supplierName: supplierName || null,
      supplierDocument: supplierDocument || null,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      competenceDate: competenceDate ? new Date(competenceDate) : null,
      notes: notes || null,
      referenceNumber: referenceNumber || null,
      feeAmount: feeAmount || null,
      attachmentUrl,
      attachmentName,
      expenseType // Atualizar se a categoria mudou
    };

    // NOVO: Incluir status e paymentDate se fornecidos
    if (status) {
      updateData.status = status;
      console.log('[EXPENSE_PUT] Atualizando status para:', status);
    }
    
    if (paymentDate !== undefined) {
      updateData.paymentDate = paymentDate ? new Date(paymentDate) : null;
      console.log('[EXPENSE_PUT] Atualizando paymentDate para:', paymentDate || 'null');
    }

    // 🔄 Verificar se existe compra vinculada
    const linkedPurchase = await prisma.purchase.findFirst({
      where: { expenseId: params.id }
    });
    
    console.log('[EXPENSE_PUT] Compra vinculada:', linkedPurchase ? linkedPurchase.purchaseNumber : 'NENHUMA');

    const expense = await prisma.expense.update({
      where: { id: params.id },
      data: updateData,
      include: {
        Category: true,
        BankAccount: true
      }
    });
    
    // 🔄 SINCRONIZAR: Se existe compra vinculada E mudou o status para PAID
    if (linkedPurchase && status === 'PAID') {
      console.log('🔄 [EXPENSE_PUT] Sincronizando status da compra:', linkedPurchase.purchaseNumber);
      await prisma.purchase.update({
        where: { id: linkedPurchase.id },
        data: {
          status: "PAID",
          paymentDate: updateData.paymentDate || new Date(),
          paidBy: session.user?.email || undefined
        }
      });
    }
    
    // 🔄 SINCRONIZAR: Se mudou de PAID para PENDING, reverter compra também
    if (linkedPurchase && status === 'PENDING' && currentExpense.status === 'PAID') {
      console.log('🔄 [EXPENSE_PUT] Revertendo status da compra:', linkedPurchase.purchaseNumber);
      await prisma.purchase.update({
        where: { id: linkedPurchase.id },
        data: {
          status: "PENDING",
          paymentDate: null,
          paidBy: null
        }
      });
    }

    console.log('[EXPENSE_PUT] Despesa atualizada:', {
      id: expense.id,
      description: expense.description,
      amount: expense.amount,
      dueDate: expense.dueDate,
      competenceDate: expense.competenceDate,
      status: expense.status,
      paymentDate: expense.paymentDate
    });

    return NextResponse.json({ expense });
  } catch (error) {
    console.error("Erro ao atualizar despesa:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar despesa" },
      { status: 500 }
    );
  }
}

// DELETE - Deletar despesa
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
    }

    const expense = await prisma.expense.findUnique({
      where: { id: params.id },
      include: {
        BankAccount: true
      }
    });

    if (!expense) {
      return NextResponse.json(
        { error: "Despesa não encontrada" },
        { status: 404 }
      );
    }

    // Se a despesa foi paga, reverter o saldo da conta bancária
    if (expense.status === "PAID" && expense.bankAccountId) {
      const totalAmount = expense.amount + (expense.feeAmount || 0);
      
      // Reverter saldo da conta bancária (devolver o dinheiro)
      await prisma.bankAccount.update({
        where: { id: expense.bankAccountId },
        data: {
          balance: {
            increment: totalAmount
          }
        }
      });

      // Buscar o saldo atual da conta
      const account = await prisma.bankAccount.findUnique({
        where: { id: expense.bankAccountId }
      });

      // Registrar transação de estorno
      await prisma.transaction.create({
        data: {
          bankAccountId: expense.bankAccountId,
          type: "ADJUSTMENT",
          category: "REVERSAL",
          amount: totalAmount,
          description: `Estorno - Exclusão de despesa: ${expense.description}`,
          referenceId: expense.id,
          referenceType: "EXPENSE_REVERSAL",
          date: new Date(),
          balanceAfter: account ? account.balance : 0
        }
      });

      // Deletar transação de despesa original se existir
      await prisma.transaction.deleteMany({
        where: {
          bankAccountId: expense.bankAccountId,
          type: "EXPENSE",
          referenceId: expense.id,
          referenceType: "EXPENSE"
        }
      });
    }

    // Deletar arquivo anexado se existir
    if (expense.attachmentUrl) {
      try {
        await deleteFile(expense.attachmentUrl);
      } catch (err) {
        console.error("Erro ao deletar arquivo anexado:", err);
        // Continua mesmo se falhar ao deletar o arquivo
      }
    }

    await prisma.expense.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ 
      message: expense.status === "PAID" 
        ? "Despesa excluída e saldo revertido com sucesso" 
        : "Despesa excluída com sucesso" 
    });
  } catch (error) {
    console.error("Erro ao excluir despesa:", error);
    return NextResponse.json(
      { error: "Erro ao excluir despesa" },
      { status: 500 }
    );
  }
}
