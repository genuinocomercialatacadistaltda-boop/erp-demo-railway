import 'dotenv/config';
import { prisma } from '../lib/db';

async function fix() {
  const order = await prisma.order.findFirst({
    where: { orderNumber: 'ESP46980936' },
    include: { Customer: true }
  });

  if (!order) {
    console.log('Pedido não encontrado');
    return;
  }

  console.log('Pedido encontrado:', order.orderNumber);
  console.log('Secondary Payment Method:', order.secondaryPaymentMethod);
  console.log('Secondary Payment Amount:', order.secondaryPaymentAmount);

  // Verificar se já existe receivable para a parte secundária
  const existingReceivable = await prisma.receivable.findFirst({
    where: {
      orderId: order.id,
      paymentMethod: 'CASH'
    }
  });

  if (existingReceivable) {
    console.log('Receivable secundário já existe:', existingReceivable.id);
    return;
  }

  // Criar o receivable que está faltando
  const baseDate = order.deliveryDate || new Date();
  const paymentTermsDays = order.Customer?.paymentTerms || 0;
  const dueDate = new Date(baseDate);
  dueDate.setDate(dueDate.getDate() + paymentTermsDays);

  const newReceivable = await prisma.receivable.create({
    data: {
      customerId: order.customerId!,
      orderId: order.id,
      boletoId: null,
      description: `Pedido #${order.orderNumber} - CASH`,
      amount: Number(order.secondaryPaymentAmount),
      dueDate: dueDate,
      paymentDate: null,
      status: 'PENDING',
      paymentMethod: 'CASH',
      createdBy: order.userId,
    }
  });

  console.log('✅ Receivable criado:', newReceivable.id);
  console.log('   Valor:', newReceivable.amount);
  console.log('   Vencimento:', newReceivable.dueDate);

  await prisma.$disconnect();
}

fix();
