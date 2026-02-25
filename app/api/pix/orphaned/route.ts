export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Find all PAID PIX charges without orders
    const orphanedPix = await prisma.pixCharge.findMany({
      where: {
        status: 'PAID',
        orderId: null
      },
      orderBy: { paidAt: 'desc' }
    })

    // Filter out test payments (R$ 5, R$ 6, etc.)
    const significantPix = orphanedPix.filter(pix => Number(pix.amount) >= 10)
    const testPix = orphanedPix.filter(pix => Number(pix.amount) < 10)

    return NextResponse.json({
      success: true,
      significantPix,
      testPix,
      totalOrphaned: orphanedPix.length,
      totalSignificant: significantPix.length
    })
  } catch (error: any) {
    console.error('Erro ao buscar PIX órfãos:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { pixChargeId, action } = await request.json()

    if (!pixChargeId) {
      return NextResponse.json({ error: 'ID do PIX é obrigatório' }, { status: 400 })
    }

    const pixCharge = await prisma.pixCharge.findUnique({
      where: { id: pixChargeId }
    })

    if (!pixCharge) {
      return NextResponse.json({ error: 'PIX não encontrado' }, { status: 404 })
    }

    if (pixCharge.orderId) {
      return NextResponse.json({ error: 'PIX já tem pedido vinculado' }, { status: 400 })
    }

    if (action === 'dismiss') {
      // Mark as dismissed (set orderId to special value)
      await prisma.pixCharge.update({
        where: { id: pixChargeId },
        data: { description: `${pixCharge.description || ''} [DESCARTADO]` }
      })
      return NextResponse.json({ success: true, message: 'PIX marcado como descartado' })
    }

    // Create order from PIX
    const now = new Date()
    const orderId = randomUUID()
    const orderNumber = `PIX-${Date.now()}`

    // Create order
    const order = await prisma.order.create({
      data: {
        id: orderId,
        orderNumber,
        customerName: pixCharge.customerName || 'Cliente PIX',
        casualCustomerName: pixCharge.customerName,
        orderType: 'WHOLESALE',
        paymentMethod: 'PIX',
        paymentStatus: 'PAID',
        paidAmount: Number(pixCharge.amount),
        status: 'PENDING',
        subtotal: Number(pixCharge.amount),
        total: Number(pixCharge.amount),
        discount: 0,
        discountPercent: 0,
        cardFee: 0,
        couponDiscount: 0,
        boletoFee: 0,
        volumes: 1,
        notes: 'Pedido criado automaticamente a partir de PIX órfão',
        createdByRole: 'ADMIN-RECOVERY',
        createdAt: pixCharge.paidAt || now,
        updatedAt: now,
      }
    })

    // Link PIX to order
    await prisma.pixCharge.update({
      where: { id: pixChargeId },
      data: { orderId: order.id }
    })

    // Create receivable
    await prisma.receivable.create({
      data: {
        id: randomUUID(),
        orderId: order.id,
        description: `Pedido ${order.orderNumber} - PIX`,
        amount: Number(pixCharge.amount),
        dueDate: now,
        status: 'PAID',
        paymentMethod: 'PIX',
        paymentDate: pixCharge.paidAt,
        createdAt: pixCharge.paidAt || now,
        updatedAt: now,
      }
    })

    // Find correct bank account based on coraAccount
    const bankAccounts = await prisma.bankAccount.findMany()
    const bankAccount = pixCharge.coraAccount === 'GENUINO' 
      ? bankAccounts.find(a => a.name.toLowerCase().includes('genuino') || a.name.toLowerCase().includes('genuíno'))
      : bankAccounts.find(a => a.name.toLowerCase().includes('espetos') && a.name.toLowerCase().includes('cora'))

    if (bankAccount) {
      const newBalance = Number(bankAccount.balance) + Number(pixCharge.netAmount)

      await prisma.transaction.create({
        data: {
          id: randomUUID(),
          bankAccountId: bankAccount.id,
          type: 'INCOME',
          amount: Number(pixCharge.netAmount),
          description: `PIX ${order.orderNumber} - ${pixCharge.customerName}`,
          date: pixCharge.paidAt || now,
          createdAt: pixCharge.paidAt || now,
          balanceAfter: newBalance,
        }
      })

      await prisma.bankAccount.update({
        where: { id: bankAccount.id },
        data: { balance: newBalance }
      })
    }

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        total: order.total
      }
    })
  } catch (error: any) {
    console.error('Erro ao processar PIX órfão:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
