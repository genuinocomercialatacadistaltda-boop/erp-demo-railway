import NextAuth, { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      userType?: 'ADMIN' | 'CUSTOMER' | 'SELLER' | 'EMPLOYEE'
      customerId?: string
      adminId?: string
      sellerId?: string
      employeeId?: string
    } & DefaultSession['user']
  }

  interface User {
    id: string
    userType?: 'ADMIN' | 'CUSTOMER' | 'SELLER' | 'EMPLOYEE'
    customerId?: string
    adminId?: string
    sellerId?: string
    employeeId?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    userType?: 'ADMIN' | 'CUSTOMER' | 'SELLER' | 'EMPLOYEE'
    customerId?: string
    adminId?: string
    sellerId?: string
    employeeId?: string
  }
}
