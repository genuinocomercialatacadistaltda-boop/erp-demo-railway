export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

/**
 * GET /api/delivery/report
 * Gera relatório de entregas do dia
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[DELIVERY_REPORT] Iniciando geração de relatório');

    // Autenticação
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      console.log('[DELIVERY_REPORT] Sessão inválida');
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    const userType = (session.user as any)?.userType;
    const employeeId = (session.user as any)?.employeeId;

    // Permite acesso para ADMIN (visualização) ou EMPLOYEE/SELLER que sejam entregadores
    let employeeInfo: { id: string; name: string } | null = null;

    if (userType === 'ADMIN') {
      console.log('[DELIVERY_REPORT] Admin autorizado - modo visualização');
      employeeInfo = { id: 'admin', name: 'Administrador' };
    } else {
      // Verifica se é funcionário
      if (userType !== 'EMPLOYEE' && userType !== 'SELLER') {
        console.log('[DELIVERY_REPORT] Acesso negado - tipo de usuário inválido');
        return NextResponse.json(
          { error: 'Acesso negado' },
          { status: 403 }
        );
      }

      if (!employeeId) {
        console.log('[DELIVERY_REPORT] EmployeeId não encontrado na sessão');
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
        console.log('[DELIVERY_REPORT] Funcionário não é entregador');
        return NextResponse.json(
          { error: 'Acesso negado - Você não está configurado como entregador' },
          { status: 403 }
        );
      }

      console.log('[DELIVERY_REPORT] Entregador autorizado:', employee.name);
      employeeInfo = { id: employee.id, name: employee.name };
    }

    // Obtém parâmetros da query
    const searchParams = request.nextUrl.searchParams;
    const dateParam = searchParams.get('date'); // Formato: YYYY-MM-DD

    // Define data do filtro (hoje se não especificado)
    const filterDate = dateParam ? new Date(dateParam) : new Date();
    const year = filterDate.getFullYear();
    const month = filterDate.getMonth();
    const day = filterDate.getDate();

    // Início e fim do dia
    const startOfDay = new Date(year, month, day, 0, 0, 0, 0);
    const endOfDay = new Date(year, month, day, 23, 59, 59, 999);

    console.log('[DELIVERY_REPORT] Gerando relatório do dia:', filterDate.toISOString().split('T')[0]);

    // Busca todos os pedidos do dia (incluindo entregues)
    const allOrders = await prisma.order.findMany({
      where: {
        deliveryDate: {
          gte: startOfDay,
          lte: endOfDay
        },
        status: {
          in: ['CONFIRMED', 'READY', 'DELIVERING', 'DELIVERED']
        }
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        deliveryType: true,
        total: true,
        deliveryTime: true,
        customerName: true,
        Customer: {
          select: {
            name: true
          }
        }
      }
    });

    console.log('[DELIVERY_REPORT] Total de pedidos encontrados:', allOrders.length);

    // Agrupa por status
    const byStatus = {
      confirmed: allOrders.filter(o => o.status === 'CONFIRMED'),
      ready: allOrders.filter(o => o.status === 'READY'),
      delivering: allOrders.filter(o => o.status === 'DELIVERING'),
      delivered: allOrders.filter(o => o.status === 'DELIVERED')
    };

    // Agrupa por tipo de entrega
    const byDeliveryType = {
      delivery: allOrders.filter(o => o.deliveryType === 'DELIVERY'),
      pickup: allOrders.filter(o => o.deliveryType === 'PICKUP')
    };

    // Calcula estatísticas
    const totalOrders = allOrders.length;
    const deliveredOrders = byStatus.delivered.length;
    const pendingOrders = totalOrders - deliveredOrders;
    const deliveryRate = totalOrders > 0 ? ((deliveredOrders / totalOrders) * 100).toFixed(1) : '0.0';

    // Valor total entregue
    const totalRevenue = byStatus.delivered.reduce((sum, order) => sum + order.total, 0);

    console.log('[DELIVERY_REPORT] Pedidos entregues:', deliveredOrders);
    console.log('[DELIVERY_REPORT] Pedidos pendentes:', pendingOrders);
    console.log('[DELIVERY_REPORT] Taxa de entrega:', deliveryRate + '%');

    const report = {
      date: filterDate.toISOString().split('T')[0],
      employee: employeeInfo,
      summary: {
        total: totalOrders,
        delivered: deliveredOrders,
        pending: pendingOrders,
        deliveryRate: parseFloat(deliveryRate),
        totalRevenue
      },
      byStatus: {
        confirmed: byStatus.confirmed.length,
        ready: byStatus.ready.length,
        delivering: byStatus.delivering.length,
        delivered: byStatus.delivered.length
      },
      byDeliveryType: {
        delivery: byDeliveryType.delivery.length,
        pickup: byDeliveryType.pickup.length
      },
      details: {
        confirmed: byStatus.confirmed.map(o => ({
          orderNumber: o.orderNumber,
          customerName: o.Customer?.name || o.customerName,
          total: o.total,
          deliveryTime: o.deliveryTime,
          deliveryType: o.deliveryType
        })),
        ready: byStatus.ready.map(o => ({
          orderNumber: o.orderNumber,
          customerName: o.Customer?.name || o.customerName,
          total: o.total,
          deliveryTime: o.deliveryTime,
          deliveryType: o.deliveryType
        })),
        delivering: byStatus.delivering.map(o => ({
          orderNumber: o.orderNumber,
          customerName: o.Customer?.name || o.customerName,
          total: o.total,
          deliveryTime: o.deliveryTime,
          deliveryType: o.deliveryType
        })),
        delivered: byStatus.delivered.map(o => ({
          orderNumber: o.orderNumber,
          customerName: o.Customer?.name || o.customerName,
          total: o.total,
          deliveryTime: o.deliveryTime,
          deliveryType: o.deliveryType
        }))
      }
    };

    return NextResponse.json(report);

  } catch (error) {
    console.error('[DELIVERY_REPORT] Erro ao gerar relatório:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao gerar relatório',
        details: (error as Error).message
      },
      { status: 500 }
    );
  }
}
