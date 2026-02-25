import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

/**
 * API para Gerenciar Cliente Final Individual
 * GET: Busca detalhes de um cliente final
 * PATCH: Atualiza informações do cliente final
 * DELETE: Desativa um cliente final
 */

export async function GET(
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

    const clientCustomer = await prisma.clientCustomer.findFirst({
      where: {
        id: id,
        customerId: customerId,
      },
      include: {
        ClientCustomerOrders: {
          include: {
            Items: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        ClientCustomerPointTransactions: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!clientCustomer) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({ customer: clientCustomer });
  } catch (error) {
    console.error('[GET_RETAIL_CUSTOMER_ERROR]', error);
    return NextResponse.json(
      { error: 'Erro ao buscar cliente' },
      { status: 500 }
    );
  }
}

export async function PATCH(
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

    // Verificar se o cliente pertence ao usuário logado
    const existingCustomer = await prisma.clientCustomer.findFirst({
      where: {
        id: id,
        customerId: customerId,
      },
    });

    if (!existingCustomer) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      );
    }

    const updatedCustomer = await prisma.clientCustomer.update({
      where: { id: id },
      data: {
        name: body.name,
        email: body.email || null,
        document: body.document || null,
        address: body.address || null,
        creditLimit: body.creditLimit,
        pointsMultiplier: body.pointsMultiplier,
        isActive: body.isActive,
      },
    });

    return NextResponse.json({ success: true, customer: updatedCustomer });
  } catch (error) {
    console.error('[UPDATE_RETAIL_CUSTOMER_ERROR]', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar cliente' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // Verificar se o cliente pertence ao usuário logado
    const existingCustomer = await prisma.clientCustomer.findFirst({
      where: {
        id: id,
        customerId: customerId,
      },
    });

    if (!existingCustomer) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      );
    }

    // Desativar cliente ao invés de deletar
    await prisma.clientCustomer.update({
      where: { id: id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE_RETAIL_CUSTOMER_ERROR]', error);
    return NextResponse.json(
      { error: 'Erro ao deletar cliente' },
      { status: 500 }
    );
  }
}
