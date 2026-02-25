export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { uploadFile } from '@/lib/s3';

// GET - Lista documentos do funcionário
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 401 }
      );
    }

    const documents = await prisma.employeeDocument.findMany({
      where: { employeeId: params.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(documents);
  } catch (error) {
    console.error('Erro ao buscar documentos:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar documentos' },
      { status: 500 }
    );
  }
}

// POST - Upload de documento
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const documentType = formData.get('documentType') as string;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string || '';
    const referenceDate = formData.get('referenceDate') as string;

    if (!file || !documentType || !title) {
      return NextResponse.json(
        { error: 'Arquivo, tipo e título são obrigatórios' },
        { status: 400 }
      );
    }

    // Converte arquivo para buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Gera nome único para o arquivo
    const timestamp = Date.now();
    const fileName = `hr/employees/${params.id}/${timestamp}-${file.name}`;
    
    // Upload para S3
    const fileUrl = await uploadFile(buffer, fileName);

    // Cria registro no banco
    const document = await prisma.employeeDocument.create({
      data: {
        employeeId: params.id,
        documentType: documentType as any,
        title,
        description,
        fileUrl,
        fileName: file.name,
        fileSize: file.size,
        referenceDate: referenceDate ? new Date(referenceDate) : null,
        uploadedBy: (session.user as any)?.email || 'Sistema',
      },
    });

    return NextResponse.json(document);
  } catch (error) {
    console.error('Erro ao fazer upload:', error);
    return NextResponse.json(
      { error: 'Erro ao fazer upload do documento' },
      { status: 500 }
    );
  }
}
