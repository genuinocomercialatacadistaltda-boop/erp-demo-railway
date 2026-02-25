
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Buscar todos os clientes com boletos em atraso
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdueClients = await prisma.boleto.findMany({
      where: {
        status: 'PENDING',
        dueDate: {
          lt: today,
        },
      },
      include: {
        Order: {
          include: {
            Customer: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    // Agrupar boletos por cliente
    const clientsMap = new Map();

    overdueClients.forEach((boleto: any) => {
      const customer = boleto.Order?.Customer;
      if (!customer) return;

      if (!clientsMap.has(customer.id)) {
        clientsMap.set(customer.id, {
          customer,
          boletos: [],
          totalOverdue: 0,
          oldestDueDate: boleto.dueDate,
        });
      }

      const clientData = clientsMap.get(customer.id);
      clientData.boletos.push(boleto);
      clientData.totalOverdue += boleto.amount;
      if (boleto.dueDate < clientData.oldestDueDate) {
        clientData.oldestDueDate = boleto.dueDate;
      }
    });

    // Criar notificações para cada cliente em atraso
    let createdCount = 0;

    for (const [customerId, data] of clientsMap.entries()) {
      const daysOverdue = Math.floor(
        (today.getTime() - new Date(data.oldestDueDate).getTime()) / (1000 * 60 * 60 * 24)
      );

      // Verificar se já existe uma notificação recente (últimas 24 horas) com a mesma mensagem
      const messageContent = `${data.customer.name} possui ${data.boletos.length} boleto(s) em atraso, totalizando R$ ${data.totalOverdue.toFixed(2)}. Há ${daysOverdue} dias em atraso.`;
      
      const recentNotification = await prisma.notification.findFirst({
        where: {
          targetUserId: (session.user as any).id,
          type: 'SYSTEM',
          category: 'CUSTOMER_ALERT',
          message: {
            contains: data.customer.name
          },
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      });

      if (!recentNotification) {
        await prisma.notification.create({
          data: {
            id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            targetUserId: null,
            targetRole: null,
            type: 'SYSTEM',
            category: 'CUSTOMER_ALERT',
            title: 'Cliente com Pagamento em Atraso',
            message: messageContent,
          },
        });
        createdCount++;
      }
    }

    return NextResponse.json({
      success: true,
      overdueClientsCount: clientsMap.size,
      notificationsCreated: createdCount,
    });
  } catch (error) {
    console.error('Erro ao verificar clientes em atraso:', error);
    return NextResponse.json(
      { error: 'Erro ao verificar clientes em atraso' },
      { status: 500 }
    );
  }
}
