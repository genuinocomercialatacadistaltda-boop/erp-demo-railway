import { prisma } from '../lib/prisma';

async function main() {
  // Verificar todos os EmployeeDocuments com suas assinaturas
  const docs = await prisma.employeeDocument.findMany({
    include: {
      employee: { select: { name: true, employeeNumber: true } },
      acknowledgment: true,
      documentAck: true,
    },
    orderBy: [
      { employee: { name: 'asc' } },
      { documentType: 'asc' },
      { createdAt: 'desc' }
    ]
  });
  
  console.log('\n=== TODOS OS EMPLOYEE DOCUMENTS ===\n');
  docs.forEach(doc => {
    const ack = doc.documentType === 'FOLHA_PONTO' ? doc.documentAck : doc.acknowledgment;
    console.log(`${doc.employee.name} (#${doc.employee.employeeNumber})`);
    console.log(`  Tipo: ${doc.documentType}`);
    console.log(`  Título: ${doc.title}`);
    console.log(`  ID: ${doc.id}`);
    console.log(`  Criado: ${doc.createdAt.toISOString()}`);
    console.log(`  documentAck: ${doc.documentAck ? 'SIM' : 'NÃO'}`);
    console.log(`  acknowledgment: ${doc.acknowledgment ? 'SIM' : 'NÃO'}`);
    console.log(`  STATUS: ${ack ? '✅ ASSINADO' : '⏳ PENDENTE'}`);
    console.log('');
  });
  
  // Verificar especificamente documentos de Laiane Ferreira
  console.log('\n=== BUSCA ESPECÍFICA: LAIANE ===');
  const laiane = await prisma.employee.findFirst({
    where: { name: { contains: 'LAIANE', mode: 'insensitive' } }
  });
  if (laiane) {
    console.log('Laiane encontrada:', laiane.id, laiane.name);
    const laianeDocs = await prisma.employeeDocument.findMany({
      where: { employeeId: laiane.id },
      include: { acknowledgment: true, documentAck: true }
    });
    console.log('Documentos de Laiane:', laianeDocs.length);
    laianeDocs.forEach(d => {
      console.log(`  - ${d.documentType}: ${d.title} | ack: ${d.acknowledgment ? 'SIM' : 'NÃO'} | docAck: ${d.documentAck ? 'SIM' : 'NÃO'}`);
    });
  }
  
  // Verificar Ezequiel (tem 2 folhas de ponto?)
  console.log('\n=== BUSCA ESPECÍFICA: EZEQUIEL ===');
  const ezequiel = await prisma.employee.findFirst({
    where: { name: { contains: 'EZEQUIEL', mode: 'insensitive' } }
  });
  if (ezequiel) {
    console.log('Ezequiel encontrado:', ezequiel.id, ezequiel.name);
    const ezequielDocs = await prisma.employeeDocument.findMany({
      where: { employeeId: ezequiel.id },
      include: { acknowledgment: true, documentAck: true }
    });
    console.log('Documentos de Ezequiel:', ezequielDocs.length);
    ezequielDocs.forEach(d => {
      console.log(`  - ${d.documentType}: ${d.title} (ID: ${d.id}) | ack: ${d.acknowledgment ? 'SIM' : 'NÃO'} | docAck: ${d.documentAck ? 'SIM' : 'NÃO'}`);
    });
    
    // Também verificar timesheets
    const ezequielTimesheets = await prisma.timesheet.findMany({
      where: { employeeId: ezequiel.id },
      include: { acknowledgments: true }
    });
    console.log('Timesheets de Ezequiel:', ezequielTimesheets.length);
    ezequielTimesheets.forEach(t => {
      console.log(`  - Timesheet: ${t.startDate.toISOString()} a ${t.endDate.toISOString()} | PDF: ${t.pdfUrl ? 'SIM' : 'NÃO'} | ack: ${t.acknowledgments.length}`);
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
