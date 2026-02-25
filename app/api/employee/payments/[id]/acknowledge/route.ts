export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

/**
 * API para aceite digital de contracheques
 * Conforme Lei 14.063/2020 sobre assinaturas eletrônicas
 */

// Termos e Condições padrão (v1.0)
const TERMS_TEXT_V1 = `TERMO DE ACEITE E DECLARAÇÃO DE RECEBIMENTO DE CONTRACHEQUE

Eu, abaixo identificado(a), DECLARO e CONFIRMO que:

1. RECEBI e LI o contracheque referente aos valores de remuneração apresentados neste documento;

2. ESTOU CIENTE de todos os valores discriminados no contracheque, incluindo:
   - Valores brutos (proventos)
   - Descontos (INSS, IRPF, outros)
   - Valor líquido a receber

3. CONCORDO com os valores apresentados e NÃO TENHO objeções quanto aos mesmos;

4. RECONHEÇO que este aceite digital tem a mesma validade jurídica de uma assinatura manuscrita, conforme Lei 14.063/2020;

5. AUTORIZO o registro eletrônico deste aceite, incluindo data, hora, endereço IP e identificação do dispositivo utilizado;

6. ESTOU CIENTE que este documento servirá como comprovante de recebimento do contracheque para todos os fins legais.

DATA DO ACEITE: Será registrada automaticamente no momento da confirmação.

---

Esta assinatura eletrônica foi realizada de forma livre e consciente, tendo pleno conhecimento de seus efeitos jurídicos.`;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('\n🖊️ [ACKNOWLEDGE_PAYSLIP] Iniciando aceite digital');
    console.log(`   Payment ID: ${params.id}`);

    const session = await getServerSession(authOptions);

    // Validar autenticação - permite EMPLOYEE ou SELLER (se tiver employeeId)
    const userType = (session?.user as any)?.userType;
    const employeeId = (session?.user as any)?.employeeId;

    console.log('[ACKNOWLEDGE_PAYSLIP] Session details:');
    console.log('   UserType:', userType);
    console.log('   EmployeeId:', employeeId);

    if (!session?.user) {
      console.log('[ACKNOWLEDGE_PAYSLIP] Usuário não autenticado');
      return NextResponse.json(
        { error: 'Acesso negado - usuário não autenticado' },
        { status: 401 }
      );
    }

    // Permite EMPLOYEE ou SELLER (desde que tenha employeeId)
    if (userType !== 'EMPLOYEE' && userType !== 'SELLER') {
      console.log('[ACKNOWLEDGE_PAYSLIP] Acesso negado - tipo de usuário inválido:', userType);
      return NextResponse.json(
        { error: 'Acesso negado - você não tem permissão para aceitar contracheques' },
        { status: 401 }
      );
    }

    if (!employeeId) {
      console.log('[ACKNOWLEDGE_PAYSLIP] Employee ID não encontrado na sessão');
      return NextResponse.json(
        { error: 'Employee ID não encontrado na sua sessão' },
        { status: 400 }
      );
    }

    // Buscar o pagamento
    const payment = await prisma.employeePayment.findUnique({
      where: { id: params.id },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            cpf: true
          }
        }
      }
    });

    if (!payment) {
      console.log('[ACKNOWLEDGE_PAYSLIP] Pagamento não encontrado');
      return NextResponse.json(
        { error: 'Pagamento não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se é o pagamento do próprio funcionário
    if (payment.employeeId !== employeeId) {
      console.log('[ACKNOWLEDGE_PAYSLIP] Pagamento não pertence ao funcionário');
      return NextResponse.json(
        { error: 'Você não tem permissão para aceitar este contracheque' },
        { status: 403 }
      );
    }

    // Verificar se já foi aceito
    const existingAck = await prisma.employeePaymentAcknowledgment.findFirst({
      where: {
        paymentId: payment.id,
        employeeId: employeeId
      }
    });

    if (existingAck) {
      console.log('[ACKNOWLEDGE_PAYSLIP] Contracheque já foi aceito anteriormente');
      return NextResponse.json(
        {
          error: 'Este contracheque já foi aceito anteriormente',
          acknowledgedAt: existingAck.acknowledgedAt
        },
        { status: 400 }
      );
    }

    // Capturar dados de rastreabilidade
    const ipAddress = req.headers.get('x-forwarded-for') || 
                      req.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Buscar documento associado (contracheque)
    const document = await prisma.employeeDocument.findFirst({
      where: {
        employeeId: employeeId,
        documentType: 'CONTRACHEQUE',
        referenceDate: {
          gte: new Date(payment.year, payment.month - 1, 1),
          lt: new Date(payment.year, payment.month, 1)
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calcular hash do documento (se existir fileUrl)
    let documentHash: string | null = null;
    if (document?.fileUrl) {
      const hashData = `${document.fileUrl}-${payment.id}-${employeeId}-${new Date().toISOString()}`;
      documentHash = crypto.createHash('sha256').update(hashData).digest('hex');
    }

    console.log('📝 [ACKNOWLEDGE_PAYSLIP] Criando registro de aceite...');
    console.log(`   IP: ${ipAddress}`);
    console.log(`   User Agent: ${userAgent.substring(0, 50)}...`);
    console.log(`   Document Hash: ${documentHash?.substring(0, 20)}...`);

    // Criar registro de aceite
    const acknowledgment = await prisma.employeePaymentAcknowledgment.create({
      data: {
        employeeId: employeeId,
        paymentId: payment.id,
        documentId: document?.id || null,
        ipAddress: ipAddress,
        userAgent: userAgent,
        documentHash: documentHash,
        termsVersion: '1.0',
        acceptedTerms: true,
        acceptanceText: TERMS_TEXT_V1
      },
      include: {
        employee: {
          select: {
            name: true,
            cpf: true
          }
        }
      }
    });

    console.log('✅ [ACKNOWLEDGE_PAYSLIP] Aceite registrado com sucesso!');
    console.log(`   Acknowledgment ID: ${acknowledgment.id}`);
    console.log(`   Data/Hora: ${acknowledgment.acknowledgedAt}`);

    return NextResponse.json({
      success: true,
      message: 'Contracheque aceito com sucesso',
      acknowledgment: {
        id: acknowledgment.id,
        acknowledgedAt: acknowledgment.acknowledgedAt,
        employeeName: acknowledgment.employee.name,
        termsVersion: acknowledgment.termsVersion
      }
    });

  } catch (error: any) {
    console.error('[ACKNOWLEDGE_PAYSLIP] Erro ao processar aceite:', error);
    return NextResponse.json(
      { error: 'Erro ao processar aceite digital', details: error.message },
      { status: 500 }
    );
  }
}

// Endpoint para consultar se um pagamento já foi aceito
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    // Permite EMPLOYEE ou SELLER (desde que tenha employeeId)
    const userType = (session?.user as any)?.userType;
    const employeeId = (session?.user as any)?.employeeId;

    if (!session?.user || (userType !== 'EMPLOYEE' && userType !== 'SELLER')) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 401 });
    }

    if (!employeeId) {
      return NextResponse.json({ error: 'Employee ID não encontrado' }, { status: 400 });
    }

    const acknowledgment = await prisma.employeePaymentAcknowledgment.findFirst({
      where: {
        paymentId: params.id,
        employeeId: employeeId
      },
      select: {
        id: true,
        acknowledgedAt: true,
        termsVersion: true,
        ipAddress: true
      }
    });

    return NextResponse.json({
      acknowledged: !!acknowledgment,
      acknowledgment: acknowledgment || null
    });

  } catch (error: any) {
    console.error('[ACKNOWLEDGE_PAYSLIP_CHECK] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao verificar aceite' },
      { status: 500 }
    );
  }
}

// Endpoint para obter termos e condições
export async function OPTIONS(req: NextRequest) {
  return NextResponse.json({
    terms: TERMS_TEXT_V1,
    version: '1.0',
    legalBasis: 'Lei 14.063/2020 - Assinaturas Eletrônicas'
  });
}
