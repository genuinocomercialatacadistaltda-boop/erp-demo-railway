
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { DashboardClient } from './_components/dashboard-client'

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any

  if (!session || user?.userType !== 'CUSTOMER') {
    redirect('/auth/login')
  }

  // Get customer data with recent orders AND data for credit calculation
  const customerData = await prisma.customer.findUnique({
    where: { id: user.customerId },
    include: {
      Order: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          total: true,
          paymentStatus: true,
          createdAt: true,
          OrderItem: true
        }
      },
      // 🔧 Buscar TODOS receivables/boletos para verificação de duplicação correta
      // (Mesma lógica da área administrativa - evita contar orders com boleto/receivable PAID/CANCELLED)
      Receivable: {
        select: { amount: true, boletoId: true, orderId: true, status: true }
      },
      Boleto: {
        select: { amount: true, orderId: true, status: true }
      }
    }
  })

  if (!customerData) {
    redirect('/auth/login')
  }

  // 🔧 CÁLCULO DINÂMICO DO CRÉDITO DISPONÍVEL (MESMA LÓGICA DA ÁREA ADMINISTRATIVA)
  
  // 💰 Receivables PENDENTES sem boletoId (para evitar duplicação com boletos)
  const receivablesWithoutBoleto = customerData.Receivable.filter((r: any) => 
    !r.boletoId && (r.status === 'PENDING' || r.status === 'OVERDUE')
  )
  const pendingReceivables = receivablesWithoutBoleto.reduce((sum: number, r: any) => sum + Number(r.amount), 0)
  
  // 🧾 Boletos PENDENTES (PENDING ou OVERDUE)
  const boletosFiltered = customerData.Boleto.filter((b: any) => b.status === 'PENDING' || b.status === 'OVERDUE')
  const pendingBoletos = boletosFiltered.reduce((sum: number, b: any) => sum + Number(b.amount), 0)
  
  // 🔧 CORREÇÃO CRÍTICA: Contar apenas pedidos não pagos SEM boleto E SEM receivable
  // ⚠️ IMPORTANTE: Verificar em TODOS os boletos/receivables (não só os pendentes) para evitar duplicação
  const ordersFiltered = customerData.Order.filter((order: any) => {
    if (order.paymentStatus !== 'UNPAID') return false
    
    // Verificar se existe um boleto para este pedido (qualquer status)
    const hasBoleto = customerData.Boleto.some((b: any) => b.orderId === order.id)
    
    // Verificar se existe QUALQUER receivable para este pedido (qualquer status)
    const hasReceivable = customerData.Receivable.some((r: any) => r.orderId === order.id)
    
    // Incluir apenas orders que NÃO têm boleto E NÃO têm receivable (para evitar duplicação)
    return !hasBoleto && !hasReceivable
  })
  const unpaidOrders = ordersFiltered.reduce((sum: number, o: any) => sum + Number(o.total), 0)
  
  const totalUsed = pendingReceivables + pendingBoletos + unpaidOrders
  const correctAvailableCredit = Number(customerData.creditLimit) - totalUsed
  
  console.log(`[DASHBOARD] Cliente: ${customerData.name}`)
  console.log(`[DASHBOARD] Limite: ${customerData.creditLimit}`)
  console.log(`[DASHBOARD] Receivables (PENDING/OVERDUE sem boletoId): ${pendingReceivables}`)
  console.log(`[DASHBOARD] Boletos (PENDING/OVERDUE): ${pendingBoletos}`)
  console.log(`[DASHBOARD] Orders sem boleto/receivable: ${unpaidOrders}`)
  console.log(`[DASHBOARD] Total usado: ${totalUsed}`)
  console.log(`[DASHBOARD] Crédito disponível calculado: ${correctAvailableCredit}`)

  // 🔥 REDIRECIONAMENTO: Se for cliente VAREJO, redirecionar para dashboard específico
  console.log('[DASHBOARD] Customer Type:', customerData.customerType);
  if (customerData.customerType === 'VAREJO') {
    console.log('[DASHBOARD] ✅ Cliente VAREJO detectado! Redirecionando para /varejo/dashboard');
    redirect('/varejo/dashboard')
  }

  // Get notifications for this customer
  const notifications = await prisma.notification.findMany({
    where: {
      OR: [
        {
          targetRole: null,
          targetUserId: null
        },
        {
          targetUserId: customerData.id
        }
      ]
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  })

  // Serialize the data to avoid hydration issues
  // 🔧 IMPORTANTE: Substituir availableCredit pelo valor calculado dinamicamente
  const parsedData = JSON.parse(JSON.stringify(customerData))
  const serializedCustomerData = {
    ...parsedData,
    Order: parsedData.Order.slice(0, 5), // Limitar a 5 orders para exibição
    availableCredit: correctAvailableCredit, // ✅ Valor correto calculado
    creditLimit: Number(customerData.creditLimit)
  }
  const serializedNotifications = JSON.parse(JSON.stringify(notifications))

  return (
    <DashboardClient 
      customer={serializedCustomerData} 
      notifications={serializedNotifications}
      userName={user.name}
    />
  )
}
