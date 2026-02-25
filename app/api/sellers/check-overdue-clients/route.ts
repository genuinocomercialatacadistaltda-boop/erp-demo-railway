export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || (session.user as any).userType !== 'SELLER') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const sellerId = (session.user as any).sellerId

    // Buscar todos os clientes do vendedor que têm boletos vencidos
    const overdueClients = await prisma.customer.findMany({
      where: {
        sellerId,
        isActive: true,
        Boleto: {
          some: {
            status: 'PENDING',
            dueDate: {
              lt: new Date()
            }
          }
        }
      },
      include: {
        Boleto: {
          where: {
            status: 'PENDING',
            dueDate: {
              lt: new Date()
            }
          },
          orderBy: {
            dueDate: 'asc'
          }
        }
      }
    })

    if (overdueClients.length === 0) {
      return NextResponse.json({ 
        message: 'Nenhum cliente em atraso',
        overdueClients: []
      })
    }

    // Buscar o vendedor para obter o userId
    const seller = await prisma.seller.findUnique({
      where: { id: sellerId },
      include: {
        User: true
      }
    })

    if (!seller?.User) {
      return NextResponse.json({ 
        error: 'Vendedor não encontrado' 
      }, { status: 404 })
    }

    const now = new Date()
    const notificationsCreated = []

    // Criar uma notificação para cada cliente em atraso
    for (const client of overdueClients) {
      const overdueBoletos = client.Boleto
      const totalOverdueAmount = overdueBoletos.reduce((sum, boleto) => sum + boleto.amount, 0)
      
      // Calcular dias de atraso do boleto mais antigo
      const oldestBoleto = overdueBoletos[0]
      const daysOverdue = Math.floor((now.getTime() - oldestBoleto.dueDate.getTime()) / (1000 * 60 * 60 * 24))

      // Verificar se já existe uma notificação recente (últimas 24h) para este cliente
      const recentNotification = await prisma.notification.findFirst({
        where: {
          targetUserId: seller.User.id,
          message: {
            contains: client.name
          },
          type: 'SYSTEM',
          category: 'BOLETO',
          createdAt: {
            gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) // Últimas 24 horas
          }
        }
      })

      // Se já existe notificação recente, pular
      if (recentNotification) {
        continue
      }

      // Criar notificação para o vendedor
      const notification = await prisma.notification.create({
        data: {
          id: crypto.randomUUID(),
          title: '⚠️ Cliente em Atraso - Ação Necessária',
          message: `O cliente **${client.name}** está com ${overdueBoletos.length} boleto(s) vencido(s) totalizando **R$ ${totalOverdueAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}**. O boleto mais antigo está vencido há **${daysOverdue} dia(s)**. Por favor, entre em contato para realizar a cobrança.`,
          type: 'SYSTEM',
          category: 'BOLETO',
          deliveryMode: 'AUTOMATIC',
          targetRole: 'SELLER',
          targetUserId: seller.User.id,
          isRead: false,
          createdAt: now,
          updatedAt: now
        }
      })

      notificationsCreated.push({
        clientName: client.name,
        overdueBoletos: overdueBoletos.length,
        totalAmount: totalOverdueAmount,
        daysOverdue
      })
    }

    return NextResponse.json({
      message: `${notificationsCreated.length} notificação(ões) criada(s)`,
      overdueClients: notificationsCreated
    })
  } catch (error) {
    console.error('Error checking overdue clients:', error)
    return NextResponse.json(
      { error: 'Erro ao verificar clientes em atraso' },
      { status: 500 }
    )
  }
}
