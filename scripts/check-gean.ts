import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Procurando usuário gean...\n')
  
  // Buscar usuários com email contendo "gean"
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: 'gean', mode: 'insensitive' } },
        { name: { contains: 'gean', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      email: true,
      name: true,
      userType: true,
      sellerId: true,
    },
  })
  
  console.log(`✅ Encontrado(s) ${users.length} usuário(s):`)
  users.forEach(user => {
    console.log(`  - ID: ${user.id}`)
    console.log(`    Email: ${user.email}`)
    console.log(`    Nome: ${user.name}`)
    console.log(`    UserType: ${user.userType}`)
    console.log(`    SellerId: ${user.sellerId}`)
    console.log('')
  })
  
  // Se o usuário gean foi encontrado e é vendedor, vamos verificar seus clientes
  const geanUser = users.find(u => u.sellerId)
  if (geanUser && geanUser.sellerId) {
    console.log(`\n🔍 Verificando clientes do vendedor ${geanUser.name} (${geanUser.email})...\n`)
    
    const customers = await prisma.customer.findMany({
      where: {
        sellerId: geanUser.sellerId,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    })
    
    console.log(`✅ Encontrado(s) ${customers.length} cliente(s):`)
    customers.forEach(customer => {
      console.log(`  - ${customer.name} (${customer.email})`)
    })
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
