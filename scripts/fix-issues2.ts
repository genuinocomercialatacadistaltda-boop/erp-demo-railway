require('dotenv').config();
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
const prisma = new PrismaClient();

async function fix() {
  // 1. Find José Eduardo by searching with just "Eduardo" in customer name
  const joseOrder = await prisma.order.findFirst({
    where: {
      Customer: { name: { contains: 'Jose Eduardo', mode: 'insensitive' } }
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
  } else {
    // Try searching all recent orders
    const allOrders = await prisma.order.findMany({
      where: {
        deliveryDate: {
          gte: new Date('2026-02-04'),
          lte: new Date('2026-02-08')
        }
      },
      include: { Customer: true },
      take: 50
    });
    
    const joseOrder2 = allOrders.find(o => 
      o.Customer?.name?.toLowerCase().includes('jose eduardo') ||
      o.casualCustomerName?.toLowerCase().includes('jose eduardo')
    );
    
    if (joseOrder2) {
      await prisma.order.update({
        where: { id: joseOrder2.id },
        data: { 
          deliveryType: 'DELIVERY',
          deliveryDate: new Date('2026-02-06T12:00:00.000Z')
        }
      });
      console.log("✅ José Eduardo order fixed:", joseOrder2.id);
    } else {
      console.log("❌ José Eduardo order still not found. Listing recent orders:");
      allOrders.slice(0, 5).forEach(o => {
        console.log(`  - ${o.Customer?.name || o.casualCustomerName}: ${o.deliveryDate}`);
      });
    }
  }

  // 2. Create user for Samara
  const samara = await prisma.customer.findFirst({
    where: { email: { contains: 'samara', mode: 'insensitive' } },
    include: { User: true }
  });

  if (samara && !samara.User) {
    const hashedPassword = await bcrypt.hash('samara', 10);
    const userId = randomUUID();
    const user = await prisma.user.create({
      data: {
        id: userId,
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
