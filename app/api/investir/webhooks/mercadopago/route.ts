import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Carregar credenciais do Mercado Pago
const MERCADO_PAGO_ACCESS_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN || ''

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    console.log('[Investir Webhook] Webhook recebido:', body)

    // Mercado Pago envia notificações de diferentes tipos
    if (body.type === 'payment') {
      const paymentId = body.data.id

      // Buscar informações do pagamento
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}`,
        },
      })

      if (!response.ok) {
        console.error('[Investir Webhook] Erro ao buscar pagamento no Mercado Pago')
        return NextResponse.json({ error: 'Erro ao buscar pagamento' }, { status: 500 })
      }

      const payment = await response.json()
      
      console.log('[Investir Webhook] Pagamento encontrado:', payment)

      // Buscar depósito pelo external_reference
      const depositId = payment.external_reference
      
      if (!depositId) {
        console.log('[Investir Webhook] Depósito não encontrado para external_reference:', payment.external_reference)
        return NextResponse.json({ received: true })
      }

      const deposit = await prisma.investorDeposit.findUnique({
        where: { id: depositId },
        include: { investor: true },
      })

      if (!deposit) {
        console.log('[Investir Webhook] Depósito não encontrado no banco de dados:', depositId)
        return NextResponse.json({ received: true })
      }

      // Atualizar status do depósito baseado no status do pagamento
      let newStatus: 'PENDING' | 'APPROVED' | 'FAILED' = 'PENDING'
      
      if (payment.status === 'approved') {
        newStatus = 'APPROVED'
        
        // IMPORTANTE: O dinheiro vai para o saldo da casa (InvestmentSystemBalance)
        // e também para o perfil do investidor
        let systemBalance = await prisma.investmentSystemBalance.findFirst()
        
        if (!systemBalance) {
          // Criar saldo do sistema se não existir
          systemBalance = await prisma.investmentSystemBalance.create({
            data: {
              totalDeposits: deposit.amount,
              totalWithdrawn: 0,
              availableBalance: deposit.amount,
            },
          })
        } else {
          // Atualizar saldo do sistema
          await prisma.investmentSystemBalance.update({
            where: { id: systemBalance.id },
            data: {
              totalDeposits: systemBalance.totalDeposits + deposit.amount,
              availableBalance: systemBalance.availableBalance + deposit.amount,
            },
          })
        }
        
        // AGORA adicionar saldo ao investidor também
        await prisma.investorProfile.update({
          where: { id: deposit.investorId },
          data: { balance: deposit.investor.balance + deposit.amount },
        })
        
        console.log(`[Investir Webhook] Depósito aprovado: R$ ${deposit.amount}`)
        console.log(`[Investir Webhook] - Adicionado ao saldo da casa (InvestmentSystemBalance)`)
        console.log(`[Investir Webhook] - Adicionado ao saldo do investidor ${deposit.investorId}`)
      } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
        newStatus = 'FAILED'
      }

      // Atualizar depósito
      await prisma.investorDeposit.update({
        where: { id: depositId },
        data: {
          status: newStatus,
          mercadoPagoStatus: payment.status,
          paymentMethod: payment.payment_method_id,
        },
      })

      console.log(`[Investir Webhook] Depósito ${depositId} atualizado para status ${newStatus}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[Investir Webhook] Erro ao processar webhook:', error)
    return NextResponse.json({ error: 'Erro ao processar webhook' }, { status: 500 })
  }
}

// Permitir GET para teste
export async function GET() {
  return NextResponse.json({ message: 'Webhook do Mercado Pago (Investir) está ativo' })
}
