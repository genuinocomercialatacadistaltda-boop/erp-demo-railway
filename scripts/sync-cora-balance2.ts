import { PrismaClient } from '@prisma/client'

const https = require('https')

const prisma = new PrismaClient()

async function makeRequest(method: string, path: string, token?: string, body?: string): Promise<any> {
  const config = {
    CORA_API_URL: process.env.CORA_API_URL || 'matls-clients.api.cora.com.br',
    CORA_CLIENT_ID: process.env.CORA_CLIENT_ID,
    CORA_CERTIFICATE_BASE64: process.env.CORA_CERTIFICATE_BASE64,
    CORA_PRIVATE_KEY_BASE64: process.env.CORA_PRIVATE_KEY_BASE64,
  }
  
  const cert = Buffer.from(config.CORA_CERTIFICATE_BASE64!, 'base64').toString('utf8')
  const key = Buffer.from(config.CORA_PRIVATE_KEY_BASE64!, 'base64').toString('utf8')
  
  const headers: any = {
    'Content-Type': method === 'POST' && !token ? 'application/x-www-form-urlencoded' : 'application/json',
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  if (body) {
    headers['Content-Length'] = Buffer.byteLength(body)
  }
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: config.CORA_API_URL,
      port: 443,
      path,
      method,
      cert,
      key,
      headers,
    }
    
    const req = https.request(options, (res: any) => {
      let data = ''
      res.on('data', (chunk: any) => data += chunk)
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null })
        } catch (e) {
          resolve({ status: res.statusCode, data: data })
        }
      })
    })
    
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

async function main() {
  console.log('=== SINCRONIZAÇÃO DE SALDO CORA ===\n')
  
  const coraAccount = await prisma.bankAccount.findFirst({
    where: { name: { contains: 'cora', mode: 'insensitive' } }
  })
  
  if (!coraAccount) {
    console.log('❌ Conta CORA não encontrada no app')
    return
  }
  
  console.log('📱 SALDO NO APP: R$ ' + Number(coraAccount.balance).toFixed(2))
  
  // 1. Obter token
  const tokenBody = `grant_type=client_credentials&client_id=${process.env.CORA_CLIENT_ID}`
  const tokenResult = await makeRequest('POST', '/token', undefined, tokenBody)
  
  if (!tokenResult.data?.access_token) {
    console.log('❌ Erro ao obter token:', tokenResult)
    return
  }
  
  console.log('✅ Token obtido')
  
  // 2. Buscar saldo
  const balanceResult = await makeRequest('GET', '/accounts/balance', tokenResult.data.access_token)
  
  console.log('📊 Resposta /accounts/balance:', JSON.stringify(balanceResult, null, 2))
  
  if (balanceResult.status === 200 && balanceResult.data?.balance !== undefined) {
    const realBalance = balanceResult.data.balance / 100
    console.log('\n🏦 SALDO REAL CORA: R$ ' + realBalance.toFixed(2))
    console.log('📱 SALDO NO APP: R$ ' + Number(coraAccount.balance).toFixed(2))
    console.log('📊 DIFERENÇA: R$ ' + (Number(coraAccount.balance) - realBalance).toFixed(2))
  }
  
  // 3. Buscar extrato recente
  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - 7) // Últimos 7 dias
  
  const statementsPath = `/accounts/statements?start=${startDate.toISOString().split('T')[0]}&end=${today.toISOString().split('T')[0]}`
  const statementsResult = await makeRequest('GET', statementsPath, tokenResult.data.access_token)
  
  console.log('\n📋 Extrato últimos 7 dias:')
  if (statementsResult.status === 200 && Array.isArray(statementsResult.data)) {
    for (const tx of statementsResult.data.slice(-10)) {
      const sign = tx.type === 'CREDIT' ? '+' : '-'
      console.log(`  ${sign} R$ ${(tx.amount / 100).toFixed(2)} | ${tx.description?.substring(0, 50) || 'Sem descrição'}`)
    }
  } else {
    console.log('  Resposta:', JSON.stringify(statementsResult, null, 2))
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
