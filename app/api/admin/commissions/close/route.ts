
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

/**
 * API para fechar comissões do mês
 * POST /api/admin/commissions/close
 * 
 * Fecha as comissões de todos os vendedores para o mês especificado
 * Atenção: Usa timezone de Brasília (UTC-3) para cálculos de data
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { referenceMonth, sellerId } = body; // referenceMonth formato: "2025-11"

    if (!referenceMonth) {
      return NextResponse.json({ error: 'Mês de referência é obrigatório' }, { status: 400 });
    }

    // Valida formato do mês
    const monthRegex = /^\d{4}-\d{2}$/;
    if (!monthRegex.test(referenceMonth)) {
      return NextResponse.json({ 
        error: 'Formato inválido. Use YYYY-MM (ex: 2025-11)' 
      }, { status: 400 });
    }

    // Função para obter data em Brasília (UTC-3)
    const getBrasiliaDate = (date: Date = new Date()) => {
      const brasiliaOffset = -3 * 60; // UTC-3 em minutos
      const utcTime = date.getTime() + (date.getTimezoneOffset() * 60000);
      return new Date(utcTime + (brasiliaOffset * 60000));
    };

    // Calcula início e fim do mês em Brasília
    const [year, month] = referenceMonth.split('-').map(Number);
    const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 3, 0, 0)); // 00:00 Brasília = 03:00 UTC
    const endOfMonth = new Date(Date.UTC(year, month, 1, 2, 59, 59)); // 23:59:59 Brasília = 02:59:59 UTC do dia seguinte

    console.log('📅 Fechamento de Comissões:');
    console.log('  Mês de referência:', referenceMonth);
    console.log('  Início (Brasília):', startOfMonth.toISOString());
    console.log('  Fim (Brasília):', endOfMonth.toISOString());
    console.log('  Vendedor específico:', sellerId || 'Todos');

    // Busca todos os vendedores ativos ou um específico
    const sellers = sellerId 
      ? await prisma.seller.findMany({ where: { id: sellerId, isActive: true } })
      : await prisma.seller.findMany({ where: { isActive: true } });

    if (sellers.length === 0) {
      return NextResponse.json({ 
        error: 'Nenhum vendedor ativo encontrado' 
      }, { status: 404 });
    }

    const closures = [];
    const errors = [];

    // Processa cada vendedor
    for (const seller of sellers) {
      try {
        // Verifica se já existe fechamento para este mês
        const existingClosure = await prisma.commissionClosure.findUnique({
          where: {
            sellerId_referenceMonth: {
              sellerId: seller.id,
              referenceMonth: referenceMonth,
            },
          },
        });

        if (existingClosure) {
          errors.push({
            sellerId: seller.id,
            sellerName: seller.name,
            error: 'Fechamento já existe para este mês',
          });
          continue;
        }

        // Busca comissões do período que ainda não foram fechadas
        const commissions = await prisma.commission.findMany({
          where: {
            sellerId: seller.id,
            closureId: null, // Apenas comissões não fechadas
            createdAt: {
              gte: startOfMonth,
              lte: endOfMonth,
            },
          },
          include: {
            Seller: true,
          },
        });

        if (commissions.length === 0) {
          errors.push({
            sellerId: seller.id,
            sellerName: seller.name,
            error: 'Nenhuma comissão encontrada no período',
          });
          continue;
        }

        // Calcula total
        const totalAmount = commissions.reduce((sum: number, c: any) => sum + c.amount, 0);

        // Cria fechamento
        const closure = await prisma.commissionClosure.create({
          data: {
            id: uuidv4(),
            sellerId: seller.id,
            referenceMonth: referenceMonth,
            totalAmount: totalAmount,
            status: 'PENDING',
            closedBy: (session.user as any).id,
          },
        });

        // Atualiza as comissões para vincular ao fechamento
        await prisma.commission.updateMany({
          where: {
            id: {
              in: commissions.map((c: any) => c.id),
            },
          },
          data: {
            closureId: closure.id,
            status: 'RELEASED', // Marca como liberado
            releaseDate: getBrasiliaDate(),
            releasedBy: (session.user as any).id,
          },
        });

        closures.push({
          closureId: closure.id,
          sellerId: seller.id,
          sellerName: seller.name,
          totalAmount: totalAmount,
          commissionsCount: commissions.length,
        });

        console.log(`✅ Fechamento criado para ${seller.name}: R$ ${totalAmount.toFixed(2)}`);
      } catch (error: any) {
        errors.push({
          sellerId: seller.id,
          sellerName: seller.name,
          error: error.message,
        });
        console.error(`❌ Erro ao processar ${seller.name}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `${closures.length} fechamento(s) criado(s)`,
      closures,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('❌ Erro ao fechar comissões:', error);
    return NextResponse.json(
      { error: 'Erro ao fechar comissões', details: error.message },
      { status: 500 }
    );
  }
}
