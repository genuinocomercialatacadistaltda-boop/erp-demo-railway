
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Verificando clientes CUSTOMER no sistema...");

  // Buscar todos os usuários do tipo CUSTOMER com Customer vinculado
  const users = await prisma.user.findMany({
    where: {
      userType: "CUSTOMER",
      customerId: {
        not: null,
      },
    },
    select: {
      customerId: true,
      email: true,
      Customer: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  const customers = users
    .filter((u) => u.Customer)
    .map((u) => ({
      id: u.customerId!,
      name: u.Customer!.name,
      email: u.email,
    }));

  console.log(`✅ Encontrados ${customers.length} clientes CUSTOMER`);

  for (const customer of customers) {
    console.log(`\n📋 Processando: ${customer.name} (${customer.email || "sem email"})`);

    // Verificar se já existe um "Consumidor Final" para este cliente
    const existing = await prisma.clientCustomer.findFirst({
      where: {
        customerId: customer.id,
        name: "Consumidor Final",
      },
    });

    if (existing) {
      console.log(`   ⚠️  "Consumidor Final" já existe para ${customer.name}`);
      continue;
    }

    // Criar "Consumidor Final"
    const consumidorFinal = await prisma.clientCustomer.create({
      data: {
        customerId: customer.id,
        name: "Consumidor Final",
        phone: "0000000000",
        isActive: true,
        creditLimit: 0,
        currentDebt: 0,
        notes: "Cliente padrão para vendas rápidas (pagamento na hora)",
      },
    });

    console.log(`   ✅ "Consumidor Final" criado com sucesso!`);
    console.log(`   📌 ID: ${consumidorFinal.id}`);
  }

  console.log("\n✨ Processo concluído!");
}

main()
  .catch((e) => {
    console.error("❌ Erro:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
