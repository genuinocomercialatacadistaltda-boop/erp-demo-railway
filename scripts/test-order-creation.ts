import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('=== TESTE: Validação de Pedido para THAIS ===\n')
  
  // Buscar Thais
  const thais = await prisma.customer.findFirst({
    where: { name: { contains: 'THAIS ABREU' } }
  })
  
  if (!thais) {
    console.log('❌ Cliente não encontrada')
    return
  }
  
  console.log('📋 Cliente:', thais.name)
  console.log('   ID:', thais.id)
  console.log('   Credit Limit:', thais.creditLimit)
  console.log('   Available Credit:', thais.availableCredit)
  console.log('   Customer Type:', thais.customerType)
  console.log('   CPF/CNPJ:', thais.cpfCnpj)
  console.log('   Allow Installments:', thais.allowInstallments)
  console.log('   Installment Options:', thais.installmentOptions)
  
  // Verificar se tem receivables pendentes
  const pendingReceivables = await prisma.receivable.count({
    where: {
      customerId: thais.id,
      status: { in: ['PENDING', 'OVERDUE'] }
    }
  })
  
  const pendingBoletos = await prisma.boleto.count({
    where: {
      customerId: thais.id,
      status: { in: ['PENDING', 'OVERDUE'] }
    }
  })
  
  console.log('\n📊 Pendências:')
  console.log('   Receivables pendentes:', pendingReceivables)
  console.log('   Boletos pendentes:', pendingBoletos)
  
  // Simular pedido de R$ 1.850,00
  const orderTotal = 1850
  console.log('\n💰 Simulação de Pedido:')
  console.log('   Total do Pedido:', orderTotal)
  console.log('   Crédito Disponível:', thais.availableCredit)
  console.log('   Tem crédito suficiente?', thais.availableCredit >= orderTotal ? '✅ SIM' : '❌ NÃO')
  
  if (thais.availableCredit < orderTotal) {
    console.log('\n⚠️ ERRO POTENCIAL: Limite de crédito insuficiente!')
    console.log('   Faltam R$', (orderTotal - thais.availableCredit).toFixed(2))
  }
  
  // Verificar se customerType é válido
  console.log('\n🔍 Validações:')
  console.log('   Customer Type válido?', thais.customerType !== 'CONSUMIDOR_FINAL' ? '✅ SIM (pode usar boleto)' : '❌ NÃO (CONSUMIDOR_FINAL)')
  console.log('   CPF/CNPJ válido?', thais.cpfCnpj && (thais.cpfCnpj.replace(/\D/g, '').length === 11 || thais.cpfCnpj.replace(/\D/g, '').length === 14) ? '✅ SIM' : '❌ NÃO')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
