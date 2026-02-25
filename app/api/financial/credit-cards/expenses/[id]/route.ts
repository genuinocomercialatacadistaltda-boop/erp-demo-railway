
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { uploadFile } from "@/lib/s3";

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

    const expense = await prisma.creditCardExpense.findUnique({
      where: { id: params.id },
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

// PUT - Editar despesa
export async function PUT(
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

    // Buscar a despesa atual
    const currentExpense = await prisma.creditCardExpense.findUnique({
      where: { id: params.id }
    });

    if (!currentExpense) {
      return NextResponse.json(
        { error: "Despesa não encontrada" },
        { status: 404 }
      );
    }

    const formData = await req.formData();
    
    const description = formData.get("description") as string;
    const amount = parseFloat(formData.get("amount") as string);
    const purchaseDate = formData.get("purchaseDate") as string;
    const categoryId = formData.get("categoryId") as string || null;
    const supplierName = formData.get("supplierName") as string || null;
    const referenceNumber = formData.get("referenceNumber") as string || null;
    const notes = formData.get("notes") as string || null;
    const newInvoiceId = formData.get("invoiceId") as string || null; // 🆕 Nova fatura
    const newCreditCardId = formData.get("creditCardId") as string || null; // 🆕 Novo cartão
    const file = formData.get("file") as File | null;

    // Validações
    if (!description || !amount || !purchaseDate) {
      return NextResponse.json(
        { error: "Dados incompletos" },
        { status: 400 }
      );
    }

    // Upload do arquivo se fornecido
    let attachmentUrl = currentExpense.attachmentUrl;
    let attachmentName = currentExpense.attachmentName;

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const fileName = `credit-card-expenses/${Date.now()}-${file.name}`;
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

    // 🆕 Detectar se houve mudança de cartão
    const oldCardId = currentExpense.creditCardId;
    const cardChanged = newCreditCardId && newCreditCardId !== oldCardId;
    
    // 🆕 Detectar se houve mudança de fatura (mês)
    const invoiceChanged = newInvoiceId !== currentExpense.invoiceId;
    const oldInvoiceId = currentExpense.invoiceId;
    const amountChanged = amount !== currentExpense.amount;

    console.log('🔄 [UPDATE_EXPENSE] Dados da atualização:', {
      expenseId: params.id,
      description,
      oldAmount: currentExpense.amount,
      newAmount: amount,
      amountChanged,
      oldInvoiceId,
      newInvoiceId,
      invoiceChanged,
      oldCardId,
      newCreditCardId,
      cardChanged
    });

    // 🆕 Se o CARTÃO mudou, ajustar os limites
    if (cardChanged) {
      console.log('💳 [UPDATE_EXPENSE] Mudança de cartão detectada!');
      
      // Devolver limite ao cartão antigo
      await prisma.creditCard.update({
        where: { id: oldCardId },
        data: { availableLimit: { increment: Number(currentExpense.amount) } }
      });
      console.log(`✅ Limite devolvido ao cartão antigo: +R$ ${Number(currentExpense.amount).toFixed(2)}`);
      
      // Deduzir limite do novo cartão
      await prisma.creditCard.update({
        where: { id: newCreditCardId },
        data: { availableLimit: { decrement: amount } }
      });
      console.log(`✅ Limite deduzido do novo cartão: -R$ ${amount.toFixed(2)}`);
    } else if (amountChanged) {
      // Se só o valor mudou (sem mudar de cartão), ajustar a diferença
      const diff = amount - Number(currentExpense.amount);
      await prisma.creditCard.update({
        where: { id: oldCardId },
        data: { availableLimit: { decrement: diff } }
      });
      console.log(`✅ Ajuste de limite no mesmo cartão: R$ ${diff > 0 ? '-' : '+'}${Math.abs(diff).toFixed(2)}`);
    }

    // 🆕 Se a fatura mudou ou o valor mudou, precisamos recalcular os totais
    if (invoiceChanged || amountChanged || cardChanged) {
      console.log('💰 [UPDATE_EXPENSE] Recalculando totais das faturas...');

      // 1. Se tinha fatura antiga, devolver o valor dela
      if (oldInvoiceId) {
        const oldInvoice = await prisma.creditCardInvoice.findUnique({
          where: { id: oldInvoiceId }
        });
        
        if (oldInvoice) {
          const newOldInvoiceTotal = Math.max(0, Number(oldInvoice.totalAmount) - Number(currentExpense.amount));
          console.log(`📉 Fatura antiga (${oldInvoice.referenceMonth}): R$ ${oldInvoice.totalAmount} → R$ ${newOldInvoiceTotal}`);
          
          await prisma.creditCardInvoice.update({
            where: { id: oldInvoiceId },
            data: { totalAmount: newOldInvoiceTotal }
          });
        }
      }

      // 2. Se tem nova fatura, adicionar o novo valor nela
      if (newInvoiceId) {
        const newInvoice = await prisma.creditCardInvoice.findUnique({
          where: { id: newInvoiceId }
        });
        
        if (newInvoice) {
          const newInvoiceTotal = Number(newInvoice.totalAmount) + amount;
          console.log(`📈 Fatura nova (${newInvoice.referenceMonth}): R$ ${newInvoice.totalAmount} → R$ ${newInvoiceTotal}`);
          
          await prisma.creditCardInvoice.update({
            where: { id: newInvoiceId },
            data: { totalAmount: newInvoiceTotal }
          });
        }
      }
    }

    // Atualizar despesa
    const updatedExpense = await prisma.creditCardExpense.update({
      where: { id: params.id },
      data: {
        description,
        amount,
        purchaseDate: new Date(purchaseDate),
        categoryId,
        supplierName,
        referenceNumber,
        notes,
        attachmentUrl,
        attachmentName,
        expenseType, // Atualizar se a categoria mudou
        invoiceId: newInvoiceId, // 🆕 Atualizar a fatura
        creditCardId: newCreditCardId || oldCardId // 🆕 Atualizar o cartão
      },
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
      }
    });

    console.log('✅ [UPDATE_EXPENSE] Despesa atualizada com sucesso');

    return NextResponse.json({ expense: updatedExpense });
  } catch (error) {
    console.error("Erro ao atualizar despesa:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar despesa" },
      { status: 500 }
    );
  }
}

