
// Regras de negócio para horário de funcionamento e entregas

export type DeliveryType = 'delivery_gurupi' | 'delivery_outside' | 'pickup'
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0 = Domingo, 6 = Sábado

export interface BusinessHours {
  isOpen: boolean
  message?: string
  nextOpeningTime?: string
}

export interface DeliveryInfo {
  canDeliver: boolean
  deliveryFee: number
  estimatedDelivery: string
  message: string
  warnings?: string[]
}

/**
 * Verifica se a loja está aberta no momento
 */
export function checkBusinessHours(date: Date = new Date()): BusinessHours {
  const dayOfWeek = date.getDay() as DayOfWeek
  const hour = date.getHours()
  const minute = date.getMinutes()
  const currentTime = hour * 60 + minute // em minutos

  // Domingo (0) - Fechado
  if (dayOfWeek === 0) {
    return {
      isOpen: false,
      message: 'Loja fechada aos domingos',
      nextOpeningTime: 'Segunda-feira às 08:00'
    }
  }

  // Sábado (6) - 08h às 12h
  if (dayOfWeek === 6) {
    const opens = 8 * 60 // 08:00
    const closes = 12 * 60 // 12:00

    if (currentTime >= opens && currentTime < closes) {
      return { isOpen: true }
    }

    return {
      isOpen: false,
      message: 'Aos sábados funcionamos apenas das 08:00 às 12:00',
      nextOpeningTime: 'Segunda-feira às 08:00'
    }
  }

  // Segunda a Sexta (1-5) - 08h às 12h e 14h às 18h
  const morningStart = 8 * 60 // 08:00
  const morningEnd = 12 * 60 // 12:00
  const afternoonStart = 14 * 60 // 14:00
  const afternoonEnd = 18 * 60 // 18:00

  const isInMorningShift = currentTime >= morningStart && currentTime < morningEnd
  const isInAfternoonShift = currentTime >= afternoonStart && currentTime < afternoonEnd

  if (isInMorningShift || isInAfternoonShift) {
    return { isOpen: true }
  }

  // Fora do horário
  if (currentTime < morningStart) {
    return {
      isOpen: false,
      message: 'Loja ainda não abriu',
      nextOpeningTime: 'Hoje às 08:00'
    }
  }

  if (currentTime >= morningEnd && currentTime < afternoonStart) {
    return {
      isOpen: false,
      message: 'Intervalo de almoço (12:00 às 14:00)',
      nextOpeningTime: 'Hoje às 14:00'
    }
  }

  if (currentTime >= afternoonEnd) {
    const tomorrow = dayOfWeek === 5 ? 'Segunda-feira' : 'Amanhã'
    return {
      isOpen: false,
      message: 'Loja fechada (expediente encerrado)',
      nextOpeningTime: `${tomorrow} às 08:00`
    }
  }

  return { isOpen: false, message: 'Loja fechada' }
}

/**
 * Verifica se pode fazer entrega hoje em Gurupi
 */
export function checkGurupiDelivery(date: Date = new Date()): DeliveryInfo {
  const dayOfWeek = date.getDay() as DayOfWeek
  const hour = date.getHours()

  // Sábado não tem entrega
  if (dayOfWeek === 6) {
    return {
      canDeliver: false,
      deliveryFee: 0,
      estimatedDelivery: 'Segunda-feira',
      message: 'Não realizamos entregas aos sábados. Seu pedido será entregue na próxima segunda-feira.',
      warnings: ['🚫 Não realizamos entregas aos sábados. Seu pedido será entregue na próxima segunda-feira.']
    }
  }

  // Domingo não trabalha
  if (dayOfWeek === 0) {
    return {
      canDeliver: false,
      deliveryFee: 0,
      estimatedDelivery: 'Segunda-feira',
      message: 'Loja fechada aos domingos. Pedidos serão processados na segunda-feira.',
      warnings: ['⚠️ Loja fechada aos domingos. Pedidos serão processados na segunda-feira.']
    }
  }

  // Segunda a Sexta
  // Até 15h = entrega hoje (16h-18h)
  if (hour < 15) {
    return {
      canDeliver: true,
      deliveryFee: 0, // Será calculado baseado no valor
      estimatedDelivery: 'Hoje entre 16:00 e 18:00',
      message: 'Entrega prevista para hoje entre 16:00 e 18:00',
      warnings: []
    }
  }

  // Após 15h = entrega amanhã
  const isLastDayOfWeek = dayOfWeek === 5 // Sexta
  const nextDelivery = isLastDayOfWeek ? 'Segunda-feira' : 'Amanhã'

  return {
    canDeliver: true,
    deliveryFee: 0, // Será calculado baseado no valor
    estimatedDelivery: nextDelivery,
    message: `Pedidos após as 15h são entregues no próximo dia útil (${nextDelivery})`,
    warnings: [`🕒 Pedidos após as 15h são entregues somente no próximo dia útil (${nextDelivery}).`]
  }
}

