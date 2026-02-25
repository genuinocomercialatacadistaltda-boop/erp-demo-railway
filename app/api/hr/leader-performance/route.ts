import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from 'date-fns';

// GET - Buscar scores de desempenho de líderes
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const leaderId = searchParams.get('leaderId');
    const period = searchParams.get('period');
    const periodType = searchParams.get('periodType') || 'MONTHLY';

    const where: any = {};
    if (leaderId) where.leaderId = leaderId;
    if (period) where.period = period;
    if (periodType) where.periodType = periodType;

    const scores = await prisma.leaderPerformanceScore.findMany({
      where,
      orderBy: { period: 'desc' }
    });

    // Incluir dados do líder
    const leaderIds = [...new Set(scores.map(s => s.leaderId))];
    const leaders = await prisma.employee.findMany({
      where: { id: { in: leaderIds } },
      select: {
        id: true,
        name: true,
        position: true,
        isSupervisor: true,
        isManager: true,
        isCEO: true
      }
    });

    const leadersMap = new Map(leaders.map(l => [l.id, l]));
    const enrichedScores = scores.map(s => ({
      ...s,
      leader: leadersMap.get(s.leaderId)
    }));

    return NextResponse.json(enrichedScores);
  } catch (error) {
    console.error('Erro ao buscar scores de desempenho:', error);
    return NextResponse.json({ error: 'Erro ao buscar scores' }, { status: 500 });
  }
}

// POST - Calcular/Atualizar score de desempenho do líder
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const userType = (session.user as any).userType;
    if (userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Apenas admins podem calcular scores' }, { status: 403 });
    }

    const body = await req.json();
    const { leaderId, periodType, referenceDate } = body;

    if (!leaderId || !periodType) {
      return NextResponse.json(
        { error: 'Líder e tipo de período são obrigatórios' },
        { status: 400 }
      );
    }

    const refDate = referenceDate ? new Date(referenceDate) : new Date();
    let period: string;
    let startDate: Date;
    let endDate: Date;

    if (periodType === 'WEEKLY') {
      startDate = startOfWeek(refDate, { weekStartsOn: 1 });
      endDate = endOfWeek(refDate, { weekStartsOn: 1 });
      period = format(startDate, 'yyyy-\'W\'ww');
    } else {
      startDate = startOfMonth(refDate);
      endDate = endOfMonth(refDate);
      period = format(startDate, 'yyyy-MM');
    }

    // Buscar líder
    const leader = await prisma.employee.findUnique({
      where: { id: leaderId },
      include: {
        supervisees: { where: { status: 'ACTIVE' } },
        managedEmployees: { where: { status: 'ACTIVE' } }
      }
    });

    if (!leader) {
      return NextResponse.json({ error: 'Líder não encontrado' }, { status: 404 });
    }

    // Determinar equipe baseado no tipo de líder
    let teamMembers: string[] = [];
    if (leader.isSupervisor) {
      teamMembers = leader.supervisees.map(e => e.id);
    } else if (leader.isManager || leader.isCEO) {
      teamMembers = leader.managedEmployees.map(e => e.id);
    }

    const teamSize = teamMembers.length;

    // Calcular metas batidas pela equipe
    const teamGoalEvaluations = await prisma.goalEvaluation.findMany({
      where: {
        employeeId: { in: teamMembers },
        date: { gte: startDate, lte: endDate }
      }
    });

    const goalsAchieved = teamGoalEvaluations.filter(e => e.achieved).length;
    const totalGoals = teamGoalEvaluations.length;
    const goalsPercentage = totalGoals > 0 ? (goalsAchieved / totalGoals) * 100 : 0;

    // Nota média da equipe
    const avgTeamRating = teamGoalEvaluations.length > 0
      ? teamGoalEvaluations.reduce((sum, e) => sum + e.rating, 0) / teamGoalEvaluations.length
      : 0;

    // Avaliações de liderança recebidas
    const leadershipEvaluations = await prisma.leadershipEvaluation.findMany({
      where: {
        leaderId,
        OR: [
          { weekStart: { gte: startDate, lte: endDate } },
          { createdAt: { gte: startDate, lte: endDate } }
        ]
      }
    });

    const avgLeadershipRating = leadershipEvaluations.length > 0
      ? leadershipEvaluations.reduce((sum, e) => sum + e.overallRating, 0) / leadershipEvaluations.length
      : 0;

    // Calcular frequência e pontualidade (simplificado - pode ser expandido)
    const timeRecords = await prisma.timeRecord.count({
      where: {
        employeeId: { in: teamMembers },
        dateTime: { gte: startDate, lte: endDate }
      }
    });
    const avgAttendance = teamSize > 0 ? Math.min((timeRecords / (teamSize * 22)) * 100, 100) : 0;
    const avgPunctuality = avgAttendance; // Simplificado

    // Calcular score final (ponderado)
    // 30% metas + 20% frequência + 20% pontualidade + 15% nota equipe + 15% nota liderança
    const finalScore = 
      (goalsPercentage * 0.30) +
      (avgAttendance * 0.20) +
      (avgPunctuality * 0.20) +
      ((avgTeamRating / 5) * 100 * 0.15) +
      ((avgLeadershipRating / 5) * 100 * 0.15);

    // Buscar período anterior para calcular tendência
    const prevScore = await prisma.leaderPerformanceScore.findFirst({
      where: {
        leaderId,
        periodType,
        period: { lt: period }
      },
      orderBy: { period: 'desc' }
    });

    let trend = 'STABLE';
    if (prevScore) {
      if (finalScore > prevScore.finalScore + 5) trend = 'UP';
      else if (finalScore < prevScore.finalScore - 5) trend = 'DOWN';
    }

    // Upsert score
    const score = await prisma.leaderPerformanceScore.upsert({
      where: {
        leaderId_period_periodType: {
          leaderId,
          period,
          periodType
        }
      },
      update: {
        teamSize,
        goalsAchieved,
        totalGoals,
        goalsPercentage,
        avgAttendance,
        avgPunctuality,
        avgTeamRating,
        avgLeadershipRating,
        finalScore,
        trend
      },
      create: {
        leaderId,
        period,
        periodType,
        teamSize,
        goalsAchieved,
        totalGoals,
        goalsPercentage,
        avgAttendance,
        avgPunctuality,
        avgTeamRating,
        avgLeadershipRating,
        finalScore,
        trend
      }
    });

    console.log(`📊 Score calculado para ${leader.name}: ${finalScore.toFixed(2)} (${trend})`);

    return NextResponse.json({
      ...score,
      leader: {
        id: leader.id,
        name: leader.name,
        position: leader.position
      }
    });
  } catch (error) {
    console.error('Erro ao calcular score:', error);
    return NextResponse.json({ error: 'Erro ao calcular score' }, { status: 500 });
  }
}
