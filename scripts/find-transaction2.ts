require('dotenv').config();
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function find() {
  // Search for the transaction
  const transaction = await prisma.transaction.findMany({
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
  transaction.forEach(t => {
    console.log("ID:", t.id);
    console.log("Descrição:", t.description);
    console.log("Valor:", t.amount);
    console.log("Tipo:", t.type);
    console.log("Data:", t.date);
    console.log("Conta:", t.BankAccount?.name);
    if (t.Receivable) {
      console.log("Recebível ID:", t.Receivable.id);
      console.log("  Pedido:", t.Receivable.Order?.orderNumber);
      console.log("  Cliente:", t.Receivable.Customer?.name || t.Receivable.Order?.casualCustomerName);
    }
    console.log("---");
  });

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
  orders.forEach(o => {
    console.log("ID:", o.id);
    console.log("Número:", o.orderNumber);
    console.log("Cliente:", o.Customer?.name || o.casualCustomerName);
    console.log("Total:", o.total);
    console.log("Status:", o.status);
    console.log("---");
  });

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
  receivables.forEach(r => {
    console.log("ID:", r.id);
    console.log("Descrição:", r.description);
    console.log("Valor:", r.amount);
    console.log("Pedido:", r.Order?.orderNumber);
    console.log("Cliente:", r.Customer?.name || r.Order?.casualCustomerName);
    console.log("---");
  });

  await prisma.$disconnect();
}

find().catch(console.error);
