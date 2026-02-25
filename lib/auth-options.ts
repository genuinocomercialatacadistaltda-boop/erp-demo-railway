
import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from './db'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        cpf: { label: 'CPF', type: 'text' },
        password: { label: 'Password', type: 'password' },
        customerId: { label: 'Customer ID', type: 'text' },
        ssoToken: { label: 'SSO Token', type: 'text' }
      },
      async authorize(credentials) {
        console.log('[AUTH] Authorize called with:', { 
          hasEmail: !!credentials?.email,
          hasSSO: !!credentials?.ssoToken
        });
        
        // Fluxo SSO: autentica\u00e7\u00e3o via token
        if (credentials?.ssoToken && credentials?.customerId) {
          console.log('[AUTH] SSO Login detectado para customerId:', credentials.customerId);
          
          const customer = await prisma.customer.findUnique({
            where: { id: credentials.customerId },
            include: {
              User: true,
              InvestorProfile: true
            }
          });
          
          if (!customer) {
            console.log('[AUTH] SSO: Cliente n\u00e3o encontrado');
            return null;
          }
          
          console.log('[AUTH] SSO: Cliente autenticado:', customer.name);
          
          return {
            id: customer.User?.id || customer.id,
            email: customer.email || customer.User?.email || '',
            name: customer.name,
            userType: 'CUSTOMER',
            customerId: customer.id,
            customerType: customer.customerType,
            hasInvestorProfile: !!customer.InvestorProfile
          };
        }
        
        // Fluxo normal: autentica\u00e7\u00e3o via senha
        if (!credentials?.password || !credentials?.email) {
          console.log('[AUTH] Missing password or email');
          return null;
        }

        // Primeiro, tenta encontrar funcionário com esse email
        const employee = await prisma.employee.findFirst({
          where: { email: credentials.email },
          include: { 
            department: true,
            seller: true  // Incluir seller se funcionário for também vendedor
          }
        });

        if (employee) {
          console.log('[AUTH] Tentando login de funcionário via email');
          console.log('[AUTH] Employee found:', !!employee, 'Has password:', !!(employee as any)?.password);
          console.log('[AUTH] Employee has Seller?', !!employee.seller, 'SellerId:', employee.sellerId);

          if (!(employee as any)?.password) {
            console.log('[AUTH] Employee has no password');
            return null;
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            (employee as any).password
          );

          console.log('[AUTH] Employee password valid:', isPasswordValid);

          if (!isPasswordValid) {
            console.log('[AUTH] Invalid employee password');
            return null;
          }

          console.log('[AUTH] Employee login successful:', employee.name);
          
          // 🔥 FUNCIONÁRIO COM VENDEDOR VINCULADO FAZ LOGIN COMO SELLER
          if (employee.seller && employee.sellerId) {
            console.log('[AUTH] ✅ Funcionário tem vendedor vinculado! Autenticando como SELLER');
            console.log('[AUTH] Seller Name:', employee.seller.name);
            console.log('[AUTH] Seller ID:', employee.sellerId);
            
            return {
              id: employee.id,
              email: employee.email || '',
              name: employee.name,
              userType: 'SELLER', // 🔥 AUTENTICADO COMO SELLER!
              sellerId: employee.sellerId, // 🔥 ID DO VENDEDOR VINCULADO
              employeeId: employee.id, // Mantém referência ao funcionário
              seller: employee.seller, // Dados do vendedor
              employee: employee, // Dados do funcionário
            };
          }
          
          // Funcionário SEM vendedor vinculado faz login como EMPLOYEE normal
          console.log('[AUTH] Funcionário SEM vendedor vinculado. Autenticando como EMPLOYEE');
          return {
            id: employee.id,
            email: employee.email || '',
            name: employee.name,
            userType: 'EMPLOYEE',
            employeeId: employee.id,
            sellerId: null,
            hasSeller: false,
            employee: employee,
          };
        }

        // Se não encontrou funcionário, tenta login de usuário normal
        console.log('[AUTH] Tentando login de usuário via email:', credentials.email);

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: {
            Customer: true,
            Seller: true
          }
        });

        console.log('[AUTH] User found:', !!user, 'Has password:', !!user?.password);
        if (user) {
          console.log('[AUTH] User details:', {
            id: user.id,
            email: user.email,
            name: user.name,
            userType: user.userType,
            sellerId: user.sellerId,
            customerId: user.customerId
          });
        }

        if (!user?.password) {
          console.log('[AUTH] No user or password');
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        console.log('[AUTH] User password valid:', isPasswordValid);

        if (!isPasswordValid) {
          console.log('[AUTH] Invalid user password');
          return null;
        }

        console.log('[AUTH] User login successful for:', user.email);
        console.log('[AUTH] Customer Type:', user.Customer?.customerType);
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          userType: user.userType,
          customerId: user.customerId,
          customer: user.Customer,
          customerType: user.Customer?.customerType, // 🔥 INCLUIR customerType na sessão
          sellerId: user.sellerId,
          seller: user.Seller,
        };
      }
    })
  ],
  session: {
    strategy: 'jwt'
  },
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.userType = (user as any).userType
        token.customerId = (user as any).customerId
        token.customer = (user as any).customer
        token.customerType = (user as any).customerType // 🔥 Incluir customerType no JWT
        token.sellerId = (user as any).sellerId
        token.seller = (user as any).seller
        token.employeeId = (user as any).employeeId
        token.employee = (user as any).employee
      }
      return token
    },
    session: async ({ session, token }) => {
      if (token) {
        (session.user as any).id = token.sub
        ;(session.user as any).userType = token.userType
        ;(session.user as any).customerId = token.customerId
        ;(session.user as any).customer = token.customer
        ;(session.user as any).customerType = token.customerType // 🔥 Incluir customerType na sessão
        ;(session.user as any).sellerId = token.sellerId
        ;(session.user as any).seller = token.seller
        ;(session.user as any).employeeId = token.employeeId
        ;(session.user as any).employee = token.employee
      }
      return session
    }
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/error'
  }
}
