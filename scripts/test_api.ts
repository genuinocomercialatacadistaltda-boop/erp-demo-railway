import { prisma } from '../lib/prisma';

async function main() {
  // Simular o que a API faz
  const documents = await prisma.employeeDocument.findMany({
    include: {
      employee: { select: { id: true, name: true, employeeNumber: true } },
      acknowledgment: { select: { id: true, acknowledgedAt: true, employeeId: true } },
      documentAck: { select: { id: true, acknowledgedAt: true, employeeId: true } },
    },
    orderBy: [{ employee: { name: 'asc' } }, { documentType: 'asc' }, { createdAt: 'desc' }],
  });

  const result = documents.map(doc => {
    let ackData = null;
    
    if (doc.documentAck) {
      ackData = { source: 'documentAck', acknowledgedAt: doc.documentAck.acknowledgedAt };
    } else if (doc.acknowledgment) {
      ackData = { source: 'acknowledgment', acknowledgedAt: doc.acknowledgment.acknowledgedAt };
    }

    return {
      employeeName: doc.employee.name,
      documentType: doc.documentType,
      title: doc.title,
      hasAck: !!ackData,
      ackSource: ackData?.source || 'NONE',
    };
  });

  // Mostrar apenas os que interessam
  const filtered = result.filter(r => 
    r.employeeName.includes('RODRIGO') || 
    r.employeeName.includes('Jonathan') ||
    r.employeeName.includes('LAIANE FERREIRA')
  );
  
  console.log('\n=== TESTE DA API (verificando AMBOS os sistemas de assinatura) ===\n');
  filtered.forEach(r => {
    const status = r.hasAck ? `✅ ASSINADO (${r.ackSource})` : '⏳ PENDENTE';
    console.log(`${r.employeeName} | ${r.documentType} | ${r.title} | ${status}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
