
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

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

    // Buscar clientes finais cadastrados (ClientCustomer)
    const finalCustomers = await prisma.clientCustomer.findMany({
      where: {
        customerId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        phone: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    console.log(`✅ [CUSTOMERS_FOR_PAYMENT] Encontrados ${finalCustomers.length} clientes para customerId: ${customerId}`);
    console.log(`📋 [CUSTOMERS_FOR_PAYMENT] Clientes:`, finalCustomers.map(c => c.name).join(", "));

    return NextResponse.json({
      success: true,
      data: finalCustomers,
    });
  } catch (error) {
    console.error("[CUSTOMERS_FOR_PAYMENT_GET] Error:", error);
    return NextResponse.json(
      { error: "Erro ao carregar clientes" },
      { status: 500 }
    );
  }
}
