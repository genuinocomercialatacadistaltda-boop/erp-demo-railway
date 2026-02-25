export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET - Lista todas as configurações de WhatsApp
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const configs = await prisma.whatsAppConfig.findMany({
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
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    return NextResponse.json({ configs });
  } catch (error) {
    console.error('[WHATSAPP_CONFIG_GET] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar configurações' },
      { status: 500 }
    );
  }
}

// POST - Cria ou atualiza uma configuração de WhatsApp
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { customerId, customIntervalDays, isActive, customMessage } = body;

    if (!customerId) {
      return NextResponse.json(
        { error: 'customerId é obrigatório' },
        { status: 400 }
      );
    }

    console.log('[WHATSAPP_CONFIG_POST] Criando/atualizando configuração para cliente:', customerId);

    // Verifica se o cliente existe
    const customer = await prisma.customer.findUnique({
      where: { id: customerId }
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      );
    }

    // Cria ou atualiza a configuração usando upsert
    const config = await prisma.whatsAppConfig.upsert({
      where: {
        customerId: customerId
      },
      update: {
        customIntervalDays: customIntervalDays ? parseInt(customIntervalDays) : null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        customMessage: customMessage || null,
        updatedAt: new Date()
      },
      create: {
        customerId: customerId,
        customIntervalDays: customIntervalDays ? parseInt(customIntervalDays) : null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        customMessage: customMessage || null
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

    console.log('[WHATSAPP_CONFIG_POST] ✅ Configuração salva:', config.id);

    return NextResponse.json({ config });
  } catch (error) {
    console.error('[WHATSAPP_CONFIG_POST] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao salvar configuração' },
      { status: 500 }
    );
  }
}