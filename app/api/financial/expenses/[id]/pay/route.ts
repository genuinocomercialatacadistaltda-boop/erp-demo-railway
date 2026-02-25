export const dynamic = 'force-dynamic';


import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

// POST - Marcar despesa como paga e deduzir do saldo
export async function POST(
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

    const data = await req.json();
    const { bankAccountId, paymentDate, notes } = data;

    if (!bankAccountId) {
      return NextResponse.json(
        { error: "Conta bancária é obrigatória" },
        { status: 400 }
      );
    }

    // Buscar despesa com categoria
    const expense = await prisma.expense.findUnique({
      where: { id: params.id },
      include: {
        Category: true
      }
    });

    if (!expense) {
      return NextResponse.json(
        { error: "Despesa não encontrada" },
        { status: 404 }
      );
    }

    if (expense.status === "PAID") {
      return NextResponse.json(
        { error: "Despesa já está paga" },
        { status: 400 }
      );
    }

    // 🖊️ LOG de pagamento de funcionário (sem bloquear)
    const isEmployeePayment = expense.Category?.name?.toLowerCase().includes('pagamento de funcionários');
    
    if (isEmployeePayment) {
      console.log('💰 [PAY_EXPENSE] Processando pagamento de funcionário:', expense.description);
    }

    // Buscar conta bancária
    const account = await prisma.bankAccount.findUnique({
      where: { id: bankAccountId }
    });

    if (!account) {
      return NextResponse.json(
        { error: "Conta bancária não encontrada" },
        { status: 404 }
      );
    }

    // Calcular total (despesa + taxa se houver)
    const totalAmount = expense.amount + (expense.feeAmount || 0);

    // 🔄 Verificar se existe compra vinculada
    const linkedPurchase = await prisma.purchase.findFirst({
      where: { expenseId: params.id }
    });
    
    console.log('🔍 [PAY_EXPENSE] Compra vinculada:', linkedPurchase ? linkedPurchase.purchaseNumber : 'NENHUMA');

    // 🔒 USAR TRANSAÇÃO SERIALIZADA para evitar race condition em pagamentos paralelos
    const result = await prisma.$transaction(async (tx) => {
      // 1. Atualizar despesa
      const updatedExpense = await tx.expense.update({
        where: { id: params.id },
        data: {
          status: "PAID",
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
          bankAccountId,
          notes: notes || expense.notes,
          paidBy: session.user?.email || undefined
        },
        include: {
          Category: true,
          BankAccount: true
        }
      });

      // 2. Atualizar saldo usando DECREMENT atômico (evita race condition)
      const updatedAccount = await tx.bankAccount.update({
        where: { id: bankAccountId },
        data: { 
          balance: {
            decrement: totalAmount
          }
        }
      });

      // 3. Criar transação com o saldo ATUALIZADO (após decrement)
      await tx.transaction.create({
        data: {
          bankAccountId,
          type: "EXPENSE",
          amount: totalAmount,
          description: `Pagamento: ${expense.description}`,
          referenceId: expense.id,
          referenceType: "EXPENSE",
          category: expense.categoryId,
          balanceAfter: updatedAccount.balance, // Saldo já decrementado
          date: paymentDate ? new Date(paymentDate) : new Date(),
          createdBy: session.user?.email || undefined
        }
      });

      // 4. Sincronizar compra vinculada se existir
      if (linkedPurchase) {
        console.log('🔄 [PAY_EXPENSE] Sincronizando status da compra:', linkedPurchase.purchaseNumber);
        await tx.purchase.update({
          where: { id: linkedPurchase.id },
          data: {
            status: "PAID",
            paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
            paidBy: session.user?.email || undefined
          }
        });
      }

      // 5. 🔄 Sincronizar EmployeePayment se esta despesa estiver vinculada a um pagamento de funcionário
      const employeePaymentLinked = await tx.employeePayment.findFirst({
        where: {
          OR: [
            { salaryExpenseId: params.id },
            { advanceExpenseId: params.id },
            { foodVoucherExpenseId: params.id },
            { bonusExpenseId: params.id }
          ]
        }
      });

      if (employeePaymentLinked) {
        console.log('🔄 [PAY_EXPENSE] Despesa vinculada ao pagamento de funcionário:', employeePaymentLinked.id);
        
        // Verificar se TODAS as despesas do pagamento estão pagas
        const allExpenseIds = [
          employeePaymentLinked.salaryExpenseId,
          employeePaymentLinked.advanceExpenseId,
          employeePaymentLinked.foodVoucherExpenseId,
          employeePaymentLinked.bonusExpenseId
        ].filter(Boolean);

        // Buscar status de todas as despesas
        const relatedExpenses = await tx.expense.findMany({
          where: { id: { in: allExpenseIds as string[] } },
          select: { id: true, status: true }
        });

        // Considerar a despesa atual como PAID (pois acabamos de pagar)
        const allPaid = relatedExpenses.every(exp => 
          exp.id === params.id ? true : exp.status === 'PAID'
        );

        if (allPaid) {
          console.log('✅ [PAY_EXPENSE] Todas as despesas pagas - Marcando EmployeePayment como PAGO');
          await tx.employeePayment.update({
            where: { id: employeePaymentLinked.id },
            data: {
              isPaid: true,
              paidAt: new Date()
            }
          });
        } else {
          console.log('⏳ [PAY_EXPENSE] Ainda há despesas pendentes no pagamento');
        }
      }

      return updatedExpense;
    });

    const updatedExpense = result;

    return NextResponse.json({ 
      expense: updatedExpense,
      message: "Despesa paga com sucesso"
    });
  } catch (error) {
    console.error("Erro ao pagar despesa:", error);
    return NextResponse.json(
      { error: "Erro ao pagar despesa" },
      { status: 500 }
    );
  }
}
