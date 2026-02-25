import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { sendWhatsAppMessage, isTwilioConfigured } from '@/lib/whatsapp';
import { prisma } from '@/lib/db';

/**
 * API para envio de mensagens via WhatsApp
 * POST /api/whatsapp/send
 */
export async function POST(request: NextRequest) {
  try {
    // Verifica autenticação
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Verifica se o Twilio está configurado
    if (!isTwilioConfigured()) {
      return NextResponse.json(
        { error: 'Twilio não configurado' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { customerId, phone, message } = body;

    // Validações
    if (!phone || !message) {
      return NextResponse.json(
        { error: 'Telefone e mensagem são obrigatórios' },
        { status: 400 }
      );
    }

    console.log('[WHATSAPP_API] Enviando mensagem...');
    console.log('[WHATSAPP_API] CustomerId:', customerId || 'N/A');
    console.log('[WHATSAPP_API] Telefone:', phone);

    // Envia a mensagem
    const result = await sendWhatsAppMessage(phone, message);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    // Se tiver customerId, registra no banco
    if (customerId) {
      try {
        await prisma.notification.create({
          data: {
            id: `notif-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            title: 'Mensagem WhatsApp Enviada',
            message: message.substring(0, 200),
            category: 'GENERAL',
            type: 'SYSTEM',
            deliveryMode: 'MANUAL',
            targetRole: 'CUSTOMER',
            targetUserId: customerId
          }
        });
        console.log('[WHATSAPP_API] Notificação registrada no banco');
      } catch (dbError) {
        console.error('[WHATSAPP_API] Erro ao registrar notificação:', dbError);
        // Não falha a requisição por erro no registro
      }
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      message: 'Mensagem enviada com sucesso'
    });

  } catch (error) {
    console.error('[WHATSAPP_API] Erro ao enviar mensagem:', error);
    return NextResponse.json(
      {
        error: 'Erro ao enviar mensagem',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}

/**
 * GET - Verifica status da configuração do Twilio
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const isConfigured = isTwilioConfigured();

    return NextResponse.json({
      configured: isConfigured,
      message: isConfigured
        ? 'Twilio configurado corretamente'
        : 'Twilio não configurado'
    });
  } catch (error) {
    console.error('[WHATSAPP_API] Erro ao verificar configuração:', error);
    return NextResponse.json(
      { error: 'Erro ao verificar configuração' },
      { status: 500 }
    );
  }
}
