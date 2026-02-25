export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { PrismaClient } from '@prisma/client';
import { setClientCustomerPassword } from '@/lib/client-customer-auth';
import { authOptions } from '@/lib/auth-options';

const prisma = new PrismaClient();

// Listar sub-clientes
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    const user = session?.user as any;

    if (!user?.customerId) {
      return NextResponse.json(
        { success: false, message: 'Não autorizado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const isActive = searchParams.get('isActive');

    const where: any = {
      customerId: user.customerId,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }

    const subClientes = await prisma.clientCustomer.findMany({
      where,
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json({
      success: true,
      subClientes,
    });
  } catch (error) {
    console.error('Get sub-clientes error:', error);
    return NextResponse.json(
      { success: false, message: 'Erro ao buscar sub-clientes' },
      { status: 500 }
    );
  }
}

// Criar novo sub-cliente
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    const user = session?.user as any;

    if (!user?.customerId) {
      return NextResponse.json(
        { success: false, message: 'Não autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      name,
      email,
      phone,
      address,
      document,
      creditLimit = 0,
      pointsMultiplier = 1.0,
      password,
    } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, message: 'Nome é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se email já existe
    if (email) {
      const existingEmail = await prisma.clientCustomer.findFirst({
        where: {
          email: email.toLowerCase().trim(),
          customerId: user.customerId,
        },
      });

      if (existingEmail) {
        return NextResponse.json(
          { success: false, message: 'E-mail já cadastrado' },
          { status: 400 }
        );
      }
    }

    // Criar sub-cliente
    const subCliente = await prisma.clientCustomer.create({
      data: {
        customerId: user.customerId,
        name,
        email: email ? email.toLowerCase().trim() : null,
        phone,
        address,
        document,
        creditLimit,
        pointsMultiplier,
      },
    });

    // Definir senha se fornecida
    if (password) {
      await setClientCustomerPassword(subCliente.id, password);
    }

    return NextResponse.json({
      success: true,
      subCliente,
      message: 'Sub-cliente criado com sucesso',
    });
  } catch (error) {
    console.error('Create sub-cliente error:', error);
    return NextResponse.json(
      { success: false, message: 'Erro ao criar sub-cliente' },
      { status: 500 }
    );
  }
}
