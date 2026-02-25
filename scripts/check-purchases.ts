import { prisma } from '../lib/db';

async function check() {
  // Check purchases with null supplier reference
  const nullSupplier = await prisma.$queryRaw`
    SELECT p."purchaseNumber", p."supplierId" FROM "Purchase" p 
    LEFT JOIN "Supplier" s ON p."supplierId" = s.id 
    WHERE s.id IS NULL
    LIMIT 10
  `;
  console.log('Purchases with orphan supplierId:', nullSupplier);
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
