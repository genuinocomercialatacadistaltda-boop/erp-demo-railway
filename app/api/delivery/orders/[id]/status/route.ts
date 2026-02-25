export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

/**
 * PUT /api/delivery/orders/[id]/status
 * Atualiza o status de um pedido individual
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;
    console.log('[DELIVERY_STATUS_UPDATE] Iniciando atualização de status do pedido:', orderId);

    // Autenticação
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      console.log('[DELIVERY_STATUS_UPDATE] Sessão inválida');
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    const userType = (session.user as any)?.userType;
    const employeeId = (session.user as any)?.employeeId;

    // ✅ ADMIN tem acesso total
    if (userType === 'ADMIN') {
      console.log('[DELIVERY_STATUS_UPDATE] Admin autorizado - acesso total');
    } else {
      // Verifica se é funcionário
      if (userType !== 'EMPLOYEE' && userType !== 'SELLER') {
        console.log('[DELIVERY_STATUS_UPDATE] Acesso negado - tipo de usuário inválido');
        return NextResponse.json(
          { error: 'Acesso negado' },
          { status: 403 }
        );
      }

      if (!employeeId) {
        console.log('[DELIVERY_STATUS_UPDATE] EmployeeId não encontrado na sessão');
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
        console.log('[DELIVERY_STATUS_UPDATE] Funcionário não é entregador');
        return NextResponse.json(
          { error: 'Acesso negado - Você não está configurado como entregador' },
          { status: 403 }
        );
      }

      console.log('[DELIVERY_STATUS_UPDATE] Entregador autorizado:', employee.name);
    }

    // Lê o corpo da requisição
    const body = await request.json();
    const { status } = body;

    console.log('[DELIVERY_STATUS_UPDATE] Novo status solicitado:', status);

    // Valida status permitido para entregador
    const allowedStatuses = ['READY', 'DELIVERING', 'DELIVERED'];
    if (!status || !allowedStatuses.includes(status)) {
      console.log('[DELIVERY_STATUS_UPDATE] Status inválido:', status);
      return NextResponse.json(
        { 
          error: 'Status inválido',
          allowed: allowedStatuses
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
        status: true,
        deliveryType: true
      }
    });

    if (!order) {
      console.log('[DELIVERY_STATUS_UPDATE] Pedido não encontrado:', orderId);
      return NextResponse.json(
        { error: 'Pedido não encontrado' },
        { status: 404 }
      );
    }

    console.log('[DELIVERY_STATUS_UPDATE] Status atual do pedido:', order.status);

    // Valida transição de status (ADMIN pode pular validação)
    const validTransitions: Record<string, string[]> = {
      'CONFIRMED': ['READY'],
      'READY': ['DELIVERING', 'DELIVERED'], // DELIVERED direto se for retirada
      'DELIVERING': ['DELIVERED']
    };

    const currentStatus = order.status;
    const allowedNext = validTransitions[currentStatus] || [];

    // ✅ ADMIN pode mudar para qualquer status sem restrição
    if (userType !== 'ADMIN' && !allowedNext.includes(status)) {
      console.log('[DELIVERY_STATUS_UPDATE] Transição inválida:', { from: currentStatus, to: status });
      return NextResponse.json(
        { 
          error: 'Transição de status inválida',
          currentStatus,
          requestedStatus: status,
          allowedNext
        },
        { status: 400 }
      );
    }

    // Atualiza o status do pedido
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status }
    });

    console.log('[DELIVERY_STATUS_UPDATE] Status atualizado com sucesso:', {
      orderId,
      orderNumber: order.orderNumber,
      from: currentStatus,
      to: status
    });

    return NextResponse.json({
      success: true,
      order: {
        id: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        status: updatedOrder.status
      },
      message: `Pedido ${order.orderNumber} atualizado para ${status}`
    });

  } catch (error) {
    console.error('[DELIVERY_STATUS_UPDATE] Erro ao atualizar status:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao atualizar status do pedido',
        details: (error as Error).message
      },
      { status: 500 }
    );
  }
}
