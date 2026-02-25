

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

// GET - Buscar cliente específico do vendedor
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || (session.user as any).userType !== 'SELLER') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const sellerId = (session.user as any).sellerId

    const customer = await prisma.customer.findFirst({
      where: { 
        id: params.id,
        sellerId // Apenas clientes do próprio vendedor
      },
      include: {
        User: {
          select: {
            id: true,
            email: true
          }
        }
      }
    })

    if (!customer) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    }

    return NextResponse.json(customer)
  } catch (error) {
    console.error('Error fetching customer:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar cliente' },
      { status: 500 }
    )
  }
}

// PATCH - Atualizar cliente
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('🔄 [PATCH] Iniciando atualização de cliente:', params.id)
    
    const session = await getServerSession(authOptions)
    
    if (!session || (session.user as any).userType !== 'SELLER') {
      console.log('❌ [PATCH] Não autorizado - Sem sessão ou não é vendedor')
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const sellerId = (session.user as any).sellerId
    console.log('👤 [PATCH] Vendedor ID:', sellerId)
    console.log('🎯 [PATCH] Cliente ID:', params.id)
    
    const body = await req.json()
    console.log('📦 [PATCH] Dados recebidos:', { ...body, password: body.password ? '[OCULTO]' : '[VAZIO]' })
    
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
      isActive,
      allowInstallments,
      installmentOptions,
      birthDate
    } = body

    // Verificar se o cliente pertence ao vendedor
    console.log('🔍 [PATCH] Buscando cliente...')
    const existingCustomer = await prisma.customer.findFirst({
      where: { 
        id: params.id,
        sellerId
      },
      include: {
        User: true
      }
    })

    if (!existingCustomer) {
      console.log('❌ [PATCH] Cliente não encontrado ou não pertence ao vendedor')
      console.log('   - Cliente ID buscado:', params.id)
      console.log('   - Vendedor ID:', sellerId)
      
      // Verificar se o cliente existe mas não pertence ao vendedor
      const clienteExiste = await prisma.customer.findUnique({
        where: { id: params.id },
        select: { id: true, sellerId: true, name: true }
      })
      
      if (clienteExiste) {
        console.log('⚠️ [PATCH] Cliente existe mas pertence a outro vendedor:')
        console.log('   - Cliente:', clienteExiste.name)
        console.log('   - Vendedor do Cliente:', clienteExiste.sellerId)
        console.log('   - Vendedor Atual:', sellerId)
        return NextResponse.json(
          { error: 'Este cliente não pertence a você' },
          { status: 403 }
        )
      }
      
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      )
    }
    
    console.log('✅ [PATCH] Cliente encontrado:', existingCustomer.name)

    // Verificar se o novo email já está em uso por outro cliente
    if (email && email !== existingCustomer.email) {
      const emailInUse = await prisma.customer.findFirst({
        where: {
          email,
          id: { not: params.id }
        }
      })

      if (emailInUse) {
        return NextResponse.json(
          { error: 'Email já cadastrado para outro cliente' },
          { status: 400 }
        )
      }
    }

    // Verificar se o novo CPF/CNPJ já está em uso por outro cliente
    if (cpfCnpj && cpfCnpj !== existingCustomer.cpfCnpj) {
      const cpfInUse = await prisma.customer.findFirst({
        where: {
          cpfCnpj,
          id: { not: params.id }
        }
      })

      if (cpfInUse) {
        return NextResponse.json(
          { error: 'CPF/CNPJ já cadastrado para outro cliente' },
          { status: 400 }
        )
      }
    }

    // Atualizar em transação
    console.log('💾 [PATCH] Iniciando transação de atualização...')
    const result = await prisma.$transaction(async (tx: any) => {
      // Atualizar dados do cliente
      console.log('📝 [PATCH] Atualizando dados do cliente...')
      const customer = await tx.customer.update({
        where: { id: params.id },
        data: {
          name: name || existingCustomer.name,
          email: email || existingCustomer.email,
          phone: phone || existingCustomer.phone,
          cpfCnpj: cpfCnpj || existingCustomer.cpfCnpj,
          city: city || existingCustomer.city,
          address: address !== undefined ? address : existingCustomer.address,
          creditLimit: creditLimit !== undefined ? parseFloat(creditLimit) : existingCustomer.creditLimit,
          customDiscount: customDiscount !== undefined ? parseFloat(customDiscount) : existingCustomer.customDiscount,
          paymentTerms: paymentTerms !== undefined ? parseInt(paymentTerms) : existingCustomer.paymentTerms,
          isActive: isActive !== undefined ? isActive : existingCustomer.isActive,
          allowInstallments: allowInstallments !== undefined ? allowInstallments : existingCustomer.allowInstallments,
          installmentOptions: installmentOptions !== undefined ? installmentOptions : existingCustomer.installmentOptions,
          birthDate: birthDate !== undefined && birthDate !== '' && birthDate !== null 
            ? new Date(birthDate) 
            : (birthDate === '' || birthDate === null ? null : existingCustomer.birthDate)
        }
      })
      console.log('✅ [PATCH] Cliente atualizado no banco')

      // Atualizar usuário se existir
      if (existingCustomer.User) {
        console.log('👤 [PATCH] Cliente tem usuário associado, atualizando...')
        const updateData: any = {
          name: name || existingCustomer.name,
          email: email || existingCustomer.email
        }

        // Se senha foi fornecida E não vazia, atualizar
        if (password && password.trim().length > 0) {
          console.log('🔐 [PATCH] Senha fornecida e não vazia, atualizando senha...')
          updateData.password = await bcrypt.hash(password, 10)
        } else {
          console.log('🔐 [PATCH] Senha não fornecida ou vazia, mantendo senha atual')
          console.log('   - Valor recebido:', password === '' ? '(string vazia)' : password === undefined ? '(undefined)' : password === null ? '(null)' : password)
        }

        await tx.user.update({
          where: { id: existingCustomer.User.id },
          data: updateData
        })
        console.log('✅ [PATCH] Usuário atualizado')
      } else if (password && customer.email) {
        // Se não tinha usuário mas agora tem senha e email, criar usuário
        console.log('👤 [PATCH] Cliente não tinha usuário, criando novo...')
        await tx.user.create({
          data: {
            id: crypto.randomUUID(),
            name: customer.name,
            email: customer.email,
            password: await bcrypt.hash(password, 10),
            userType: 'CUSTOMER',
            customerId: customer.id,
            updatedAt: new Date()
          }
        })
        console.log('✅ [PATCH] Usuário criado')
      } else {
        console.log('ℹ️ [PATCH] Cliente não tem usuário e senha não foi fornecida')
      }

      return customer
    })

    console.log('✅ [PATCH] Transação concluída com sucesso')
    return NextResponse.json({
      message: 'Cliente atualizado com sucesso',
      customer: result
    })
  } catch (error) {
    console.error('Error updating customer:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar cliente' },
      { status: 500 }
    )
  }
}

