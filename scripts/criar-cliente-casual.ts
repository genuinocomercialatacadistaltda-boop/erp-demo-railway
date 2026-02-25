
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '..', '.env') });

const prisma = new PrismaClient();

async function criarClienteCasual() {
  try {
    console.log('🔍 Verificando se cliente CASUAL já existe...');
    
    const existingCasual = await prisma.customer.findFirst({
      where: { customerType: 'CASUAL' }
    });
    
    if (existingCasual) {
      console.log('✅ Cliente CASUAL já existe:');
      console.log(`   ID: ${existingCasual.id}`);
      console.log(`   Nome: ${existingCasual.name}`);
      console.log(`   Telefone: ${existingCasual.phone}`);
      console.log(`   Cidade: ${existingCasual.city}`);
      return;
    }
    
    console.log('📝 Criando cliente CASUAL...');
    
    const casualClient = await prisma.customer.create({
      data: {
        id: randomUUID(),
        name: 'Cliente Avulso',
        phone: '1111111111',
        city: 'Encomendas',
        customerType: 'CASUAL',
        allowLaterPayment: false,
        creditLimit: 0,
        paymentTerms: 0,
        isActive: true
      }
    });
    
    console.log('✅ Cliente CASUAL criado com sucesso!');
    console.log(`   ID: ${casualClient.id}`);
    console.log(`   Nome: ${casualClient.name}`);
    console.log(`   Tipo: ${casualClient.customerType}`);
    console.log('\n📌 Este cliente aparecerá na lista de seleção como "Cliente Avulso (Encomendas)"');
    console.log('📌 Ao selecionar este cliente, você poderá informar o nome do cliente para a nota.');
    
  } catch (error) {
    console.error('❌ Erro ao criar cliente CASUAL:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

criarClienteCasual();
