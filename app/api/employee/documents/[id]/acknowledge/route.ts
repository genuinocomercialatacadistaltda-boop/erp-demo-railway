import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

// OPTIONS - Retorna os termos e condições para assinatura
export async function OPTIONS(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const terms = `TERMO DE ACEITE DIGITAL - FOLHA DE PONTO

Ao assinar digitalmente esta folha de ponto, eu, funcionário(a) da empresa ESPETOS GENUÍNO, declaro:

1. CONFERÊNCIA DOS REGISTROS
   - Conferi todos os registros de entrada, saída e intervalos;
   - As horas trabalhadas correspondem aos dias efetivamente trabalhados;
   - Os apontamentos de horas extras estão corretos.

2. AUSÊNCIAS E FALTAS
   - As ausências, faltas e atrasos registrados são verídicos;
   - Os abonos e justificativas foram corretamente lançados.

3. VALIDADE JURÍDICA
   - Esta assinatura eletrônica tem validade jurídica conforme a Lei 14.063/2020;
   - Autorizo o registro de data, hora, IP e dispositivo utilizados neste aceite.

4. CONCORDÂNCIA
   - Declaro que li e compreendi todas as informações desta folha de ponto;
   - Estou de acordo com os registros apresentados.`;

  return NextResponse.json({ terms });
}

// GET - Verifica se o documento foi assinado
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

    const acknowledgment = await prisma.documentAcknowledgment.findUnique({
      where: { documentId: params.id },
    });

    return NextResponse.json({ 
      acknowledged: !!acknowledgment,
      acknowledgment 
    });
  } catch (error: any) {
    console.error('Erro ao verificar assinatura:', error);
    return NextResponse.json(
      { error: 'Erro ao verificar assinatura', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Assina o documento digitalmente
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    const userType = (session?.user as any)?.userType;
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

    // Verifica se o documento pertence ao funcionário
    if (document.employeeId !== employeeId) {
      return NextResponse.json(
        { error: 'Acesso negado a este documento' },
        { status: 403 }
      );
    }

    // Verifica se já foi assinado
    const existingAck = await prisma.documentAcknowledgment.findUnique({
      where: { documentId: params.id },
    });

    if (existingAck) {
      return NextResponse.json(
        { error: 'Este documento já foi assinado digitalmente' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { acceptanceText } = body;

    if (!acceptanceText) {
      return NextResponse.json(
        { error: 'Texto de aceitação é obrigatório' },
        { status: 400 }
      );
    }

    // Cria o registro de assinatura
    const acknowledgment = await prisma.documentAcknowledgment.create({
      data: {
        documentId: params.id,
        employeeId,
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown',
        acceptanceText,
      },
    });

    console.log(`🔏 [DOCUMENT_ACK] Documento assinado: ${document.title} por funcionário ${employeeId}`);

    return NextResponse.json({ 
      success: true, 
      acknowledgment 
    });
  } catch (error: any) {
    console.error('Erro ao assinar documento:', error);
    return NextResponse.json(
      { error: 'Erro ao assinar documento', details: error.message },
      { status: 500 }
    );
  }
}
