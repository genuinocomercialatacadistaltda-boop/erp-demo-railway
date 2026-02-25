export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyClientCustomerToken } from '@/lib/client-customer-auth';

const prisma = new PrismaClient();

// Buscar pedido específico
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const order = await prisma.clientCustomerOrder.findFirst({
      where: {
        id: params.id,
        clientCustomerId: session.id,
      },
      include: {
        Items: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, message: 'Pedido não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      order,
    });
  } catch (error) {
    console.error('Get order error:', error);
    return NextResponse.json(
      { success: false, message: 'Erro ao buscar pedido' },
      { status: 500 }
    );
  }
}
