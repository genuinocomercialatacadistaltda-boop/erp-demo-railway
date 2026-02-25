
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// PUT - Aprovar/Rejeitar/Entregar resgate
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { action, notes, rejectionReason } = body;

    if (!['approve', 'reject', 'deliver', 'cancel'].includes(action)) {
      return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
    }

    const redemption = await prisma.redemption.findUnique({
      where: { id: params.id },
      include: { Customer: true, Prize: true }
    });

    if (!redemption) {
      return NextResponse.json({ error: 'Resgate não encontrado' }, { status: 404 });
    }

    let newStatus: any;
    let updateCustomer = false;
    let pointsToReturn = 0;

    switch (action) {
      case 'approve':
        if (redemption.status !== 'PENDING') {
          return NextResponse.json({ error: 'Apenas resgates pendentes podem ser aprovados' }, { status: 400 });
        }
        newStatus = 'APPROVED';
        
        // Verificar estoque
        if (redemption.Prize.stockQuantity !== null && redemption.Prize.stockQuantity < 1) {
          return NextResponse.json({ error: 'Brinde sem estoque' }, { status: 400 });
        }
        break;

      case 'reject':
        if (redemption.status !== 'PENDING' && redemption.status !== 'APPROVED') {
          return NextResponse.json({ error: 'Apenas resgates pendentes ou aprovados podem ser rejeitados' }, { status: 400 });
        }
        newStatus = 'REJECTED';
        updateCustomer = true;
        pointsToReturn = redemption.pointsUsed;
        break;

      case 'deliver':
        if (redemption.status !== 'APPROVED') {
          return NextResponse.json({ error: 'Apenas resgates aprovados podem ser marcados como entregues' }, { status: 400 });
        }
        newStatus = 'DELIVERED';
        break;

      case 'cancel':
        if (redemption.status === 'DELIVERED') {
          return NextResponse.json({ error: 'Resgates entregues não podem ser cancelados' }, { status: 400 });
        }
        newStatus = 'CANCELLED';
        updateCustomer = true;
        pointsToReturn = redemption.pointsUsed;
        break;
    }

    // Atualizar resgate
    const updatedRedemption = await prisma.redemption.update({
      where: { id: params.id },
      data: {
        status: newStatus,
        processedAt: new Date(),
        processedBy: (session.user as any).email || undefined,
        notes: notes || undefined,
        rejectionReason: action === 'reject' ? rejectionReason : undefined
      },
      include: {
        Customer: true,
        Prize: true
      }
    });

    // Devolver pontos se rejeitado/cancelado
    if (updateCustomer && pointsToReturn > 0) {
      await prisma.$transaction([
        prisma.customer.update({
          where: { id: redemption.customerId },
          data: {
            pointsBalance: { increment: pointsToReturn },
            totalPointsRedeemed: { decrement: pointsToReturn }
          }
        }),
        prisma.pointTransaction.create({
          data: {
            customerId: redemption.customerId,
            type: 'MANUAL_ADJUSTMENT',
            points: pointsToReturn,
            multiplierApplied: 1.0,
            description: `Devolução de pontos - Resgate ${action === 'reject' ? 'rejeitado' : 'cancelado'}: ${redemption.Prize.name}`
          }
        })
      ]);
    }

    // Atualizar estoque se aprovado
    if (action === 'approve' && redemption.Prize.stockQuantity !== null) {
      await prisma.prize.update({
        where: { id: redemption.prizeId },
        data: { stockQuantity: { decrement: 1 } }
      });
    }

    // Devolver estoque se cancelado após aprovação
    if ((action === 'reject' || action === 'cancel') && redemption.status === 'APPROVED' && redemption.Prize.stockQuantity !== null) {
      await prisma.prize.update({
        where: { id: redemption.prizeId },
        data: { stockQuantity: { increment: 1 } }
      });
    }

    return NextResponse.json(updatedRedemption);
  } catch (error) {
    console.error('Erro ao processar resgate:', error);
    return NextResponse.json({ error: 'Erro ao processar resgate' }, { status: 500 });
  }
}
