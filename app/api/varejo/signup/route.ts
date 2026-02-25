export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, phone, password } = body

    // Validações
    if (!name || !phone || !password) {
      return NextResponse.json(
        { success: false, error: 'Nome, telefone e senha são obrigatórios' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'A senha deve ter no mínimo 6 caracteres' },
        { status: 400 }
      )
    }

    // Normaliza email: se for vazio, define como null
    const normalizedEmail = (email && email.trim() !== '') ? email.trim() : null

    // Verifica se já existe um usuário com esse email
    if (normalizedEmail) {
      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail }
      })

      if (existingUser) {
        return NextResponse.json(
          { success: false, error: 'Já existe uma conta com este email' },
          { status: 400 }
        )
      }

      // Verifica se já existe um cliente com esse email
      const existingCustomerWithEmail = await prisma.customer.findFirst({
        where: { email: normalizedEmail }
      })

      if (existingCustomerWithEmail) {
        return NextResponse.json(
          { success: false, error: 'Já existe um cadastro com este email' },
          { status: 400 }
        )
      }
    }

    // Verifica se já existe um cliente com esse telefone
    const existingCustomer = await prisma.customer.findFirst({
      where: { phone }
    })

    if (existingCustomer) {
      return NextResponse.json(
        { success: false, error: 'Já existe um cadastro com este telefone' },
        { status: 400 }
      )
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10)

    // Criar customer VAREJO
    const customerId = crypto.randomUUID()
    const customer = await prisma.customer.create({
      data: {
        id: customerId,
        name,
        email: normalizedEmail,
        phone,
        city: 'Não informado', // Campo obrigatório
        customerType: 'VAREJO',
        isActive: true,
        creditLimit: 0,
        availableCredit: 0,
        customDiscount: 0,
        paymentTerms: 0,
        allowInstallments: false,
        useCustomCatalog: false,
        allowLaterPayment: false,
        pointsBalance: 0,
        pointsMultiplier: 1.0,
        totalPointsEarned: 0,
        totalPointsRedeemed: 0
      }
    })

    // Criar usuário
    const userId = crypto.randomUUID()
    const user = await prisma.user.create({
      data: {
        id: userId,
        name,
        email: normalizedEmail || `${phone}@varejo.local`, // Email temporário se não fornecido
        password: hashedPassword,
        userType: 'CUSTOMER',
        customerId: customer.id,
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Cadastro realizado com sucesso!',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        customerId: customer.id
      }
    })
  } catch (error) {
    console.error('Erro ao criar cliente varejo:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro ao realizar cadastro. Tente novamente.' 
      },
      { status: 500 }
    )
  }
}