// DELETE - Excluir despesa
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

    const expense = await prisma.creditCardExpense.findUnique({
      where: { id: params.id },
      include: {
        CreditCard: true,
        Invoice: true
      }
    });

    if (!expense) {
      return NextResponse.json(
        { error: "Despesa não encontrada" },
        { status: 404 }
      );
    }

    // Não permitir exclusão se já estiver em fatura fechada ou paga
    if (expense.Invoice && (expense.Invoice.status === "CLOSED" || expense.Invoice.status === "PAID")) {
      return NextResponse.json(
        { error: "Não é possível excluir despesa de fatura fechada ou paga" },
        { status: 400 }
      );
    }

    console.log(`🗑️ Excluindo despesa: ${expense.description} - R$ ${expense.amount}`);
    
    // 1. Atualizar o limite disponível do cartão (devolver o valor)
    const currentAvailable = expense.CreditCard.availableLimit || 0;
    const newAvailable = currentAvailable + expense.amount;
    
    console.log(`📊 Cartão: ${expense.CreditCard.name}`);
    console.log(`💰 Limite atual disponível: R$ ${currentAvailable}`);
    console.log(`➕ Valor a devolver: R$ ${expense.amount}`);
    console.log(`✅ Novo limite disponível: R$ ${newAvailable}`);

    await prisma.creditCard.update({
      where: { id: expense.creditCardId },
      data: {
        availableLimit: newAvailable
      }
    });

    // 2. Se a despesa estava em uma fatura OPEN, recalcular o total da fatura
    if (expense.invoiceId && expense.Invoice?.status === "OPEN") {
      const currentInvoiceTotal = expense.Invoice.totalAmount || 0;
      const newInvoiceTotal = Math.max(0, currentInvoiceTotal - expense.amount);
      
      console.log(`📄 Fatura: ${expense.Invoice.referenceMonth}`);
      console.log(`💵 Total atual da fatura: R$ ${currentInvoiceTotal}`);
      console.log(`➖ Valor a descontar: R$ ${expense.amount}`);
      console.log(`✅ Novo total da fatura: R$ ${newInvoiceTotal}`);

      await prisma.creditCardInvoice.update({
        where: { id: expense.invoiceId },
        data: {
          totalAmount: newInvoiceTotal
        }
      });
    }

    // 3. Excluir a despesa
    await prisma.creditCardExpense.delete({
      where: { id: params.id }
    });

    console.log(`✅ Despesa excluída com sucesso!`);

    return NextResponse.json({ 
      message: "Despesa excluída com sucesso",
      updatedCardLimit: newAvailable
    });
  } catch (error) {
    console.error("Erro ao excluir despesa:", error);
    return NextResponse.json(
      { error: "Erro ao excluir despesa" },
      { status: 500 }
    );
  }
}
