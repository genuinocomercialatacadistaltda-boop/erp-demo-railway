
import fs from 'fs';
import path from 'path';
import https from 'https';

// ========================================
// 🏦 SISTEMA MULTI-CONTA CORA
// ========================================
// Contas disponíveis:
// - ESPETOS: Conta principal (padrão)
// - GENUINO: Segunda conta
// ========================================

export type CoraAccountType = 'ESPETOS' | 'GENUINO';

// Cache de tokens por conta
const tokenCache: Record<CoraAccountType, { token: string; expiresAt: number } | null> = {
  ESPETOS: null,
  GENUINO: null
};

// Cache do token antigo para compatibilidade
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Obtém as configurações do Cora para uma conta específica
 */
function getCoraConfigForAccount(account: CoraAccountType) {
  if (account === 'GENUINO') {
    return {
      CORA_API_URL: process.env.CORA_API_URL || 'matls-clients.api.cora.com.br',
      CORA_CLIENT_ID: process.env.CORA_GENUINO_CLIENT_ID,
      CORA_CERTIFICATE_BASE64: process.env.CORA_GENUINO_CERTIFICATE_BASE64,
      CORA_PRIVATE_KEY_BASE64: process.env.CORA_GENUINO_PRIVATE_KEY_BASE64,
      CORA_CERTIFICATE_PATH: process.env.CORA_GENUINO_CERTIFICATE_PATH,
      CORA_PRIVATE_KEY_PATH: process.env.CORA_GENUINO_PRIVATE_KEY_PATH,
      CORA_CERTIFICATE: null,
      CORA_PRIVATE_KEY: null
    };
  }
  
  // ESPETOS (padrão)
  return {
    CORA_API_URL: process.env.CORA_API_URL || 'matls-clients.api.cora.com.br',
    CORA_CLIENT_ID: process.env.CORA_CLIENT_ID,
    CORA_CERTIFICATE: process.env.CORA_CERTIFICATE,
    CORA_PRIVATE_KEY: process.env.CORA_PRIVATE_KEY,
    CORA_CERTIFICATE_BASE64: process.env.CORA_CERTIFICATE_BASE64,
    CORA_PRIVATE_KEY_BASE64: process.env.CORA_PRIVATE_KEY_BASE64,
    CORA_CERTIFICATE_PATH: process.env.CORA_CERTIFICATE_PATH,
    CORA_PRIVATE_KEY_PATH: process.env.CORA_PRIVATE_KEY_PATH
  };
}

/**
 * Obtém as configurações do Cora das variáveis de ambiente (compatibilidade)
 * IMPORTANTE: Carrega as variáveis dentro da função para evitar problemas com dotenv
 */
function getCoraConfig() {
  return getCoraConfigForAccount('ESPETOS');
}

/**
 * Carrega os certificados para uma conta específica
 * Prioriza os arquivos locais (desenvolvimento)
 * Faz fallback para as variáveis de ambiente (produção)
 */
