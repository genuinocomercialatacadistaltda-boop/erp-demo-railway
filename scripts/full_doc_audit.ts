import { prisma } from '../lib/prisma';

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('AUDITORIA COMPLETA DE DOCUMENTOS - TODOS OS FUNCIONÁRIOS');
  console.log('='.repeat(80) + '\n');

  // Buscar TODOS os funcionários ativos
  const employees = await prisma.employee.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { name: 'asc' },
    include: {
      documents: {
        include: {
          acknowledgment: true,
          documentAck: true,
        },
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  console.log(`Total de funcionários ativos: ${employees.length}\n`);

  let totalDocs = 0;
  let totalAssinados = 0;
  let totalPendentes = 0;
  const problemas: string[] = [];

  for (const emp of employees) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`👤 ${emp.name} (#${emp.employeeNumber}) - ID: ${emp.id}`);
    console.log(`${'─'.repeat(60)}`);
    
    if (emp.documents.length === 0) {
      console.log('   ⚠️ Nenhum documento encontrado');
      continue;
    }

    // Separar por tipo
    const folhasPonto = emp.documents.filter(d => d.documentType === 'FOLHA_PONTO');
    const contracheques = emp.documents.filter(d => d.documentType === 'CONTRACHEQUE');
    const outros = emp.documents.filter(d => d.documentType !== 'FOLHA_PONTO' && d.documentType !== 'CONTRACHEQUE');

    console.log(`   📄 Total: ${emp.documents.length} docs (${folhasPonto.length} folhas, ${contracheques.length} contracheques, ${outros.length} outros)`);
    
    // Listar cada documento
    for (const doc of emp.documents) {
      totalDocs++;
      
      // Verificar assinatura - usar documentAck como fonte principal
      const assinatura = doc.documentAck;
      const assinado = !!assinatura;
      
      if (assinado) {
        totalAssinados++;
      } else {
        totalPendentes++;
      }

      const statusIcon = assinado ? '✅' : '⏳';
      const statusText = assinado ? 'ASSINADO' : 'PENDENTE';
      
      console.log(`\n   ${statusIcon} [${doc.documentType}] ${doc.title}`);
      console.log(`      ID: ${doc.id}`);
      console.log(`      Criado: ${doc.createdAt.toISOString()}`);
      console.log(`      RefDate: ${doc.referenceDate?.toISOString() || 'N/A'}`);
      console.log(`      Status: ${statusText}`);
      
      if (assinado && assinatura) {
        console.log(`      Assinado em: ${assinatura.acknowledgedAt.toISOString()}`);
      }
      
      // Verificar se também tem acknowledgment (o antigo)
      if (doc.acknowledgment) {
        console.log(`      ⚠️ Também tem acknowledgment antigo!`);
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('RESUMO GERAL');
  console.log('='.repeat(80));
  console.log(`Total de documentos: ${totalDocs}`);
  console.log(`Assinados: ${totalAssinados}`);
  console.log(`Pendentes: ${totalPendentes}`);
  
  // Agora vou verificar especificamente os funcionários mencionados
  console.log('\n' + '='.repeat(80));
  console.log('VERIFICAÇÃO ESPECÍFICA - FUNCIONÁRIOS MENCIONADOS');
  console.log('='.repeat(80));
  
  const nomes = ['LAIANE FERREIRA', 'RODRIGO', 'JONATHAN'];
  for (const nome of nomes) {
    const emp = employees.find(e => e.name.toUpperCase().includes(nome));
    if (emp) {
      console.log(`\n🔍 ${emp.name}:`);
      console.log(`   Documentos no perfil: ${emp.documents.length}`);
      emp.documents.forEach(d => {
        const assinado = !!d.documentAck;
        console.log(`   - [${d.documentType}] ${d.title} | ${assinado ? '✅ Assinado' : '⏳ Pendente'} | ID: ${d.id}`);
      });
    }
  }
  
  // Verificar se há documentos duplicados (mesmo funcionário, mesmo tipo, mesmo período)
  console.log('\n' + '='.repeat(80));
  console.log('VERIFICAÇÃO DE DUPLICATAS');
  console.log('='.repeat(80));
  
  for (const emp of employees) {
    const folhasPorTitulo = new Map<string, typeof emp.documents>();
    for (const doc of emp.documents) {
      const key = `${doc.documentType}-${doc.title}`;
      if (!folhasPorTitulo.has(key)) {
        folhasPorTitulo.set(key, []);
      }
      folhasPorTitulo.get(key)!.push(doc);
    }
    
    for (const [key, docs] of folhasPorTitulo) {
      if (docs.length > 1) {
        console.log(`\n⚠️ DUPLICATA em ${emp.name}: ${key}`);
        docs.forEach(d => {
          console.log(`   - ID: ${d.id} | Criado: ${d.createdAt.toISOString()}`);
        });
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
