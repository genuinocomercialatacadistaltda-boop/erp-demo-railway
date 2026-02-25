export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

/**
 * PUT /api/delivery/orders/batch-status
 * Atualiza o status de múltiplos pedidos em lote
 */
export async function PUT(request: NextRequest) {
  try {
    console.log('[DELIVERY_BATCH_STATUS] Iniciando atualização em lote');

    // Autenticação
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      console.log('[DELIVERY_BATCH_STATUS] Sessão inválida');
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    const userType = (session.user as any)?.userType;
    const employeeId = (session.user as any)?.employeeId;

    // Verifica se é funcionário
    if (userType !== 'EMPLOYEE' && userType !== 'SELLER') {
      console.log('[DELIVERY_BATCH_STATUS] Acesso negado - tipo de usuário inválido');
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      );
    }

    if (!employeeId) {
      console.log('[DELIVERY_BATCH_STATUS] EmployeeId não encontrado na sessão');
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
      console.log('[DELIVERY_BATCH_STATUS] Funcionário não é entregador');
      return NextResponse.json(
        { error: 'Acesso negado - Você não está configurado como entregador' },
        { status: 403 }
      );
    }

    console.log('[DELIVERY_BATCH_STATUS] Entregador autorizado:', employee.name);

    // Lê o corpo da requisição
    const body = await request.json();
    const { orderIds, status } = body;

    console.log('[DELIVERY_BATCH_STATUS] Pedidos para atualizar:', orderIds?.length || 0);
    console.log('[DELIVERY_BATCH_STATUS] Novo status:', status);

    // Valida entrada
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      console.log('[DELIVERY_BATCH_STATUS] Lista de pedidos inválida');
      return NextResponse.json(
        { error: 'Lista de pedidos inválida' },
        { status: 400 }
      );
    }

    // Valida status permitido
    const allowedStatuses = ['READY', 'DELIVERING', 'DELIVERED'];
    if (!status || !allowedStatuses.includes(status)) {
      console.log('[DELIVERY_BATCH_STATUS] Status inválido:', status);
      return NextResponse.json(
        { 
          error: 'Status inválido',
          allowed: allowedStatuses
        },
        { status: 400 }
      );
    }

    // Busca todos os pedidos para validar
    const orders = await prisma.order.findMany({
      where: {
        id: { in: orderIds }
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        deliveryType: true
      }
    });

    console.log('[DELIVERY_BATCH_STATUS] Pedidos encontrados:', orders.length);

    if (orders.length === 0) {
      console.log('[DELIVERY_BATCH_STATUS] Nenhum pedido encontrado');
      return NextResponse.json(
        { error: 'Nenhum pedido encontrado' },
        { status: 404 }
      );
    }

    // Valida transições de status
    const validTransitions: Record<string, string[]> = {
      'CONFIRMED': ['READY'],
      'READY': ['DELIVERING', 'DELIVERED'],
      'DELIVERING': ['DELIVERED']
    };

    const invalidOrders: any[] = [];
    const validOrders: any[] = [];

    orders.forEach(order => {
      const allowedNext = validTransitions[order.status] || [];
      if (!allowedNext.includes(status)) {
        invalidOrders.push({
          id: order.id,
          orderNumber: order.orderNumber,
          currentStatus: order.status,
          reason: `Não é possível mudar de ${order.status} para ${status}`
        });
      } else {
        validOrders.push(order);
      }
    });

    console.log('[DELIVERY_BATCH_STATUS] Pedidos válidos:', validOrders.length);
    console.log('[DELIVERY_BATCH_STATUS] Pedidos inválidos:', invalidOrders.length);

    // Se não houver pedidos válidos, retorna erro
    if (validOrders.length === 0) {
      console.log('[DELIVERY_BATCH_STATUS] Nenhum pedido pode ser atualizado');
      return NextResponse.json(
        { 
          error: 'Nenhum pedido pode ser atualizado',
          invalidOrders
        },
        { status: 400 }
      );
    }

    // Atualiza pedidos válidos
    const validOrderIds = validOrders.map(o => o.id);
    await prisma.order.updateMany({
      where: {
        id: { in: validOrderIds }
      },
      data: { status }
    });

    console.log('[DELIVERY_BATCH_STATUS] Status atualizado com sucesso para', validOrders.length, 'pedidos');

    return NextResponse.json({
      success: true,
      updated: validOrders.length,
      failed: invalidOrders.length,
      validOrders: validOrders.map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        previousStatus: o.status,
        newStatus: status
      })),
      invalidOrders,
      message: `${validOrders.length} pedido(s) atualizado(s) para ${status}`
    });

  } catch (error) {
    console.error('[DELIVERY_BATCH_STATUS] Erro ao atualizar status em lote:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao atualizar status dos pedidos',
        details: (error as Error).message
      },
      { status: 500 }
    );
  }
}
