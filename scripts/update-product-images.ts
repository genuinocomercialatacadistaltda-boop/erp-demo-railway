import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Atualizando imagens dos produtos...')

  // Atualizar costela suina a vacuo
  const costela = await prisma.product.findFirst({
    where: {
      name: {
        contains: 'costela suina',
        mode: 'insensitive'
      }
    }
  })
  
  if (costela) {
    await prisma.product.update({
      where: { id: costela.id },
      data: { imageUrl: '/images/costela-suina-vacuo.jpg' }
    })
    console.log('✅ Imagem da costela suína atualizada')
  }

  // Atualizar frango com bacon varejo
  const frango = await prisma.product.findFirst({
    where: {
      name: {
        contains: 'frango com bacon',
        mode: 'insensitive'
      },
      availableIn: {
        in: ['RETAIL', 'BOTH']
      }
    }
  })
  
  if (frango) {
    await prisma.product.update({
      where: { id: frango.id },
      data: { imageUrl: '/images/frango-bacon.jpg' }
    })
    console.log('✅ Imagem do frango com bacon atualizada')
  }

  // Atualizar recorde de bacon fatiadinho
  const baconFatiado = await prisma.product.findFirst({
    where: {
      name: {
        contains: 'fatiadinho',
        mode: 'insensitive'
      }
    }
  })
  
  if (baconFatiado) {
    await prisma.product.update({
      where: { id: baconFatiado.id },
      data: { imageUrl: '/images/bacon-fatiadinho.jpg' }
    })
    console.log('✅ Imagem do bacon fatiadinho atualizada')
  }

  // Atualizar recorte de bacon pedaço 1 kg
  const baconPedaco = await prisma.product.findFirst({
    where: {
      name: {
        contains: 'recorte de bacon pedaço',
        mode: 'insensitive'
      }
    }
  })
  
  if (baconPedaco) {
    await prisma.product.update({
      where: { id: baconPedaco.id },
      data: { imageUrl: '/images/bacon-pedacos.jpg' }
    })
    console.log('✅ Imagem do bacon pedaços atualizada')
  }

  console.log('✅ Todas as imagens foram atualizadas!')
}

main()
  .catch((error) => {
    console.error('❌ Erro:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
