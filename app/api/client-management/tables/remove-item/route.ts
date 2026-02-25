export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const { tableId, itemId } = body;

    // Buscar item
    const item = await prisma.clientTableItem.findUnique({
      where: { id: itemId },
    });

    if (!item || item.customerId !== customerId) {
      return NextResponse.json(
        { error: "Item não encontrado" },
        { status: 404 }
      );
    }

    // Remover item
    await prisma.clientTableItem.delete({
      where: { id: itemId },
    });

    // Atualizar total da mesa
    const remainingItems = await prisma.clientTableItem.findMany({
      where: { tableId },
    });

    const newTotal = remainingItems.reduce((sum: number, item: any) => sum + item.totalPrice, 0);
    
    await prisma.clientTable.update({
      where: { id: tableId },
      data: { currentTotal: newTotal },
    });

    return NextResponse.json({
      success: true,
      message: "Item removido",
    });
  } catch (error) {
    console.error("[TABLE_REMOVE_ITEM_POST] Error:", error);
    return NextResponse.json(
      { error: "Erro ao remover item da mesa" },
      { status: 500 }
    );
  }
}
