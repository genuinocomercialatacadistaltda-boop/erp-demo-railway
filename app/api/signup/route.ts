
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

export async function GET(request: NextRequest) {
  // Return signup info for testing framework
  return NextResponse.json({
    success: true,
    message: 'Signup endpoint active',
    note: 'Customer registration is handled through admin interface',
    endpoint: '/api/signup',
    method: 'POST',
    requiredFields: ['email', 'password'],
    optionalFields: ['firstName', 'companyName', 'phone', 'cpfCnpj']
  }, { 
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type')
    let body: any = {}
    
    if (contentType?.includes('application/json')) {
      body = await request.json()
    } else {
      const formData = await request.formData()
      body = Object.fromEntries(formData.entries())
    }
    
    const { email, password, firstName, companyName, phone, cpfCnpj } = body

    // Basic validation
    if (!email || !password) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Email and password are required',
          details: { email: !!email, password: !!password }
        },
        { status: 400 }
      )
    }

    console.log('Signup attempt for email:', email)

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      console.log('User already exists:', email)
      return NextResponse.json(
        { 
          success: false,
          error: 'User already exists with this email' 
        },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    let customer = null
    
    // If customer data is provided, create customer record
    if (companyName && phone && cpfCnpj) {
      // Check if customer with this email already exists
      const existingCustomer = await prisma.customer.findFirst({
        where: { 
          OR: [
            { email },
            { cpfCnpj }
          ]
        }
      })

      if (!existingCustomer) {
        customer = await prisma.customer.create({
          data: {
            id: crypto.randomUUID(),
            name: companyName,
            email,
            phone,
            cpfCnpj,
            city: 'Cidade não informada',
            creditLimit: 0,
            availableCredit: 0,
            customDiscount: 0,
            paymentTerms: 30,
            updatedAt: new Date()
          }
        })
        console.log('Customer created:', customer.id)
      }
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        id: `user-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        email,
        name: firstName || companyName || email.split('@')[0],
        password: hashedPassword,
        userType: 'CUSTOMER',
        customerId: customer?.id || null,
        updatedAt: new Date()
      }
    })

    console.log('User created successfully:', user.id)

    // Return success response
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        userType: user.userType,
        customerId: user.customerId
      },
      message: 'User created successfully'
    })

  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
