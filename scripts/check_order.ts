import 'dotenv/config';
import { prisma } from '../lib/db';

async function check() {
  // Buscar pedido
  const order = await prisma.order.findFirst({
    where: { orderNumber: 'ESP46980936' },
    include: {
      Customer: true,
      Receivable: true,
      Boleto: true
    }
  });
  
  console.log('=== PEDIDO ===');
  console.log(JSON.stringify(order, null, 2));
  
  if (order) {
    // Buscar todos os recebíveis do cliente
    const receivables = await prisma.receivable.findMany({
      where: { customerId: order.customerId },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    console.log('\n=== ÚLTIMOS RECEBÍVEIS DO CLIENTE ===');
    console.log(JSON.stringify(receivables, null, 2));
  }
  
  await prisma.$disconnect();
}

check();
