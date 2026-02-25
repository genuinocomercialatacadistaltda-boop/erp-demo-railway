/**
 * Evolution API Integration
 * Sistema de envio de mensagens WhatsApp via Evolution API
 * Funciona com instância local (seu computador) ou servidor remoto
 */

import fs from 'fs';
import path from 'path';

interface EvolutionConfig {
  apiUrl: string;
  instanceName: string;
  apiKey?: string;
}

interface WhatsAppInstanceStatus {
  state: 'close' | 'connecting' | 'open';
  qrcode?: string;
  connected: boolean;
  phone?: string;
}

interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Carrega configuração da Evolution API
 * Prioridade: 1) .env, 2) arquivo de configuração local
 */
function getEvolutionConfig(): EvolutionConfig | null {
  try {
    // Primeiro tenta ler das variáveis de ambiente (produção/servidor)
    if (process.env.EVOLUTION_API_URL && process.env.EVOLUTION_INSTANCE_NAME) {
      console.log('[EVOLUTION_API] Carregando configuração das variáveis de ambiente');
      return {
        apiUrl: process.env.EVOLUTION_API_URL,
        instanceName: process.env.EVOLUTION_INSTANCE_NAME,
        apiKey: process.env.EVOLUTION_API_KEY || undefined
      };
    }

    // Fallback: tenta ler de arquivo local (desenvolvimento)
    const configPath = path.join(process.cwd(), '.evolution-config.json');
    
    if (fs.existsSync(configPath)) {
      console.log('[EVOLUTION_API] Carregando configuração do arquivo local');
      const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return {
        apiUrl: configData.apiUrl || 'http://localhost:8080',
        instanceName: configData.instanceName || 'espetos_genuino',
        apiKey: configData.apiKey
      };
    }

    console.warn('[EVOLUTION_API] Configuração não encontrada. Use valores padrão para teste.');
    
    // Configuração padrão para teste local
    return {
      apiUrl: 'http://localhost:8080',
      instanceName: 'espetos_genuino',
      apiKey: undefined
    };

  } catch (error) {
    console.error('[EVOLUTION_API] Erro ao carregar configuração:', error);
    return null;
  }
}

/**
 * Verifica se a Evolution API está configurada e acessível
 */
export async function isEvolutionApiConfigured(): Promise<boolean> {
  try {
    const config = getEvolutionConfig();
    if (!config) {
      console.log('[EVOLUTION_API] Configuração não encontrada');
      return false;
    }

    console.log('[EVOLUTION_API] Testando conexão com:', config.apiUrl);
    
    // Tenta fazer ping na API
    const response = await fetch(`${config.apiUrl}/instance/fetchInstances`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey && { 'apikey': config.apiKey })
      },
      signal: AbortSignal.timeout(5000) // Timeout de 5 segundos
    });

    if (response.ok) {
      console.log('[EVOLUTION_API] ✅ Evolution API está acessível');
      return true;
    }

    console.log('[EVOLUTION_API] ⚠️ Evolution API respondeu com status:', response.status);
    return false;

  } catch (error: any) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      console.error('[EVOLUTION_API] ❌ Timeout - Evolution API não está respondendo');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('[EVOLUTION_API] ❌ Conexão recusada - Evolution API não está rodando');
    } else {
      console.error('[EVOLUTION_API] ❌ Erro ao verificar configuração:', error.message);
    }
    return false;
  }
}

/**
 * Obtém o status atual da instância WhatsApp
 */
