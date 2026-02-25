export const dynamic = 'force-dynamic';


import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth-options";

// POST - Criar conta a receber automaticamente para um pedido
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: "ID do pedido é obrigatório" },
        { status: 400 }
      );
    }

    // Buscar pedido
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        Customer: true,
        Boleto: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Pedido não encontrado" },
        { status: 404 }
      );
    }

    // Verificar se já existe conta a receber para este pedido
    const existing = await prisma.receivable.findFirst({
      where: { orderId: orderId },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Já existe uma conta a receber para este pedido" },
        { status: 400 }
      );
    }

    // Determinar método de pagamento e taxas
    let feeAmount = 0;
    let paymentMethod = order.paymentMethod;

    // Calcular taxa de cartão
    if (order.paymentMethod === "CARD") {
      feeAmount = order.cardFee || 0;
    }

    // Se tem boleto, usar data de vencimento do boleto
    let dueDate = new Date();
    if (order.Boleto && order.Boleto.length > 0) {
      dueDate = order.Boleto[0].dueDate;
      paymentMethod = "BOLETO";
    } else if (order.Customer) {
      // Usar prazo de pagamento do cliente
      dueDate.setDate(dueDate.getDate() + order.Customer.paymentTerms);
    }

    // Criar conta a receber
    const receivable = await prisma.receivable.create({
      data: {
        customerId: order.customerId || null,
        orderId: order.id,
        boletoId: order.Boleto && order.Boleto.length > 0 ? order.Boleto[0].id : null,
        description: `Pedido #${order.orderNumber} - ${order.customerName}`,
        amount: order.total,
        dueDate: dueDate,
        status: order.status === "DELIVERED" ? "PENDING" : "PENDING",
        paymentMethod: paymentMethod,
        feeAmount: feeAmount,
        netAmount: order.total - feeAmount,
        referenceNumber: order.orderNumber,
        createdBy: (session.user as any)?.id,
      },
      include: {
        Customer: true,
        Order: true,
      },
    });

    return NextResponse.json(receivable, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar conta a receber para pedido:", error);
    return NextResponse.json(
      { error: "Erro ao criar conta a receber para pedido" },
      { status: 500 }
    );
  }
}