function loadCertificatesForAccount(account: CoraAccountType) {
  console.log(`🔐 [CORA] Carregando certificados para conta: ${account}`);
  const config = getCoraConfigForAccount(account);
  
  console.log(`🔐 [CORA] Config para ${account}:`, {
    CLIENT_ID: config.CORA_CLIENT_ID,
    HAS_CERT_BASE64: !!config.CORA_CERTIFICATE_BASE64,
    HAS_KEY_BASE64: !!config.CORA_PRIVATE_KEY_BASE64,
    HAS_CERT_PATH: !!config.CORA_CERTIFICATE_PATH,
    HAS_KEY_PATH: !!config.CORA_PRIVATE_KEY_PATH,
  });
  
  // Prioriza ler dos arquivos locais (desenvolvimento)
  if (config.CORA_CERTIFICATE_PATH && config.CORA_PRIVATE_KEY_PATH) {
    try {
      const certPath = path.resolve(process.cwd(), config.CORA_CERTIFICATE_PATH);
      const keyPath = path.resolve(process.cwd(), config.CORA_PRIVATE_KEY_PATH);
      
      if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        console.log(`🔐 [CORA] ${account}: Usando certificados de ARQUIVOS`);
        return {
          cert: fs.readFileSync(certPath, 'utf8'),
          key: fs.readFileSync(keyPath, 'utf8'),
        };
      }
    } catch (error) {
      console.log('Arquivos de certificado não encontrados, usando variáveis de ambiente');
    }
  }
  
  // Tenta usar base64 primeiro (produção segura)
  if (config.CORA_CERTIFICATE_BASE64 && config.CORA_PRIVATE_KEY_BASE64) {
    try {
      console.log(`🔐 [CORA] ${account}: Usando certificados BASE64`);
      const cert = Buffer.from(config.CORA_CERTIFICATE_BASE64, 'base64').toString('utf8');
      const key = Buffer.from(config.CORA_PRIVATE_KEY_BASE64, 'base64').toString('utf8');
      console.log(`🔐 [CORA] ${account}: Certificado começa com: ${cert.substring(0, 30)}...`);
      return { cert, key };
    } catch (error) {
      console.error('Erro ao decodificar certificados base64:', error);
    }
  }
  
  // Fallback para as variáveis de ambiente diretas (produção)
  if (config.CORA_CERTIFICATE && config.CORA_PRIVATE_KEY) {
    console.log(`🔐 [CORA] ${account}: Usando certificados DIRETOS`);
    return {
      cert: config.CORA_CERTIFICATE,
      key: config.CORA_PRIVATE_KEY,
    };
  }
  
  throw new Error(`Certificados do Cora (${account}) não configurados (nem arquivos nem variáveis de ambiente)`);
}

/**
 * Função loadCertificates para compatibilidade (usa conta ESPETOS por padrão)
 */
function loadCertificates() {
  return loadCertificatesForAccount('ESPETOS');
}

/**
 * Helper para fazer requisições HTTPS com mTLS para uma conta específica
 */
function makeHttpsRequestForAccount(
  account: CoraAccountType,
  method: string,
  reqPath: string,
  body?: string,
  headers?: Record<string, string>
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const config = getCoraConfigForAccount(account);
    const { cert, key } = loadCertificatesForAccount(account);

    const options: https.RequestOptions = {
      hostname: config.CORA_API_URL,
      port: 443,
      path: reqPath,
      method,
      headers: headers || {},
      cert,
      key,
      rejectUnauthorized: true,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode || 500, data: jsonData });
        } catch (error) {
          resolve({ status: res.statusCode || 500, data });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (body) {
      req.write(body);
    }

    req.end();
  });
}

/**
 * Helper para fazer requisições HTTPS com mTLS (compatibilidade - usa ESPETOS)
 */
function makeHttpsRequest(
  method: string,
  reqPath: string,
  body?: string,
  headers?: Record<string, string>
): Promise<{ status: number; data: any }> {
  return makeHttpsRequestForAccount('ESPETOS', method, reqPath, body, headers);
}

/**
 * Gera token de autenticação OAuth2 para uma conta específica
 */
async function generateTokenForAccount(account: CoraAccountType): Promise<string> {
  // Verifica cache
  if (tokenCache[account] && tokenCache[account]!.expiresAt > Date.now()) {
    return tokenCache[account]!.token;
  }

  const config = getCoraConfigForAccount(account);

  if (!config.CORA_CLIENT_ID) {
    throw new Error(`CORA_CLIENT_ID não configurado para conta ${account}`);
  }

  // Cora espera application/x-www-form-urlencoded
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.CORA_CLIENT_ID,
  });

  const result = await makeHttpsRequestForAccount(
    account,
    'POST',
    '/token',
    params.toString(),
    {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(params.toString()).toString(),
    }
  );

  if (result.status !== 200) {
    throw new Error(`Erro ao gerar token Cora (${account}): ${result.status} - ${JSON.stringify(result.data)}`);
  }

  // Cache do token (expira em 50 minutos, token dura 1h)
  tokenCache[account] = {
    token: result.data.access_token,
    expiresAt: Date.now() + 50 * 60 * 1000,
  };

  return result.data.access_token;
}

/**
 * Gera token de autenticação OAuth2 (compatibilidade - usa ESPETOS)
 */
async function generateToken(): Promise<string> {
  return generateTokenForAccount('ESPETOS');
}

/**
 * Interface para criar cobrança PIX
 */
