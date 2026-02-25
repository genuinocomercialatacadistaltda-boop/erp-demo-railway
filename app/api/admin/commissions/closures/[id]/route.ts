export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

/**
 * API para excluir fechamento de comissões
 * DELETE /api/admin/commissions/closures/[id] - Exclui fechamento cancelado
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const closureId = params.id;

    // Busca o fechamento
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

    // Valida que o fechamento está cancelado
    if (closure.status !== 'CANCELLED') {
      return NextResponse.json({ 
        error: 'Somente fechamentos cancelados podem ser excluídos. Use a opção "Cancelar" primeiro.' 
      }, { status: 400 });
    }

    // Verifica se as comissões já foram desvinculadas
    const linkedCommissions = await prisma.commission.count({
      where: { closureId: closureId },
    });

    if (linkedCommissions > 0) {
      return NextResponse.json({ 
        error: 'Existem comissões ainda vinculadas a este fechamento. Entre em contato com o suporte.' 
      }, { status: 400 });
    }

    // Exclui o fechamento
    await prisma.commissionClosure.delete({
      where: { id: closureId },
    });

    console.log(`🗑️ Fechamento excluído: ${closure.Seller.name} - ${closure.referenceMonth}`);

    return NextResponse.json({
      success: true,
      message: 'Fechamento excluído com sucesso',
    });
  } catch (error: any) {
    console.error('❌ Erro ao excluir fechamento:', error);
    return NextResponse.json(
      { error: 'Erro ao excluir fechamento', details: error.message },
      { status: 500 }
    );
  }
}
