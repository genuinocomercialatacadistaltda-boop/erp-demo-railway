
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

/**
 * API para vendedor visualizar suas comissões mensais
 * GET /api/sellers/commissions/monthly
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).userType !== 'SELLER') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Busca o vendedor associado ao usuário
    const seller = await prisma.seller.findFirst({
      where: {
        User: {
          id: (session.user as any).id,
        },
      },
    });

    if (!seller) {
      return NextResponse.json({ error: 'Vendedor não encontrado' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '12'); // Últimos 12 meses por padrão

    // Busca fechamentos mensais (exclui cancelados)
    const closures = await prisma.commissionClosure.findMany({
      where: {
        sellerId: seller.id,
        status: {
          not: 'CANCELLED', // Não mostra fechamentos cancelados
        },
      },
      include: {
        Commissions: {
          select: {
            id: true,
            amount: true,
            description: true,
            orderId: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
      orderBy: {
        referenceMonth: 'desc',
      },
      take: limit,
    });

    // Busca comissões ainda não fechadas (do mês atual)
    const getBrasiliaDate = () => {
      const now = new Date();
      const brasiliaOffset = -3 * 60;
      const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
      return new Date(utcTime + (brasiliaOffset * 60000));
    };

    const brasiliaDate = getBrasiliaDate();
    const currentYear = brasiliaDate.getFullYear();
    const currentMonth = brasiliaDate.getMonth();
    
    const startOfCurrentMonth = new Date(Date.UTC(currentYear, currentMonth, 1, 3, 0, 0));
    const endOfCurrentMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 1, 2, 59, 59));

    console.log('🔍 Buscando comissões pendentes para o vendedor:', {
      sellerId: seller.id,
      sellerName: seller.name,
      startOfCurrentMonth,
      endOfCurrentMonth,
      currentMonthRef: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`
    });

    // Primeiro, busca TODAS as comissões do vendedor para debug
    const allSellerCommissions = await prisma.commission.findMany({
      where: {
        sellerId: seller.id,
      },
      select: {
        id: true,
        amount: true,
        description: true,
        orderId: true,
        createdAt: true,
        closureId: true,
      },
    });

    console.log('📊 Total de comissões do vendedor:', allSellerCommissions.length);
    console.log('💰 Comissões do vendedor:', allSellerCommissions.map(c => ({
      id: c.id,
      amount: c.amount,
      description: c.description,
      createdAt: c.createdAt,
      closureId: c.closureId,
      hasClosureId: c.closureId !== null
    })));

    const pendingCommissions = await prisma.commission.findMany({
      where: {
        sellerId: seller.id,
        closureId: null,
        createdAt: {
          gte: startOfCurrentMonth,
          lte: endOfCurrentMonth,
        },
      },
      select: {
        id: true,
        amount: true,
        description: true,
        orderId: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log('✅ Comissões pendentes encontradas:', pendingCommissions.length);
    console.log('💸 Detalhes das comissões pendentes:', pendingCommissions);

    const currentMonthRef = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const pendingTotal = pendingCommissions.reduce((sum, c) => sum + c.amount, 0);

    // Formata resposta
    const monthlyData = [
      // Mês atual (pendente)
      ...(pendingCommissions.length > 0 ? [{
        referenceMonth: currentMonthRef,
        totalAmount: pendingTotal,
        status: 'PENDING' as const,
        commissionsCount: pendingCommissions.length,
        commissions: pendingCommissions,
        paidAt: null,
        paymentMethod: null,
      }] : []),
      // Fechamentos anteriores
      ...closures.map(closure => ({
        referenceMonth: closure.referenceMonth,
        totalAmount: closure.totalAmount,
        status: closure.status,
        commissionsCount: closure.Commissions.length,
        commissions: closure.Commissions,
        closedAt: closure.closedAt,
        paidAt: closure.paidAt,
        paymentMethod: closure.paymentMethod,
        notes: closure.notes,
      })),
    ];

    return NextResponse.json({
      seller: {
        id: seller.id,
        name: seller.name,
        commissionRate: seller.commissionRate,
      },
      monthlyCommissions: monthlyData,
    });
  } catch (error: any) {
    console.error('❌ Erro ao buscar comissões mensais:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar comissões mensais', details: error.message },
      { status: 500 }
    );
  }
}
