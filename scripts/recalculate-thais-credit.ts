import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('=== RECALCULANDO CRÉDITO DA THAIS ===\n')
  
  const thais = await prisma.customer.findFirst({
    where: { name: { contains: 'THAIS ABREU' } },
    include: {
      Order: {
        where: {
          paymentStatus: { in: ['UNPAID', 'PARTIAL'] }
        },
        select: { id: true, orderNumber: true, total: true, paymentStatus: true }
      },
      Receivable: {
        where: {
          status: { in: ['PENDING', 'OVERDUE'] },
          boletoId: null // Só conta receivables sem boleto vinculado
        },
        select: { id: true, description: true, amount: true, status: true }
      },
      Boleto: {
        where: {
          status: { in: ['PENDING', 'OVERDUE'] }
        },
        select: { id: true, boletoNumber: true, amount: true, status: true }
      }
    }
  })
  
  if (!thais) return
  
  console.log('📋 Cliente:', thais.name)
  console.log('   Limite de Crédito: R$', thais.creditLimit.toFixed(2))
  console.log('   Available Credit (banco): R$', thais.availableCredit.toFixed(2))
  
  console.log('\n📦 Pedidos não pagos:')
  let orderTotal = 0
  for (const o of thais.Order) {
    console.log(`   - ${o.orderNumber}: R$ ${Number(o.total).toFixed(2)} (${o.paymentStatus})`)
    orderTotal += Number(o.total)
  }
  console.log(`   TOTAL: R$ ${orderTotal.toFixed(2)}`)
  
  console.log('\n📋 Receivables pendentes (sem boleto):')
  let receivableTotal = 0
  for (const r of thais.Receivable) {
    console.log(`   - ${r.description}: R$ ${Number(r.amount).toFixed(2)} (${r.status})`)
    receivableTotal += Number(r.amount)
  }
  console.log(`   TOTAL: R$ ${receivableTotal.toFixed(2)}`)
  
  console.log('\n📄 Boletos pendentes:')
  let boletoTotal = 0
  for (const b of thais.Boleto) {
    console.log(`   - ${b.boletoNumber}: R$ ${Number(b.amount).toFixed(2)} (${b.status})`)
    boletoTotal += Number(b.amount)
  }
  console.log(`   TOTAL: R$ ${boletoTotal.toFixed(2)}`)
  
  // Calcular crédito disponível CORRETAMENTE
  // Crédito usado = boletos pendentes + receivables pendentes (mas não ambos para evitar duplicação)
  // Se o boleto foi gerado a partir de um receivable, não contar o receivable
  
  const creditUsed = boletoTotal + receivableTotal // receivables já são só os sem boletoId
  const calculatedAvailableCredit = thais.creditLimit - creditUsed
  
  console.log('\n💰 CÁLCULO CORRETO:')
  console.log(`   Limite: R$ ${thais.creditLimit.toFixed(2)}`)
  console.log(`   Boletos pendentes: R$ ${boletoTotal.toFixed(2)}`)
  console.log(`   Receivables pendentes (sem boleto): R$ ${receivableTotal.toFixed(2)}`)
  console.log(`   Total usado: R$ ${creditUsed.toFixed(2)}`)
  console.log(`   Crédito Disponível CORRETO: R$ ${calculatedAvailableCredit.toFixed(2)}`)
  console.log(`   Crédito Disponível (no banco): R$ ${thais.availableCredit.toFixed(2)}`)
  
  if (Math.abs(calculatedAvailableCredit - thais.availableCredit) > 0.01) {
    console.log('\n⚠️ DISCREPÂNCIA ENCONTRADA!')
    console.log('   O valor no banco está ERRADO!')
    console.log(`   Deveria ser: R$ ${calculatedAvailableCredit.toFixed(2)}`)
    console.log(`   Mas está: R$ ${thais.availableCredit.toFixed(2)}`)
    console.log(`   Diferença: R$ ${(thais.availableCredit - calculatedAvailableCredit).toFixed(2)}`)
    
    // Corrigir
    console.log('\n🔧 Corrigindo...')
    await prisma.customer.update({
      where: { id: thais.id },
      data: { availableCredit: calculatedAvailableCredit }
    })
    console.log('✅ Crédito disponível corrigido!')
    
    // Verificar
    const updated = await prisma.customer.findUnique({ where: { id: thais.id } })
    console.log(`   Novo valor: R$ ${updated?.availableCredit.toFixed(2)}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
