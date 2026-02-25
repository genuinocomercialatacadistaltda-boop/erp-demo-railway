
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { generateBoletoPDF } from '@/lib/boleto-pdf'
import QRCode from 'qrcode'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: {
        Customer: true,
        OrderItem: {
          include: {
            Product: true
          }
        },
        Boleto: {
          where: {
            status: {
              in: ['PENDING', 'OVERDUE', 'PAID']
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
    })

    if (!order) {
      return new NextResponse('Order not found', { status: 404 })
    }

    // Check if order has a boleto
    const boleto = order.Boleto && order.Boleto.length > 0 ? order.Boleto[0] : null

    if (!boleto) {
      return new NextResponse(
        `<!DOCTYPE html>
        <html>
          <head>
            <title>Boleto não encontrado</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              }
              .container {
                background: white;
                padding: 40px;
                border-radius: 10px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                text-align: center;
              }
              h1 { color: #e53e3e; margin-bottom: 10px; }
              p { color: #4a5568; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>⚠️ Boleto não encontrado</h1>
              <p>Este pedido não possui um boleto associado ou foi pago com outro método de pagamento.</p>
              <p style="margin-top: 20px;">
                <a href="/admin/orders" style="color: #667eea; text-decoration: none; font-weight: bold;">← Voltar para Pedidos</a>
              </p>
            </div>
          </body>
        </html>`,
        { 
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        }
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
    let description = `Pedido #${order.orderNumber}`
    if (boleto.isInstallment && boleto.installmentNumber && boleto.totalInstallments) {
      description += ` - Parcela ${boleto.installmentNumber}/${boleto.totalInstallments}`
    }

    // Gerar QR Code base64 se não existir mas a string existir
    const pixQrCode = boleto.pixQrCode || ''
    let qrCodeBase64 = boleto.pixQrCodeBase64 || ''
    
    if (pixQrCode && !qrCodeBase64) {
      try {
        const qrCodeDataUrl = await QRCode.toDataURL(pixQrCode, {
          errorCorrectionLevel: 'M',
          type: 'image/png',
          width: 300,
          margin: 2
        })
        qrCodeBase64 = qrCodeDataUrl.split(',')[1]
        console.log('✅ QR Code gerado em base64 com sucesso')
      } catch (error) {
        console.error('❌ Erro ao gerar QR Code:', error)
      }
    }

    // Preparar dados do boleto usando a mesma lib
    const boletoData = {
      boletoNumber: boleto.boletoNumber,
      customerName: order.Customer?.name || order.customerName || 'N/A',
      customerCpfCnpj: order.Customer?.cpfCnpj || 'Não informado',
      customerAddress: order.Customer?.address || `${order.Customer?.city || order.city || ''}`,
      customerEmail: order.Customer?.email || undefined,
      amount: originalAmount,
      dueDate: boleto.dueDate,
      issueDate: boleto.createdAt,
      description,
      pixQrCode: pixQrCode,
      pixQrCodeBase64: qrCodeBase64,
      barcodeNumber: boleto.barcodeNumber || undefined,
      digitableLine: boleto.digitableLine || undefined,
      fineAmount,
      interestAmount,
      isOverdue,
      daysOverdue,
      installmentInfo: boleto.isInstallment ? {
        number: boleto.installmentNumber || 1,
        total: boleto.totalInstallments || 1
      } : undefined
    }

    // Gerar HTML usando a função da lib (mesmo layout que o outro endpoint)
    const html = await generateBoletoPDF(boletoData)

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    })
  } catch (error) {
    console.error('Error generating boleto:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
