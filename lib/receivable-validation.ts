/**
 * Utilitários de validação de recebíveis
 * 
 * Garante que boletos e receivables sejam criados corretamente
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Verifica se um pedido já tem boleto vinculado
 * 
 * @param orderId - ID do pedido
 * @returns true se já tem boleto, false caso contrário
 */
export async function orderHasBoleto(orderId: string): Promise<boolean> {
  const boleto = await prisma.boleto.findFirst({
    where: { orderId }
  })
  return !!boleto
}

/**
 * Verifica se um pedido já tem receivable vinculado
 * 
 * @param orderId - ID do pedido
 * @returns true se já tem receivable, false caso contrário
 */
export async function orderHasReceivable(orderId: string): Promise<boolean> {
  const receivable = await prisma.receivable.findFirst({
    where: { orderId }
  })
  return !!receivable
}

/**
 * Filtra receivables que NÃO devem ser exibidos junto com boletos
 * (Remove receivables que têm boletoId, pois esses já aparecem como boletos)
 * 
 * @param receivables - Lista de receivables
 * @returns Receivables filtrados (sem os que têm boleto)
 * 
 * @example
 * ```typescript
 * const receivables = await prisma.receivable.findMany({ ... })
 * const toDisplay = filterReceivablesWithoutBoleto(receivables)
 * // Agora toDisplay só contém receivables que NÃO são boletos
 * ```
 */
export function filterReceivablesWithoutBoleto<T extends { boletoId?: string | null }>(
  receivables: T[]
): T[] {
  return receivables.filter(r => !r.boletoId)
}

/**
 * Valida dados de um receivable antes de criar
 * 
 * @param data - Dados do receivable
 * @throws Error se os dados forem inválidos
 */
export function validateReceivableData(data: {
  amount: number
  dueDate: Date
  customerId: string
  orderId?: string
  boletoId?: string | null
}): void {
  if (data.amount <= 0) {
    throw new Error('Valor do receivable deve ser maior que zero')
  }

  if (data.dueDate < new Date()) {
    console.warn(
      `⚠️ [RECEIVABLE_VALIDATION] Data de vencimento no passado: ${data.dueDate.toISOString()}`
    )
  }

  if (!data.customerId) {
    throw new Error('customerId é obrigatório para criar receivable')
  }

  if (data.orderId && data.boletoId) {
    console.log(
      `ℹ️ [RECEIVABLE_VALIDATION] Receivable vinculado a pedido (${data.orderId}) E boleto (${data.boletoId})`
    )
  }
}

/**
 * Valida dados de um boleto antes de criar
 * 
 * @param data - Dados do boleto
 * @throws Error se os dados forem inválidos
 */
export function validateBoletoData(data: {
  amount: number
  dueDate: Date
  customerId: string
  orderId: string
}): void {
  if (data.amount <= 0) {
    throw new Error('Valor do boleto deve ser maior que zero')
  }

  if (data.dueDate < new Date()) {
    console.warn(
      `⚠️ [BOLETO_VALIDATION] Data de vencimento no passado: ${data.dueDate.toISOString()}`
    )
  }

  if (!data.customerId) {
    throw new Error('customerId é obrigatório para criar boleto')
  }

  if (!data.orderId) {
    throw new Error('orderId é obrigatório para criar boleto')
  }
}

/**
 * Cria um boleto E seu receivable vinculado de forma segura
 * 
 * @param boletoData - Dados do boleto
 * @param receivableData - Dados do receivable (opcional, será gerado automaticamente se não fornecido)
 * @returns O boleto e receivable criados
 */
export async function createBoletoWithReceivable(
  boletoData: {
    boletoNumber: string
    amount: number
    dueDate: Date
    customerId: string
    orderId: string
    notes?: string
    isInstallment?: boolean
    installmentNumber?: number
    totalInstallments?: number
  },
  receivableData?: {
    description: string
    dueDate?: Date
    notes?: string
  }
) {
  // Validar dados
  validateBoletoData(boletoData)

  // Verificar se já existe boleto para este pedido
  const existingBoleto = await orderHasBoleto(boletoData.orderId)
  if (existingBoleto) {
    console.warn(
      `⚠️ [BOLETO_CREATION] Pedido ${boletoData.orderId} já tem boleto vinculado!`
    )
  }

  // Criar boleto
  const boleto = await prisma.boleto.create({
    data: {
      id: crypto.randomUUID(),
      ...boletoData,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  })

  console.log(`✓ [BOLETO_CREATION] Boleto ${boleto.boletoNumber} criado com sucesso`)

  // Criar receivable vinculado ao boleto
  const receivable = await prisma.receivable.create({
    data: {
      id: crypto.randomUUID(),
      description: receivableData?.description || `Boleto ${boletoData.boletoNumber}`,
      amount: boletoData.amount,
      dueDate: receivableData?.dueDate || boletoData.dueDate,
      status: 'PENDING',
      paymentMethod: 'BOLETO',
      customerId: boletoData.customerId,
      orderId: boletoData.orderId,
      boletoId: boleto.id, // ✅ IMPORTANTE: Vincular ao boleto
      notes: receivableData?.notes || boletoData.notes,
      isInstallment: boletoData.isInstallment,
      installmentNumber: boletoData.installmentNumber,
      totalInstallments: boletoData.totalInstallments,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  })

  console.log(
    `✓ [RECEIVABLE_CREATION] Receivable vinculado ao boleto ${boleto.boletoNumber} criado com sucesso`
  )

  return { boleto, receivable }
}
