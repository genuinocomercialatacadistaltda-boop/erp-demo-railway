export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getImageUrl } from '@/lib/s3';

// GET - Listar brindes disponíveis para resgate
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !(session.user as any).customerId) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Obter saldo do cliente
    const customer = await prisma.customer.findUnique({
      where: { id: (session.user as any).customerId },
      select: { pointsBalance: true }
    });

    if (!customer) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    // Listar brindes ativos com estoque
    const prizes = await prisma.prize.findMany({
      where: {
        isActive: true,
        OR: [
          { stockQuantity: { gt: 0 } },
          { stockQuantity: null }
        ]
      },
      orderBy: [
        { displayOrder: 'asc' },
        { pointsCost: 'asc' }
      ]
    });

    // Gerar URLs assinadas para as imagens e adicionar flag se cliente pode resgatar
    const prizesWithAvailability = await Promise.all(
      prizes.map(async (prize: any) => {
        let imageUrl = prize.imageUrl;
        
        // Gerar URL assinada do S3 se a imagem estiver no cloud storage
        if (imageUrl) {
          try {
            imageUrl = await getImageUrl(imageUrl);
          } catch (error) {
            console.error(`Erro ao gerar URL assinada para brinde ${prize.id}:`, error);
          }
        }

        return {
          ...prize,
          imageUrl,
          canRedeem: customer.pointsBalance >= prize.pointsCost,
          pointsNeeded: Math.max(0, prize.pointsCost - customer.pointsBalance)
        };
      })
    );

    return NextResponse.json({
      prizes: prizesWithAvailability,
      customerBalance: customer.pointsBalance
    });
  } catch (error) {
    console.error('Erro ao buscar brindes:', error);
    return NextResponse.json({ error: 'Erro ao buscar brindes' }, { status: 500 });
  }
}
