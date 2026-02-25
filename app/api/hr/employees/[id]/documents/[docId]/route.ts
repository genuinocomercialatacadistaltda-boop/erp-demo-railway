
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { deleteFile } from '@/lib/s3';

// DELETE - Remove documento
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 401 }
      );
    }

    // Busca documento
    const document = await prisma.employeeDocument.findUnique({
      where: { id: params.docId },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Documento não encontrado' },
        { status: 404 }
      );
    }

    if (document.employeeId !== params.id) {
      return NextResponse.json(
        { error: 'Documento não pertence ao funcionário' },
        { status: 400 }
      );
    }

    // Remove do S3
    try {
      const key = document.fileUrl.split('/').slice(3).join('/'); // Remove domínio S3
      await deleteFile(key);
    } catch (error) {
      console.error('Erro ao deletar arquivo do S3:', error);
      // Continua mesmo se falhar o delete do S3
    }

    // Remove do banco
    await prisma.employeeDocument.delete({
      where: { id: params.docId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir documento:', error);
    return NextResponse.json(
      { error: 'Erro ao excluir documento' },
      { status: 500 }
    );
  }
}

// GET - Busca documento específico
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 401 }
      );
    }

    const document = await prisma.employeeDocument.findUnique({
      where: { id: params.docId },
      include: {
        employee: {
          select: {
            name: true,
            employeeNumber: true,
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Documento não encontrado' },
        { status: 404 }
      );
    }

    if (document.employeeId !== params.id) {
      return NextResponse.json(
        { error: 'Documento não pertence ao funcionário' },
        { status: 400 }
      );
    }

    return NextResponse.json(document);
  } catch (error) {
    console.error('Erro ao buscar documento:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar documento' },
      { status: 500 }
    );
  }
}