/**
 * Calcula taxa de entrega para Gurupi
 */
export function calculateGurupiDeliveryFee(totalValue: number): number {
  return totalValue >= 100 ? 0 : 10
}

/**
 * Calcula taxa de entrega fora de Gurupi (via transportadora)
 */
export function calculateOutsideDeliveryFee(packageCount: number): number {
  return packageCount > 50 ? 0 : 50
}

/**
 * Informações sobre entrega fora de Gurupi
 */
export function getOutsideDeliveryInfo(packageCount: number): DeliveryInfo {
  const fee = calculateOutsideDeliveryFee(packageCount)
  const feeText = fee === 0 ? 'grátis' : `R$ ${fee.toFixed(2)}`

  return {
    canDeliver: true,
    deliveryFee: fee,
    estimatedDelivery: 'Conforme transportadora',
    message: `Entrega via transportadora. Frete: ${feeText}`,
    warnings: [
      '🚚 Pedidos fora de Gurupi são enviados via transportadora e devem ser feitos com 1 dia de antecedência.',
      packageCount <= 50
        ? 'Frete fixo de R$ 50,00 até 50 pacotes'
        : 'Frete grátis para pedidos acima de 50 pacotes'
    ]
  }
}

/**
 * Validação de retirada na loja
 */
export function validatePickupTime(date: Date = new Date()): {
  canPickup: boolean
  message?: string
  warnings?: string[]
} {
  const businessHours = checkBusinessHours(date)

  if (businessHours.isOpen) {
    return {
      canPickup: true,
      warnings: [
        '📦 Retirada na loja durante nosso horário de funcionamento: segunda a sexta das 8h às 12h e das 14h às 18h, e sábado das 8h às 12h.'
      ]
    }
  }

  return {
    canPickup: true, // Pode fazer o pedido, mas com aviso
    warnings: [
      '⚠️ A loja estará fechada neste horário. Retire seu pedido dentro do nosso horário de funcionamento: segunda a sexta das 8h às 12h e das 14h às 18h, e sábado das 8h às 12h.'
    ]
  }
}

/**
 * Gera resumo completo das regras aplicáveis ao pedido
 */
export interface OrderRulesSummary {
  businessHours: BusinessHours
  deliveryInfo?: DeliveryInfo
  pickupInfo?: ReturnType<typeof validatePickupTime>
  warnings: string[]
  canProceed: boolean
  totalFee: number
}

export function getOrderRulesSummary(
  deliveryType: DeliveryType,
  totalValue: number,
  packageCount: number = 1,
  date: Date = new Date()
): OrderRulesSummary {
  const businessHours = checkBusinessHours(date)
  const warnings: string[] = []
  let totalFee = 0
  let canProceed = true

  // Aviso de horário de funcionamento se estiver fora do expediente
  if (!businessHours.isOpen) {
    warnings.push(
      `⚠️ Nosso horário de funcionamento é de segunda a sexta das 8h às 12h e das 14h às 18h, e aos sábados das 8h às 12h. Seu pedido será processado no próximo horário útil.`
    )
  }

  let deliveryInfo: DeliveryInfo | undefined
  let pickupInfo: ReturnType<typeof validatePickupTime> | undefined

  if (deliveryType === 'delivery_gurupi') {
    deliveryInfo = checkGurupiDelivery(date)
    totalFee = calculateGurupiDeliveryFee(totalValue)
    if (deliveryInfo.warnings) {
      warnings.push(...deliveryInfo.warnings)
    }
  } else if (deliveryType === 'delivery_outside') {
    deliveryInfo = getOutsideDeliveryInfo(packageCount)
    totalFee = deliveryInfo.deliveryFee
    if (deliveryInfo.warnings) {
      warnings.push(...deliveryInfo.warnings)
    }
  } else if (deliveryType === 'pickup') {
    pickupInfo = validatePickupTime(date)
    if (pickupInfo.warnings) {
      warnings.push(...pickupInfo.warnings)
    }
  }

  return {
    businessHours,
    deliveryInfo,
    pickupInfo,
    warnings,
    canProceed,
    totalFee
  }
}

/**
 * Formata horário de funcionamento para exibição
 */
export function getBusinessHoursText(): string {
  return 'Segunda a sexta das 8h às 12h e das 14h às 18h. Sábado das 8h às 12h.'
}

/**
 * Verifica se uma data é domingo
 */
export function isSunday(date: Date): boolean {
  return date.getDay() === 0
}

/**
 * Verifica se uma data é sábado
 */
export function isSaturday(date: Date): boolean {
  return date.getDay() === 6
}

