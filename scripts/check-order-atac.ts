import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('=== VERIFICANDO PEDIDO ATAC43112931 ===\n')
  
  const order = await prisma.order.findFirst({
    where: {
      orderNumber: { contains: 'ATAC43112931' }
    },
    include: {
      Customer: true,
      Receivable: true,
      CardTransactions: true
    }
  })
  
  if (!order) {
    console.log('❌ Pedido não encontrado!')
    return
  }
  
  console.log('📋 Pedido encontrado:')
  console.log('   ID:', order.id)
  console.log('   Número:', order.orderNumber)
  console.log('   Cliente:', order.Customer?.name || order.customerName || 'Não identificado')
  console.log('   Total:', order.total)
  console.log('   Método de Pagamento:', order.paymentMethod)
  console.log('   Status de Pagamento:', order.paymentStatus)
  console.log('   Status do Pedido:', order.status)
  console.log('   Data:', order.createdAt)
  
  console.log('\n📄 Receivables:')
  if (order.Receivable.length === 0) {
    console.log('   ❌ NENHUM RECEIVABLE CRIADO!')
  } else {
    for (const r of order.Receivable) {
      console.log(`   - ${r.description}: R$ ${Number(r.amount).toFixed(2)} (${r.status})`)
    }
  }
  
  console.log('\n💳 Card Transactions:')
  if (order.CardTransactions.length === 0) {
    console.log('   ❌ NENHUMA TRANSAÇÃO DE CARTÃO!')
  } else {
    for (const ct of order.CardTransactions) {
      console.log(`   - R$ ${Number(ct.amount).toFixed(2)} (${ct.status}) - ${ct.cardBrand || 'N/A'}`)
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
