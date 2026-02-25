import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

/**
 * API para Gerenciar Clientes Finais (Retail Customers)
 * GET: Lista todos os clientes finais do cliente logado
 * POST: Cria um novo cliente final manualmente
 */

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const customerId = session.user.id;

    // Buscar todos os clientes finais com informações adicionais
    const clientCustomers = await prisma.clientCustomer.findMany({
      where: {
        customerId: customerId,
      },
      include: {
        ClientCustomerOrders: {
          select: {
            id: true,
            total: true,
            status: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        ClientCustomerPointTransactions: {
          select: {
            id: true,
            type: true,
            amount: true,
            balance: true,
            description: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 10,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calcular estatísticas
    const stats = clientCustomers.map((client) => {
      const totalOrders = client.ClientCustomerOrders.length;
      const totalSpent = client.ClientCustomerOrders.reduce(
        (sum, order) => sum + order.total,
        0
      );
      const lastOrderDate = client.ClientCustomerOrders[0]?.createdAt || null;

      return {
        id: client.id,
        name: client.name,
        phone: client.phone,
        email: client.email,
        document: client.document,
        address: client.address,
        pointsBalance: client.pointsBalance,
        totalPointsEarned: client.totalPointsEarned,
        pointsMultiplier: client.pointsMultiplier,
        creditLimit: client.creditLimit,
        currentDebt: client.currentDebt,
        isActive: client.isActive,
        createdAt: client.createdAt,
        lastLoginAt: client.lastLoginAt,
        totalOrders,
        totalSpent,
        lastOrderDate,
        recentTransactions: client.ClientCustomerPointTransactions,
      };
    });

    return NextResponse.json({ customers: stats });
  } catch (error) {
    console.error('[GET_RETAIL_CUSTOMERS_ERROR]', error);
    return NextResponse.json(
      { error: 'Erro ao buscar clientes' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const customerId = session.user.id;
    const body = await request.json();
    const {
      name,
      phone,
      email,
      document,
      address,
      creditLimit,
      pointsMultiplier,
    } = body;

    if (!name || !phone) {
      return NextResponse.json(
        { error: 'Nome e telefone são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se o telefone já existe
    const existingCustomer = await prisma.clientCustomer.findFirst({
      where: {
        customerId: customerId,
        phone: phone,
      },
    });

    if (existingCustomer) {
      return NextResponse.json(
        { error: 'Telefone já cadastrado' },
        { status: 400 }
      );
    }

    // Criar cliente final
    const clientCustomer = await prisma.clientCustomer.create({
      data: {
        customerId: customerId,
        name,
        phone,
        email: email || null,
        document: document || null,
        address: address || null,
        creditLimit: creditLimit || 0,
        currentDebt: 0,
        pointsBalance: 0,
        totalPointsEarned: 0,
        pointsMultiplier: pointsMultiplier || 1.0,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, customer: clientCustomer });
  } catch (error) {
    console.error('[CREATE_RETAIL_CUSTOMER_ERROR]', error);
    return NextResponse.json(
      { error: 'Erro ao criar cliente' },
      { status: 500 }
    );
  }
}
