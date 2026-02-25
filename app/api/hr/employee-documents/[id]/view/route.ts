export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { downloadFile } from '@/lib/s3';

// GET - Obter URL assinada do documento
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const document = await prisma.employeeDocument.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        fileUrl: true,
        employeeId: true,
        documentType: true,
        title: true,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Documento não encontrado' },
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
      
      if (!employee || employee.id !== document.employeeId) {
        return NextResponse.json(
          { error: 'Sem permissão para acessar este documento' },
          { status: 403 }
        );
      }
    }

    if (!document.fileUrl) {
      return NextResponse.json(
        { error: 'Arquivo não disponível' },
        { status: 404 }
      );
    }

    // Se já é uma URL completa, retornar diretamente
    if (document.fileUrl.startsWith('http')) {
      return NextResponse.json({ url: document.fileUrl });
    }

    // Gerar URL assinada do S3
    const signedUrl = await downloadFile(document.fileUrl);
    
    return NextResponse.json({ url: signedUrl });
  } catch (error) {
    console.error('Erro ao buscar documento:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar documento' },
      { status: 500 }
    );
  }
}
