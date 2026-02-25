
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

// GET - Listar clientes do vendedor
export async function GET(req: NextRequest) {
  try {
    console.log('🔍 [GET /api/sellers/customers] Iniciando busca de clientes...')
    
    const session = await getServerSession(authOptions)
    console.log('👤 [SESSION]', session ? 'Sessão encontrada' : 'Sem sessão')
    
    if (!session) {
      console.log('❌ [AUTH] Sem sessão')
      return NextResponse.json({ error: 'Não autorizado - sem sessão' }, { status: 401 })
    }

    const user = session.user as any
    console.log('👤 [USER] userType:', user?.userType)
    console.log('👤 [USER] sellerId:', user?.sellerId)
    console.log('👤 [USER] employeeId:', user?.employeeId)
    
    if (!['SELLER', 'EMPLOYEE'].includes(user?.userType)) {
      console.log('❌ [AUTH] UserType não é SELLER nem EMPLOYEE:', user?.userType)
      return NextResponse.json({ error: 'Não autorizado - tipo de usuário incorreto' }, { status: 401 })
    }

    // Se for EMPLOYEE sem sellerId, retorna lista vazia (funcionários fazem pedidos para si mesmos)
    if (user?.userType === 'EMPLOYEE' && !user?.sellerId) {
      console.log('✅ [EMPLOYEE] Funcionário sem sellerId - retornando lista vazia de clientes')
      return NextResponse.json([])
    }

    // Se for SELLER, precisa ter sellerId
    if (user?.userType === 'SELLER' && !user?.sellerId) {
      console.log('❌ [AUTH] Vendedor não tem sellerId')
      return NextResponse.json({ error: 'Vendedor sem ID associado' }, { status: 400 })
    }

    const sellerId = user.sellerId
    console.log('🔍 [QUERY] Buscando clientes do vendedor:', sellerId)

    const customers = await prisma.customer.findMany({
      where: { sellerId },
      include: {
        Seller: {
          select: {
            name: true
          }
        },
        _count: {
          select: {
            Order: true
          }
        },
        Boleto: {
          where: {
            status: 'PENDING',
            dueDate: {
              lt: new Date() // Boletos vencidos
            }
          },
          select: {
            id: true,
            dueDate: true,
            amount: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    console.log('📊 [RESULT] Clientes encontrados:', customers.length)

    // Adicionar status de pagamento
    const customersWithStatus = customers.map((customer: any) => {
      const hasOverdueBoletos = customer.Boleto.length > 0
      
      return {
        ...customer,
        paymentStatus: hasOverdueBoletos ? 'ATRASADO' : 'EM_DIA',
        overdueBoletos: customer.Boleto.length,
        overdueAmount: customer.Boleto.reduce((sum, boleto) => sum + boleto.amount, 0)
      }
    })

    console.log('✅ [SUCCESS] Retornando', customersWithStatus.length, 'clientes')
    return NextResponse.json(customersWithStatus)
  } catch (error: any) {
    console.error('❌ [ERROR] Erro ao buscar clientes:', error)
    console.error('📋 [STACK]', error?.stack)
    return NextResponse.json(
      { error: 'Erro ao buscar clientes', details: error?.message },
      { status: 500 }
    )
  }
}

// POST - Vendedor cadastrar novo cliente
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || (session.user as any).userType !== 'SELLER') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const sellerId = (session.user as any).sellerId
    const body = await req.json()
    const { 
      name, 
      email, 
      phone, 
      cpfCnpj, 
      city, 
      address,
      creditLimit,
      customDiscount,
      paymentTerms,
      password,
      allowInstallments,
      installmentOptions,
      birthDate
    } = body

    // Validar campos obrigatórios
    if (!name || !email || !phone || !cpfCnpj || !city) {
      return NextResponse.json(
        { error: 'Campos obrigatórios não preenchidos' },
        { status: 400 }
      )
    }

    // Validar CPF/CNPJ
    const cpfCnpjLimpo = cpfCnpj.replace(/\D/g, '')
    
    if (cpfCnpjLimpo.length !== 11 && cpfCnpjLimpo.length !== 14) {
      return NextResponse.json(
        { error: 'CPF/CNPJ inválido. O CPF deve ter 11 dígitos e o CNPJ 14 dígitos.' },
        { status: 400 }
      )
    }

    // Verificar se já existe cliente com este email
    const existingCustomer = await prisma.customer.findUnique({
      where: { email }
    })

    if (existingCustomer) {
      return NextResponse.json(
        { error: 'Email já cadastrado' },
        { status: 400 }
      )
    }

    // Verificar se já existe cliente com este CPF/CNPJ (apenas se fornecido)
    if (cpfCnpj) {
      const existingCpfCnpj = await prisma.customer.findFirst({
        where: { cpfCnpj }
      })

      if (existingCpfCnpj) {
        return NextResponse.json(
          { error: 'CPF/CNPJ já cadastrado' },
          { status: 400 }
        )
      }
    }

    // Hash da senha - se não fornecida, usar senha padrão
    const passwordToUse = password || '123456' // Senha padrão se não fornecida
    const hashedPassword = await bcrypt.hash(passwordToUse, 10)
    const isDefaultPassword = !password

    // Criar cliente em uma transação
    const result = await prisma.$transaction(async (tx: any) => {
      // Criar cliente
      const customer = await tx.customer.create({
        data: {
          id: crypto.randomUUID(),
          name,
          email,
          phone,
          cpfCnpj,
          city,
          address,
          creditLimit: creditLimit || 0,
          availableCredit: creditLimit || 0,
          customDiscount: customDiscount || 0,
          paymentTerms: paymentTerms || 30,
          sellerId, // Vincular ao vendedor
          useCustomCatalog: true, // Sempre ativo
          allowInstallments: allowInstallments || false,
          installmentOptions: installmentOptions || null,
          birthDate: birthDate || null,
          updatedAt: new Date()
        }
      })

      // Buscar todos os produtos ativos de atacado
      const allProducts = await tx.product.findMany({
        where: {
          isActive: true,
          availableIn: {
            in: ['WHOLESALE', 'BOTH']
          }
        }
      })

      // Criar todos os produtos como visíveis para o cliente
      if (allProducts.length > 0) {
        await tx.customerProduct.createMany({
          data: allProducts.map((product: any) => ({
            id: crypto.randomUUID(),
            customerId: customer.id,
            productId: product.id,
            customPrice: null,
            isVisible: true, // Todos visíveis
            updatedAt: new Date()
          }))
        })
      }

      // Sempre criar usuário (obrigatório para login)
      const user = await tx.user.create({
        data: {
          id: crypto.randomUUID(),
          name,
          email,
          password: hashedPassword,
          userType: 'CUSTOMER',
          customerId: customer.id,
          updatedAt: new Date()
        }
      })

      return { customer, user, isDefaultPassword }
    })

    const message = result.isDefaultPassword
      ? 'Cliente cadastrado com sucesso! Senha padrão: 123456 - Informe ao cliente para alterar no primeiro acesso.'
      : 'Cliente cadastrado com sucesso!'

    return NextResponse.json({
      message,
      customer: result.customer,
      defaultPassword: result.isDefaultPassword ? '123456' : undefined
    })
  } catch (error) {
    console.error('Error creating customer:', error)
    return NextResponse.json(
      { error: 'Erro ao criar cliente' },
      { status: 500 }
    )
  }
}