/**
 * Verifica se uma data é dia útil (segunda a sexta)
 */
export function isWeekday(date: Date): boolean {
  const day = date.getDay()
  return day >= 1 && day <= 5
}

/**
 * Lista de feriados fixos (pode ser expandida)
 * Formato: 'MM-DD'
 */
const FIXED_HOLIDAYS = [
  '01-01', // Ano Novo
  '04-21', // Tiradentes
  '05-01', // Dia do Trabalho
  '09-07', // Independência
  '10-12', // Nossa Senhora Aparecida
  '11-02', // Finados
  '11-15', // Proclamação da República
  '12-25', // Natal
]

/**
 * Verifica se uma data é feriado
 */
export function isHoliday(date: Date): boolean {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const dateStr = `${month}-${day}`
  return FIXED_HOLIDAYS.includes(dateStr)
}

/**
 * Verifica se pode fazer entrega em uma data específica
 */
export function canDeliverOnDate(date: Date, currentDate: Date = new Date()): boolean {
  // Não pode entregar no passado
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const currentDateOnly = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate())
  
  if (dateOnly < currentDateOnly) {
    return false
  }
  
  // Não entrega domingo
  if (isSunday(date)) {
    return false
  }
  
  // Não entrega em feriados
  if (isHoliday(date)) {
    return false
  }
  
  return true
}

/**
 * Calcula a data mínima para entrega baseado no horário atual
 */
export function getMinDeliveryDate(currentDate: Date = new Date()): Date {
  const hour = currentDate.getHours()
  let minDate = new Date(currentDate)
  
  // Após 15h, não pode mais entregar hoje
  if (hour >= 15) {
    // Pula para o próximo dia
    minDate.setDate(minDate.getDate() + 1)
  }
  
  // Encontra o próximo dia útil disponível
  while (!canDeliverOnDate(minDate, currentDate)) {
    minDate.setDate(minDate.getDate() + 1)
  }
  
  return minDate
}

/**
 * Calcula a data mínima para retirada baseado no horário atual
 */
export function getMinPickupDate(currentDate: Date = new Date()): Date {
  const hour = currentDate.getHours()
  let minDate = new Date(currentDate)
  
  // Após 18h, não pode mais retirar hoje
  if (hour >= 18) {
    minDate.setDate(minDate.getDate() + 1)
  }
  
  // Pula domingos (loja fechada)
  while (isSunday(minDate)) {
    minDate.setDate(minDate.getDate() + 1)
  }
  
  return minDate
}

/**
 * Gera avisos para entrega baseado no horário e data
 */
export function getDeliveryWarnings(selectedDate: Date | null, currentDate: Date = new Date()): string[] {
  const warnings: string[] = []
  const hour = currentDate.getHours()
  const minute = currentDate.getMinutes()
  
  // Aviso após 15h
  if (hour >= 15) {
    const minDate = getMinDeliveryDate(currentDate)
    const dayName = minDate.toLocaleDateString('pt-BR', { weekday: 'long' })
    warnings.push(`🕒 Pedidos para entrega após as 15h serão entregues apenas no próximo dia útil (${dayName}).`)
  }
  
  // Aviso após 18h (loja fechada)
  if (hour >= 18) {
    warnings.push('🏪 A loja está fechada. Seu pedido será processado no próximo dia útil.')
  }
  
  // Horário de entrega fixo
  warnings.push('🚚 Horário de entrega: 16h às 18h (horário fixo).')
  
  return warnings
}

/**
 * Gera avisos para retirada baseado no horário
 */
export function getPickupWarnings(selectedDate: Date | null, currentDate: Date = new Date()): string[] {
  const warnings: string[] = []
  const hour = currentDate.getHours()
  const minute = currentDate.getMinutes()
  
  // Aviso após 18h
  if (hour >= 18) {
    warnings.push('🏪 A loja está fechada. Você pode retirar seu pedido no próximo dia útil.')
  }
  
  // Aviso horário de almoço (sempre mostrar)
  if (hour >= 12 && hour < 14) {
    warnings.push('⏰ A loja faz uma pausa para almoço das 12h às 14h. Retiradas nesse horário não estarão disponíveis.')
  } else {
    // Mostrar aviso informativo sobre o horário de almoço
    warnings.push('ℹ️ Horário de funcionamento: Segunda a sexta das 8h às 12h e das 14h às 18h. Sábado das 8h às 12h.')
  }
  
  return warnings
}

/**
 * Formata uma data para o formato usado pelo input type="date"
 */
export function formatDateForInput(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Calcula data máxima para seleção (30 dias à frente)
 */
export function getMaxDate(currentDate: Date = new Date()): Date {
  const maxDate = new Date(currentDate)
  maxDate.setDate(maxDate.getDate() + 30)
  return maxDate
}
