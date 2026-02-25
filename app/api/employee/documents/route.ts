
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getImageUrl } from '@/lib/s3';

// GET - Retorna documentos do funcionário logado
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // ✅ Aceita tanto EMPLOYEE quanto SELLER (quando tem employeeId)
    const userType = (session.user as any)?.userType;
    if (!session || (userType !== 'EMPLOYEE' && userType !== 'SELLER')) {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 401 }
      );
    }

    const employeeId = (session.user as any)?.employeeId;
    
    if (!employeeId) {
      return NextResponse.json(
        { error: 'ID do funcionário não encontrado na sessão' },
        { status: 400 }
      );
    }

    const documents = await prisma.employeeDocument.findMany({
      where: { employeeId },
      orderBy: {
        referenceDate: 'desc',
      },
      include: {
        documentAck: true, // Incluir informações de assinatura digital
      },
    });

    // Gerar URLs assinadas do S3 para cada documento
    const documentsWithSignedUrls = await Promise.all(
      documents.map(async (doc) => {
        let documentUrl = doc.fileUrl;
        
        // Se o fileUrl é um caminho S3 (sem https://), gerar URL assinada
        if (documentUrl && !documentUrl.startsWith('http')) {
          try {
            documentUrl = await getImageUrl(documentUrl);
            console.log(`📄 [DOCUMENT] URL assinada gerada para: ${doc.title}`);
          } catch (error) {
            console.error(`❌ [DOCUMENT] Erro ao gerar URL assinada para ${doc.title}:`, error);
          }
        }
        
        return {
          ...doc,
          documentUrl, // URL assinada ou URL original
          fileUrl: documentUrl // Também atualiza fileUrl para compatibilidade
        };
      })
    );

    return NextResponse.json(documentsWithSignedUrls);
  } catch (error: any) {
    console.error('Erro ao buscar documentos:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar documentos', details: error.message },
      { status: 500 }
    );
  }
}
