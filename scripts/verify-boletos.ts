import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();

async function verifyBoletos() {
  console.log('🔍 Verificando boletos atualizados...\n');
  
  // Buscar boletos com status OVERDUE
  const overdueBoletos = await prisma.boleto.findMany({
    where: {
      status: 'OVERDUE'
    },
    select: {
      id: true,
      boletoNumber: true,
      amount: true,
      dueDate: true,
      status: true,
      updatedAt: true,
      Customer: {
        select: {
          name: true
        }
      },
      Order: {
        select: {
          orderNumber: true
        }
      }
    },
    orderBy: {
      updatedAt: 'desc'
    },
    take: 10
  });

  console.log(`📊 Total de boletos OVERDUE: ${overdueBoletos.length}\n`);
  
  if (overdueBoletos.length > 0) {
    console.log('📋 Últimos boletos atualizados para OVERDUE:\n');
    overdueBoletos.forEach((boleto, index) => {
      console.log(`${index + 1}. ${boleto.Customer.name}`);
      console.log(`   Boleto: ${boleto.boletoNumber}`);
      console.log(`   Pedido: ${boleto.Order?.orderNumber || 'N/A'}`);
      console.log(`   Valor: R$ ${boleto.amount}`);
      console.log(`   Vencimento: ${boleto.dueDate.toLocaleDateString('pt-BR')}`);
      console.log(`   Status: ${boleto.status}`);
      console.log(`   Atualizado em: ${boleto.updatedAt.toLocaleString('pt-BR')}\n`);
    });
  }
  
  await prisma.$disconnect();
}

verifyBoletos().catch(console.error);
