import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyClientCustomerToken } from '@/lib/client-customer-auth';

const prisma = new PrismaClient();

// Listar pedidos
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('client-customer-token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Não autenticado' },
        { status: 401 }
      );
    }

    const { valid, session } = await verifyClientCustomerToken(token);

    if (!valid || !session) {
      return NextResponse.json(
        { success: false, message: 'Sessão inválida' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');

    const skip = (page - 1) * limit;

    const where: any = {
      clientCustomerId: session.id,
    };

    if (status) {
      where.status = status;
    }

    const [orders, total] = await Promise.all([
      prisma.clientCustomerOrder.findMany({
        where,
        include: {
          Items: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.clientCustomerOrder.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get orders error:', error);
    return NextResponse.json(
      { success: false, message: 'Erro ao buscar pedidos' },
      { status: 500 }
    );
  }
}

// Criar novo pedido
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('client-customer-token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Não autenticado' },
        { status: 401 }
      );
    }

    const { valid, session } = await verifyClientCustomerToken(token);

    if (!valid || !session) {
      return NextResponse.json(
        { success: false, message: 'Sessão inválida' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      items,
      deliveryAddress,
      deliveryNotes,
      deliveryFee = 0,
      paymentMethod,
      usePoints = false,
      pointsToUse = 0,
    } = body;

    if (!items || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Nenhum item no pedido' },
        { status: 400 }
      );
    }

    // Buscar cliente para verificar pontos
    const clientCustomer = await prisma.clientCustomer.findUnique({
      where: { id: session.id },
    });

    if (!clientCustomer) {
      return NextResponse.json(
        { success: false, message: 'Cliente não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se tem pontos suficientes
    if (usePoints && pointsToUse > clientCustomer.pointsBalance) {
      return NextResponse.json(
        { success: false, message: 'Pontos insuficientes' },
        { status: 400 }
      );
    }

    // Calcular valores
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const catalogItem = await prisma.clientCustomerCatalogItem.findFirst({
        where: {
          id: item.catalogItemId,
          clientCustomerId: session.id,
          isAvailable: true,
        },
      });

      if (!catalogItem) {
        return NextResponse.json(
          { success: false, message: `Item ${item.catalogItemId} não disponível` },
          { status: 400 }
        );
      }

      const price = catalogItem.customPrice || catalogItem.defaultPrice;
      const itemSubtotal = price * item.quantity;
      subtotal += itemSubtotal;

      orderItems.push({
        productName: catalogItem.productName,
        productImage: catalogItem.productImage,
        quantity: item.quantity,
        unitPrice: price,
        subtotal: itemSubtotal,
        notes: item.notes,
      });
    }

    // Aplicar desconto de pontos (R$ 1 = 1 ponto)
    const discount = usePoints ? Math.min(pointsToUse, subtotal) : 0;
    const total = subtotal - discount + deliveryFee;

    // Calcular pontos ganhos (1% do valor)
    const pointsEarned = Math.floor(total * 0.01 * clientCustomer.pointsMultiplier);

    // Gerar número do pedido
    const orderNumber = `SUB-${Date.now()}`;

    // Criar pedido
    const order = await prisma.clientCustomerOrder.create({
      data: {
        orderNumber,
        clientCustomerId: session.id,
        customerId: session.customerId,
        subtotal,
        discount,
        total,
        deliveryAddress,
        deliveryNotes,
        deliveryFee,
        paymentMethod,
        pointsEarned,
        pointsUsed: discount,
        Items: {
          create: orderItems,
        },
      },
      include: {
        Items: true,
      },
    });

    // Atualizar pontos do cliente
    const newPointsBalance = clientCustomer.pointsBalance - discount + pointsEarned;

    await prisma.clientCustomer.update({
      where: { id: session.id },
      data: {
        pointsBalance: newPointsBalance,
        totalPointsEarned: clientCustomer.totalPointsEarned + pointsEarned,
      },
    });

    // Registrar transações de pontos
    if (discount > 0) {
      await prisma.clientCustomerPointTransaction.create({
        data: {
          clientCustomerId: session.id,
          customerId: session.customerId,
          type: 'REDEEMED',
          amount: -discount,
          balance: clientCustomer.pointsBalance - discount,
          description: `Resgate de ${discount} pontos no pedido ${orderNumber}`,
          orderId: order.id,
        },
      });
    }

    if (pointsEarned > 0) {
      await prisma.clientCustomerPointTransaction.create({
        data: {
          clientCustomerId: session.id,
          customerId: session.customerId,
          type: 'EARNED',
          amount: pointsEarned,
          balance: newPointsBalance,
          description: `Ganhou ${pointsEarned} pontos no pedido ${orderNumber}`,
          orderId: order.id,
        },
      });
    }

    return NextResponse.json({
      success: true,
      order,
      message: 'Pedido criado com sucesso',
    });
  } catch (error) {
    console.error('Create order error:', error);
    return NextResponse.json(
      { success: false, message: 'Erro ao criar pedido' },
      { status: 500 }
    );
  }
}
