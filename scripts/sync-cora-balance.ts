import { PrismaClient } from '@prisma/client'

// Simulação da função getAccountBalance do Cora
async function getAccountBalanceFromCora(): Promise<number> {
  const https = require('https')
  const fs = require('fs')
  const path = require('path')
  
  const config = {
    CORA_API_URL: process.env.CORA_API_URL || 'matls-clients.api.cora.com.br',
    CORA_CLIENT_ID: process.env.CORA_CLIENT_ID,
    CORA_CERTIFICATE_BASE64: process.env.CORA_CERTIFICATE_BASE64,
    CORA_PRIVATE_KEY_BASE64: process.env.CORA_PRIVATE_KEY_BASE64,
  }
  
  if (!config.CORA_CERTIFICATE_BASE64 || !config.CORA_PRIVATE_KEY_BASE64) {
    throw new Error('Certificados do Cora não configurados')
  }
  
  const cert = Buffer.from(config.CORA_CERTIFICATE_BASE64, 'base64').toString('utf8')
  const key = Buffer.from(config.CORA_PRIVATE_KEY_BASE64, 'base64').toString('utf8')
  
  // Primeiro, obter token
  const tokenResponse = await new Promise<any>((resolve, reject) => {
    const postData = `grant_type=client_credentials&client_id=${config.CORA_CLIENT_ID}`
    
    const options = {
      hostname: config.CORA_API_URL,
      port: 443,
      path: '/token',
      method: 'POST',
      cert,
      key,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    }
    
    const req = https.request(options, (res: any) => {
      let data = ''
      res.on('data', (chunk: any) => data += chunk)
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch (e) {
          reject(new Error(`Erro ao parsear resposta do token: ${data}`))
        }
      })
    })
    
    req.on('error', reject)
    req.write(postData)
    req.end()
  })
  
  if (!tokenResponse.access_token) {
    throw new Error(`Erro ao obter token: ${JSON.stringify(tokenResponse)}`)
  }
  
  console.log('✅ Token obtido com sucesso')
  
  // Buscar saldo
  const balanceResponse = await new Promise<any>((resolve, reject) => {
    const options = {
      hostname: config.CORA_API_URL,
      port: 443,
      path: '/business/v2/balances',
      method: 'GET',
      cert,
      key,
      headers: {
        'Authorization': `Bearer ${tokenResponse.access_token}`,
        'Idempotency-Key': `balance-${Date.now()}`,
      },
    }
    
    const req = https.request(options, (res: any) => {
      let data = ''
      res.on('data', (chunk: any) => data += chunk)
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch (e) {
          reject(new Error(`Erro ao parsear saldo: ${data}`))
        }
      })
    })
    
    req.on('error', reject)
    req.end()
  })
  
  console.log('📊 Resposta do Cora:', JSON.stringify(balanceResponse, null, 2))
  
  // Retorna saldo em centavos
  return balanceResponse.available || balanceResponse.current || 0
}

const prisma = new PrismaClient()

async function main() {
  console.log('=== SINCRONIZAÇÃO DE SALDO CORA ===\n')
  
  // Buscar conta Cora no app
  const coraAccount = await prisma.bankAccount.findFirst({
    where: { name: { contains: 'cora', mode: 'insensitive' } }
  })
  
  if (!coraAccount) {
    console.log('❌ Conta CORA não encontrada no app')
    return
  }
  
  console.log('📱 SALDO NO APP: R$ ' + Number(coraAccount.balance).toFixed(2))
  
  try {
    // Buscar saldo real do Cora
    const coraBalanceCents = await getAccountBalanceFromCora()
    const coraBalanceReais = coraBalanceCents / 100
    
    console.log('🏦 SALDO REAL CORA: R$ ' + coraBalanceReais.toFixed(2))
    console.log('')
    console.log('📊 DIFERENÇA: R$ ' + (Number(coraAccount.balance) - coraBalanceReais).toFixed(2))
    
    if (Math.abs(Number(coraAccount.balance) - coraBalanceReais) > 0.01) {
      console.log('\n⚠️  SALDOS NÃO CONFEREM!')
      console.log(`   App: R$ ${Number(coraAccount.balance).toFixed(2)}`)
      console.log(`   Real: R$ ${coraBalanceReais.toFixed(2)}`)
    } else {
      console.log('\n✅ SALDOS CONFEREM!')
    }
    
  } catch (error: any) {
    console.error('❌ Erro ao buscar saldo do Cora:', error.message)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
