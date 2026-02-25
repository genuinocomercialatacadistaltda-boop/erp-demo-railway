
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

// GET - Buscar uma venda específica
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).userType !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Acesso negado" },
        { status: 401 }
      );
    }

    const customerId = (session.user as any).customerId;
    const sale = await prisma.clientSale.findFirst({
      where: {
        id: params.id,
        customerId,
      },
      include: {
        Items: {
          include: {
            Product: true,
          },
        },
      },
    });

    if (!sale) {
      return NextResponse.json(
        { error: "Venda não encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: sale,
    });
  } catch (error) {
    console.error("[SALE_GET] Error:", error);
    return NextResponse.json(
      { error: "Erro ao carregar venda" },
      { status: 500 }
    );
  }
}

// PUT - Atualizar uma venda
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).userType !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Acesso negado" },
        { status: 401 }
      );
    }

    const customerId = (session.user as any).customerId;
    
    // Verificar se a venda existe e pertence ao cliente
    const existingSale = await prisma.clientSale.findFirst({
      where: {
        id: params.id,
        customerId,
      },
      include: {
        Items: true,
      },
    });

    if (!existingSale) {
      return NextResponse.json(
        { error: "Venda não encontrada" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const {
      totalAmount,
      discount,
      finalAmount,
      isPaid,
      paymentMethod,
      wasteQuantity,
      wasteNotes,
      items,
    } = body;

    // Atualizar a venda e seus itens
    const updatedSale = await prisma.$transaction(async (tx: any) => {
      // 1. Excluir itens antigos
      await tx.clientSaleItem.deleteMany({
        where: { saleId: params.id },
      });

      // 2. Atualizar a venda
      const sale = await tx.clientSale.update({
        where: { id: params.id },
        data: {
          totalAmount,
          discount: discount || 0,
          finalAmount,
          isPaid,
          paymentMethod: paymentMethod || null,
          wasteQuantity: wasteQuantity || null,
        wasteNotes: wasteNotes || null,
        },
        include: {
          Items: {
            include: {
              Product: true,
            },
          },
        },
      });

      // 3. Criar novos itens
      if (items && items.length > 0) {
        await tx.clientSaleItem.createMany({
          data: items.map((item: any) => ({
            id: crypto.randomUUID(),
            saleId: params.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          })),
        });
      }

      return sale;
    });

    return NextResponse.json({
      success: true,
      data: updatedSale,
      message: "Venda atualizada com sucesso!",
    });
  } catch (error) {
    console.error("[SALE_UPDATE] Error:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar venda" },
      { status: 500 }
    );
  }
}

// DELETE - Excluir uma venda
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).userType !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Acesso negado" },
        { status: 401 }
      );
    }

    const customerId = (session.user as any).customerId;
    
    // Verificar se a venda existe e pertence ao cliente
    const existingSale = await prisma.clientSale.findFirst({
      where: {
        id: params.id,
        customerId,
      },
    });

    if (!existingSale) {
      return NextResponse.json(
        { error: "Venda não encontrada" },
        { status: 404 }
      );
    }

    console.log(`[SALE_DELETE] Excluindo venda ${existingSale.saleNumber}`);
    console.log(`[SALE_DELETE] Valor da venda: R$ ${existingSale.total}`);
    console.log(`[SALE_DELETE] Status de pagamento: ${existingSale.paymentStatus}`);

    // Excluir a venda e seus itens (cascade delete)
    await prisma.$transaction(async (tx: any) => {
      // 1. Se a venda estava paga, reverter a transação bancária
      if (existingSale.paymentStatus === "PAID") {
        // Buscar a transação bancária associada
        const transaction = await tx.clientTransaction.findFirst({
          where: {
            customerId,
            referenceId: params.id,
            referenceType: "SALE",
            type: "INCOME",
          },
        });

        if (transaction && transaction.bankAccountId) {
          console.log(`[SALE_DELETE] Transação encontrada! ID: ${transaction.id}`);
          console.log(`[SALE_DELETE] Conta bancária ID: ${transaction.bankAccountId}`);
          console.log(`[SALE_DELETE] Valor a reverter: R$ ${transaction.amount}`);

          // Buscar conta bancária
          const account = await tx.clientBankAccount.findUnique({
            where: { id: transaction.bankAccountId },
          });

          if (account) {
            const oldBalance = account.balance;
            const newBalance = account.balance - transaction.amount;
            
            console.log(`[SALE_DELETE] Saldo anterior: R$ ${oldBalance}`);
            console.log(`[SALE_DELETE] Novo saldo: R$ ${newBalance}`);

            // Atualizar saldo da conta
            await tx.clientBankAccount.update({
              where: { id: transaction.bankAccountId },
              data: { balance: newBalance },
            });

            // Excluir a transação
            await tx.clientTransaction.delete({
              where: { id: transaction.id },
            });

            console.log(`[SALE_DELETE] ✅ Saldo da conta revertido com sucesso!`);
          }
        } else {
          console.log(`[SALE_DELETE] ⚠️ Transação bancária não encontrada para esta venda`);
        }
      }

      // 2. ✅ NOVO: Reverter estoque dos produtos vendidos
      console.log(`[SALE_DELETE] 📦 Revertendo estoque...`);

      // Buscar os itens da venda
      const saleItems = await tx.clientSaleItem.findMany({
        where: { saleId: params.id },
        include: { Product: true }
      });

      console.log(`[SALE_DELETE] Encontrados ${saleItems.length} item(ns) para reverter estoque`);

      // Reverter estoque de cada item
      for (const item of saleItems) {
        // Buscar estoque do produto
        const inventory = await tx.clientInventory.findFirst({
          where: {
            customerId,
            productId: item.productId
          }
        });

        if (inventory) {
          const estoqueAtual = inventory.currentStock;
          const novoEstoque = estoqueAtual + item.quantity;
          
          console.log(`[SALE_DELETE]    ${item.Product.name}: ${estoqueAtual} + ${item.quantity} = ${novoEstoque}`);

          // Incrementar estoque (reversão)
          await tx.clientInventory.update({
            where: { id: inventory.id },
            data: {
              currentStock: novoEstoque
            }
          });

          // Criar movimentação de entrada (reversão)
          await tx.clientInventoryMovement.create({
            data: {
              customerId,
              inventoryId: inventory.id,
              type: 'ENTRY',
              quantity: item.quantity,
              reason: 'SALE_DELETION',
              referenceId: params.id,
              notes: `Reversão automática - venda ${existingSale.saleNumber} excluída`,
              performedBy: session.user?.name || session.user?.email || 'SYSTEM'
            }
          });

          console.log(`[SALE_DELETE]    ✅ Estoque revertido`);
        } else {
          console.log(`[SALE_DELETE]    ⚠️ Estoque não encontrado para ${item.Product.name}`);
        }
      }

      console.log(`[SALE_DELETE] ✅ Estoque revertido completamente!`);

      // 3. Excluir itens da venda
      await tx.clientSaleItem.deleteMany({
        where: { saleId: params.id },
      });

      // 4. Excluir a venda
      await tx.clientSale.delete({
        where: { id: params.id },
      });

      console.log(`[SALE_DELETE] ✅ Venda excluída completamente!`);
    });

    return NextResponse.json({
      success: true,
      message: "Venda excluída com sucesso!",
    });
  } catch (error) {
    console.error("[SALE_DELETE] Error:", error);
    return NextResponse.json(
      { error: "Erro ao excluir venda" },
      { status: 500 }
    );
  }
}
