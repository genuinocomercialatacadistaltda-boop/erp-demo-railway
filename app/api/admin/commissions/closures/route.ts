
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

/**
 * API para gerenciar fechamentos de comissões
 * GET /api/admin/commissions/closures - Lista fechamentos
 * PUT /api/admin/commissions/closures - Atualiza fechamento (pagar)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sellerId = searchParams.get('sellerId');
    const status = searchParams.get('status');
    const referenceMonth = searchParams.get('referenceMonth');

    const where: any = {};
    
    if (sellerId) where.sellerId = sellerId;
    if (status) where.status = status;
    if (referenceMonth) where.referenceMonth = referenceMonth;

    const closures = await prisma.commissionClosure.findMany({
      where,
      include: {
        Seller: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        Commissions: {
          select: {
            id: true,
            amount: true,
            description: true,
            createdAt: true,
          },
        },
      },
      orderBy: [
        { referenceMonth: 'desc' },
        { closedAt: 'desc' },
      ],
    });

    return NextResponse.json({ closures });
  } catch (error: any) {
    console.error('❌ Erro ao buscar fechamentos:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar fechamentos', details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { closureId, action, paymentMethod, notes } = body;

    if (!closureId || !action) {
      return NextResponse.json({ 
        error: 'closureId e action são obrigatórios' 
      }, { status: 400 });
    }

    const closure = await prisma.commissionClosure.findUnique({
      where: { id: closureId },
      include: {
        Seller: true,
        Commissions: true,
      },
    });

    if (!closure) {
      return NextResponse.json({ error: 'Fechamento não encontrado' }, { status: 404 });
    }

    // Função para obter data em Brasília
    const getBrasiliaDate = () => {
      const now = new Date();
      const brasiliaOffset = -3 * 60;
      const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
      return new Date(utcTime + (brasiliaOffset * 60000));
    };

    let updatedClosure;

    if (action === 'PAY') {
      if (closure.status === 'PAID') {
        return NextResponse.json({ 
          error: 'Fechamento já foi pago' 
        }, { status: 400 });
      }

      // Atualiza fechamento para PAID
      updatedClosure = await prisma.commissionClosure.update({
        where: { id: closureId },
        data: {
          status: 'PAID',
          paidAt: getBrasiliaDate(),
          paidBy: (session.user as any).id,
          paymentMethod: paymentMethod || 'Não informado',
          notes: notes,
        },
      });

      // Atualiza todas as comissões para PAID
      await prisma.commission.updateMany({
        where: { closureId: closureId },
        data: { status: 'PAID' },
      });

      console.log(`💰 Fechamento pago: ${closure.Seller.name} - R$ ${closure.totalAmount}`);
    } else if (action === 'CANCEL') {
      if (closure.status === 'PAID') {
        return NextResponse.json({ 
          error: 'Não é possível cancelar um fechamento já pago' 
        }, { status: 400 });
      }

      // Cancela o fechamento
      updatedClosure = await prisma.commissionClosure.update({
        where: { id: closureId },
        data: {
          status: 'CANCELLED',
          notes: notes || 'Cancelado',
        },
      });

      // Remove vínculo das comissões e volta status para PENDING
      await prisma.commission.updateMany({
        where: { closureId: closureId },
        data: {
          closureId: null,
          status: 'PENDING',
          releaseDate: null,
          releasedBy: null,
        },
      });

      console.log(`🚫 Fechamento cancelado: ${closure.Seller.name}`);
    } else {
      return NextResponse.json({ 
        error: 'Ação inválida. Use PAY ou CANCEL' 
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      closure: updatedClosure,
    });
  } catch (error: any) {
    console.error('❌ Erro ao atualizar fechamento:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar fechamento', details: error.message },
      { status: 500 }
    );
  }
}
