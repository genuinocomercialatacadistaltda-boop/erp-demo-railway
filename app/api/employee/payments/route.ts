
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

// GET - Retorna pagamentos do funcionário logado
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // ✅ Aceita tanto EMPLOYEE quanto SELLER (quando tem employeeId)
    const userType = (session.user as any)?.userType;
    if (!session || (userType !== 'EMPLOYEE' && userType !== 'SELLER')) {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 401 }
      );
    }

    const employeeId = (session.user as any)?.employeeId;
    
    if (!employeeId) {
      return NextResponse.json(
        { error: 'ID do funcionário não encontrado na sessão' },
        { status: 400 }
      );
    }

    const payments = await prisma.employeePayment.findMany({
      where: { employeeId },
      include: {
        payrollSheet: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(payments);
  } catch (error: any) {
    console.error('Erro ao buscar pagamentos:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar pagamentos', details: error.message },
      { status: 500 }
    );
  }
}
