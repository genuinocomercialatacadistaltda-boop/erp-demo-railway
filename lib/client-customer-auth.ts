import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = '7d';

export interface ClientCustomerSession {
  id: string;
  name: string;
  email: string | null;
  customerId: string; // ID do dono (assador)
  customerName: string; // Nome do assador
}

export async function authenticateClientCustomer(
  email: string,
  password: string
): Promise<{ success: boolean; message?: string; token?: string; clientCustomer?: ClientCustomerSession }> {
  try {
    // Buscar sub-cliente pelo email
    const clientCustomer = await prisma.clientCustomer.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        isActive: true,
        password: { not: null }, // Só pode fazer login se tiver senha cadastrada
      },
      include: {
        Customer: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!clientCustomer || !clientCustomer.password) {
      return { success: false, message: 'E-mail ou senha inválidos' };
    }

    // Verificar senha
    const isPasswordValid = await bcrypt.compare(password, clientCustomer.password);

    if (!isPasswordValid) {
      return { success: false, message: 'E-mail ou senha inválidos' };
    }

    // Atualizar último login
    await prisma.clientCustomer.update({
      where: { id: clientCustomer.id },
      data: { lastLoginAt: new Date() },
    });

    // Criar sessão
    const session: ClientCustomerSession = {
      id: clientCustomer.id,
      name: clientCustomer.name,
      email: clientCustomer.email,
      customerId: clientCustomer.customerId,
      customerName: clientCustomer.Customer.name,
    };

    // Gerar token JWT
    const token = jwt.sign(session, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    return { success: true, token, clientCustomer: session };
  } catch (error) {
    console.error('Error authenticating client customer:', error);
    return { success: false, message: 'Erro ao fazer login' };
  }
}

export async function verifyClientCustomerToken(
  token: string
): Promise<{ valid: boolean; session?: ClientCustomerSession }> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as ClientCustomerSession;

    // Verificar se o sub-cliente ainda existe e está ativo
    const clientCustomer = await prisma.clientCustomer.findFirst({
      where: {
        id: decoded.id,
        isActive: true,
      },
    });

    if (!clientCustomer) {
      return { valid: false };
    }

    return { valid: true, session: decoded };
  } catch (error) {
    return { valid: false };
  }
}

export async function changeClientCustomerPassword(
  clientCustomerId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  try {
    const clientCustomer = await prisma.clientCustomer.findUnique({
      where: { id: clientCustomerId },
    });

    if (!clientCustomer || !clientCustomer.password) {
      return { success: false, message: 'Cliente não encontrado' };
    }

    // Verificar senha atual
    const isPasswordValid = await bcrypt.compare(currentPassword, clientCustomer.password);

    if (!isPasswordValid) {
      return { success: false, message: 'Senha atual incorreta' };
    }

    // Hash da nova senha
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Atualizar senha
    await prisma.clientCustomer.update({
      where: { id: clientCustomerId },
      data: { password: hashedPassword },
    });

    return { success: true, message: 'Senha alterada com sucesso' };
  } catch (error) {
    console.error('Error changing client customer password:', error);
    return { success: false, message: 'Erro ao alterar senha' };
  }
}

export async function setClientCustomerPassword(
  clientCustomerId: string,
  password: string
): Promise<{ success: boolean; message: string }> {
  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.clientCustomer.update({
      where: { id: clientCustomerId },
      data: { password: hashedPassword },
    });

    return { success: true, message: 'Senha definida com sucesso' };
  } catch (error) {
    console.error('Error setting client customer password:', error);
    return { success: false, message: 'Erro ao definir senha' };
  }
}
