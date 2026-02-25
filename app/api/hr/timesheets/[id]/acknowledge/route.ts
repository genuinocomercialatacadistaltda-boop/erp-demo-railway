export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

// Texto dos termos de aceite (versão 1.0)
const TERMS_TEXT_V1 = `
TERMOS DE ACEITE DIGITAL - FOLHA DE PONTO

Ao aceitar digitalmente esta folha de ponto, você declara que:

1. RECONHECIMENTO: Reconhece que os dados apresentados nesta folha de ponto correspondem aos seus registros de entrada e saída durante o período informado.

2. VERACIDADE: Atesta que as informações contidas neste documento são verdadeiras e correspondem às suas atividades laborais.

3. BANCO DE HORAS: Está ciente do saldo de horas (positivo ou negativo) apresentado e concorda com os cálculos realizados.

4. AUSÊNCIAS E AFASTAMENTOS: Confirma as ausências, afastamentos e feriados registrados no período.

5. VALIDADE JURÍDICA: Compreende que esta assinatura digital possui validade jurídica equivalente à assinatura manuscrita, conforme Lei 14.063/2020.

6. RASTREABILIDADE: Está ciente de que esta assinatura é rastreável através do registro de:
   - Data e hora do aceite
   - Endereço IP do dispositivo
   - Identificação do navegador/dispositivo
   - Hash criptográfico do documento

7. NÃO REPÚDIO: Entende que não poderá negar a autoria deste aceite após sua confirmação.

Ao clicar em "Aceito e Concordo", você confirma ter lido e compreendido todos os termos acima.
`

/**
 * POST /api/hr/timesheets/[id]/acknowledge
 * Registra o aceite digital de uma folha de ponto pelo funcionário
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    console.log('[TIMESHEET_ACKNOWLEDGE_POST] Iniciando processo de aceite digital')

    const session = await getServerSession(authOptions)
    console.log('[TIMESHEET_ACKNOWLEDGE_POST] Session userType:', session?.user?.userType, 'employeeId:', (session?.user as any)?.employeeId)

    // Permitir acesso tanto para EMPLOYEE quanto para SELLER (se tiver employeeId)
    if (!session?.user || (session.user.userType !== 'EMPLOYEE' && session.user.userType !== 'SELLER')) {
      console.log('[TIMESHEET_ACKNOWLEDGE_POST] Acesso negado: tipo de usuário inválido')
      return NextResponse.json(
        { error: 'Não autorizado. Apenas funcionários podem assinar folhas de ponto.' },
        { status: 401 }
      )
    }

    const employeeId = (session.user as any).employeeId
    if (!employeeId) {
      console.log('[TIMESHEET_ACKNOWLEDGE_POST] Acesso negado: employeeId não encontrado na sessão')
      return NextResponse.json(
        { error: 'ID do funcionário não encontrado na sessão.' },
        { status: 400 }
      )
    }

    const timesheetId = params.id
    console.log('[TIMESHEET_ACKNOWLEDGE_POST] timesheetId:', timesheetId, 'employeeId:', employeeId)

    // Buscar a folha de ponto
    const timesheet = await prisma.timesheet.findUnique({
      where: { id: timesheetId }
    })

    if (!timesheet) {
      return NextResponse.json(
        { error: 'Folha de ponto não encontrada' },
        { status: 404 }
      )
    }

    // Verificar se a folha pertence ao funcionário
    if (timesheet.employeeId !== employeeId) {
      console.log('[TIMESHEET_ACKNOWLEDGE_POST] Folha não pertence ao funcionário')
      return NextResponse.json(
        { error: 'Você não tem permissão para assinar esta folha de ponto' },
        { status: 403 }
      )
    }

    // Verificar se já existe aceite
    const existingAck = await prisma.timesheetAcknowledgment.findFirst({
      where: {
        timesheetId,
        employeeId,
        acceptedTerms: true
      }
    })

    if (existingAck) {
      console.log('[TIMESHEET_ACKNOWLEDGE_POST] Aceite já existe:', existingAck.id)
      return NextResponse.json(
        { error: 'Esta folha de ponto já foi assinada digitalmente' },
        { status: 409 }
      )
    }

    // Extrair dados do corpo da requisição
    const body = await request.json()
    const { acceptedTerms } = body

    if (!acceptedTerms) {
      return NextResponse.json(
        { error: 'É necessário aceitar os termos para prosseguir' },
        { status: 400 }
      )
    }

    // Capturar dados de rastreabilidade
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Gerar hash do documento para integridade
    const documentContent = JSON.stringify({
      timesheetId: timesheet.id,
      employeeId: timesheet.employeeId,
      employeeName: timesheet.employeeName,
      startDate: timesheet.startDate,
      endDate: timesheet.endDate,
      workedDays: timesheet.workedDays,
      absentDays: timesheet.absentDays,
      balanceMinutes: timesheet.balanceMinutes
    })
    const documentHash = crypto.createHash('sha256').update(documentContent).digest('hex')

    console.log('[TIMESHEET_ACKNOWLEDGE_POST] Criando aceite digital...')

    // Criar registro de aceite
    const acknowledgment = await prisma.timesheetAcknowledgment.create({
      data: {
        employeeId,
        timesheetId,
        acceptedTerms: true,
        acceptanceText: TERMS_TEXT_V1,
        ipAddress,
        userAgent,
        documentHash,
        termsVersion: '1.0'
      }
    })

    console.log('[TIMESHEET_ACKNOWLEDGE_POST] ✅ Aceite criado com sucesso:', acknowledgment.id)

    return NextResponse.json({
      message: 'Folha de ponto assinada digitalmente com sucesso',
      acknowledgmentId: acknowledgment.id,
      acknowledgedAt: acknowledgment.acknowledgedAt
    })

  } catch (error) {
    console.error('[TIMESHEET_ACKNOWLEDGE_POST] ❌ Erro:', error)
    return NextResponse.json(
      {
        error: 'Erro ao processar aceite digital',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/hr/timesheets/[id]/acknowledge
 * Verifica se uma folha de ponto já foi assinada digitalmente
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)

    // Permitir acesso tanto para EMPLOYEE quanto para SELLER (se tiver employeeId)
    if (!session?.user || (session.user.userType !== 'EMPLOYEE' && session.user.userType !== 'SELLER')) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const employeeId = (session.user as any).employeeId
    if (!employeeId) {
      return NextResponse.json(
        { error: 'ID do funcionário não encontrado' },
        { status: 400 }
      )
    }

    const timesheetId = params.id

    const acknowledgment = await prisma.timesheetAcknowledgment.findFirst({
      where: {
        timesheetId,
        employeeId,
        acceptedTerms: true
      }
    })

    return NextResponse.json({
      acknowledged: !!acknowledgment,
      acknowledgedAt: acknowledgment?.acknowledgedAt || null
    })

  } catch (error) {
    console.error('[TIMESHEET_ACKNOWLEDGE_GET] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao verificar aceite' },
      { status: 500 }
    )
  }
}

/**
 * OPTIONS /api/hr/timesheets/[id]/acknowledge
 * Retorna os termos de aceite
 */
export async function OPTIONS() {
  return NextResponse.json({
    termsText: TERMS_TEXT_V1,
    termsVersion: '1.0'
  })
}
