
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || (session.user as any).role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Buscar boletos em atraso do cliente
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdueBoletos = await prisma.boleto.findMany({
      where: {
        customerId: (session.user as any).id,
        status: 'PENDING',
        dueDate: {
          lt: today,
        },
      },
      orderBy: {
        dueDate: 'asc',
      },
    });

    if (overdueBoletos.length === 0) {
      return NextResponse.json({
        success: true,
        hasOverdue: false,
      });
    }

    // Calcular total em atraso e dias
    const totalOverdue = overdueBoletos.reduce((sum: number, boleto: any) => sum + boleto.amount, 0);
    const oldestDueDate = overdueBoletos[0].dueDate;
    const daysOverdue = Math.floor(
      (today.getTime() - new Date(oldestDueDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Verificar se já existe uma notificação recente (últimas 24 horas)
    const recentNotification = await prisma.notification.findFirst({
      where: {
        targetUserId: (session.user as any).id,
        type: 'SYSTEM',
        category: 'BOLETO',
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });

    let notificationCreated = false;

    if (!recentNotification) {
      await prisma.notification.create({
        data: {
          id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          targetUserId: (session.user as any).id,
          targetRole: 'CUSTOMER',
          type: 'SYSTEM',
          category: 'BOLETO',
          title: 'Você possui pagamentos em atraso',
          message: `Você possui ${overdueBoletos.length} boleto(s) em atraso, totalizando R$ ${totalOverdue.toFixed(2)}. O pagamento mais antigo está atrasado há ${daysOverdue} dias. Por favor, regularize sua situação para continuar comprando.`,
        },
      });
      notificationCreated = true;
    }

    return NextResponse.json({
      success: true,
      hasOverdue: true,
      overdueBoletos: overdueBoletos.length,
      totalAmount: totalOverdue,
      daysOverdue,
      notificationCreated,
    });
  } catch (error) {
    console.error('Erro ao verificar pagamentos em atraso:', error);
    return NextResponse.json(
      { error: 'Erro ao verificar pagamentos em atraso' },
      { status: 500 }
    );
  }
}
