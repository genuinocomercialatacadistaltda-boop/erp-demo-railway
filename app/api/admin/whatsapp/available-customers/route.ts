import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET - Busca clientes que ainda não têm configuração de WhatsApp
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    console.log('[AVAILABLE_CUSTOMERS] Buscando clientes disponíveis...');

    // Busca todos os clientes ativos com telefone
    const allCustomers = await prisma.customer.findMany({
      where: {
        isActive: true,
        phone: { not: '' }
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        city: true,
        whatsappConfig: {
          select: {
            id: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    // Filtra apenas os que não têm configuração
    const availableCustomers = allCustomers.filter(
      customer => !customer.whatsappConfig
    );

    console.log(`[AVAILABLE_CUSTOMERS] ${availableCustomers.length} clientes disponíveis`);

    return NextResponse.json({ 
      customers: availableCustomers.map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        city: c.city
      }))
    });
  } catch (error) {
    console.error('[AVAILABLE_CUSTOMERS] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar clientes disponíveis' },
      { status: 500 }
    );
  }
}