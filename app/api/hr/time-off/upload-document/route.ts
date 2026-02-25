
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { uploadFile } from '@/lib/s3';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    // Validar tipo de arquivo (permite imagens e PDFs)
    const validTypes = [
      'image/jpeg', 
      'image/jpg', 
      'image/png', 
      'image/webp',
      'application/pdf'
    ];
    
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Tipo de arquivo inválido. Use JPEG, PNG, WEBP ou PDF.' 
      }, { status: 400 });
    }

    // Validar tamanho (máximo 10MB para atestados)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: 'Arquivo muito grande. Tamanho máximo: 10MB' 
      }, { status: 400 });
    }

    // Converter arquivo para buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Gerar nome único para o arquivo
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `time-off-documents/${timestamp}-${randomString}.${ext}`;

    console.log('📤 [UPLOAD] Fazendo upload de documento de afastamento:', fileName);

    // Upload para S3
    const cloudStoragePath = await uploadFile(buffer, fileName);

    console.log('✅ [UPLOAD] Upload concluído:', cloudStoragePath);

    return NextResponse.json({ 
      success: true,
      cloudStoragePath,
      message: 'Documento enviado com sucesso!'
    });
  } catch (error: any) {
    console.error('❌ [UPLOAD ERROR] Erro ao fazer upload do documento:', error);
    return NextResponse.json({ 
      error: 'Erro ao fazer upload do documento',
      details: error.message 
    }, { status: 500 });
  }
}
