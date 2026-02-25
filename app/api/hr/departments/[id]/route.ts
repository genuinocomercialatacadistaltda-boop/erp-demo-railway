export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

// PUT - Atualiza departamento
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { name, code, isActive } = body;

    const existing = await prisma.department.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Departamento não encontrado' },
        { status: 404 }
      );
    }

    const department = await prisma.department.update({
      where: { id: params.id },
      data: {
        name: name || existing.name,
        code: code !== undefined ? code : existing.code,
        isActive: isActive !== undefined ? isActive : existing.isActive,
      },
      include: {
        _count: {
          select: {
            employees: true,
          },
        },
      },
    });

    return NextResponse.json(department);
  } catch (error: any) {
    console.error('Erro ao atualizar departamento:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar departamento', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Deleta departamento
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 401 }
      );
    }

    const existing = await prisma.department.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            employees: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Departamento não encontrado' },
        { status: 404 }
      );
    }

    if (existing._count.employees > 0) {
      return NextResponse.json(
        { error: 'Não é possível excluir um departamento que possui funcionários vinculados' },
        { status: 400 }
      );
    }

    await prisma.department.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true, message: 'Departamento excluído com sucesso' });
  } catch (error: any) {
    console.error('Erro ao excluir departamento:', error);
    return NextResponse.json(
      { error: 'Erro ao excluir departamento', details: error.message },
      { status: 500 }
    );
  }
}
