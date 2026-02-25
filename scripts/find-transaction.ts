require('dotenv').config();
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function find() {
  // Search for the transaction
  const transaction = await prisma.bankTransaction.findMany({
    where: {
      OR: [
        { description: { contains: 'ADM-1770226076227', mode: 'insensitive' } },
        { description: { contains: '1770226076227', mode: 'insensitive' } }
      ]
    },
    include: {
      BankAccount: true,
      Receivable: { include: { Order: true, Customer: true } }
    }
  });

  console.log("=== Transação Encontrada ===");
  console.log(JSON.stringify(transaction, null, 2));

  // Also search for orders with this pattern
  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { orderNumber: { contains: '1770226076227', mode: 'insensitive' } },
        { orderNumber: { contains: 'ADM-1770226076227', mode: 'insensitive' } }
      ]
    },
    include: { Customer: true }
  });

  console.log("\n=== Pedidos com esse número ===");
  console.log(JSON.stringify(orders, null, 2));

  // Check receivables
  const receivables = await prisma.receivable.findMany({
    where: {
      OR: [
        { description: { contains: '1770226076227', mode: 'insensitive' } },
        { description: { contains: 'ADM-1770226076227', mode: 'insensitive' } }
      ]
    },
    include: { Order: true, Customer: true }
  });

  console.log("\n=== Recebíveis relacionados ===");
  console.log(JSON.stringify(receivables, null, 2));

  await prisma.$disconnect();
}

find().catch(console.error);
