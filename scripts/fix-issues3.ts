require('dotenv').config();
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
const prisma = new PrismaClient();

async function fix() {
  // 1. Find the order d1ef1feb-3bec-4efb-a874-389732c4e98e (José Eduardo)
  const joseOrderId = 'd1ef1feb-3bec-4efb-a874-389732c4e98e';
  const joseOrder = await prisma.order.findUnique({
    where: { id: joseOrderId },
    include: { Customer: true }
  });

  if (joseOrder) {
    console.log("Found order:", joseOrder.Customer?.name || joseOrder.casualCustomerName);
    await prisma.order.update({
      where: { id: joseOrderId },
      data: { 
        deliveryType: 'DELIVERY',
        deliveryDate: new Date('2026-02-06T12:00:00.000Z')
      }
    });
    console.log("✅ José Eduardo order fixed");
    console.log("   - deliveryType: DELIVERY");
    console.log("   - deliveryDate: 2026-02-06");
  } else {
    console.log("❌ Order not found with ID:", joseOrderId);
  }

  // 2. Create user for Samara
  const samara = await prisma.customer.findFirst({
    where: { email: { contains: 'samara', mode: 'insensitive' } },
    include: { User: true }
  });

  if (samara && !samara.User) {
    const hashedPassword = await bcrypt.hash('samara', 10);
    const now = new Date();
    const user = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: samara.email,
        password: hashedPassword,
        userType: 'CUSTOMER',
        customerId: samara.id,
        updatedAt: now
      }
    });
    
    // Update customer to link to user
    await prisma.customer.update({
      where: { id: samara.id },
      data: { userId: user.id }
    });
    
    console.log("✅ User created for Samara:", user.email);
    console.log("   - Password: samara");
  } else if (samara && samara.User) {
    console.log("ℹ️ Samara already has a user:", samara.User.email);
  } else {
    console.log("❌ Samara customer not found");
  }

  await prisma.$disconnect();
}

fix().catch(console.error);
