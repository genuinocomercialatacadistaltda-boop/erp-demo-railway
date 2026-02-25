
// API para visualizar boleto em HTML para impressão

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { generateBoletoPDF } from '@/lib/boleto-pdf'
import QRCode from 'qrcode'

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const boleto = await prisma.boleto.findUnique({
      where: { id: params.id },
      include: {
        Customer: true,
        Order: {
          include: {
            OrderItem: {
              include: {
                Product: true
              }
            }
          }
        }
      }
    })

    if (!boleto) {
      return NextResponse.json({ error: 'Boleto não encontrado' }, { status: 404 })
    }

    // Check authorization
    if (user?.userType === 'CUSTOMER' && boleto.customerId !== user.customerId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // ============================================
    // ATENÇÃO: Apenas dados do CORA são usados
    // Se o boleto não tem dados, é porque houve erro na criação
    // ============================================
    const pixQrCode = boleto.pixQrCode
    const pixQrCodeBase64 = boleto.pixQrCodeBase64

    if (!pixQrCode && !boleto.barcodeNumber) {
      console.error('❌ ERRO: Boleto sem dados do Cora. ID:', params.id)
      return new Response(
        `<!DOCTYPE html>
        <html>
          <head>
            <title>Erro - Boleto Inválido</title>
            <style>
              body { font-family: Arial; padding: 40px; text-align: center; }
              .error { color: #ef4444; font-size: 18px; }
            </style>
          </head>
          <body>
            <h1>❌ Erro</h1>
            <p class="error">Este boleto não possui dados de pagamento válidos.</p>
            <p>Entre em contato com o suporte.</p>
          </body>
        </html>`,
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      )
    }

    // Calcular multa e juros se vencido
    const today = new Date()
    const dueDate = new Date(boleto.dueDate)
    const isOverdue = today > dueDate && boleto.status !== 'PAID'
    const daysOverdue = isOverdue ? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0
    
    const originalAmount = Number(boleto.amount)
    const fineAmount = isOverdue ? originalAmount * 0.02 : 0 // 2% de multa
    const interestAmount = isOverdue ? originalAmount * 0.001 * daysOverdue : 0 // 0.1% ao dia

    // Gerar descrição
    let description = `Pedido #${boleto.Order?.orderNumber || 'N/A'}`
    if (boleto.isInstallment && boleto.installmentNumber && boleto.totalInstallments) {
      description += ` - Parcela ${boleto.installmentNumber}/${boleto.totalInstallments}`
    }

    // Gerar QR Code base64 se não existir mas a string existir
    let qrCodeBase64 = pixQrCodeBase64 || ''
    if (pixQrCode && !pixQrCodeBase64) {
      try {
        // Gerar QR Code em base64
        const qrCodeDataUrl = await QRCode.toDataURL(pixQrCode, {
          errorCorrectionLevel: 'M',
          type: 'image/png',
          width: 300,
          margin: 2
        })
        // Extrair apenas a parte base64 (remover "data:image/png;base64,")
        qrCodeBase64 = qrCodeDataUrl.split(',')[1]
        console.log('✅ QR Code gerado em base64 com sucesso')
      } catch (error) {
        console.error('❌ Erro ao gerar QR Code:', error)
      }
    }

    // Preparar dados do boleto
    const boletoData = {
      boletoNumber: boleto.boletoNumber,
      customerName: boleto.Customer.name,
      customerCpfCnpj: boleto.Customer.cpfCnpj || 'Não informado',
      customerAddress: boleto.Customer.address || `${boleto.Customer.city}`,
      customerEmail: boleto.Customer.email || undefined,
      amount: originalAmount,
      dueDate: boleto.dueDate,
      issueDate: boleto.createdAt,
      description,
      pixQrCode: pixQrCode || '',
      pixQrCodeBase64: qrCodeBase64,
      barcodeNumber: boleto.barcodeNumber || undefined, // Código de barras do Cora
      digitableLine: boleto.digitableLine || undefined, // Linha digitável do Cora
      fineAmount,
      interestAmount,
      isOverdue,
      daysOverdue,
      installmentInfo: boleto.isInstallment ? {
        number: boleto.installmentNumber || 1,
        total: boleto.totalInstallments || 1
      } : undefined
    }

    // Gerar HTML
    const html = await generateBoletoPDF(boletoData)

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  } catch (error) {
    console.error('Error generating boleto view:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar visualização do boleto' },
      { status: 500 }
    )
  }
}
