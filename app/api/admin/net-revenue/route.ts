
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

// GET - Buscar receitas líquidas (receivables pagos)
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
    const period = searchParams.get("period"); // 'daily' ou 'monthly'

    // Calcular datas em timezone de Brasília (UTC-3)
    function getBrasiliaDayStart() {
      const now = new Date();
      const brasiliaTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
      const year = brasiliaTime.getUTCFullYear();
      const month = brasiliaTime.getUTCMonth();
      const day = brasiliaTime.getUTCDate();
      return new Date(Date.UTC(year, month, day, 3, 0, 0, 0));
    }

    function getBrasiliaDayEnd() {
      const now = new Date();
      const brasiliaTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
      const year = brasiliaTime.getUTCFullYear();
      const month = brasiliaTime.getUTCMonth();
      const day = brasiliaTime.getUTCDate();
      return new Date(Date.UTC(year, month, day + 1, 3, 0, 0, 0));
    }

    function getBrasiliaMonthStart() {
      const now = new Date();
      const brasiliaTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
      const year = brasiliaTime.getUTCFullYear();
      const month = brasiliaTime.getUTCMonth();
      return new Date(Date.UTC(year, month, 1, 3, 0, 0, 0));
    }

    function getBrasiliaMonthEnd() {
      const now = new Date();
      const brasiliaTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
      const year = brasiliaTime.getUTCFullYear();
      const month = brasiliaTime.getUTCMonth();
      return new Date(Date.UTC(year, month + 1, 1, 3, 0, 0, 0));
    }

    let startDate: Date;
    let endDate: Date;

    if (period === 'daily') {
      startDate = getBrasiliaDayStart();
      endDate = getBrasiliaDayEnd();
    } else {
      startDate = getBrasiliaMonthStart();
      endDate = getBrasiliaMonthEnd();
    }

    // Buscar receivables pagos no período
    const receivables = await prisma.receivable.findMany({
      where: {
        status: 'PAID',
        paymentDate: {
          gte: startDate,
          lt: endDate
        }
      },
      include: {
        Order: {
          include: {
            Customer: {
              select: {
                name: true,
                customerType: true
              }
            }
          }
        },
        BankAccount: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        paymentDate: 'desc'
      }
    });

    // Formatar resposta
    const formattedData = receivables.map((rec: any) => ({
      id: rec.id,
      amount: rec.amount,
      paymentDate: rec.paymentDate,
      dueDate: rec.dueDate,
      customerName: rec.Order?.Customer?.name || 'Consumidor Final',
      customerType: rec.Order?.Customer?.customerType || 'CONSUMIDOR_FINAL',
      orderId: rec.orderId,
      orderNumber: rec.Order?.orderNumber,
      bankAccountName: rec.BankAccount?.name || 'Não especificado',
      paymentMethod: rec.paymentMethod
    }));

    return NextResponse.json({
      receivables: formattedData,
      total: receivables.reduce((sum: number, rec: any) => sum + rec.amount, 0),
      count: receivables.length
    });

  } catch (error: any) {
    console.error("❌ [NET REVENUE API] Erro:", error);
    return NextResponse.json(
      { error: "Erro ao buscar receitas líquidas", details: error.message },
      { status: 500 }
    );
  }
}
