export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getImageUrl } from '@/lib/s3';

// GET - Gera URL assinada sob demanda para o documento
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    const userType = (session?.user as any)?.userType;
    if (!session || (userType !== 'EMPLOYEE' && userType !== 'SELLER' && userType !== 'ADMIN')) {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 401 }
      );
    }

    const employeeId = (session.user as any)?.employeeId;
    
    // Busca o documento
    const document = await prisma.employeeDocument.findUnique({
      where: { id: params.id },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Documento não encontrado' },
        { status: 404 }
      );
    }

    // Verifica se o documento pertence ao funcionário (exceto admin)
    if (userType !== 'ADMIN' && document.employeeId !== employeeId) {
      return NextResponse.json(
        { error: 'Acesso negado a este documento' },
        { status: 403 }
      );
    }

    // Gera URL assinada
    let signedUrl = document.fileUrl;
    
    if (signedUrl && !signedUrl.startsWith('http')) {
      signedUrl = await getImageUrl(signedUrl);
    }

    console.log(`📄 [SIGNED-URL] URL assinada gerada para documento: ${document.title}`);

    return NextResponse.json({ signedUrl });
  } catch (error: any) {
    console.error('Erro ao gerar URL assinada:', error);
    return NextResponse.json(
      { error: 'Erro ao gerar URL assinada', details: error.message },
      { status: 500 }
    );
  }
}
