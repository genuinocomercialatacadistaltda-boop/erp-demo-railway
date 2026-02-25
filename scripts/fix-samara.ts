require('dotenv').config();
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
const prisma = new PrismaClient();

async function fix() {
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
        updatedAt: now,
        Customer: {
          connect: { id: samara.id }
        }
      }
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
