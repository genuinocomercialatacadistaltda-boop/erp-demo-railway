export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getInstanceStatus, isEvolutionApiConfigured } from '@/lib/evolution-api';

/**
 * GET /api/admin/whatsapp/evolution/status
 * Retorna o status atual da conexão WhatsApp via Evolution API
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    console.log('[EVOLUTION_API_STATUS] Verificando status da instância...');

    // Verifica se a Evolution API está configurada e acessível
    const isConfigured = await isEvolutionApiConfigured();

    if (!isConfigured) {
      console.log('[EVOLUTION_API_STATUS] Evolution API não está configurada ou acessível');
      return NextResponse.json({
        configured: false,
        connected: false,
        message: 'Evolution API não está configurada ou não está rodando'
      });
    }

    // Obtém o status da instância
    const status = await getInstanceStatus();

    if (!status) {
      console.log('[EVOLUTION_API_STATUS] Não foi possível obter status');
      return NextResponse.json({
        configured: true,
        connected: false,
        state: 'unknown',
        message: 'Não foi possível obter status da instância'
      });
    }

    console.log('[EVOLUTION_API_STATUS] Status obtido:', status);

    return NextResponse.json({
      configured: true,
      connected: status.connected,
      state: status.state,
      phone: status.phone,
      message: status.connected 
        ? '✅ WhatsApp conectado com sucesso!' 
        : '⚠️ WhatsApp não conectado. Escaneie o QR Code.'
    });

  } catch (error) {
    console.error('[EVOLUTION_API_STATUS] Erro ao verificar status:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao verificar status',
        configured: false,
        connected: false
      },
      { status: 500 }
    );
  }
}
