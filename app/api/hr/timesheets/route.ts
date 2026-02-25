export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

// POST: Criar nova folha de ponto
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const data = await request.json();

    const {
      employeeId,
      employeeName,
      employeeNumber,
      startDate,
      endDate,
      totalDays,
      workedDays,
      absentDays,
      timeOffDays,
      holidayDays,
      totalMinutesWorked,
      totalMinutesExpected,
      balanceMinutes,
      pdfUrl,
    } = data;

    const timesheet = await prisma.timesheet.create({
      data: {
        employeeId,
        employeeName,
        employeeNumber,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        totalDays,
        workedDays,
        absentDays,
        timeOffDays,
        holidayDays,
        totalMinutesWorked,
        totalMinutesExpected,
        balanceMinutes,
        pdfUrl,
        generatedBy: session.user?.email || 'admin',
      },
    });

    return NextResponse.json(timesheet);
  } catch (error: any) {
    console.error('Erro ao criar folha de ponto:', error);
    return NextResponse.json(
      { error: 'Erro ao criar folha de ponto', details: error.message },
      { status: 500 }
    );
  }
}

// GET: Buscar folhas de ponto
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');

    // Se não for admin, só pode ver suas próprias folhas
    const isAdmin = (session.user as any)?.userType === 'ADMIN';
    
    // Busca o funcionário associado ao usuário logado se não for admin
    let userEmployeeId = employeeId;
    if (!isAdmin) {
      const employee = await prisma.employee.findFirst({
        where: {
          email: session.user?.email || '',
        },
      });
      
      if (!employee) {
        return NextResponse.json(
          { error: 'Funcionário não encontrado' },
          { status: 404 }
        );
      }
      
      userEmployeeId = employee.id;
    }

    const timesheets = await prisma.timesheet.findMany({
      where: userEmployeeId ? { employeeId: userEmployeeId } : {},
      orderBy: {
        generatedAt: 'desc',
      },
      include: {
        employee: {
          select: {
            name: true,
            employeeNumber: true,
          },
        },
        acknowledgments: {
          where: {
            acceptedTerms: true,
          },
          select: {
            id: true,
            acknowledgedAt: true,
            ipAddress: true,
          },
        },
      },
    });

    // Para cada timesheet, verificar se existe assinatura no sistema de DocumentAcknowledgment
    // (via EmployeeDocument com tipo FOLHA_PONTO)
    const result = await Promise.all(timesheets.map(async (ts) => {
      // Se já tem assinatura no sistema direto, retorna como está
      if (ts.acknowledgments.length > 0) {
        return ts;
      }
      
      // Buscar documento FOLHA_PONTO correspondente ao período
      const startStr = ts.startDate.toISOString().split('T')[0].split('-').reverse().join('/');
      const endStr = ts.endDate.toISOString().split('T')[0].split('-').reverse().join('/');
      
      const doc = await prisma.employeeDocument.findFirst({
        where: {
          employeeId: ts.employeeId,
          documentType: 'FOLHA_PONTO',
          title: { contains: startStr }
        },
        include: {
          documentAck: {
            select: {
              id: true,
              acknowledgedAt: true,
            }
          }
        }
      });
      
      // Se encontrou documento com assinatura, incluir na resposta
      if (doc?.documentAck) {
        return {
          ...ts,
          acknowledgments: [{
            id: doc.documentAck.id,
            acknowledgedAt: doc.documentAck.acknowledgedAt,
            ipAddress: null,
            source: 'documentAck'
          }]
        };
      }
      
      return ts;
    }));

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Erro ao buscar folhas de ponto:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar folhas de ponto', details: error.message },
      { status: 500 }
    );
  }
}
