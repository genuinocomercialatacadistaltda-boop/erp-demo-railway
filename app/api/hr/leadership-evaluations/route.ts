export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { headers } from 'next/headers';

// GET - Listar avaliações de liderança
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const leaderId = searchParams.get('leaderId');
    const evaluatorId = searchParams.get('evaluatorId');
    const weekStart = searchParams.get('weekStart');
    const includeAnonymous = searchParams.get('includeAnonymous') === 'true';

    const where: any = {};
    
    if (leaderId) where.leaderId = leaderId;
    if (evaluatorId) where.evaluatorId = evaluatorId;
    if (weekStart) where.weekStart = new Date(weekStart);
    
    // Se não for admin, só pode ver suas próprias avaliações feitas
    const userType = (session.user as any).userType;
    if (userType !== 'ADMIN') {
      // Buscar funcionário pelo email
      const employee = await prisma.employee.findFirst({
        where: { email: session.user.email }
      });
      if (employee) {
        where.evaluatorId = employee.id;
      }
    }

    const evaluations = await prisma.leadershipEvaluation.findMany({
      where,
      include: {
        leader: {
          select: {
            id: true,
            name: true,
            position: true,
            isSupervisor: true,
            isManager: true,
            isCEO: true
          }
        },
        evaluator: includeAnonymous ? {
          select: {
            id: true,
            name: true,
            position: true
          }
        } : false
      },
      orderBy: { createdAt: 'desc' }
    });

    // Se não for admin, esconder dados do avaliador em avaliações anônimas
    const processedEvaluations = evaluations.map(ev => {
      if (ev.isAnonymous && userType !== 'ADMIN') {
        return { ...ev, evaluator: null, evaluatorId: null };
      }
      return ev;
    });

    return NextResponse.json(processedEvaluations);
  } catch (error) {
    console.error('Erro ao buscar avaliações de liderança:', error);
    return NextResponse.json({ error: 'Erro ao buscar avaliações' }, { status: 500 });
  }
}

// POST - Criar avaliação de liderança
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const {
      leaderId,
      isAnonymous,
      weekStart,
      weekEnd,
      communication,
      organization,
      respect,
      support,
      fairness,
      leadership,
      overallRating,
      strengths,
      improvements,
      comments
    } = body;

    if (!leaderId || !weekStart || !weekEnd) {
      return NextResponse.json(
        { error: 'Líder e período são obrigatórios' },
        { status: 400 }
      );
    }

    // Buscar funcionário avaliador
    let evaluatorId: string | null = null;
    const employee = await prisma.employee.findFirst({
      where: { email: session.user.email }
    });
    
    if (!employee) {
      // Se for admin sem employee vinculado, pode avaliar
      const userType = (session.user as any).userType;
      if (userType !== 'ADMIN') {
        return NextResponse.json(
          { error: 'Funcionário não encontrado' },
          { status: 404 }
        );
      }
    } else {
      evaluatorId = isAnonymous ? null : employee.id;
    }

    // Capturar IP e User-Agent para auditoria
    const headersList = headers();
    const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown';
    const userAgent = headersList.get('user-agent') || 'unknown';

    // Verificar se já existe avaliação deste avaliador para este líder nesta semana
    if (evaluatorId) {
      const existing = await prisma.leadershipEvaluation.findFirst({
        where: {
          leaderId,
          evaluatorId,
          weekStart: new Date(weekStart)
        }
      });
      
      if (existing) {
        return NextResponse.json(
          { error: 'Você já avaliou este líder nesta semana' },
          { status: 400 }
        );
      }
    }

    const evaluation = await prisma.leadershipEvaluation.create({
      data: {
        leaderId,
        evaluatorId,
        isAnonymous: isAnonymous || false,
        weekStart: new Date(weekStart),
        weekEnd: new Date(weekEnd),
        communication: communication || 3,
        organization: organization || 3,
        respect: respect || 3,
        support: support || 3,
        fairness: fairness || 3,
        leadership: leadership || 3,
        overallRating: overallRating || 3,
        strengths,
        improvements,
        comments,
        ipAddress,
        userAgent
      },
      include: {
        leader: {
          select: {
            id: true,
            name: true,
            position: true
          }
        }
      }
    });

    console.log(`✅ Avaliação de liderança criada: ${evaluation.id} - Líder: ${evaluation.leader.name} - Anônima: ${isAnonymous}`);

    return NextResponse.json(evaluation, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar avaliação de liderança:', error);
    return NextResponse.json({ error: 'Erro ao criar avaliação' }, { status: 500 });
  }
}
