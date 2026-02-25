require('dotenv').config();
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  // Check recent orders with delivery
  const recentOrders = await prisma.order.findMany({
    where: {
      deliveryDate: {
        gte: new Date('2026-02-05'),
        lte: new Date('2026-02-07')
      }
    },
    include: { Customer: true },
    orderBy: { createdAt: 'desc' },
    take: 20
  });
  
  console.log("=== Recent Orders (Feb 5-7) ===");
  for (const o of recentOrders) {
    console.log("ID:", o.id);
    console.log("  Status:", o.status, "| Method:", o.deliveryMethod);
    console.log("  DeliveryDate:", o.deliveryDate);
    console.log("  Customer:", o.Customer?.name || o.casualCustomerName || o.customerName || "N/A");
    console.log("---");
  }

  // Also search by Eduardo
  const eduardoOrders = await prisma.order.findMany({
    where: {
      OR: [
        { casualCustomerName: { contains: 'Eduardo', mode: 'insensitive' } },
        { customerName: { contains: 'Eduardo', mode: 'insensitive' } },
        { Customer: { name: { contains: 'Eduardo', mode: 'insensitive' } } }
      ]
    },
    include: { Customer: true },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  
  console.log("\n=== Eduardo Orders ===");
  for (const o of eduardoOrders) {
    console.log("ID:", o.id, "Status:", o.status, "DeliveryDate:", o.deliveryDate, "Method:", o.deliveryMethod);
    console.log("  Customer:", o.Customer?.name || o.casualCustomerName || o.customerName);
  }

  await prisma.$disconnect();
}

check().catch(console.error);
