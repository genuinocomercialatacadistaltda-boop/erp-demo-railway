export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { downloadFile } from '@/lib/s3';

// GET - Obter URL assinada do PDF da folha de ponto
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const timesheet = await prisma.timesheet.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        pdfUrl: true,
        employeeId: true,
      },
    });

    if (!timesheet) {
      return NextResponse.json(
        { error: 'Folha de ponto não encontrada' },
        { status: 404 }
      );
    }

    // Verificar permissão (admin ou próprio funcionário)
    const userType = (session.user as any)?.userType;
    const userEmail = session.user?.email;
    
    if (userType !== 'ADMIN') {
      // Verificar se é o próprio funcionário
      const employee = await prisma.employee.findFirst({
        where: { email: userEmail || '' },
      });
      
      if (!employee || employee.id !== timesheet.employeeId) {
        return NextResponse.json(
          { error: 'Sem permissão para acessar este documento' },
          { status: 403 }
        );
      }
    }

    if (!timesheet.pdfUrl) {
      return NextResponse.json(
        { error: 'PDF não disponível para esta folha de ponto' },
        { status: 404 }
      );
    }

    // Se já é uma URL completa, retornar diretamente
    if (timesheet.pdfUrl.startsWith('http')) {
      return NextResponse.json({ url: timesheet.pdfUrl });
    }

    // Gerar URL assinada do S3
    const signedUrl = await downloadFile(timesheet.pdfUrl);
    
    return NextResponse.json({ url: signedUrl });
  } catch (error) {
    console.error('Erro ao buscar PDF:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar PDF' },
      { status: 500 }
    );
  }
}
