require('dotenv').config();
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

async function fix() {
  // 1. Fix José Eduardo's order - set deliveryType to DELIVERY and deliveryDate to Feb 6
  const joseOrder = await prisma.order.findFirst({
    where: {
      OR: [
        { casualCustomerName: { contains: 'José Eduardo', mode: 'insensitive' } },
        { Customer: { name: { contains: 'José Eduardo', mode: 'insensitive' } } }
      ]
    },
    orderBy: { createdAt: 'desc' }
  });

  if (joseOrder) {
    await prisma.order.update({
      where: { id: joseOrder.id },
      data: { 
        deliveryType: 'DELIVERY',
        deliveryDate: new Date('2026-02-06T12:00:00.000Z')
      }
    });
    console.log("✅ José Eduardo order fixed:", joseOrder.id);
    console.log("   - deliveryType set to DELIVERY");
    console.log("   - deliveryDate set to 2026-02-06");
  } else {
    console.log("❌ José Eduardo order not found");
  }

  // 2. Create user for Samara
  const samara = await prisma.customer.findFirst({
    where: { email: { contains: 'samara', mode: 'insensitive' } },
    include: { User: true }
  });

  if (samara && !samara.User) {
    const hashedPassword = await bcrypt.hash('samara', 10);
    const user = await prisma.user.create({
      data: {
        email: samara.email,
        password: hashedPassword,
        userType: 'CUSTOMER',
        customerId: samara.id
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
    console.log("ℹ️ Samara already has a user");
  } else {
    console.log("❌ Samara customer not found");
  }

  await prisma.$disconnect();
}

fix().catch(console.error);
