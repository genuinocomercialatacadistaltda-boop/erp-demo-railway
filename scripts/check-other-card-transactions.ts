import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('=== VERIFICANDO OUTRAS TRANSAÇÕES DE CARTÃO INDEVIDAS ===\n')
  
  // Buscar todos os receivables de CARTÃO que têm status PAID
  const cardReceivables = await prisma.receivable.findMany({
    where: {
      paymentMethod: {
        in: ['CREDIT_CARD', 'DEBIT', 'CARD']
      },
      status: 'PAID',
      bankAccountId: { not: null }
    },
    include: {
      Order: true
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 20
  })
  
  console.log(`📋 Encontrados ${cardReceivables.length} receivables de CARTÃO pagos com conta bancária\n`)
  
  let problematicCount = 0
  
  for (const r of cardReceivables) {
    // Verificar se tem transação bancária vinculada
    const transaction = await prisma.transaction.findFirst({
      where: {
        referenceType: 'RECEIVABLE',
        referenceId: r.id
      }
    })
    
    if (transaction) {
      problematicCount++
      console.log(`⚠️ PROBLEMA ENCONTRADO:`)
      console.log(`  Receivable: ${r.description}`)
      console.log(`  Método: ${r.paymentMethod}`)
      console.log(`  Valor: R$ ${Number(r.amount).toFixed(2)}`)
      console.log(`  Criado: ${r.createdAt}`)
      console.log(`  Transação ID: ${transaction.id}`)
      console.log(`  Transação criada: ${transaction.createdAt}`)
      console.log(`  Conta: ${transaction.bankAccountId}`)
      console.log('')
    }
  }
  
  if (problematicCount === 0) {
    console.log('✅ Nenhuma outra transação problemática encontrada!')
  } else {
    console.log(`\n⚠️ TOTAL: ${problematicCount} transações de cartão com entrada bancária indevida`)
    console.log('\nEstas transações também deveriam ir para o Gestor de Cartões primeiro.')
    console.log('Você gostaria que eu excluísse todas elas também?')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
