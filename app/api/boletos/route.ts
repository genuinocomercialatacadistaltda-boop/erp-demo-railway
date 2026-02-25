
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'

// GET all boletos (admin) or customer's boletos
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let whereClause: any = {}

    // Customers can only see their own boletos
    if (user?.userType === 'CUSTOMER') {
      whereClause = { customerId: user.customerId }
    }
    // Admins can see all boletos (no where clause)

    // Get query params for filtering
    const searchParams = request.nextUrl.searchParams
    const customerId = searchParams.get('customerId')
    const orderId = searchParams.get('orderId')
    const status = searchParams.get('status')

    if (customerId && user?.userType === 'ADMIN') {
      whereClause.customerId = customerId
    }

    if (orderId) {
      whereClause.orderId = orderId
    }

    if (status) {
      whereClause.status = status
    }

    const boletos = await prisma.boleto.findMany({
      where: whereClause,
      include: {
        Customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        Order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        dueDate: 'desc'
      }
    })

    // Helper function to get START of current day in Brasília timezone
    function getBrasiliaToday() {
      const now = new Date()
      // Subtrair 3 horas para obter horário de Brasília (UTC-3)
      const brasiliaTime = new Date(now.getTime() - (3 * 60 * 60 * 1000))
      
      // Pegar ano, mês e dia em horário de Brasília
      const year = brasiliaTime.getUTCFullYear()
      const month = brasiliaTime.getUTCMonth()
      const day = brasiliaTime.getUTCDate()
      
      // Criar data UTC para 00:00 do dia ATUAL em Brasília
      // (00:00 Brasília = 03:00 UTC)
      const todayStart = new Date(Date.UTC(year, month, day, 0, 0, 0, 0))
      return todayStart
    }
    
    // Check for overdue boletos and update status
    // Um boleto só está vencido se a data de vencimento for ANTERIOR ao dia de hoje
    const brasiliaToday = getBrasiliaToday()
    console.log('[BOLETOS_GET] Verificando boletos vencidos...')
    console.log('[BOLETOS_GET] Início do dia de hoje (Brasília):', brasiliaToday.toISOString())
    
    for (const boleto of boletos) {
      const boletoDate = new Date(boleto.dueDate)
      // Normalizar para início do dia também
      const boletoDay = new Date(Date.UTC(
        boletoDate.getUTCFullYear(),
        boletoDate.getUTCMonth(), 
        boletoDate.getUTCDate(),
        0, 0, 0, 0
      ))
      
      console.log(`[BOLETOS_GET] Boleto ${boleto.boletoNumber}: vencimento=${boletoDay.toISOString()}, status=${boleto.status}`)
      
      // Marca como vencido APENAS se a data de vencimento for ANTERIOR ao dia de hoje
      if (boleto.status === 'PENDING' && boletoDay < brasiliaToday) {
        console.log(`[BOLETOS_GET] ⚠️ Marcando boleto ${boleto.boletoNumber} como VENCIDO`)
        await prisma.boleto.update({
          where: { id: boleto.id },
          data: { status: 'OVERDUE' }
        })
      }
      
      // CORREÇÃO: Desmarca boletos que foram incorretamente marcados como vencidos
      // Se o boleto está OVERDUE mas o vencimento é HOJE ou FUTURO, volta para PENDING
      if (boleto.status === 'OVERDUE' && boletoDay >= brasiliaToday) {
        console.log(`[BOLETOS_GET] ✅ CORRIGINDO: Boleto ${boleto.boletoNumber} foi marcado incorretamente como VENCIDO. Voltando para PENDING`)
        await prisma.boleto.update({
          where: { id: boleto.id },
          data: { status: 'PENDING' }
        })
      }
    }

    // Refetch after updates
    const updatedBoletos = await prisma.boleto.findMany({
      where: whereClause,
      include: {
        Customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        Order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        dueDate: 'desc'
      }
    })

    // Serialize the response
    const serializedBoletos = updatedBoletos.map((boleto: any) => ({
      ...boleto,
      amount: Number(boleto.amount),
      dueDate: boleto.dueDate.toISOString(),
      paidDate: boleto.paidDate?.toISOString() || null,
      createdAt: boleto.createdAt.toISOString(),
      updatedAt: boleto.updatedAt.toISOString(),
      Order: boleto.Order ? {
        ...boleto.Order,
        total: Number(boleto.Order.total),
        createdAt: boleto.Order.createdAt.toISOString()
      } : null
    }))

    return NextResponse.json(serializedBoletos)
  } catch (error) {
    console.error('Error fetching boletos:', error)
    return NextResponse.json(
      { error: 'Failed to fetch boletos' },
      { status: 500 }
    )
  }
}

// POST - Create a new boleto (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { customerId, orderId, amount, dueDate, notes } = body

    if (!customerId || !amount || !dueDate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check customer's available credit
    const customer = await prisma.customer.findUnique({
      where: { id: customerId }
    })

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    if (customer.availableCredit < amount) {
      return NextResponse.json(
        { error: 'Insufficient credit limit' },
        { status: 400 }
      )
    }

    // Generate boleto number
    const boletoNumber = `BOL${Date.now().toString().slice(-8)}`

    // Create boleto and update customer's available credit
    const [boleto] = await prisma.$transaction([
      prisma.boleto.create({
        data: {
          id: crypto.randomUUID(),
          boletoNumber,
          customerId,
          orderId: orderId || null,
          amount,
          dueDate: new Date(dueDate),
          notes: notes || null,
          updatedAt: new Date()
        },
        include: {
          Customer: true,
          Order: true
        }
      }),
      prisma.customer.update({
        where: { id: customerId },
        data: {
          availableCredit: {
            decrement: amount
          }
        }
      })
    ])

    // Serialize response
    const serializedBoleto = {
      ...boleto,
      amount: Number(boleto.amount),
      dueDate: boleto.dueDate.toISOString(),
      paidDate: boleto.paidDate?.toISOString() || null,
      createdAt: boleto.createdAt.toISOString(),
      updatedAt: boleto.updatedAt.toISOString()
    }

    return NextResponse.json(serializedBoleto)
  } catch (error) {
    console.error('Error creating boleto:', error)
    return NextResponse.json(
      { error: 'Failed to create boleto' },
      { status: 500 }
    )
  }
}
