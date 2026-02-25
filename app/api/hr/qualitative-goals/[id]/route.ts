export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET - Buscar meta qualitativa por ID
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const goal = await prisma.qualitativeGoal.findUnique({
      where: { id: params.id },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            position: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true
          }
        },
        evaluations: {
          orderBy: { date: 'desc' },
          include: {
            evaluator: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    if (!goal) {
      return NextResponse.json({ error: 'Meta não encontrada' }, { status: 404 });
    }

    return NextResponse.json(goal);
  } catch (error) {
    console.error('Erro ao buscar meta:', error);
    return NextResponse.json({ error: 'Erro ao buscar meta' }, { status: 500 });
  }
}

// PUT - Atualizar meta qualitativa
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const {
      title,
      description,
      category,
      startDate,
      endDate,
      frequency,
      bonusAmount,
      penaltyAmount,
      notes,
      isActive
    } = body;

    const goal = await prisma.qualitativeGoal.update({
      where: { id: params.id },
      data: {
        title,
        description,
        category,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : null,
        frequency,
        bonusAmount: bonusAmount !== undefined ? (bonusAmount ? parseFloat(bonusAmount) : null) : undefined,
        penaltyAmount: penaltyAmount !== undefined ? (penaltyAmount ? parseFloat(penaltyAmount) : null) : undefined,
        notes,
        isActive
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            position: true
          }
        }
      }
    });

    return NextResponse.json(goal);
  } catch (error) {
    console.error('Erro ao atualizar meta:', error);
    return NextResponse.json({ error: 'Erro ao atualizar meta' }, { status: 500 });
  }
}

// DELETE - Excluir meta qualitativa
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const userType = (session.user as any).userType;
    if (userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Apenas admins podem excluir metas' }, { status: 403 });
    }

    await prisma.qualitativeGoal.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ message: 'Meta excluída com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir meta:', error);
    return NextResponse.json({ error: 'Erro ao excluir meta' }, { status: 500 });
  }
}
