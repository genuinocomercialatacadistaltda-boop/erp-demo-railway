export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

/**
 * PUT /api/delivery/orders/[id]/delivery-type
 * Atualiza o tipo de entrega de um pedido (DELIVERY ou PICKUP)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('[DELIVERY_TYPE_UPDATE] Iniciando atualização de tipo de entrega');

    // Autenticação
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      console.log('[DELIVERY_TYPE_UPDATE] Sessão inválida');
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    const userType = (session.user as any)?.userType;
    const employeeId = (session.user as any)?.employeeId;

    console.log('[DELIVERY_TYPE_UPDATE] UserType:', userType, 'EmployeeId:', employeeId);

    // Permite acesso para ADMIN ou EMPLOYEE/SELLER que sejam entregadores
    if (userType === 'ADMIN') {
      console.log('[DELIVERY_TYPE_UPDATE] Admin autorizado');
    } else {
      // Verifica se é funcionário ou vendedor (que também pode ser entregador)
      if (userType !== 'EMPLOYEE' && userType !== 'SELLER') {
        console.log('[DELIVERY_TYPE_UPDATE] Acesso negado - tipo de usuário inválido');
        return NextResponse.json(
          { error: 'Acesso negado' },
          { status: 403 }
        );
      }

      if (!employeeId) {
        console.log('[DELIVERY_TYPE_UPDATE] EmployeeId não encontrado na sessão');
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

      if (!employee) {
        console.log('[DELIVERY_TYPE_UPDATE] Funcionário não encontrado:', employeeId);
        return NextResponse.json(
          { error: 'Funcionário não encontrado' },
          { status: 404 }
        );
      }

      if (!employee.isDeliveryPerson) {
        console.log('[DELIVERY_TYPE_UPDATE] Funcionário não é entregador:', employeeId);
        return NextResponse.json(
          { error: 'Acesso negado - Você não está configurado como entregador' },
          { status: 403 }
        );
      }

      console.log('[DELIVERY_TYPE_UPDATE] Entregador autorizado:', employee.name);
    }

    // Obtém o ID do pedido
    const orderId = params.id;

    // Busca o pedido
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        deliveryType: true,
        customerName: true,
        status: true
      }
    });

    if (!order) {
      console.log('[DELIVERY_TYPE_UPDATE] Pedido não encontrado:', orderId);
      return NextResponse.json(
        { error: 'Pedido não encontrado' },
        { status: 404 }
      );
    }

    console.log('[DELIVERY_TYPE_UPDATE] Pedido encontrado:', {
      orderNumber: order.orderNumber,
      currentDeliveryType: order.deliveryType,
      customer: order.customerName
    });

    // Lê o corpo da requisição
    const body = await request.json();
    const { deliveryType } = body;

    console.log('[DELIVERY_TYPE_UPDATE] Novo tipo de entrega:', deliveryType);

    // Valida o tipo de entrega
    if (!deliveryType || !['DELIVERY', 'PICKUP'].includes(deliveryType)) {
      console.log('[DELIVERY_TYPE_UPDATE] Tipo de entrega inválido:', deliveryType);
      return NextResponse.json(
        { error: 'Tipo de entrega inválido. Use DELIVERY ou PICKUP' },
        { status: 400 }
      );
    }

    // Atualiza o tipo de entrega
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        deliveryType: deliveryType,
        updatedAt: new Date()
      },
      select: {
        id: true,
        orderNumber: true,
        deliveryType: true,
        customerName: true,
        status: true
      }
    });

    console.log('[DELIVERY_TYPE_UPDATE] Tipo de entrega atualizado:', {
      orderNumber: updatedOrder.orderNumber,
      oldType: order.deliveryType,
      newType: updatedOrder.deliveryType
    });

    return NextResponse.json({
      success: true,
      message: `Tipo de entrega alterado para ${deliveryType === 'DELIVERY' ? 'Entrega' : 'Retirada'}`,
      order: {
        id: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        deliveryType: updatedOrder.deliveryType,
        customerName: updatedOrder.customerName,
        status: updatedOrder.status
      }
    });

  } catch (error) {
    console.error('[DELIVERY_TYPE_UPDATE] Erro ao atualizar tipo de entrega:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao atualizar tipo de entrega',
        details: (error as Error).message
      },
      { status: 500 }
    );
  }
}