export interface CreatePixChargeParams {
  code: string; // Código único da cobrança
  customerName: string;
  customerDocument: string; // CPF ou CNPJ
  customerEmail?: string;
  amount: number; // Valor em centavos
  dueDate: string; // YYYY-MM-DD
  description: string;
  account?: CoraAccountType; // 🆕 Conta a ser usada (ESPETOS ou GENUINO)
}

/**
 * Interface da resposta de criação de cobrança
 */
export interface PixChargeResponse {
  id: string;
  code: string;
  status: string;
  qr_code: string; // Código PIX copia e cola (emv)
  qr_code_image: string; // URL do PDF do boleto
  barcode?: string; // Código de barras do boleto
  digitable_line?: string; // Linha digitável do boleto
  due_date: string;
  amount: number; // Valor em centavos
}

/**
 * Cria uma cobrança PIX no Cora
 * @param params - Parâmetros da cobrança, incluindo a conta a ser usada (ESPETOS ou GENUINO)
 */
export async function createPixCharge(params: CreatePixChargeParams): Promise<PixChargeResponse> {
  try {
    // 🆕 Determina qual conta usar (padrão: ESPETOS)
    const account: CoraAccountType = params.account || 'ESPETOS';
    console.log(`🏦 [CORA] Usando conta: ${account}`);
    
    const token = await generateTokenForAccount(account);

    // Gerar Idempotency-Key único para evitar duplicatas
    const crypto = require('crypto');
    const idempotencyKey = crypto.randomUUID();

    const payload = {
      code: params.code,
      customer: {
        name: params.customerName,
        document: {
          identity: params.customerDocument.replace(/\D/g, ''),
          type: params.customerDocument.replace(/\D/g, '').length === 11 ? 'CPF' : 'CNPJ',
        },
        ...(params.customerEmail && { email: params.customerEmail }),
      },
      services: [
        {
          name: params.description,
          quantity: 1,
          amount: params.amount,
        },
      ],
      payment_terms: {
        due_date: params.dueDate,
        // Configuração de multa e juros para atraso
        fine: {
          mode: 'FIXED', // Multa fixa de 2%
          rate: 2.0, // 2% de multa após vencimento
        },
        interest: {
          mode: 'MONTHLY', // Juros mensal
          rate: 1.0, // 1% ao mês (0,033% ao dia)
        },
      },
      payment_forms: ['BANK_SLIP', 'PIX'], // Gera boleto bancário + PIX
    };
    
    console.log(`📋 [CORA ${account}] Criando boleto com juros e multa configurados:`);
    console.log('   - Multa: 2% após vencimento');
    console.log('   - Juros: 1% ao mês (0,033% ao dia)');

    const payloadString = JSON.stringify(payload);
    
    const result = await makeHttpsRequestForAccount(
      account,
      'POST',
      '/v2/invoices',
      payloadString,
      {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Idempotency-Key': idempotencyKey, // Header obrigatório
        'Content-Length': Buffer.byteLength(payloadString).toString(),
      }
    );

    if (result.status !== 200 && result.status !== 201) {
      throw new Error(`Erro ao criar cobrança PIX Cora: ${result.status} - ${JSON.stringify(result.data)}`);
    }

    const data = result.data;

    // Extrai os dados importantes (boleto + PIX)
    // Estrutura real da API Cora:
    return {
      id: data.id,
      code: data.code,
      status: data.status,
      qr_code: data.pix?.emv || '',
      qr_code_image: data.payment_options?.bank_slip?.url || '',
      barcode: data.payment_options?.bank_slip?.barcode || '',
      digitable_line: data.payment_options?.bank_slip?.digitable || '',
      due_date: data.payment_terms?.due_date || params.dueDate,
      amount: data.total_amount || params.amount,
    };
  } catch (error) {
    console.error('Erro ao criar cobrança PIX no Cora:', error);
    throw error;
  }
}

/**
 * Consulta uma cobrança PIX no Cora
 */
