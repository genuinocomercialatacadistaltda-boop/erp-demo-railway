export const dynamic = 'force-dynamic';


import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getAccountBalance } from '@/lib/cora';

/**
 * API: Sincronizar Saldo da Conta Cora
 * POST /api/financial/cora-integration/sync-balance
 * 
 * Body:
 * {
 *   "bankAccountId": "string"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    const user = session?.user as any;

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { bankAccountId } = body;

    if (!bankAccountId) {
      return NextResponse.json(
        { error: 'bankAccountId é obrigatório' },
        { status: 400 }
      );
    }

    // Verifica se a conta existe
    const bankAccount = await prisma.bankAccount.findUnique({
      where: { id: bankAccountId },
    });

    if (!bankAccount) {
      return NextResponse.json(
        { error: 'Conta bancária não encontrada' },
        { status: 404 }
      );
    }

    // Busca saldo do Cora
    const coraBalance = await getAccountBalance();

    // Atualiza saldo no banco de dados
    const updated = await prisma.bankAccount.update({
      where: { id: bankAccountId },
      data: {
        balance: coraBalance / 100, // Converte centavos para reais
        updatedAt: new Date(),
      },
    });

    // Registra log
    await prisma.coraIntegrationLog.create({
      data: {
        operationType: 'SYNC_BALANCE',
        status: 'SUCCESS',
        recordsProcessed: 1,
        recordsFailed: 0,
        metadata: JSON.stringify({
          bankAccountId,
          oldBalance: bankAccount.balance,
          newBalance: updated.balance,
          coraBalanceCents: coraBalance,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      previousBalance: bankAccount.balance,
      newBalance: updated.balance,
      difference: updated.balance - bankAccount.balance,
    });
  } catch (error: any) {
    console.error('Erro ao sincronizar saldo:', error);

    await prisma.coraIntegrationLog.create({
      data: {
        operationType: 'SYNC_BALANCE',
        status: 'FAILED',
        recordsProcessed: 0,
        recordsFailed: 1,
        errorMessage: error.message,
      },
    });

    return NextResponse.json(
      { error: 'Erro ao sincronizar saldo: ' + error.message },
      { status: 500 }
    );
  }
}
