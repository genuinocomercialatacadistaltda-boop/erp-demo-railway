
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth-options";

// DELETE - Remover um pagamento (apenas admin)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string; paymentId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id: orderId, paymentId } = params;

    // Buscar o pagamento
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        Order: true
      }
    });

    if (!payment) {
      return NextResponse.json({ error: "Pagamento não encontrado" }, { status: 404 });
    }

    if (payment.orderId !== orderId) {
      return NextResponse.json({ error: "Pagamento não pertence a este pedido" }, { status: 400 });
    }

    // Calcular novo valor pago após remoção
    const newPaidAmount = payment.Order.paidAmount - payment.amount;

    // Determinar novo status
    let newPaymentStatus: "UNPAID" | "PARTIAL" | "PAID";
    if (newPaidAmount === 0) {
      newPaymentStatus = "UNPAID";
    } else if (newPaidAmount >= payment.Order.total) {
      newPaymentStatus = "PAID";
    } else {
      newPaymentStatus = "PARTIAL";
    }

    // Usar transação
    await prisma.$transaction(async (tx: any) => {
      // Deletar pagamento
      await tx.payment.delete({
        where: { id: paymentId }
      });

      // Atualizar pedido
      await tx.order.update({
        where: { id: orderId },
        data: {
          paidAmount: newPaidAmount,
          paymentStatus: newPaymentStatus
        }
      });
    });

    return NextResponse.json({
      success: true,
      message: "Pagamento removido com sucesso"
    });
  } catch (error) {
    console.error("Erro ao remover pagamento:", error);
    return NextResponse.json(
      { error: "Erro ao remover pagamento" },
      { status: 500 }
    );
  }
}
