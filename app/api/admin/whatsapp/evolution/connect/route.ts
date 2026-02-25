export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { createOrConnectInstance, isEvolutionApiConfigured } from '@/lib/evolution-api';

/**
 * POST /api/admin/whatsapp/evolution/connect
 * Cria ou conecta a uma instância WhatsApp e retorna o QR Code
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    console.log('[EVOLUTION_API_CONNECT] Tentando conectar instância...');

    // Verifica se a Evolution API está acessível
    const isConfigured = await isEvolutionApiConfigured();

    if (!isConfigured) {
      console.error('[EVOLUTION_API_CONNECT] Evolution API não está acessível');
      return NextResponse.json(
        { 
          error: '❌ Evolution API não está acessível.\n\n' +
            '**Certifique-se de que:**\n' +
            '1. A Evolution API está rodando (localhost:8080 ou servidor remoto)\n' +
            '2. As variáveis de ambiente estão configuradas\n' +
            '3. Não há firewall bloqueando a conexão'
        },
        { status: 400 }
      );
    }

    // Cria/conecta a instância
    const result = await createOrConnectInstance();

    if (!result.success) {
      console.error('[EVOLUTION_API_CONNECT] Erro ao conectar:', result.error);
      return NextResponse.json(
        { error: result.error || 'Erro ao conectar instância' },
        { status: 500 }
      );
    }

    if (result.alreadyConnected) {
      console.log('[EVOLUTION_API_CONNECT] ✅ Instância já está conectada');
      return NextResponse.json({
        success: true,
        alreadyConnected: true,
        message: '✅ WhatsApp já está conectado!'
      });
    }

    if (result.qrcode) {
      console.log('[EVOLUTION_API_CONNECT] ✅ QR Code gerado com sucesso');
      return NextResponse.json({
        success: true,
        qrcode: result.qrcode,
        message: '📱 Escaneie o QR Code no seu WhatsApp:\n\n' +
          '1. Abra o WhatsApp no celular\n' +
          '2. Toque em "Mais opções" (3 pontinhos) ou "Configurações"\n' +
          '3. Toque em "Aparelhos conectados"\n' +
          '4. Toque em "Conectar um aparelho"\n' +
          '5. Aponte a câmera para o QR Code abaixo'
      });
    }

    console.log('[EVOLUTION_API_CONNECT] ✅ Instância criada, mas QR Code não disponível ainda');
    return NextResponse.json({
      success: true,
      qrcode: null,
      message: '⚠️ Instância criada. Aguarde alguns segundos e tente novamente para obter o QR Code.'
    });

  } catch (error) {
    console.error('[EVOLUTION_API_CONNECT] Erro inesperado:', error);
    return NextResponse.json(
      { error: 'Erro ao conectar instância WhatsApp' },
      { status: 500 }
    );
  }
}
