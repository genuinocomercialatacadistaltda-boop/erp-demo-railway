export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { PrismaClient } from '@prisma/client';
import { authOptions } from '@/lib/auth-options';

const prisma = new PrismaClient();

// Atualizar status do pedido
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; orderId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    const user = session?.user as any;

    if (!user?.customerId) {
      return NextResponse.json(
        { success: false, message: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Verificar se pedido pertence ao assador
    const order = await prisma.clientCustomerOrder.findFirst({
      where: {
        id: params.orderId,
        clientCustomerId: params.id,
        customerId: user.customerId,
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, message: 'Pedido não encontrado' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { status, paymentStatus } = body;

    const data: any = {};
    if (status) data.status = status;
    if (paymentStatus) {
      data.paymentStatus = paymentStatus;
      if (paymentStatus === 'PAID') {
        data.paidAt = new Date();
      }
    }

    const updatedOrder = await prisma.clientCustomerOrder.update({
      where: { id: params.orderId },
      data,
      include: {
        Items: true,
      },
    });

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      message: 'Status atualizado com sucesso',
    });
  } catch (error) {
    console.error('Update order status error:', error);
    return NextResponse.json(
      { success: false, message: 'Erro ao atualizar status' },
      { status: 500 }
    );
  }
}
