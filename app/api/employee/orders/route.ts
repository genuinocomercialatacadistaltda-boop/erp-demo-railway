export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // ✅ Aceita tanto EMPLOYEE quanto SELLER (quando tem employeeId)
    const userType = (session.user as any)?.userType;
    if (!session || (userType !== 'EMPLOYEE' && userType !== 'SELLER')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const employeeId = (session.user as any)?.employeeId;
    
    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId não encontrado na sessão' }, { status: 400 });
    }

    // Busca o funcionário
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 });
    }

    // Busca pedidos do funcionário (vamos assumir que há um campo employeeOrdererId ou similar)
    // Por enquanto, vamos retornar array vazio até definir melhor a estrutura
    // TODO: Adicionar campo employeeOrdererId na tabela Order
    
    const orders: any[] = [];
    const totalUsed = 0;

    return NextResponse.json({ 
      orders,
      totalUsed,
      creditLimit: employee.salary ? employee.salary * 0.3 : 500
    });
  } catch (error: any) {
    console.error('Erro ao buscar pedidos do funcionário:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar pedidos', details: error.message },
      { status: 500 }
    );
  }
}