// DELETE - Excluir cliente
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || (session.user as any).userType !== 'SELLER') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const sellerId = (session.user as any).sellerId

    // Verificar se o cliente pertence ao vendedor
    const existingCustomer = await prisma.customer.findFirst({
      where: { 
        id: params.id,
        sellerId
      },
      include: {
        User: true,
        _count: {
          select: {
            Order: true
          }
        }
      }
    })

    if (!existingCustomer) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se há pedidos associados
    if (existingCustomer._count.Order > 0) {
      return NextResponse.json(
        { 
          error: `Não é possível excluir este cliente pois ele possui ${existingCustomer._count.Order} pedido(s) associado(s). Considere desativar o cliente em vez de excluí-lo.`
        },
        { status: 400 }
      )
    }

    // Excluir em transação
    await prisma.$transaction(async (tx: any) => {
      // Excluir configurações de catálogo do cliente
      await tx.customerProduct.deleteMany({
        where: { customerId: params.id }
      })

      // Excluir usuário se existir
      if (existingCustomer.User) {
        await tx.user.delete({
          where: { id: existingCustomer.User.id }
        })
      }

      // Excluir cliente
      await tx.customer.delete({
        where: { id: params.id }
      })
    })

    return NextResponse.json({
      message: 'Cliente excluído com sucesso'
    })
  } catch (error) {
    console.error('Error deleting customer:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir cliente' },
      { status: 500 }
    )
  }
}
