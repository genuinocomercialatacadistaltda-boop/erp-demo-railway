export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

/**
 * PUT /api/delivery/orders/route-order
 * Atualiza a ordem de entrega de múltiplos pedidos
 */
export async function PUT(request: NextRequest) {
  try {
    console.log('[DELIVERY_ROUTE_ORDER] Iniciando atualização de ordem de rota');

    // Autenticação
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      console.log('[DELIVERY_ROUTE_ORDER] Sessão inválida');
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    const userType = (session.user as any)?.userType;
    const employeeId = (session.user as any)?.employeeId;

    // Verifica se é funcionário
    if (userType !== 'EMPLOYEE' && userType !== 'SELLER') {
      console.log('[DELIVERY_ROUTE_ORDER] Acesso negado - tipo de usuário inválido');
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      );
    }

    if (!employeeId) {
      console.log('[DELIVERY_ROUTE_ORDER] EmployeeId não encontrado na sessão');
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
      console.log('[DELIVERY_ROUTE_ORDER] Funcionário não é entregador');
      return NextResponse.json(
        { error: 'Acesso negado - Você não está configurado como entregador' },
        { status: 403 }
      );
    }

    console.log('[DELIVERY_ROUTE_ORDER] Entregador autorizado:', employee.name);

    // Lê o corpo da requisição
    const body = await request.json();
    const { orders } = body; // Array de { id, deliveryOrder }

    console.log('[DELIVERY_ROUTE_ORDER] Atualizando ordem de:', orders.length, 'pedidos');

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return NextResponse.json(
        { error: 'Lista de pedidos inválida' },
        { status: 400 }
      );
    }

    // Atualiza a ordem de entrega de cada pedido
    const updatePromises = orders.map((order: any) =>
      prisma.order.update({
        where: { id: order.id },
        data: { deliveryOrder: order.deliveryOrder }
      })
    );

    await Promise.all(updatePromises);

    console.log('[DELIVERY_ROUTE_ORDER] Ordem de rota atualizada com sucesso');

    return NextResponse.json({
      success: true,
      message: `Ordem de rota atualizada para ${orders.length} pedidos`,
      updatedCount: orders.length
    });

  } catch (error) {
    console.error('[DELIVERY_ROUTE_ORDER] Erro ao atualizar ordem de rota:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao atualizar ordem de rota',
        details: (error as Error).message
      },
      { status: 500 }
    );
  }
}
