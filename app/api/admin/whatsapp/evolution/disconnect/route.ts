export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { disconnectInstance } from '@/lib/evolution-api';

/**
 * DELETE /api/admin/whatsapp/evolution/disconnect
 * Desconecta e deleta a instância WhatsApp
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    console.log('[EVOLUTION_API_DISCONNECT] Desconectando instância...');

    const result = await disconnectInstance();

    if (!result.success) {
      console.error('[EVOLUTION_API_DISCONNECT] Erro ao desconectar:', result.error);
      return NextResponse.json(
        { error: result.error || 'Erro ao desconectar instância' },
        { status: 500 }
      );
    }

    console.log('[EVOLUTION_API_DISCONNECT] ✅ Instância desconectada com sucesso');
    return NextResponse.json({
      success: true,
      message: '✅ WhatsApp desconectado com sucesso!'
    });

  } catch (error) {
    console.error('[EVOLUTION_API_DISCONNECT] Erro inesperado:', error);
    return NextResponse.json(
      { error: 'Erro ao desconectar instância WhatsApp' },
      { status: 500 }
    );
  }
}
