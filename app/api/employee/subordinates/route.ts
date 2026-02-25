import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

// GET /api/employee/subordinates - Busca subordinados do encarregado/gerente/CEO logado
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Buscar funcionário pelo email
    const employee = await prisma.employee.findFirst({
      where: { email: session.user.email }
    })

    if (!employee) {
      return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })
    }

    // Verificar se tem permissão (encarregado, gerente ou CEO)
    if (!employee.isSupervisor && !employee.isManager && !employee.isCEO) {
      return NextResponse.json({ error: 'Você não tem permissão para avaliar funcionários' }, { status: 403 })
    }

    console.log(`[SUBORDINATES] Buscando subordinados - Usuário: ${employee.name} (Supervisor: ${employee.isSupervisor}, Manager: ${employee.isManager}, CEO: ${employee.isCEO})`)

    let whereClause: any = { status: 'ACTIVE' }
    
    if (employee.isCEO) {
      // CEO pode ver TODOS os funcionários ativos (exceto ele mesmo)
      whereClause = {
        status: 'ACTIVE',
        id: { not: employee.id }
      }
      console.log(`[SUBORDINATES] CEO - Buscando todos os funcionários`)
    } else if (employee.isManager) {
      // Gerente pode ver todos os funcionários que não são CEO nem gerentes (exceto ele mesmo)
      whereClause = {
        status: 'ACTIVE',
        id: { not: employee.id },
        isCEO: false,
        isManager: false
      }
      console.log(`[SUBORDINATES] Gerente - Buscando funcionários não-gerentes e não-CEO`)
    } else if (employee.isSupervisor) {
      // Encarregado só vê seus subordinados diretos
      whereClause = {
        supervisorId: employee.id,
        status: 'ACTIVE'
      }
      console.log(`[SUBORDINATES] Encarregado - Buscando subordinados diretos`)
    }

    // Buscar subordinados
    const subordinates = await prisma.employee.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        employeeNumber: true,
        position: true,
        isSupervisor: true,
        isManager: true,
        isCEO: true,
        supervisorId: true,
        department: {
          select: { name: true }
        }
      },
      orderBy: { name: 'asc' }
    })

    console.log(`[SUBORDINATES] Encontrados ${subordinates.length} funcionários para avaliar`)

    return NextResponse.json(subordinates)
  } catch (error: any) {
    console.error('[SUBORDINATES] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar subordinados', details: error.message },
      { status: 500 }
    )
  }
}
