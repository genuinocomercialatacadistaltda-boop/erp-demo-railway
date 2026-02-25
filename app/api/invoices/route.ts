export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db';
import { plugnotasAPI, criarPayloadNFe } from '@/lib/plugnotas-api';

// GET - Listar notas fiscais
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');
    const type = searchParams.get('type');

    const where: any = {};

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    if (status) {
      where.status = status;
    }

    if (type) {
      where.invoiceType = type;
    }

    const invoices = await prisma.fiscalInvoice.findMany({
      where,
      include: {
        Order: {
          select: {
            orderNumber: true,
            customerName: true,
          },
        },
        items: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ invoices });
  } catch (error: any) {
    console.error('Erro ao listar notas fiscais:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao listar notas fiscais' },
      { status: 500 }
    );
  }
}

// POST - Emitir nota fiscal
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user || (session.user as any).userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const {
      invoiceType,
      orderId,
      customerName,
      customerCpfCnpj,
      customerEmail,
      customerPhone,
      customerAddress,
      customerNumber,
      customerComplement,
      customerDistrict,
      customerCity,
      customerState,
      customerZipCode,
      items,
      totalValue,
      productsValue,
      taxValue,
      discount,
      notes,
      paymentMethod,
    } = body;

    // Validações
    if (!invoiceType || !customerName || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Dados incompletos para emissão da nota' },
        { status: 400 }
      );
    }

    // Criar nota fiscal no banco com status PENDING
    const fiscalInvoice = await prisma.fiscalInvoice.create({
      data: {
        invoiceType,
        status: 'PROCESSING',
        customerName,
        customerCpfCnpj,
        customerEmail,
        customerPhone,
        customerAddress,
        customerNumber,
        customerComplement,
        customerDistrict,
        customerCity,
        customerState,
        customerZipCode,
        totalValue,
        productsValue,
        taxValue: taxValue || 0,
        discount: discount || 0,
        companyCnpj: '46773900000172',
        companyName: 'INDUSTRIA DE [SUA EMPRESA] LTDA',
        companyIe: '295398787',
        orderId,
        notes,
        items: {
          create: items.map((item: any) => ({
            productName: item.productName,
            productCode: item.productCode,
            ncm: item.ncm || '1602.50.00',
            cfop: item.cfop || '5.102',
            quantity: item.quantity,
            unitValue: item.unitValue,
            totalValue: item.totalValue,
            icms: item.icms || 0,
            ipi: item.ipi || 0,
            pis: item.pis || 0,
            cofins: item.cofins || 0,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    // Preparar payload para Plugnotas
    const payload = criarPayloadNFe({
      tipo: invoiceType,
      idIntegracao: fiscalInvoice.id,
      cliente: {
        nome: customerName,
        cpfCnpj: customerCpfCnpj,
        email: customerEmail,
        telefone: customerPhone,
        endereco: customerAddress ? {
          logradouro: customerAddress,
          numero: customerNumber || 'S/N',
          complemento: customerComplement,
          bairro: customerDistrict || 'Centro',
          cidade: customerCity || 'Gurupi',
          uf: customerState || 'TO',
          cep: customerZipCode || '77410110',
          codigoCidade: '1709500',
        } : undefined,
      },
      itens: items.map((item: any) => ({
        codigo: item.productCode || 'PROD',
        descricao: item.productName,
        quantidade: item.quantity,
        valorUnitario: item.unitValue,
      })),
      valorTotal: totalValue,
      metodoPagamento: paymentMethod || 'PIX',
      observacoes: notes,
    });

    // Emitir nota no Plugnotas
    try {
      const apiMethod = invoiceType === 'NFE' ? 'emitirNFe' : 'emitirNFCe';
      const response = await plugnotasAPI[apiMethod](payload);

      // Atualizar nota fiscal com dados do Plugnotas
      const updatedInvoice = await prisma.fiscalInvoice.update({
        where: { id: fiscalInvoice.id },
        data: {
          plugnotasId: response.id,
          status: response.status === 'autorizado' ? 'AUTHORIZED' : 'PROCESSING',
          invoiceNumber: response.numero,
          series: response.serie,
          accessKey: response.chaveAcesso,
          protocol: response.protocolo,
          authorizationDate: response.dataEmissao ? new Date(response.dataEmissao) : null,
          xmlUrl: response.xml,
          pdfUrl: response.danfe,
        },
        include: {
          items: true,
        },
      });

      return NextResponse.json({
        success: true,
        invoice: updatedInvoice,
        message: 'Nota fiscal emitida com sucesso',
      });
    } catch (plugnotasError: any) {
      // Atualizar nota fiscal com erro
      await prisma.fiscalInvoice.update({
        where: { id: fiscalInvoice.id },
        data: {
          status: 'ERROR',
          errorMessage: plugnotasError.message,
        },
      });

      return NextResponse.json(
        {
          error: 'Erro ao emitir nota fiscal no Plugnotas',
          details: plugnotasError.message,
          invoice: fiscalInvoice,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Erro ao emitir nota fiscal:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao emitir nota fiscal' },
      { status: 500 }
    );
  }
}
