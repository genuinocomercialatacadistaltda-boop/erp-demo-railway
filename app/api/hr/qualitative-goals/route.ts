export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET - Listar metas qualitativas
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId');
    const category = searchParams.get('category');
    const isActive = searchParams.get('isActive');
    const includeEvaluations = searchParams.get('includeEvaluations') === 'true';

    const where: any = {};
    
    if (employeeId) where.employeeId = employeeId;
    if (category) where.category = category;
    if (isActive !== null) where.isActive = isActive === 'true';

    const goals = await prisma.qualitativeGoal.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            position: true,
            isSupervisor: true,
            isManager: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            position: true
          }
        },
        evaluations: includeEvaluations ? {
          orderBy: { date: 'desc' },
          take: 30,
          include: {
            evaluator: {
              select: { id: true, name: true }
            }
          }
        } : false
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(goals);
  } catch (error) {
    console.error('Erro ao buscar metas qualitativas:', error);
    return NextResponse.json({ error: 'Erro ao buscar metas' }, { status: 500 });
  }
}

// POST - Criar meta qualitativa
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Verificar se é admin ou líder
    const userType = (session.user as any).userType;
    let creatorEmployee = await prisma.employee.findFirst({
      where: { email: session.user.email }
    });

    if (userType !== 'ADMIN' && !creatorEmployee?.isSupervisor && !creatorEmployee?.isManager && !creatorEmployee?.isCEO) {
      return NextResponse.json(
        { error: 'Apenas líderes podem criar metas' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      employeeId,
      title,
      description,
      category,
      startDate,
      endDate,
      frequency,
      bonusAmount,
      penaltyAmount,
      notes
    } = body;

    if (!employeeId || !title || !startDate) {
      return NextResponse.json(
        { error: 'Funcionário, título e data de início são obrigatórios' },
        { status: 400 }
      );
    }

    // Se não for admin, usar o ID do funcionário como criador
    let createdById = creatorEmployee?.id;
    if (userType === 'ADMIN' && !createdById) {
      // Admin sem employee vinculado - buscar ou criar um
      const adminEmployee = await prisma.employee.findFirst({
        where: { isCEO: true }
      });
      createdById = adminEmployee?.id || employeeId; // fallback
    }

    const goal = await prisma.qualitativeGoal.create({
      data: {
        employeeId,
        createdById: createdById!,
        title,
        description,
        category: category || 'QUALITY',
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        frequency: frequency || 'DAILY',
        bonusAmount: bonusAmount ? parseFloat(bonusAmount) : null,
        penaltyAmount: penaltyAmount ? parseFloat(penaltyAmount) : null,
        notes,
        isActive: true
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            position: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    console.log(`✅ Meta qualitativa criada: ${goal.id} - ${goal.title} para ${goal.employee.name}`);

    return NextResponse.json(goal, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar meta qualitativa:', error);
    return NextResponse.json({ error: 'Erro ao criar meta' }, { status: 500 });
  }
}
