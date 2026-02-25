export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    console.log("[TABLE_ADD_ITEM] ===== INÍCIO =====");
    
    const session = await getServerSession(authOptions);
    console.log("[TABLE_ADD_ITEM] Session:", { 
      hasSession: !!session, 
      userType: (session?.user as any)?.userType,
      customerId: (session?.user as any)?.customerId 
    });
    
    if (!session?.user || (session.user as any).userType !== "CUSTOMER") {
      console.log("[TABLE_ADD_ITEM] ❌ Acesso negado - userType inválido");
      return NextResponse.json(
        { error: "Acesso negado" },
        { status: 401 }
      );
    }

    const customerId = (session.user as any).customerId;
    if (!customerId) {
      console.log("[TABLE_ADD_ITEM] ❌ Cliente não identificado");
      return NextResponse.json(
        { error: "Cliente não identificado" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { tableId, productId, productName, quantity, unitPrice } = body;
    
    console.log("[TABLE_ADD_ITEM] Dados recebidos:", {
      tableId,
      productId,
      productName,
      quantity,
      unitPrice,
      customerId
    });

    // Validações básicas
    if (!tableId) {
      console.log("[TABLE_ADD_ITEM] ❌ tableId ausente");
      return NextResponse.json(
        { error: "ID da mesa não fornecido" },
        { status: 400 }
      );
    }

    if (!productId) {
      console.log("[TABLE_ADD_ITEM] ❌ productId ausente");
      return NextResponse.json(
        { error: "ID do produto não fornecido" },
        { status: 400 }
      );
    }

    if (!quantity || quantity <= 0) {
      console.log("[TABLE_ADD_ITEM] ❌ quantidade inválida:", quantity);
      return NextResponse.json(
        { error: "Quantidade inválida" },
        { status: 400 }
      );
    }

    // Verificar se a mesa existe e está aberta
    const table = await prisma.clientTable.findUnique({
      where: { id: tableId },
      include: { Items: true },
    });

    console.log("[TABLE_ADD_ITEM] Mesa encontrada:", {
      exists: !!table,
      status: table?.status,
      customerId: table?.customerId,
      itemsCount: table?.Items?.length
    });

    if (!table) {
      console.log("[TABLE_ADD_ITEM] ❌ Mesa não encontrada");
      return NextResponse.json(
        { error: "Mesa não encontrada" },
        { status: 400 }
      );
    }

    if (table.customerId !== customerId) {
      console.log("[TABLE_ADD_ITEM] ❌ Mesa não pertence ao cliente:", {
        tableCustomerId: table.customerId,
        sessionCustomerId: customerId
      });
      return NextResponse.json(
        { error: "Mesa não pertence a você" },
        { status: 403 }
      );
    }

    if (table.status !== "OCCUPIED") {
      console.log("[TABLE_ADD_ITEM] ❌ Mesa não está ocupada, status:", table.status);
      return NextResponse.json(
        { error: `Mesa não está aberta (status: ${table.status})` },
        { status: 400 }
      );
    }

    // Verificar estoque (apenas para log, não bloqueia venda)
    const inventory = await prisma.clientInventory.findUnique({
      where: { productId },
    });

    console.log("[TABLE_ADD_ITEM] Estoque:", {
      exists: !!inventory,
      currentStock: inventory?.currentStock,
      requested: quantity,
      note: "Validação de estoque desabilitada para mesas/comandas"
    });

    // Adicionar item à mesa
    console.log("[TABLE_ADD_ITEM] Criando item...");
    const item = await prisma.clientTableItem.create({
      data: {
        customerId,
        tableId,
        productId,
        productName,
        quantity,
        unitPrice,
        totalPrice: quantity * unitPrice,
      },
    });

    console.log("[TABLE_ADD_ITEM] Item criado:", item.id);

    // Atualizar total da mesa
    const newTotal = table.Items.reduce((sum: number, item: any) => sum + item.totalPrice, 0) + (quantity * unitPrice);
    
    console.log("[TABLE_ADD_ITEM] Atualizando total da mesa:", {
      oldTotal: table.currentTotal,
      newTotal
    });
    
    await prisma.clientTable.update({
      where: { id: tableId },
      data: { currentTotal: newTotal },
    });

    console.log("[TABLE_ADD_ITEM] ✅ Sucesso!");

    return NextResponse.json({
      success: true,
      data: item,
    });
  } catch (error) {
    console.error("[TABLE_ADD_ITEM] ❌ ERRO:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao adicionar item à mesa" },
      { status: 500 }
    );
  }
}
