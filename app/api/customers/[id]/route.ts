export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

// GET single customer
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Allow admins to access any customer, but customers can only access their own data
    if (user?.userType === 'CUSTOMER' && user?.customerId !== params.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // For non-admin and non-customer users, deny access
    if (user?.userType !== 'ADMIN' && user?.userType !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const customer = await prisma.customer.findUnique({
      where: { id: params.id },
      include: {
        User: true,
        Order: true
      }
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    return NextResponse.json(customer)
  } catch (error) {
    console.error('Error fetching customer:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT (update) customer
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
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
      allowInstallments,
      installmentOptions,
      canPayWithBoleto,
      password,
      sellerId,
      birthDate
    } = body

    console.log('🔍 [API /customers/[id] PUT] Recebendo atualização de cliente...')
    console.log('   - Cliente ID:', params.id)
    console.log('   - Password no body?', password !== undefined ? 'SIM' : 'NÃO')
    console.log('   - Password value:', password === '' ? '(string vazia)' : password ? '(fornecida - será hasheada)' : '(undefined/null)')

    // Validar CPF/CNPJ se foi fornecido (validação flexível para registros antigos)
    if (cpfCnpj && cpfCnpj.trim() !== '') {
      const cpfCnpjLimpo = cpfCnpj.replace(/\D/g, '')
      
      // Só validar o tamanho se o CPF/CNPJ tiver mais de 5 dígitos
      // Isso permite manter registros antigos com dados incompletos
      if (cpfCnpjLimpo.length > 5 && cpfCnpjLimpo.length !== 11 && cpfCnpjLimpo.length !== 14) {
        return NextResponse.json(
          { error: 'CPF/CNPJ inválido. O CPF deve ter 11 dígitos e o CNPJ 14 dígitos.' },
          { status: 400 }
        )
      }
    }

    // Check if customer exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { id: params.id },
      include: { User: true }
    })

    if (!existingCustomer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Calculate the difference in credit limit to adjust available credit
    const creditDifference = creditLimit - existingCustomer.creditLimit
    const calculatedCredit = Number(existingCustomer.availableCredit) + creditDifference
    // Garantir que o crédito disponível nunca exceda o novo limite
    const newAvailableCredit = Math.min(calculatedCredit, creditLimit)
    
    console.log('📝 Atualização de limite de crédito:')
    console.log('   Limite anterior:', existingCustomer.creditLimit)
    console.log('   Novo limite:', creditLimit)
    console.log('   Diferença:', creditDifference)
    console.log('   Crédito disponível anterior:', existingCustomer.availableCredit)
    console.log('   Crédito calculado:', calculatedCredit)
    console.log('   Crédito final:', newAvailableCredit)
    
    if (calculatedCredit > creditLimit) {
      console.log('   ⚠️ Crédito calculado excederia o limite! Ajustado para:', newAvailableCredit)
    }

    // Update customer
    const updatedCustomer = await prisma.customer.update({
      where: { id: params.id },
      data: {
        name,
        email,
        phone,
        cpfCnpj,
        city,
        address: address || null,
        creditLimit,
        availableCredit: newAvailableCredit, // Adjust available credit based on limit change
        customDiscount,
        paymentTerms,
        allowInstallments: allowInstallments !== undefined ? allowInstallments : false,
        installmentOptions: installmentOptions || null,
        canPayWithBoleto: canPayWithBoleto !== undefined ? canPayWithBoleto : true,
        sellerId: sellerId || null, // Atualizar o vendedor
        birthDate: birthDate ? new Date(birthDate) : null,
        updatedAt: new Date()
      }
    })

    // Update user account if exists
    if (existingCustomer.User) {
      console.log('👤 [API] Cliente tem usuário associado, verificando senha...')
      
      const updateData: any = {
        name,
        email,
        updatedAt: new Date()
      }

      // Only update password if provided
      if (password && password.trim().length > 0) {
        console.log('   🔐 Senha fornecida e não vazia - será hasheada e atualizada')
        updateData.password = await bcrypt.hash(password, 12)
      } else {
        console.log('   ⏭️ Senha NÃO fornecida ou vazia - mantendo senha atual do usuário')
      }

      await prisma.user.update({
        where: { id: existingCustomer.User.id },
        data: updateData
      })
      
      console.log('   ✅ Usuário atualizado')
    }

    return NextResponse.json(updatedCustomer)
  } catch (error) {
    console.error('Error updating customer:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE customer
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!session || user?.userType !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if customer exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { id: params.id },
      include: { User: true }
    })

    if (!existingCustomer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Delete associated user first if exists
    if (existingCustomer.User) {
      await prisma.user.delete({
        where: { id: existingCustomer.User.id }
      })
    }

    // Delete customer (this will cascade delete orders due to schema relations)
    await prisma.customer.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ message: 'Customer deleted successfully' })
  } catch (error) {
    console.error('Error deleting customer:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
