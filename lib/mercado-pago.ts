
// Mercado Pago Integration Service
import { randomUUID } from 'crypto'

// Cache for access token
let cachedAccessToken: string | null = null
let tokenExpiresAt: number = 0

// Load credentials from environment variables
function getMercadoPagoCredentials() {
  const clientId = process.env.MERCADO_PAGO_CLIENT_ID
  const clientSecret = process.env.MERCADO_PAGO_CLIENT_SECRET
  const publicKey = process.env.MERCADO_PAGO_PUBLIC_KEY

  if (!clientId || !clientSecret) {
    throw new Error('MERCADO_PAGO_CLIENT_ID and MERCADO_PAGO_CLIENT_SECRET must be configured in environment variables')
  }

  return {
    clientId,
    clientSecret,
    publicKey
  }
}

// Get or refresh access token using OAuth
async function getAccessToken(): Promise<string> {
  // Return cached token if still valid
  const now = Date.now()
  if (cachedAccessToken && tokenExpiresAt > now) {
    console.log('✓ Using cached Mercado Pago access token')
    return cachedAccessToken
  }

  // Get fresh token
  console.log('🔄 Fetching new Mercado Pago access token via OAuth...')
  const credentials = getMercadoPagoCredentials()

  try {
    const response = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        grant_type: 'client_credentials'
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('❌ Failed to get Mercado Pago access token:', errorData)
      throw new Error(`Failed to get access token: ${response.status}`)
    }

    const data = await response.json()
    
    cachedAccessToken = data.access_token
    // Set expiration with 5 minute buffer (token expires in 21600 seconds = 6 hours)
    tokenExpiresAt = now + (data.expires_in - 300) * 1000

    console.log('✅ Successfully obtained Mercado Pago access token')
    console.log(`   Expires in: ${data.expires_in / 3600} hours`)
    
    if (!cachedAccessToken) {
      throw new Error('Failed to obtain access token from Mercado Pago')
    }
    
    return cachedAccessToken
  } catch (error) {
    console.error('❌ Error obtaining Mercado Pago access token:', error)
    throw error
  }
}

interface CreatePixPaymentParams {
  transactionAmount: number
  description: string
  payerEmail: string
  payerFirstName: string
  payerLastName: string
  payerIdentification: {
    type: 'CPF' | 'CNPJ'
    number: string
  }
  externalReference?: string
  notificationUrl?: string
}

interface PixPaymentResponse {
  id: string
  status: string
  status_detail: string
  transaction_amount: number
  date_created: string
  date_approved: string | null
  point_of_interaction?: {
    type?: string
    transaction_data?: {
      qr_code?: string // Código copia e cola
      qr_code_base64?: string // QR Code em base64
      ticket_url?: string
    }
  }
}

export async function createPixPayment(params: CreatePixPaymentParams): Promise<PixPaymentResponse> {
  // Get access token via OAuth
  const accessToken = await getAccessToken()

  // Generate unique idempotency key using crypto
  const idempotencyKey = randomUUID()

  const payload: any = {
    transaction_amount: params.transactionAmount,
    description: params.description,
    payment_method_id: 'pix',
    payer: {
      email: params.payerEmail,
      first_name: params.payerFirstName,
      last_name: params.payerLastName,
      identification: {
        type: params.payerIdentification.type,
        number: params.payerIdentification.number
      }
    },
    external_reference: params.externalReference
  }

  // Only add notification_url if it's a valid public URL
  if (params.notificationUrl && (params.notificationUrl.startsWith('https://') || params.notificationUrl.startsWith('http://'))) {
    // Check if it's not localhost
    if (!params.notificationUrl.includes('localhost') && !params.notificationUrl.includes('127.0.0.1')) {
      payload.notification_url = params.notificationUrl
    }
  }

  try {
    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'X-Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('❌ Mercado Pago API error:', errorData)
      
      // Check for common errors
      if (response.status === 401) {
        console.error('⚠️ Credenciais do Mercado Pago inválidas ou não autorizadas')
        console.error('⚠️ Verifique se sua conta está ativada e as credenciais de produção estão corretas')
      } else if (errorData.cause && errorData.cause[0]?.code === 4020) {
        console.error('⚠️ URL de notificação inválida - continuando sem webhook')
      }
      
      throw new Error(`Mercado Pago API error: ${response.status} - ${JSON.stringify(errorData)}`)
    }

    const data = await response.json()
    
    // Log the response for debugging
    console.log('✅ Mercado Pago PIX Payment Created:', {
      id: data.id,
      status: data.status,
      amount: data.transaction_amount,
      hasQrCode: !!data.point_of_interaction?.transaction_data?.qr_code,
      hasQrCodeBase64: !!data.point_of_interaction?.transaction_data?.qr_code_base64
    })
    
    // Log full point_of_interaction for debugging
    if (data.point_of_interaction) {
      console.log('📋 PIX QR Code Data:', JSON.stringify(data.point_of_interaction, null, 2))
    } else {
      console.warn('⚠️ Point of interaction não encontrado na resposta')
      console.warn('📋 Resposta completa:', JSON.stringify(data, null, 2))
    }
    
    return data as PixPaymentResponse
  } catch (error) {
    console.error('❌ Error creating PIX payment:', error)
    throw error
  }
}

export async function getPaymentStatus(paymentId: string): Promise<PixPaymentResponse> {
  // Get access token via OAuth
  const accessToken = await getAccessToken()

  try {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to get payment status: ${response.status}`)
    }

    const data = await response.json()
    return data as PixPaymentResponse
  } catch (error) {
    console.error('Error getting payment status:', error)
    throw error
  }
}

// Calculate fine and interest for overdue payments
export function calculateOverdueAmounts(originalAmount: number, dueDate: Date) {
  const now = new Date()
  const dueDateObj = new Date(dueDate)
  
  // If not overdue, return 0
  if (now <= dueDateObj) {
    return {
      fineAmount: 0,
      interestAmount: 0,
      totalAmount: originalAmount,
      daysOverdue: 0
    }
  }

  // Calculate days overdue
  const daysOverdue = Math.floor((now.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24))
  
  // Fine: 2% of original amount (applied once)
  const fineRate = 0.02
  const fineAmount = originalAmount * fineRate
  
  // Interest: 1% per month = 0.033% per day
  const interestRatePerDay = 0.0033
  const interestAmount = originalAmount * interestRatePerDay * daysOverdue
  
  // Total amount
  const totalAmount = originalAmount + fineAmount + interestAmount

  return {
    fineAmount: Math.round(fineAmount * 100) / 100,
    interestAmount: Math.round(interestAmount * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
    daysOverdue
  }
}
