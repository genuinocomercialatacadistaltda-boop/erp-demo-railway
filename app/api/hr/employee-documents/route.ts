export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Listar todos os documentos com AMBAS as relações de assinatura
    const documents = await prisma.employeeDocument.findMany({
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            employeeNumber: true,
          },
        },
        // Sistema ANTIGO de assinatura (EmployeePaymentAcknowledgment) - usado para contracheques antigos
        acknowledgment: {
          select: {
            id: true,
            acknowledgedAt: true,
            employeeId: true,
          },
        },
        // Sistema NOVO de assinatura (DocumentAcknowledgment) - usado para todos os docs
        documentAck: {
          select: {
            id: true,
            acknowledgedAt: true,
            employeeId: true,
          },
        },
      },
      orderBy: [
        { employee: { name: 'asc' } },
        { documentType: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    // Mapear documentos verificando AMBOS os sistemas de assinatura
    const result = documents.map(doc => {
      // Verificar se documento foi assinado em QUALQUER um dos dois sistemas:
      // 1. documentAck (DocumentAcknowledgment) - sistema novo
      // 2. acknowledgment (EmployeePaymentAcknowledgment) - sistema antigo para contracheques
      
      let ackData = null;
      
      // Priorizar o sistema novo (documentAck)
      if (doc.documentAck) {
        ackData = {
          id: doc.documentAck.id,
          acknowledgedAt: doc.documentAck.acknowledgedAt,
          employeeId: doc.documentAck.employeeId,
          source: 'documentAck'
        };
      } 
      // Se não tem no novo, verificar no antigo
      else if (doc.acknowledgment) {
        ackData = {
          id: doc.acknowledgment.id,
          acknowledgedAt: doc.acknowledgment.acknowledgedAt,
          employeeId: doc.acknowledgment.employeeId,
          source: 'acknowledgment'
        };
      }

      return {
        id: doc.id,
        employeeId: doc.employeeId,
        employeeName: doc.employee.name,
        employeeNumber: doc.employee.employeeNumber,
        documentType: doc.documentType,
        title: doc.title,
        description: doc.description,
        fileUrl: doc.fileUrl,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        referenceDate: doc.referenceDate?.toISOString() || null,
        notes: doc.notes,
        createdAt: doc.createdAt.toISOString(),
        acknowledgment: ackData,
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Erro ao listar documentos:', error);
    return NextResponse.json({ error: 'Erro ao listar documentos' }, { status: 500 });
  }
}
