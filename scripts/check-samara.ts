require('dotenv').config();
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

async function check() {
  const user = await prisma.user.findFirst({
    where: { email: { contains: 'samara', mode: 'insensitive' } }
  });

  if (user) {
    console.log("User found:", user.email);
    console.log("UserType:", user.userType);
    console.log("CustomerId:", user.customerId);
    
    // Check password
    const isValid = await bcrypt.compare('samara', user.password || '');
    console.log("Password 'samara' is valid:", isValid);
    
    if (!isValid) {
      // Reset password
      const newHash = await bcrypt.hash('samara', 10);
      await prisma.user.update({
        where: { id: user.id },
        data: { password: newHash, updatedAt: new Date() }
      });
      console.log("✅ Password reset to 'samara'");
    }
  } else {
    console.log("User not found");
  }

  await prisma.$disconnect();
}

check().catch(console.error);
