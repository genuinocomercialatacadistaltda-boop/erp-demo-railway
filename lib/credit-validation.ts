/**
 * Utilitários de validação de crédito
 * 
 * Garante que as regras de crédito sejam sempre respeitadas
 */

/**
 * Valida e ajusta o crédito disponível para não ultrapassar o limite
 * 
 * @param availableCredit - Crédito disponível calculado
 * @param creditLimit - Limite de crédito do cliente
 * @returns Crédito disponível ajustado (nunca maior que o limite)
 * 
 * @example
 * ```typescript
 * const newCredit = validateAvailableCredit(160, 100) // Retorna 100
 * const validCredit = validateAvailableCredit(80, 100) // Retorna 80
 * ```
 */
export function validateAvailableCredit(
  availableCredit: number,
  creditLimit: number
): number {
  // Se o crédito disponível for maior que o limite, ajustar para o limite
  if (availableCredit > creditLimit) {
    console.warn(
      `⚠️ [CREDIT_VALIDATION] Crédito disponível (${availableCredit}) maior que o limite (${creditLimit}). Ajustando...`
    )
    return creditLimit
  }

  // Se for negativo, ajustar para 0
  if (availableCredit < 0) {
    console.warn(
      `⚠️ [CREDIT_VALIDATION] Crédito disponível negativo (${availableCredit}). Ajustando para 0...`
    )
    return 0
  }

  return availableCredit
}

/**
 * Calcula o crédito disponível após um pedido
 * 
 * @param currentAvailable - Crédito disponível atual
 * @param orderTotal - Valor total do pedido
 * @param creditLimit - Limite de crédito do cliente
 * @returns Novo crédito disponível (validado)
 * 
 * @example
 * ```typescript
 * const newCredit = calculateCreditAfterOrder(100, 50, 150) // Retorna 50
 * ```
 */
export function calculateCreditAfterOrder(
  currentAvailable: number,
  orderTotal: number,
  creditLimit: number
): number {
  const newCredit = currentAvailable - orderTotal
  return validateAvailableCredit(newCredit, creditLimit)
}

/**
 * Calcula o crédito disponível após um pagamento
 * 
 * @param currentAvailable - Crédito disponível atual
 * @param paymentAmount - Valor do pagamento
 * @param creditLimit - Limite de crédito do cliente
 * @returns Novo crédito disponível (validado)
 * 
 * @example
 * ```typescript
 * const newCredit = calculateCreditAfterPayment(50, 30, 150) // Retorna 80
 * const limitedCredit = calculateCreditAfterPayment(120, 50, 150) // Retorna 150 (não ultrapassa o limite)
 * ```
 */
export function calculateCreditAfterPayment(
  currentAvailable: number,
  paymentAmount: number,
  creditLimit: number
): number {
  const newCredit = currentAvailable + paymentAmount
  return validateAvailableCredit(newCredit, creditLimit)
}

/**
 * Verifica se o cliente tem crédito suficiente para um pedido
 * 
 * @param availableCredit - Crédito disponível do cliente
 * @param orderTotal - Valor total do pedido
 * @returns true se tem crédito suficiente, false caso contrário
 * 
 * @example
 * ```typescript
 * const canOrder = hasEnoughCredit(100, 50) // true
 * const cantOrder = hasEnoughCredit(30, 50) // false
 * ```
 */
export function hasEnoughCredit(
  availableCredit: number,
  orderTotal: number
): boolean {
  return availableCredit >= orderTotal
}

/**
 * Formata mensagem de erro de crédito insuficiente
 * 
 * @param availableCredit - Crédito disponível do cliente
 * @param orderTotal - Valor total do pedido
 * @returns Mensagem de erro formatada
 */
export function getInsufficientCreditMessage(
  availableCredit: number,
  orderTotal: number
): string {
  const deficit = orderTotal - availableCredit
  return `Crédito insuficiente. Disponível: R$ ${availableCredit.toFixed(2)}, Necessário: R$ ${orderTotal.toFixed(2)}. Faltam R$ ${deficit.toFixed(2)}.`
}
