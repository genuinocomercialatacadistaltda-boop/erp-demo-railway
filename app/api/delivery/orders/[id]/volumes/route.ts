export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

/**
 * PUT /api/delivery/orders/[id]/volumes
 * Atualiza a quantidade de volumes de um pedido
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;
    console.log('[DELIVERY_VOLUMES_UPDATE] Iniciando atualização de volumes do pedido:', orderId);

    // Autenticação
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      console.log('[DELIVERY_VOLUMES_UPDATE] Sessão inválida');
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    const userType = (session.user as any)?.userType;
    const employeeId = (session.user as any)?.employeeId;

    // Verifica se é funcionário
    if (userType !== 'EMPLOYEE' && userType !== 'SELLER') {
      console.log('[DELIVERY_VOLUMES_UPDATE] Acesso negado - tipo de usuário inválido');
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      );
    }

    if (!employeeId) {
      console.log('[DELIVERY_VOLUMES_UPDATE] EmployeeId não encontrado na sessão');
      return NextResponse.json(
        { error: 'Funcionário não identificado' },
        { status: 400 }
      );
    }

    // Busca funcionário e verifica se é entregador
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, name: true, isDeliveryPerson: true }
    });

    if (!employee || !employee.isDeliveryPerson) {
      console.log('[DELIVERY_VOLUMES_UPDATE] Funcionário não é entregador');
      return NextResponse.json(
        { error: 'Acesso negado - Você não está configurado como entregador' },
        { status: 403 }
      );
    }

    console.log('[DELIVERY_VOLUMES_UPDATE] Entregador autorizado:', employee.name);

    // Lê o corpo da requisição
    const body = await request.json();
    const { volumes } = body;

    console.log('[DELIVERY_VOLUMES_UPDATE] Nova quantidade de volumes:', volumes);

    // Valida quantidade de volumes
    if (!volumes || volumes < 1 || volumes > 99) {
      console.log('[DELIVERY_VOLUMES_UPDATE] Quantidade inválida:', volumes);
      return NextResponse.json(
        { 
          error: 'Quantidade de volumes inválida. Deve ser entre 1 e 99.'
        },
        { status: 400 }
      );
    }

    // Busca o pedido
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        volumes: true
      }
    });

    if (!order) {
      console.log('[DELIVERY_VOLUMES_UPDATE] Pedido não encontrado:', orderId);
      return NextResponse.json(
        { error: 'Pedido não encontrado' },
        { status: 404 }
      );
    }

    console.log('[DELIVERY_VOLUMES_UPDATE] Volumes atual:', order.volumes);

    // Atualiza a quantidade de volumes do pedido
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { volumes: parseInt(volumes) }
    });

    console.log('[DELIVERY_VOLUMES_UPDATE] Volumes atualizado com sucesso:', {
      orderId,
      orderNumber: order.orderNumber,
      from: order.volumes,
      to: volumes
    });

    return NextResponse.json({
      success: true,
      order: {
        id: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        volumes: updatedOrder.volumes
      },
      message: `Pedido ${order.orderNumber} atualizado para ${volumes} volume(s)`
    });

  } catch (error) {
    console.error('[DELIVERY_VOLUMES_UPDATE] Erro ao atualizar volumes:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao atualizar quantidade de volumes',
        details: (error as Error).message
      },
      { status: 500 }
    );
  }
}
