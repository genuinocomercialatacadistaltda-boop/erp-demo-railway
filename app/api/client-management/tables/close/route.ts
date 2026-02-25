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
    const { tableId, customerName, paymentMethod, bankAccountId, discount, subtotal, total } = body;

    // Buscar mesa com itens
    const table = await prisma.clientTable.findUnique({
      where: { id: tableId },
      include: { Items: true },
    });

    if (!table || table.status !== "OCCUPIED") {
      return NextResponse.json(
        { error: "Mesa não encontrada ou já foi fechada" },
        { status: 400 }
      );
    }

    if (table.Items.length === 0) {
      return NextResponse.json(
        { error: "Mesa sem itens" },
        { status: 400 }
      );
    }

    // Gerar número da venda
    const lastSale = await prisma.clientSale.findFirst({
      where: { customerId },
      orderBy: { createdAt: "desc" },
    });

    const saleNumber = `VENDA-${new Date().getFullYear()}-${String((lastSale ? parseInt(lastSale.saleNumber.split("-").pop() || "0") : 0) + 1).padStart(6, "0")}`;

    // Criar venda
    const sale = await prisma.clientSale.create({
      data: {
        customerId,
        saleNumber,
        tableId,
        customerName,
        subtotal,
        discount: discount || 0,
        total,
        paymentMethod,
        paymentStatus: "PAID",
        notes: `Mesa ${table.tableNumber}`,
        soldBy: session.user.name || session.user.email,
      },
    });

    // Transferir itens da mesa para venda e dar baixa no estoque
    for (const item of table.Items) {
      await prisma.clientSaleItem.create({
        data: {
          customerId,
          saleId: sale.id,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        },
      });

      // Atualizar estoque
      const inventory = await prisma.clientInventory.findUnique({
        where: { productId: item.productId },
      });

      if (inventory) {
        await prisma.clientInventory.update({
          where: { productId: item.productId },
          data: {
            currentStock: inventory.currentStock - item.quantity,
          },
        });

        // Registrar movimentação
        await prisma.clientInventoryMovement.create({
          data: {
            customerId,
            inventoryId: inventory.id,
            type: "EXIT",
            quantity: -item.quantity,
            reason: "SALE",
            referenceId: sale.id,
            notes: `Mesa ${table.tableNumber}`,
            performedBy: session.user.name || session.user.email,
          },
        });
      }
    }

    // Fechar mesa
    await prisma.clientTable.update({
      where: { id: tableId },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closedBy: session.user.name || session.user.email,
      },
    });

    // Se pago, criar transação na conta bancária
    if (bankAccountId) {
      const account = await prisma.clientBankAccount.findUnique({
        where: { id: bankAccountId },
      });

      if (account) {
        const newBalance = account.balance + total;

        await prisma.clientBankAccount.update({
          where: { id: bankAccountId },
          data: { balance: newBalance },
        });

        await prisma.clientTransaction.create({
          data: {
            customerId,
            bankAccountId,
            type: "INCOME",
            amount: total,
            description: `Venda ${saleNumber} - Mesa ${table.tableNumber}`,
            category: "SALE",
            referenceId: sale.id,
            referenceType: "SALE",
            balanceAfter: newBalance,
          },
        });
      }
    }

    const saleWithItems = await prisma.clientSale.findUnique({
      where: { id: sale.id },
      include: {
        Items: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: saleWithItems,
    });
  } catch (error) {
    console.error("[TABLE_CLOSE_POST] Error:", error);
    return NextResponse.json(
      { error: "Erro ao fechar mesa" },
      { status: 500 }
    );
  }
}
