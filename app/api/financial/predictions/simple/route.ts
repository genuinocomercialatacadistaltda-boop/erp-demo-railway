
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Função helper para pegar data de Brasília (UTC-3)
function getBrasiliaDate() {
  const now = new Date();
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  const brasiliaTime = new Date(utcTime + (-3 * 3600000));
  return brasiliaTime;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '30');

    // Obter data atual em Brasília
    const now = getBrasiliaDate();
    const currentDay = now.getDate(); // Dia do mês (1-31)
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Primeiro dia do mês atual
    const firstDayOfMonth = new Date(Date.UTC(currentYear, currentMonth, 1, 3, 0, 0)); // UTC+3 = Brasília
    
    // Último dia do mês atual
    const lastDayOfMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59));
    const totalDaysInMonth = lastDayOfMonth.getDate();

    console.log('📊 CÁLCULO DE PREVISÃO:');
    console.log(`   Dia atual: ${currentDay}`);
    console.log(`   Total de dias no mês: ${totalDaysInMonth}`);
    console.log(`   Primeiro dia do mês: ${firstDayOfMonth.toISOString()}`);
    console.log(`   Último dia do mês: ${lastDayOfMonth.toISOString()}`);

    // ============================================
    // 1. RECEITA BRUTA (Faturamento)
    // ============================================
    const orders = await prisma.order.findMany({
      where: {
        status: 'DELIVERED',
        deliveryDate: {
          gte: firstDayOfMonth,
          lte: now,
        },
      },
      select: {
        total: true,
      },
    });

    const receitaBrutaAteHoje = orders.reduce((sum: number, order: any) => sum + Number(order.total), 0);
    const mediaDiariaReceitaBruta = receitaBrutaAteHoje / currentDay;
    const previsaoReceitaBruta = mediaDiariaReceitaBruta * totalDaysInMonth;

    console.log(`   💰 Receita Bruta até hoje: R$ ${receitaBrutaAteHoje.toFixed(2)}`);
    console.log(`   💰 Média diária: R$ ${mediaDiariaReceitaBruta.toFixed(2)}`);
    console.log(`   💰 Previsão para o mês: R$ ${previsaoReceitaBruta.toFixed(2)}`);

    // ============================================
    // 2. RECEITA LÍQUIDA (Valores Efetivamente Pagos/Recebidos)
    // ============================================
    // Buscar receivables pagos no período (tudo que foi pago: dinheiro, cartão, boleto, PIX, etc.)
    const receivablesPagos = await prisma.receivable.findMany({
      where: {
        status: 'PAID',
        paymentDate: {
          gte: firstDayOfMonth,
          lte: now,
        },
      },
      select: {
        amount: true,
        paymentMethod: true,
      },
    });

    const receitaLiquidaAteHoje = receivablesPagos.reduce((sum: number, rec: any) => sum + Number(rec.amount), 0);
    const mediaDiariaReceitaLiquida = receitaLiquidaAteHoje / currentDay;
    const previsaoReceitaLiquida = mediaDiariaReceitaLiquida * totalDaysInMonth;

    console.log(`   💵 Receita Líquida até hoje (PAGO): R$ ${receitaLiquidaAteHoje.toFixed(2)}`);
    console.log(`   💵 Média diária recebida: R$ ${mediaDiariaReceitaLiquida.toFixed(2)}`);
    console.log(`   💵 Previsão para o mês: R$ ${previsaoReceitaLiquida.toFixed(2)}`);

    // ============================================
    // 3. DESPESAS OPERACIONAIS (incluindo Cartões de Crédito)
    // ============================================
    const despesasOperacionais = await prisma.expense.findMany({
      where: {
        expenseType: 'OPERATIONAL',
        dueDate: {
          gte: firstDayOfMonth,
          lte: now,
        },
      },
      select: {
        amount: true,
      },
    });

    // Buscar despesas de cartão de crédito OPERACIONAIS do mês atual (pela data da compra)
    const despesasCartao = await prisma.creditCardExpense.findMany({
      where: {
        expenseType: 'OPERATIONAL',
        purchaseDate: {
          gte: firstDayOfMonth,
          lte: now,
        },
      },
      select: {
        amount: true,
      },
    });

    const despesasOpNormais = despesasOperacionais.reduce((sum: number, e: any) => sum + Number(e.amount), 0);
    const despesasOpCartao = despesasCartao.reduce((sum: number, e: any) => sum + Number(e.amount), 0);
    const despesasOpAteHoje = despesasOpNormais + despesasOpCartao;
    const mediaDiariaDespesasOp = despesasOpAteHoje / currentDay;
    const previsaoDespesasOp = mediaDiariaDespesasOp * totalDaysInMonth;

    console.log(`   📉 Despesas Operacionais até hoje: R$ ${despesasOpAteHoje.toFixed(2)}`);
    console.log(`      - Despesas normais: R$ ${despesasOpNormais.toFixed(2)}`);
    console.log(`      - Cartão de crédito: R$ ${despesasOpCartao.toFixed(2)}`);
    console.log(`   📉 Previsão para o mês: R$ ${previsaoDespesasOp.toFixed(2)}`);

    // ============================================
    // 4. DESPESAS COM PRODUTOS (Compras de Mercadoria)
    // ============================================
    const despesasProdutos = await prisma.expense.findMany({
      where: {
        expenseType: 'PRODUCTS',
        dueDate: {
          gte: firstDayOfMonth,
          lte: now,
        },
      },
      select: {
        amount: true,
      },
    });

    const despesasProdAteHoje = despesasProdutos.reduce((sum: number, e: any) => sum + Number(e.amount), 0);
    const mediaDiariaDespesasProd = despesasProdAteHoje / currentDay;
    const previsaoDespesasProd = mediaDiariaDespesasProd * totalDaysInMonth;

    console.log(`   🛒 Despesas com Produtos até hoje: R$ ${despesasProdAteHoje.toFixed(2)}`);
    console.log(`   🛒 Previsão para o mês: R$ ${previsaoDespesasProd.toFixed(2)}`);

    // ============================================
    // 4B. COMPRAS DE MERCADORIAS (Purchases)
    // ============================================
    const comprasMercadorias = await prisma.purchase.findMany({
      where: {
        customerId: null, // Apenas compras da fábrica (não vendas para clientes)
        createdAt: {
          gte: firstDayOfMonth,
          lte: now,
        },
      },
      select: {
        totalAmount: true,
      },
    });

    const comprasMercadoriasAteHoje = comprasMercadorias.reduce((sum: number, p: any) => sum + Number(p.totalAmount), 0);
    const mediaDiariaComprasMercadorias = comprasMercadoriasAteHoje / currentDay;
    const previsaoComprasMercadorias = mediaDiariaComprasMercadorias * totalDaysInMonth;

    console.log(`   🛍️ Compras de Mercadorias até hoje: R$ ${comprasMercadoriasAteHoje.toFixed(2)}`);
    console.log(`   🛍️ Previsão para o mês: R$ ${previsaoComprasMercadorias.toFixed(2)}`);

    // ============================================
    // 5. INVESTIMENTOS
    // ============================================
    const investimentos = await prisma.expense.findMany({
      where: {
        expenseType: 'INVESTMENT',
        dueDate: {
          gte: firstDayOfMonth,
          lte: now,
        },
      },
      select: {
        amount: true,
      },
    });

    const investimentosAteHoje = investimentos.reduce((sum: number, e: any) => sum + Number(e.amount), 0);
    const mediaDiariaInvestimentos = investimentosAteHoje / currentDay;
    const previsaoInvestimentos = mediaDiariaInvestimentos * totalDaysInMonth;

    console.log(`   📈 Investimentos até hoje: R$ ${investimentosAteHoje.toFixed(2)}`);
    console.log(`   📈 Previsão para o mês: R$ ${previsaoInvestimentos.toFixed(2)}`);

    // ============================================
    // 6. PROLABORE
    // ============================================
    const prolabores = await prisma.expense.findMany({
      where: {
        expenseType: 'PROLABORE',
        dueDate: {
          gte: firstDayOfMonth,
          lte: now,
        },
      },
      select: {
        amount: true,
      },
    });

    const prolaboresAteHoje = prolabores.reduce((sum: number, e: any) => sum + Number(e.amount), 0);
    const mediaDiariaProlabore = prolaboresAteHoje / currentDay;
    const previsaoProlabore = mediaDiariaProlabore * totalDaysInMonth;

    console.log(`   👔 Prolabore até hoje: R$ ${prolaboresAteHoje.toFixed(2)}`);
    console.log(`   👔 Previsão para o mês: R$ ${previsaoProlabore.toFixed(2)}`);

    // ============================================
    // CÁLCULO DOS LUCROS (BRUTO E LÍQUIDO)
    // ============================================
    // LUCRO BRUTO = Receita Bruta - (Despesas Op + Despesas Produtos + Compras)
    const custosDiretosPrevisto = previsaoDespesasOp + previsaoDespesasProd + previsaoComprasMercadorias;
    const lucroBrutoPrevisto = previsaoReceitaBruta - custosDiretosPrevisto;
    
    // LUCRO LÍQUIDO = Lucro Bruto - (Investimentos + Prolabore)
    const custosIndiretosPrevisto = previsaoInvestimentos + previsaoProlabore;
    const lucroLiquidoPrevisto = lucroBrutoPrevisto - custosIndiretosPrevisto;

    console.log(`\n   💰 CÁLCULO DOS LUCROS:`);
    console.log(`      Receita Bruta (Faturamento): R$ ${previsaoReceitaBruta.toFixed(2)}`);
    console.log(`      (-) Despesas Operacionais: R$ ${previsaoDespesasOp.toFixed(2)}`);
    console.log(`      (-) Despesas com Produtos: R$ ${previsaoDespesasProd.toFixed(2)}`);
    console.log(`      (-) Compras de Mercadorias: R$ ${previsaoComprasMercadorias.toFixed(2)}`);
    console.log(`      = LUCRO BRUTO: R$ ${lucroBrutoPrevisto.toFixed(2)}`);
    console.log(`\n      (-) Investimentos: R$ ${previsaoInvestimentos.toFixed(2)}`);
    console.log(`      (-) Prolabore: R$ ${previsaoProlabore.toFixed(2)}`);
    console.log(`      = LUCRO LÍQUIDO: R$ ${lucroLiquidoPrevisto.toFixed(2)}`);

    // ============================================
    // SALDO ATUAL E PROJEÇÃO DE FLUXO DE CAIXA
    // ============================================
    const accounts = await prisma.bankAccount.findMany();
    const currentBalance = accounts.reduce((sum: number, acc: any) => sum + Number(acc.balance), 0);

    // Buscar contas a receber pendentes
    const pendingReceivables = await prisma.receivable.findMany({
      where: { status: 'PENDING' },
      include: { Customer: true },
    });

    // Buscar contas a pagar pendentes
    const pendingExpenses = await prisma.expense.findMany({
      where: { status: 'PENDING' },
      include: { Category: true },
    });

    // Projetar fluxo de caixa com médias do mês atual
    const projection = [];
    let projectedBalance = currentBalance;

    for (let i = 0; i <= days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);

      // Receitas previstas para o dia
      const dayReceivables = pendingReceivables.filter(r => {
        const dueDate = new Date(r.dueDate);
        return dueDate.toDateString() === date.toDateString();
      });

      // Despesas previstas para o dia
      const dayExpenses = pendingExpenses.filter(e => {
        const dueDate = new Date(e.dueDate);
        return dueDate.toDateString() === date.toDateString();
      });

      const dayCredit = dayReceivables.reduce((sum: number, r: any) => sum + Number(r.amount), 0) + mediaDiariaReceitaLiquida;
      const dayDebit = dayExpenses.reduce((sum: number, e: any) => sum + Number(e.amount), 0) + 
                       (mediaDiariaDespesasOp + mediaDiariaDespesasProd + mediaDiariaInvestimentos + 
                        mediaDiariaProlabore + mediaDiariaComprasMercadorias);

      projectedBalance += (dayCredit - dayDebit);

      projection.push({
        date: date.toISOString().split('T')[0],
        expectedCredit: Number(dayCredit.toFixed(2)),
        expectedDebit: Number(dayDebit.toFixed(2)),
        projectedBalance: Number(projectedBalance.toFixed(2)),
        scheduledReceivables: dayReceivables.length,
        scheduledExpenses: dayExpenses.length,
      });
    }

    // Gerar alertas
    const alerts = projection
      .filter((p: any) => p.projectedBalance < 1000)
      .map(p => ({
        date: p.date,
        message: `Saldo baixo previsto: R$ ${p.projectedBalance.toFixed(2)}`,
        severity: p.projectedBalance < 0 ? 'critical' : 'warning',
      }));

    return NextResponse.json({
      // Dados do mês atual
      currentDay,
      totalDaysInMonth,
      
      // Receita Bruta
      receitaBrutaAteHoje: Number(receitaBrutaAteHoje.toFixed(2)),
      mediaDiariaReceitaBruta: Number(mediaDiariaReceitaBruta.toFixed(2)),
      previsaoReceitaBruta: Number(previsaoReceitaBruta.toFixed(2)),
      
      // Receita Líquida
      receitaLiquidaAteHoje: Number(receitaLiquidaAteHoje.toFixed(2)),
      mediaDiariaReceitaLiquida: Number(mediaDiariaReceitaLiquida.toFixed(2)),
      previsaoReceitaLiquida: Number(previsaoReceitaLiquida.toFixed(2)),
      
      // Despesas Operacionais
      despesasOpAteHoje: Number(despesasOpAteHoje.toFixed(2)),
      mediaDiariaDespesasOp: Number(mediaDiariaDespesasOp.toFixed(2)),
      previsaoDespesasOp: Number(previsaoDespesasOp.toFixed(2)),
      
      // Despesas com Produtos
      despesasProdAteHoje: Number(despesasProdAteHoje.toFixed(2)),
      mediaDiariaDespesasProd: Number(mediaDiariaDespesasProd.toFixed(2)),
      previsaoDespesasProd: Number(previsaoDespesasProd.toFixed(2)),
      
      // Compras de Mercadorias
      comprasMercadoriasAteHoje: Number(comprasMercadoriasAteHoje.toFixed(2)),
      mediaDiariaComprasMercadorias: Number(mediaDiariaComprasMercadorias.toFixed(2)),
      previsaoComprasMercadorias: Number(previsaoComprasMercadorias.toFixed(2)),
      
      // Investimentos
      investimentosAteHoje: Number(investimentosAteHoje.toFixed(2)),
      mediaDiariaInvestimentos: Number(mediaDiariaInvestimentos.toFixed(2)),
      previsaoInvestimentos: Number(previsaoInvestimentos.toFixed(2)),
      
      // Prolabore
      prolaboresAteHoje: Number(prolaboresAteHoje.toFixed(2)),
      mediaDiariaProlabore: Number(mediaDiariaProlabore.toFixed(2)),
      previsaoProlabore: Number(previsaoProlabore.toFixed(2)),
      
      // Lucros
      custosDiretosPrevisto: Number(custosDiretosPrevisto.toFixed(2)),
      custosIndiretosPrevisto: Number(custosIndiretosPrevisto.toFixed(2)),
      lucroBrutoPrevisto: Number(lucroBrutoPrevisto.toFixed(2)),
      lucroLiquidoPrevisto: Number(lucroLiquidoPrevisto.toFixed(2)),
      
      // Fluxo de caixa
      currentBalance: Number(currentBalance.toFixed(2)),
      avgDailyCredit: Number(mediaDiariaReceitaLiquida.toFixed(2)),
      avgDailyDebit: Number((mediaDiariaDespesasOp + mediaDiariaDespesasProd + mediaDiariaInvestimentos + 
                            mediaDiariaProlabore + mediaDiariaComprasMercadorias).toFixed(2)),
      projection,
      alerts,
    });
  } catch (error: any) {
    console.error('❌ Erro ao calcular previsão:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
