export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { sendWhatsAppMessage, isWhatsAppConfigured } from '@/lib/whatsapp';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const isConfigured = await isWhatsAppConfigured();
    if (!isConfigured) {
      return NextResponse.json(
        { error: 'Sistema de WhatsApp não está configurado. Configure Evolution API ou Twilio.' },
        { status: 400 }
      );
    }

    const { customerId, message } = await req.json();

    if (!customerId || !message) {
      return NextResponse.json(
        { error: 'Cliente e mensagem são obrigatórios' },
        { status: 400 }
      );
    }

    // Busca o cliente
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        name: true,
        phone: true
      }
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      );
    }

    if (!customer.phone || customer.phone.trim() === '') {
      return NextResponse.json(
        { error: 'Cliente não tem telefone cadastrado' },
        { status: 400 }
      );
    }

    console.log('[INDIVIDUAL_MESSAGE] Enviando mensagem para:', customer.name);
    console.log('[INDIVIDUAL_MESSAGE] Telefone:', customer.phone);
    console.log('[INDIVIDUAL_MESSAGE] Mensagem:', message.substring(0, 100) + '...');

    // Envia a mensagem
    const result = await sendWhatsAppMessage(customer.phone, message);

    if (result.success) {
      console.log('[INDIVIDUAL_MESSAGE] ✅ Mensagem enviada com sucesso!');
      return NextResponse.json({
        success: true,
        messageId: result.messageId
      });
    } else {
      console.log('[INDIVIDUAL_MESSAGE] ❌ Erro:', result.error);
      return NextResponse.json(
        { error: result.error || 'Erro ao enviar mensagem' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[INDIVIDUAL_MESSAGE] Erro inesperado:', error);
    return NextResponse.json(
      { error: 'Erro ao enviar mensagem' },
      { status: 500 }
    );
  }
}
