
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

    // Busca registros de ponto dos últimos 30 dias
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const timeRecords = await prisma.timeRecord.findMany({
      where: {
        employeeId: employeeId,
        dateTime: {
          gte: thirtyDaysAgo
        }
      },
      orderBy: {
        dateTime: 'desc'
      },
      take: 100 // Limita a 100 registros mais recentes
    });

    return NextResponse.json(timeRecords);
  } catch (error: any) {
    console.error('Erro ao buscar registros de ponto:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar registros', details: error.message },
      { status: 500 }
    );
  }
}
