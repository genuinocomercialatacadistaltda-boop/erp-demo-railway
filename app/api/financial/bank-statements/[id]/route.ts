export const dynamic = 'force-dynamic';


import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

/**
 * API: Operações em Extrato Específico
 * PATCH /api/financial/bank-statements/[id] - Atualizar (reconciliar)
 * DELETE /api/financial/bank-statements/[id] - Deletar
 */

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    const user = session?.user as any;

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { isReconciled, reconciledWith } = body;

    const statement = await prisma.bankStatement.update({
      where: { id: params.id },
      data: {
        isReconciled,
        reconciledWith,
      },
      include: {
        BankAccount: true,
      },
    });

    return NextResponse.json(statement);
  } catch (error: any) {
    console.error('Erro ao atualizar extrato:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar extrato: ' + error.message },
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

    const user = session?.user as any;

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    await prisma.bankStatement.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao deletar extrato:', error);
    return NextResponse.json(
      { error: 'Erro ao deletar extrato: ' + error.message },
      { status: 500 }
    );
  }
}