export async function getPixCharge(invoiceId: string): Promise<PixChargeResponse> {
  try {
    const token = await generateToken();

    const result = await makeHttpsRequest(
      'GET',
      `/v2/invoices/${invoiceId}`,
      undefined,
      {
        'Authorization': `Bearer ${token}`,
      }
    );

    if (result.status !== 200) {
      throw new Error(`Erro ao consultar cobrança PIX Cora: ${result.status} - ${JSON.stringify(result.data)}`);
    }

    const data = result.data;

    return {
      id: data.id,
      code: data.code,
      status: data.status,
      qr_code: data.pix?.emv || '',
      qr_code_image: data.payment_options?.bank_slip?.url || '',
      barcode: data.payment_options?.bank_slip?.barcode || '',
      digitable_line: data.payment_options?.bank_slip?.digitable || '',
      due_date: data.payment_terms?.due_date || '',
      amount: data.total_amount || 0,
    };
  } catch (error) {
    console.error('Erro ao consultar cobrança PIX no Cora:', error);
    throw error;
  }
}

/**
 * Cancela uma cobrança PIX no Cora
 */
export async function cancelPixCharge(invoiceId: string, account?: CoraAccountType): Promise<void> {
  try {
    // 🏦 Usar a conta especificada ou ESPETOS como padrão
    const coraAccount: CoraAccountType = account || 'ESPETOS';
    console.log(`🏦 [CORA] Cancelando boleto ${invoiceId} na conta: ${coraAccount}`);
    
    const token = await generateTokenForAccount(coraAccount);

    const result = await makeHttpsRequestForAccount(
      coraAccount,
      'DELETE',
      `/v2/invoices/${invoiceId}`,
      undefined,
      {
        'Authorization': `Bearer ${token}`,
      }
    );

    if (result.status !== 200 && result.status !== 204) {
      throw new Error(`Erro ao cancelar cobrança PIX Cora (${coraAccount}): ${result.status} - ${JSON.stringify(result.data)}`);
    }
    
    console.log(`✅ [CORA] Boleto ${invoiceId} cancelado com sucesso na conta ${coraAccount}`);
  } catch (error) {
    console.error('Erro ao cancelar cobrança PIX no Cora:', error);
    throw error;
  }
}

/**
 * Verifica se uma conta Cora específica está configurada
 */
export function isCoraAccountConfigured(account: CoraAccountType): boolean {
  const config = getCoraConfigForAccount(account);
  
  console.log(`🔍 [CORA] Verificando conta ${account}:`)
  console.log(`   CLIENT_ID: ${config.CORA_CLIENT_ID ? '✅ ' + config.CORA_CLIENT_ID : '❌'}`)
  console.log(`   CERTIFICATE_BASE64: ${config.CORA_CERTIFICATE_BASE64 ? '✅ (' + config.CORA_CERTIFICATE_BASE64.length + ' chars)' : '❌'}`)
  console.log(`   PRIVATE_KEY_BASE64: ${config.CORA_PRIVATE_KEY_BASE64 ? '✅ (' + config.CORA_PRIVATE_KEY_BASE64.length + ' chars)' : '❌'}`)
  
  // Verifica se tem certificados em Base64 (produção)
  const hasBase64Certs = !!(config.CORA_CERTIFICATE_BASE64 && config.CORA_PRIVATE_KEY_BASE64)
  
  // Verifica se tem certificados em arquivos (desenvolvimento)
  let hasFileCerts = false
  if (config.CORA_CERTIFICATE_PATH && config.CORA_PRIVATE_KEY_PATH) {
    try {
      const certPath = path.resolve(process.cwd(), config.CORA_CERTIFICATE_PATH)
      const keyPath = path.resolve(process.cwd(), config.CORA_PRIVATE_KEY_PATH)
      hasFileCerts = fs.existsSync(certPath) && fs.existsSync(keyPath)
    } catch (error) {
      // Ignora erros de arquivo
    }
  }
  
  const result = !!(config.CORA_CLIENT_ID && (hasBase64Certs || hasFileCerts));
  console.log(`   RESULTADO: ${result ? '✅ Configurada' : '❌ Não configurada'}`)
  
  return result;
}

/**
 * Retorna lista de contas Cora disponíveis (configuradas)
 */
export function getAvailableCoraAccounts(): { account: CoraAccountType; name: string }[] {
  const accounts: { account: CoraAccountType; name: string }[] = [];
  
  if (isCoraAccountConfigured('ESPETOS')) {
    accounts.push({ account: 'ESPETOS', name: 'Cora Espetos' });
  }
  
  if (isCoraAccountConfigured('GENUINO')) {
    accounts.push({ account: 'GENUINO', name: 'Cora Genuíno' });
  }
  
  console.log(`🏦 [CORA] Contas disponíveis: ${accounts.map(a => a.name).join(', ') || 'Nenhuma'}`);
  
  return accounts;
}

