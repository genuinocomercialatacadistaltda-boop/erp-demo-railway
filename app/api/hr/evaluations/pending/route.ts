import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'
import { authOptions } from '@/lib/auth-options'

// GET - Buscar avaliações pendentes baseadas na hierarquia
// CEO avalia Gerente: diário
// Gerente avalia Encarregados: diário
// Encarregados avaliam Funcionários: diário
// Funcionários avaliam Encarregados/Gerente/CEO: semanal (1x por semana)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any)?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')
    
    // Data selecionada ou hoje
    const targetDate = dateParam ? new Date(dateParam + 'T12:00:00') : new Date()
    const startOfDay = new Date(targetDate)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(targetDate)
    endOfDay.setHours(23, 59, 59, 999)

    // Para verificação semanal: início e fim da semana
    const dayOfWeek = targetDate.getDay()
    const startOfWeek = new Date(targetDate)
    startOfWeek.setDate(targetDate.getDate() - dayOfWeek)
    startOfWeek.setHours(0, 0, 0, 0)
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    endOfWeek.setHours(23, 59, 59, 999)

    // Buscar todos os funcionários ativos
    const employees = await prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      include: {
        supervisor: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true } }
      }
    })

    // Categorizar funcionários
    const ceo = employees.find(e => e.isCEO)
    const managers = employees.filter(e => e.isManager && !e.isCEO)
    const supervisors = employees.filter(e => e.isSupervisor && !e.isManager && !e.isCEO)
    const regularEmployees = employees.filter(e => !e.isSupervisor && !e.isManager && !e.isCEO)

    // Buscar todas as avaliações do dia (para verificações diárias)
    const dailyEvaluations = await prisma.goalEvaluation.findMany({
      where: {
        date: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      select: {
        evaluatorId: true,
        employeeId: true
      }
    })

    // Buscar avaliações da semana (para funcionários avaliando líderes)
    const weeklyEvaluations = await prisma.goalEvaluation.findMany({
      where: {
        date: {
          gte: startOfWeek,
          lte: endOfWeek
        }
      },
      select: {
        evaluatorId: true,
        employeeId: true
      }
    })

    // Mapear avaliações diárias por avaliador
    const dailyEvalMap = new Map<string, Set<string>>()
    dailyEvaluations.forEach(e => {
      if (!dailyEvalMap.has(e.evaluatorId)) {
        dailyEvalMap.set(e.evaluatorId, new Set())
      }
      dailyEvalMap.get(e.evaluatorId)!.add(e.employeeId)
    })

    // Mapear avaliações semanais por avaliador
    const weeklyEvalMap = new Map<string, Set<string>>()
    weeklyEvaluations.forEach(e => {
      if (!weeklyEvalMap.has(e.evaluatorId)) {
        weeklyEvalMap.set(e.evaluatorId, new Set())
      }
      weeklyEvalMap.get(e.evaluatorId)!.add(e.employeeId)
    })

    const pendingEvaluations: Array<{
      evaluator: { id: string; name: string; role: string }
      missing: Array<{ id: string; name: string; role: string }>
      type: 'DIARIA' | 'SEMANAL'
      description: string
    }> = []

    // 1. CEO deve avaliar o(s) Gerente(s) todo dia
    if (ceo && managers.length > 0) {
      const ceoEvaluated = dailyEvalMap.get(ceo.id) || new Set()
      const missingManagers = managers.filter(m => !ceoEvaluated.has(m.id))
      
      if (missingManagers.length > 0) {
        pendingEvaluations.push({
          evaluator: { id: ceo.id, name: ceo.name, role: 'CEO' },
          missing: missingManagers.map(m => ({ id: m.id, name: m.name, role: 'Gerente' })),
          type: 'DIARIA',
          description: `CEO deve avaliar Gerente(s) diariamente`
        })
      }
    }

    // 2. Gerente(s) devem avaliar Encarregados todo dia
    managers.forEach(manager => {
      // Encarregados sob este gerente
      const managedSupervisors = supervisors.filter(s => s.managerId === manager.id)
      
      if (managedSupervisors.length > 0) {
        const managerEvaluated = dailyEvalMap.get(manager.id) || new Set()
        const missingSupervisors = managedSupervisors.filter(s => !managerEvaluated.has(s.id))
        
        if (missingSupervisors.length > 0) {
          pendingEvaluations.push({
            evaluator: { id: manager.id, name: manager.name, role: 'Gerente' },
            missing: missingSupervisors.map(s => ({ id: s.id, name: s.name, role: 'Encarregado' })),
            type: 'DIARIA',
            description: `Gerente deve avaliar Encarregado(s) diariamente`
          })
        }
      }
    })

    // 3. Encarregados devem avaliar Funcionários todo dia
    supervisors.forEach(supervisor => {
      // Funcionários sob este encarregado
      const supervisedEmployees = regularEmployees.filter(e => e.supervisorId === supervisor.id)
      
      if (supervisedEmployees.length > 0) {
        const supervisorEvaluated = dailyEvalMap.get(supervisor.id) || new Set()
        const missingEmployees = supervisedEmployees.filter(e => !supervisorEvaluated.has(e.id))
        
        if (missingEmployees.length > 0) {
          pendingEvaluations.push({
            evaluator: { id: supervisor.id, name: supervisor.name, role: 'Encarregado' },
            missing: missingEmployees.map(e => ({ id: e.id, name: e.name, role: 'Funcionário' })),
            type: 'DIARIA',
            description: `Encarregado deve avaliar Funcionário(s) diariamente`
          })
        }
      }
    })

    // 4. Funcionários devem avaliar Encarregados, Gerentes e CEO 1x por semana
    regularEmployees.forEach(employee => {
      const employeeEvaluated = weeklyEvalMap.get(employee.id) || new Set()
      const missingLeaders: Array<{ id: string; name: string; role: string }> = []
      
      // Deve avaliar seu encarregado
      if (employee.supervisorId) {
        const supervisor = supervisors.find(s => s.id === employee.supervisorId)
        if (supervisor && !employeeEvaluated.has(supervisor.id)) {
          missingLeaders.push({ id: supervisor.id, name: supervisor.name, role: 'Encarregado' })
        }
      }
      
      // Deve avaliar TODOS os gerentes (não apenas o managerId específico)
      managers.forEach(manager => {
        if (!employeeEvaluated.has(manager.id)) {
          missingLeaders.push({ id: manager.id, name: manager.name, role: 'Gerente' })
        }
      })
      
      // Deve avaliar o CEO
      if (ceo && !employeeEvaluated.has(ceo.id)) {
        missingLeaders.push({ id: ceo.id, name: ceo.name, role: 'CEO' })
      }
      
      if (missingLeaders.length > 0) {
        pendingEvaluations.push({
          evaluator: { id: employee.id, name: employee.name, role: 'Funcionário' },
          missing: missingLeaders,
          type: 'SEMANAL',
          description: `Funcionário deve avaliar líderes 1x por semana`
        })
      }
    })

    // Estatísticas
    const stats = {
      totalPending: pendingEvaluations.length,
      dailyPending: pendingEvaluations.filter(p => p.type === 'DIARIA').length,
      weeklyPending: pendingEvaluations.filter(p => p.type === 'SEMANAL').length,
      byRole: {
        ceo: pendingEvaluations.filter(p => p.evaluator.role === 'CEO').length,
        gerente: pendingEvaluations.filter(p => p.evaluator.role === 'Gerente').length,
        encarregado: pendingEvaluations.filter(p => p.evaluator.role === 'Encarregado').length,
        funcionario: pendingEvaluations.filter(p => p.evaluator.role === 'Funcionário').length
      },
      weekRange: {
        start: startOfWeek.toISOString().split('T')[0],
        end: endOfWeek.toISOString().split('T')[0]
      },
      date: targetDate.toISOString().split('T')[0]
    }

    return NextResponse.json({
      pending: pendingEvaluations,
      stats
    })

  } catch (error) {
    console.error('[PENDING_EVALUATIONS] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar avaliações pendentes' },
      { status: 500 }
    )
  }
}
