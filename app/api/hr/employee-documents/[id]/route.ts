import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { deleteFile } from '@/lib/s3';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const document = await prisma.employeeDocument.findUnique({
      where: { id: params.id },
      include: {
        employee: true,
        acknowledgment: true,
        documentAck: true,
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });
    }

    return NextResponse.json(document);
  } catch (error: any) {
    console.error('Erro ao buscar documento:', error);
    return NextResponse.json({ error: 'Erro ao buscar documento' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const document = await prisma.employeeDocument.findUnique({
      where: { id: params.id },
    });

    if (!document) {
      return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 });
    }

    // Deletar arquivo do S3 se existir
    if (document.fileUrl) {
      try {
        // Extrair o path do S3 da URL
        const s3Path = document.fileUrl.split('.com/')[1] || document.fileUrl;
        await deleteFile(s3Path);
      } catch (s3Error) {
        console.error('Erro ao deletar arquivo do S3:', s3Error);
        // Continuar com a exclusão do registro mesmo se falhar ao deletar o arquivo
      }
    }

    // Deletar o documento (acknowledgments serão deletados em cascata)
    await prisma.employeeDocument.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao excluir documento:', error);
    return NextResponse.json({ error: 'Erro ao excluir documento' }, { status: 500 });
  }
}
