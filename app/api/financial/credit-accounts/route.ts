
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth-options";

// GET - Listar todas as contas de crediário (pedidos com saldo devedor)
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // UNPAID, PARTIAL, PAID
    const customerId = searchParams.get("customerId");

    // Construir filtros
    const where: any = {
      paymentMethod: "CREDIT", // Apenas pedidos no crediário
      paymentStatus: {
        in: status && status !== "all" ? [status] : ["UNPAID", "PARTIAL"]
      }
    };

    if (customerId) {
      where.customerId = customerId;
    }

    // Buscar pedidos
    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        Customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            city: true
          }
        },
        Seller: {
          select: {
            id: true,
            name: true
          }
        },
        Payment: {
          orderBy: { paymentDate: 'desc' },
          take: 3 // Últimos 3 pagamentos
        }
      }
    });

    // Calcular totais
    const summary = {
      totalOrders: orders.length,
      totalOwed: orders.reduce((sum: number, o: any) => sum + (o.total - o.paidAmount), 0),
      totalPaid: orders.reduce((sum: number, o: any) => sum + o.paidAmount, 0),
      totalValue: orders.reduce((sum: number, o: any) => sum + o.total, 0),
      unpaidCount: orders.filter((o: any) => o.paymentStatus === "UNPAID").length,
      partialCount: orders.filter((o: any) => o.paymentStatus === "PARTIAL").length,
      paidCount: orders.filter((o: any) => o.paymentStatus === "PAID").length
    };

    return NextResponse.json({
      orders: orders.map((o: any) => ({
        ...o,
        remainingAmount: o.total - o.paidAmount
      })),
      summary
    });
  } catch (error) {
    console.error("Erro ao buscar contas de crediário:", error);
    return NextResponse.json(
      { error: "Erro ao buscar contas de crediário" },
      { status: 500 }
    );
  }
}
