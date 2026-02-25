export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db';
import { plugnotasAPI } from '@/lib/plugnotas-api';

// GET - Baixar XML ou PDF da nota fiscal
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const invoiceId = searchParams.get('invoiceId');
    const fileType = searchParams.get('type'); // 'xml' ou 'pdf'

    if (!invoiceId || !fileType) {
      return NextResponse.json(
        { error: 'ID da nota e tipo de arquivo são obrigatórios' },
        { status: 400 }
      );
    }

    const invoice = await prisma.fiscalInvoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Nota fiscal não encontrada' }, { status: 404 });
    }

    if (invoice.status !== 'AUTHORIZED') {
      return NextResponse.json(
        { error: 'Apenas notas autorizadas podem ser baixadas' },
        { status: 400 }
      );
    }

    if (!invoice.plugnotasId) {
      return NextResponse.json(
        { error: 'Nota fiscal não possui ID do Plugnotas' },
        { status: 400 }
      );
    }

    try {
      if (fileType === 'xml') {
        const xml = await plugnotasAPI.baixarXML(invoice.plugnotasId);
        return new NextResponse(xml, {
          headers: {
            'Content-Type': 'application/xml',
            'Content-Disposition': `attachment; filename="NFe_${invoice.invoiceNumber}.xml"`,
          },
        });
      } else if (fileType === 'pdf') {
        const pdf = await plugnotasAPI.baixarPDF(invoice.plugnotasId);
        return NextResponse.json({ pdfUrl: pdf });
      } else {
        return NextResponse.json(
          { error: 'Tipo de arquivo inválido. Use "xml" ou "pdf"' },
          { status: 400 }
        );
      }
    } catch (plugnotasError: any) {
      return NextResponse.json(
        {
          error: 'Erro ao baixar arquivo do Plugnotas',
          details: plugnotasError.message,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Erro ao baixar arquivo:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao baixar arquivo' },
      { status: 500 }
    );
  }
}
