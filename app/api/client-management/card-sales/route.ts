export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

/**
 * API para gerenciar vendas com cartão do cliente
 * GET: Lista vendas feitas com cartão (DEBIT_CARD ou CREDIT_CARD)
 */

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).userType !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Acesso negado" },
        { status: 401 }
      );
    }

    const customerId = (session.user as any).customerId;
    if (!customerId) {
      return NextResponse.json(
        { error: "Cliente não identificado" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status"); // "pending" ou "received"
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    console.log("[CARD_SALES_GET] Buscando vendas com cartão:", {
      customerId,
      status,
      startDate,
      endDate,
    });

    // Filtros base
    const whereFilter: any = {
      customerId,
      paymentMethod: {
        in: ["DEBIT_CARD", "CREDIT_CARD"],
      },
    };

    // Filtro por data
    if (startDate && endDate) {
      whereFilter.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    // Filtro por status (se aplicável)
    // Como não temos um campo específico de "recebido", vamos considerar:
    // - "pending": vendas criadas recentemente (últimos 7 dias por padrão)
    // - "received": vendas mais antigas
    if (status === "pending") {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      whereFilter.createdAt = {
        gte: sevenDaysAgo,
      };
    } else if (status === "received") {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      whereFilter.createdAt = {
        lt: sevenDaysAgo,
      };
    }

    const sales = await prisma.clientSale.findMany({
      where: whereFilter,
      include: {
        Items: {
          include: {
            Product: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    console.log("[CARD_SALES_GET] Vendas encontradas:", sales.length);

    // Mapear para formato esperado pelos componentes
    const mappedSales = sales.map((sale) => {
      // Calcular taxa (exemplo: 2% para débito, 3% para crédito)
      const feePercentage = sale.paymentMethod === "DEBIT_CARD" ? 2 : 3;
      const grossAmount = sale.total;
      const feeAmount = (grossAmount * feePercentage) / 100;
      const netAmount = grossAmount - feeAmount;

      return {
        id: sale.id,
        saleNumber: sale.saleNumber,
        customerName: sale.customerName || "Cliente não identificado",
        cardType: sale.paymentMethod === "DEBIT_CARD" ? "DEBIT" : "CREDIT",
        grossAmount,
        feePercentage,
        feeAmount,
        netAmount,
        saleDate: sale.createdAt.toISOString(),
        expectedDate: sale.createdAt.toISOString(), // Poderia calcular com base no tipo de cartão
        receivedDate: sale.createdAt.toISOString(), // Simplificação
        paymentMethod: sale.paymentMethod,
      };
    });

    return NextResponse.json(mappedSales);
  } catch (error) {
    console.error("[CARD_SALES_GET] Error:", error);
    return NextResponse.json(
      { error: "Erro ao carregar vendas com cartão" },
      { status: 500 }
    );
  }
}

