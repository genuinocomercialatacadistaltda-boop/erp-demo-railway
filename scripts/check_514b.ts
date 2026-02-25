import { prisma } from '../lib/prisma';

async function check() {
  // Buscar a compra específica
  const purchase = await prisma.purchase.findUnique({
    where: { id: 'cmlqo8okj0011pd08yd7fhzlo' },
    include: {
      Supplier: true,
      Expense: true,
      PurchaseItem: {
        include: {
          RawMaterial: true
        }
      }
    }
  });
  
  if (purchase) {
    console.log('=== COMPRA ===');
    console.log('ID:', purchase.id);
    console.log('Descrição:', purchase.description);
    console.log('Tipo:', purchase.purchaseType);
    console.log('Valor Total:', purchase.totalAmount);
    console.log('Fornecedor:', purchase.Supplier?.name);
    console.log('Status:', purchase.status);
    console.log('Data Compra:', purchase.purchaseDate);
    console.log('Método Pagamento:', purchase.paymentMethod);
    console.log('Criado em:', purchase.createdAt);
    
    console.log('\n--- Itens da Compra ---');
    purchase.PurchaseItem.forEach(item => {
      console.log('  -', item.RawMaterial?.name || 'Produto', '| Qtd:', item.quantity, '| Valor:', item.totalPrice);
    });
    
    if (purchase.Expense) {
      console.log('\n--- Expense vinculada ---');
      console.log('  ID:', purchase.Expense.id);
      console.log('  Descrição:', purchase.Expense.description);
    }
  }
}
check().catch(console.error).finally(() => prisma.$disconnect());
