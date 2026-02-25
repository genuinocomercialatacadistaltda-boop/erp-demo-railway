export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { uploadFile } from '@/lib/s3';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('\n📄 [UPLOAD-PAYSLIP] Iniciando upload de contracheque...');
    
    const session = await getServerSession(authOptions);
    const userType = (session?.user as any)?.userType;

    if (!session || userType !== 'ADMIN') {
      console.log('❌ [UPLOAD-PAYSLIP] Acesso negado');
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 401 }
      );
    }

    const { id: employeeId } = params;
    console.log(`📋 [UPLOAD-PAYSLIP] Employee ID: ${employeeId}`);

    // Verificar se o funcionário existe
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId }
    });

    if (!employee) {
      console.log('❌ [UPLOAD-PAYSLIP] Funcionário não encontrado');
      return NextResponse.json(
        { error: 'Funcionário não encontrado' },
        { status: 404 }
      );
    }

    console.log(`✅ [UPLOAD-PAYSLIP] Funcionário encontrado: ${employee.name}`);

    // Processar o arquivo
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const month = parseInt(formData.get('month') as string);
    const year = parseInt(formData.get('year') as string);

    if (!file) {
      console.log('❌ [UPLOAD-PAYSLIP] Nenhum arquivo enviado');
      return NextResponse.json(
        { error: 'Nenhum arquivo enviado' },
        { status: 400 }
      );
    }

    console.log(`📁 [UPLOAD-PAYSLIP] Arquivo recebido: ${file.name}`);
    console.log(`📅 [UPLOAD-PAYSLIP] Mês/Ano: ${month}/${year}`);

    // Validar tipo de arquivo
    if (file.type !== 'application/pdf') {
      console.log(`❌ [UPLOAD-PAYSLIP] Tipo inválido: ${file.type}`);
      return NextResponse.json(
        { error: 'Apenas arquivos PDF são permitidos' },
        { status: 400 }
      );
    }

    // Converter para buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    console.log(`📦 [UPLOAD-PAYSLIP] Buffer criado: ${buffer.length} bytes`);

    // Fazer upload para o S3
    const fileName = `${Date.now()}-contracheque-${employee.name.replace(/\s+/g, '-')}-${month}-${year}.pdf`;
    const s3Key = `payroll-sheets/individual/${year}/${month}/${fileName}`;
    
    console.log(`☁️  [UPLOAD-PAYSLIP] Fazendo upload para S3: ${s3Key}`);
    const cloudStoragePath = await uploadFile(buffer, s3Key);
    console.log(`✅ [UPLOAD-PAYSLIP] Upload concluído: ${cloudStoragePath}`);

    // Verificar se já existe um documento para este mês/ano
    const existingDoc = await prisma.employeeDocument.findFirst({
      where: {
        employeeId,
        documentType: 'CONTRACHEQUE',
        referenceDate: new Date(year, month - 1, 1)
      }
    });

    let document;

    if (existingDoc) {
      console.log(`🔄 [UPLOAD-PAYSLIP] Atualizando documento existente: ${existingDoc.id}`);
      // Atualizar documento existente
      document = await prisma.employeeDocument.update({
        where: { id: existingDoc.id },
        data: {
          fileUrl: cloudStoragePath,
          fileName: file.name,
          fileSize: buffer.length,
          title: `Contracheque ${month}/${year}`,
          notes: 'Contracheque individual atualizado'
        }
      });
    } else {
      console.log('➕ [UPLOAD-PAYSLIP] Criando novo documento');
      // Criar novo documento
      document = await prisma.employeeDocument.create({
        data: {
          employeeId,
          documentType: 'CONTRACHEQUE',
          title: `Contracheque ${month}/${year}`,
          fileUrl: cloudStoragePath,
          fileName: file.name,
          fileSize: buffer.length,
          referenceDate: new Date(year, month - 1, 1),
          uploadedBy: 'Admin',
          notes: 'Contracheque individual'
        }
      });
    }

    console.log(`🎉 [UPLOAD-PAYSLIP] Documento salvo com sucesso: ${document.id}`);

    return NextResponse.json({
      success: true,
      document,
      message: 'Contracheque individual salvo com sucesso'
    });

  } catch (error: any) {
    console.error('❌ [UPLOAD-PAYSLIP] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao fazer upload do contracheque', details: error.message },
      { status: 500 }
    );
  }
}
