
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth-options";

// GET - Listar todos os pagamentos de um pedido
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const orderId = params.id;

    // Buscar o pedido com todos os pagamentos
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        Payment: {
          orderBy: { paymentDate: 'desc' }
        },
        Customer: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        }
      }
    });

    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
    }

    // Calcular informações de pagamento
    const remainingAmount = order.total - order.paidAmount;
    const paymentInfo = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      total: order.total,
      paidAmount: order.paidAmount,
      remainingAmount,
      paymentStatus: order.paymentStatus,
      payments: order.Payment,
      customer: order.Customer
    };

    return NextResponse.json(paymentInfo);
  } catch (error) {
    console.error("Erro ao buscar pagamentos:", error);
    return NextResponse.json(
      { error: "Erro ao buscar pagamentos" },
      { status: 500 }
    );
  }
}

// POST - Registrar um novo pagamento
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const orderId = params.id;
    const body = await request.json();
    const { amount, paymentMethod, notes } = body;

    // Validações
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Valor do pagamento inválido" },
        { status: 400 }
      );
    }

    if (!paymentMethod) {
      return NextResponse.json(
        { error: "Método de pagamento obrigatório" },
        { status: 400 }
      );
    }

    // Buscar o pedido
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
    }

    // Calcular novo valor pago
    const newPaidAmount = order.paidAmount + parseFloat(amount);

    // Verificar se não vai ultrapassar o total
    if (newPaidAmount > order.total + 0.01) { // +0.01 para margem de centavos
      return NextResponse.json(
        { 
          error: "Valor do pagamento ultrapassa o saldo devedor",
          remainingAmount: order.total - order.paidAmount
        },
        { status: 400 }
      );
    }

    // Determinar novo status de pagamento
    let newPaymentStatus: "UNPAID" | "PARTIAL" | "PAID";
    if (newPaidAmount === 0) {
      newPaymentStatus = "UNPAID";
    } else if (newPaidAmount >= order.total - 0.01) { // -0.01 para margem de centavos
      newPaymentStatus = "PAID";
    } else {
      newPaymentStatus = "PARTIAL";
    }

    // Usar transação para garantir consistência
    const result = await prisma.$transaction(async (tx: any) => {
      // Criar registro de pagamento
      const payment = await tx.payment.create({
        data: {
          orderId,
          amount: parseFloat(amount),
          paymentMethod,
          notes,
          receivedBy: (session.user as any)?.id || null
        }
      });

      // Atualizar pedido
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          paidAmount: newPaidAmount,
          paymentStatus: newPaymentStatus
        },
        include: {
          Payment: {
            orderBy: { paymentDate: 'desc' }
          }
        }
      });

      return { payment, order: updatedOrder };
    });

    return NextResponse.json(
      {
        success: true,
        payment: result.payment,
        order: {
          id: result.order.id,
          orderNumber: result.order.orderNumber,
          total: result.order.total,
          paidAmount: result.order.paidAmount,
          remainingAmount: result.order.total - result.order.paidAmount,
          paymentStatus: result.order.paymentStatus
        },
        message: `Pagamento de R$ ${amount} registrado com sucesso!`
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro ao registrar pagamento:", error);
    return NextResponse.json(
      { error: "Erro ao registrar pagamento" },
      { status: 500 }
    );
  }
}
