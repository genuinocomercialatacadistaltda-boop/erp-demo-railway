export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

/**
 * PUT /api/hr/holidays/[id]
 * Atualiza um feriado
 * 
 * DELETE /api/hr/holidays/[id]
 * Exclui um feriado
 */

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { date, name, isRecurring, isActive, notes } = body;

    console.log('📝 Atualizando feriado:', params.id);

    const holiday = await prisma.holiday.update({
      where: { id: params.id },
      data: {
        ...(date && { date: new Date(date) }),
        ...(name && { name }),
        ...(typeof isRecurring !== 'undefined' && { isRecurring }),
        ...(typeof isActive !== 'undefined' && { isActive }),
        ...(notes !== undefined && { notes }),
      },
    });

    console.log('✅ Feriado atualizado');

    return NextResponse.json(holiday);
  } catch (error: any) {
    console.error('❌ Erro ao atualizar feriado:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar feriado', details: error.message },
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

    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    console.log('🗑️ Excluindo feriado:', params.id);

    await prisma.holiday.delete({
      where: { id: params.id },
    });

    console.log('✅ Feriado excluído');

    return NextResponse.json({ message: 'Feriado excluído com sucesso' });
  } catch (error: any) {
    console.error('❌ Erro ao excluir feriado:', error);
    return NextResponse.json(
      { error: 'Erro ao excluir feriado', details: error.message },
      { status: 500 }
    );
  }
}
