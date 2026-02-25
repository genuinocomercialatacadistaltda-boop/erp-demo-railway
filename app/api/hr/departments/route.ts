
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

// GET - Lista todos os departamentos
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const isActive = searchParams.get('isActive');

    const where: any = {};
    
    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }

    const departments = await prisma.department.findMany({
      where,
      include: {
        _count: {
          select: {
            employees: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(departments);
  } catch (error) {
    console.error('Erro ao buscar departamentos:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar departamentos' },
      { status: 500 }
    );
  }
}

// POST - Cria novo departamento
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { name, code } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Nome do departamento é obrigatório' },
        { status: 400 }
      );
    }

    // Verifica se já existe departamento com mesmo nome
    const existing = await prisma.department.findUnique({
      where: { name },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Já existe um departamento com este nome' },
        { status: 400 }
      );
    }

    const department = await prisma.department.create({
      data: {
        name,
        code: code || null,
      },
      include: {
        _count: {
          select: {
            employees: true,
          },
        },
      },
    });

    return NextResponse.json(department, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar departamento:', error);
    return NextResponse.json(
      { error: 'Erro ao criar departamento', details: error.message },
      { status: 500 }
    );
  }
}
