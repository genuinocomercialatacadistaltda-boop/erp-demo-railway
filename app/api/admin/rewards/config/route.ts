
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET - Obter configuração atual de pontos
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    let config = await prisma.rewardConfig.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });

    // Se não existe configuração, criar uma padrão
    if (!config) {
      config = await prisma.rewardConfig.create({
        data: {
          pointsPerReal: 1.0,
          isActive: true,
          updatedBy: (session.user as any).email || undefined
        }
      });
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error('Erro ao buscar configuração de pontos:', error);
    return NextResponse.json({ error: 'Erro ao buscar configuração' }, { status: 500 });
  }
}

// PUT - Atualizar configuração de pontos
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { pointsPerReal } = body;

    if (typeof pointsPerReal !== 'number' || pointsPerReal < 0) {
      return NextResponse.json({ error: 'Valor inválido para pontos por real' }, { status: 400 });
    }

    // Desativar configurações antigas
    await prisma.rewardConfig.updateMany({
      where: { isActive: true },
      data: { isActive: false }
    });

    // Criar nova configuração
    const config = await prisma.rewardConfig.create({
      data: {
        pointsPerReal,
        isActive: true,
        updatedBy: (session.user as any).email || undefined
      }
    });

    return NextResponse.json(config);
  } catch (error) {
    console.error('Erro ao atualizar configuração de pontos:', error);
    return NextResponse.json({ error: 'Erro ao atualizar configuração' }, { status: 500 });
  }
}
