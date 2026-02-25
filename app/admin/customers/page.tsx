
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { CustomerManagement } from './customer-management'

export const dynamic = "force-dynamic"

export default async function CustomersPage() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any

  if (!session || user?.userType !== 'ADMIN') {
    redirect('/auth/login')
  }

  const customers = await prisma.customer.findMany({
    include: {
      User: true,
      Seller: {
        select: {
          id: true,
          name: true
        }
      },
      Order: {
        where: {
          paymentStatus: 'UNPAID'
        },
        select: {
          id: true,
          total: true,
          paymentStatus: true
        }
      },
      // 🔧 Incluir TODOS receivables e boletos para cálculo dinâmico de crédito
      Receivable: {
        select: {
          amount: true,
          status: true,
          boletoId: true,
          orderId: true
        }
      },
      Boleto: {
        select: {
          amount: true,
          status: true,
          orderId: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  // 🆕 Buscar funcionários com limite de crédito ou que recebem adiantamento
  const employees = await prisma.employee.findMany({
    where: {
      OR: [
        { creditLimit: { gt: 0 } },
        { receivesAdvance: true }
      ],
      isActive: true
    },
    include: {
      receivables: {
        select: {
          amount: true,
          status: true,
        }
      },
      orders: {
        where: {
          paymentStatus: 'UNPAID'
        },
        select: {
          id: true,
          total: true,
          paymentStatus: true
        }
      }
    },
    orderBy: { name: 'asc' }
  })

  // 🆕 Transformar funcionários no formato de clientes
  // ✅ LIMITE FIXO DE R$ 300 PARA TODOS FUNCIONÁRIOS
  const EMPLOYEE_CREDIT_LIMIT = 300
  
  const employeesAsCustomers = employees.map((emp: any) => ({
    id: emp.id,
    name: `${emp.name} (Funcionário)`,
    email: emp.email || null,
    phone: emp.phone || null,
    address: emp.address || null,
    city: null,
    state: null,
    cpfCnpj: emp.cpf,
    creditLimit: EMPLOYEE_CREDIT_LIMIT, // ✅ LIMITE FIXO R$ 300
    isActive: emp.isActive,
    isEmployee: true, // 🔥 Flag para identificar funcionários
    employeeNumber: emp.employeeNumber,
    position: emp.position,
    User: null,
    Seller: null,
    Order: emp.orders || [], // Incluir pedidos não pagos
    Receivable: emp.receivables || [],
    Boleto: [], // Funcionários não têm boletos
    createdAt: emp.createdAt,
    updatedAt: emp.updatedAt
  }))

  // 🆕 Unir clientes e funcionários
  const allCustomers = [...customers, ...employeesAsCustomers]

  // ✅ Calcular availableCredit DINAMICAMENTE (mesma lógica da Gestão Financeira)
  const serializedCustomers = allCustomers.map((customer: any) => {
    // 💰 Receivables pendentes SEM boleto (para evitar duplicação)
    const pendingReceivables = customer.Receivable
      .filter((r: any) => !r.boletoId && (r.status === 'PENDING' || r.status === 'OVERDUE'))
      .reduce((sum: number, r: any) => sum + Number(r.amount), 0)
    
    // 🧾 Boletos pendentes (PENDING ou OVERDUE)
    const pendingBoletos = customer.Boleto
      .filter((b: any) => b.status === 'PENDING' || b.status === 'OVERDUE')
      .reduce((sum: number, b: any) => sum + Number(b.amount), 0)
    
    // 📦 Orders não pagos SEM boleto E SEM receivable (para evitar duplicação)
    const pendingOrders = customer.Order
      .filter((o: any) => {
        if (o.paymentStatus !== 'UNPAID') return false
        const hasBoleto = customer.Boleto.some((b: any) => b.orderId === o.id)
        const hasReceivable = customer.Receivable.some((r: any) => r.orderId === o.id)
        return !hasBoleto && !hasReceivable
      })
      .reduce((sum: number, o: any) => sum + Number(o.total), 0)
    
    const totalUsed = pendingReceivables + pendingBoletos + pendingOrders
    const dynamicAvailableCredit = Number(customer.creditLimit) - totalUsed
    
    return {
      ...customer,
      creditLimit: Number(customer.creditLimit),
      availableCredit: dynamicAvailableCredit, // ✅ Cálculo dinâmico correto
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
      user: customer.User ? {
        ...customer.User,
        createdAt: customer.User.createdAt.toISOString(),
        updatedAt: customer.User.updatedAt.toISOString()
      } : null,
      orders: customer.Order.map((order: any) => ({
        ...order,
        total: Number(order.total)
      })),
      // Remover Receivable e Boleto da resposta (usados apenas para cálculo)
      Receivable: undefined,
      Boleto: undefined
    }
  }) as any

  return <CustomerManagement customers={serializedCustomers} />
}
