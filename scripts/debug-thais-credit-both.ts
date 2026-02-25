import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const customerId = 'c433bac6-1adc-46c7-8d3b-93aa3cf19fb8' // Thais
  
  console.log('=== COMPARANDO CÁLCULOS DE CRÉDITO ===\n')
  
  // Buscar dados como a API /api/customers/simple faz
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      name: true,
      creditLimit: true,
      availableCredit: true, // valor no banco
      Order: {
        where: { paymentStatus: 'UNPAID' },
        select: {
          id: true,
          orderNumber: true,
          total: true,
          paymentStatus: true,
          Receivable: {
            select: { id: true, status: true }
          }
        }
      },
      Receivable: {
        where: {
          OR: [{ status: 'PENDING' }, { status: 'OVERDUE' }]
        },
        select: {
          id: true,
          description: true,
          amount: true,
          status: true,
          boletoId: true,
          orderId: true
        }
      },
      Boleto: {
        where: {
          OR: [{ status: 'PENDING' }, { status: 'OVERDUE' }]
        },
        select: {
          id: true,
          boletoNumber: true,
          amount: true,
          status: true,
          orderId: true
        }
      }
    }
  })
  
  if (!customer) return
  
  console.log('📋 Cliente:', customer.name)
  console.log('   Limite de Crédito: R$', Number(customer.creditLimit).toFixed(2))
  console.log('   Available Credit (banco): R$', Number(customer.availableCredit).toFixed(2))
  
  console.log('\n📦 Pedidos UNPAID:')
  for (const o of customer.Order) {
    console.log(`   ${o.orderNumber}: R$ ${Number(o.total).toFixed(2)} - Receivables: ${o.Receivable.length}`)
  }
  
  console.log('\n📋 Receivables PENDING/OVERDUE:')
  for (const r of customer.Receivable) {
    console.log(`   ${r.description}: R$ ${Number(r.amount).toFixed(2)} (${r.status}) - boletoId: ${r.boletoId || 'NULL'} - orderId: ${r.orderId || 'NULL'}`)
  }
  
  console.log('\n📄 Boletos PENDING/OVERDUE:')
  for (const b of customer.Boleto) {
    console.log(`   ${b.boletoNumber}: R$ ${Number(b.amount).toFixed(2)} (${b.status}) - orderId: ${b.orderId || 'NULL'}`)
  }
  
  // Cálculo como a API /api/customers/simple faz
  const receivablesWithoutBoleto = customer.Receivable.filter(r => !r.boletoId)
  const pendingReceivables = receivablesWithoutBoleto.reduce((sum, r) => sum + Number(r.amount), 0)
  
  const pendingBoletos = customer.Boleto.reduce((sum, b) => sum + Number(b.amount), 0)
  
  const ordersFiltered = customer.Order.filter(order => {
    const hasPendingReceivable = customer.Receivable.some(r => r.orderId === order.id)
    const hasPendingBoleto = customer.Boleto.some(b => b.orderId === order.id)
    const orderReceivables = order.Receivable || []
    const hasAnyReceivable = orderReceivables.length > 0
    const allReceivablesPaid = hasAnyReceivable && orderReceivables.every(r => r.status === 'PAID')
    
    if (allReceivablesPaid) return false
    return !hasPendingReceivable && !hasPendingBoleto
  })
  const pendingOrders = ordersFiltered.reduce((sum, o) => sum + Number(o.total), 0)
  
  const totalUsed = pendingReceivables + pendingBoletos + pendingOrders
  const simpleApiCredit = Number(customer.creditLimit) - totalUsed
  
  console.log('\n💰 CÁLCULO API /api/customers/simple:')
  console.log(`   Receivables sem boleto: R$ ${pendingReceivables.toFixed(2)}`)
  console.log(`   Boletos pendentes: R$ ${pendingBoletos.toFixed(2)}`)
  console.log(`   Pedidos sem receivable/boleto: R$ ${pendingOrders.toFixed(2)}`)
  console.log(`   Total usado: R$ ${totalUsed.toFixed(2)}`)
  console.log(`   Crédito disponível: R$ ${simpleApiCredit.toFixed(2)}`)
  
  // Agora vamos calcular como a API /api/admin/financial/customers-health faz
  // Ela usa uma lógica diferente
  const allReceivables = await prisma.receivable.findMany({
    where: {
      customerId,
      status: { in: ['PENDING', 'OVERDUE'] },
      boletoId: null // Só receivables sem boleto
    },
    select: { amount: true }
  })
  
  const allBoletos = await prisma.boleto.findMany({
    where: {
      customerId,
      status: { in: ['PENDING', 'OVERDUE'] }
    },
    select: { amount: true }
  })
  
  const financialReceivables = allReceivables.reduce((sum, r) => sum + Number(r.amount), 0)
  const financialBoletos = allBoletos.reduce((sum, b) => sum + Number(b.amount), 0)
  const financialTotalUsed = financialReceivables + financialBoletos
  const financialApiCredit = Number(customer.creditLimit) - financialTotalUsed
  
  console.log('\n💰 CÁLCULO API /api/admin/financial/customers-health:')
  console.log(`   Receivables sem boleto: R$ ${financialReceivables.toFixed(2)}`)
  console.log(`   Boletos pendentes: R$ ${financialBoletos.toFixed(2)}`)
  console.log(`   Total usado: R$ ${financialTotalUsed.toFixed(2)}`)
  console.log(`   Crédito disponível: R$ ${financialApiCredit.toFixed(2)}`)
  
  console.log('\n🔍 DIFERENÇA:')
  console.log(`   API /api/customers/simple: R$ ${simpleApiCredit.toFixed(2)}`)
  console.log(`   API /api/admin/financial/customers-health: R$ ${financialApiCredit.toFixed(2)}`)
  console.log(`   Diferença: R$ ${(simpleApiCredit - financialApiCredit).toFixed(2)}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
