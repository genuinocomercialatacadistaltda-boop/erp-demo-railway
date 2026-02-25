
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

// Helper para obter início do dia em Brasília (00:00 BRT = 03:00 UTC)
function getBrasiliaToday() {
  const now = new Date()
  // Ajusta para horário de Brasília (UTC-3)
  const brasiliaTime = new Date(now.getTime() - (3 * 60 * 60 * 1000))
  
  const year = brasiliaTime.getUTCFullYear()
  const month = brasiliaTime.getUTCMonth()
  const day = brasiliaTime.getUTCDate()
  
  // Retorna UTC equivalente a 00:00 de Brasília (03:00 UTC)
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0))
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;

    if (!user || user.userType !== "CUSTOMER") {
      return NextResponse.json(
        { success: false, error: "Não autorizado" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");

    if (!customerId || customerId !== user.customerId) {
      return NextResponse.json(
        { success: false, error: "Cliente não identificado" },
        { status: 400 }
      );
    }

    // Atualizar status dos receivables vencidos usando horário de Brasília
    const brasiliaToday = getBrasiliaToday()
    console.log('[CUSTOMER_RECEIVABLES_GET] Verificando receivables vencidos...')
    console.log('[CUSTOMER_RECEIVABLES_GET] Data de referência (início do dia de Brasília):', brasiliaToday.toISOString())

    // Buscar receivables PENDING com vencimento anterior ao dia de hoje
    const overdueReceivables = await prisma.receivable.findMany({
      where: {
        customerId: customerId,
        status: 'PENDING',
        dueDate: {
          lt: brasiliaToday
        }
      },
      select: {
        id: true,
        dueDate: true,
      }
    })

    console.log(`[CUSTOMER_RECEIVABLES_GET] Encontrados ${overdueReceivables.length} receivables vencidos`)

    // Marcar como OVERDUE
    if (overdueReceivables.length > 0) {
      for (const receivable of overdueReceivables) {
        console.log(`[CUSTOMER_RECEIVABLES_GET] Marcando como OVERDUE: ${receivable.id}, vencimento=${receivable.dueDate.toISOString()}`)
      }

      await prisma.receivable.updateMany({
        where: {
          id: {
            in: overdueReceivables.map((r) => r.id),
          },
        },
        data: {
          status: 'OVERDUE',
        },
      })
      
      console.log(`[CUSTOMER_RECEIVABLES_GET] ✅ ${overdueReceivables.length} receivables marcados como OVERDUE`)
    }

    // Buscar todas as contas a receber do cliente (agora com status atualizado)
    const receivables = await prisma.receivable.findMany({
      where: {
        customerId: customerId,
      },
      include: {
        Order: {
          select: {
            id: true,
            orderNumber: true,
            paymentMethod: true,
            createdAt: true,
            total: true,
          },
        },
      },
      orderBy: [
        { status: "asc" }, // PENDING primeiro
        { dueDate: "asc" }, // Mais antigos primeiro
      ],
    });

    // Calcular totais
    const totalPending = receivables
      .filter((r: any) => r.status === "PENDING")
      .reduce((sum: number, r: any) => sum + Number(r.amount), 0);

    const totalOverdue = receivables
      .filter((r: any) => r.status === "OVERDUE")
      .reduce((sum: number, r: any) => sum + Number(r.amount), 0);

    // Serializar dados
    const serializedReceivables = receivables.map((r: any) => ({
      ...r,
      amount: Number(r.amount),
      netAmount: r.netAmount ? Number(r.netAmount) : null,
      feeAmount: r.feeAmount ? Number(r.feeAmount) : null,
      dueDate: r.dueDate.toISOString(),
      paymentDate: r.paymentDate ? r.paymentDate.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      Order: r.Order ? {
        ...r.Order,
        total: Number(r.Order.total),
        createdAt: r.Order.createdAt.toISOString(),
      } : null,
    }));

    return NextResponse.json({
      success: true,
      receivables: serializedReceivables,
      totalPending,
      totalOverdue,
    });
  } catch (error) {
    console.error("Erro ao buscar contas a receber:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao buscar contas" },
      { status: 500 }
    );
  }
}
