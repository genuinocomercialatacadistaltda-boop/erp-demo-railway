require('dotenv').config();
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { casualCustomerName: { contains: 'José', mode: 'insensitive' } },
        { customerName: { contains: 'José', mode: 'insensitive' } },
        { Customer: { name: { contains: 'José', mode: 'insensitive' } } }
      ]
    },
    include: { Customer: true, DeliveryAssignment: true },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  
  console.log("=== José Orders ===");
  for (const o of orders) {
    console.log("ID:", o.id, "Status:", o.status, "DeliveryDate:", o.deliveryDate, "Method:", o.deliveryMethod);
    console.log("  Customer:", o.Customer?.name || o.casualCustomerName || o.customerName);
  }

  const samara = await prisma.customer.findFirst({
    where: { email: { contains: 'samara', mode: 'insensitive' } },
    include: { User: true }
  });
  
  console.log("\n=== Samara Customer ===");
  console.log(samara ? `Found: ${samara.name}, ${samara.email}, User: ${samara.User?.id || 'NO USER'}` : "Not found");

  const samaraUser = await prisma.user.findFirst({
    where: { email: { contains: 'samara', mode: 'insensitive' } }
  });
  console.log("\n=== Samara User ===");
  console.log(samaraUser ? `Found: ${samaraUser.email}, Type: ${samaraUser.userType}` : "Not found");

  await prisma.$disconnect();
}

check().catch(console.error);
