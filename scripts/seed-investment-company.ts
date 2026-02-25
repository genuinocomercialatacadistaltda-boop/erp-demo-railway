import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'

// Carregar .env
dotenv.config()

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Criando empresa de investimento: Espetos Genuíno...')

  // Verificar se já existe
  const existing = await prisma.investmentCompany.findUnique({
    where: { name: 'Espetos Genuíno' }
  })

  if (existing) {
    console.log('✅ Empresa já existe!')
    console.log('ID:', existing.id)
    console.log('Preço atual:', existing.currentPrice)
    console.log('Avaliação:', existing.valuation)
    return
  }

  // Criar empresa
  const company = await prisma.investmentCompany.create({
    data: {
      name: 'Espetos Genuíno',
      description: 'Grupo Espetos Genuíno - Líder em produção e distribuição de espetos artesanais de alta qualidade.',
      totalShares: BigInt(1000000), // 1 milhão de ações
      currentPrice: 10.00, // R$ 10,00 por ação
      valuation: 10000000.00 // R$ 10 milhões de valuation inicial
    }
  })

  console.log('✅ Empresa criada com sucesso!')
  console.log('ID:', company.id)
  console.log('Total de Ações:', Number(company.totalShares).toLocaleString())
  console.log('Preço Inicial:', `R$ ${company.currentPrice.toFixed(2)}`)
  console.log('Avaliação:', `R$ ${company.valuation.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)

  // Adicionar ao histórico de preços
  await prisma.sharePriceHistory.create({
    data: {
      companyId: company.id,
      price: company.currentPrice
    }
  })

  console.log('✅ Histórico de preços iniciado!')
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
