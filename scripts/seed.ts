
import { PrismaClient, UserType, OrderType, DeliveryType, PaymentMethod, OrderStatus, NotificationType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Create admin users
  const hashedAdminPassword1 = await bcrypt.hash('johndoe123', 12)
  const adminUser1 = await prisma.user.upsert({
    where: { email: 'john@doe.com' },
    update: {},
    create: {
      email: 'john@doe.com',
      name: 'Administrador',
      password: hashedAdminPassword1,
      userType: UserType.ADMIN,
    },
  })
  console.log('✅ Admin user created:', adminUser1.email)

  const hashedAdminPassword2 = await bcrypt.hash('admin123', 12)
  const adminUser2 = await prisma.user.upsert({
    where: { email: 'admin@espetosgenuino.com' },
    update: {},
    create: {
      email: 'admin@espetosgenuino.com',
      name: 'Admin Espetos Genuíno',
      password: hashedAdminPassword2,
      userType: UserType.ADMIN,
    },
  })
  console.log('✅ Admin user created:', adminUser2.email)

  // Create sample products
  const products = [
    {
      name: 'Espeto de Carne Bovina',
      description: 'Deliciosos cubos de carne bovina grelhados no ponto, temperados com nossos temperos especiais.',
      imageUrl: 'https://cdn.abacus.ai/images/a3ac1f1f-c50c-448c-9eee-5f3c00d79c26.png',
      weight: '200g',
      priceWholesale: 8.50,
      priceRetail: 12.00,
    },
    {
      name: 'Espeto de Frango',
      description: 'Suculentos pedaços de frango grelhados com temperos caseiros, macios e saborosos.',
      imageUrl: 'https://cdn.abacus.ai/images/a53c414d-0dcf-4a03-a44f-e406e52cb4f3.png',
      weight: '180g',
      priceWholesale: 7.00,
      priceRetail: 10.00,
    },
    {
      name: 'Espeto de Linguiça',
      description: 'Linguiça artesanal grelhada com casca dourada e crocante, sabor inconfundível.',
      imageUrl: 'https://cdn.abacus.ai/images/9b6d3d3e-27dd-443e-b3a1-97598d0fd8d6.png',
      weight: '200g',
      priceWholesale: 6.50,
      priceRetail: 9.50,
    },
    {
      name: 'Espeto de Queijo Coalho',
      description: 'Queijo coalho fresco grelhado até formar uma casquinha dourada por fora e cremoso por dentro.',
      imageUrl: 'https://cdn.abacus.ai/images/f00d8e7d-1290-4ed4-8302-d6eb56b21a58.png',
      weight: '150g',
      priceWholesale: 5.50,
      priceRetail: 8.00,
    },
    {
      name: 'Espeto Misto',
      description: 'Uma combinação perfeita de carne bovina, frango, linguiça e queijo coalho no mesmo espeto.',
      imageUrl: 'https://cdn.abacus.ai/images/845555a8-8943-4e80-806c-834543ccad7a.png',
      weight: '220g',
      priceWholesale: 10.00,
      priceRetail: 14.50,
    },
    {
      name: 'Espeto de Coração',
      description: 'Coração de frango temperado e grelhado, uma iguaria tradicional do churrasco brasileiro.',
      imageUrl: 'https://cdn.abacus.ai/images/feb67958-a601-41c7-bd37-5815e6cd874f.png',
      weight: '180g',
      priceWholesale: 7.50,
      priceRetail: 11.00,
    },
  ]

  // Create products if they don't exist
  const existingProducts = await prisma.product.count()
  if (existingProducts === 0) {
    await prisma.product.createMany({
      data: products,
      skipDuplicates: true,
    })
    console.log('✅ Sample products created')
  } else {
    console.log('✅ Sample products already exist, skipping creation')
  }

  // Create sample sellers
  const sellerData1 = {
    name: 'Jonathan Vendedor',
    email: 'jonathan@espetosgenuino.com',
    phone: '63999998888',
    cpf: '11122233344',
    commissionRate: 1.0,
    maxDiscountRate: 10.0
  }

  const seller1 = await prisma.seller.upsert({
    where: { email: sellerData1.email },
    update: {},
    create: sellerData1
  })

  // Create user account for seller
  const hashedSellerPassword = await bcrypt.hash('vendedor123', 12)
  await prisma.user.upsert({
    where: { email: sellerData1.email },
    update: {},
    create: {
      email: sellerData1.email,
      name: sellerData1.name,
      password: hashedSellerPassword,
      userType: UserType.SELLER,
      sellerId: seller1.id,
    },
  })
  console.log('✅ Sample seller and user account created')

  // Create sample customers
  const customers = [
    {
      name: 'João Silva',
      email: 'joao@restaurante.com',
      phone: '63999887766',
      cpfCnpj: '12345678901',
      city: 'Palmas',
      address: 'Rua das Flores, 123',
      creditLimit: 1000.00,
      availableCredit: 1000.00,
      customDiscount: 10,
      paymentTerms: 30,
    },
    {
      name: 'Maria Oliveira',
      email: 'maria@churrascaria.com',
      phone: '63988776655',
      cpfCnpj: '98765432100',
      city: 'Araguaína',
      address: 'Avenida Central, 456',
      creditLimit: 2000.00,
      availableCredit: 2000.00,
      customDiscount: 15,
      paymentTerms: 15,
    },
    {
      name: 'Marcivan Cliente',
      email: 'marcivan@teste.com',
      phone: '63999776655',
      cpfCnpj: '11111111111',
      city: 'Gurupi',
      address: 'Rua Teste, 789',
      creditLimit: 1500.00,
      availableCredit: 1500.00,
      customDiscount: 12,
      paymentTerms: 30,
      sellerId: seller1.id, // Cliente cadastrado pelo Jonathan
      allowInstallments: true,
      installmentOptions: '2x-15-30, 3x-10-20-30, 4x-7-14-21-28'
    },
  ]

  for (const customerData of customers) {
    const customer = await prisma.customer.upsert({
      where: { email: customerData.email },
      update: {},
      create: customerData,
    })

    // Create user account for customer
    const hashedPassword = await bcrypt.hash('cliente123', 12)
    await prisma.user.upsert({
      where: { email: customerData.email },
      update: {},
      create: {
        email: customerData.email,
        name: customerData.name,
        password: hashedPassword,
        userType: UserType.CUSTOMER,
        customerId: customer.id,
      },
    })
  }
  console.log('✅ Sample customers and user accounts created')

  // Create sample notifications
  const notifications = [
    {
      title: 'Bem-vindo ao Espetos Genuíno!',
      message: 'Agradecemos pela confiança em nossos produtos. Explore nosso catálogo e faça seus pedidos online.',
      type: NotificationType.COMMUNICATION,
    },
    {
      title: 'Promoção Especial',
      message: 'Desconto de 20% em pedidos acima de R$ 100,00. Válido até o final do mês.',
      type: NotificationType.PROMOTION,
    },
  ]

  for (const notification of notifications) {
    await prisma.notification.create({
      data: {
        id: `notification-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        ...notification,
      },
    })
  }
  console.log('✅ Sample notifications created')

  console.log('🎉 Database seed completed successfully!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
