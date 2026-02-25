export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

// GET - Listar registros de desperdício do cliente
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const customerId = (session?.user as any)?.customerId;
    
    if (!customerId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const where: any = { customerId };

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    // Temporariamente desabilitado - modelo WasteRecord não existe
    // const wasteRecords = await prisma.wasteRecord.findMany({
    //   where,
    //   include: {
    //     Product: true,
    //   },
    //   orderBy: {
    //     createdAt: "desc",
    //   },
    // });

    return NextResponse.json([]);
  } catch (error) {
    console.error("❌ Erro ao buscar registros de desperdício:", error);
    return NextResponse.json(
      { error: "Erro ao buscar registros de desperdício" },
      { status: 500 }
    );
  }
}

// POST - Criar novo registro de desperdício
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const customerId = (session?.user as any)?.customerId;
    
    if (!customerId) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const body = await request.json();
    const { productId, quantity, approximateValue, reason, notes } = body;

    // Validações
    if (!productId || !quantity || quantity <= 0) {
      return NextResponse.json(
        { error: "Produto e quantidade são obrigatórios" },
        { status: 400 }
      );
    }

    // Buscar informações do produto
    const product = await prisma.clientProduct.findFirst({
      where: {
        id: productId,
        customerId,
      },
      include: {
        Inventory: true,
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
    }

    // Temporariamente desabilitado - modelo WasteRecord não existe
    return NextResponse.json(
      { error: "Recurso temporariamente indisponível" },
      { status: 503 }
    );

    /*
    // Criar registro de desperdício e dar baixa no estoque em uma transação
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Criar registro de desperdício
      const wasteRecord = await tx.wasteRecord.create({
        data: {
          customerId,
          productId,
          productName: product.name,
          quantity: parseInt(quantity.toString()),
          approximateValue: parseFloat(approximateValue || product.costPrice || product.unitPrice || 0),
          reason: reason || null,
          notes: notes || null,
        },
        include: {
          Product: true,
        },
      });

      // Dar baixa no estoque (se o produto tiver controle de estoque)
      if (product.trackInventory && product.Inventory) {
        const newStock = product.Inventory.currentStock - quantity;
        
        await tx.clientInventory.update({
          where: { id: product.Inventory.id },
          data: { currentStock: Math.max(0, newStock) },
        });

        // Registrar movimento de estoque
        await tx.clientInventoryMovement.create({
          data: {
            customerId,
            productId,
            type: "OUT",
            quantity: -quantity,
            description: `Desperdício registrado: ${reason || "Sem motivo especificado"}`,
            referenceType: "WASTE",
            referenceId: wasteRecord.id,
          },
        });

        console.log(`✅ Baixa de estoque: ${product.name} - ${quantity} unidades`);
        console.log(`📦 Novo estoque: ${newStock}`);
      }

      return wasteRecord;
    });

    return NextResponse.json(result, { status: 201 });
    */
  } catch (error) {
    console.error("❌ Erro ao criar registro de desperdício:", error);
    return NextResponse.json(
      { error: "Erro ao criar registro de desperdício" },
      { status: 500 }
    );
  }
}
