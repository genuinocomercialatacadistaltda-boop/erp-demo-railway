import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { createInstantPixCharge, calculatePixFee, CoraAccountType } from '@/lib/cora'
import { Decimal } from '@prisma/client/runtime/library'

export const dynamic = 'force-dynamic'

/**
 * POST /api/pix/generate
 * Gera um QR Code PIX para pagamento instantâneo
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const {
      amount,           // Valor em REAIS (ex: 100.50)
      description,      // Descrição do pagamento
      orderId,          // ID do pedido (opcional)
      customerId,       // ID do cliente (opcional)
      customerName,     // Nome do cliente
      customerDocument, // CPF/CNPJ
      coraAccount,      // 'ESPETOS' ou 'GENUINO'
      createdBy,        // ID do usuário que criou
      cartData,         // Dados do carrinho para criar pedido automaticamente
    } = body

    // Validações
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Valor inválido' },
        { status: 400 }
      )
    }

    if (!coraAccount || !['ESPETOS', 'GENUINO'].includes(coraAccount)) {
      return NextResponse.json(
        { error: 'Conta Cora inválida. Use ESPETOS ou GENUINO' },
        { status: 400 }
      )
    }

    // Converter para centavos
    const amountInCents = Math.round(amount * 100)
    
    // Calcular taxa do Cora
    const feeInCents = calculatePixFee(amountInCents)
    const netAmountInCents = amountInCents - feeInCents

    console.log('💜 [PIX GENERATE] ================================')
    console.log('💜 Valor bruto:', amount, 'R$')
    console.log('💜 Taxa Cora:', feeInCents / 100, 'R$')
    console.log('💜 Valor líquido:', netAmountInCents / 100, 'R$')
    console.log('💜 Conta:', coraAccount)
    console.log('💜 ================================')

    // Gerar código único
    const code = `PIX-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    // Criar cobrança no Cora
    const pixResponse = await createInstantPixCharge({
      code,
      amount: amountInCents,
      description: description || 'Pagamento PIX - [SUA EMPRESA]',
      customerName,
      customerDocument,
      account: coraAccount as CoraAccountType,
    })

    // Salvar no banco de dados
    const pixCharge = await prisma.pixCharge.create({
      data: {
        coraInvoiceId: pixResponse.id,
        coraAccount,
        code,
        amount: new Decimal(amount),
        feeAmount: new Decimal(feeInCents / 100),
        netAmount: new Decimal(netAmountInCents / 100),
        qrCode: pixResponse.qrCode,
        qrCodeBase64: pixResponse.qrCodeBase64,
        status: 'PENDING',
        orderId: orderId || null,
        customerId: customerId || null,
        description,
        customerName,
        customerDocument,
        createdBy,
        cartData: cartData || null, // Dados do carrinho para criar pedido automaticamente
      },
    })
    
    if (cartData) {
      console.log('💜 [PIX] Carrinho salvo para criação automática de pedido')
    }

    console.log('💜 [PIX] Cobrança criada:', pixCharge.id)

    return NextResponse.json({
      success: true,
      pixCharge: {
        id: pixCharge.id,
        code: pixCharge.code,
        coraInvoiceId: pixCharge.coraInvoiceId,
        amount: Number(pixCharge.amount),
        feeAmount: Number(pixCharge.feeAmount),
        netAmount: Number(pixCharge.netAmount),
        qrCode: pixCharge.qrCode,
        qrCodeBase64: pixCharge.qrCodeBase64,
        status: pixCharge.status,
        coraAccount: pixCharge.coraAccount,
      },
    })
  } catch (error: any) {
    console.error('❌ [PIX] Erro ao gerar:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao gerar QR Code PIX' },
      { status: 500 }
    )
  }
}
