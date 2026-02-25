export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET - Listar todos os líderes (encarregados, gerentes, CEO)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type'); // SUPERVISOR, MANAGER, CEO, ALL

    const where: any = {
      isActive: true,
      OR: [
        { isSupervisor: true },
        { isManager: true },
        { isCEO: true }
      ]
    };

    // Filtrar por tipo específico
    if (type === 'SUPERVISOR') {
      where.OR = [{ isSupervisor: true }];
    } else if (type === 'MANAGER') {
      where.OR = [{ isManager: true }];
    } else if (type === 'CEO') {
      where.OR = [{ isCEO: true }];
    }

    const leaders = await prisma.employee.findMany({
      where,
      select: {
        id: true,
        employeeNumber: true,
        name: true,
        position: true,
        email: true,
        phone: true,
        departmentName: true,
        isSupervisor: true,
        isManager: true,
        isCEO: true,
        supervisees: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            position: true
          }
        },
        managedEmployees: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            position: true
          }
        },
        _count: {
          select: {
            supervisees: { where: { isActive: true } },
            managedEmployees: { where: { isActive: true } },
            leadershipEvaluationsReceived: true
          }
        }
      },
      orderBy: [
        { isCEO: 'desc' },
        { isManager: 'desc' },
        { isSupervisor: 'desc' },
        { name: 'asc' }
      ]
    });

    // Adicionar tipo de líder e tamanho da equipe
    const enrichedLeaders = leaders.map(leader => {
      let leaderType = 'SUPERVISOR';
      if (leader.isCEO) leaderType = 'CEO';
      else if (leader.isManager) leaderType = 'MANAGER';

      const teamSize = leader.isSupervisor 
        ? leader._count.supervisees 
        : leader._count.managedEmployees;

      return {
        ...leader,
        leaderType,
        teamSize,
        evaluationsCount: leader._count.leadershipEvaluationsReceived
      };
    });

    return NextResponse.json(enrichedLeaders);
  } catch (error) {
    console.error('Erro ao buscar líderes:', error);
    return NextResponse.json({ error: 'Erro ao buscar líderes' }, { status: 500 });
  }
}
