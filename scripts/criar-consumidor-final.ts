
import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'

// Carrega as variáveis de ambiente
dotenv.config()

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Verificando se já existe cliente "Consumidor Final"...')
  
  // Verifica se já existe
  const existing = await prisma.customer.findFirst({
    where: {
      customerType: 'CONSUMIDOR_FINAL'
    }
  })
  
  if (existing) {
    console.log('✅ Cliente "Consumidor Final" já existe:')
    console.log(`   ID: ${existing.id}`)
    console.log(`   Nome: ${existing.name}`)
    console.log(`   Tipo: ${existing.customerType}`)
    console.log(`   Permite pagamento posterior: ${existing.allowLaterPayment}`)
    return
  }
  
  console.log('📝 Criando cliente especial "Consumidor Final"...')
  
  // Cria o cliente especial
  const customer = await prisma.customer.create({
    data: {
      id: `CONSUMIDOR_FINAL_${Date.now()}`,
      name: 'Consumidor Final',
      phone: '0000000000',
      city: 'Loja',
      email: null,
      cpfCnpj: null,
      address: 'Venda na loja',
      customerType: 'CONSUMIDOR_FINAL',
      allowLaterPayment: false, // DEVE pagar na hora!
      creditLimit: 0,
      availableCredit: 0,
      paymentTerms: 0, // Sem prazo
      allowInstallments: false,
      useCustomCatalog: false,
      isActive: true
    }
  })
  
  console.log('✅ Cliente "Consumidor Final" criado com sucesso!')
  console.log(`   ID: ${customer.id}`)
  console.log(`   Nome: ${customer.name}`)
  console.log(`   Tipo: ${customer.customerType}`)
  console.log(`   Permite pagamento posterior: ${customer.allowLaterPayment}`)
  
  console.log('\n⚠️  IMPORTANTE:')
  console.log('   - Este cliente deve ser usado para vendas diretas na loja')
  console.log('   - Pagamento OBRIGATÓRIO na hora (dinheiro, cartão ou PIX)')
  console.log('   - NÃO é permitido boleto ou pagamento posterior')
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
