
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

// GET - Listar faturas
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const creditCardId = searchParams.get("creditCardId");
    const status = searchParams.get("status");

    const where: any = {};
    if (creditCardId) where.creditCardId = creditCardId;
    if (status) where.status = status;

    const invoices = await prisma.creditCardInvoice.findMany({
      where,
      include: {
        CreditCard: {
          select: {
            name: true,
            cardNumber: true,
            cardFlag: true
          }
        },
        _count: {
          select: {
            Expenses: true
          }
        }
      },
      orderBy: { referenceMonth: "desc" }
    });

    return NextResponse.json({ invoices });
  } catch (error) {
    console.error("Erro ao buscar faturas:", error);
    return NextResponse.json(
      { error: "Erro ao buscar faturas" },
      { status: 500 }
    );
  }
}

// POST - Criar fatura ou fechar fatura aberta
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any)?.userType !== "ADMIN") {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
    }

    const data = await req.json();
    const { creditCardId, action } = data;

    const card = await prisma.creditCard.findUnique({
      where: { id: creditCardId }
    });

    if (!card) {
      return NextResponse.json(
        { error: "Cartão não encontrado" },
        { status: 404 }
      );
    }

    if (action === "close") {
      // Fechar fatura atual e criar despesa consolidada
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      
      const referenceMonth = new Date(year, month, 1);

      // Buscar fatura aberta
      let invoice = await prisma.creditCardInvoice.findFirst({
        where: {
          creditCardId,
          status: "OPEN",
          referenceMonth
        },
        include: {
          Expenses: true
        }
      });

      if (!invoice) {
        return NextResponse.json(
          { error: "Nenhuma fatura aberta encontrada para este mês" },
          { status: 404 }
        );
      }

      // Calcular total
      const totalAmount = invoice.Expenses.reduce((sum: number, exp: any) => sum + exp.amount, 0);
      const expensesCount = invoice.Expenses.length;

      // Calcular data de vencimento (usando timezone de Brasília)
      // Criar data no formato ISO com timezone explícito de Brasília (-03:00)
      const closingDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(card.closingDay).padStart(2, '0')}T00:00:00-03:00`;
      const closingDate = new Date(closingDateStr);
      
      let dueDateMonth = month;
      let dueDateYear = year;
      
      // Se o dia de vencimento é antes ou igual ao fechamento, vai para o próximo mês
      if (card.dueDay <= card.closingDay) {
        dueDateMonth = month + 1;
        if (dueDateMonth > 11) {
          dueDateMonth = 0;
          dueDateYear = year + 1;
        }
      }
      
      const dueDateStr = `${dueDateYear}-${String(dueDateMonth + 1).padStart(2, '0')}-${String(card.dueDay).padStart(2, '0')}T00:00:00-03:00`;
      const dueDate = new Date(dueDateStr);

      // Atualizar fatura (SEM criar despesa duplicada)
      // ⚠️ IMPORTANTE: Não criamos despesa consolidada porque as despesas individuais 
      // do cartão (CreditCardExpense) já são contabilizadas no sistema
      const updatedInvoice = await prisma.creditCardInvoice.update({
        where: { id: invoice.id },
        data: {
          status: "CLOSED",
          totalAmount,
          closingDate,
          dueDate
        }
      });

      console.log(`✅ Fatura ${card.name} fechada com sucesso. Total: R$ ${totalAmount}. ${expensesCount} lançamento(s).`);

      return NextResponse.json({ invoice: updatedInvoice }, { status: 201 });
    }

    if (action === "reopen") {
      // Reabrir fatura fechada
      const { invoiceId } = data;

      if (!invoiceId) {
        return NextResponse.json(
          { error: "ID da fatura é obrigatório" },
          { status: 400 }
        );
      }

      const invoice = await prisma.creditCardInvoice.findUnique({
        where: { id: invoiceId }
      });

      if (!invoice) {
        return NextResponse.json(
          { error: "Fatura não encontrada" },
          { status: 404 }
        );
      }

      // Verificar se a fatura já foi paga
      if (invoice.status === "PAID") {
        return NextResponse.json(
          { error: "Não é possível reabrir uma fatura que já foi paga" },
          { status: 400 }
        );
      }

      // Reabrir fatura (mudar status para OPEN)
      const reopenedInvoice = await prisma.creditCardInvoice.update({
        where: { id: invoiceId },
        data: {
          status: "OPEN",
          paymentDate: null,
          paidAmount: null,
          bankAccountId: null
        }
      });

      console.log(`✅ Fatura ${card.name} reaberta com sucesso.`);

      return NextResponse.json({ invoice: reopenedInvoice }, { status: 200 });
    }

    if (action === "create") {
      // 🆕 Criar fatura manualmente
      const { month, year } = data;

      if (!month || !year) {
        return NextResponse.json(
          { error: "Mês e ano são obrigatórios" },
          { status: 400 }
        );
      }

      console.log('📅 [CREATE_INVOICE] Criando fatura manual:', {
        creditCardId,
        month,
        year,
        cardName: card.name
      });

      // Criar data de referência (primeiro dia do mês selecionado no meio-dia para evitar problemas de timezone)
      // Usando meio-dia (12:00) garante que em qualquer timezone do mundo ainda será o mesmo dia
      const referenceMonth = new Date(year, month - 1, 1, 12, 0, 0);

      // Verificar se já existe fatura para este mês
      // Comparação usando ano e mês (evita problemas de precisão de milissegundos)
      const existingInvoice = await prisma.creditCardInvoice.findFirst({
        where: {
          creditCardId,
          AND: [
            {
              referenceMonth: {
                gte: new Date(year, month - 1, 1, 0, 0, 0) // Início do mês
              }
            },
            {
              referenceMonth: {
                lt: new Date(year, month, 1, 0, 0, 0) // Início do próximo mês
              }
            }
          ]
        }
      });

      if (existingInvoice) {
        return NextResponse.json(
          { error: `Já existe uma fatura para ${card.name} em ${month.toString().padStart(2, '0')}/${year}` },
          { status: 400 }
        );
      }

      // Calcular data de fechamento (closingDay do mês de referência)
      const closingDateStr = `${year}-${String(month).padStart(2, '0')}-${String(card.closingDay).padStart(2, '0')}T00:00:00-03:00`;
      const closingDate = new Date(closingDateStr);

      // Calcular data de vencimento
      let dueDateMonth = month - 1; // JavaScript usa 0-11 para meses
      let dueDateYear = year;
      
      // Se o dia de vencimento é antes ou igual ao fechamento, vai para o próximo mês
      if (card.dueDay <= card.closingDay) {
        dueDateMonth = month; // Próximo mês
        if (dueDateMonth > 11) {
          dueDateMonth = 0;
          dueDateYear = year + 1;
        }
      }
      
      const dueDateStr = `${dueDateYear}-${String(dueDateMonth + 1).padStart(2, '0')}-${String(card.dueDay).padStart(2, '0')}T00:00:00-03:00`;
      const dueDate = new Date(dueDateStr);

      // Criar nova fatura
      const newInvoice = await prisma.creditCardInvoice.create({
        data: {
          id: crypto.randomUUID(),
          CreditCard: {
            connect: {
              id: creditCardId
            }
          },
          referenceMonth,
          closingDate,
          status: "OPEN",
          totalAmount: 0,
          dueDate
        },
        include: {
          CreditCard: {
            select: {
              name: true,
              cardNumber: true,
              cardFlag: true
            }
          }
        }
      });

      console.log(`✅ Fatura ${card.name} de ${month.toString().padStart(2, '0')}/${year} criada com sucesso. Vencimento: ${dueDate.toLocaleDateString('pt-BR')}`);

      return NextResponse.json({ invoice: newInvoice }, { status: 201 });
    }

    if (action === "pay") {
      // 💰 Pagar fatura do cartão
      const { invoiceId, bankAccountId, paymentDate } = data;

      if (!invoiceId) {
        return NextResponse.json(
          { error: "ID da fatura é obrigatório" },
          { status: 400 }
        );
      }

      if (!bankAccountId) {
        return NextResponse.json(
          { error: "Conta bancária é obrigatória" },
          { status: 400 }
        );
      }

      console.log('💳 [PAY_INVOICE] Iniciando pagamento de fatura:', invoiceId);

      const invoice = await prisma.creditCardInvoice.findUnique({
        where: { id: invoiceId },
        include: {
          CreditCard: true,
          Expenses: true
        }
      });

      if (!invoice) {
        return NextResponse.json(
          { error: "Fatura não encontrada" },
          { status: 404 }
        );
      }

      if (invoice.status === "PAID") {
        return NextResponse.json(
          { error: "Fatura já está paga" },
          { status: 400 }
        );
      }

      // Buscar conta bancária
      const bankAccount = await prisma.bankAccount.findUnique({
        where: { id: bankAccountId }
      });

      if (!bankAccount) {
        return NextResponse.json(
          { error: "Conta bancária não encontrada" },
          { status: 404 }
        );
      }

      const paymentDateParsed = paymentDate ? new Date(paymentDate) : new Date();
      const newBalance = bankAccount.balance - invoice.totalAmount;

      console.log('💳 [PAY_INVOICE] Detalhes:', {
        fatura: invoice.CreditCard.name,
        mes: new Date(invoice.referenceMonth).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
        valor: invoice.totalAmount,
        saldoAtual: bankAccount.balance,
        novoSaldo: newBalance
      });

      // Executar em transação
      await prisma.$transaction(async (tx) => {
        // 1. Marcar fatura como PAID
        await tx.creditCardInvoice.update({
          where: { id: invoiceId },
          data: {
            status: "PAID",
            paymentDate: paymentDateParsed,
            paidAmount: invoice.totalAmount,
            bankAccountId: bankAccountId
          }
        });

        // 2. Descontar da conta bancária
        await tx.bankAccount.update({
          where: { id: bankAccountId },
          data: { balance: newBalance }
        });

        // 3. Criar transação bancária
        await tx.transaction.create({
          data: {
            bankAccountId,
            type: "EXPENSE",
            amount: invoice.totalAmount,
            description: `Pagamento Fatura ${invoice.CreditCard.name} - ${new Date(invoice.referenceMonth).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`,
            referenceId: invoice.id,
            referenceType: "CREDIT_CARD_INVOICE",
            balanceAfter: newBalance,
            date: paymentDateParsed,
            createdBy: session.user?.email || undefined
          }
        });

        // 4. Devolver limite disponível do cartão
        const newAvailableLimit = (invoice.CreditCard.availableLimit || 0) + invoice.totalAmount;
        await tx.creditCard.update({
          where: { id: invoice.creditCardId },
          data: {
            availableLimit: newAvailableLimit
          }
        });

        console.log('💳 [PAY_INVOICE] Limite do cartão atualizado:', {
          anterior: invoice.CreditCard.availableLimit,
          devolvido: invoice.totalAmount,
          novo: newAvailableLimit
        });
      });

      console.log('✅ [PAY_INVOICE] Fatura paga com sucesso!');

      return NextResponse.json({ 
        message: "Fatura paga com sucesso",
        newBalance
      }, { status: 200 });
    }

    if (action === "delete") {
      // Excluir fatura (apenas se não tiver despesas)
      const { invoiceId } = data;

      if (!invoiceId) {
        return NextResponse.json(
          { error: "ID da fatura é obrigatório" },
          { status: 400 }
        );
      }

      const invoice = await prisma.creditCardInvoice.findUnique({
        where: { id: invoiceId },
        include: {
          Expenses: true
        }
      });

      if (!invoice) {
        return NextResponse.json(
          { error: "Fatura não encontrada" },
          { status: 404 }
        );
      }

      // Verificar se há despesas vinculadas
      if (invoice.Expenses.length > 0) {
        return NextResponse.json(
          { error: `Não é possível excluir fatura com ${invoice.Expenses.length} despesa(s) vinculada(s). Exclua as despesas primeiro.` },
          { status: 400 }
        );
      }

      // Verificar se a fatura já foi paga
      if (invoice.status === "PAID") {
        return NextResponse.json(
          { error: "Não é possível excluir uma fatura que já foi paga" },
          { status: 400 }
        );
      }

      // Excluir fatura
      await prisma.creditCardInvoice.delete({
        where: { id: invoiceId }
      });

      console.log(`✅ Fatura ${card.name} excluída com sucesso.`);

      return NextResponse.json({ message: "Fatura excluída com sucesso" }, { status: 200 });
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (error) {
    console.error("Erro ao processar fatura:", error);
    return NextResponse.json(
      { error: "Erro ao processar fatura" },
      { status: 500 }
    );
  }
}
