import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { PrismaClient } from '@prisma/client';
import { authOptions } from '@/lib/auth-options';

const prisma = new PrismaClient();

// Listar pedidos do sub-cliente
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    // Verificar se sub-cliente pertence ao assador
    const subCliente = await prisma.clientCustomer.findFirst({
      where: {
        id: params.id,
        customerId: user.customerId,
      },
    });

    if (!subCliente) {
      return NextResponse.json(
        { success: false, message: 'Sub-cliente não encontrado' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const where: any = {
      clientCustomerId: params.id,
    };

    if (status) {
      where.status = status;
    }

    const orders = await prisma.clientCustomerOrder.findMany({
      where,
      include: {
        Items: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      orders,
    });
  } catch (error) {
    console.error('Get orders error:', error);
    return NextResponse.json(
      { success: false, message: 'Erro ao buscar pedidos' },
      { status: 500 }
    );
  }
}
