export const dynamic = 'force-dynamic';


import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getBankStatements, BankStatementFilters } from '@/lib/cora';

/**
 * API: Importar Extratos do Banco Cora
 * POST /api/financial/cora-integration/import-statements
 * 
 * Body:
 * {
 *   "bankAccountId": "string",
 *   "startDate": "YYYY-MM-DD",
 *   "endDate": "YYYY-MM-DD",
 *   "autoReconcile": boolean (opcional)
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
    const { bankAccountId, startDate, endDate, autoReconcile = false } = body;

    if (!bankAccountId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Parâmetros obrigatórios: bankAccountId, startDate, endDate' },
        { status: 400 }
      );
    }

    // Verifica se a conta bancária existe
    const bankAccount = await prisma.bankAccount.findUnique({
      where: { id: bankAccountId },
    });

    if (!bankAccount) {
      return NextResponse.json(
        { error: 'Conta bancária não encontrada' },
        { status: 404 }
      );
    }

    // Busca extratos do Cora
    const filters: BankStatementFilters = {
      startDate,
      endDate,
      type: 'ALL',
    };

    const coraTransactions = await getBankStatements(filters);

    // Estatísticas de importação
    let imported = 0;
    let skipped = 0;
    let reconciled = 0;
    const errors: string[] = [];

    // Importa cada transação
    for (const tx of coraTransactions) {
      try {
        // Verifica se já foi importada
        const existing = await prisma.bankStatement.findUnique({
          where: {
            bankAccountId_externalId: {
              bankAccountId: bankAccountId,
              externalId: tx.id,
            },
          },
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Cria o registro de extrato
        const statement = await prisma.bankStatement.create({
          data: {
            bankAccountId: bankAccountId,
            referenceDate: new Date(tx.date),
            externalId: tx.id,
            description: tx.description,
            type: tx.type,
            amount: tx.amount / 100, // Converte centavos para reais
            balance: tx.balance / 100,
            category: tx.category,
            metadata: JSON.stringify(tx.metadata),
            isReconciled: false,
          },
        });

        imported++;

        // Auto-reconciliação (se habilitada)
        if (autoReconcile) {
          // Busca transações no sistema que podem corresponder
          const matchingTransaction = await prisma.transaction.findFirst({
            where: {
              bankAccountId: bankAccountId,
              date: {
                gte: new Date(new Date(tx.date).getTime() - 2 * 24 * 60 * 60 * 1000), // 2 dias antes
                lte: new Date(new Date(tx.date).getTime() + 2 * 24 * 60 * 60 * 1000), // 2 dias depois
              },
              amount: Math.abs(tx.amount / 100),
              type: tx.type === 'CREDIT' ? 'INCOME' : 'EXPENSE',
            },
          });

          if (matchingTransaction) {
            await prisma.bankStatement.update({
              where: { id: statement.id },
              data: {
                isReconciled: true,
                reconciledWith: matchingTransaction.id,
              },
            });
            reconciled++;
          }
        }
      } catch (error: any) {
        console.error(`Erro ao importar transação ${tx.id}:`, error);
        errors.push(`${tx.id}: ${error.message}`);
      }
    }

    // Registra log de integração
    await prisma.coraIntegrationLog.create({
      data: {
        operationType: 'IMPORT_STATEMENT',
        status: errors.length > 0 ? 'PARTIAL' : 'SUCCESS',
        recordsProcessed: imported + skipped,
        recordsFailed: errors.length,
        errorMessage: errors.length > 0 ? errors.join('; ') : null,
        metadata: JSON.stringify({
          startDate,
          endDate,
          bankAccountId,
          imported,
          skipped,
          reconciled,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      summary: {
        total: coraTransactions.length,
        imported,
        skipped,
        reconciled,
        errors: errors.length,
      },
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Erro ao importar extratos Cora:', error);
    
    // Registra log de erro
    await prisma.coraIntegrationLog.create({
      data: {
        operationType: 'IMPORT_STATEMENT',
        status: 'FAILED',
        recordsProcessed: 0,
        recordsFailed: 0,
        errorMessage: error.message,
      },
    });

    return NextResponse.json(
      { error: 'Erro ao importar extratos: ' + error.message },
      { status: 500 }
    );
  }
}

/**
 * GET: Lista logs de importação
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    const user = session?.user as any;

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    const logs = await prisma.coraIntegrationLog.findMany({
      where: {
        operationType: 'IMPORT_STATEMENT',
      },
      orderBy: {
        executedAt: 'desc',
      },
      take: limit,
    });

    return NextResponse.json(logs);
  } catch (error: any) {
    console.error('Erro ao buscar logs:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar logs: ' + error.message },
      { status: 500 }
    );
  }
}
