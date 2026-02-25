import { prisma } from "../lib/prisma";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^a-z0-9]+/g, "-") // Substitui caracteres especiais por hífen
    .replace(/^-+|-+$/g, ""); // Remove hífens do início e fim
}

async function main() {
  console.log("🔄 Gerando slugs para clientes...");

  const customers = await prisma.customer.findMany({
    where: {
      storeSlug: null,
    },
  });

  console.log(`📦 Encontrados ${customers.length} clientes sem slug`);

  for (const customer of customers) {
    let slug = generateSlug(customer.name);
    let storeName = customer.name;

    // Verificar se o slug já existe
    let existingCustomer = await prisma.customer.findUnique({
      where: { storeSlug: slug },
    });

    // Se já existir, adicionar um sufixo numérico
    let counter = 1;
    while (existingCustomer) {
      slug = `${generateSlug(customer.name)}-${counter}`;
      existingCustomer = await prisma.customer.findUnique({
        where: { storeSlug: slug },
      });
      counter++;
    }

    // Atualizar o cliente com o slug
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        storeSlug: slug,
        storeName: storeName,
      },
    });

    console.log(`✅ Cliente "${customer.name}" → Slug: "${slug}"`);
  }

  console.log("\n✨ Slugs gerados com sucesso!");
}

main()
  .catch((error) => {
    console.error("❌ Erro:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
