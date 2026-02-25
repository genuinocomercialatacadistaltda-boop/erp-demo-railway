export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth-options";

// POST - Receber múltiplos recebíveis de uma vez com transação única
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { 
      receivableIds, 
      bankAccountId, 
      paymentDate, 
      paymentMethod,
      notes
    } = body;

    console.log('[BATCH_RECEIVE] 🎯 Iniciando recebimento em lote...');
    console.log('[BATCH_RECEIVE] IDs:', receivableIds);
    console.log('[BATCH_RECEIVE] Conta bancária:', bankAccountId);

    if (!receivableIds || !Array.isArray(receivableIds) || receivableIds.length === 0) {
      return NextResponse.json(
        { error: "Nenhum recebível selecionado" },
        { status: 400 }
      );
    }

    if (!bankAccountId) {
      return NextResponse.json(
        { error: "Conta bancária é obrigatória" },
        { status: 400 }
      );
    }

    // Buscar todos os recebíveis selecionados
    const receivables = await prisma.receivable.findMany({
      where: {
        id: { in: receivableIds },
        status: { in: ['PENDING', 'OVERDUE', 'PARTIAL'] }
      },
      include: {
        Customer: true
      }
    });

    console.log('[BATCH_RECEIVE] Recebíveis encontrados:', receivables.length);

    if (receivables.length === 0) {
      return NextResponse.json(
        { error: "Nenhum recebível pendente encontrado" },
        { status: 404 }
      );
    }

    // Calcular valor total
    const totalAmount = receivables.reduce((sum, r) => sum + Number(r.amount), 0);
    const roundedTotal = Math.round(totalAmount * 100) / 100;

    console.log('[BATCH_RECEIVE] Valor total:', roundedTotal);

    const payDate = paymentDate ? new Date(paymentDate) : new Date();
    const paidById = (session.user as any)?.id;

    // Executar tudo em uma transação
    const result = await prisma.$transaction(async (tx) => {
      // 1. Atualizar todos os recebíveis para PAID
      const updatedReceivables = [];
      const customerCreditsToRestore: { [customerId: string]: number } = {};

      for (const receivable of receivables) {
        const updated = await tx.receivable.update({
          where: { id: receivable.id },
          data: {
            status: 'PAID',
            paymentDate: payDate,
            paymentMethod: paymentMethod || 'CASH',
            bankAccountId: bankAccountId,
            netAmount: Number(receivable.amount),
            paidBy: paidById,
            notes: notes ? `${receivable.notes || ''}\n[Lote] ${notes}`.trim() : receivable.notes
          }
        });
        updatedReceivables.push(updated);

        // Acumular crédito a restaurar por cliente
        if (receivable.customerId) {
          if (!customerCreditsToRestore[receivable.customerId]) {
            customerCreditsToRestore[receivable.customerId] = 0;
          }
          customerCreditsToRestore[receivable.customerId] += Number(receivable.amount);
        }

        console.log('[BATCH_RECEIVE] ✅ Receivable atualizado:', receivable.id);
      }

      // 2. Restaurar crédito de cada cliente
      for (const [customerId, creditAmount] of Object.entries(customerCreditsToRestore)) {
        const customer = await tx.customer.findUnique({
          where: { id: customerId },
          select: { availableCredit: true, creditLimit: true, name: true }
        });

        if (customer) {
          const newCredit = Number(customer.availableCredit) + creditAmount;
          const finalCredit = Math.min(newCredit, Number(customer.creditLimit));

          await tx.customer.update({
            where: { id: customerId },
            data: { availableCredit: finalCredit }
          });

          console.log('[BATCH_RECEIVE] ✅ Crédito restaurado para', customer.name, ':', creditAmount);
        }
      }

      // 3. Atualizar saldo da conta bancária
      const bankAccount = await tx.bankAccount.update({
        where: { id: bankAccountId },
        data: {
          balance: {
            increment: roundedTotal
          }
        }
      });

      // 4. Criar UMA ÚNICA transação bancária com o valor total
      const customerNames = [...new Set(receivables.map(r => r.Customer?.name || 'Cliente'))].join(', ');

      const transaction = await tx.transaction.create({
        data: {
          bankAccountId: bankAccountId,
          type: 'INCOME',
          amount: roundedTotal,
          date: payDate,
          description: `Recebimento em lote (${receivables.length}x) - ${customerNames}`,
          notes: notes || null,
          referenceType: 'RECEIVABLE_BATCH',
          referenceId: receivableIds.join(','),
          category: 'VENDA',
          balanceAfter: bankAccount.balance,
          createdBy: paidById
        }
      });

      console.log('[BATCH_RECEIVE] ✅ Transação bancária criada:', transaction.id);
      console.log('[BATCH_RECEIVE] Valor total:', roundedTotal);

      return {
        updatedReceivables,
        transaction,
        totalAmount: roundedTotal,
        count: updatedReceivables.length
      };
    });

    console.log('[BATCH_RECEIVE] ✅ Recebimento em lote concluído!');
    console.log('[BATCH_RECEIVE] Total de recebíveis:', result.count);
    console.log('[BATCH_RECEIVE] Valor total:', result.totalAmount);

    return NextResponse.json({
      success: true,
      message: `${result.count} recebíveis recebidos com sucesso!`,
      totalAmount: result.totalAmount,
      transactionId: result.transaction.id,
      receivableIds: receivableIds
    });

  } catch (error) {
    console.error("[BATCH_RECEIVE] ❌ Erro:", error);
    return NextResponse.json(
      { error: "Erro ao processar recebimento em lote" },
      { status: 500 }
    );
  }
}