/**
 * Verifica se as credenciais do Cora estão configuradas (compatibilidade - verifica ESPETOS)
 */
export function isCoraConfigured(): boolean {
  const config = getCoraConfig();
  
  console.log('\n🔍 VERIFICANDO CONFIGURAÇÃO DO CORA (isCoraConfigured):')
  console.log('  CORA_CLIENT_ID:', config.CORA_CLIENT_ID ? `✅ "${config.CORA_CLIENT_ID}"` : '❌ undefined')
  console.log('  CORA_CERTIFICATE_BASE64:', config.CORA_CERTIFICATE_BASE64 ? `✅ Configurado (${config.CORA_CERTIFICATE_BASE64.length} chars)` : '❌ undefined')
  console.log('  CORA_PRIVATE_KEY_BASE64:', config.CORA_PRIVATE_KEY_BASE64 ? `✅ Configurado (${config.CORA_PRIVATE_KEY_BASE64.length} chars)` : '❌ undefined')
  console.log('  CORA_CERTIFICATE_PATH:', config.CORA_CERTIFICATE_PATH ? `✅ "${config.CORA_CERTIFICATE_PATH}"` : '❌ undefined')
  console.log('  CORA_PRIVATE_KEY_PATH:', config.CORA_PRIVATE_KEY_PATH ? `✅ "${config.CORA_PRIVATE_KEY_PATH}"` : '❌ undefined')
  
  // Verifica se tem certificados em Base64 (produção)
  const hasBase64Certs = !!(config.CORA_CERTIFICATE_BASE64 && config.CORA_PRIVATE_KEY_BASE64)
  console.log('  Certificados Base64:', hasBase64Certs ? '✅ Sim' : '❌ Não')
  
  // Verifica se tem certificados em arquivos (desenvolvimento)
  let hasFileCerts = false
  if (config.CORA_CERTIFICATE_PATH && config.CORA_PRIVATE_KEY_PATH) {
    try {
      const certPath = path.resolve(process.cwd(), config.CORA_CERTIFICATE_PATH)
      const keyPath = path.resolve(process.cwd(), config.CORA_PRIVATE_KEY_PATH)
      hasFileCerts = fs.existsSync(certPath) && fs.existsSync(keyPath)
      console.log('  Certificate Full Path:', certPath)
      console.log('  Certificate Exists:', fs.existsSync(certPath) ? '✅ Sim' : '❌ Não')
      console.log('  Private Key Full Path:', keyPath)
      console.log('  Private Key Exists:', fs.existsSync(keyPath) ? '✅ Sim' : '❌ Não')
    } catch (error) {
      console.log('  Erro ao verificar arquivos:', error)
    }
  }
  console.log('  Certificados em Arquivos:', hasFileCerts ? '✅ Sim' : '❌ Não')
  
  // Verifica também GENUINO
  const genuinoConfig = getCoraConfigForAccount('GENUINO');
  const hasGenuino = !!(genuinoConfig.CORA_CLIENT_ID && (genuinoConfig.CORA_CERTIFICATE_BASE64 || genuinoConfig.CORA_PRIVATE_KEY_BASE64));
  console.log('  🆕 Conta GENUINO:', hasGenuino ? '✅ Configurada' : '❌ Não configurada')
  
  // Cora está configurado se tem CLIENT_ID e (certificados Base64 OU certificados em arquivos)
  const result = !!(
    config.CORA_CLIENT_ID &&
    (hasBase64Certs || hasFileCerts)
  );
  
  console.log('  RESULTADO:', result ? '✅ Configurado - Usar CORA' : '❌ Não configurado')
  console.log('')
  
  return result;
}

/**
 * ========================================
 * FASE 3: INTEGRAÇÃO BANCÁRIA AVANÇADA
 * ========================================
 */

/**
 * Interface para transação bancária do Cora
 */
export interface CoraTransaction {
  id: string;
  date: string; // ISO 8601
  description: string;
  type: 'CREDIT' | 'DEBIT';
  amount: number; // Valor em centavos
  balance: number; // Saldo após transação em centavos
  category?: string;
  metadata?: Record<string, any>;
}

/**
 * Interface para filtros de busca de extratos
 */
