
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { orderId, amount, paymentMethod } = body;

    if (!orderId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    // Buscar o pedido
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        Customer: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    }

    const orderTotal = Number(order.total);
    const paymentAmountNumber = Number(amount);

    // Buscar pagamentos já feitos para este pedido
    const existingPayments = await prisma.receivable.findMany({
      where: { 
        orderId,
        status: 'PAID'
      },
    });

    const totalPaid = existingPayments.reduce((sum: number, payment: any) => sum + Number(payment.amount), 0);
    const remainingAmount = orderTotal - totalPaid;

    if (paymentAmountNumber > remainingAmount) {
      return NextResponse.json(
        { error: `Valor excede o saldo pendente de R$ ${remainingAmount.toFixed(2)}` },
        { status: 400 }
      );
    }

    // Criar registro de recebimento
    const receivable = await prisma.receivable.create({
      data: {
        customerId: order.customerId || null,
        orderId,
        description: `Pagamento ${paymentAmountNumber < remainingAmount ? 'parcial' : 'total'} do pedido ${order.orderNumber}`,
        amount: paymentAmountNumber,
        dueDate: new Date(),
        paymentDate: new Date(),
        status: 'PAID',
        paymentMethod,
        netAmount: paymentAmountNumber,
        isInstallment: paymentAmountNumber < remainingAmount,
        createdBy: user.id,
        paidBy: user.id,
      },
    });

    // ✅ CORREÇÃO: Atualizar o status de pagamento do pedido
    const newTotalPaid = totalPaid + paymentAmountNumber;
    
    console.log('💰 [PAGAMENTO] Total pago:', newTotalPaid, '/ Total pedido:', orderTotal)
    
    if (newTotalPaid >= orderTotal) {
      console.log('   ✅ Pedido pago totalmente - Atualizando paymentStatus para PAID')
      
      await prisma.order.update({
        where: { id: orderId },
        data: { 
          status: 'CONFIRMED',
          paymentStatus: 'PAID',  // ✅ Adiciona atualização do paymentStatus
          updatedAt: new Date()
        },
      });
      
      // ✅ CORREÇÃO: Devolver crédito ao cliente quando o pedido for pago totalmente
      // (independente do método de pagamento - todos os pedidos descontam do limite)
      if (order.customerId) {
        const customer = await prisma.customer.findUnique({
          where: { id: order.customerId }
        });
        
        if (customer) {
          // Liberar o crédito que foi reservado para este pedido (respeitando o limite)
          const newAvailableCredit = Number(customer.availableCredit) + orderTotal;
          const finalAvailableCredit = Math.min(newAvailableCredit, Number(customer.creditLimit));
          
          await prisma.customer.update({
            where: { id: order.customerId },
            data: {
              availableCredit: finalAvailableCredit
            }
          });
          
          console.log('   💳 Restauração de crédito (Pagamento receivable):')
          console.log('   Crédito anterior:', customer.availableCredit)
          console.log('   Valor a restaurar:', orderTotal)
          console.log('   Crédito calculado:', newAvailableCredit)
          console.log('   Limite do cliente:', customer.creditLimit)
          console.log('   Crédito final:', finalAvailableCredit)
          
          if (newAvailableCredit > customer.creditLimit) {
            console.log('   ⚠️ LIMITE EXCEDIDO! Crédito ajustado para respeitar o limite')
          }
        }
      }
    } else {
      console.log('   ⚠️ Pagamento parcial - paymentStatus continua UNPAID')
    }

    return NextResponse.json({
      success: true,
      receivable: {
        id: receivable.id,
        amount: Number(receivable.amount),
        paymentDate: receivable.paymentDate,
        isPartialPayment: paymentAmountNumber < remainingAmount,
        remainingAmount: remainingAmount - paymentAmountNumber
      }
    });
  } catch (error) {
    console.error('Erro ao processar pagamento:', error);
    return NextResponse.json(
      { error: 'Erro ao processar pagamento' },
      { status: 500 }
    );
  }
}
