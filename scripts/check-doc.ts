import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const doc = await prisma.employeeDocument.findFirst({
    where: { id: 'cmlv7j4c7001jmo08us1habqv' }
  });
  
  console.log('\n📄 DOCUMENTO:');
  console.log('   Título:', doc?.title);
  console.log('   Tipo:', doc?.documentType);
  console.log('   URL:', doc?.fileUrl);
  
  await prisma.$disconnect();
}
check();