export async function getInstanceStatus(): Promise<WhatsAppInstanceStatus | null> {
  try {
    const config = getEvolutionConfig();
    if (!config) {
      return null;
    }

    console.log('[EVOLUTION_API] Verificando status da instância:', config.instanceName);

    const response = await fetch(
      `${config.apiUrl}/instance/connectionState/${config.instanceName}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey && { 'apikey': config.apiKey })
        },
        signal: AbortSignal.timeout(10000)
      }
    );

    if (!response.ok) {
      console.error('[EVOLUTION_API] Erro ao buscar status:', response.status);
      return null;
    }

    const data = await response.json();
    console.log('[EVOLUTION_API] Status recebido:', data);

    return {
      state: data.state || 'close',
      connected: data.state === 'open',
      phone: data.instance?.owner || undefined
    };

  } catch (error: any) {
    console.error('[EVOLUTION_API] Erro ao obter status:', error.message);
    return null;
  }
}

/**
 * Cria ou conecta a uma instância WhatsApp
 * Retorna o QR Code para escanear
 */
export async function createOrConnectInstance(): Promise<{
  success: boolean;
  qrcode?: string;
  alreadyConnected?: boolean;
  error?: string;
}> {
  try {
    const config = getEvolutionConfig();
    if (!config) {
      return {
        success: false,
        error: 'Configuração da Evolution API não encontrada'
      };
    }

    console.log('[EVOLUTION_API] Criando/conectando instância:', config.instanceName);

    // Primeiro verifica se já existe
    const status = await getInstanceStatus();
    if (status?.connected) {
      console.log('[EVOLUTION_API] Instância já está conectada');
      return {
        success: true,
        alreadyConnected: true
      };
    }

    // Cria nova instância
    const createResponse = await fetch(`${config.apiUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey && { 'apikey': config.apiKey })
      },
      body: JSON.stringify({
        instanceName: config.instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS'
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (!createResponse.ok) {
      const errorData = await createResponse.json().catch(() => ({}));
      console.error('[EVOLUTION_API] Erro ao criar instância:', errorData);
      
      // Se o erro é que já existe, tenta conectar
      if (createResponse.status === 409 || errorData.message?.includes('already exists')) {
        console.log('[EVOLUTION_API] Instância já existe, conectando...');
        return await connectExistingInstance();
      }
      
      return {
        success: false,
        error: errorData.message || 'Erro ao criar instância'
      };
    }

    const data = await createResponse.json();
    console.log('[EVOLUTION_API] Instância criada:', data);

    // Aguarda alguns segundos para o QR Code ser gerado
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Busca o QR Code
    const qrcodeResponse = await fetch(
      `${config.apiUrl}/instance/connect/${config.instanceName}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey && { 'apikey': config.apiKey })
        },
        signal: AbortSignal.timeout(10000)
      }
    );

    if (qrcodeResponse.ok) {
      const qrData = await qrcodeResponse.json();
      console.log('[EVOLUTION_API] QR Code obtido com sucesso');
      
      return {
        success: true,
        qrcode: qrData.base64 || qrData.code || qrData.qrcode?.base64
      };
    }

    return {
      success: true,
      qrcode: undefined
    };

  } catch (error: any) {
    console.error('[EVOLUTION_API] Erro ao criar/conectar instância:', error);
    return {
      success: false,
      error: error.message || 'Erro desconhecido'
    };
  }
}

/**
 * Conecta a uma instância existente e obtém QR Code
 */
async function connectExistingInstance(): Promise<{
  success: boolean;
  qrcode?: string;
  error?: string;
}> {
  try {
    const config = getEvolutionConfig();
    if (!config) {
      return { success: false, error: 'Configuração não encontrada' };
    }

    const response = await fetch(
      `${config.apiUrl}/instance/connect/${config.instanceName}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey && { 'apikey': config.apiKey })
        },
        signal: AbortSignal.timeout(10000)
      }
    );

    if (!response.ok) {
      return { success: false, error: 'Erro ao conectar instância existente' };
    }

    const data = await response.json();
    console.log('[EVOLUTION_API] Conectado à instância existente');

    return {
      success: true,
      qrcode: data.base64 || data.code || data.qrcode?.base64
    };

  } catch (error: any) {
    console.error('[EVOLUTION_API] Erro ao conectar instância existente:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Desconecta e deleta a instância WhatsApp
 */
export async function disconnectInstance(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const config = getEvolutionConfig();
    if (!config) {
      return { success: false, error: 'Configuração não encontrada' };
    }

    console.log('[EVOLUTION_API] Desconectando instância:', config.instanceName);

    // Primeiro faz logout
    await fetch(`${config.apiUrl}/instance/logout/${config.instanceName}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey && { 'apikey': config.apiKey })
      }
    }).catch(() => {});

    // Depois deleta a instância
    const response = await fetch(
      `${config.apiUrl}/instance/delete/${config.instanceName}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey && { 'apikey': config.apiKey })
        },
        signal: AbortSignal.timeout(10000)
      }
    );

    if (!response.ok) {
      console.error('[EVOLUTION_API] Erro ao desconectar:', response.status);
      return { success: false, error: 'Erro ao desconectar instância' };
    }

    console.log('[EVOLUTION_API] ✅ Instância desconectada com sucesso');
    return { success: true };

  } catch (error: any) {
    console.error('[EVOLUTION_API] Erro ao desconectar instância:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Formata número de telefone para o formato do WhatsApp
 * Exemplo: (63) 99999-7942 -> 5563999997942
 */
export function formatWhatsAppNumber(phone: string): string {
  // Remove todos os caracteres não numéricos
  const cleaned = phone.replace(/\D/g, '');
  
  // Se já tem código do país, retorna como está
  if (cleaned.length >= 12 && cleaned.startsWith('55')) {
    return cleaned;
  }
  
  // Adiciona código do Brasil (55)
  return `55${cleaned}`;
}

/**
 * Envia uma mensagem via Evolution API
 */
export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<SendMessageResult> {
  try {
    const config = getEvolutionConfig();
    if (!config) {
      console.error('[EVOLUTION_API] Configuração não encontrada');
      return {
        success: false,
        error: 'Evolution API não configurada'
      };
    }

    // Verifica se está conectado
    const status = await getInstanceStatus();
    if (!status?.connected) {
      console.error('[EVOLUTION_API] Instância não está conectada');
      return {
        success: false,
        error: '❌ WhatsApp não está conectado. Acesse o painel admin e escaneie o QR Code.'
      };
    }

    // Formata o número
    const phoneNumber = formatWhatsAppNumber(to);

    console.log('[EVOLUTION_API] Enviando mensagem...');
    console.log('[EVOLUTION_API] Para:', phoneNumber);
    console.log('[EVOLUTION_API] Mensagem:', message.substring(0, 100) + '...');

    // Envia a mensagem
    const response = await fetch(
      `${config.apiUrl}/message/sendText/${config.instanceName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey && { 'apikey': config.apiKey })
        },
        body: JSON.stringify({
          number: phoneNumber,
          text: message
        }),
        signal: AbortSignal.timeout(15000)
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[EVOLUTION_API] Erro ao enviar mensagem:', errorData);
      
      let errorMessage = 'Erro ao enviar mensagem';
      
      if (errorData.message?.includes('not connected')) {
        errorMessage = '❌ WhatsApp desconectado. Reconecte pelo painel admin.';
      } else if (errorData.message?.includes('invalid number')) {
        errorMessage = '❌ Número de telefone inválido: ' + to;
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }

    const data = await response.json();
    console.log('[EVOLUTION_API] ✅ Mensagem enviada com sucesso!');
    console.log('[EVOLUTION_API] ID da mensagem:', data.key?.id);

    return {
      success: true,
      messageId: data.key?.id || data.messageId
    };

  } catch (error: any) {
    console.error('[EVOLUTION_API] ❌ Erro ao enviar mensagem:', error);
    
    let errorMessage = 'Erro ao enviar mensagem';
    
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      errorMessage = '❌ Timeout - Evolution API não respondeu a tempo';
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = '❌ Evolution API não está rodando. Inicie o serviço.';
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Envia lembrete de boleto vencendo
 */
export async function sendBoletoReminder(
  customerName: string,
  customerPhone: string,
  boletoAmount: number,
  dueDate: Date
): Promise<{ success: boolean; error?: string }> {
  const dueDateStr = dueDate.toLocaleDateString('pt-BR');
  const amountStr = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(boletoAmount);

  const message = `🔔 *Lembrete de Pagamento*\n\n` +
    `Olá ${customerName}! \n\n` +
    `Seu boleto no valor de *${amountStr}* vence em *${dueDateStr}*.\n\n` +
    `Por favor, realize o pagamento para evitar atrasos.\n\n` +
    `Qualquer dúvida, estamos à disposição! 😊`;

  return await sendWhatsAppMessage(customerPhone, message);
}

/**
 * Envia lembrete de boleto vencido
 */
export async function sendOverdueBoletoNotification(
  customerName: string,
  customerPhone: string,
  boletoAmount: number,
  dueDate: Date
): Promise<{ success: boolean; error?: string }> {
  const dueDateStr = dueDate.toLocaleDateString('pt-BR');
  const amountStr = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(boletoAmount);

  const message = `⚠️ *Boleto Vencido*\n\n` +
    `Olá ${customerName}! \n\n` +
    `Identificamos que seu boleto no valor de *${amountStr}* com vencimento em *${dueDateStr}* está em atraso.\n\n` +
    `Por favor, regularize o pagamento o quanto antes para evitar bloqueios.\n\n` +
    `Estamos à disposição para qualquer esclarecimento! 📞`;

  return await sendWhatsAppMessage(customerPhone, message);
}

/**
 * Envia lembrete de pedido
 */
export async function sendOrderReminder(
  customerName: string,
  customerPhone: string,
  lastOrderDate?: Date
): Promise<{ success: boolean; error?: string }> {
  let message = `👋 *Olá ${customerName}!*\n\n`;

  if (lastOrderDate) {
    const daysSince = Math.floor(
      (Date.now() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    message += `Já faz ${daysSince} dias desde seu último pedido! 😊\n\n`;
  }

  message += `Que tal fazer um novo pedido hoje? \n` +
    `Estamos com produtos fresquinhos esperando por você! 🍖\n\n` +
    `Qualquer dúvida, é só chamar! 📱`;

  return await sendWhatsAppMessage(customerPhone, message);
}

/**
 * Envia notificação de mudança de status do pedido
 */
export async function sendOrderStatusUpdate(
  customerName: string,
  customerPhone: string,
  orderNumber: string,
  status: string
): Promise<{ success: boolean; error?: string }> {
  const statusMessages: Record<string, string> = {
    'PROCESSING': '⏳ seu pedido está sendo preparado',
    'READY': '✅ seu pedido está pronto para retirada/entrega',
    'SHIPPED': '🚚 seu pedido saiu para entrega',
    'DELIVERED': '🎉 seu pedido foi entregue'
  };

  const statusMsg = statusMessages[status] || `status foi atualizado para: ${status}`;

  const message = `📦 *Atualização do Pedido #${orderNumber}*\n\n` +
    `Olá ${customerName}! \n\n` +
    `Informamos que ${statusMsg}.\n\n` +
    `Obrigado pela preferência! 😊`;

  return await sendWhatsAppMessage(customerPhone, message);
}
