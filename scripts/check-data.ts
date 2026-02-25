import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { casualCustomerName: { contains: 'José Eduardo', mode: 'insensitive' } },
        { customerName: { contains: 'José Eduardo', mode: 'insensitive' } },
        { Customer: { name: { contains: 'José Eduardo', mode: 'insensitive' } } }
      ]
    },
    include: { Customer: true, DeliveryAssignment: true },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  
  console.log("=== José Eduardo Orders ===");
  orders.forEach(o => {
    console.log(`ID: ${o.id}, Status: ${o.status}, DeliveryDate: ${o.deliveryDate}, DeliveryMethod: ${o.deliveryMethod}`);
    console.log(`  Customer: ${o.Customer?.name || o.casualCustomerName || o.customerName}`);
    console.log(`  DeliveryAssignment: ${o.DeliveryAssignment?.length || 0}`);
  });

  const samara = await prisma.customer.findFirst({
    where: { email: { contains: 'samara', mode: 'insensitive' } },
    include: { User: true }
  });
  
  console.log("\n=== Samara Customer ===");
  if (samara) {
    console.log(`ID: ${samara.id}, Name: ${samara.name}, Email: ${samara.email}`);
    console.log(`User: ${samara.User ? 'ID: ' + samara.User.id + ', Email: ' + samara.User.email : 'NO USER LINKED'}`);
  } else {
    console.log("Customer not found");
  }

  const samaraUser = await prisma.user.findFirst({
    where: { email: { contains: 'samara', mode: 'insensitive' } }
  });
  console.log("\n=== Samara User ===");
  if (samaraUser) {
    console.log(`ID: ${samaraUser.id}, Email: ${samaraUser.email}, Type: ${samaraUser.userType}`);
  } else {
    console.log("User not found");
  }
}

check().finally(() => process.exit());
