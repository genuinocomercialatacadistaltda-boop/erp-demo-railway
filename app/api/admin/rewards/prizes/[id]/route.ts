
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET - Obter detalhes de um brinde específico
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const prize = await prisma.prize.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: { Redemption: true }
        }
      }
    });

    if (!prize) {
      return NextResponse.json({ error: 'Brinde não encontrado' }, { status: 404 });
    }

    return NextResponse.json(prize);
  } catch (error) {
    console.error('Erro ao buscar brinde:', error);
    return NextResponse.json({ error: 'Erro ao buscar brinde' }, { status: 500 });
  }
}

// PUT - Atualizar brinde
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
    const { 
      name, 
      description, 
      imageUrl, 
      cloudStoragePath,
      pointsCost, 
      stockQuantity, 
      isActive, 
      category,
      displayOrder 
    } = body;

    const prize = await prisma.prize.update({
      where: { id: params.id },
      data: {
        name: name || undefined,
        description: description !== undefined ? description : undefined,
        imageUrl: cloudStoragePath !== undefined ? cloudStoragePath : (imageUrl !== undefined ? imageUrl : undefined),
        pointsCost: pointsCost ? parseInt(pointsCost) : undefined,
        stockQuantity: stockQuantity !== undefined ? (stockQuantity ? parseInt(stockQuantity) : null) : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
        category: category !== undefined ? category : undefined,
        displayOrder: displayOrder !== undefined ? parseInt(displayOrder) : undefined
      }
    });

    return NextResponse.json(prize);
  } catch (error) {
    console.error('Erro ao atualizar brinde:', error);
    return NextResponse.json({ error: 'Erro ao atualizar brinde' }, { status: 500 });
  }
}

// DELETE - Deletar brinde
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Verificar se existem resgates pendentes
    const pendingRedemptions = await prisma.redemption.count({
      where: { 
        prizeId: params.id,
        status: { in: ['PENDING', 'APPROVED'] }
      }
    });

    if (pendingRedemptions > 0) {
      return NextResponse.json({ 
        error: 'Não é possível deletar brinde com resgates pendentes ou aprovados' 
      }, { status: 400 });
    }

    await prisma.prize.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ message: 'Brinde deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar brinde:', error);
    return NextResponse.json({ error: 'Erro ao deletar brinde' }, { status: 500 });
  }
}
