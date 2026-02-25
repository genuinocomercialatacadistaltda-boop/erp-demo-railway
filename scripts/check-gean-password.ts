import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Verificando senha do usuário gean...\n')
  
  const user = await prisma.user.findUnique({
    where: { email: 'gean@gmail.com' },
    select: {
      id: true,
      email: true,
      name: true,
      password: true,
    },
  })
  
  if (!user) {
    console.log('❌ Usuário gean não encontrado')
    return
  }
  
  console.log(`✅ Usuário encontrado:`)
  console.log(`   Email: ${user.email}`)
  console.log(`   Nome: ${user.name}`)
  console.log(`   Senha (hash): ${user.password?.substring(0, 20)}...`)
  
  // Testar a senha gean123
  const testPassword = 'gean123'
  const isMatch = user.password ? await bcrypt.compare(testPassword, user.password) : false
  
  console.log(`\n🔐 Testando senha "${testPassword}":`)
  console.log(isMatch ? '✅ Senha CORRETA!' : '❌ Senha INCORRETA!')
  
  if (!isMatch) {
    // Vamos criar um novo hash correto
    const correctHash = await bcrypt.hash(testPassword, 10)
    console.log(`\n🔧 Atualizando senha para "${testPassword}"...`)
    
    await prisma.user.update({
      where: { email: 'gean@gmail.com' },
      data: { password: correctHash },
    })
    
    console.log('✅ Senha atualizada com sucesso!')
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
