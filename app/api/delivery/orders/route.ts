import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

/**
 * GET /api/delivery/orders
 * Lista pedidos para o entregador, filtrados por dia e tipo de entrega (DELIVERY/PICKUP)
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[DELIVERY_ORDERS_GET] Iniciando busca de pedidos para entregador');

    // Autenticação
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      console.log('[DELIVERY_ORDERS_GET] Sessão inválida');
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    const userType = (session.user as any)?.userType;
    const employeeId = (session.user as any)?.employeeId;

    console.log('[DELIVERY_ORDERS_GET] UserType:', userType, 'EmployeeId:', employeeId);

    // Permite acesso para ADMIN (visualização) ou EMPLOYEE/SELLER que sejam entregadores
    if (userType === 'ADMIN') {
      console.log('[DELIVERY_ORDERS_GET] Admin autorizado - modo visualização');
    } else {
      // Verifica se é funcionário ou vendedor (que também pode ser entregador)
      if (userType !== 'EMPLOYEE' && userType !== 'SELLER') {
        console.log('[DELIVERY_ORDERS_GET] Acesso negado - tipo de usuário inválido');
        return NextResponse.json(
          { error: 'Acesso negado' },
          { status: 403 }
        );
      }

      if (!employeeId) {
        console.log('[DELIVERY_ORDERS_GET] EmployeeId não encontrado na sessão');
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
        console.log('[DELIVERY_ORDERS_GET] Funcionário não encontrado:', employeeId);
        return NextResponse.json(
          { error: 'Funcionário não encontrado' },
          { status: 404 }
        );
      }

      if (!employee.isDeliveryPerson) {
        console.log('[DELIVERY_ORDERS_GET] Funcionário não é entregador:', employeeId);
        return NextResponse.json(
          { error: 'Acesso negado - Você não está configurado como entregador' },
          { status: 403 }
        );
      }

      console.log('[DELIVERY_ORDERS_GET] Entregador autorizado:', employee.name);
    }

    // Obtém parâmetros da query
    const searchParams = request.nextUrl.searchParams;
    const dateParam = searchParams.get('date'); // Formato: YYYY-MM-DD

    // Define data do filtro (hoje se não especificado)
    let filterDateStr: string;
    if (dateParam) {
      filterDateStr = dateParam;
    } else {
      const today = new Date();
      filterDateStr = today.toISOString().split('T')[0];
    }

    // Cria datas em UTC para comparação consistente
    // O banco armazena deliveryDate como DATE, que é comparado sem considerar hora
    // Então precisamos criar um range que cubra todo o dia em UTC
    const startOfDay = new Date(filterDateStr + 'T00:00:00.000Z');
    const endOfDay = new Date(filterDateStr + 'T23:59:59.999Z');

    console.log('[DELIVERY_ORDERS_GET] Filtrando pedidos do dia:', {
      date: filterDateStr,
      startOfDay: startOfDay.toISOString(),
      endOfDay: endOfDay.toISOString()
    });

    // Busca pedidos confirmados do dia
    // Status: CONFIRMED (atendente confirmou), READY (entregador marcou pronto), DELIVERING (saiu para entrega), DELIVERED (já entregue)
    // ⚠️ IMPORTANTE: Exclui pedidos com deliveryType NULL (vendas de balcão, CONSUMIDOR FINAL)
    const orders = await prisma.order.findMany({
      where: {
        deliveryDate: {
          gte: startOfDay,
          lte: endOfDay
        },
        status: {
          in: ['CONFIRMED', 'READY', 'DELIVERING', 'DELIVERED']
        },
        deliveryType: {
          not: null // ✅ Exclui pedidos de CONSUMIDOR FINAL (deliveryType NULL)
        }
      },
      include: {
        Customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
            city: true
          }
        },
        OrderItem: {
          include: {
            Product: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: [
        { deliveryOrder: 'asc' }, // Prioriza ordem definida pelo entregador
        { createdAt: 'asc' } // Depois por ordem de criação
      ]
    });

    console.log('[DELIVERY_ORDERS_GET] Total de pedidos encontrados:', orders.length);

    // Separa pedidos por tipo de entrega
    const deliveryOrders = orders.filter(order => order.deliveryType === 'DELIVERY');
    const pickupOrders = orders.filter(order => order.deliveryType === 'PICKUP');

    console.log('[DELIVERY_ORDERS_GET] Pedidos para entrega:', deliveryOrders.length);
    console.log('[DELIVERY_ORDERS_GET] Pedidos para retirada:', pickupOrders.length);

    // Formata resposta
    const response: any = {
      date: filterDateStr,
      summary: {
        total: orders.length,
        delivery: deliveryOrders.length,
        pickup: pickupOrders.length,
        byStatus: {
          confirmed: orders.filter(o => o.status === 'CONFIRMED').length,
          ready: orders.filter(o => o.status === 'READY').length,
          delivering: orders.filter(o => o.status === 'DELIVERING').length
        }
      },
      delivery: deliveryOrders.map(order => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.Customer?.name || order.customerName || 'Cliente',
        casualCustomerName: order.casualCustomerName || null, // 🆕 Nome do cliente avulso
        customerPhone: order.Customer?.phone || order.customerPhone,
        address: order.address || order.Customer?.address,
        city: order.city || order.Customer?.city,
        deliveryTime: order.deliveryTime,
        status: order.status,
        deliveryOrder: order.deliveryOrder,
        total: order.total,
        items: order.OrderItem.map((item: any) => ({
          id: item.id,
          productName: item.Product?.name || 'Produto',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
          isChecked: item.isChecked || false
        })),
        notes: order.notes
      })),
      pickup: pickupOrders.map(order => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.Customer?.name || order.customerName || 'Cliente',
        casualCustomerName: order.casualCustomerName || null, // 🆕 Nome do cliente avulso
        customerPhone: order.Customer?.phone || order.customerPhone,
        deliveryTime: order.deliveryTime,
        status: order.status,
        deliveryOrder: order.deliveryOrder,
        total: order.total,
        items: order.OrderItem.map((item: any) => ({
          id: item.id,
          productName: item.Product?.name || 'Produto',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
          isChecked: item.isChecked || false
        })),
        notes: order.notes
      }))
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[DELIVERY_ORDERS_GET] Erro ao buscar pedidos:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao buscar pedidos',
        details: (error as Error).message
      },
      { status: 500 }
    );
  }
}
