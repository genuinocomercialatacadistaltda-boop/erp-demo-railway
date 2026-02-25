export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

interface CardTransactionData {
  cardType: 'DEBIT' | 'CREDIT';
  status: 'PENDING' | 'RECEIVED' | 'CANCELLED';
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
}

// GET - Resumo de transações com cartão
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const whereConditions: any = {};

    if (startDate) {
      whereConditions.saleDate = {
        ...whereConditions.saleDate,
        gte: new Date(startDate),
      };
    }

    if (endDate) {
      whereConditions.saleDate = {
        ...whereConditions.saleDate,
        lte: new Date(endDate),
      };
    }

    // Buscar todas as transações do período
    const transactions = await prisma.cardTransaction.findMany({
      where: whereConditions,
    }) as CardTransactionData[];

    // Calcular totais
    const summary = {
      // Débito
      debit: {
        pending: {
          count: transactions.filter((t: CardTransactionData) => t.cardType === 'DEBIT' && t.status === 'PENDING').length,
          grossAmount: transactions.filter((t: CardTransactionData) => t.cardType === 'DEBIT' && t.status === 'PENDING').reduce((sum: number, t: CardTransactionData) => sum + t.grossAmount, 0),
          feeAmount: transactions.filter((t: CardTransactionData) => t.cardType === 'DEBIT' && t.status === 'PENDING').reduce((sum: number, t: CardTransactionData) => sum + t.feeAmount, 0),
          netAmount: transactions.filter((t: CardTransactionData) => t.cardType === 'DEBIT' && t.status === 'PENDING').reduce((sum: number, t: CardTransactionData) => sum + t.netAmount, 0),
        },
        received: {
          count: transactions.filter((t: CardTransactionData) => t.cardType === 'DEBIT' && t.status === 'RECEIVED').length,
          grossAmount: transactions.filter((t: CardTransactionData) => t.cardType === 'DEBIT' && t.status === 'RECEIVED').reduce((sum: number, t: CardTransactionData) => sum + t.grossAmount, 0),
          feeAmount: transactions.filter((t: CardTransactionData) => t.cardType === 'DEBIT' && t.status === 'RECEIVED').reduce((sum: number, t: CardTransactionData) => sum + t.feeAmount, 0),
          netAmount: transactions.filter((t: CardTransactionData) => t.cardType === 'DEBIT' && t.status === 'RECEIVED').reduce((sum: number, t: CardTransactionData) => sum + t.netAmount, 0),
        },
        total: {
          count: transactions.filter((t: CardTransactionData) => t.cardType === 'DEBIT').length,
          grossAmount: transactions.filter((t: CardTransactionData) => t.cardType === 'DEBIT').reduce((sum: number, t: CardTransactionData) => sum + t.grossAmount, 0),
          feeAmount: transactions.filter((t: CardTransactionData) => t.cardType === 'DEBIT').reduce((sum: number, t: CardTransactionData) => sum + t.feeAmount, 0),
          netAmount: transactions.filter((t: CardTransactionData) => t.cardType === 'DEBIT').reduce((sum: number, t: CardTransactionData) => sum + t.netAmount, 0),
        },
      },
      
      // Crédito
      credit: {
        pending: {
          count: transactions.filter((t: CardTransactionData) => t.cardType === 'CREDIT' && t.status === 'PENDING').length,
          grossAmount: transactions.filter((t: CardTransactionData) => t.cardType === 'CREDIT' && t.status === 'PENDING').reduce((sum: number, t: CardTransactionData) => sum + t.grossAmount, 0),
          feeAmount: transactions.filter((t: CardTransactionData) => t.cardType === 'CREDIT' && t.status === 'PENDING').reduce((sum: number, t: CardTransactionData) => sum + t.feeAmount, 0),
          netAmount: transactions.filter((t: CardTransactionData) => t.cardType === 'CREDIT' && t.status === 'PENDING').reduce((sum: number, t: CardTransactionData) => sum + t.netAmount, 0),
        },
        received: {
          count: transactions.filter((t: CardTransactionData) => t.cardType === 'CREDIT' && t.status === 'RECEIVED').length,
          grossAmount: transactions.filter((t: CardTransactionData) => t.cardType === 'CREDIT' && t.status === 'RECEIVED').reduce((sum: number, t: CardTransactionData) => sum + t.grossAmount, 0),
          feeAmount: transactions.filter((t: CardTransactionData) => t.cardType === 'CREDIT' && t.status === 'RECEIVED').reduce((sum: number, t: CardTransactionData) => sum + t.feeAmount, 0),
          netAmount: transactions.filter((t: CardTransactionData) => t.cardType === 'CREDIT' && t.status === 'RECEIVED').reduce((sum: number, t: CardTransactionData) => sum + t.netAmount, 0),
        },
        total: {
          count: transactions.filter((t: CardTransactionData) => t.cardType === 'CREDIT').length,
          grossAmount: transactions.filter((t: CardTransactionData) => t.cardType === 'CREDIT').reduce((sum: number, t: CardTransactionData) => sum + t.grossAmount, 0),
          feeAmount: transactions.filter((t: CardTransactionData) => t.cardType === 'CREDIT').reduce((sum: number, t: CardTransactionData) => sum + t.feeAmount, 0),
          netAmount: transactions.filter((t: CardTransactionData) => t.cardType === 'CREDIT').reduce((sum: number, t: CardTransactionData) => sum + t.netAmount, 0),
        },
      },

      // Geral
      overall: {
        pending: {
          count: transactions.filter((t: CardTransactionData) => t.status === 'PENDING').length,
          grossAmount: transactions.filter((t: CardTransactionData) => t.status === 'PENDING').reduce((sum: number, t: CardTransactionData) => sum + t.grossAmount, 0),
          feeAmount: transactions.filter((t: CardTransactionData) => t.status === 'PENDING').reduce((sum: number, t: CardTransactionData) => sum + t.feeAmount, 0),
          netAmount: transactions.filter((t: CardTransactionData) => t.status === 'PENDING').reduce((sum: number, t: CardTransactionData) => sum + t.netAmount, 0),
        },
        received: {
          count: transactions.filter((t: CardTransactionData) => t.status === 'RECEIVED').length,
          grossAmount: transactions.filter((t: CardTransactionData) => t.status === 'RECEIVED').reduce((sum: number, t: CardTransactionData) => sum + t.grossAmount, 0),
          feeAmount: transactions.filter((t: CardTransactionData) => t.status === 'RECEIVED').reduce((sum: number, t: CardTransactionData) => sum + t.feeAmount, 0),
          netAmount: transactions.filter((t: CardTransactionData) => t.status === 'RECEIVED').reduce((sum: number, t: CardTransactionData) => sum + t.netAmount, 0),
        },
        total: {
          count: transactions.length,
          grossAmount: transactions.reduce((sum: number, t: CardTransactionData) => sum + t.grossAmount, 0),
          feeAmount: transactions.reduce((sum: number, t: CardTransactionData) => sum + t.feeAmount, 0),
          netAmount: transactions.reduce((sum: number, t: CardTransactionData) => sum + t.netAmount, 0),
        },
      },
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Erro ao buscar resumo:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar resumo' },
      { status: 500 }
    );
  }
}
