
/**
 * Integração com Asaas - Geração de Boletos e PIX
 * Documentação: https://docs.asaas.com/
 */

import axios from 'axios';

const ASAAS_API_URL = 'https://api.asaas.com/v3';
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;

if (!ASAAS_API_KEY) {
  console.warn('⚠️ ASAAS_API_KEY não configurada');
}

const asaasClient = axios.create({
  baseURL: ASAAS_API_URL,
  headers: {
    'Content-Type': 'application/json',
    'access_token': ASAAS_API_KEY || '',
  },
});

interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
  cpfCnpj: string;
}

interface AsaasPaymentResponse {
  id: string;
  status: string;
  value: number;
  netValue: number;
  dueDate: string;
  billingType: string;
  invoiceUrl: string;
  bankSlipUrl?: string;
  invoiceNumber?: string;
  description?: string;
  externalReference?: string;
  
  // Dados do Boleto
  identificationField?: string; // Linha digitável
  nossoNumero?: string;
  barCode?: string;
  
  // Dados do PIX
  pixTransaction?: {
    qrCode: {
      payload: string;
      encodedImage: string;
    };
    expirationDate: string;
  };
}

/**
 * Cria ou atualiza um cliente no Asaas
 */
export async function createOrUpdateAsaasCustomer(
  name: string,
  email: string,
  cpfCnpj: string,
  externalReference?: string
): Promise<AsaasCustomer> {
  try {
    // Primeiro, verifica se o cliente já existe
    const searchResponse = await asaasClient.get('/customers', {
      params: {
        cpfCnpj: cpfCnpj.replace(/\D/g, ''),
      },
    });

    if (searchResponse.data.data && searchResponse.data.data.length > 0) {
      // Cliente já existe, retorna os dados
      return searchResponse.data.data[0];
    }

    // Cliente não existe, cria um novo
    const response = await asaasClient.post('/customers', {
      name,
      email,
      cpfCnpj: cpfCnpj.replace(/\D/g, ''),
      externalReference,
    });

    return response.data;
  } catch (error: any) {
    console.error('❌ Erro ao criar/buscar cliente no Asaas:', error.response?.data || error.message);
    throw new Error(`Erro ao criar cliente no Asaas: ${error.response?.data?.errors?.[0]?.description || error.message}`);
  }
}

/**
 * Cria uma cobrança no Asaas (Boleto + PIX)
 */
export async function createAsaasPayment(params: {
  customerId: string;
  value: number;
  dueDate: string; // formato: YYYY-MM-DD
  description: string;
  externalReference: string;
}): Promise<AsaasPaymentResponse> {
  try {
    const response = await asaasClient.post('/payments', {
      customer: params.customerId,
      billingType: 'BOLETO', // Sempre boleto (já inclui PIX automático)
      value: params.value,
      dueDate: params.dueDate,
      description: params.description,
      externalReference: params.externalReference,
      // Configurações adicionais
      postalService: false, // Não enviar boleto pelos correios
      split: [], // Não dividir pagamento
    });

    return response.data;
  } catch (error: any) {
    console.error('❌ Erro ao criar cobrança no Asaas:', error.response?.data || error.message);
    throw new Error(`Erro ao criar cobrança no Asaas: ${error.response?.data?.errors?.[0]?.description || error.message}`);
  }
}

/**
 * Busca uma cobrança pelo ID
 */
export async function getAsaasPayment(paymentId: string): Promise<AsaasPaymentResponse> {
  try {
    const response = await asaasClient.get(`/payments/${paymentId}`);
    return response.data;
  } catch (error: any) {
    console.error('❌ Erro ao buscar cobrança no Asaas:', error.response?.data || error.message);
    throw new Error(`Erro ao buscar cobrança no Asaas: ${error.message}`);
  }
}

/**
 * Cancela uma cobrança
 */
export async function cancelAsaasPayment(paymentId: string): Promise<void> {
  try {
    await asaasClient.delete(`/payments/${paymentId}`);
  } catch (error: any) {
    console.error('❌ Erro ao cancelar cobrança no Asaas:', error.response?.data || error.message);
    throw new Error(`Erro ao cancelar cobrança no Asaas: ${error.message}`);
  }
}

/**
 * Gera o QR Code PIX para uma cobrança
 */
export async function generateAsaasPixQRCode(paymentId: string): Promise<{
  payload: string;
  encodedImage: string;
  expirationDate: string;
}> {
  try {
    const response = await asaasClient.get(`/payments/${paymentId}/pixQrCode`);
    return response.data;
  } catch (error: any) {
    console.error('❌ Erro ao gerar QR Code PIX no Asaas:', error.response?.data || error.message);
    throw new Error(`Erro ao gerar QR Code PIX: ${error.message}`);
  }
}

/**
 * Wrapper completo para criar boleto com todos os dados
 */
export async function createCompleteBoleto(params: {
  customerName: string;
  customerEmail: string;
  customerCpf: string;
  orderNumber: string;
  value: number;
  dueDate: string; // formato: YYYY-MM-DD
  description: string;
}) {
  try {
    console.log('🔄 Criando cliente no Asaas...');
    
    // 1. Criar/buscar cliente
    const customer = await createOrUpdateAsaasCustomer(
      params.customerName,
      params.customerEmail,
      params.customerCpf,
      `ORDER_${params.orderNumber}`
    );

    console.log('✅ Cliente criado/encontrado:', customer.id);
    console.log('🔄 Criando cobrança no Asaas...');

    // 2. Criar cobrança
    const payment = await createAsaasPayment({
      customerId: customer.id,
      value: params.value,
      dueDate: params.dueDate,
      description: params.description,
      externalReference: params.orderNumber,
    });

    console.log('✅ Cobrança criada:', payment.id);
    console.log('🔄 Gerando QR Code PIX...');

    // 3. Gerar QR Code PIX
    let pixData = null;
    try {
      pixData = await generateAsaasPixQRCode(payment.id);
      console.log('✅ QR Code PIX gerado com sucesso');
    } catch (pixError) {
      console.warn('⚠️ Não foi possível gerar QR Code PIX (pode não estar disponível ainda)');
    }

    // Aguardar 2 segundos para o Asaas processar
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Buscar o pagamento novamente para obter dados atualizados
    const updatedPayment = await getAsaasPayment(payment.id);

    return {
      paymentId: updatedPayment.id,
      status: updatedPayment.status,
      value: updatedPayment.value,
      dueDate: updatedPayment.dueDate,
      boletoUrl: updatedPayment.bankSlipUrl || updatedPayment.invoiceUrl,
      invoiceUrl: updatedPayment.invoiceUrl,
      barCode: updatedPayment.barCode || '',
      identificationField: updatedPayment.identificationField || '', // Linha digitável
      nossoNumero: updatedPayment.nossoNumero || '',
      pixQrCode: pixData?.payload || '',
      pixQrCodeImage: pixData?.encodedImage || '',
      pixExpirationDate: pixData?.expirationDate || '',
    };
  } catch (error: any) {
    console.error('❌ Erro ao criar boleto completo no Asaas:', error);
    throw error;
  }
}
