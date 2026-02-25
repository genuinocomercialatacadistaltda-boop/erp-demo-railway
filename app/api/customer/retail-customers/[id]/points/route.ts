import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

/**
 * API para Gerenciar Pontos de Cliente Final
 * POST: Adiciona ou remove pontos manualmente
 */

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const customerId = session.user.id;
    const { id } = params;
    const body = await request.json();
    const { amount, description, type } = body;

    if (!amount || !description || !type) {
      return NextResponse.json(
        { error: 'Dados inválidos' },
        { status: 400 }
      );
    }

    // Verificar se o cliente pertence ao usuário logado
    const clientCustomer = await prisma.clientCustomer.findFirst({
      where: {
        id: id,
        customerId: customerId,
      },
    });

    if (!clientCustomer) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      );
    }

    // Calcular novo saldo
    const pointsChange = type === 'ADD' ? amount : -amount;
    const newBalance = clientCustomer.pointsBalance + pointsChange;

    if (newBalance < 0) {
      return NextResponse.json(
        { error: 'Saldo de pontos insuficiente' },
        { status: 400 }
      );
    }

    // Atualizar pontos
    await prisma.clientCustomer.update({
      where: { id: id },
      data: {
        pointsBalance: newBalance,
        totalPointsEarned:
          type === 'ADD'
            ? clientCustomer.totalPointsEarned + amount
            : clientCustomer.totalPointsEarned,
      },
    });

    // Criar transação
    await prisma.clientCustomerPointTransaction.create({
      data: {
        customerId: customerId,
        clientCustomerId: id,
        type: 'ADJUSTMENT',
        amount: pointsChange,
        balance: newBalance,
        description: description,
      },
    });

    return NextResponse.json({
      success: true,
      newBalance: newBalance,
    });
  } catch (error) {
    console.error('[ADJUST_POINTS_ERROR]', error);
    return NextResponse.json(
      { error: 'Erro ao ajustar pontos' },
      { status: 500 }
    );
  }
}
