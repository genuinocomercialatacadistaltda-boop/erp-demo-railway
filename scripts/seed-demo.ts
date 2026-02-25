import { PrismaClient, UserType, CustomerType, OrderStatus, PaymentMethod, PaymentStatus, DeliveryType, ReceivableStatus, ExpenseType, EmployeeStatus, OrderType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Carregar dados exportados
const exportDataPath = path.join(__dirname, 'app_data_export.json');
const exportData = JSON.parse(fs.readFileSync(exportDataPath, 'utf-8'));

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function generateCPF(): string {
  const n = () => Math.floor(Math.random() * 10);
  return `${n()}${n()}${n()}.${n()}${n()}${n()}.${n()}${n()}${n()}-${n()}${n()}`;
}

function generateOrderNumber(): string {
  return `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

async function main() {
  console.log('🚀 Iniciando seed do ERP Demo...\n');

  // 1. Criar usuário admin
  console.log('👤 Criando usuário admin...');
  const hashedPassword = await bcrypt.hash('testeerp', 10);
  
  const adminUser = await prisma.user.upsert({
    where: { email: 'testeerp@gmail.com' },
    update: {},
    create: {
      id: generateId(),
      email: 'testeerp@gmail.com',
      name: 'Admin Demo',
      password: hashedPassword,
      userType: UserType.ADMIN,
      emailVerified: new Date(),
      updatedAt: new Date(),
    },
  });
  console.log(`   ✅ Admin criado: ${adminUser.email}`);

  // 2. Importar categorias de despesas
  console.log('\n📁 Importando categorias de despesas...');
  let catCount = 0;
  for (const category of exportData.data.expenseCategories || []) {
    try {
      await prisma.expenseCategory.upsert({
        where: { id: category.id },
        update: {},
        create: {
          id: category.id,
          name: category.name,
          description: category.description || null,
          expenseType: category.expenseType || ExpenseType.EXPENSE,
        },
      });
      catCount++;
    } catch (e) {}
  }
  console.log(`   ✅ ${catCount} categorias importadas`);

  // 3. Importar contas bancárias (simplificado)
  console.log('\n🏦 Criando contas bancárias demo...');
  const bankAccountsData = [
    { name: 'Caixa', bankName: 'Dinheiro', accountType: 'CASH', balance: 5000 },
    { name: 'Banco Principal', bankName: 'Banco do Brasil', accountType: 'CHECKING', balance: 25000 },
    { name: 'Conta Poupança', bankName: 'Itaú', accountType: 'SAVINGS', balance: 15000 },
  ];
  
  for (const account of bankAccountsData) {
    await prisma.bankAccount.create({
      data: {
        name: account.name,
        bankName: account.bankName,
        accountType: account.accountType,
        balance: account.balance,
        isActive: true,
      },
    });
  }
  console.log(`   ✅ ${bankAccountsData.length} contas bancárias criadas`);

  // 4. Importar fornecedores (simplificado)
  console.log('\n🏭 Criando fornecedores demo...');
  const suppliersData = [
    { name: 'Frigorífico Demo', document: '12345678000101', phone: '11999990001' },
    { name: 'Distribuidora Demo', document: '98765432000199', phone: '11999990002' },
    { name: 'Atacadão Demo', document: '11223344000155', phone: '11999990003' },
    { name: 'Fornecedor Geral', document: '55667788000122', phone: '11999990004' },
  ];
  
  const createdSuppliers = [];
  for (const s of suppliersData) {
    const supplier = await prisma.supplier.create({
      data: {
        name: s.name,
        document: s.document,
        documentType: 'CNPJ',
        phone: s.phone,
        email: `contato@${s.name.toLowerCase().replace(/\s/g, '')}.com`,
        isActive: true,
      },
    });
    createdSuppliers.push(supplier);
  }
  console.log(`   ✅ ${suppliersData.length} fornecedores criados`);

  // 5. Importar matérias-primas (simplificado)
  console.log('\n🥩 Criando matérias-primas demo...');
  const rawMaterialsData = [
    { name: 'Carne Bovina', costPerUnit: 35.00 },
    { name: 'Frango', costPerUnit: 18.00 },
    { name: 'Linguiça', costPerUnit: 25.00 },
    { name: 'Bacon', costPerUnit: 40.00 },
    { name: 'Queijo Coalho', costPerUnit: 45.00 },
  ];
  
  for (const rm of rawMaterialsData) {
    await prisma.rawMaterial.create({
      data: {
        name: rm.name,
        costPerUnit: rm.costPerUnit,
        currentStock: Math.floor(Math.random() * 100),
        minStock: 10,
      },
    });
  }
  console.log(`   ✅ ${rawMaterialsData.length} matérias-primas criadas`);

  // 6. Importar produtos
  console.log('\n📦 Importando produtos...');
  let prodCount = 0;
  for (const product of exportData.data.products || []) {
    try {
      let imageUrl = product.imageUrl;
      if (imageUrl && imageUrl.startsWith('data:') && imageUrl.length > 1000) {
        imageUrl = 'https://upload.wikimedia.org/wikipedia/commons/6/65/No-Image-Placeholder.svg';
      }
      
      await prisma.product.upsert({
        where: { id: product.id },
        update: {},
        create: {
          id: product.id,
          name: product.name,
          description: product.description || '',
          imageUrl: imageUrl || 'https://upload.wikimedia.org/wikipedia/commons/6/65/No-Image-Placeholder.svg',
          weight: product.weight || '',
          priceWholesale: product.priceWholesale || 0,
          priceRetail: product.priceRetail || 0,
          isActive: product.isActive ?? true,
          category: product.category || 'Geral',
          availableIn: product.availableIn || 'BOTH',
          quantityIncrement: product.quantityIncrement || 1,
          soldByWeight: product.soldByWeight ?? false,
          currentStock: 0,
          canBeUsedAsIngredient: product.canBeUsedAsIngredient ?? false,
          updatedAt: new Date(),
        },
      });
      prodCount++;
    } catch (e) {
      // Silently skip
    }
  }
  
  // Se não importou produtos, criar alguns manualmente
  if (prodCount === 0) {
    console.log('   ⚠️ Importação falhou, criando produtos demo...');
    const demoProducts = [
      { name: 'Espeto de Carne', description: 'Espeto de carne bovina 100g', priceWholesale: 5.00, priceRetail: 6.00 },
      { name: 'Espeto de Frango', description: 'Espeto de frango 100g', priceWholesale: 4.00, priceRetail: 5.00 },
      { name: 'Espeto de Linguiça', description: 'Espeto de linguiça', priceWholesale: 4.50, priceRetail: 5.50 },
      { name: 'Espeto de Coração', description: 'Espeto de coração de frango', priceWholesale: 3.50, priceRetail: 4.50 },
      { name: 'Espeto Misto', description: 'Espeto misto carne e frango', priceWholesale: 5.50, priceRetail: 6.50 },
      { name: 'Queijo Coalho', description: 'Espeto de queijo coalho', priceWholesale: 4.00, priceRetail: 5.00 },
      { name: 'Kafta', description: 'Espeto de kafta 130g', priceWholesale: 5.50, priceRetail: 6.50 },
      { name: 'Bacon', description: 'Espeto de bacon', priceWholesale: 5.00, priceRetail: 6.00 },
      { name: 'Carne com Queijo', description: 'Espeto de carne com queijo', priceWholesale: 6.00, priceRetail: 7.00 },
      { name: 'Picanha', description: 'Espeto de picanha 100g', priceWholesale: 8.00, priceRetail: 10.00 },
      { name: 'Costela', description: 'Espeto de costela bovina', priceWholesale: 7.00, priceRetail: 8.50 },
      { name: 'Cupim', description: 'Espeto de cupim', priceWholesale: 7.50, priceRetail: 9.00 },
      { name: 'Frango com Bacon', description: 'Espeto de frango com bacon', priceWholesale: 5.00, priceRetail: 6.00 },
      { name: 'Calabresa', description: 'Espeto de calabresa', priceWholesale: 4.00, priceRetail: 5.00 },
      { name: 'Medalhão de Frango', description: 'Espeto medalhão de frango', priceWholesale: 5.00, priceRetail: 6.00 },
    ];
    
    for (const p of demoProducts) {
      await prisma.product.create({
        data: {
          id: generateId(),
          name: p.name,
          description: p.description,
          imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/65/No-Image-Placeholder.svg',
          weight: '100g',
          priceWholesale: p.priceWholesale,
          priceRetail: p.priceRetail,
          isActive: true,
          category: 'Espetos',
          availableIn: 'BOTH',
          quantityIncrement: 1,
          soldByWeight: false,
          currentStock: 100,
          canBeUsedAsIngredient: false,
          updatedAt: new Date(),
        },
      });
      prodCount++;
    }
  }
  console.log(`   ✅ ${prodCount} produtos criados`);

  // 7. Importar prêmios
  console.log('\n🎁 Criando prêmios demo...');
  const prizesData = [
    { name: 'Kit Churrasco', description: 'Kit com 10 espetos sortidos', pointsCost: 500, stockQuantity: 50 },
    { name: 'Camiseta da Marca', description: 'Camiseta exclusiva', pointsCost: 300, stockQuantity: 100 },
    { name: 'Boné da Marca', description: 'Boné exclusivo', pointsCost: 200, stockQuantity: 80 },
    { name: 'Avental de Churrasco', description: 'Avental personalizado', pointsCost: 400, stockQuantity: 30 },
    { name: 'Desconto 10%', description: '10% de desconto na próxima compra', pointsCost: 150, stockQuantity: null },
    { name: 'Brinde Especial', description: 'Brinde surpresa', pointsCost: 100, stockQuantity: 200 },
  ];
  
  for (const prize of prizesData) {
    await prisma.prize.create({
      data: {
        name: prize.name,
        description: prize.description,
        pointsCost: prize.pointsCost,
        stockQuantity: prize.stockQuantity,
        isActive: true,
      },
    });
  }
  console.log(`   ✅ ${prizesData.length} prêmios criados`);

  // 8. Importar feriados
  console.log('\n📅 Criando feriados demo...');
  const holidays = [
    { name: 'Ano Novo', date: new Date(2026, 0, 1) },
    { name: 'Carnaval', date: new Date(2026, 1, 16) },
    { name: 'Sexta-feira Santa', date: new Date(2026, 3, 3) },
    { name: 'Dia do Trabalho', date: new Date(2026, 4, 1) },
    { name: 'Independência', date: new Date(2026, 8, 7) },
    { name: 'Nossa Senhora Aparecida', date: new Date(2026, 9, 12) },
    { name: 'Finados', date: new Date(2026, 10, 2) },
    { name: 'Proclamação da República', date: new Date(2026, 10, 15) },
    { name: 'Natal', date: new Date(2026, 11, 25) },
  ];
  
  for (const h of holidays) {
    await prisma.holiday.create({
      data: {
        id: generateId(),
        name: h.name,
        date: h.date,
        isRecurring: true,
      },
    });
  }
  console.log(`   ✅ ${holidays.length} feriados criados`);

  // ========================================
  // CRIAR DADOS DE TESTE
  // ========================================

  console.log('\n\n🧪 Criando dados de teste...\n');

  // Criar vendedores de teste
  console.log('👨‍💼 Criando vendedores...');
  const sellers = [];
  const sellerData = [
    { name: 'Carlos Vendedor', email: 'carlos.vendedor@demo.com', phone: '11999990001', commission: 5 },
    { name: 'Maria Vendas', email: 'maria.vendas@demo.com', phone: '11999990002', commission: 6 },
    { name: 'João Representante', email: 'joao.rep@demo.com', phone: '11999990003', commission: 5.5 },
  ];
  
  for (const s of sellerData) {
    const seller = await prisma.seller.create({
      data: {
        id: generateId(),
        name: s.name,
        email: s.email,
        phone: s.phone,
        cpf: generateCPF(),
        commissionRate: s.commission,
        isActive: true,
        updatedAt: new Date(),
      },
    });
    sellers.push(seller);
  }
  console.log(`   ✅ ${sellers.length} vendedores criados`);

  // Criar clientes fictícios brasileiros
  console.log('\n👥 Criando clientes fictícios...');
  const customers = [];
  const customerData = [
    { name: 'Restaurante Sabor Caseiro', cnpj: '12345678000101', email: 'contato@saborcaseiro.com.br', phone: '11987654321', address: 'Rua das Flores, 123 - Centro', city: 'São Paulo', type: CustomerType.ATACADO },
    { name: 'Bar do Zé', cnpj: '98765432000199', email: 'zebar@email.com', phone: '11912345678', address: 'Av. Principal, 456 - Vila Nova', city: 'São Paulo', type: CustomerType.ATACADO },
    { name: 'Churrascaria Fogo de Chão', cnpj: '11223344000155', email: 'fogodechao@empresa.com', phone: '11955556666', address: 'Rua do Comércio, 789 - Industrial', city: 'Campinas', type: CustomerType.ATACADO },
    { name: 'Maria Silva', cpf: '123.456.789-00', email: 'maria.silva@gmail.com', phone: '11944443333', address: 'Rua Residencial, 100 - Jardim', city: 'São Paulo', type: CustomerType.VAREJO },
    { name: 'João Santos', cpf: '987.654.321-00', email: 'joao.santos@hotmail.com', phone: '11922221111', address: 'Av. das Américas, 200 - Centro', city: 'São Paulo', type: CustomerType.VAREJO },
    { name: 'Lanchonete Boa Vista', cnpj: '55667788000122', email: 'boavista@lanchonete.com', phone: '11966667777', address: 'Rua Comercial, 321 - Centro', city: 'Guarulhos', type: CustomerType.ATACADO },
    { name: 'Mercadinho Popular', cnpj: '44332211000133', email: 'mercadinho@popular.com', phone: '11977778888', address: 'Av. Brasil, 654 - Bairro Novo', city: 'São Paulo', type: CustomerType.ATACADO },
    { name: 'Ana Oliveira', cpf: '456.789.123-00', email: 'ana.oliveira@yahoo.com', phone: '11933334444', address: 'Rua das Palmeiras, 50 - Residencial', city: 'Osasco', type: CustomerType.VAREJO },
  ];

  for (let i = 0; i < customerData.length; i++) {
    const c = customerData[i];
    const hashedPwd = await bcrypt.hash('cliente123', 10);
    
    // Criar user para o cliente
    const user = await prisma.user.create({
      data: {
        id: generateId(),
        email: c.email,
        name: c.name,
        password: hashedPwd,
        userType: UserType.CUSTOMER,
        emailVerified: new Date(),
        updatedAt: new Date(),
      },
    });

    const customer = await prisma.customer.create({
      data: {
        id: generateId(),
        name: c.name,
        email: c.email,
        phone: c.phone,
        cpfCnpj: c.cnpj || c.cpf || null,
        address: c.address,
        city: c.city,
        customerType: c.type,
        sellerId: sellers[i % sellers.length].id,
        creditLimit: c.type === CustomerType.ATACADO ? 5000 : 1000,
        availableCredit: c.type === CustomerType.ATACADO ? 5000 : 1000,
        pointsBalance: Math.floor(Math.random() * 500),
      },
    });
    customers.push(customer);
  }
  console.log(`   ✅ ${customers.length} clientes criados`);

  // Criar funcionários de teste
  console.log('\n👷 Criando funcionários...');
  const employees = [];
  const employeeData = [
    { name: 'Pedro Funcionário', email: 'pedro.func@demo.com', position: 'Operador de Produção', salary: 2500 },
    { name: 'Lucia Assistente', email: 'lucia.assist@demo.com', position: 'Assistente Administrativo', salary: 2800 },
    { name: 'Roberto Entregador', email: 'roberto.entrega@demo.com', position: 'Entregador', salary: 2200 },
    { name: 'Fernanda Caixa', email: 'fernanda.caixa@demo.com', position: 'Operador de Caixa', salary: 2400 },
    { name: 'Marcos Supervisor', email: 'marcos.super@demo.com', position: 'Supervisor', salary: 4000 },
  ];

  let empNumber = 1001;
  for (const e of employeeData) {
    const hashedPwd = await bcrypt.hash('func123', 10);
    
    const user = await prisma.user.create({
      data: {
        id: generateId(),
        email: e.email,
        name: e.name,
        password: hashedPwd,
        userType: UserType.EMPLOYEE,
        emailVerified: new Date(),
        updatedAt: new Date(),
      },
    });

    const employee = await prisma.employee.create({
      data: {
        id: generateId(),
        employeeNumber: empNumber++,
        name: e.name,
        cpf: generateCPF(),
        position: e.position,
        salary: e.salary,
        admissionDate: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
        email: e.email,
        phone: '11' + Math.floor(Math.random() * 900000000 + 100000000),
        status: EmployeeStatus.ACTIVE,
        isActive: true,
      },
    });
    employees.push(employee);
  }
  console.log(`   ✅ ${employees.length} funcionários criados`);

  // Criar pedidos de exemplo
  console.log('\n📝 Criando pedidos de exemplo...');
  const products = await prisma.product.findMany({ take: 20 });
  const orders = [];
  
  for (let i = 0; i < 15; i++) {
    const customer = customers[i % customers.length];
    const numItems = Math.floor(Math.random() * 5) + 1;
    const orderItems = [];
    let subtotal = 0;

    for (let j = 0; j < numItems; j++) {
      const product = products[Math.floor(Math.random() * products.length)];
      const quantity = Math.floor(Math.random() * 10) + 1;
      const price = customer.customerType === CustomerType.ATACADO ? product.priceWholesale : product.priceRetail;
      const itemTotal = price * quantity;
      subtotal += itemTotal;

      orderItems.push({
        id: generateId(),
        productId: product.id,
        quantity,
        unitPrice: price,
        total: itemTotal,
      });
    }

    const isPaid = Math.random() > 0.4;
    const status = isPaid ? OrderStatus.DELIVERED : (Math.random() > 0.5 ? OrderStatus.PENDING : OrderStatus.CONFIRMED);
    const paymentMethods = [PaymentMethod.PIX, PaymentMethod.CASH, PaymentMethod.CREDIT_CARD];
    const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
    const orderType = customer.customerType === CustomerType.ATACADO ? OrderType.WHOLESALE : OrderType.RETAIL;

    const order = await prisma.order.create({
      data: {
        id: generateId(),
        orderNumber: generateOrderNumber(),
        Customer: { connect: { id: customer.id } },
        customerName: customer.name,
        customerPhone: customer.phone,
        customerEmail: customer.email,
        Seller: { connect: { id: sellers[i % sellers.length].id } },
        status,
        orderType,
        subtotal,
        total: subtotal,
        paymentMethod,
        paymentStatus: isPaid ? PaymentStatus.PAID : PaymentStatus.UNPAID,
        paidAmount: isPaid ? subtotal : 0,
        deliveryType: Math.random() > 0.5 ? DeliveryType.DELIVERY : DeliveryType.PICKUP,
        address: customer.address,
        city: customer.city,
        deliveryDate: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000),
        notes: i % 3 === 0 ? 'Pedido urgente' : null,
        updatedAt: new Date(),
        OrderItem: {
          create: orderItems,
        },
      },
    });
    orders.push(order);
  }
  console.log(`   ✅ ${orders.length} pedidos criados`);

  // Criar despesas
  console.log('\n📊 Criando despesas...');
  const categories = await prisma.expenseCategory.findMany({ take: 10 });
  const bankAccountsList = await prisma.bankAccount.findMany({ take: 5 });

  const expenseDescriptions = [
    'Compra de matéria-prima', 'Aluguel do mês', 'Conta de energia', 'Conta de água',
    'Manutenção de equipamentos', 'Material de escritório', 'Combustível', 
    'Serviço de limpeza', 'Internet e telefone', 'Seguro empresarial',
    'Frete de mercadorias', 'Embalagens', 'Uniformes funcionários'
  ];

  for (let i = 0; i < 15; i++) {
    const category = categories[i % categories.length];
    const bankAccount = bankAccountsList.length > 0 ? bankAccountsList[i % bankAccountsList.length] : null;
    const paymentMethods = ['PIX', 'CASH', 'CREDIT_CARD'];
    const isPaid = Math.random() > 0.5;
    const dueDate = new Date(Date.now() + (Math.random() * 60 - 30) * 24 * 60 * 60 * 1000);

    await prisma.expense.create({
      data: {
        description: expenseDescriptions[i % expenseDescriptions.length],
        amount: Math.floor(Math.random() * 2000) + 100,
        dueDate,
        paymentDate: isPaid ? dueDate : null,
        status: isPaid ? 'PAID' : 'PENDING',
        Category: { connect: { id: category.id } },
        BankAccount: bankAccount ? { connect: { id: bankAccount.id } } : undefined,
        paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
        expenseType: category?.expenseType || ExpenseType.EXPENSE,
        Supplier: createdSuppliers.length > 0 ? { connect: { id: createdSuppliers[i % createdSuppliers.length].id } } : undefined,
      },
    });
  }
  console.log(`   ✅ 15 despesas criadas`);

  // Criar contas a receber
  console.log('\n💰 Criando contas a receber...');
  for (let i = 0; i < 12; i++) {
    const customer = customers[i % customers.length];
    const order = orders[i % orders.length];
    const isPaid = Math.random() > 0.5;
    const dueDate = new Date(Date.now() + (Math.random() * 60 - 30) * 24 * 60 * 60 * 1000);

    await prisma.receivable.create({
      data: {
        description: `Venda para ${customer.name}`,
        amount: Math.floor(Math.random() * 3000) + 200,
        dueDate,
        paymentDate: isPaid ? new Date(dueDate.getTime() - Math.random() * 5 * 24 * 60 * 60 * 1000) : null,
        status: isPaid ? ReceivableStatus.PAID : (dueDate < new Date() ? ReceivableStatus.OVERDUE : ReceivableStatus.PENDING),
        Customer: { connect: { id: customer.id } },
        Order: { connect: { id: order.id } },
        BankAccount: bankAccountsList.length > 0 && isPaid ? { connect: { id: bankAccountsList[i % bankAccountsList.length].id } } : undefined,
      },
    });
  }
  console.log(`   ✅ 12 contas a receber criadas`);

  console.log('\n\n✅ ====================================');
  console.log('   SEED COMPLETO!');
  console.log('====================================\n');
  console.log('📧 Credenciais de acesso:');
  console.log('   Admin: testeerp@gmail.com / testeerp');
  console.log('   Clientes: [email do cliente] / cliente123');
  console.log('   Funcionários: [email do funcionário] / func123');
  console.log('\n');
}

main()
  .catch((e) => {
    console.error('❌ Erro durante o seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