export interface BankStatementFilters {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  type?: 'CREDIT' | 'DEBIT' | 'ALL';
  minAmount?: number; // Em centavos
  maxAmount?: number; // Em centavos
}

/**
 * Busca extratos bancários do Cora
 * @param filters - Filtros de busca (datas, tipo, valores)
 * @returns Lista de transações
 */
export async function getBankStatements(filters: BankStatementFilters): Promise<CoraTransaction[]> {
  try {
    const token = await generateToken();

    // Monta os query params
    const params = new URLSearchParams({
      start_date: filters.startDate,
      end_date: filters.endDate,
    });

    if (filters.type && filters.type !== 'ALL') {
      params.append('type', filters.type);
    }

    if (filters.minAmount) {
      params.append('min_amount', filters.minAmount.toString());
    }

    if (filters.maxAmount) {
      params.append('max_amount', filters.maxAmount.toString());
    }

    const result = await makeHttpsRequest(
      'GET',
      `/statements?${params.toString()}`,
      undefined,
      {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    );

    if (result.status !== 200) {
      throw new Error(`Erro ao buscar extratos Cora: ${result.status} - ${JSON.stringify(result.data)}`);
    }

    // Mapeia a resposta do Cora para nosso formato
    const transactions: CoraTransaction[] = (result.data.transactions || []).map((tx: any) => ({
      id: tx.id,
      date: tx.date,
      description: tx.description || tx.counterpart?.name || 'Transação',
      type: tx.entry_type === 'CREDIT' ? 'CREDIT' : 'DEBIT',
      amount: Math.abs(tx.amount || 0), // Sempre positivo, o tipo indica entrada/saída
      balance: tx.balance || 0,
      category: tx.category || undefined,
      metadata: {
        original: tx, // Guarda dados originais
        counterpart: tx.counterpart,
      },
    }));

    return transactions;
  } catch (error) {
    console.error('Erro ao buscar extratos Cora:', error);
    throw error;
  }
}

/**
 * Busca o saldo atual da conta Cora
 * @returns Saldo em centavos
 */
export async function getAccountBalance(): Promise<number> {
  try {
    const token = await generateToken();

    const result = await makeHttpsRequest(
      'GET',
      '/accounts/balance',
      undefined,
      {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    );

    if (result.status !== 200) {
      throw new Error(`Erro ao buscar saldo Cora: ${result.status} - ${JSON.stringify(result.data)}`);
    }

    return result.data.balance || 0;
  } catch (error) {
    console.error('Erro ao buscar saldo Cora:', error);
    throw error;
  }
}

/**
 * Busca detalhes de uma transação específica
 * @param transactionId - ID da transação no Cora
 */
export async function getTransactionDetails(transactionId: string): Promise<CoraTransaction | null> {
  try {
    const token = await generateToken();

    const result = await makeHttpsRequest(
      'GET',
      `/transactions/${transactionId}`,
      undefined,
      {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    );

    if (result.status !== 200) {
      throw new Error(`Erro ao buscar transação Cora: ${result.status} - ${JSON.stringify(result.data)}`);
    }

    const tx = result.data;

    return {
      id: tx.id,
      date: tx.date,
      description: tx.description || tx.counterpart?.name || 'Transação',
      type: tx.entry_type === 'CREDIT' ? 'CREDIT' : 'DEBIT',
      amount: Math.abs(tx.amount || 0),
      balance: tx.balance || 0,
      category: tx.category || undefined,
      metadata: {
        original: tx,
        counterpart: tx.counterpart,
      },
    };
  } catch (error) {
    console.error('Erro ao buscar detalhes da transação:', error);
    return null;
  }
}

// ========================================
// 💜 PIX INSTANTÂNEO - QR CODE PARA CHECKOUT
// ========================================

export interface CreateInstantPixParams {
  code: string;             // Código único da cobrança
  amount: number;           // Valor em centavos
  description: string;      // Descrição do pagamento
  customerName?: string;    // Nome do cliente (opcional)
  customerDocument?: string; // CPF/CNPJ (opcional)
  account: CoraAccountType; // Conta a usar (ESPETOS ou GENUINO)
  expiresInMinutes?: number; // Tempo de expiração (padrão: 30 min)
}

export interface InstantPixResponse {
  id: string;
  code: string;
  status: string;
  qrCode: string;           // Código PIX copia e cola (EMV)
  qrCodeBase64?: string;    // QR Code em base64 para exibição
  amount: number;           // Valor em centavos
  expiresAt?: string;
}

/**
 * Calcula a taxa do Cora para PIX
 * - Até R$ 49,99: 1% do valor
 * - R$ 50,00 ou mais: R$ 0,50 fixo
 */
export function calculatePixFee(amountInCents: number): number {
  const amountInReais = amountInCents / 100;
  if (amountInReais < 50) {
    return Math.round(amountInCents * 0.01); // 1% em centavos
  }
  return 50; // R$ 0,50 = 50 centavos
}

/**
 * Cria uma cobrança PIX instantânea (apenas QR Code, sem boleto)
 * Para uso em checkouts com pagamento imediato
 */
export async function createInstantPixCharge(params: CreateInstantPixParams): Promise<InstantPixResponse> {
  try {
    const account = params.account;
    console.log(`💜 [PIX INSTANTÂNEO] Criando cobrança na conta: ${account}`);
    
    const token = await generateTokenForAccount(account);
    const crypto = require('crypto');
    const idempotencyKey = crypto.randomUUID();

    // Para PIX instantâneo, usamos apenas PIX (sem BANK_SLIP)
    const payload: any = {
      code: params.code,
      services: [
        {
          name: params.description || 'Pagamento PIX',
          quantity: 1,
          amount: params.amount,
        },
      ],
      payment_terms: {
        due_date: new Date().toISOString().split('T')[0], // Vence hoje
      },
      payment_forms: ['PIX'], // Apenas PIX, sem boleto
    };

    // Cliente é OBRIGATÓRIO para API Cora
    // Usar dados fornecidos ou padrão para vendas sem cadastro
    const customerName = params.customerName || 'CONSUMIDOR FINAL';
    const customerDoc = params.customerDocument?.replace(/\D/g, '') || '00000000000'; // CPF padrão
    
    payload.customer = {
      name: customerName,
      document: {
        identity: customerDoc,
        type: customerDoc.length === 11 ? 'CPF' : 'CNPJ',
      },
    };

    const payloadString = JSON.stringify(payload);
    console.log(`💜 [PIX] Payload:`, payloadString);

    const result = await makeHttpsRequestForAccount(
      account,
      'POST',
      '/v2/invoices',
      payloadString,
      {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Idempotency-Key': idempotencyKey,
        'Content-Length': Buffer.byteLength(payloadString).toString(),
      }
    );

    if (result.status !== 200 && result.status !== 201) {
      console.error('❌ [PIX] Erro na API Cora:', result.status, result.data);
      throw new Error(`Erro ao criar PIX Cora: ${result.status} - ${JSON.stringify(result.data)}`);
    }

    const data = result.data;
    console.log(`💜 [PIX] Resposta Cora:`, JSON.stringify(data, null, 2));

    return {
      id: data.id,
      code: data.code,
      status: data.status,
      qrCode: data.pix?.emv || '',
      qrCodeBase64: data.pix?.qr_code_base64 || '',
      amount: data.total_amount || params.amount,
      expiresAt: data.pix?.expires_at,
    };
  } catch (error) {
    console.error('❌ [PIX] Erro ao criar cobrança:', error);
    throw error;
  }
}

/**
 * Consulta o status de uma cobrança PIX
 */
export async function getInstantPixStatus(invoiceId: string, account: CoraAccountType): Promise<InstantPixResponse> {
  try {
    const token = await generateTokenForAccount(account);

    const result = await makeHttpsRequestForAccount(
      account,
      'GET',
      `/v2/invoices/${invoiceId}`,
      undefined,
      {
        'Authorization': `Bearer ${token}`,
      }
    );

    if (result.status !== 200) {
      throw new Error(`Erro ao consultar PIX: ${result.status} - ${JSON.stringify(result.data)}`);
    }

    const data = result.data;
    
    return {
      id: data.id,
      code: data.code,
      status: data.status,
      qrCode: data.pix?.emv || '',
      qrCodeBase64: data.pix?.qr_code_base64 || '',
      amount: data.total_amount || 0,
      expiresAt: data.pix?.expires_at,
    };
  } catch (error) {
    console.error('❌ [PIX] Erro ao consultar status:', error);
    throw error;
  }
}
