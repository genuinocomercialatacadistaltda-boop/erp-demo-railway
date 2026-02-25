import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function regenerate() {
  // Buscar todos os pagamentos de 02/2026
  const payments = await prisma.employeePayment.findMany({
    where: { month: 2, year: 2026 },
    include: { 
      employee: true,
      document: true
    }
  });
  
  console.log(`📋 ${payments.length} pagamentos de 02/2026 encontrados`);
  console.log('\n📄 Para regenerar os PDFs, execute o processamento novamente:');
  console.log('   1. Vá em RH > Folhas de Pagamento');
  console.log('   2. Encontre a folha de 02/2026');
  console.log('   3. Clique em "Reprocessar Contracheques Individuais"');
  console.log('\nOu podemos fazer via API...\n');
  
  // Verificar se há folha de pagamento associada
  const payrollSheet = await prisma.payrollSheet.findFirst({
    where: { month: 2, year: 2026 }
  });
  
  if (payrollSheet) {
    console.log(`📁 Folha encontrada: ID ${payrollSheet.id}`);
    console.log(`   URL para reprocessar: /api/hr/payroll-sheets/${payrollSheet.id}/process-individual-payslips`);
  }
  
  await prisma.$disconnect();
}
regenerate();
