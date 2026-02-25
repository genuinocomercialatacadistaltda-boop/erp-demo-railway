export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// DELETE - Remove uma configuração de WhatsApp
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = params;

    console.log('[WHATSAPP_CONFIG_DELETE] Removendo configuração:', id);

    await prisma.whatsAppConfig.delete({
      where: { id }
    });

    console.log('[WHATSAPP_CONFIG_DELETE] ✅ Configuração removida');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[WHATSAPP_CONFIG_DELETE] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao remover configuração' },
      { status: 500 }
    );
  }
}

// PUT - Atualiza uma configuração existente
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { customIntervalDays, isActive, customMessage } = body;

    console.log('[WHATSAPP_CONFIG_PUT] Atualizando configuração:', id);

    const config = await prisma.whatsAppConfig.update({
      where: { id },
      data: {
        customIntervalDays: customIntervalDays ? parseInt(customIntervalDays) : null,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
        customMessage: customMessage !== undefined ? (customMessage || null) : undefined,
        updatedAt: new Date()
      },
      include: {
        Customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            city: true
          }
        }
      }
    });

    console.log('[WHATSAPP_CONFIG_PUT] ✅ Configuração atualizada');

    return NextResponse.json({ config });
  } catch (error) {
    console.error('[WHATSAPP_CONFIG_PUT] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar configuração' },
      { status: 500 }
    );
  }
}