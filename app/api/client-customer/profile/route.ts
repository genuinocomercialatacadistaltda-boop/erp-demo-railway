import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyClientCustomerToken } from '@/lib/client-customer-auth';

const prisma = new PrismaClient();

// Buscar perfil
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('client-customer-token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Não autenticado' },
        { status: 401 }
      );
    }

    const { valid, session } = await verifyClientCustomerToken(token);

    if (!valid || !session) {
      return NextResponse.json(
        { success: false, message: 'Sessão inválida' },
        { status: 401 }
      );
    }

    const clientCustomer = await prisma.clientCustomer.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        document: true,
        pointsBalance: true,
        totalPointsEarned: true,
        pointsMultiplier: true,
        creditLimit: true,
        currentDebt: true,
        createdAt: true,
      },
    });

    if (!clientCustomer) {
      return NextResponse.json(
        { success: false, message: 'Cliente não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      profile: clientCustomer,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json(
      { success: false, message: 'Erro ao buscar perfil' },
      { status: 500 }
    );
  }
}

// Atualizar perfil
export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get('client-customer-token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Não autenticado' },
        { status: 401 }
      );
    }

    const { valid, session } = await verifyClientCustomerToken(token);

    if (!valid || !session) {
      return NextResponse.json(
        { success: false, message: 'Sessão inválida' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { phone, address } = body;

    const data: any = {};

    if (phone !== undefined) data.phone = phone;
    if (address !== undefined) data.address = address;

    const clientCustomer = await prisma.clientCustomer.update({
      where: { id: session.id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        document: true,
        pointsBalance: true,
        totalPointsEarned: true,
      },
    });

    return NextResponse.json({
      success: true,
      profile: clientCustomer,
      message: 'Perfil atualizado com sucesso',
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json(
      { success: false, message: 'Erro ao atualizar perfil' },
      { status: 500 }
    );
  }
}
