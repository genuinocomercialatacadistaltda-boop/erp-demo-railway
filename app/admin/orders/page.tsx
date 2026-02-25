
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import { OrdersManagement } from './orders-management'

export const dynamic = "force-dynamic"

export default async function OrdersPage() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any

  if (!session || user?.userType !== 'ADMIN') {
    redirect('/auth/login')
  }

  console.log('🔄 [ORDERS_PAGE] Carregando TODOS os pedidos...')

  // ⚡ Carrega TODOS os pedidos para garantir busca completa
  const orders = await prisma.order.findMany({
    select: {
      id: true,
      orderNumber: true,
      orderType: true,
      deliveryType: true,
      deliveryDate: true,
      deliveryTime: true,
      paymentMethod: true,
      status: true,
      paymentStatus: true,
      subtotal: true,
      discount: true,
      total: true,
      createdAt: true,
      updatedAt: true,
      customerId: true,
      sellerId: true,
      userId: true,
      // 🔧 CORREÇÃO: Incluir campos do pedido para busca funcionar corretamente
      customerName: true,
      casualCustomerName: true,
      customerPhone: true,
      customerEmail: true,
      address: true,
      city: true,
      Customer: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          city: true
        }
      },
      Employee: { // 🆕 Incluir Employee
        select: {
          id: true,
          name: true,
          email: true,
          phone: true
        }
      },
      User: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      Seller: {
        select: {
          id: true,
          name: true
        }
      },
      OrderItem: {
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          total: true,
          productId: true,
          Product: {
            select: {
              id: true,
              name: true,
              priceWholesale: true,
              priceRetail: true
            }
          }
        }
      },
      Boleto: {
        where: {
          status: {
            in: ['PENDING', 'OVERDUE', 'PAID']
          }
        },
        select: {
          id: true,
          boletoNumber: true,
          amount: true,
          dueDate: true,
          status: true,
          isInstallment: true,
          installmentNumber: true,
          totalInstallments: true
        },
        orderBy: [
          { installmentNumber: 'asc' },
          { createdAt: 'asc' }
        ]
      }
    },
    orderBy: { createdAt: 'desc' }
    // Sem limite - carrega TODOS os pedidos
  })

  console.log(`✅ [ORDERS_PAGE] ${orders.length} pedidos carregados (TODOS)`)

  const serializedOrders = orders.map((order: any) => ({
    ...order,
    subtotal: Number(order.subtotal),
    discount: Number(order.discount),
    total: Number(order.total),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    deliveryDate: order.deliveryDate?.toISOString() || null,
    // 🔧 CORREÇÃO: Usar campos do Order primeiro, depois fallback para Customer/Employee
    customerName: order.customerName || order.casualCustomerName || (order.Employee ? `Funcionário - ${order.Employee.name}` : (order.Customer?.name || 'Cliente não identificado')),
    casualCustomerName: order.casualCustomerName || null,
    customerPhone: order.customerPhone || order.Employee?.phone || order.Customer?.phone || null,
    customerEmail: order.customerEmail || order.Employee?.email || order.Customer?.email || null,
    city: order.city || order.Customer?.city || null,
    address: order.address || null,
    customer: order.Customer,
    employee: order.Employee, // 🆕 Adicionar employee
    orderItems: order.OrderItem?.map((item: any) => ({
      ...item,
      unitPrice: Number(item.unitPrice),
      total: Number(item.total),
      product: {
        ...item.Product,
        priceWholesale: Number(item.Product?.priceWholesale || 0),
        priceRetail: Number(item.Product?.priceRetail || 0)
      }
    })) || [],
    boletos: order.Boleto?.map((boleto: any) => ({
      id: boleto.id,
      boletoNumber: boleto.boletoNumber,
      amount: Number(boleto.amount),
      dueDate: boleto.dueDate.toISOString(),
      status: boleto.status,
      isInstallment: boleto.isInstallment,
      installmentNumber: boleto.installmentNumber,
      totalInstallments: boleto.totalInstallments
    })) || []
  }))

  return <OrdersManagement orders={serializedOrders} />
}
