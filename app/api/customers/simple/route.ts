export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { authOptions } from '@/lib/auth-options'

// ⚡ API OTIMIZADA - Apenas dados essenciais para seleção de clientes
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (user?.userType !== 'ADMIN' && user?.userType !== 'SELLER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    console.log('⚡ [CUSTOMERS_SIMPLE] Buscando lista simplificada de clientes...')

    // 🔧 CORREÇÃO: Incluir apenas Receivable e Boleto para cálculo correto do availableCredit
    // ✅ NÃO precisa mais buscar Orders - receivables/boletos já representam a dívida
    const customers = await prisma.customer.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        cpfCnpj: true,
        city: true,
        address: true,
        creditLimit: true,
        customDiscount: true,
        paymentTerms: true,
        allowInstallments: true,
        installmentOptions: true,
        canPayWithBoleto: true,
        customerType: true,
        Receivable: {
          where: {
            OR: [
              { status: 'PENDING' },
              { status: 'OVERDUE' }
            ]
          },
          select: {
            id: true,
            amount: true,
            status: true,
            boletoId: true
          }
        },
        Boleto: {
          where: {
            OR: [
              { status: 'PENDING' },
              { status: 'OVERDUE' }
            ]
          },
          select: {
            id: true,
            amount: true,
            status: true
          }
        }
      },
      where: {
        isActive: true  // ⚡ Apenas clientes ativos
      },
      orderBy: {
        name: 'asc'
      }
    })

    console.log(`✅ [CUSTOMERS_SIMPLE] ${customers.length} clientes carregados rapidamente`)

    // 🔧 Serialização com cálculo dinâmico do availableCredit
    // ✅ CORREÇÃO: Usar MESMA lógica da tela de financeiro (customers-health)
    // NÃO contar pedidos separadamente - apenas receivables e boletos
    const serializedCustomers = customers.map((customer: any) => {
      // 💰 Receivables pendentes SEM boleto (para evitar duplicação com boletos)
      const receivablesWithoutBoleto = customer.Receivable.filter((r: any) => !r.boletoId)
      const pendingReceivables = receivablesWithoutBoleto.reduce((sum: number, r: any) => sum + Number(r.amount), 0)
      
      // 🧾 Boletos pendentes (PENDING ou OVERDUE)
      const pendingBoletos = customer.Boleto.reduce((sum: number, b: any) => sum + Number(b.amount), 0)
      
      // ✅ CORREÇÃO: NÃO contar pedidos separadamente!
      // Os receivables/boletos já representam a dívida do cliente.
      // Contar pedidos + receivables causa duplicação.
      
      const totalUsed = pendingReceivables + pendingBoletos
      const correctAvailableCredit = Number(customer.creditLimit) - totalUsed
      
      return {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        cpfCnpj: customer.cpfCnpj,
        city: customer.city,
        address: customer.address,
        creditLimit: Number(customer.creditLimit),
        availableCredit: correctAvailableCredit, // ✅ Cálculo igual à tela de financeiro
        customDiscount: Number(customer.customDiscount),
        paymentTerms: customer.paymentTerms,
        allowInstallments: customer.allowInstallments,
        installmentOptions: customer.installmentOptions,
        canPayWithBoleto: customer.canPayWithBoleto,
        customerType: customer.customerType
      }
    })

    return NextResponse.json(serializedCustomers)
  } catch (error) {
    console.error('❌ [CUSTOMERS_SIMPLE] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customers' },
      { status: 500 }
    )
  }
}
