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
    const { groupedItems, subtotal, discount, total, paymentMethod, paymentStatus, bankAccountId, customerName, notes } = body;

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
        customerName,
        subtotal,
        discount: discount || 0,
        total,
        paymentMethod,
        paymentStatus: paymentStatus || "PAID",
        notes: notes + " [VENDA AGRUPADA]",
        soldBy: session.user.name || session.user.email,
      },
    });

    // Processar agrupamento por categoria
    for (const item of groupedItems) {
      const { productCategory, quantity, averagePrice } = item;

      // Buscar produtos desta categoria
      const categoryProducts = await prisma.clientProduct.findMany({
        where: {
          customerId,
          category: productCategory,
          isActive: true,
        },
        include: {
          Inventory: true,
        },
      });

      if (categoryProducts.length === 0) continue;

      // Criar um produto genérico ou usar existente
      let genericProduct = categoryProducts.find((p: any) => p.name.toLowerCase().includes("mix") || p.name.toLowerCase().includes("genérico"));

      if (!genericProduct) {
        // Criar produto genérico para esta categoria
        const newGenericProduct = await prisma.clientProduct.create({
          data: {
            customerId,
            name: `${productCategory} (Mix)`,
            category: productCategory,
            unitPrice: averagePrice,
            trackInventory: true,
            isActive: true,
          },
        });

        // Criar registro de estoque genérico
        await prisma.clientInventory.create({
          data: {
            customerId,
            productId: newGenericProduct.id,
            currentStock: 0,
            minStock: 0,
          },
        });

        // Buscar o produto recém-criado com Inventory
        const productWithInventory = await prisma.clientProduct.findUnique({
          where: { id: newGenericProduct.id },
          include: { Inventory: true },
        });

        if (!productWithInventory) {
          throw new Error("Erro ao criar produto genérico");
        }

        genericProduct = productWithInventory;
      }

      // Somar estoque atual de todos produtos da categoria
      let totalCategoryStock = 0;
      for (const product of categoryProducts) {
        if (product.Inventory) {
          totalCategoryStock += product.Inventory.currentStock;
        }
      }

      // Criar item de venda genérico
      await prisma.clientSaleItem.create({
        data: {
          customerId,
          saleId: sale.id,
          productId: genericProduct.id,
          productName: genericProduct.name,
          quantity,
          unitPrice: averagePrice,
          totalPrice: quantity * averagePrice,
        },
      });

      // AGRUPAMENTO AUTOMÁTICO:
      // 1. Transferir todo estoque detalhado para o genérico
      // 2. Zerar produtos individuais
      // 3. Dar baixa no genérico

      const genericInventory = await prisma.clientInventory.findUnique({
        where: { productId: genericProduct.id },
      });

      if (genericInventory) {
        // Atualizar estoque genérico com o total da categoria
        await prisma.clientInventory.update({
          where: { productId: genericProduct.id },
          data: {
            currentStock: totalCategoryStock - quantity, // Já descontando a venda
          },
        });

        // Registrar movimentação de agrupamento
        await prisma.clientInventoryMovement.create({
          data: {
            customerId,
            inventoryId: genericInventory.id,
            type: "ADJUSTMENT",
            quantity: totalCategoryStock - quantity,
            reason: "GROUPING",
            referenceId: sale.id,
            notes: `Agrupamento automático: ${totalCategoryStock} → ${totalCategoryStock - quantity}`,
            performedBy: session.user.name || session.user.email || "Sistema",
          },
        });

        // Zerar produtos individuais da categoria
        for (const product of categoryProducts) {
          if (product.id !== genericProduct.id && product.Inventory) {
            const oldStock = product.Inventory.currentStock;
            
            await prisma.clientInventory.update({
              where: { id: product.Inventory.id },
              data: {
                currentStock: 0,
              },
            });

            // Registrar movimentação de zeramento
            await prisma.clientInventoryMovement.create({
              data: {
                customerId,
                inventoryId: product.Inventory.id,
                type: "ADJUSTMENT",
                quantity: -oldStock,
                reason: "GROUPING",
                referenceId: sale.id,
                notes: `Zerado por agrupamento para ${genericProduct.name}`,
                performedBy: session.user.name || session.user.email || "Sistema",
              },
            });
          }
        }
      }
    }

    // Se pago, criar transação na conta bancária
    if (paymentStatus === "PAID" && bankAccountId) {
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
            description: `Venda Agrupada ${saleNumber}`,
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
      message: "Venda registrada e estoque agrupado automaticamente",
    });
  } catch (error) {
    console.error("[CLIENT_SALES_GROUPED_POST] Error:", error);
    return NextResponse.json(
      { error: "Erro ao registrar venda agrupada" },
      { status: 500 }
    );
  }
}
