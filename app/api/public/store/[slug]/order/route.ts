import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * API Pública - Criar Pedido
 * POST: Cria um novo pedido de cliente final
 */

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const body = await request.json();
    const { clientCustomerId, items, notes, paymentMethod } = body;

    if (!clientCustomerId || !items || items.length === 0) {
      return NextResponse.json(
        { error: "Dados inválidos" },
        { status: 400 }
      );
    }

    // Buscar cliente principal pelo slug
    const customer = await prisma.customer.findUnique({
      where: { storeSlug: slug },
    });

    if (!customer || !customer.isActive) {
      return NextResponse.json(
        { error: "Loja não encontrada" },
        { status: 404 }
      );
    }

    // Verificar se o cliente final pertence ao cliente principal
    const clientCustomer = await prisma.clientCustomer.findFirst({
      where: {
        id: clientCustomerId,
        customerId: customer.id,
        isActive: true,
      },
    });

    if (!clientCustomer) {
      return NextResponse.json(
        { error: "Cliente não encontrado" },
        { status: 404 }
      );
    }

    // Calcular total do pedido
    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      // Buscar produto
      const product = await prisma.clientProduct.findFirst({
        where: {
          id: item.productId,
          customerId: customer.id,
          isActive: true,
          showInPublicCatalog: true,
        },
        include: {
          Inventory: true,
        },
      });

      if (!product) {
        return NextResponse.json(
          { error: `Produto ${item.productId} não encontrado` },
          { status: 400 }
        );
      }

      // ✅ REMOVIDO: Não há controle de estoque para clientes finais
      // Os pedidos são aceitos independente do estoque disponível

      const subtotal = product.unitPrice * item.quantity;
      totalAmount += subtotal;

      orderItems.push({
        productName: product.name,
        productImage: product.imageUrl,
        quantity: item.quantity,
        unitPrice: product.unitPrice,
        subtotal,
        notes: item.notes || null,
      });
    }

    // Criar pedido
    const order = await prisma.clientCustomerOrder.create({
      data: {
        customerId: customer.id,
        clientCustomerId: clientCustomer.id,
        orderNumber: `SUB-${Date.now()}`,
        subtotal: totalAmount,
        discount: 0,
        total: totalAmount,
        deliveryFee: 0,
        paymentStatus: "PAID",
        paymentMethod: paymentMethod || "DINHEIRO",
        deliveryNotes: notes || null,
        pointsEarned: 0, // Será calculado e atualizado abaixo
        pointsUsed: 0,
        Items: {
          create: orderItems,
        },
      },
      include: {
        Items: true,
      },
    });

    // Calcular pontos (1 ponto por R$ 1 gasto)
    const pointsEarned = Math.floor(
      totalAmount * clientCustomer.pointsMultiplier
    );

    // Atualizar pontos do cliente final e do pedido
    await prisma.$transaction([
      prisma.clientCustomer.update({
        where: { id: clientCustomer.id },
        data: {
          pointsBalance: clientCustomer.pointsBalance + pointsEarned,
          totalPointsEarned: clientCustomer.totalPointsEarned + pointsEarned,
        },
      }),
      prisma.clientCustomerOrder.update({
        where: { id: order.id },
        data: { pointsEarned }
      })
    ]);

    // Criar transação de pontos
    if (pointsEarned > 0) {
      const newBalance = clientCustomer.pointsBalance + pointsEarned;
      await prisma.clientCustomerPointTransaction.create({
        data: {
          clientCustomerId: clientCustomer.id,
          customerId: customer.id,
          amount: pointsEarned,
          balance: newBalance,
          type: "EARNED",
          description: `Compra no valor de R$ ${totalAmount.toFixed(2)}`,
          orderId: order.id
        },
      });
    }

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        total: order.total,
        paymentStatus: order.paymentStatus,
        Items: order.Items,
        pointsEarned,
      },
    });
  } catch (error) {
    console.error("[CREATE_ORDER_ERROR]", error);
    return NextResponse.json(
      { error: "Erro ao criar pedido" },
      { status: 500 }
    );
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}
