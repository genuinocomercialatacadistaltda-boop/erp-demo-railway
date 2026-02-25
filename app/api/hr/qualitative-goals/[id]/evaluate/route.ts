export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// POST - Avaliar meta qualitativa
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Verificar se é admin ou líder
    const userType = (session.user as any).userType;
    const evaluatorEmployee = await prisma.employee.findFirst({
      where: { email: session.user.email }
    });

    if (userType !== 'ADMIN' && !evaluatorEmployee?.isSupervisor && !evaluatorEmployee?.isManager && !evaluatorEmployee?.isCEO) {
      return NextResponse.json(
        { error: 'Apenas líderes podem avaliar metas' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { date, achieved, rating, observations, evidence } = body;

    if (!date) {
      return NextResponse.json(
        { error: 'Data é obrigatória' },
        { status: 400 }
      );
    }

    // Verificar se a meta existe
    const goal = await prisma.qualitativeGoal.findUnique({
      where: { id: params.id },
      include: { employee: true }
    });

    if (!goal) {
      return NextResponse.json({ error: 'Meta não encontrada' }, { status: 404 });
    }

    // Verificar se já existe avaliação para esta data
    const existingEvaluation = await prisma.qualitativeGoalEvaluation.findUnique({
      where: {
        goalId_date: {
          goalId: params.id,
          date: new Date(date)
        }
      }
    });

    let evaluation;
    if (existingEvaluation) {
      // Atualizar avaliação existente
      evaluation = await prisma.qualitativeGoalEvaluation.update({
        where: { id: existingEvaluation.id },
        data: {
          achieved: achieved || false,
          rating: rating || 3,
          observations,
          evidence,
          evaluatorId: evaluatorEmployee?.id || existingEvaluation.evaluatorId
        },
        include: {
          goal: {
            select: { id: true, title: true }
          },
          evaluator: {
            select: { id: true, name: true }
          }
        }
      });
      console.log(`📝 Avaliação atualizada: ${evaluation.id}`);
    } else {
      // Criar nova avaliação
      evaluation = await prisma.qualitativeGoalEvaluation.create({
        data: {
          goalId: params.id,
          evaluatorId: evaluatorEmployee?.id || goal.createdById,
          date: new Date(date),
          achieved: achieved || false,
          rating: rating || 3,
          observations,
          evidence
        },
        include: {
          goal: {
            select: { id: true, title: true }
          },
          evaluator: {
            select: { id: true, name: true }
          }
        }
      });
      console.log(`✅ Nova avaliação criada: ${evaluation.id} - Meta: ${goal.title} - ${goal.employee.name}`);
    }

    return NextResponse.json(evaluation, { status: existingEvaluation ? 200 : 201 });
  } catch (error) {
    console.error('Erro ao avaliar meta:', error);
    return NextResponse.json({ error: 'Erro ao avaliar meta' }, { status: 500 });
  }
}
