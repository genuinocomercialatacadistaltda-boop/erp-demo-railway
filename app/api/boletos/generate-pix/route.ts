
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { generateBoletoPDF } from '@/lib/boleto-pdf'
import { createPixCharge, isCoraConfigured } from '@/lib/cora'

// Calculate fine and interest for overdue payments
function calculateOverdueAmounts(originalAmount: number, dueDate: Date) {
  const now = new Date()
  const dueDateObj = new Date(dueDate)
  
  // If not overdue, return 0
  if (now <= dueDateObj) {
    return {
      fineAmount: 0,
      interestAmount: 0,
      totalAmount: originalAmount,
      daysOverdue: 0
    }
  }

  // Calculate days overdue
  const daysOverdue = Math.floor((now.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24))
  
  // Fine: 2% of original amount (applied once)
  const fineRate = 0.02
  const fineAmount = originalAmount * fineRate
  
  // Interest: 1% per month = 0.033% per day
  const interestRatePerDay = 0.0033
  const interestAmount = originalAmount * interestRatePerDay * daysOverdue
  
  // Total amount
  const totalAmount = originalAmount + fineAmount + interestAmount

  return {
    fineAmount: Math.round(fineAmount * 100) / 100,
    interestAmount: Math.round(interestAmount * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
    daysOverdue
  }
}

// POST - Generate PIX payment for a boleto via CORA
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { boletoId } = body

    if (!boletoId) {
      return NextResponse.json(
        { error: 'Boleto ID is required' },
        { status: 400 }
      )
    }

    // Get boleto with customer info
    const boleto = await prisma.boleto.findUnique({
      where: { id: boletoId },
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
      return NextResponse.json(
        { error: 'Boleto not found' },
        { status: 404 }
      )
    }

    // Check if boleto is already paid or cancelled
    if (boleto.status === 'PAID' || boleto.status === 'CANCELLED') {
      return NextResponse.json(
        { error: `Cannot generate PIX for ${boleto.status.toLowerCase()} boleto` },
        { status: 400 }
      )
    }

    // If boleto already has PIX data, just return it
    if (boleto.pixQrCode && boleto.barcodeNumber && boleto.digitableLine) {
      console.log(`✅ Boleto ${boleto.boletoNumber} já possui dados PIX/Boleto gerados pelo Cora`)
      
      // Calculate overdue amounts
      const overdueCalc = calculateOverdueAmounts(Number(boleto.amount), boleto.dueDate)
      
      // Create description
      let description = `Boleto ${boleto.boletoNumber}`
      if (boleto.Order) {
        description = `Pedido #${boleto.Order.orderNumber}`
      }
      if (boleto.isInstallment && boleto.installmentNumber && boleto.totalInstallments) {
        description += ` - Parcela ${boleto.installmentNumber}/${boleto.totalInstallments}`
      }

      // Generate PDF
      const pdfHtml = await generateBoletoPDF({
        boletoNumber: boleto.boletoNumber,
        customerName: boleto.Customer.name,
        customerCpfCnpj: boleto.Customer.cpfCnpj || 'Não informado',
        customerAddress: boleto.Customer.address || 'Não informado',
        customerEmail: boleto.Customer.email || undefined,
        amount: Number(boleto.amount),
        dueDate: boleto.dueDate,
        issueDate: boleto.createdAt,
        description,
        pixQrCode: boleto.pixQrCode || '',
        pixQrCodeBase64: boleto.pixQrCodeBase64 || '',
        barcodeNumber: boleto.barcodeNumber || '',
        digitableLine: boleto.digitableLine || '',
        fineAmount: overdueCalc.fineAmount,
        interestAmount: overdueCalc.interestAmount,
        isOverdue: (overdueCalc.daysOverdue || 0) > 0,
        daysOverdue: overdueCalc.daysOverdue || 0,
        installmentInfo: boleto.isInstallment ? {
          number: boleto.installmentNumber || 1,
          total: boleto.totalInstallments || 1
        } : undefined
      })

      // Serialize response
      const serializedBoleto = {
        ...boleto,
        amount: Number(boleto.amount),
        fineAmount: boleto.fineAmount ? Number(boleto.fineAmount) : overdueCalc.fineAmount,
        interestAmount: boleto.interestAmount ? Number(boleto.interestAmount) : overdueCalc.interestAmount,
        totalAmount: overdueCalc.totalAmount,
        dueDate: boleto.dueDate.toISOString(),
        paidDate: boleto.paidDate?.toISOString() || null,
        createdAt: boleto.createdAt.toISOString(),
        updatedAt: boleto.updatedAt.toISOString(),
        pdfHtml,
        Order: boleto.Order ? {
          ...boleto.Order,
          total: Number(boleto.Order.total)
        } : null
      }

      return NextResponse.json(serializedBoleto)
    }

    // ============================================
    // GERAR NOVO BOLETO + PIX VIA CORA
    // ============================================
    console.log('\n========================================')
    console.log('🔍 GERANDO BOLETO + PIX VIA CORA')
    console.log('========================================')
    
    if (!isCoraConfigured()) {
      console.error('❌ ERRO: Cora não está configurado!')
      return NextResponse.json({
        error: 'Sistema de boletos não configurado',
        details: 'Entre em contato com o suporte.',
        code: 'CORA_NOT_CONFIGURED'
      }, { status: 503 })
    }

    // Calculate overdue amounts if needed
    const overdueCalc = calculateOverdueAmounts(Number(boleto.amount), boleto.dueDate)
    const totalAmount = overdueCalc.totalAmount

    // Validar se cliente tem CPF/CNPJ cadastrado
    if (!boleto.Customer.cpfCnpj || boleto.Customer.cpfCnpj.trim() === '') {
      return NextResponse.json(
        { error: `Cliente ${boleto.Customer.name} não possui CPF/CNPJ cadastrado. O CPF/CNPJ é obrigatório para gerar boletos.` },
        { status: 400 }
      )
    }

    // Determine CPF/CNPJ
    const cpfCnpj = boleto.Customer.cpfCnpj.replace(/\D/g, '')
    
    // Validar tamanho do documento
    if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
      return NextResponse.json(
        { error: `CPF/CNPJ inválido para o cliente ${boleto.Customer.name}. O CPF deve ter 11 dígitos e o CNPJ 14 dígitos.` },
        { status: 400 }
      )
    }

    // Create description
    let description = `Boleto ${boleto.boletoNumber}`
    if (boleto.Order) {
      description = `Pedido #${boleto.Order.orderNumber}`
    }
    if (boleto.isInstallment && boleto.installmentNumber && boleto.totalInstallments) {
      description += ` - Parcela ${boleto.installmentNumber}/${boleto.totalInstallments}`
    }

    console.log(`🔄 Gerando Boleto + PIX via Cora para ${boleto.boletoNumber}...`)
    console.log(`📊 Valor: R$ ${totalAmount.toFixed(2)}`)
    console.log(`👤 Cliente: ${boleto.Customer.name}`)

    try {
      // Format due date as YYYY-MM-DD
      const dueDateFormatted = boleto.dueDate.toISOString().split('T')[0]

      const coraResult = await createPixCharge({
        code: boleto.boletoNumber,
        customerName: boleto.Customer.name,
        customerDocument: cpfCnpj,
        customerEmail: boleto.Customer.email || undefined,
        amount: Math.round(totalAmount * 100), // Converter para centavos
        dueDate: dueDateFormatted,
        description
      })

      console.log(`✅ Cora Result:`, {
        invoiceId: coraResult.id,
        status: coraResult.status,
        hasQrCode: !!coraResult.qr_code,
        hasBarcode: !!coraResult.barcode,
        hasDigitableLine: !!coraResult.digitable_line
      })

      // Gerar QR Code em base64 a partir do código PIX
      let qrCodeBase64 = null
      if (coraResult.qr_code) {
        try {
          const QRCode = require('qrcode')
          const qrCodeDataUrl = await QRCode.toDataURL(coraResult.qr_code, {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            width: 300,
            margin: 2
          })
          qrCodeBase64 = qrCodeDataUrl.split(',')[1] // Remove o prefixo data:image/png;base64,
          console.log('✅ QR Code gerado em base64 com sucesso')
        } catch (qrError) {
          console.error('❌ Erro ao gerar QR Code:', qrError)
        }
      }

      // Generate PDF
      const pdfHtml = await generateBoletoPDF({
        boletoNumber: boleto.boletoNumber,
        customerName: boleto.Customer.name,
        customerCpfCnpj: boleto.Customer.cpfCnpj || 'Não informado',
        customerAddress: boleto.Customer.address || 'Não informado',
        customerEmail: boleto.Customer.email || undefined,
        amount: Number(boleto.amount),
        dueDate: boleto.dueDate,
        issueDate: boleto.createdAt,
        description,
        pixQrCode: coraResult.qr_code || '',
        pixQrCodeBase64: qrCodeBase64 || '',
        barcodeNumber: coraResult.barcode || '',
        digitableLine: coraResult.digitable_line || '',
        fineAmount: overdueCalc.fineAmount,
        interestAmount: overdueCalc.interestAmount,
        isOverdue: (overdueCalc.daysOverdue || 0) > 0,
        daysOverdue: overdueCalc.daysOverdue || 0,
        installmentInfo: boleto.isInstallment ? {
          number: boleto.installmentNumber || 1,
          total: boleto.totalInstallments || 1
        } : undefined
      })

      // Update boleto with Cora data
      const updatedBoleto = await prisma.boleto.update({
        where: { id: boletoId },
        data: {
          pixQrCode: coraResult.qr_code || null,
          pixQrCodeBase64: qrCodeBase64,
          pixPaymentId: coraResult.id || null,
          barcodeNumber: coraResult.barcode || null,
          digitableLine: coraResult.digitable_line || null,
          boletoUrl: coraResult.qr_code_image || null,
          fineAmount: overdueCalc.fineAmount,
          interestAmount: overdueCalc.interestAmount,
          // Update status to OVERDUE if needed
          status: overdueCalc.daysOverdue > 0 ? 'OVERDUE' : boleto.status
        },
        include: {
          Customer: true,
          Order: true
        }
      })

      console.log(`✅ Boleto + PIX gerado com sucesso via Cora: ${boleto.boletoNumber}`)
      console.log('========================================\n')

      // Serialize response
      const serializedBoleto = {
        ...updatedBoleto,
        amount: Number(updatedBoleto.amount),
        fineAmount: updatedBoleto.fineAmount ? Number(updatedBoleto.fineAmount) : null,
        interestAmount: updatedBoleto.interestAmount ? Number(updatedBoleto.interestAmount) : null,
        totalAmount: totalAmount,
        dueDate: updatedBoleto.dueDate.toISOString(),
        paidDate: updatedBoleto.paidDate?.toISOString() || null,
        createdAt: updatedBoleto.createdAt.toISOString(),
        updatedAt: updatedBoleto.updatedAt.toISOString(),
        pdfHtml,
        Order: updatedBoleto.Order ? {
          ...updatedBoleto.Order,
          total: Number(updatedBoleto.Order.total)
        } : null
      }

      return NextResponse.json(serializedBoleto)
    } catch (coraError: any) {
      console.error('❌ Erro ao gerar boleto via Cora:', coraError?.message)
      console.error('Stack:', coraError?.stack)
      
      return NextResponse.json({
        error: 'Erro ao gerar boleto',
        details: coraError?.message || 'Não foi possível gerar o boleto. Tente novamente mais tarde.',
        code: 'CORA_ERROR'
      }, { status: 503 })
    }
  } catch (error) {
    console.error('Error generating PIX payment:', error)
    return NextResponse.json(
      { error: 'Failed to generate PIX payment', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}