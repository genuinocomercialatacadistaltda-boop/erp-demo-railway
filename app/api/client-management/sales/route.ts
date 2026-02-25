
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

    const sales = await prisma.clientSale.findMany({
      where: { customerId },
      include: {
        Items: {
          include: {
            Product: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // Mapear os dados para o formato esperado pelo frontend
    const mappedSales = sales.map((sale) => ({
      ...sale,
      totalAmount: sale.total, // total → totalAmount
      finalAmount: sale.total - (sale.discount || 0), // calcular finalAmount
    }));

    return NextResponse.json({
      success: true,
      data: mappedSales,
    });
  } catch (error) {
    console.error("[CLIENT_SALES_GET] Error:", error);
    return NextResponse.json(
      { error: "Erro ao carregar vendas" },
      { status: 500 }
    );
  }
}

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

    console.log("[CLIENT_SALES_POST] Dados recebidos:", {
      isPaid: body.isPaid,
      paymentStatus: body.paymentStatus,
      linkedCustomerId: body.linkedCustomerId,
      bankAccountId: body.bankAccountId,
    });

    // Gerar número da venda
    const lastSale = await prisma.clientSale.findFirst({
      where: { customerId },
      orderBy: { createdAt: "desc" },
    });

    const saleNumber = `VENDA-${new Date().getFullYear()}-${String((lastSale ? parseInt(lastSale.saleNumber.split("-").pop() || "0") : 0) + 1).padStart(6, "0")}`;

    const sale = await prisma.clientSale.create({
      data: {
        customerId,
        saleNumber,
        tableId: body.tableId,
        customerName: body.customerName,
        subtotal: body.subtotal,
        discount: body.discount || 0,
        total: body.total,
        paymentMethod: body.paymentMethod,
        paymentStatus: body.paymentStatus || "PAID",
        isPaid: body.isPaid !== undefined ? body.isPaid : true,
        linkedCustomerId: body.linkedCustomerId || null,
        splitPayment: body.splitPayment || false,
        cashAmount: body.cashAmount,
        pixAmount: body.pixAmount,
        cardAmount: body.cardAmount,
        notes: body.notes,
        soldBy: session.user.name || session.user.email,
      },
    });

    // Criar itens da venda
    if (body.items && body.items.length > 0) {
      for (const item of body.items) {
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
              performedBy: session.user.name || session.user.email,
            },
          });
        }
      }
    }

    // Se pago, criar transação na conta bancária
    const isPaidNow = body.isPaid !== undefined ? body.isPaid : (body.paymentStatus === "PAID");
    
    console.log("[CLIENT_SALES_POST] Verificando se deve criar transação bancária:", {
      isPaidNow,
      hasBankAccountId: !!body.bankAccountId,
    });

    if (isPaidNow && body.bankAccountId) {
      console.log("[CLIENT_SALES_POST] ✅ Criando transação bancária");
      
      const account = await prisma.clientBankAccount.findUnique({
        where: { id: body.bankAccountId },
      });

      if (account) {
        const newBalance = account.balance + body.total;

        await prisma.clientBankAccount.update({
          where: { id: body.bankAccountId },
          data: { balance: newBalance },
        });

        await prisma.clientTransaction.create({
          data: {
            customerId,
            bankAccountId: body.bankAccountId,
            type: "INCOME",
            amount: body.total,
            description: `Venda ${saleNumber}${body.linkedCustomerId ? " (Paga)" : ""}`,
            category: "SALE",
            referenceId: sale.id,
            referenceType: "SALE",
            balanceAfter: newBalance,
          },
        });

        console.log("[CLIENT_SALES_POST] ✅ Saldo atualizado:", {
          oldBalance: account.balance,
          newBalance,
        });
      }
    } else {
      console.log("[CLIENT_SALES_POST] ⚠️ Venda não paga - não criando transação bancária");
    }

    // Se tinha mesa, fechar a mesa
    if (body.tableId) {
      await prisma.clientTable.update({
        where: { id: body.tableId },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
          closedBy: session.user.name || session.user.email,
        },
      });
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
    console.error("[CLIENT_SALES_POST] Error:", error);
    return NextResponse.json(
      { error: "Erro ao criar venda" },
      { status: 500 }
    );
  }
}
