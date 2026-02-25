export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// Gera um código de indicação único de 6 caracteres
function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// GET - Obter lista de indicações do cliente (NOVO SISTEMA)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const user = session.user as any;
    const { customerId } = user;

    if (!customerId) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 400 });
    }

    // Buscar cliente com clientes que ele indicou
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        name: true,
        phone: true,
        ReferredCustomers: {
          select: {
            id: true,
            name: true,
            phone: true,
            createdAt: true,
            referralBonusReceived: true,
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    // Montar mensagem WhatsApp
    const whatsappMessage = encodeURIComponent(
      `Olá! Vim por indicação do cliente: ${customer.name}`
    );
    const whatsappLink = `https://wa.me/55[SEU-DDD][SEU-NUMERO]?text=${whatsappMessage}`;

    return NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone
      },
      referralsCount: customer.ReferredCustomers?.length || 0,
      referrals: customer.ReferredCustomers || [],
      whatsappLink,
      whatsappMessage: decodeURIComponent(whatsappMessage)
    });
  } catch (error) {
    console.error('Erro ao obter indicações:', error);
    return NextResponse.json(
      { error: 'Erro ao obter indicações' },
      { status: 500 }
    );
  }
}
